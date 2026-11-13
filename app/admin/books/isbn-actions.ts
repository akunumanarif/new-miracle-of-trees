"use server";

import { requireAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { slugify } from "@/lib/book-validation";
import { canonicalIsbn, isbnCheckError, type IsbnLookup } from "@/lib/isbn";

import { fetchBookMetadata } from "@/lib/book-metadata";

export async function lookupBookIsbn(input: string): Promise<IsbnLookup> {
  const { supabase } = await requireAdmin();
  const isbn = typeof input === "string" && input.length <= 64 ? canonicalIsbn(input) : null;
  if (!isbn) return { error: "Barcode bukan ISBN buku yang valid. Arahkan kamera ke barcode 978 atau 979." };
  const duplicate = await supabase.rpc("find_book_by_isbn", { input_isbn: isbn });
  if (duplicate.error) {
    console.error("ISBN duplicate check failed:", duplicate.error.code);
    return { error: isbnCheckError(duplicate.error.code) };
  }
  if (duplicate.data?.length) return { isbn, duplicate: duplicate.data[0] };
  const { metadata, sources, notice } = await fetchBookMetadata(isbn);
  return { isbn, metadata, sources, notice: notice ?? (Object.keys(metadata).length
    ? "Detail buku yang tersedia sudah diisi pada kolom kosong. Periksa hasil dan lengkapi kolom yang tersisa sebelum menyimpan."
    : "ISBN belum ada di koleksi. Detail belum ditemukan di Google Books maupun ISBN Search. Lengkapi detail secara manual." ) };
}

export async function addIsbnDraft(input: string): Promise<IsbnLookup> {
  // Resolve metadata on the server; never accept publication status or book
  // details from the scanner client for this draft-only operation.
  const found = await lookupBookIsbn(input);
  if (!("metadata" in found)) return found;
  const { supabase } = await requireAdmin();
  const { isbn, metadata } = found;
  const title = metadata.title || `Buku ISBN ${isbn}`;
  const result = await supabase.from("books").insert({
    title, slug: `${slugify(title).slice(0, 100).replace(/-$/, "") || "buku"}-${isbn}`,
    isbn, author: metadata.author || "", description: metadata.description || "",
    category: "", age: "", format: metadata.format || "Hardback", price: 0,
    cover: "📚", accent: "#173f8a", status: "draft",
    is_new: false, is_featured: false, created_via_isbn_scan: true,
    page_count: metadata.page_count ? Number(metadata.page_count) : null,
    publication_date: metadata.publication_date || null,
  }).select("id").single();
  if (result.error || !result.data) {
    if (result.error?.code === "23505") {
      return { error: "ISBN atau slug sudah ada di koleksi. Draft tidak ditambahkan. Periksa daftar buku atau gunakan Tambah manual." };
    }
    console.error("ISBN draft save failed:", result.error?.code);
    return { error: "Penyimpanan draft belum dapat dipastikan. Periksa daftar buku sebelum scan ulang." };
  }
  revalidatePath("/admin/books");
  revalidatePath("/admin");
  return { ...found, savedDraft: { id: result.data.id, title }, notice: `“${title}” tersimpan sebagai draft. Silakan scan buku berikutnya. Lengkapi detail dan harga sebelum dipublikasikan.` };
}
