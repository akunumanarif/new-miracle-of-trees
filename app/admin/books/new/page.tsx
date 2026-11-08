import Link from "next/link";
import AdminHeader from "@/components/admin/header";
import BookForm from "@/components/admin/book-form";
import { requireAdmin } from "@/lib/admin";

export default async function NewBookPage() {
  const { user } = await requireAdmin();
  return <><AdminHeader email={user.email} active="books" /><main className="admin-main">
    <Link className="admin-link" href="/admin/books">← Daftar buku</Link>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">KOLEKSI TOKO</span><h1>Tambah buku</h1><p>Lengkapi cerita, sampul, dan harga buku baru. Kolom bertanda * wajib diisi.</p></div></div>
    <BookForm />
  </main></>;
}
