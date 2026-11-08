"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Box3, CatmullRomCurve3, Color, Group, MOUSE, TOUCH, Mesh, SkinnedMesh, PCFShadowMap, Vector3 } from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { ANIMALS, type Animal } from "./animals";

export type ViewRequest = { point: [number, number, number]; zoom?: number; zoomDelta?: number; focus?: boolean; serial: number };
type Props = { selected: string | null; night: boolean; reducedMotion: boolean; view: ViewRequest; onSelect: (animal: Animal) => void; onReady: () => void; onError: () => void };

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

type LabelElements = Map<string, HTMLDivElement>;

// Labels live in the page's existing DOM root. Only their screen positions are
// updated by the scene; no nested React roots are created or unmounted.
function ProjectedLabel({ id, position, elements, visible = true, priority = 8 }: { id: string; position: [number, number, number]; elements: LabelElements; visible?: boolean; priority?: number }) {
  const anchor = useRef<Group>(null);
  const point = useMemo(() => new Vector3(), []);
  useEffect(() => () => { const element = elements.get(id); if (element) element.style.display = "none"; }, [elements, id]);
  useFrame(({ camera, size }) => {
    const element = elements.get(id);
    if (!element || !anchor.current) return;
    anchor.current.getWorldPosition(point).project(camera);
    const inView = visible && point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= 1.2 && Math.abs(point.y) <= 1.2;
    element.style.display = inView ? "block" : "none";
    if (!inView) return;
    element.style.transform = `translate3d(${(point.x + 1) * size.width / 2}px,${(1 - point.y) * size.height / 2}px,0) translate(-50%,-50%)`;
    element.style.zIndex = String(priority);
  });
  return <group ref={anchor} position={position} />;
}

function AnimalModel({ animal, selected, reducedMotion, onSelect, labelElements }: { animal: Animal; selected: boolean; reducedMotion: boolean; onSelect: Props["onSelect"]; labelElements: LabelElements }) {
  const { scene, animations } = useGLTF(`/dunia-hewan/models/${animal.model}.glb`);
  const root = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const model = useMemo(() => {
    const copy = clone(scene);
    // SkeletonUtils clones retain stale bone world matrices. Update the whole
    // hierarchy before measuring, otherwise animated animals become oversized.
    copy.updateMatrixWorld(true);
    copy.traverse(child => {
      if (child instanceof SkinnedMesh) {
        child.skeleton.update();
        child.computeBoundingBox();
      }
    });
    const bounds = new Box3().setFromObject(copy);
    const size = bounds.getSize(new Vector3());
    const scale = animal.size / Math.max(size.x, size.y, size.z);
    copy.scale.multiplyScalar(scale);
    const box = new Box3().setFromObject(copy);
    const center = box.getCenter(new Vector3());
    copy.position.set(-center.x, -box.min.y, -center.z);
    copy.traverse((child) => {
      if (child instanceof Mesh) { child.castShadow = true; child.receiveShadow = true; }
    });
    return copy;
  }, [scene, animal.size]);
  const { actions, names } = useAnimations(animations, model);
  useEffect(() => {
    const name = names.find(n => /^idle$/i.test(n)) ?? names.find(n => /idle/i.test(n)) ?? names[0];
    const action = actions[name];
    if (!reducedMotion) action?.reset().fadeIn(.3).play();
    return () => { action?.stop(); };
  }, [actions, names, reducedMotion]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const offset = animal.position[0];
    root.current.position.y = animal.position[1] + (animal.flying ? Math.sin(t * .8 + offset) * .45 : selected ? Math.abs(Math.sin(t * 3)) * .12 : 0);
    root.current.position.x = animal.position[0] + (animal.flying && !selected && !reducedMotion ? Math.sin(t * .25 + offset) * 1.8 : 0);
    root.current.position.z = animal.position[2] + (animal.flying && !selected && !reducedMotion ? Math.cos(t * .25 + offset) * 1.3 : 0);
    root.current.rotation.y = animal.flying ? Math.sin(t * .25 + offset) * .3 - .6 : -.5 + Math.sin(t * .3 + offset) * .08;
  });
  return <group ref={root} position={animal.position}>
    <group onClick={e => { e.stopPropagation(); onSelect(animal); }} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
      <primitive object={model} />
      {/* A generous transparent hit area makes small animals easy to tap. */}
      <mesh position={[0, animal.size * .45, 0]} visible={false}><sphereGeometry args={[Math.max(1, animal.size * .65), 8, 8]} /></mesh>
    </group>
    <ProjectedLabel id={animal.id} position={[0, animal.size + .45, 0]} elements={labelElements} visible={selected || hover || ["fox", "cow", "sheep", "parrot", "flamingo"].includes(animal.id)} priority={selected ? 15 : 10} />
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, animal.flying ? -.2 : .04, 0]}><ringGeometry args={[animal.size * .6, animal.size * .67, 48]} /><meshBasicMaterial color="#ffdd75" transparent opacity={.85} /></mesh>}
  </group>;
}

