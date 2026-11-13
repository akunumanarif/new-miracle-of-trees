const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const { File } = require("node:buffer");
const vm = require("node:vm");
const ts = require("typescript");
const sharp = require("sharp");
const { DOMParser } = require("linkedom");

function load(file, mocks = {}, env = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, Buffer, URL, ...globals, process: { env }, console: { error() {} }, require: name => {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

const validation = load("lib/book-validation.ts");
const isbnTools = load("lib/isbn.ts");
const imageUpload = load("lib/cover-upload.ts", { sharp, "./book-validation": validation });
const imageUrl = load("lib/cover.ts", {}, { NEXT_PUBLIC_SUPABASE_URL: "https://catalog.example.com" });
const id = "33333333-3333-4333-8333-333333333333";
function form(overrides = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: " Buku baru ", author: "Penulis", slug: "buku-baru", category: "Alam", age: "3–6 tahun", format: "Hardback", price: "99000", description: "Cerita anak\n\nParagraf kedua.", accent: "#173f8a", emoji: "📚", status: "draft", ...overrides })) data.set(key, value);
  return data;
}

test("book form validates required fields, trims text and preserves paragraphs", () => {
  const result = validation.parseBookForm(form({ is_new: "on" }));
  assert.equal(result.data.fields.title, "Buku baru");
  assert.equal(result.data.fields.price, 99000);
  assert.equal(result.data.fields.is_new, true);
  assert.equal(result.data.fields.is_featured, false);
  assert.match(result.data.fields.description, /\n\n/);
});

test("invalid book fields are rejected before a database write", () => {
  for (const values of [{ title: "" }, { author: " " }, { slug: "Buku / invalid" }, { price: "-1" }, { price: "1.5" }, { price: "2147483648" }, { status: "invalid" }, { format: "invalid" }, { accent: "url(foo)" }, { description: "" }, { id: "wrong" }, { id, revision: "-1" }, { emoji: "https://bad.com" }]) {
    assert.equal(typeof validation.parseBookForm(form(values)).error, "string", JSON.stringify(values));
  }
});

test("slug generation supports spaces, accents and punctuation", () => {
  assert.equal(validation.slugify(" Café & Petualangan Anak! "), "cafe-petualangan-anak");
  assert.ok(validation.slugify("x".repeat(200)).length <= 120);
});

test("optional publishing details are validated and saved without invented defaults", () => {
  const result = validation.parseBookForm(form({ isbn: "9781917044325", page_count: "16", publication_date: "2025-07-17", arrival_note: "Mei 2027", preorder_closes_on: "2026-11-11" }));
  assert.equal(result.data.fields.page_count, 16);
  assert.equal(result.data.fields.isbn, "9781917044325");
  assert.equal(result.data.fields.arrival_note, "Mei 2027");
  assert.equal(validation.parseBookForm(form()).data.fields.page_count, null);
  for (const values of [{ page_count: "0" }, { page_count: "2.5" }, { isbn: "abc" }, { publication_date: "2026-02-30" }, { preorder_closes_on: "not-a-date" }]) {
    assert.equal(typeof validation.parseBookForm(form(values)).error, "string");
  }
});

test("gallery accepts only uploaded photos from the configured bucket", () => {
  const parser = load("lib/book-validation.ts", {}, { NEXT_PUBLIC_SUPABASE_URL: "https://catalog.example.com" });
  const url = "https://catalog.example.com/storage/v1/object/public/book-covers/admin/photo.webp";
  assert.equal(parser.parseBookForm(form({ gallery_images: JSON.stringify([url, url]) })).data.fields.gallery_images.length, 1);
  for (const input of ["not-json", JSON.stringify(["https://other.example.com/evil.webp"]), JSON.stringify([1]), JSON.stringify(Array(5).fill(url))]) {
    assert.equal(typeof parser.parseBookForm(form({ gallery_images: input })).error, "string");
  }
});

test("cover URLs are limited to the configured public storage bucket", () => {
  assert.equal(imageUrl.getCoverImage("📚"), null);
  assert.equal(imageUrl.getCoverImage("javascript:alert(1)"), null);
  assert.equal(imageUrl.getCoverImage("https://other.example.com/cover.jpg"), null);
  assert.equal(imageUrl.getCoverImage("https://catalog.example.com/storage/v1/object/public/other/cover.webp"), null);
  const url = "https://catalog.example.com/storage/v1/object/public/book-covers/admin/cover.webp";
  assert.equal(imageUrl.getCoverImage(url), url);
});

