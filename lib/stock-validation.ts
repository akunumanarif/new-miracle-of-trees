export function parseStockOpname(form: FormData) {
  const bookId = form.get("bookId");
  const count = form.get("count");
  const version = form.get("version");
  const note = form.get("note");
  if (typeof bookId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookId)) {
    return { error: "Buku tidak valid." } as const;
  }
  if (typeof count !== "string" || !/^\d+$/.test(count) || Number(count) > 2147483647) {
    return { error: "Stok fisik harus berupa bilangan bulat antara 0 dan 2.147.483.647." } as const;
  }
  if (typeof version !== "string" || !/^\d+$/.test(version) || Number(version) > 2147483647) {
    return { error: "Versi stok tidak valid. Muat ulang halaman." } as const;
  }
  if (typeof note !== "string" || !note.trim() || note.trim().length > 500) {
    return { error: "Isi catatan opname, maksimal 500 karakter." } as const;
  }
  return { data: { bookId, count: Number(count), version: Number(version), note: note.trim() } } as const;
}