function Tree({ x, z, size, variant }: { x: number; z: number; size: number; variant: number }) {
  const green = ["#4c8055", "#42704c", "#759751", "#58854c", "#8aab62"][variant % 5];
  return <group position={[x, 0, z]} scale={size}>
    <mesh castShadow position={[0, 1.05, 0]}><cylinderGeometry args={[.16, .24, 2.1, 6]} /><meshStandardMaterial color="#8d6850" roughness={1} /></mesh>
    {variant % 3 === 0 ? <>
      <mesh castShadow position={[0, 2.9, 0]}><coneGeometry args={[1.5, 2.8, 7]} /><meshStandardMaterial color={green} roughness={1} /></mesh>
      <mesh castShadow position={[0, 4, 0]}><coneGeometry args={[1.05, 2.2, 7]} /><meshStandardMaterial color={green} roughness={1} /></mesh>
    </> : <>
      <mesh castShadow position={[0, 3, 0]} scale={[1.25, 1.25, 1]}><icosahedronGeometry args={[1.4, 1]} /><meshStandardMaterial color={green} roughness={1} flatShading /></mesh>
      <mesh castShadow position={[.7, 2.5, .2]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color={green} roughness={1} flatShading /></mesh>
    </>}
  </group>;
}

const random = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

function Landscape({ labelElements }: { labelElements: LabelElements }) {
  const path = useMemo(() => new CatmullRomCurve3([new Vector3(-24, -.42, 11), new Vector3(-11, -.42, 10), new Vector3(-3, -.42, 0), new Vector3(4, -.42, -8), new Vector3(21, -.42, -16)]), []);
  const stream = useMemo(() => new CatmullRomCurve3([new Vector3(13, -.6, -30), new Vector3(10, -.6, -17), new Vector3(15, -.6, -8), new Vector3(15, -.6, 0), new Vector3(23, -.6, 9), new Vector3(30, -.6, 17)]), []);
  const trees = useMemo(() => Array.from({ length: 95 }, (_, i) => {
    const x = random(i + 1) * 60 - 30, z = random(i + 150) * 56 - 30;
    const nearAnimal = ANIMALS.some(a => Math.hypot(a.position[0] - x, a.position[2] - z) < 3.4);
    const nearLake = Math.hypot((x - 15) / 1.2, z + 2) < 10;
    return { x, z, size: .7 + random(i + 90) * .65, variant: i, show: !nearAnimal && !nearLake && Math.hypot(x, z) < 33 && (x < -3 || z < -12 || Math.abs(x) > 24) };
  }), []);
  return <group>
    <mesh receiveShadow position={[0, -1.2, 0]}><cylinderGeometry args={[35, 33, 2.3, 72]} /><meshStandardMaterial color="#b6a17a" roughness={1} /></mesh>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]}><circleGeometry args={[35, 80]} /><meshStandardMaterial color="#a7ba79" roughness={1} /></mesh>
    {[[-13, -6, 12, "#8fac70"], [0, 13, 13, "#b9c781"], [-18, -17, 8, "#94af75"]].map(([x, z, size, color], i) => <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[Number(x), .012, Number(z)]}><circleGeometry args={[Number(size), 48]} /><meshStandardMaterial color={String(color)} roughness={1} /></mesh>)}
    <mesh receiveShadow><tubeGeometry args={[path, 80, .72, 8, false]} /><meshStandardMaterial color="#e5d6a7" roughness={1} /></mesh>
    <mesh><tubeGeometry args={[stream, 100, 2.1, 10, false]} /><meshStandardMaterial color="#71b9b7" roughness={.45} metalness={.05} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, .025, -3]} scale={[1.13, 1, 1]}><circleGeometry args={[7, 64]} /><meshStandardMaterial color="#79c4bf" roughness={.4} metalness={.08} /></mesh>
    {[3.4, 5.1, 6.3].map((r, i) => <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[15, .038 + i * .001, -3]} scale={[1.13, 1, 1]}><ringGeometry args={[r, r + .025, 64]} /><meshBasicMaterial color="#c4ebe1" transparent opacity={.5} /></mesh>)}
    {/* A little timber footbridge across the stream. */}
    <group position={[21.5, .3, 6.2]} rotation={[0, -.7, 0]}>
      {Array.from({ length: 12 }, (_, i) => <mesh key={i} castShadow receiveShadow position={[i * .46 - 2.6, 0, 0]}><boxGeometry args={[.42, .18, 2.5]} /><meshStandardMaterial color={i % 2 ? "#b78d62" : "#c39b6c"} /></mesh>)}
      {[-1.25, 1.25].map(z => <mesh key={z} position={[0, .65, z]}><boxGeometry args={[5.8, .13, .13]} /><meshStandardMaterial color="#94734e" /></mesh>)}
    </group>
    {trees.filter(t => t.show).map((t, i) => <Tree key={i} {...t} />)}
    {Array.from({ length: 85 }, (_, i) => {
      const x = random(i + 600) * 60 - 30, z = random(i + 800) * 56 - 28;
      if (Math.hypot(x - 15, z + 3) < 9 || Math.hypot(x, z) > 32) return null;
      return <group key={i} position={[x, .06, z]}>
        {i % 4 === 0 ? <mesh castShadow scale={[1, .65, .8]} position={[0, .3, 0]}><dodecahedronGeometry args={[.45 + random(i) * .5, 0]} /><meshStandardMaterial color="#9aab95" roughness={1} /></mesh> : <>
          <mesh rotation={[-.1, 0, .15]} position={[0, .16, 0]}><coneGeometry args={[.14, .4, 3]} /><meshStandardMaterial color="#72965b" /></mesh>
          <mesh position={[.13, .33, .03]}><icosahedronGeometry args={[.13, 0]} /><meshStandardMaterial color={i % 3 ? "#faf3cd" : "#efba7a"} /></mesh>
          <mesh position={[-.17, .24, -.1]}><icosahedronGeometry args={[.1, 0]} /><meshStandardMaterial color="#f9e7a8" /></mesh>
        </>}
      </group>;
    })}
    <ProjectedLabel id="region-hutan" position={[-13, .1, -12]} elements={labelElements} />
    <ProjectedLabel id="region-padang" position={[0, .1, 21]} elements={labelElements} />
    <ProjectedLabel id="region-air" position={[19, .1, -4]} elements={labelElements} />
  </group>;
}

