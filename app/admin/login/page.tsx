import Link from "next/link";
import Image from "next/image";
import LoginForm from "@/components/admin/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <main className="admin-login"><section className="admin-login-card">
    <Link href="/" className="admin-brand"><Image src="/mot.png" alt="Miracle of Trees" width={48} height={48} /><span>Miracle of Trees<small>Ruang pengelola</small></span></Link>
    <div className="admin-login-intro"><span className="admin-eyebrow">ADMINISTRASI TOKO</span><h1>Selamat datang kembali.</h1><p>Masuk untuk memeriksa persediaan dan mencatat hasil stok opname.</p></div>
    <LoginForm forbidden={reason === "forbidden"} />
    <Link href="/" className="admin-back">← Kembali ke toko</Link>
  </section><p className="admin-login-footer">Buku yang tumbuh bersama si kecil.</p></main>;
}
