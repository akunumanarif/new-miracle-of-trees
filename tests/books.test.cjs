const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the real Supabase SDK with an isolated environment and mocked HTTP.
// Next.js normally resolves the server-only marker during compilation.
const source = ts.transpileModule(readFileSync(resolve(__dirname, "../lib/books.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function catalog(respond, env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://catalog.example.com",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
}) {
  const requests = [];
  const warnings = [];
  const errors = [];
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => name === "server-only" ? {} : require(name),
    process: { env },
    console: { error: (...args) => errors.push(args), warn: (...args) => warnings.push(args) },
    fetch: async (input, init) => {
      const url = new URL(input);
      requests.push({ url, init });
      const { data, status = 200 } = respond(url);
      return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    },
  });
  return { ...exports, requests, warnings, errors };
}

const book = { id: "uuid-1", slug: "buku-database", title: "Buku dari database", price: 99000 };

test("catalog reads published books without caching", async () => {
  const api = catalog(() => ({ data: [book] }));
  const result = await api.getBooks();
  assert.equal(result.error, null);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), [{ ...book, stock_quantity: null }]);
  const { url, init } = api.requests[0];
  assert.equal(url.pathname, "/rest/v1/books");
  assert.equal(url.searchParams.get("status"), "eq.published");
  assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
  assert.equal(init.cache, "no-store");
});

test("empty database stays empty instead of showing demo books", async () => {
  const result = await catalog(() => ({ data: [] })).getBooks();
  assert.equal(result.error, null);
  assert.equal(result.data.length, 0);
});

test("missing configuration returns an error without making a request", async () => {
  const api = catalog(() => assert.fail("Unexpected HTTP request"), {});
  assert.equal((await api.getBooks()).data, null);
  assert.equal(typeof (await api.getBook("missing")).error, "string");
  assert.equal(api.requests.length, 0);
});

test("database errors stay distinct from an empty catalog or missing book", async () => {
  const api = catalog(() => ({ status: 403, data: { message: "permission denied", code: "42501" } }));
  for (const result of [await api.getBooks(), await api.getBook("restricted")]) {
    assert.equal(result.data, null);
    assert.equal(typeof result.error, "string");
    assert.equal(result.error.includes("permission denied"), false);
  }
});

test("detail queries a single published slug directly", async () => {
  const api = catalog(() => ({ data: [book] }));
  const result = await api.getBook(book.slug);
  assert.deepEqual(result.data, book);
  assert.equal(result.error, null);
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].url.searchParams.get("slug"), `eq.${book.slug}`);
  assert.equal(api.requests[0].url.searchParams.get("status"), "eq.published");
});

test("missing or unpublished detail returns null without an error", async () => {
  const result = await catalog(() => ({ data: [] })).getBook("missing");
  assert.equal(result.data, null);
  assert.equal(result.error, null);
});

test("catalog retrieves books beyond Supabase's default 1,000-row limit", async () => {
  const firstPage = Array.from({ length: 1000 }, (_, index) => ({ ...book, id: `uuid-${index}` }));
  const api = catalog((url) => ({ data: url.searchParams.get("offset") === "0" ? firstPage : [book] }));
  const result = await api.getBooks();
  assert.equal(result.error, null);
  assert.equal(result.data.length, 1001);
  const catalogRequests = api.requests.filter(request => request.url.pathname === "/rest/v1/books");
  assert.equal(catalogRequests.length, 2);
  assert.equal(catalogRequests[1].url.searchParams.get("offset"), "1000");
});

test("public stock uses the restricted RPC and preserves exact quantities", async () => {
  for (const quantity of [0, 1, 2, 3, 15]) {
    const api = catalog(() => ({ data: quantity }));
    assert.equal(await api.getBookStock(book.id), quantity);
    assert.equal(api.requests[0].url.pathname, "/rest/v1/rpc/get_book_stock");
    assert.equal(JSON.parse(api.requests[0].init.body).p_book_id, book.id);
    assert.equal(api.requests[0].init.cache, "no-store");
  }
});

test("stock errors, missing migration and invalid data never appear as zero or low stock", async () => {
  for (const data of [null, -1, "2", 1.5]) {
    assert.equal(await catalog(() => ({ data })).getBookStock(book.id), null);
  }
  assert.equal(await catalog(() => ({ status: 404, data: { code: "PGRST202", message: "Missing function" } })).getBookStock(book.id), null);
});

test("missing stock migration produces actionable warning without a development error overlay", async () => {
  const api = catalog(() => ({ status: 404, data: { code: "PGRST202", message: "Missing function" } }));
  assert.equal(await api.getBookStock(book.id), null);
  assert.equal(api.errors.length, 0);
  assert.equal(api.warnings.length, 1);
  assert.match(api.warnings[0][0], /20261108_public_book_stock.sql/);
});

test("catalog attaches exact quantities with one batch request", async () => {
  const entries = [1, 2, 3, 4].map(quantity => ({ ...book, id: `book-${quantity}` }));
  const api = catalog(url => ({ data: url.pathname === "/rest/v1/books" ? entries : entries.map((entry, index) => ({ book_id: entry.id, quantity: index + 1 })) }));
  const result = await api.getBooks();
  assert.deepEqual(Array.from(result.data, entry => entry.stock_quantity), [1, 2, 3, 4]);
  assert.equal(api.requests.length, 2);
  assert.equal(api.requests[1].url.pathname, "/rest/v1/rpc/get_books_stock");
  assert.deepEqual(JSON.parse(api.requests[1].init.body).p_book_ids, entries.map(entry => entry.id));
});

test("missing batch migration leaves the catalog available without inventing urgency", async () => {
  const api = catalog(url => url.pathname === "/rest/v1/books" ? { data: [book] } : { status: 404, data: { code: "PGRST202" } });
  const result = await api.getBooks();
  assert.equal(result.error, null);
  assert.equal(result.data[0].stock_quantity, null);
  assert.equal(api.errors.length, 0);
});

test("stock ribbons use the agreed integer boundaries and hide unknown stock", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "../components/book-stock-ribbon.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require });
  for (const [quantity, label] of [[0, "Stok habis"], [1, "Wah, tinggal 1 nih!"], [2, "Hampir habis, amankan sekarang!"], [3, "Hampir habis, amankan sekarang!"], [4, "Ready Stock"]]) {
    assert.ok(renderToStaticMarkup(React.createElement(exports.default, { quantity })).includes(label));
  }
  for (const quantity of [null, undefined, -1, 1.5]) {
    assert.equal(renderToStaticMarkup(React.createElement(exports.default, { quantity })), "");
  }
});
