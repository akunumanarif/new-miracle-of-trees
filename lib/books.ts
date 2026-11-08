import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Book } from "./types";

type CatalogResult<T> = { data: T; error: null } | { data: null; error: string };

const bookColumns = "id,slug,title,author,category,age,format,price,cover,accent,description,is_new,is_featured";

function createCatalogClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to load the catalog.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export async function getBooks(): Promise<CatalogResult<Book[]>> {
  try {
    const supabase = createCatalogClient();
    const books: Book[] = [];
    // Supabase limits each response to 1,000 rows by default.
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("books")
        .select(bookColumns)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (data?.length) {
        // One restricted stock lookup per catalog page, rather than one per card.
        const stock = await supabase.rpc("get_books_stock", { p_book_ids: data.map(book => book.id) });
        const quantities = new Map<string, number>();
        if (stock.error) {
          console.warn("Catalog stock is unavailable. Run supabase/migrations/20261108_public_book_stock.sql to enable stock ribbons.");
        } else if (Array.isArray(stock.data)) {
          for (const row of stock.data) {
            if (row && typeof row.book_id === "string" && Number.isInteger(row.quantity) && row.quantity >= 0) quantities.set(row.book_id, row.quantity);
          }
        }
        books.push(...data.map(book => ({ ...book, stock_quantity: quantities.get(book.id) ?? null })));
      }
      if (!data || data.length < pageSize) break;
    }
    return { data: books, error: null };
  } catch (error) {
    console.error("Unable to load the Supabase catalog:", error);
    return { data: null, error: "Koleksi buku belum dapat dimuat. Silakan coba lagi." };
  }
}

export async function getBook(slug: string): Promise<CatalogResult<Book | null>> {
  try {
    const supabase = createCatalogClient();
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .eq("status", "published")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error("Unable to load a Supabase book:", error);
    return { data: null, error: "Informasi buku belum dapat dimuat. Silakan coba lagi." };
  }
}

export async function getBookStock(bookId: string): Promise<number | null> {
  try {
    const supabase = createCatalogClient();
    const { data, error } = await supabase.rpc("get_book_stock", { p_book_id: bookId });
    if (error) {
      // Stock is optional: expected setup/network failures should not trigger
      // Next.js's development error overlay or prevent reading the book.
      console.warn(error.code === "PGRST202"
        ? "Public stock function is missing. Run supabase/migrations/20261108_public_book_stock.sql in Supabase SQL Editor."
        : `Public book stock is temporarily unavailable (${error.code ?? "unknown"}).`);
      return null;
    }
    return typeof data === "number" && Number.isInteger(data) && data >= 0 ? data : null;
  } catch {
    return null;
  }
}