function CameraRig({ view, reducedMotion }: { view: ViewRequest; reducedMotion: boolean }) {
  const controls = useRef<OrbitControlsType>(null);
  const destination = useRef<{ target: Vector3; position: Vector3 } | null>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    const target = view.zoomDelta !== undefined ? ctl.target.clone() : new Vector3(...view.point); target.y = 0;
    const offset = camera.position.clone().sub(ctl.target);
    // Keep the selected animal above the information card on portrait phones.
    if (view.focus && size.width <= 700 && size.height > 500) {
      target.add(new Vector3(offset.x, 0, offset.z).normalize().multiplyScalar(5.5));
    }
    const distance = view.zoomDelta !== undefined ? Math.max(12, Math.min(65, offset.length() + view.zoomDelta)) : view.zoom ?? 31;
    offset.normalize().multiplyScalar(distance);
    destination.current = { target, position: target.clone().add(offset) };
  }, [view, camera, size.width, size.height]);
  useFrame((_, delta) => {
    const ctl = controls.current, dest = destination.current;
    if (!ctl || !dest) return;
    const factor = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.5);
    ctl.target.lerp(dest.target, factor);
    camera.position.lerp(dest.position, factor);
    ctl.update();
    if (camera.position.distanceTo(dest.position) < .02) destination.current = null;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={.09} minDistance={12} maxDistance={65} minPolarAngle={.42} maxPolarAngle={1.2} screenSpacePanning={false} mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }} touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }} onStart={() => { destination.current = null; }} onChange={() => {
    const ctl = controls.current;
    if (!ctl) return;
    const old = ctl.target.clone();
    ctl.target.x = Math.max(-25, Math.min(25, ctl.target.x));
    ctl.target.z = Math.max(-24, Math.min(24, ctl.target.z));
    ctl.target.y = 0;
    camera.position.add(ctl.target.clone().sub(old));
  }} />;
}