test("valid images are decoded, resized and re-encoded as WebP", async () => {
  const original = await sharp({ create: { width: 1800, height: 2600, channels: 3, background: "#173f8a" } }).png().toBuffer();
  const file = new File([original], "cover.png", { type: "image/png" });
  const prepared = await imageUpload.prepareCover(file);
  const metadata = await sharp(prepared).metadata();
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width <= 1600);
  assert.ok(metadata.height <= 2200);
});

test("corrupt files and spoofed images cannot be uploaded", async () => {
  await assert.rejects(imageUpload.prepareCover(new File(["not an image"], "fake.png", { type: "image/png" })), /Gambar tidak dapat dibaca/);
  await assert.rejects(imageUpload.prepareCover(new File(["<svg/>"], "cover.svg", { type: "image/svg+xml" })), /JPG, PNG/);
  await assert.rejects(imageUpload.prepareCover(new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })), /maksimal 5 MB/);
});

function actions({ authorize, result = { data: { id }, error: null }, existing, uploadError = null, duplicate = { data: [], error: null } } = {}) {
  const calls = { writes: [], uploads: [], removals: [], revalidated: [] };
  const bucket = {
    upload: async (...args) => { calls.uploads.push(args); return { error: uploadError }; },
    getPublicUrl: path => ({ data: { publicUrl: `https://catalog.example.com/storage/v1/object/public/book-covers/${path}` } }),
    remove: async paths => { calls.removals.push(paths); return { error: null }; },
  };
  const chain = { eq: () => chain, select: () => chain, maybeSingle: async () => result, single: async () => result };
  const client = {
    rpc: async () => duplicate,
    storage: { from: () => bucket },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      insert: fields => { calls.writes.push(fields); return chain; },
      update: fields => { calls.writes.push(fields); return chain; },
    }),
  };
  const api = load("app/admin/books/actions.ts", {
    "node:crypto": { randomUUID: () => "44444444-4444-4444-8444-444444444444" },
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath: path => calls.revalidated.push(path) },
    "@/lib/admin": { requireAdmin: authorize ?? (async () => ({ supabase: client, user: { id: "admin-id" } })) },
    "@/lib/book-validation": validation,
    "@/lib/cover-upload": imageUpload,
    "@/lib/isbn": isbnTools,
  });
  return { ...api, calls };
}

test("ISBN validation checks checksums, book prefixes and equivalent ISBN-10 editions", () => {
  assert.equal(isbnTools.canonicalIsbn("0-306-40615-2"), "9780306406157");
  assert.equal(isbnTools.canonicalIsbn(" 978-0-306-40615-7 "), "9780306406157");
  assert.equal(isbnTools.canonicalIsbn("080442957X"), "9780804429573");
  for (const input of ["9780306406158", "1234567890128", "0306406153", "garbage", ""]) {
    assert.equal(isbnTools.canonicalIsbn(input), null, input);
  }
});

test("scanned duplicates and failed duplicate checks never upload or save", async () => {
  for (const duplicate of [{ data: [{ id, title: "Existing" }], error: null }, { data: null, error: { code: "network" } }]) {
    const api = actions({ duplicate });
    assert.ok((await api.saveBook({}, form({ isbn: "9780306406157", created_via_isbn_scan: "on" }))).error);
    assert.equal(api.calls.writes.length, 0);
    assert.equal(api.calls.uploads.length, 0);
  }
});

test("scanned creates require a valid ISBN and retain their origin for database protection", async () => {
  const invalid = actions();
  assert.match((await invalid.saveBook({}, form({ isbn: "9780306406158", created_via_isbn_scan: "on" }))).error, /tidak valid/);
  assert.equal(invalid.calls.writes.length, 0);
  const api = actions();
  await assert.rejects(api.saveBook({}, form({ isbn: "0-306-40615-2", created_via_isbn_scan: "on" })), /saved=created/);
  assert.equal(api.calls.writes[0].created_via_isbn_scan, true);
  assert.equal(api.calls.writes[0].isbn, "9780306406157");
});

test("manual creation allows reviewed duplicate ISBNs", async () => {
  const api = actions({ duplicate: { data: [{ id }], error: null } });
  await assert.rejects(api.saveBook({}, form({ isbn: "9780306406157" })), /saved=created/);
  assert.equal(api.calls.writes[0].created_via_isbn_scan, undefined);
});

test("database duplicate races return the manual-entry instruction", async () => {
  const api = actions({ result: { data: null, error: { code: "23505", message: "ISBN already exists; add manually" } } });
  assert.match((await api.saveBook({}, form({ isbn: "9780306406157", created_via_isbn_scan: "on" }))).error, /Tambah manual/);
});

