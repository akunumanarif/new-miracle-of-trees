"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { parseBookForm } from "@/lib/book-validation";
import { prepareCover } from "@/lib/cover-upload";
import type { ActionState } from "../actions";

export async function saveBook(_state: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = parseBookForm(form);
  if (parsed.error) return { error: parsed.error };
  const { id, revision, fields, removeCover, emoji } = parsed.data;
  let previous: { slug: string; cover: string; revision: number } | null = null;
  if (id) {
    const result = await supabase.from("books").select("slug,cover,revision").eq("id", id).maybeSingle();
    if (result.error || !result.data) return { error: "Buku tidak ditemukan atau tidak dapat dimuat. Kembali ke daftar buku dan coba lagi." };
    previous = result.data;
    if (previous.revision !== revision) return { error: "Buku sudah diubah admin lain. Muat ulang halaman sebelum mengedit kembali." };
  }

  let cover = previous && !removeCover ? previous.cover : emoji;
  // Emoji can also be edited when no uploaded cover is currently used.
  if (!cover.startsWith("http")) cover = emoji;
  let uploadedPath: string | null = null;
  const file = form.get("coverFile");
  if (file && typeof file !== "string" && file.size > 0) {
    let image: Buffer;
    try { image = await prepareCover(file); }
    catch (error) { return { error: error instanceof Error ? error.message : "Gambar gagal diproses." }; }
    uploadedPath = `${user.id}/${randomUUID()}.webp`;
    const uploaded = await supabase.storage.from("book-covers").upload(uploadedPath, image, { contentType: "image/webp", upsert: false });
    if (uploaded.error) return { error: "Upload sampul gagal. Pastikan migrasi pengelolaan buku sudah dijalankan dan koneksi tersedia." };
    cover = supabase.storage.from("book-covers").getPublicUrl(uploadedPath).data.publicUrl;
  }

  const payload = { ...fields, cover };
  const result = id
    ? await supabase.from("books").update(payload).eq("id", id).eq("revision", revision).select("id").maybeSingle()
    : await supabase.from("books").insert(payload).select("id").single();

  if (result.error || !result.data) {
    // Delete only the newly uploaded file when the DB explicitly rejected the write.
    // A transport error may arrive after commit; keep the file in that case.
    if (uploadedPath && (!result.error || /^\d{5}$/.test(result.error.code ?? ""))) {
      await supabase.storage.from("book-covers").remove([uploadedPath]);
    }
    if (result.error?.code === "23505") return { error: "Slug sudah digunakan buku lain. Ganti alamat/slug buku lalu simpan kembali." };
    if (!result.error) return { error: "Buku sudah diubah admin lain. Muat ulang halaman dan periksa perubahan terbaru." };
    console.error("Book save failed:", result.error.code);
    return { error: "Buku belum dapat disimpan. Periksa daftar buku sebelum mencoba lagi; pastikan migrasi pengelolaan buku sudah dijalankan." };
  }

  revalidatePath("/admin/books");
  revalidatePath("/admin");
  revalidatePath("/");
  if (previous) revalidatePath(`/buku/${previous.slug}`);
  revalidatePath(`/buku/${fields.slug}`);
  redirect(`/admin/books?saved=${id ? "updated" : "created"}`);
}
