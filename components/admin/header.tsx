import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/admin/actions";

export default function AdminHeader({ email, active }: { email?: string; active: "books" | "stock" }) {
  return <>
    <header className="admin-header"><div className="admin-header-inner">
      <Link href="/admin/books" className="admin-brand"><Image src="/mot.png" alt="Miracle of Trees" width={42} height={42} /><span>Miracle of Trees<small>Ruang pengelola</small></span></Link>
      <div className="admin-account"><span>{email}</span><Link href="/" className="admin-link">Lihat toko ↗</Link><form action={logout}><button className="admin-button secondary small">Keluar</button></form></div>
    </div></header>
    <nav className="admin-tabs" aria-label="Menu admin">
      <Link href="/admin/books" aria-current={active === "books" ? "page" : undefined}>Kelola buku</Link>
      <Link href="/admin" aria-current={active === "stock" ? "page" : undefined}>Stok opname</Link>
    </nav>
  </>;
}