function Ready({ onReady }: { onReady: () => void }) { useEffect(onReady, [onReady]); return null; }

export default function WorldScene(props: Props) {
  const labelElements = useRef<LabelElements>(new Map());
  return <div style={{ position: "absolute", inset: 0 }}>
    <SceneBoundary onError={props.onError}>
    <Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} camera={{ position: [25, 30, 35], fov: 43, near: .1, far: 180 }} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => {
      gl.setClearColor(new Color(props.night ? "#253e48" : "#e6ecda"));
      gl.domElement.addEventListener("webglcontextlost", props.onError);
    }} fallback={<span aria-hidden="true">Tampilan 3D tidak tersedia. Pilih hewan melalui koleksi di bawah.</span>}>
      <color attach="background" args={[props.night ? "#253e48" : "#e6ecda"]} />
      <fog attach="fog" args={[props.night ? "#253e48" : "#e6ecda", 65, 120]} />
      <ambientLight intensity={props.night ? .6 : 1.7} color={props.night ? "#a6c8f5" : "#fff8e6"} />
      <hemisphereLight args={["#e7f5ff", "#b8a47a", props.night ? .5 : 1.2]} />
      <directionalLight castShadow position={[-15, 35, 18]} intensity={props.night ? .65 : 2.5} color={props.night ? "#b1caff" : "#fff0ce"} shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-far={100} shadow-normalBias={.08} />
      <Landscape labelElements={labelElements.current} />
      <Suspense fallback={null}>
        {ANIMALS.map(animal => <AnimalModel key={animal.id} animal={animal} selected={props.selected === animal.id} reducedMotion={props.reducedMotion} onSelect={props.onSelect} labelElements={labelElements.current} />)}
        <Ready onReady={props.onReady} />
      </Suspense>
      <CameraRig view={props.view} reducedMotion={props.reducedMotion} />
    </Canvas>
    </SceneBoundary>
    <div className="dw-scene-labels" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {ANIMALS.map(animal => <div key={animal.id} ref={element => { if (element) labelElements.current.set(animal.id, element); else labelElements.current.delete(animal.id); }} style={{ position: "absolute", top: 0, left: 0, display: "none" }}>
        <button style={{ pointerEvents: "auto" }} className={`dw-map-label ${props.selected === animal.id ? "is-selected" : ""}`} onClick={() => props.onSelect(animal)} aria-label={`Temui ${animal.name}`}>{animal.emoji} {animal.name}{props.selected === animal.id && <span> ♪</span>}</button>
      </div>)}
      {[["hutan", "HUTAN RIMBUN"], ["padang", "PADANG CERIA"], ["air", "TEPIAN DANAU"]].map(([id, name]) => <div key={id} ref={element => { if (element) labelElements.current.set(`region-${id}`, element); else labelElements.current.delete(`region-${id}`); }} style={{ position: "absolute", top: 0, left: 0, display: "none" }}><span className={`dw-region-label ${id === "air" ? "water" : ""}`}>{name}</span></div>)}
    </div>
  </div>;
}
