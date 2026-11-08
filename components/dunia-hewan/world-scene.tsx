"use client";

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CatmullRomCurve3, Color, MOUSE, TOUCH, PCFShadowMap, Vector3 } from "three";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { ANIMALS, type Animal } from "./animals";
import AnimalActor from "./animal-actor";
import ProjectedLabel, { type LabelElements } from "./projected-label";
import { Wildlife, activityLabel, makeTrees, seeded } from "./wildlife";

export type ViewRequest = { point: [number, number, number]; zoom?: number; zoomDelta?: number; focus?: boolean; serial: number };
type Props = { selected: string | null; night: boolean; reducedMotion: boolean; view: ViewRequest; onSelect: (animal: Animal) => void; onReady: () => void; onError: () => void; simulation: Wildlife; paused: boolean; minimapMarkers: Map<string, HTMLButtonElement>; onActivity: (label: string) => void };

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
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

const random = seeded;

function Landscape({ labelElements }: { labelElements: LabelElements }) {
  const path = useMemo(() => new CatmullRomCurve3([new Vector3(-24, -.42, 11), new Vector3(-11, -.42, 10), new Vector3(-3, -.42, 0), new Vector3(4, -.42, -8), new Vector3(21, -.42, -16)]), []);
  const stream = useMemo(() => new CatmullRomCurve3([new Vector3(13, -.6, -30), new Vector3(10, -.6, -17), new Vector3(15, -.6, -8), new Vector3(15, -.6, 0), new Vector3(23, -.6, 9), new Vector3(30, -.6, 17)]), []);
  const trees = useMemo(() => makeTrees(ANIMALS), []);
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
    {trees.map((t, i) => <Tree key={i} {...t} />)}
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

function CameraRig({ view, reducedMotion, selected, simulation }: { view: ViewRequest; reducedMotion: boolean; selected: string | null; simulation: Wildlife }) {
  const controls = useRef<OrbitControlsType>(null);
  const following = useRef(false);
  const tracked = useMemo(() => new Vector3(), []);
  const destination = useRef<{ target: Vector3; position: Vector3 } | null>(null);
  const { camera, size } = useThree();
  useEffect(() => {
    const ctl = controls.current;
    if (!ctl) return;
    if (view.zoomDelta === undefined) following.current = Boolean(view.focus);
    const target = view.zoomDelta !== undefined ? ctl.target.clone() : new Vector3(...view.point); target.y = view.focus ? view.point[1] + .5 : 0;
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
    if (!ctl) return;
    if (following.current && selected) {
      const agent = simulation.agents.get(selected);
      if (agent) {
        tracked.set(...agent.position); tracked.y += .5;
        if (size.width <= 700 && size.height > 500) {
          const direction = camera.position.clone().sub(ctl.target); direction.y = 0;
          tracked.add(direction.normalize().multiplyScalar(5.5));
        }
        if (dest) {
          const offset = dest.position.clone().sub(dest.target);
          dest.target.copy(tracked); dest.position.copy(tracked).add(offset);
        } else {
          const drift = tracked.clone().sub(ctl.target).multiplyScalar(1 - Math.exp(-delta * 4));
          ctl.target.add(drift); camera.position.add(drift); ctl.update();
        }
      }
    }
    if (!dest) return;
    const factor = reducedMotion ? 1 : 1 - Math.exp(-delta * 4.5);
    ctl.target.lerp(dest.target, factor);
    camera.position.lerp(dest.position, factor);
    ctl.update();
    if (camera.position.distanceTo(dest.position) < .02) destination.current = null;
  }, -2);
  return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={.09} minDistance={12} maxDistance={65} minPolarAngle={.42} maxPolarAngle={1.2} screenSpacePanning={false} mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }} touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }} onStart={() => { destination.current = null; following.current = false; }} onChange={() => {
    const ctl = controls.current;
    if (!ctl) return;
    const old = ctl.target.clone();
    ctl.target.x = Math.max(-25, Math.min(25, ctl.target.x));
    ctl.target.z = Math.max(-24, Math.min(24, ctl.target.z));
    ctl.target.y = Math.max(0, Math.min(8, ctl.target.y));
    camera.position.add(ctl.target.clone().sub(old));
  }} />;
}

function SimulationLoop({ simulation, paused, reducedMotion, night, selected, minimapMarkers, onActivity, loaded }: Props & { loaded: boolean }) {
  const lastUpdate = useRef(-1);
  useFrame((_, delta) => {
    simulation.update(delta, night, !loaded || paused || reducedMotion || document.hidden);
    if (simulation.time - lastUpdate.current < .15) return;
    lastUpdate.current = simulation.time;
    for (const a of simulation.agents.values()) {
      const marker = minimapMarkers.get(a.animal.id);
      if (marker) { marker.style.left = `${(a.position[0] + 35) / 70 * 100}%`; marker.style.top = `${(a.position[2] + 35) / 70 * 100}%`; }
    }
    if (selected) { const agent = simulation.agents.get(selected); if (agent) onActivity(activityLabel(agent)); }
  }, -3);
  return null;
}

function Ready({ onReady }: { onReady: () => void }) { useEffect(onReady, [onReady]); return null; }

export default function WorldScene(props: Props) {
  const labelElements = useRef<LabelElements>(new Map());
  const [loaded, setLoaded] = useState(false);
  const handleReady = useCallback(() => { setLoaded(true); props.onReady(); }, [props.onReady]);
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
      <SimulationLoop {...props} loaded={loaded} />
      <Landscape labelElements={labelElements.current} />
      <Suspense fallback={null}>
        {ANIMALS.map(animal => <AnimalActor key={animal.id} animal={animal} selected={props.selected === animal.id} paused={props.paused || props.reducedMotion} onSelect={props.onSelect} labelElements={labelElements.current} simulation={props.simulation} />)}
        <Ready onReady={handleReady} />
      </Suspense>
      <CameraRig view={props.view} reducedMotion={props.reducedMotion} selected={props.selected} simulation={props.simulation} />
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
