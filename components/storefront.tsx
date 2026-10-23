"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Book } from "@/lib/types";
import { formatRupiah } from "@/lib/seed-books";
import { Arrow, BookMark, Heart, Instagram, Search } from "./icons";

const formats = ["Semua", "paperback", "hardback", "board book"];
const instagramPosts = [
  "https://www.instagram.com/miracleoftrees/p/DWvnMIViZzk/",
  "https://www.instagram.com/baby_michiee/p/DVDGM2hEV66/",
  "https://www.instagram.com/lailatulmahmudahh/p/DUfnahDEl8F/",
  "https://www.instagram.com/annisaicaaaa/reel/DYUWoNdJ71D/",
  "https://www.instagram.com/miracleoftrees/p/DbzfzMACaix/",
  "https://www.instagram.com/sellysherwin/p/DZxVM2olPJU/",
];

function BookCard({ book, saved, onSave, duplicate = false }: { book: Book; saved: boolean; onSave: () => void; duplicate?: boolean }) {
  return (
    <article className="book-card" aria-hidden={duplicate || undefined}>
      <Link href={`/buku/${book.slug}`} tabIndex={duplicate ? -1 : undefined} className="book-cover" style={{ "--cover": book.accent } as React.CSSProperties}>
        <span className="cover-kicker">Miracle of Trees</span>
        <span className="cover-art" aria-hidden="true">{book.cover}</span>
        <strong>{book.title}</strong>
        <small>{book.author}</small>
      </Link>
      <div className="book-info">
        <div className="book-tags"><span>{book.age}</span><span>{book.format}</span></div>
        <Link href={`/buku/${book.slug}`} tabIndex={duplicate ? -1 : undefined}><h3>{book.title}</h3></Link>
        <p>{book.author}</p>
        <div className="book-bottom">
          <strong>{formatRupiah(book.price)}</strong>
          <button tabIndex={duplicate ? -1 : undefined} className={`save-button ${saved ? "is-saved" : ""}`} onClick={onSave} aria-label={`${saved ? "Hapus" : "Simpan"} ${book.title}`}><Heart /></button>
        </div>
      </div>
    </article>
  );
}