function isbnLookup({ duplicate = { data: [], error: null }, fetch: fetchMock, authorize } = {}) {
  const metadataApi = load("lib/book-metadata.ts", { "./isbn": isbnTools, linkedom: { DOMParser } }, {}, { fetch: fetchMock, AbortSignal });
  return load("app/admin/books/isbn-actions.ts", {
    "@/lib/admin": { requireAdmin: authorize ?? (async () => ({ supabase: { rpc: async () => duplicate } })) },
    "@/lib/isbn": isbnTools,
    "@/lib/book-metadata": metadataApi,
  }, {}, { fetch: fetchMock, AbortSignal });
}

test("ISBN lookup requires admin and never calls metadata provider for duplicates or check errors", async () => {
  const denied = isbnLookup({ authorize: async () => { throw new Error("LOGIN_REQUIRED"); } });
  await assert.rejects(denied.lookupBookIsbn("9780306406157"), /LOGIN_REQUIRED/);
  let fetches = 0;
  const fetch = async () => { fetches++; throw new Error("Should not fetch"); };
  const duplicate = await isbnLookup({ duplicate: { data: [{ id, title: "Existing" }], error: null }, fetch }).lookupBookIsbn("0-306-40615-2");
  assert.equal(duplicate.duplicate.id, id);
  assert.ok((await isbnLookup({ duplicate: { data: null, error: {} }, fetch }).lookupBookIsbn("9780306406157")).error);
  assert.ok((await isbnLookup({ fetch }).lookupBookIsbn("9780306406158")).error);
  assert.equal(fetches, 0);
});

test("ISBN metadata only accepts an exact equivalent edition and complete publication dates", async () => {
  const api = isbnLookup({ fetch: async () => ({ ok: true, json: async () => ({ items: [
    { volumeInfo: { title: "Wrong edition", industryIdentifiers: [{ identifier: "9780804429573" }] } },
    { volumeInfo: { title: "Correct edition", authors: ["Author"], description: "<p>Story</p>", publishedDate: "2025", pageCount: 32, industryIdentifiers: [{ identifier: "0306406152" }] } },
  ] }) }) });
  const result = await api.lookupBookIsbn("9780306406157");
  assert.equal(result.metadata.title, "Correct edition");
  assert.equal(result.metadata.description, "Story");
  assert.equal(result.metadata.page_count, "32");
  assert.equal(result.metadata.publication_date, undefined);
});

const isbnSearchHtml = (isbn = "9781838742270") => `<div class="bookinfo"><h1>Tummy Trouble &amp; Friends</h1>
  <p><strong>ISBN-13:</strong> <a href="/isbn/${isbn}">${isbn}</a></p>
  <p><strong>Author:</strong> Elcomb, Ben</p><p><strong>Binding:</strong> Hardcover</p>
  <p><strong>Publisher:</strong> Flying Eye Books</p><p><strong>Published:</strong> 2026-01-08</p></div>`;

test("Google misses and provider failures fall back to ISBN Search in order", async () => {
  for (const google of [async () => ({ ok: true, json: async () => ({ totalItems: 0 }) }), async () => ({ ok: false, status: 429 }), async () => { throw new Error("timeout"); }]) {
    const calls = [];
    const api = isbnLookup({ fetch: async url => {
      calls.push(url);
      if (url.includes("googleapis.com")) return google();
      assert.equal(url, "https://isbnsearch.org/isbn/9781838742270");
      return { ok: true, text: async () => isbnSearchHtml() };
    } });
    const result = await api.lookupBookIsbn("9781838742270");
    assert.equal(calls.length, 2);
    assert.ok(calls[0].includes("googleapis.com"));
    assert.equal(result.metadata.title, "Tummy Trouble & Friends");
    assert.equal(result.metadata.author, "Elcomb, Ben");
    assert.equal(result.metadata.format, "Hardback");
    assert.equal(result.metadata.publication_date, "2026-01-08");
    assert.equal(result.metadata.description, undefined);
    assert.equal(result.metadata.page_count, undefined);
    assert.equal(result.sources[0].name, "ISBN Search");
  }
});

test("a Google ISBN match with a title does not request the fallback", async () => {
  let fetches = 0;
  const api = isbnLookup({ fetch: async url => {
    fetches++;
    assert.ok(url.includes("googleapis.com"));
    return { ok: true, json: async () => ({ items: [{ volumeInfo: { title: "Google title", industryIdentifiers: [{ identifier: "9781838742270" }] } }] }) };
  } });
  const result = await api.lookupBookIsbn("9781838742270");
  assert.equal(result.metadata.title, "Google title");
  assert.equal(fetches, 1);
  assert.equal(result.sources[0].name, "Google Books");
});

