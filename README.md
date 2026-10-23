# Miracle of Trees

Katalog buku anak mobile-first dengan Next.js App Router, Supabase, dan target deployment Netlify.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Tanpa environment Supabase, aplikasi otomatis memakai katalog demo dari `lib/seed-books.ts`.

## Menghubungkan Supabase

1. Buat proyek Supabase.
2. Jalankan `supabase/schema.sql` melalui SQL Editor.
3. Salin `.env.example` menjadi `.env.local` dan isi project URL serta publishable key.
4. Tambahkan data ke tabel `books` dengan `status = 'published'`.

Kolom `price` menggunakan integer rupiah. Secret/service-role key tidak dibutuhkan dan tidak boleh diletakkan di environment publik.

## Deployment Netlify

Hubungkan repository ke Netlify. Build command: `npm run build`. Netlify mendeteksi Next.js secara otomatis. Tambahkan kedua environment variable Supabase pada Site configuration sebelum production deploy.

## Pemeriksaan

```bash
npm run typecheck
npm run build
```
