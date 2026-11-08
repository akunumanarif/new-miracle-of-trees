"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getCoverImage } from "@/lib/cover";
import BookCover from "./book-cover";
import type { Book } from "@/lib/types";

export default function BookGallery({ book }: { book: Book }) {
  const cover = getCoverImage(book.cover);
  const photos = Array.from(new Set([cover, ...(book.gallery_images ?? []).map(getCoverImage)].filter((url): url is string => Boolean(url))));
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const active = photos[selected] ?? null;
  const move = (direction: number) => setSelected(current => (current + direction + photos.length) % photos.length);
  return <section className="product-gallery" aria-label={`Galeri ${book.title}`}>
    <div className="product-gallery-main" tabIndex={photos.length > 1 ? 0 : undefined} onKeyDown={event => {
      if (photos.length < 2) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    }}>
      {active && failed !== active ? <Image key={active} src={active} alt={`${book.title} — ${selected === 0 && cover ? "sampul" : `foto ${selected + 1}`}`} fill sizes="(max-width: 799px) 100vw, 52vw" preload={selected === 0} className="product-gallery-photo" onError={() => setFailed(active)} /> : <div className="book-cover product-gallery-fallback" style={{ "--cover": book.accent } as React.CSSProperties}><BookCover book={book} detail /></div>}
    </div>
    {photos.length > 0 && <div className="product-gallery-controls">
      {photos.length > 1 && <button type="button" className="gallery-arrow" aria-label="Foto sebelumnya" onClick={() => move(-1)}><ChevronLeft size={18} /></button>}
      <div className="product-thumbnails">{photos.map((url, index) => <button key={url} type="button" className={index === selected ? "is-active" : ""} aria-label={`Lihat foto ${index + 1} dari ${photos.length}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><Image src={url} alt={`Thumbnail ${book.title} ${index + 1}`} fill sizes="120px" /></button>)}</div>
      {photos.length > 1 && <button type="button" className="gallery-arrow" aria-label="Foto berikutnya" onClick={() => move(1)}><ChevronRight size={18} /></button>}
    </div>}
    {photos.length > 1 && <p className="product-gallery-count" aria-live="polite">{selected + 1} / {photos.length}</p>}
  </section>;
}
