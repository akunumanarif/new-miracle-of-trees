"use server";

import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin";
import { prepareCover } from "@/lib/cover-upload";

export async function uploadBookPhoto(form: FormData): Promise<{ url?: string; error?: string }> {
  const { supabase, user } = await requireAdmin();
  const file = form.get("photo");
  if (!file || typeof file === "string" || file.size === 0) return { error: "Pilih gambar yang akan diupload." };
  let image: Buffer;
  try { image = await prepareCover(file); }
  catch (error) { return { error: error instanceof Error ? error.message : "Gambar gagal diproses." }; }
  const path = `${user.id}/${randomUUID()}.webp`;
  const bucket = supabase.storage.from("book-covers");
  const { error } = await bucket.upload(path, image, { contentType: "image/webp", upsert: false });
  if (error) return { error: "Foto gagal diupload. Periksa koneksi dan konfigurasi Storage." };
  return { url: bucket.getPublicUrl(path).data.publicUrl };
}