test("fallback rejects mismatched ISBNs, block pages, oversized pages and network errors", async () => {
  const fallbacks = [
    async () => ({ ok: true, text: async () => isbnSearchHtml("9780306406157") }),
    async () => ({ ok: true, text: async () => "<h1>Verify you are human</h1>" }),
    async () => ({ ok: true, text: async () => "x".repeat(2000001) }),
    async () => ({ ok: false, status: 404 }),
    async () => { throw new Error("timeout"); },
  ];
  for (const fallback of fallbacks) {
    const result = await isbnLookup({ fetch: async url => url.includes("googleapis.com") ? { ok: true, json: async () => ({ items: [] }) } : fallback() }).lookupBookIsbn("9781838742270");
    assert.equal(result.isbn, "9781838742270");
    assert.equal(Object.keys(result.metadata).length, 0);
    assert.equal(result.sources.length, 0);
    assert.match(result.notice, /manual/);
  }
});

test("fallback accepts equivalent ISBN-10 and returns only inert text", async () => {
  const result = await isbnLookup({ fetch: async url => url.includes("googleapis.com") ? { ok: true, json: async () => ({ items: [] }) } : {
    ok: true, text: async () => `<div class="bookinfo"><h1>Book<script>malicious()</script></h1><p><strong>ISBN-10:</strong>1838742271</p><p><strong>Binding:</strong>Paperback</p><p><strong>Published:</strong>2026</p></div>`,
  } }).lookupBookIsbn("9781838742270");
  assert.equal(result.metadata.title, "Book");
  assert.equal(result.metadata.format, "Paperback");
  assert.equal(result.metadata.publication_date, undefined);
});

test("ISBN Search browser verification is reported as manual completion without retries", async () => {
  let calls = 0;
  const result = await isbnLookup({ fetch: async url => {
    calls++;
    return url.includes("googleapis.com") ? { ok: true, json: async () => ({ items: [] }) } : {
      ok: true, text: async () => "<html><head><title>ISBN Search - Checking your browser</title></head><body>Please wait</body></html>",
    };
  } }).lookupBookIsbn("9781838742270");
  assert.equal(calls, 2);
  assert.equal(Object.keys(result.metadata).length, 0);
  assert.match(result.notice, /verifikasi browser/);
  assert.match(result.notice, /manual/);
});

test("missing ISBN migration produces setup instructions instead of a book-not-found result", async () => {
  const duplicate = { data: null, error: { code: "PGRST202" } };
  const result = await isbnLookup({ duplicate }).lookupBookIsbn("9781838919443");
  assert.match(result.error, /20261109_isbn_scan.sql/);
  assert.equal(result.metadata, undefined);
  const api = actions({ duplicate });
  assert.match((await api.saveBook({}, form({ isbn: "9781838919443", created_via_isbn_scan: "on" }))).error, /20261109_isbn_scan.sql/);
  assert.equal(api.calls.writes.length, 0);
});

test("metadata outages and missing editions retain the checked ISBN for manual completion", async () => {
  for (const fetch of [async () => { throw new Error("timeout"); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ items: [] }) })]) {
    const result = await isbnLookup({ fetch }).lookupBookIsbn("9780306406157");
    assert.equal(result.isbn, "9780306406157");
    assert.equal(Object.keys(result.metadata).length, 0);
    assert.ok(result.notice);
  }
});

test("book mutation refuses unauthenticated requests", async () => {
  const api = actions({ authorize: async () => { throw new Error("LOGIN_REQUIRED"); } });
  await assert.rejects(api.saveBook({}, form()), /LOGIN_REQUIRED/);
  assert.equal(api.calls.writes.length, 0);
});

test("create saves book fields and redirects with a success message", async () => {
  const api = actions();
  await assert.rejects(api.saveBook({}, form()), /REDIRECT:\/admin\/books\?saved=created/);
  assert.equal(api.calls.writes[0].title, "Buku baru");
  assert.equal(api.calls.writes[0].cover, "📚");
  assert.ok(api.calls.revalidated.includes("/buku/buku-baru"));
});

test("edit preserves the cover and invalidates both old and new slugs", async () => {
  const cover = "https://catalog.example.com/storage/v1/object/public/book-covers/old.webp";
  const api = actions({ existing: { cover, slug: "old-slug", revision: 1 } });
  await assert.rejects(api.saveBook({}, form({ id, revision: "1" })), /saved=updated/);
  assert.equal(api.calls.writes[0].cover, cover);
  assert.ok(api.calls.revalidated.includes("/buku/old-slug"));
  assert.ok(api.calls.revalidated.includes("/buku/buku-baru"));
});

