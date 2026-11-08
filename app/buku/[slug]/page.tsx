import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { getBook, getBookStock } from "@/lib/books";
import { formatRupiah } from "@/lib/format";
import BookGallery from "@/components/book-gallery";
import BookDetailActions from "@/components/book-detail-actions";
import BookStock from "@/components/book-stock";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date + "T00:00:00Z"));
}

export default async function BookDetail({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const { data: book, error } = await getBook(slug);
  if (error) {
    return <main className="product-page"><div className="empty-state" role="alert"><h1>Informasi buku belum tersedia</h1><p>{error}</p><a className="primary-button" href={`/buku/${encodeURIComponent(slug)}`}>Coba lagi</a><p><Link href="/">← Kembali ke koleksi</Link></p></div></main>;
  }
  if (!book) notFound();
  const stock = await getBookStock(book.id);
  const metadata = [
    { label: "Usia pembaca", value: book.age },
    { label: "Jumlah halaman", value: book.page_count ? `${book.page_count} halaman` : null },
    { label: "Format", value: book.format },
    { label: "Estimasi kedatangan", value: book.arrival_note },
    { label: "Tanggal terbit", value: book.publication_date ? formatDate(book.publication_date) : null },
    { label: "Penutupan preorder", value: book.preorder_closes_on ? formatDate(book.preorder_closes_on) : null },
  ].filter(item => item.value);

  return <main className="product-page">
    <header className="product-header"><div className="product-header-inner">
      <nav aria-label="Navigasi toko"><Link href="/#koleksi">Buku</Link><Link href="/#kurasi">Kurasi kami</Link><Link href="/#tentang">Tentang</Link></nav>
      <Link href="/" className="brand product-brand" aria-label="Miracle of Trees beranda"><Image className="brand-logo" src="/mot.png" alt="Logo Miracle of Trees" width={46} height={46} preload /><span><strong>Miracle of Trees</strong><small>Curated kids books</small></span></Link>
      <Link href="/#koleksi" className="product-back">Kembali ke koleksi <span>↗</span></Link>
    </div></header>
    <div className="product-container">
      <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/">Beranda</Link><ChevronRight size={12} /><Link href="/#koleksi">Buku</Link><ChevronRight size={12} /><span aria-current="page">{book.title}</span></nav>
      <div className="product-layout">
        <BookGallery key={book.id} book={book} />
        <article className="product-information">
          <span className="product-category">{book.category}</span>
          <h1>{book.title}</h1>
          <div className="product-byline">{book.isbn && <span>ISBN {book.isbn}</span>}<span>{book.author}</span></div>
          <div className="product-price">{formatRupiah(book.price)}</div>
          <BookStock quantity={stock} />
          <dl className="product-metadata">{metadata.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
          <BookDetailActions id={book.id} title={book.title} />
          <section className="product-description" aria-labelledby="description-heading"><h2 id="description-heading">Deskripsi</h2><div>{book.description}</div></section>
          <p className="product-help">Butuh rekomendasi usia atau informasi buku? Kami siap membantu melalui WhatsApp.</p>
        </article>
      </div>
    </div>
  </main>;
}
