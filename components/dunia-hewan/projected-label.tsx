"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
export type LabelElements = Map<string, HTMLDivElement>;

export default function ProjectedLabel({ id, position, elements, visible = true, priority = 8 }: { id: string; position: [number, number, number]; elements: LabelElements; visible?: boolean; priority?: number }) {
  const anchor = useRef<Group>(null);
  const point = useMemo(() => new Vector3(), []);
  useEffect(() => () => { const element = elements.get(id); if (element) element.style.display = "none"; }, [elements, id]);
  useFrame(({ camera, size }) => {
    const element = elements.get(id);
    if (!element || !anchor.current) return;
    camera.updateMatrixWorld();
    anchor.current.getWorldPosition(point).project(camera);
    const inView = visible && point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= 1.2 && Math.abs(point.y) <= 1.2;
    element.style.display = inView ? "block" : "none";
    if (!inView) return;
    element.style.transform = `translate3d(${(point.x + 1) * size.width / 2}px,${(1 - point.y) * size.height / 2}px,0) translate(-50%,-50%)`;
    element.style.zIndex = String(priority);
  });
  return <group ref={anchor} position={position} />;
}
