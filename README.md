# Miracle of Trees

Katalog buku anak mobile-first dengan Next.js App Router, Supabase, dan target deployment Netlify.

## Menjalankan lokal

```bash
npm install
npm run dev
```

Katalog dan detail buku mengambil data langsung dari Supabase pada setiap permintaan halaman. Tidak ada fallback produk hardcoded. Jika konfigurasi belum diisi atau koneksi gagal, halaman menampilkan pesan gagal memuat dengan tautan untuk mencoba lagi.

## Menghubungkan Supabase

1. Buat proyek Supabase.
2. Jalankan `supabase/schema.sql` melalui SQL Editor.
3. Salin `.env.example` menjadi `.env.local` dan isi project URL serta publishable key.
4. Tambahkan data ke tabel `books` dengan `status = 'published'`.
5. Restart `npm run dev` setelah mengubah `.env.local`.

Setelah migrasi admin dan pengelolaan buku dijalankan (lihat di bawah), gunakan **Admin → Kelola buku** untuk menambah dan mengedit produk. Kolom wajib: judul, slug unik, penulis, kategori, usia, format, harga, dan deskripsi. Format yang tersedia: `Paperback`, `Hardback`, dan `Board Book`. Kolom `cover` menyimpan URL sampul dari Storage atau emoji pengganti; `accent` berupa warna hex.

Produk baru berstatus `draft` secara default. Ubah ke `published` agar tampil, atau `archived` untuk menyembunyikannya. Katalog kosong menampilkan pesan “Koleksi segera hadir”. Perubahan database terlihat saat halaman dimuat ulang, tanpa build/deploy ulang.

`schema.sql` dapat dijalankan ulang dan mengatur Row Level Security agar pengunjung hanya bisa membaca buku berstatus `published`. Untuk instalasi yang sudah berjalan, cukup jalankan migrasi tambahan sesuai urutan, tanpa mengulang schema dasar.

Kolom `price` menggunakan integer rupiah. Secret/service-role key tidak dibutuhkan dan tidak boleh diletakkan di environment publik.

## Deployment Netlify

Hubungkan repository ke Netlify. Build command: `npm run build`. Netlify mendeteksi Next.js secara otomatis. Tambahkan kedua environment variable Supabase pada Site configuration sebelum production deploy.

## Admin dan stok opname

