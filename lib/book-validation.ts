export const bookFormats = ["Paperback", "Hardback", "Board Book"] as const;
export const bookStatuses = ["draft", "published", "archived"] as const;
export const maxCoverBytes = 5 * 1024 * 1024;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120).replace(/-$/, "");
}

export function parseBookForm(form: FormData) {
  const text = (name: string) => typeof form.get(name) === "string" ? (form.get(name) as string).trim() : "";
  const id = text("id");
  const revision = text("revision");
  if (id && (!uuidPattern.test(id) || !/^\d+$/.test(revision) || Number(revision) > 2147483647)) {
    return { error: "Data buku tidak valid. Muat ulang halaman." } as const;
  }
  const title = text("title"), author = text("author"), slug = text("slug");
  const category = text("category"), age = text("age"), description = text("description");
  if (!title || title.length > 200) return { error: "Isi judul buku, maksimal 200 karakter." } as const;
  if (!author || author.length > 150) return { error: "Isi nama penulis, maksimal 150 karakter." } as const;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return { error: "Slug wajib diisi dengan huruf kecil, angka, dan tanda hubung (maksimal 120 karakter)." } as const;
  if (!category || category.length > 100 || !age || age.length > 100) return { error: "Isi kategori dan usia pembaca, masing-masing maksimal 100 karakter." } as const;
  if (!description || description.length > 10000) return { error: "Isi deskripsi buku, maksimal 10.000 karakter." } as const;
  const format = text("format"), status = text("status"), price = text("price"), accent = text("accent");
  if (!(bookFormats as readonly string[]).includes(format) || !(bookStatuses as readonly string[]).includes(status)) return { error: "Pilih format dan status buku yang tersedia." } as const;
  if (!/^\d+$/.test(price) || Number(price) > 2147483647) return { error: "Harga harus berupa rupiah bulat antara 0 dan 2.147.483.647." } as const;
  if (!/^#[0-9a-f]{6}$/i.test(accent)) return { error: "Pilih warna sampul yang valid." } as const;
  const emoji = text("emoji") || "📚";
  if (Array.from(emoji).length > 12 || /[<>:/\\]/.test(emoji)) return { error: "Ilustrasi pengganti maksimal 12 karakter, gunakan emoji atau teks pendek." } as const;
  const isbn = text("isbn"), pages = text("page_count"), arrival = text("arrival_note");
  const publicationDate = text("publication_date"), closeDate = text("preorder_closes_on");
  if (isbn && (!/^[\dXx -]+$/.test(isbn) || ![10, 13].includes(isbn.replace(/[ -]/g, "").length))) return { error: "ISBN harus terdiri dari 10 atau 13 karakter angka (boleh menggunakan tanda hubung)." } as const;
  if (pages && (!/^\d+$/.test(pages) || Number(pages) < 1 || Number(pages) > 100000)) return { error: "Jumlah halaman harus berupa angka antara 1 dan 100.000." } as const;
  if (arrival.length > 100) return { error: "Keterangan estimasi kedatangan maksimal 100 karakter." } as const;
  for (const date of [publicationDate, closeDate]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return { error: "Tanggal buku tidak valid." } as const;
  }
  let gallery: string[];
  try {
    const raw = JSON.parse(text("gallery_images") || "[]");
    if (!Array.isArray(raw) || raw.length > 4 || raw.some(item => typeof item !== "string" || item.length > 2048)) throw new Error("Invalid gallery");
    for (const item of raw) {
      const image = new URL(item);
      const project = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!project || image.origin !== new URL(project).origin || !image.pathname.startsWith("/storage/v1/object/public/book-covers/")) throw new Error("Invalid image URL");
    }
    gallery = Array.from(new Set(raw));
  } catch { return { error: "Galeri tidak valid. Gunakan maksimal 4 foto yang diupload melalui form ini." } as const; }
  return { data: {
    id, revision: Number(revision || 0), removeCover: form.get("removeCover") === "on", emoji,
    fields: { title, author, slug, category, age, description, format, status, price: Number(price), accent,
      isbn: isbn || null, page_count: pages ? Number(pages) : null, publication_date: publicationDate || null,
      arrival_note: arrival || null, preorder_closes_on: closeDate || null, gallery_images: gallery,
      is_new: form.get("is_new") === "on", is_featured: form.get("is_featured") === "on" },
  } } as const;
}
