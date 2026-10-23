import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Arrow } from "@/components/icons";
import { getBook, getBooks } from "@/lib/books";
import { formatRupiah } from "@/lib/seed-books";

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((book) => ({ slug: book.slug }));
}

export default async function BookDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();
  return <main className="detail-page"><header className="detail-header"><Link href="/" className="brand"><Image className="brand-logo" src="/mot.png" alt="Logo Miracle of Trees" width={52} height={52} priority/><span><strong>Miracle of Trees</strong><small>Curated kids books</small></span></Link><Link href="/">← Kembali ke koleksi</Link></header><div className="detail-shell"><div className="detail-cover book-cover" style={{ "--cover": book.accent } as React.CSSProperties}><span className="cover-kicker">Miracle of Trees</span><span className="cover-art">{book.cover}</span><strong>{book.title}</strong><small>{book.author}</small></div><div className="detail-copy"><span className="overline">{book.category} · {book.format}</span><h1>{book.title}</h1><p className="detail-author">oleh {book.author}</p><p className="detail-description">{book.description}</p><div className="detail-meta"><div><small>Usia pembaca</small><strong>{book.age}</strong></div><div><small>Format</small><strong>{book.format}</strong></div></div><div className="detail-price">{formatRupiah(book.price)}</div><a className="primary-button" href={`https://wa.me/?text=${encodeURIComponent(`Halo Miracle of Trees, saya tertarik dengan buku ${book.title}`)}`} target="_blank" rel="noreferrer">Tanyakan ketersediaan <Arrow/></a><small className="purchase-note">Pemesanan sementara dilayani melalui kurator WhatsApp.</small></div></div></main>;
}
