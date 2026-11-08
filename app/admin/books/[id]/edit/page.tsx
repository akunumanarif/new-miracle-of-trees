import Link from "next/link";
import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/header";
import BookForm from "@/components/admin/book-form";
import { requireAdmin } from "@/lib/admin";
import { uuidPattern } from "@/lib/book-validation";
import type { AdminBook } from "@/lib/types";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAdmin();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const { data, error } = await supabase.from("books").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Data buku belum dapat dimuat. Pastikan migrasi pengelolaan buku sudah dijalankan.");
  if (!data) notFound();
  return <><AdminHeader email={user.email} active="books" /><main className="admin-main">
    <Link className="admin-link" href="/admin/books">← Daftar buku</Link>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">KOLEKSI TOKO</span><h1>Edit buku</h1><p>Perbarui informasi, ganti sampul, atau ubah status publikasi.</p></div></div>
    <BookForm book={data as AdminBook} />
  </main></>;
}
