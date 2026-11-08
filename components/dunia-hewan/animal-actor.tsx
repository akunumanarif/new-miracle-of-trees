"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AnimationAction, AnimationMixer, Group, Mesh } from "three";
import type { Animal } from "./animals";
import { prepareAnimalRig, clipForBehavior } from "./animal-rig";
import ProjectedLabel, { type LabelElements } from "./projected-label";
import type { Wildlife } from "./wildlife";

export default function AnimalActor({ animal, selected, paused, onSelect, labelElements, simulation }: { animal: Animal; selected: boolean; paused: boolean; onSelect: (a: Animal) => void; labelElements: LabelElements; simulation: Wildlife }) {
  const { scene, animations } = useGLTF(`/dunia-hewan/models/${animal.model}.glb?v=npc-1`);
  const root = useRef<Group>(null);
  const dust = useRef<Group>(null);
  const water = useRef<Mesh>(null);
  const [hover, setHover] = useState(false);
  const rig = useMemo(() => prepareAnimalRig(scene, animations, animal), [scene, animations, animal]);
  const mixer = useMemo(() => new AnimationMixer(rig.root), [rig]);
  const active = useRef<AnimationAction | null>(null);
  const lastClip = useRef("");
  const disposeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (disposeTimer.current) clearTimeout(disposeTimer.current);
    active.current = null; lastClip.current = "";
    return () => {
      mixer.stopAllAction(); mixer.uncacheRoot(rig.root);
      disposeTimer.current = setTimeout(() => rig.dispose(), 0);
      document.body.style.cursor = "";
    };
  }, [rig, mixer]);

  useFrame((_, delta) => {
    const a = simulation.agents.get(animal.id);
    if (!a || !root.current) return;
    root.current.position.set(...a.position);
    root.current.rotation.y = a.heading;
    const clip = clipForBehavior(rig.clips, a);
    if (clip && clip.name !== lastClip.current) {
      const next = mixer.clipAction(clip);
      next.reset().setEffectiveWeight(1).fadeIn(.25).play();
      active.current?.fadeOut(.25);
      active.current = next; lastClip.current = clip.name;
    }
    if (active.current) active.current.timeScale = a.behavior === "spar" ? .75 : a.speed > .1 ? .65 + a.speed * .35 : .8;
    if (!paused) mixer.update(Math.min(delta, .06));
    rig.animate(a, simulation.time);
    if (dust.current) {
      dust.current.visible = a.speed > 1.5 && a.flight < .05;
      dust.current.children.forEach((cloud, i) => {
        const cycle = (simulation.time * 2 + i / 3) % 1;
        cloud.position.set(Math.sin(i * 2) * .2, .06 + cycle * .2, -.3 - cycle * .55);
        cloud.scale.setScalar(.05 + cycle * .12);
      });
    }
    if (water.current) {
      water.current.visible = a.behavior === "swim";
      const scale = .8 + ((simulation.time * .7) % 1) * .65;
      water.current.scale.set(scale, scale, scale);
    }
  }, -1);
  return <group ref={root} position={animal.position}>
    <group onClick={e => { e.stopPropagation(); onSelect(animal); }} onPointerOver={e => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
      <primitive object={rig.root} />
      <mesh position={[0, rig.height * .5, 0]} visible={false}><sphereGeometry args={[Math.max(.8, animal.size * .6), 8, 8]} /></mesh>
    </group>
    <ProjectedLabel id={animal.id} position={[0, rig.height + .45, 0]} elements={labelElements} visible={selected || hover || ["fox", "cow", "sheep", "parrot", "flamingo", "goose"].includes(animal.id)} priority={selected ? 15 : 10} />
    {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}><ringGeometry args={[animal.size * .6, animal.size * .67, 48]} /><meshBasicMaterial color="#ffdd75" transparent opacity={.85} /></mesh>}
    <group ref={dust} visible={false}>{[0, 1, 2].map(i => <mesh key={i}><icosahedronGeometry args={[1, 0]} /><meshBasicMaterial color="#eadbb6" transparent opacity={.4} depthWrite={false} /></mesh>)}</group>
    <mesh ref={water} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, .23, 0]}><ringGeometry args={[animal.size * .35, animal.size * .35 + .025, 32]} /><meshBasicMaterial color="#e3f4d9" transparent opacity={.45} depthWrite={false} /></mesh>
  </group>;
}
