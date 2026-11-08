import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "./supabase/server";

export async function requireAdmin() {
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/admin/login");
  const membership = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (membership.error) throw new Error("Akses admin belum dapat diperiksa. Pastikan migrasi admin sudah dijalankan.");
  if (!membership.data) redirect("/admin/login?reason=forbidden");
  return { supabase, user };
}
