import Link from "next/link";
import AdminHeader from "@/components/admin/header";
import BookCover from "@/components/book-cover";
import { requireAdmin } from "@/lib/admin";
import { formatRupiah } from "@/lib/format";
import type { AdminBook } from "@/lib/types";

const pageSize = 20;
const labels = { draft: "Draft", published: "Published", archived: "Archived" };

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; saved?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const status = ["draft", "published", "archived"].includes(params.status ?? "") ? params.status! : "";
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  let query = supabase.from("books").select("id,slug,title,author,format,price,cover,accent,status,is_new,is_featured", { count: "exact" }).order("created_at", { ascending: false }).order("id");
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const books = (data ?? []) as AdminBook[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const pageUrl = (target: number) => `/admin/books?${new URLSearchParams({ q, status, page: String(target) })}`;

  return <><AdminHeader email={user.email} active="books" /><main className="admin-main">
    <div className="admin-page-heading"><div><span className="admin-eyebrow">KOLEKSI TOKO</span><h1>Kelola buku</h1><p>Tambahkan cerita baru dan kelola semua informasi buku dalam satu tempat.</p></div><Link href="/admin/books/new" className="admin-button">+ Tambah buku</Link></div>
    {(params.saved === "created" || params.saved === "updated") && <p className="admin-message success admin-save-message" role="status">{params.saved === "created" ? "Buku baru berhasil ditambahkan." : "Perubahan buku berhasil disimpan."}</p>}
    <section className="admin-panel" aria-labelledby="books-heading">
      <div className="admin-panel-heading"><div><h2 id="books-heading">Katalog buku</h2><p>{error ? "Katalog belum dapat dimuat" : `${count ?? 0} judul${q || status ? " sesuai filter" : " dalam katalog"}`}</p></div>
        <form action="/admin/books" className="admin-search admin-catalog-search">
          <label className="sr-only" htmlFor="book-search">Cari judul buku</label><input id="book-search" name="q" defaultValue={q} placeholder="Cari judul buku…" maxLength={100} />
          <label className="sr-only" htmlFor="book-status">Filter status</label><select id="book-status" name="status" defaultValue={status}><option value="">Semua status</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button className="admin-button secondary small">Cari</button>{(q || status) && <Link href="/admin/books" className="admin-link">Reset</Link>}
        </form>
      </div>
      {error ? <div className="admin-empty" role="alert"><h3>Katalog belum dapat dimuat</h3><p>Periksa koneksi, lalu muat ulang halaman.</p><a href="/admin/books" className="admin-link">Coba lagi →</a></div>
        : books.length ? <div className="admin-catalog-list">{books.map(book => <article className="admin-catalog-row" key={book.id}>
          <Link href={`/admin/books/${book.id}/edit`} className="book-cover admin-cover-thumb" style={{ "--cover": book.accent } as React.CSSProperties}><BookCover book={book} /></Link>
          <div className="admin-catalog-info"><span className={`admin-status ${book.status}`}>{labels[book.status]}</span><h3><Link href={`/admin/books/${book.id}/edit`}>{book.title}</Link></h3><p>{book.author} · {book.format}</p><strong>{formatRupiah(book.price)}</strong><div className="admin-book-markers">{book.is_new && <span>Buku baru</span>}{book.is_featured && <span>Pilihan kurator</span>}</div></div>
          <div className="admin-catalog-actions"><Link href={`/admin/books/${book.id}/edit`} className="admin-button secondary small">Edit buku</Link>{book.status === "published" && <Link href={`/buku/${book.slug}`} className="admin-link" target="_blank">Lihat di toko ↗</Link>}</div>
        </article>)}</div>
        : <div className="admin-empty"><h3>{q || status ? "Tidak ada buku sesuai filter" : "Mulai koleksi buku pertama"}</h3><p>{q || status ? "Ganti pencarian atau reset filter untuk melihat buku lain." : "Isi informasi buku, upload sampul, lalu terbitkan saat sudah siap."}</p><Link href={q || status ? "/admin/books" : "/admin/books/new"} className="admin-button">{q || status ? "Reset filter" : "+ Tambah buku pertama"}</Link></div>}
      {!error && <div className="admin-pagination"><span>Halaman {page} dari {pages}</span><div>{page > 1 && <Link href={pageUrl(page - 1)}>← Sebelumnya</Link>}{page < pages && <Link href={pageUrl(page + 1)}>Berikutnya →</Link>}</div></div>}
    </section>
  </main></>;
}
