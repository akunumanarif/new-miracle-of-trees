import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Miracle of Trees — Buku yang tumbuh bersama anak",
  description: "Kurasi buku anak pilihan untuk menumbuhkan rasa ingin tahu, empati, dan cinta membaca.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
