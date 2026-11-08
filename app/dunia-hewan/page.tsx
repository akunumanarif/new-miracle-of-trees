import type { Metadata } from "next";
import AnimalWorld from "@/components/dunia-hewan/animal-world";
import "./dunia-hewan.css";

export const metadata: Metadata = {
  title: "Dunia Hewan — Petualangan kecil, penemuan besar",
  description: "Jelajahi hutan 3D, temui hewan darat dan burung, dan dengarkan suara mereka. Petualangan interaktif untuk si kecil dari Miracle of Trees.",
  robots: { index: false, follow: false },
};

export default function AnimalWorldPage() {
  return <AnimalWorld />;
}
