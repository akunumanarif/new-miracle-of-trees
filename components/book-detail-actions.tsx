"use client";

import { useEffect, useState } from "react";
import { Heart, Share2 } from "lucide-react";

const savedKey = "miracle-of-trees-saved";
export default function BookDetailActions({ id, title }: { id: string; title: string }) {
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try { const stored = JSON.parse(localStorage.getItem(savedKey) ?? "[]"); setSaved(Array.isArray(stored) && stored.includes(id)); } catch { setSaved(false); }
  }, [id]);
  return <>
    <div className="product-purchase-actions"><button type="button" className={`product-save ${saved ? "is-saved" : ""}`} aria-label={saved ? "Hapus dari tersimpan" : "Simpan buku"} aria-pressed={saved} onClick={() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(savedKey) ?? "[]");
        const current: string[] = Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
        const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
        localStorage.setItem(savedKey, JSON.stringify(next)); setSaved(next.includes(id));
        setMessage(next.includes(id) ? "Buku ditambahkan ke koleksi tersimpan." : "Buku dihapus dari koleksi tersimpan.");
      } catch { setMessage("Browser belum mengizinkan penyimpanan buku."); }
    }}><Heart size={19} fill={saved ? "currentColor" : "none"} /></button><a className="product-order" href={`https://wa.me/?text=${encodeURIComponent(`Halo Miracle of Trees, saya ingin memesan buku ${title}.`)}`} onClick={event => { event.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`Halo Miracle of Trees, saya ingin memesan buku ${title}. ${window.location.href}`)}`; }} target="_blank" rel="noreferrer">Pesan melalui WhatsApp</a></div>
    <p className="product-action-message" role="status">{message}</p>
    <button className="product-share" type="button" aria-label="Bagikan buku" onClick={async () => {
      try {
        if (navigator.share) await navigator.share({ title, url: window.location.href });
        else { await navigator.clipboard.writeText(window.location.href); setMessage("Tautan buku berhasil disalin."); }
      } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setMessage("Tautan belum dapat dibagikan. Salin alamat dari browser."); }
    }}><Share2 size={20} /></button>
  </>;
}
