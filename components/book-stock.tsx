import { Flame, PackageCheck, PackageX, CircleHelp } from "lucide-react";

export default function BookStock({ quantity }: { quantity: number | null }) {
  const state = quantity === null ? "unknown" : quantity === 0 ? "empty" : quantity <= 2 ? "low" : "available";
  const Icon = state === "low" ? Flame : state === "available" ? PackageCheck : state === "empty" ? PackageX : CircleHelp;
  return <div className={`product-stock ${state}`}>
    <Icon size={18} aria-hidden="true" />
    <div>
      <strong>{state === "low" ? "Last stock!" : state === "available" ? "Available · Ready stock" : state === "empty" ? "Stok habis" : "Konfirmasi ketersediaan"}</strong>
      <span>{state === "low" ? `Tinggal ${quantity} buku — amankan favoritmu.` : state === "available" ? `${quantity} buku tersedia dan siap dipesan.` : state === "empty" ? "Hubungi kami untuk informasi restock." : "Tanyakan stok terbaru melalui WhatsApp."}</span>
    </div>
  </div>;
}
