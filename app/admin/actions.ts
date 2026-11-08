"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { parseStockOpname } from "@/lib/stock-validation";

export type ActionState = { error?: string; success?: string };

export async function login(_state: ActionState, form: FormData): Promise<ActionState> {
  const email = form.get("email");
  const password = form.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return { error: "Isi email dan password." };
  }
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) return { error: "Login gagal. Periksa email dan password, lalu coba lagi." };
  const membership = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (membership.error || !membership.data) {
    await supabase.auth.signOut({ scope: "local" });
    return { error: membership.error ? "Akses admin belum tersedia. Pastikan migrasi admin sudah dijalankan." : "Akun ini belum diberi akses admin." };
  }
  redirect("/admin");
}

export async function logout() {
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Logout gagal. Silakan coba lagi.");
  redirect("/admin/login");
}

export async function saveStockOpname(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseStockOpname(form);
  if (parsed.error) return { error: parsed.error };
  const { bookId, count, version, note } = parsed.data;
  const { error } = await supabase.rpc("record_stock_opname", {
    p_book_id: bookId, p_count: count, p_expected_version: version, p_note: note,
  });
  if (error) {
    if (error.code === "40001") return { error: "Stok sudah berubah sejak halaman dibuka. Muat ulang halaman dan periksa ulang hitungan sebelum menyimpan." };
    if (error.code === "42501") return { error: "Akses admin tidak tersedia. Silakan login ulang." };
    console.error("Stock opname failed:", error.code);
    return { error: "Opname gagal disimpan. Muat ulang halaman untuk memeriksa stok dan riwayat sebelum mencoba lagi." };
  }
  revalidatePath("/admin");
  return { success: "Stok dan riwayat opname berhasil disimpan." };
}