test("stale edits do not upload or save anything", async () => {
  const api = actions({ existing: { cover: "📚", slug: "old", revision: 2 } });
  assert.match((await api.saveBook({}, form({ id, revision: "1" }))).error, /diubah admin lain/);
  assert.equal(api.calls.writes.length, 0);
  assert.equal(api.calls.uploads.length, 0);
});

test("an optimistic concurrency conflict during update returns an error", async () => {
  const api = actions({ existing: { cover: "📚", slug: "old", revision: 1 }, result: { data: null, error: null } });
  assert.match((await api.saveBook({}, form({ id, revision: "1" }))).error, /diubah admin lain/);
});

test("duplicate slugs report a useful validation error", async () => {
  const api = actions({ result: { data: null, error: { code: "23505" } } });
  assert.match((await api.saveBook({}, form())).error, /Slug sudah digunakan/);
});

test("failed database writes clean up a new upload; successful writes use its URL", async () => {
  const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  const input = form(); input.set("coverFile", new File([original], "cover.png", { type: "image/png" }));
  const failed = actions({ result: { data: null, error: { code: "23505" } } });
  assert.match((await failed.saveBook({}, input)).error, /Slug sudah digunakan/);
  assert.equal(failed.calls.uploads.length, 1);
  assert.equal(failed.calls.removals.length, 1);
  const saved = actions();
  await assert.rejects(saved.saveBook({}, input), /saved=created/);
  assert.match(saved.calls.writes[0].cover, /book-covers\/admin-id\/.*\.webp$/);
  assert.equal(saved.calls.removals.length, 0);
});

test("upload failures never write a book with a broken cover URL", async () => {
  const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  const input = form(); input.set("coverFile", new File([original], "cover.png", { type: "image/png" }));
  const api = actions({ uploadError: { message: "Bucket missing" } });
  assert.match((await api.saveBook({}, input)).error, /Upload sampul gagal/);
  assert.equal(api.calls.writes.length, 0);
});

test("uncertain transport failures retain images that may already be referenced", async () => {
  const original = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  const input = form(); input.set("coverFile", new File([original], "cover.png", { type: "image/png" }));
  const api = actions({ result: { data: null, error: { code: "", message: "Fetch failed" } } });
  assert.ok((await api.saveBook({}, input)).error);
  assert.equal(api.calls.removals.length, 0);
});

test("removing a cover restores the chosen emoji", async () => {
  const api = actions({ existing: { cover: "https://catalog.example.com/storage/v1/object/public/book-covers/old.webp", slug: "old", revision: 1 } });
  await assert.rejects(api.saveBook({}, form({ id, revision: "1", removeCover: "on", emoji: "🌿" })), /saved=updated/);
  assert.equal(api.calls.writes[0].cover, "🌿");
});

test("gallery uploads require admin authentication", async () => {
  const api = load("app/admin/books/media-actions.ts", {
    "node:crypto": { randomUUID: () => "photo-id" },
    "@/lib/admin": { requireAdmin: async () => { throw new Error("LOGIN_REQUIRED"); } },
    "@/lib/cover-upload": imageUpload,
  });
  await assert.rejects(api.uploadBookPhoto(new FormData()), /LOGIN_REQUIRED/);
});

test("gallery upload validates the image and returns a public URL in the admin folder", async () => {
  let uploaded;
  const bucket = {
    upload: async (path, data) => { uploaded = { path, data }; return { error: null }; },
    getPublicUrl: path => ({ data: { publicUrl: `https://catalog.example.com/storage/v1/object/public/book-covers/${path}` } }),
  };
  const api = load("app/admin/books/media-actions.ts", {
    "node:crypto": { randomUUID: () => "photo-id" },
    "@/lib/admin": { requireAdmin: async () => ({ user: { id: "admin-id" }, supabase: { storage: { from: () => bucket } } }) },
    "@/lib/cover-upload": imageUpload,
  });
  const photo = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).png().toBuffer();
  const input = new FormData(); input.set("photo", new File([photo], "page.png", { type: "image/png" }));
  const result = await api.uploadBookPhoto(input);
  assert.match(result.url, /book-covers\/admin-id\/photo-id.webp$/);
  assert.equal(uploaded.path, "admin-id/photo-id.webp");
  assert.equal((await sharp(uploaded.data).metadata()).format, "webp");
});
