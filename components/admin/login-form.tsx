"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/actions";

export default function LoginForm({ forbidden }: { forbidden: boolean }) {
  const [state, action, pending] = useActionState(login, {});
  return <form action={action} className="admin-form">
    <label>Email admin<input name="email" type="email" autoComplete="username" required placeholder="admin@miracleoftrees.id" /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required placeholder="Masukkan password" /></label>
    {(state.error || forbidden) && <p className="admin-message error" role="alert">{state.error || "Akun ini belum diberi akses admin. Hubungi pengelola."}</p>}
    <button className="admin-button" disabled={pending}>{pending ? "Memeriksa akun…" : "Masuk ke admin →"}</button>
    <p className="admin-help">Akun admin disediakan oleh pengelola. Hubungi pengelola jika lupa password.</p>
  </form>;
}
