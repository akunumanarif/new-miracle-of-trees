/** Return a checksum-validated ISBN-13, including equivalent ISBN-10 editions. */
export function canonicalIsbn(input: string): string | null {
  const value = input.replace(/[\s-]/g, "").toUpperCase();
  const check13 = (body: string) => String((10 - [...body].reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10) % 10);
  if (/^\d{9}[\dX]$/.test(value)) {
    if ([...value].reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0) % 11) return null;
    const body = `978${value.slice(0, 9)}`;
    return body + check13(body);
  }
  if (/^97[89]\d{10}$/.test(value) && check13(value.slice(0, 12)) === value[12]) return value;
  return null;
}

export type IsbnMetadata = { title?: string; author?: string; description?: string; page_count?: string; publication_date?: string; format?: "Paperback" | "Hardback" | "Board Book" };
export function isbnCheckError(code?: string) {
  return code === "PGRST202" || code === "42883"
    ? "Scan ISBN belum siap: migrasi database ISBN belum tersedia. Minta pengelola menjalankan 20261109_isbn_scan.sql di Supabase, lalu coba lagi."
    : "Duplikat belum dapat diperiksa. Coba lagi atau tambah buku secara manual.";
}
export type IsbnLookup = { error: string } | { isbn: string; duplicate: { id: string; title: string } } | { isbn: string; metadata: IsbnMetadata; notice?: string; sources?: { name: string; url: string }[] };
