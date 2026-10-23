import "server-only";
import { createClient } from "@supabase/supabase-js";
import { seedBooks } from "./seed-books";
import type { Book } from "./types";

export async function getBooks(): Promise<Book[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return seedBooks;

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from("books")
    .select("id,slug,title,author,category,age,format,price,cover,accent,description,is_new,is_featured")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase unavailable, using seed catalog:", error.message);
    return seedBooks;
  }
  return (data ?? []) as Book[];
}

export async function getBook(slug: string) {
  const books = await getBooks();
  return books.find((book) => book.slug === slug);
}
