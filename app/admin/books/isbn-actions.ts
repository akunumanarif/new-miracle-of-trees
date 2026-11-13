"use server";

import { requireAdmin } from "@/lib/admin";
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