1. Setelah schema buku dibuat, jalankan `supabase/migrations/20261108_admin_inventory.sql` di SQL Editor. Migrasi ini dapat dijalankan ulang, tidak mengubah produk yang ada, dan membuat tabel `admin_users`, `inventory`, serta `stock_opnames`.
2. Di Supabase **Authentication → Users → Add user → Create new user**, buat akun menggunakan email dan password. Aktifkan konfirmasi email otomatis untuk akun yang dibuat pengelola.
3. Berikan akses admin melalui SQL berikut, dengan email akun yang baru dibuat:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where lower(email) = lower('admin@contoh.com')
   on conflict (user_id) do nothing;
   ```

   Pastikan ada baris untuk user tersebut di `admin_users`. Akun Auth biasa tidak otomatis mendapat akses admin. Hanya pengelola database yang dapat memberikan/mencabut akses.
4. Jalankan aplikasi, buka `/admin`, lalu masuk dengan akun tersebut. Tidak ada halaman pendaftaran publik. Pemulihan password dapat dilakukan pengelola melalui dashboard Supabase.
5. Cari buku, masukkan **stok fisik** hasil hitung dan catatan wajib, lalu simpan opname. Stok sistem akan diganti dengan hasil hitung; selisih dihitung otomatis. Semua format dan status buku (termasuk draft/archived) tersedia untuk admin.

Stok awal untuk buku yang belum diopname adalah 0 (belum dihitung), bukan hasil pemeriksaan fisik. Riwayat menyimpan stok sebelum/sesudah, selisih, judul saat opname, catatan, email petugas, dan waktu. Halaman menampilkan 20 catatan terbaru; seluruh riwayat tetap tersimpan di database.

Sesi login menggunakan Supabase SSR dengan cookie dan refresh token melalui `proxy.ts`. Server memverifikasi user serta keanggotaan admin sebelum membaca data atau menyimpan opname. RLS melindungi tabel stok dan riwayat; perubahan stok hanya melalui fungsi `record_stock_opname` yang memeriksa hak admin. Penguncian baris dan pemeriksaan versi mencegah perubahan bersamaan menimpa hitungan lama. Riwayat dan stok diperbarui dalam satu transaksi.

Jika muncul konflik stok, muat ulang dan hitung/periksa kembali sebelum menyimpan. Jika koneksi putus saat penyimpanan, periksa stok serta riwayat setelah memuat ulang untuk memastikan apakah pencatatan sudah tersimpan. Pencatatan ini belum terhubung dengan pengurangan stok penjualan otomatis.

Untuk mencabut akses, hapus baris user dari `admin_users` melalui SQL Editor/Table Editor. Jangan membuat kebijakan tulis publik untuk tabel stok atau keanggotaan admin. Integrasi tidak memerlukan service-role key.

Referensi: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs) dan [database functions](https://supabase.com/docs/guides/database/functions).

## Pengelolaan buku dan gambar sampul

1. Jalankan `supabase/migrations/20261108_book_management.sql` di SQL Editor **setelah** migrasi `20261108_admin_inventory.sql`. Migrasi menambahkan versi edit buku, izin tulis khusus admin, bucket publik `book-covers`, dan aturan upload. Data dan akun admin yang ada tetap dipakai.
2. Restart server lokal setelah instalasi/perubahan konfigurasi: `npm install`, lalu `npm run dev`. Di hosting, deploy versi kode terbaru.
3. Buka `/admin/books` atau menu **Kelola buku**. Klik **Tambah buku**, lengkapi informasi, pilih sampul, lalu klik **Tambah buku**. Slug dibuat otomatis dari judul dan dapat diganti; slug harus unik.
4. Gunakan **Edit buku** untuk mengganti informasi, mengganti/melepas sampul, atau mengatur status `draft`, `published`, dan `archived`. Hanya `published` yang tampil di toko. Daftar buku mendukung pencarian, filter status, dan pagination.
5. Setelah buku dibuat, buka **Stok opname** untuk mencatat jumlah fisik. Riwayat dan jumlah stok tidak berubah ketika informasi buku diedit atau buku diarsipkan.

Upload menerima JPG, PNG, dan WebP maksimal 5 MB. Server memeriksa isi gambar, menolak gambar rusak/animasi, membatasi dimensi masukan, menyesuaikan orientasi, mengecilkan gambar maksimal 1600 × 2200 piksel tanpa memotong, lalu menyimpan WebP. Form menampilkan preview sebelum disimpan. Sampul tampil di daftar admin, katalog toko, dan halaman detail. Jika tidak ada gambar, ilustrasi emoji lama tetap didukung.

Bucket sampul bersifat publik, termasuk sampul buku draft, agar gambar dapat ditampilkan ke pengunjung. Hanya admin yang dapat mengupload; aplikasi tidak memakai service-role key. Sampul lama yang diganti/dilepas tetap tersimpan di Storage agar tautan lama tidak langsung rusak. Upload baru dibersihkan jika database secara pasti menolak penyimpanan; jika hasil penyimpanan tidak diketahui karena koneksi putus, file dipertahankan dan pengelola perlu memeriksa daftar buku sebelum mengulang.

Jika admin lain sudah menyimpan perubahan pada buku yang sama, form meminta halaman dimuat ulang untuk mencegah penimpaan. Mengubah slug mengubah URL buku; URL lama tidak dialihkan otomatis. Gunakan status **Archived** untuk menarik buku dari toko sambil mempertahankan stok dan riwayat; admin tidak menghapus buku permanen.

Referensi: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) dan [upload API](https://supabase.com/docs/reference/javascript/storage-from-upload).

## Halaman detail dan galeri

Halaman detail memakai galeri di kiri dan informasi/pemesanan di kanan pada desktop; pada ponsel, keduanya tersusun vertikal. Thumbnail, tombol panah, dan tombol panah keyboard dapat digunakan untuk berpindah foto. Tombol hati memakai koleksi tersimpan yang sama dengan beranda; tombol bagikan memakai menu berbagi perangkat atau menyalin tautan. Tombol WhatsApp menyertakan judul dan alamat halaman buku.

Untuk mengisi foto tambahan dan metadata, jalankan `supabase/migrations/20261108_book_details.sql` setelah migrasi pengelolaan buku. Di admin, buka **Edit buku → Detail penerbitan** untuk ISBN, jumlah halaman, tanggal terbit, estimasi kedatangan, dan penutupan preorder. Kolom tersebut opsional; data kosong tidak ditampilkan di toko.

Bagian **Foto tambahan** menerima maksimal 4 foto selain sampul utama. Upload diproses satu per satu (maksimal 5 MB per file); foto dapat diurutkan atau dilepas sebelum buku disimpan. Foto yang sudah diupload tetapi belum disimpan atau sudah dilepas tetap ada di Storage dan dapat dikelola melalui dashboard Supabase. Galeri menampilkan setiap URL unik satu kali, tanpa thumbnail duplikat untuk buku dengan satu foto. Desain baru tetap dapat menampilkan buku lama sebelum migrasi detail dijalankan; penyimpanan melalui admin memerlukan migrasi tersebut.

## Tambah buku lewat scan ISBN

Jalankan `supabase/migrations/20261109_isbn_scan.sql` setelah migrasi detail buku, lalu deploy kode terbaru. Di **Kelola buku → Tambah buku**, pilih **Scan barcode ISBN**, izinkan kamera, lalu arahkan barcode 978/979 ke kamera belakang HP. Saat scan aktif, gunakan **Ganti kamera** untuk berpindah antar kamera yang tersedia, misalnya kamera depan dan belakang. Akses kamera memerlukan HTTPS (atau localhost untuk pengembangan); URL HTTP lewat IP lokal tidak bisa mengakses kamera.

ISBN divalidasi beserta checksum. Sistem memeriksa seluruh koleksi, termasuk draft dan arsip, dengan menyamakan tanda hubung/spasi dan ISBN-10/ISBN-13 yang setara. Jika duplikat, penyimpanan hasil scan diblokir; admin dapat membuka buku yang ada atau memilih **Tambah manual** untuk memeriksa dan memasukkan buku secara manual. Jalur manual tetap mengizinkan ISBN duplikat. Pemeriksaan ulang di server dan trigger database melindungi penyimpanan scan bersamaan untuk ISBN yang sama.

Untuk ISBN baru, sistem mencari edisi dengan ISBN yang cocok di Google Books terlebih dahulu. Jika Google Books tidak mengembalikan judul yang cocok atau permintaannya gagal, sistem mengambil halaman `https://isbnsearch.org/isbn/{isbn}` sebagai fallback. Data HTML hanya dibaca di server, ISBN pada bagian detail harus cocok, dan script tidak dijalankan. Open Library dan Little Tiger tidak lagi dipanggil dalam alur ini.

