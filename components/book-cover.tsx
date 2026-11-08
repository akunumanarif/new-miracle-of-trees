"use client";

import Image from "next/image";
import { useState } from "react";
import { getCoverImage } from "@/lib/cover";
import type { Book } from "@/lib/types";

export default function BookCover({ book, detail = false }: { book: Pick<Book, "cover" | "title" | "author">; detail?: boolean }) {
  const image = getCoverImage(book.cover);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (image && failedSource !== image) {
    return <Image src={image} alt={`Sampul ${book.title}`} fill sizes={detail ? "330px" : "(max-width: 699px) 164px, 248px"} className="book-cover-image" onError={() => setFailedSource(image)} />;
  }
  return <><span className="cover-kicker">Miracle of Trees</span><span className="cover-art" aria-hidden="true">{image ? "📚" : book.cover}</span><strong>{book.title}</strong><small>{book.author}</small></>;
}
