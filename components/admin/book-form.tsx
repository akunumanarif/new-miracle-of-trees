"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveBook } from "@/app/admin/books/actions";
import type { ActionState } from "@/app/admin/actions";
import { bookFormats, maxCoverBytes, slugify } from "@/lib/book-validation";
import { getCoverImage } from "@/lib/cover";
import type { AdminBook } from "@/lib/types";
import GalleryEditor from "./gallery-editor";
import IsbnScanner from "./isbn-scanner";

export default function BookForm({ book }: { book?: AdminBook }) {
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState<string[]>(book?.gallery_images ?? []);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanBlocked, setScanBlocked] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [formatEdited, setFormatEdited] = useState(false);
  const [state, action, pending] = useActionState(async (previous: ActionState, form: FormData) => {
    // React resets native file inputs after an action. Retain the chosen image
    // for a retry when server-side validation or a database write fails.
    if (file) form.set("coverFile", file);
    form.set("gallery_images", JSON.stringify(gallery));
    return saveBook(previous, form);
  }, {});
  const [values, setValues] = useState({
    title: book?.title ?? "", author: book?.author ?? "", slug: book?.slug ?? "",
    category: book?.category ?? "", age: book?.age ?? "", format: book?.format ?? "Hardback",
    price: book ? String(book.price) : "", description: book?.description ?? "",
    accent: book?.accent ?? "#173f8a", status: book?.status ?? "draft",
    emoji: book && !getCoverImage(book.cover) ? book.cover : "📚",
    is_new: book?.is_new ?? false, is_featured: book?.is_featured ?? false,
    isbn: book?.isbn ?? "", page_count: book?.page_count ? String(book.page_count) : "",
    publication_date: book?.publication_date ?? "", arrival_note: book?.arrival_note ?? "",
    preorder_closes_on: book?.preorder_closes_on ?? "",
  });
  const [slugEdited, setSlugEdited] = useState(Boolean(book));
  const [preview, setPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const currentCover = book ? getCoverImage(book.cover) : null;
  const image = preview || (!removeCover ? currentCover : null);
  const field = (name: keyof typeof values, value: string | boolean) => setValues(current => ({ ...current, [name]: value }));

  return <form action={action} className="admin-editor" onSubmit={event => { if (fileError || galleryBusy || scanBusy || scanBlocked) event.preventDefault(); }}>
    <input type="hidden" name="created_via_isbn_scan" value={scanned ? "on" : ""} />
    <input type="hidden" name="id" value={book?.id ?? ""} />
    <input type="hidden" name="revision" value={book?.revision ?? 0} />
    <div className="admin-editor-main">
      {!book && <IsbnScanner disabled={pending} onBusy={setScanBusy} onBlocked={setScanBlocked} onSaved={() => setDraftSaved(true)} onManual={() => { setScanned(false); setDraftSaved(false); }} onAccept={(isbn, metadata) => {
        setDraftSaved(false);
        setScanned(true);
        setValues(current => ({ ...current, isbn,
          title: current.title || metadata.title || "", author: current.author || metadata.author || "",
          description: current.description || metadata.description || "",
          page_count: current.page_count || metadata.page_count || "",
          publication_date: current.publication_date || metadata.publication_date || "",
          format: !formatEdited && metadata.format ? metadata.format : current.format,
          slug: current.slug || (!slugEdited && metadata.title ? slugify(metadata.title) : ""),
        }));
      }} />}
      <section className="admin-panel admin-form-panel">
        <h2>Informasi buku</h2>
        <label>Judul buku *<input name="title" required maxLength={200} value={values.title} onChange={event => {
          const title = event.target.value;
          setValues(current => ({ ...current, title, ...(!slugEdited ? { slug: slugify(title) } : {}) }));
        }} placeholder="Contoh: Petualangan di Kebun Nenek" /></label>
        <div className="admin-field-grid">
          <label>Penulis *<input name="author" required maxLength={150} value={values.author} onChange={event => field("author", event.target.value)} /></label>
          <label>Kategori *<input name="category" required maxLength={100} value={values.category} onChange={event => field("category", event.target.value)} placeholder="Contoh: Alam, Emosi, Sains" /></label>
          <label>Usia pembaca *<input name="age" required maxLength={100} value={values.age} onChange={event => field("age", event.target.value)} placeholder="Contoh: 3–6 tahun" /></label>
          <label>Format *<select name="format" value={values.format} onChange={event => { setFormatEdited(true); field("format", event.target.value); }}>{book && !bookFormats.includes(book.format as typeof bookFormats[number]) && <option value={book.format}>{book.format} (pilih format baru)</option>}{bookFormats.map(format => <option key={format}>{format}</option>)}</select></label>
        </div>
        <label>Deskripsi *<textarea name="description" required maxLength={10000} rows={9} value={values.description} onChange={event => field("description", event.target.value)} placeholder="Ceritakan isi buku, manfaat, dan keistimewaannya…" /></label>
        <span className="admin-help">{values.description.length.toLocaleString("id-ID")} / 10.000 karakter · paragraf tetap ditampilkan di halaman buku.</span>
        <label>Alamat halaman / slug *<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={120} value={values.slug} onChange={event => { setSlugEdited(true); field("slug", event.target.value); }} /></label>
        <div className="admin-slug-help"><span className="admin-help">/buku/{values.slug || "alamat-buku"}</span><button className="admin-link" type="button" onClick={() => { field("slug", slugify(values.title)); setSlugEdited(false); }}>Buat dari judul</button></div>
        {book && <p className="admin-help">Mengubah slug juga mengubah alamat halaman buku. Tautan dengan slug lama tidak lagi tersedia.</p>}
      </section>
      <section className="admin-panel admin-form-panel">
        <h2>Detail penerbitan</h2>
        <p className="admin-help">Opsional. Informasi yang diisi akan ditampilkan pada halaman detail buku.</p>
        <div className="admin-field-grid">
          <label>ISBN<input name="isbn" value={values.isbn} maxLength={32} onChange={event => field("isbn", event.target.value)} placeholder="Contoh: 9781917044325" /></label>
          <label>Jumlah halaman<input name="page_count" type="number" min="1" max="100000" step="1" value={values.page_count} onChange={event => field("page_count", event.target.value)} /></label>
          <label>Tanggal terbit<input name="publication_date" type="date" value={values.publication_date} onChange={event => field("publication_date", event.target.value)} /></label>
          <label>Estimasi kedatangan<input name="arrival_note" value={values.arrival_note} maxLength={100} onChange={event => field("arrival_note", event.target.value)} placeholder="Contoh: Ready stock / Mei 2027" /></label>
          <label>Penutupan preorder<input name="preorder_closes_on" type="date" value={values.preorder_closes_on} onChange={event => field("preorder_closes_on", event.target.value)} /></label>
        </div>
      </section>
      <GalleryEditor images={gallery} onChange={setGallery} onBusy={setGalleryBusy} disabled={pending} />
      <section className="admin-panel admin-form-panel">
        <h2>Harga & penanda</h2>
        <label>Harga jual (Rp) *<input name="price" type="number" min="0" max="2147483647" step="1" required value={values.price} onChange={event => field("price", event.target.value)} placeholder="99000" /></label>
        <p className="admin-help">Masukkan rupiah tanpa titik atau koma. Stok dicatat terpisah melalui menu Stok opname setelah buku disimpan.</p>
        <label className="admin-checkbox"><input type="checkbox" name="is_new" checked={values.is_new} onChange={event => field("is_new", event.target.checked)} />Tandai sebagai buku baru</label>
        <label className="admin-checkbox"><input type="checkbox" name="is_featured" checked={values.is_featured} onChange={event => field("is_featured", event.target.checked)} />Tandai sebagai pilihan kurator</label>
      </section>
    </div>
    <aside className="admin-editor-aside">
      <section className="admin-panel admin-form-panel">
        <h2>Sampul buku</h2>
        <div className="admin-cover-preview" style={{ background: values.accent }}>
          {image ? <Image src={image} alt="Preview sampul buku" fill sizes="300px" unoptimized /> : <div><span>{values.emoji}</span><strong>{values.title || "Judul buku"}</strong><small>{values.author || "Nama penulis"}</small></div>}
        </div>
        <label>Upload gambar<input ref={fileInput} type="file" name="coverFile" accept="image/jpeg,image/png,image/webp" onChange={event => {
          const selected = event.target.files?.[0] ?? null;
          if (selected && (selected.size > maxCoverBytes || !["image/jpeg", "image/png", "image/webp"].includes(selected.type))) {
            setFileError("Gunakan JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
            event.target.value = ""; setFile(null); return;
          }
          setFileError(""); setFile(selected);
        }} /></label>
        {file && <div className="admin-slug-help"><span className="admin-help">{file.name}</span><button type="button" className="admin-link" onClick={() => { setFile(null); setFileError(""); if (fileInput.current) fileInput.current.value = ""; }}>Batalkan gambar</button></div>}
        <p className="admin-help">JPG, PNG, WebP · maksimal 5 MB. Gambar otomatis dioptimalkan. Sampul akan dapat dilihat publik.</p>
        {fileError && <p className="admin-message error" role="alert">{fileError}</p>}
        {currentCover && <label className="admin-checkbox"><input name="removeCover" type="checkbox" checked={removeCover} onChange={event => setRemoveCover(event.target.checked)} />Lepas gambar sampul lama</label>}
        <div className="admin-field-grid"><label>Emoji pengganti<input name="emoji" value={values.emoji} onChange={event => field("emoji", event.target.value)} maxLength={24} /></label><label>Warna latar<input name="accent" type="color" value={values.accent} onChange={event => field("accent", event.target.value)} /></label></div>
        <p className="admin-help">Jika tidak ada gambar, toko menampilkan ilustrasi pengganti.</p>
      </section>
      <section className="admin-panel admin-form-panel">
        <h2>Publikasi</h2>
        <label>Status buku<select name="status" value={values.status} onChange={event => field("status", event.target.value)}><option value="draft">Draft — belum ditampilkan</option><option value="published">Published — tampil di toko</option><option value="archived">Archived — disimpan di arsip</option></select></label>
        <p className="admin-help">Buku draft dan arsip tetap tersedia untuk stok opname. Pilih Archived untuk menarik buku dari toko.</p>
        {state.error && <p className="admin-message error" role="alert">{state.error}</p>}
        <button className="admin-button" disabled={pending || galleryBusy || scanBusy || scanBlocked || Boolean(fileError)}>{scanBusy ? "Memproses ISBN…" : draftSaved ? "Draft tersimpan — scan buku berikutnya" : scanBlocked ? "Scan ditolak — pilih tambah manual" : galleryBusy ? "Menunggu upload foto…" : pending ? "Mengupload & menyimpan…" : book ? "Simpan perubahan" : "Tambah buku"}</button>
        <Link href="/admin/books" className="admin-button secondary">Batal</Link>
        {book?.status === "published" && <Link href={`/buku/${book.slug}`} target="_blank" className="admin-link">Lihat halaman buku ↗</Link>}
      </section>
    </aside>
  </form>;
}