export default function Storefront({ books }: { books: Book[] }) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("Semua");
  const [saved, setSaved] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("miracle-of-trees-saved");
    if (stored) {
      try { setSaved(JSON.parse(stored)); } catch { window.localStorage.removeItem("miracle-of-trees-saved"); }
    }
  }, []);

  const toggleSaved = (id: string) => {
    setSaved((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem("miracle-of-trees-saved", JSON.stringify(next));
      return next;
    });
  };

  const filtered = useMemo(() => {
    const needle = query.toLocaleLowerCase("id");
    return books.filter((book) =>
      (format === "Semua" || book.format.toLocaleLowerCase("id") === format) &&
      (!showSaved || saved.includes(book.id)) &&
      `${book.title} ${book.author} ${book.category} ${book.age}`.toLocaleLowerCase("id").includes(needle)
    );
  }, [books, format, query, saved, showSaved]);

  return (
    <>
      <div className="announcement">Gratis konsultasi pilih buku melalui WhatsApp <span>•</span> Kirim ke seluruh Indonesia</div>
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="Miracle of Trees beranda"><Image className="brand-logo" src="/mot.png" alt="Logo Miracle of Trees" width={52} height={52} priority/><span><strong>Miracle of Trees</strong><small>Curated kids books</small></span></Link>
          <label className="header-search"><Search/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul, penulis, atau usia..." /></label>
          <nav className={menuOpen ? "nav-links is-open" : "nav-links"}>
            <a href="#koleksi">Koleksi</a><a href="#kurasi">Cara kami memilih</a><a href="#tentang">Tentang</a>
          </nav>
          <a className="wa-button" href="https://wa.me/?text=Halo%20Miracle%20of%20Trees,%20saya%20ingin%20rekomendasi%20buku" target="_blank" rel="noreferrer">Tanya kurator</a>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Buka menu"><span/><span/></button>
        </div>
      </header>

      <main>
        <section className="hero">
          <Image src="/hero-reading.png" alt="Dua anak membaca buku cerita penuh imajinasi" fill priority sizes="100vw" className="hero-image" />
          <div className="hero-overlay" />
          <div className="hero-content">
            <div className="eyebrow"><span>✦</span> Dibaca hari ini, tumbuh selamanya</div>
            <h1>Buku yang tumbuh<br/>bersama <em>si kecil.</em></h1>
            <p>Kurasi cerita penuh makna untuk menyalakan rasa ingin tahu, empati, dan imajinasi anak.</p>
            <div className="hero-actions"><a className="primary-button" href="#koleksi">Jelajahi koleksi <Arrow/></a><a className="text-button" href="#kurasi">Lihat cara kami memilih</a></div>
            <div className="hero-proof"><div className="avatars"><span>AR</span><span>NA</span><span>DI</span></div><div><strong>Dipercaya 1.200+ orang tua</strong><small>Kurasi nyata, bukan sekadar rak buku.</small></div></div>
          </div>
        </section>

        <section className="promise-strip" aria-label="Keunggulan"><div><span>01</span><p><strong>Dipilih satu per satu</strong><small>Konten aman dan bermakna</small></p></div><div><span>02</span><p><strong>Sesuai tahap tumbuh</strong><small>Mudah memilih berdasarkan usia</small></p></div><div><span>03</span><p><strong>Buku fisik berkualitas</strong><small>Nyaman dibaca berulang kali</small></p></div></section>

        <section className="collection section" id="koleksi">
          <div className="section-heading"><div><span className="overline">Temukan cerita mereka</span><h2>Pilihan untuk setiap rasa penasaran.</h2></div><p>Dari mengenal emosi sampai menjelajah antariksa, ada cerita untuk setiap fase tumbuhnya.</p></div>
          <label className="mobile-search"><Search/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari buku..." /></label>
          <div className="category-row" role="tablist" aria-label="Filter format buku">
            {formats.map((item) => <button key={item} onClick={() => { setFormat(item); setShowSaved(false); }} className={!showSaved && format === item ? "active" : ""}>{item}</button>)}
            <button onClick={() => setShowSaved(true)} className={showSaved ? "active" : ""}>Tersimpan ({saved.length})</button>
          </div>
          {filtered.length ? (
            <div className="book-marquee" aria-label="Daftar buku pilihan bergerak dari kanan ke kiri">
              <div className="book-track">
                <div className="book-set">
                  {filtered.map((book) => <BookCard key={book.id} book={book} saved={saved.includes(book.id)} onSave={() => toggleSaved(book.id)} />)}
                </div>
                <div className="book-set" aria-hidden="true">
                  {filtered.map((book) => <BookCard key={`copy-${book.id}`} duplicate book={book} saved={saved.includes(book.id)} onSave={() => toggleSaved(book.id)} />)}
                </div>
              </div>
            </div>
          ) : <div className="empty-state"><span>⌕</span><h3>Belum ada buku yang cocok</h3><p>Coba kata pencarian atau kategori yang berbeda.</p></div>}
        </section>

        <section className="curation section" id="kurasi">
          <div className="curation-copy"><span className="overline light">Bukan sekadar buku bagus</span><h2>Kami membaca sebelum merekomendasikan.</h2><p>Setiap buku melewati proses kurasi sederhana namun ketat—agar cerita yang sampai ke rumah benar-benar layak menemani masa kecil.</p><a href="https://wa.me/?text=Halo%20Miracle%20of%20Trees,%20boleh%20bantu%20pilihkan%20buku?" target="_blank" rel="noreferrer">Konsultasi gratis <Arrow/></a></div>
          <ol className="curation-steps"><li><span>01</span><div><strong>Isi & nilai cerita</strong><p>Pesan positif tanpa terasa menggurui.</p></div></li><li><span>02</span><div><strong>Bahasa & ilustrasi</strong><p>Nyaman dibaca nyaring, menarik untuk dilihat.</p></div></li><li><span>03</span><div><strong>Kualitas fisik</strong><p>Format dan material sesuai usia pembaca.</p></div></li></ol>
        </section>

        <section className="instagram-section section" id="instagram">
          <div className="instagram-heading">
            <div><span className="overline">Cerita di luar halaman</span><h2>Ikuti keseharian kami di Instagram.</h2></div>
            <a href="https://www.instagram.com/miracleoftrees/" target="_blank" rel="noreferrer"><Instagram/><span>@miracleoftrees</span><Arrow/></a>
          </div>
          <div className="instagram-grid">
            {[
              "The Tree Book dari Miracle of Trees",
              "Anak membaca buku pop-up",
              "Rekomendasi buku anak Islami",
              "Anak membaca board book",
              "Koleksi pop-up tiga masjid suci",
              "Mengapa anak perlu membaca buku",
            ].map((alt, index) => (
              <a className={`instagram-tile instagram-feed-card feed-${index + 1}`} href={instagramPosts[index]} target="_blank" rel="noreferrer" aria-label={`Buka posting Instagram: ${alt}`} key={instagramPosts[index]}>
                <Image src={`/instagram/0${index + 1}.jpg`} alt={alt} fill sizes="(max-width: 699px) 50vw, 33vw"/>
                <span className="instagram-badge"><Instagram size={16}/></span>
                <span className="instagram-hover"><Instagram/> Lihat postingan</span>
              </a>
            ))}
          </div>
          <p className="instagram-note">Setiap kartu terhubung langsung ke postingan Instagram pilihan.</p>
          <a className="instagram-mobile-cta" href="https://www.instagram.com/miracleoftrees/" target="_blank" rel="noreferrer"><Instagram/> Ikuti @miracleoftrees <Arrow/></a>
        </section>

        <section className="newsletter section" id="tentang"><div><span className="overline">Surat kecil dari kami</span><h2>Ide membaca, buku baru, dan cerita baik.</h2></div><form onSubmit={(e) => e.preventDefault()}><input type="email" aria-label="Alamat email" placeholder="Email kamu"/><button type="submit">Ikut komunitas <Arrow/></button></form></section>
      </main>

      <footer><div className="footer-brand"><div className="brand"><Image className="brand-logo" src="/mot.png" alt="Logo Miracle of Trees" width={52} height={52}/><span><strong>Miracle of Trees</strong><small>Curated kids books</small></span></div><p>Menemani keluarga Indonesia menemukan buku yang layak tinggal lebih lama di rumah.</p></div><div><strong>Jelajahi</strong><a href="#koleksi">Semua buku</a><a href="#kurasi">Tentang kurasi</a><a href="#instagram">Instagram</a><a href="#tentang">Komunitas</a></div><div><strong>Bantuan</strong><a href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a><a href="mailto:halo@miracleoftrees.id">Email</a><a href="#">FAQ</a></div><small className="copyright">© 2026 Miracle of Trees. Dibuat dengan hati untuk pembaca kecil.</small></footer>

      <nav className="bottom-nav" aria-label="Navigasi mobile"><a href="#koleksi" onClick={() => setShowSaved(false)}><BookMark/><span>Koleksi</span></a><button onClick={() => { setShowSaved(false); document.querySelector<HTMLInputElement>(".mobile-search input")?.focus(); }}><Search/><span>Cari</span></button><button onClick={() => { setShowSaved(true); document.querySelector("#koleksi")?.scrollIntoView(); }}><span className="heart-wrap"><Heart/><b>{saved.length}</b></span><span>Simpanan</span></button><a href="https://wa.me/" target="_blank" rel="noreferrer"><span className="wa-icon">◌</span><span>Tanya</span></a></nav>
    </>
  );
}
