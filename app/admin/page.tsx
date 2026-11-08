import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import StockForm from "@/components/admin/stock-form";
import AdminHeader from "@/components/admin/header";

type InventoryBook = { id: string; title: string; author: string; format: string; status: string; inventory: { quantity: number; version: number } | null };
type History = { id: string; book_title: string; previous_quantity: number; counted_quantity: number; difference: number; note: string; performed_by_email: string; created_at: string };
const pageSize = 20;
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase, user } = await requireAdmin();
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 100);
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  let query = supabase.from("books").select("id,title,author,format,status,inventory(quantity,version)", { count: "exact" }).order("title").order("id");
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const [catalog, history] = await Promise.all([
    query.range((page - 1) * pageSize, page * pageSize - 1),
    supabase.from("stock_opnames").select("id,book_title,previous_quantity,counted_quantity,difference,note,performed_by_email,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const books = (catalog.data ?? []) as unknown as InventoryBook[];
  const records = (history.data ?? []) as History[];
  const totalPages = Math.max(1, Math.ceil((catalog.count ?? 0) / pageSize));
  const pageUrl = (target: number) => `/admin?${new URLSearchParams({ q, page: String(target) })}`;

  return <>
    <AdminHeader email={user.email} active="stock" />
    <main className="admin-main">
      <div className="admin-stock-shortcut"><Link href="/admin/books/new" className="admin-button">+ Tambah buku</Link><Link href="/admin/books" className="admin-link">Kelola buku →</Link></div><div className="admin-page-heading"><div><span className="admin-eyebrow">PERSEDIAAN BUKU</span><h1>Stok opname</h1><p>Hitung buku di rak, cocokkan stok, dan simpan setiap penyesuaian.</p></div><span className="admin-section-tag">● Akses admin</span></div>
      <div className="admin-notice">Masukkan jumlah fisik yang benar-benar dihitung. Buku yang belum pernah diopname dimulai dari stok sistem 0. Setiap penyimpanan mencatat riwayat.</div>
      <section className="admin-panel" aria-labelledby="inventory-heading"><div className="admin-panel-heading"><div><h2 id="inventory-heading">Daftar persediaan</h2><p>{catalog.error ? "Persediaan belum dapat dimuat" : `${catalog.count ?? 0} judul${q ? " sesuai pencarian" : " dalam katalog"} · termasuk draft dan arsip`}</p></div><form className="admin-search" action="/admin"><label className="sr-only" htmlFor="admin-search">Cari judul buku</label><input id="admin-search" name="q" defaultValue={q} placeholder="Cari judul buku…" maxLength={100} /><button className="admin-button secondary small">Cari</button>{q && <Link href="/admin" className="admin-link">Reset</Link>}</form></div>
      {catalog.error ? <div className="admin-empty" role="alert"><h3>Persediaan belum tersedia</h3><p>Pastikan migrasi admin dan inventory sudah dijalankan, lalu coba lagi.</p><a href="/admin" className="admin-link">Muat ulang →</a></div> : books.length ? <div className="admin-book-list">{books.map(book => <article className="admin-book-row" key={book.id}><div className="admin-book-info"><span className={`admin-status ${book.status}`}>{book.status}</span><h3>{book.title}</h3><p>{book.author} · {book.format}</p><div className="admin-current-stock"><span>Stok sistem</span><strong>{book.inventory?.quantity ?? 0}<small> buku</small></strong></div>{!book.inventory && <small className="admin-help">Belum pernah diopname</small>}</div><StockForm bookId={book.id} quantity={book.inventory?.quantity ?? 0} version={book.inventory?.version ?? 0} /></article>)}</div> : <div className="admin-empty"><h3>{q ? "Buku tidak ditemukan" : "Belum ada buku di halaman ini"}</h3><p>{q ? "Coba judul lain atau reset pencarian." : "Tambahkan buku melalui menu Kelola buku, atau kembali ke halaman pertama."}</p><Link href="/admin" className="admin-link">Lihat semua buku →</Link></div>}
      {!catalog.error && <div className="admin-pagination"><span>Halaman {page} dari {totalPages}</span><div>{page > 1 && <Link href={pageUrl(page - 1)}>← Sebelumnya</Link>}{page < totalPages && <Link href={pageUrl(page + 1)}>Berikutnya →</Link>}</div></div>}</section>
      <section className="admin-panel" aria-labelledby="history-heading"><div className="admin-panel-heading"><div><h2 id="history-heading">Riwayat opname</h2><p>20 pencatatan terbaru · waktu Indonesia Barat</p></div><a href="/admin#history-heading" className="admin-link">Perbarui ↻</a></div>
        {history.error ? <div className="admin-empty" role="alert">Riwayat belum dapat dimuat. Pastikan migrasi sudah dijalankan.</div> : records.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Buku & waktu</th><th>Sistem</th><th>Fisik</th><th>Selisih</th><th>Catatan & petugas</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><strong>{record.book_title}</strong><small>{dateFormat.format(new Date(record.created_at))}</small></td><td>{record.previous_quantity}</td><td>{record.counted_quantity}</td><td className={record.difference < 0 ? "negative" : "positive"}>{record.difference > 0 ? "+" : ""}{record.difference}</td><td>{record.note}<small>{record.performed_by_email}</small></td></tr>)}</tbody></table></div> : <div className="admin-empty"><h3>Belum ada pencatatan</h3><p>Riwayat akan muncul setelah opname pertama disimpan.</p></div>}
      </section>
    </main>
  </>;
}
