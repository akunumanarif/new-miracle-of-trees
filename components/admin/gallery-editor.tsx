"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { uploadBookPhoto } from "@/app/admin/books/media-actions";
import { maxCoverBytes } from "@/lib/book-validation";

export default function GalleryEditor({ images, onChange, onBusy, disabled = false }: {
  images: string[]; onChange: (images: string[]) => void; onBusy: (busy: boolean) => void; disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  return <section className="admin-panel admin-form-panel">
    <h2>Foto tambahan</h2>
    <p className="admin-help">Maksimal 4 foto isi atau bagian belakang buku. Sampul utama otomatis menjadi foto pertama. Klik panah untuk mengubah urutan.</p>
    <input type="hidden" name="gallery_images" value={JSON.stringify(images)} />
    <div className="admin-gallery-images">{images.map((url, index) => <div className="admin-gallery-item" key={url}>
      <div className="admin-gallery-image"><Image src={url} alt={`Foto tambahan ${index + 1}`} fill sizes="150px" /></div>
      <div><button type="button" disabled={disabled || pending || index === 0} aria-label={`Pindah foto ${index + 1} ke kiri`} onClick={() => { const next = [...images]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>←</button><button type="button" disabled={disabled || pending || index === images.length - 1} aria-label={`Pindah foto ${index + 1} ke kanan`} onClick={() => { const next = [...images]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); }}>→</button><button type="button" disabled={disabled || pending} onClick={() => onChange(images.filter(item => item !== url))}>Lepas</button></div>
    </div>)}</div>
    <label>Tambah foto<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || pending || images.length >= 4} onChange={event => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (!files.length) return;
      if (images.length + files.length > 4) { setError("Maksimal 4 foto tambahan per buku."); return; }
      if (files.some(file => file.size > maxCoverBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("Gunakan JPG, PNG, atau WebP maksimal 5 MB per foto."); return; }
      setError(""); onBusy(true);
      startTransition(async () => {
        const next = [...images];
        try {
          for (const file of files) {
            const form = new FormData(); form.set("photo", file);
            const result = await uploadBookPhoto(form);
            if (result.error || !result.url) { setError(result.error ?? "Foto gagal diupload."); break; }
            next.push(result.url); onChange([...next]);
          }
        } catch { setError("Upload terputus. Silakan coba lagi."); }
        finally { onBusy(false); }
      });
    }} /></label>
    {pending && <p className="admin-help" role="status">Mengupload foto satu per satu…</p>}
    {error && <p className="admin-message error" role="alert">{error}</p>}
    <p className="admin-help">JPG, PNG, WebP · maksimal 5 MB per foto. Simpan buku untuk menerapkan perubahan galeri.</p>
  </section>;
}
