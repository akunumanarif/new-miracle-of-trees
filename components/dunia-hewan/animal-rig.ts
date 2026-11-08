import { AnimationClip, Bone, Box3, BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Animal } from "./animals";
import { BIRDS, type Agent } from "./wildlife";

const smooth = (lo: number, hi: number, value: number) => { const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
const X = new Vector3(1, 0, 0);
const turn = new Quaternion();

export type AnimalRig = {
  root: Group; height: number; clips: AnimationClip[];
  animate: (agent: Agent, time: number) => void;
  dispose: () => void;
};

function wingGeometry(span: number, chord: number, side: number, tip = false) {
  const g = new BufferGeometry();
  const points = tip
    ? [[span * .62, 0, -.12 * chord], [span, 0, -.45 * chord], [span * .8, 0, -chord], [span * .55, 0, -.7 * chord]]
    : [[0, 0, chord * .25], [span * .65, .03, chord * .1], [span, 0, -.45 * chord], [span * .8, 0, -chord], [span * .4, 0, -chord * .7], [0, 0, -chord * .2]];
  const vertices: number[] = [];
  for (let i = 1; i < points.length - 1; i++) for (const p of [points[0], points[i], points[i + 1]]) vertices.push(p[0] * side, p[1], p[2]);
  g.setAttribute("position", new Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
  return g;
}

function addWings(root: Group, animal: Animal, size: Vector3) {
  const wings: Group[] = [];
  const ownedGeometry: BufferGeometry[] = [], ownedMaterials: MeshStandardMaterial[] = [];
  const id = animal.id;
  const color = id === "parrot" ? "#e95243" : id === "flamingo" ? "#eb7790" : id === "duck" ? "#8f8c73" : id === "chick" ? "#efd06b" : "#e8e5d9";
  const tip = id === "parrot" ? "#3f7c48" : id === "chick" ? "#d9aa50" : "#434742";
  const y = size.y * (id === "stork" ? .54 : id === "flamingo" ? .59 : id === "duck" ? .38 : id === "goose" ? .43 : .53);
  const span = animal.size * (id === "chick" ? .45 : id === "parrot" ? .68 : .77);
  for (const side of [-1, 1]) {
    const pivot = new Group(); pivot.position.set(side * size.x * .3, y, -size.z * .09);
    for (const isTip of [false, true]) {
      const geometry = wingGeometry(span, animal.size * .48, side, isTip);
      const material = new MeshStandardMaterial({ color: isTip ? tip : color, side: DoubleSide, roughness: 1, flatShading: true });
      const mesh = new Mesh(geometry, material); mesh.castShadow = true;
      mesh.position.y = isTip ? .006 : 0;
      pivot.add(mesh); ownedGeometry.push(geometry); ownedMaterials.push(material);
    }
    root.add(pivot); wings.push(pivot);
  }
  return {
    animate(a: Agent, t: number) {
      const frequency = id === "chick" ? 21 : id === "parrot" ? 13 : 7.5;
      const flap = Math.sin(t * frequency + a.seed) * .68;
      wings.forEach((wing, i) => {
        wing.visible = a.flight > .015;
        wing.scale.set(.06 + a.flight * .94, 1, .5 + a.flight * .5);
        wing.rotation.z = (i === 0 ? -1 : 1) * (flap * a.flight + (1 - a.flight) * 1.2);
        wing.rotation.y = (i === 0 ? 1 : -1) * .12;
      });
    },
    dispose() { ownedGeometry.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose()); },
  };
}

// Preserve the downloaded silhouettes/materials. For static meshes add a small
// GPU skinning rig: hips, four legs (two for birds), neck, and head. Existing
// animated models retain their authored skeleton and use their own clips.
export function prepareAnimalRig(source: Group, clips: AnimationClip[], animal: Animal): AnimalRig {
  const copy = clone(source);
  const root = new Group();
  const owned: BufferGeometry[] = [];
  let skinned = false;
  copy.traverse(n => { if (n instanceof SkinnedMesh) skinned = true; });
  copy.updateMatrixWorld(true);
  copy.traverse(n => { if (n instanceof SkinnedMesh) { n.skeleton.update(); n.computeBoundingBox(); } });
  const bird = BIRDS.has(animal.id);
  const forward = animal.id === "flamingo" ? Math.PI / 2 : ["stork", "chick"].includes(animal.id) ? -Math.PI / 2 : 0;
  const direction = new Matrix4().makeRotationY(forward);
  const staticMeshes: Mesh[] = [];
  if (skinned) {
    root.add(copy);
  } else {
    copy.traverse(n => {
      if (!(n instanceof Mesh)) return;
      const geometry = n.geometry.clone().applyMatrix4(n.matrixWorld).applyMatrix4(direction);
      owned.push(geometry);
      const mesh = new Mesh(geometry, n.material);
      root.add(mesh); staticMeshes.push(mesh);
    });
  }
  root.updateMatrixWorld(true);
  const box = new Box3().setFromObject(root), rawSize = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  const scale = animal.size / Math.max(rawSize.x, rawSize.y, rawSize.z);
  if (skinned) {
    // Keep normalization outside the nodes targeted by animation tracks.
    copy.position.sub(new Vector3(center.x, box.min.y, center.z));
    root.scale.setScalar(scale);
  } else {
    for (const mesh of staticMeshes) {
      mesh.geometry.translate(-center.x, -box.min.y, -center.z).scale(scale, scale, scale);
      mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
    }
  }
  const size = rawSize.clone().multiplyScalar(scale);
  let procedural: ((a: Agent, time: number) => void) | undefined;
  const proceduralSkeletons: Skeleton[] = [];
  if (!skinned) {
    const body = new Bone(); body.name = "npc-body";
    const bones: Bone[] = [body];
    const addBone = (name: string, point: Vector3) => { const b = new Bone(); b.name = name; b.position.copy(point); body.add(b); bones.push(b); return b; };
    const hip = size.y * (["stork", "flamingo"].includes(animal.id) ? .48 : bird ? .28 : .43);
    const legs: Bone[] = [];
    for (const front of bird ? [0] : [1, -1]) for (const side of [-1, 1]) {
      legs.push(addBone(`npc-leg-${front}-${side}`, new Vector3(side * size.x * .28, hip, front * size.z * .29)));
    }
    const head = addBone("npc-head", new Vector3(0, size.y * .63, size.z * .25));
    root.add(body); root.updateMatrixWorld(true);
    const skeleton = new Skeleton(bones); proceduralSkeletons.push(skeleton);
    for (const mesh of staticMeshes) {
      const p = mesh.geometry.attributes.position as BufferAttribute;
      const indices: number[] = [], weights: number[] = [];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const leg = (1 - smooth(hip * .58, hip * 1.3, y)) * (bird ? 1 : smooth(size.x * .03, size.x * .22, Math.abs(x)));
        const front = bird ? 0 : z >= 0 ? 1 : -1;
        const legIndex = bird ? (x < 0 ? 1 : 2) : (front === 1 ? 1 : 3) + (x < 0 ? 0 : 1);
        const headWeight = smooth(size.z * .08, size.z * .37, z) * smooth(hip, size.y * .7, y) * (1 - leg);
        indices.push(0, legIndex, bones.length - 1, 0);
        weights.push(1 - leg - headWeight, leg, headWeight, 0);
      }
      mesh.geometry.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
      mesh.geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
      const skin = new SkinnedMesh(mesh.geometry, mesh.material); skin.bind(skeleton);
      skin.castShadow = true; skin.receiveShadow = true; skin.frustumCulled = false;
      root.remove(mesh); root.add(skin);
    }
    procedural = (a, t) => {
      const moving = a.speed > .06;
      // Tip the standing source silhouette into a flight pose about the
      // shoulder, keeping the articulated wing roots attached to the torso.
      const pitch = bird ? a.flight * (animal.id === "parrot" ? .8 : animal.id === "chick" ? .2 : .45) : 0;
      const shoulder = size.y * .5;
      body.rotation.x = pitch;
      body.position.set(0, shoulder * (1 - Math.cos(pitch)), -shoulder * Math.sin(pitch));
      legs.forEach((leg, i) => {
        const opposite = bird ? i : i === 0 || i === 3 ? 0 : 1;
        leg.rotation.x = a.flight > .1 ? -a.flight * 1.3 : moving ? Math.sin(a.gait + opposite * Math.PI) * (a.speed > 1.4 ? .6 : .33) : 0;
        leg.rotation.z = 0;
        if (a.behavior === "spar" && i < 2) {
          const swipe = Math.max(0, Math.sin(t * 6 + i * Math.PI));
          leg.rotation.x = -.8 * swipe;
          leg.rotation.z = (i === 0 ? 1 : -1) * swipe * .35;
        }
        leg.position.y = hip + (moving && a.flight < .1 ? Math.max(0, Math.sin(a.gait + opposite * Math.PI)) * size.y * .035 : 0);
      });
      const feed = ["graze", "peck", "sniff"].includes(a.behavior);
      head.rotation.x = feed ? .32 + Math.sin(t * (bird ? 7 : 3.2)) * .12 : Math.sin(t * .6 + a.seed) * .035;
      head.rotation.y = a.behavior === "idle" ? Math.sin(t * .8 + a.seed) * .15 : 0;
      if (a.behavior === "spar") head.rotation.x = -.12 + Math.sin(t * 7) * .16;
    };
  } else {
    // The old farm pack has no Eating clip. Add a gentle neck dip to its idle
    // pose for grazing, while its transferred walk/run clips move the legs.
    const head = copy.getObjectByName("Neck") ?? copy.getObjectByName("Head");
    if (head && !clips.some(c => /Eating/i.test(c.name))) {
      const base = head.quaternion.clone();
      procedural = (a, t) => {
        head.quaternion.copy(base);
        if (["graze", "sniff"].includes(a.behavior)) head.quaternion.multiply(turn.setFromAxisAngle(X, .38 + Math.sin(t * 3) * .06));
      };
    }
  }
  const wings = bird ? addWings(root, animal, size) : null;
  root.traverse(n => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; if (n instanceof SkinnedMesh) n.frustumCulled = false; } });
  return {
    root, height: size.y, clips,
    animate(a, t) {
      procedural?.(a, t); wings?.animate(a, t);
      // Secondary motion stays small; movement comes from the actual limbs.
      root.position.y = skinned ? 0 : a.speed > .1 && a.flight < .1 ? Math.abs(Math.sin(a.gait)) * (animal.id === "bunny" ? .12 : .025) : Math.sin(t * 1.7 + a.seed) * .006;
      root.rotation.z = a.bank;
      root.rotation.x = a.flight * (animal.id === "chick" ? -.12 : -.18);
      if (a.behavior === "spar" && !skinned) root.rotation.x += Math.sin(t * 7) * .06;
      if (a.behavior === "rest") root.position.y = -.08;
    },
    dispose() {
      owned.forEach(g => g.dispose()); wings?.dispose();
      const skeletons = new Set(proceduralSkeletons);
      copy.traverse(n => { if (n instanceof SkinnedMesh) skeletons.add(n.skeleton); });
      skeletons.forEach(s => s.dispose());
    },
  };
}

export function clipForBehavior(clips: AnimationClip[], a: Agent) {
  const exact = (pattern: RegExp) => clips.find(c => pattern.test(c.name.split("|").at(-1) ?? c.name));
  if (a.behavior === "spar") return exact(/^Attack$/i) ?? exact(/^Idle$/i);
  if (["graze", "sniff", "peck"].includes(a.behavior)) return exact(/^Eating$/i) ?? exact(/^Duck$/i) ?? exact(/^Idle$/i);
  if (["run", "chase", "flee"].includes(a.behavior)) return exact(/^Gallop$|^Run$/i) ?? exact(/^Walk$/i);
  if (a.speed > .08) return exact(/^Walk$/i) ?? exact(/^Idle$/i);
  return exact(/^Idle$/i) ?? clips[0];
}
