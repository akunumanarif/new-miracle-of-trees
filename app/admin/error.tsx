"use client";

export default function AdminError() {
  return <main className="admin-login"><section className="admin-login-card"><h1>Admin belum dapat dimuat</h1><p>Periksa koneksi dan konfigurasi Supabase. Pastikan migrasi admin sudah dijalankan.</p><a href="/admin" className="admin-button">Coba lagi</a><a href="/admin/login" className="admin-back">Kembali ke login</a></section></main>;
}