Kolom kosong diisi dari data yang tersedia: judul, penulis, deskripsi, jumlah halaman, dan tanggal terbit lengkap. ISBN Search juga dapat mengisi format: Hardcover/Hardback → Hardback, Softcover/Paperback → Paperback, Board Book → Board Book. Format yang sudah dipilih admin tidak ditimpa. Tautan sumber ditampilkan di form. Deskripsi, halaman, harga, kategori, usia, dan sampul yang tidak tersedia tetap perlu dilengkapi admin. Jika kedua sumber gagal atau tidak menemukan buku, ISBN tetap terisi dan form dapat dilengkapi manual. Tidak ada buku yang disimpan otomatis. Kamera diproses di browser; pencarian eksternal mengirim ISBN.

Untuk memakai kuota proyek Google sendiri, aktifkan Books API di Google Cloud dan isi `GOOGLE_BOOKS_API_KEY` di environment server (tanpa awalan `NEXT_PUBLIC_`), lalu restart/deploy ulang. ISBN Search tidak membutuhkan key. Setiap permintaan sumber dibatasi 6 detik. Log server menyebut sumber serta status HTTP tanpa mencetak API key. Parser ISBN Search bergantung pada struktur HTML situs; bila berubah atau akses dibatasi, alur berakhir pada pengisian manual.

Referensi: [ZXing browser](https://github.com/zxing-js/browser), [Google Books API](https://developers.google.com/books/docs/v1/reference/volumes/list), dan [ISBN Search](https://isbnsearch.org/).

## Stok pada halaman detail

Jalankan `supabase/migrations/20261108_public_book_stock.sql` setelah migrasi inventory. Halaman detail mengambil jumlah stok sistem terbaru saat dimuat: 1–2 buku menampilkan **Last stock!**, lebih dari 2 menampilkan **Available · Ready stock**, dan 0 menampilkan **Stok habis**. Jumlah pastinya juga ditampilkan. Buku yang belum memiliki pencatatan stok dianggap 0, sesuai nilai awal admin.

Fungsi publik hanya mengembalikan jumlah stok buku berstatus `published`. Tabel inventory dan riwayat opname tetap hanya bisa dibaca admin. Jika migrasi belum dijalankan atau stok gagal dimuat, halaman menampilkan **Konfirmasi ketersediaan**, tanpa mengarang jumlah stok. Perubahan stok terlihat saat halaman dimuat ulang; klik WhatsApp tidak mengurangi atau mereservasi stok.

## Pemeriksaan

Kartu buku di beranda memakai pita diagonal beranimasi berdasarkan stok: **1** → “Wah, tinggal 1 nih!”, **2–3** → “Hampir habis, amankan sekarang!”, **4 ke atas** → “Ready Stock”. Stok 0 memakai “Stok habis” tanpa animasi; stok yang belum dapat dimuat tidak diberi pita. Animasi berhenti jika perangkat mengaktifkan pengurangan gerakan. Jalankan ulang `20261108_public_book_stock.sql` untuk menambahkan fungsi pembacaan stok katalog secara batch; data buku dan stok yang sudah ada tidak berubah.

```bash
npm run typecheck
npm test
npm run build
```
