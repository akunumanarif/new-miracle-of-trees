const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, mocks = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(resolve(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, console: { error() {} }, require: name => {
    if (name === "server-only") return {};
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

const redirect = path => { throw new Error(`REDIRECT:${path}`); };
function authGuard(user, membership, userError = null) {
  return load("lib/admin.ts", {
    "next/navigation": { redirect },
    "./supabase/server": { createAuthClient: async () => ({
      auth: { getUser: async () => ({ data: { user }, error: userError }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => membership }) }) }),
    }) },
  });
}

test("admin routes redirect unauthenticated or invalid sessions", async () => {
  await assert.rejects(authGuard(null).requireAdmin(), /REDIRECT:\/admin\/login$/);
  await assert.rejects(authGuard({ id: "forged" }, null, { message: "Invalid token" }).requireAdmin(), /REDIRECT:\/admin\/login$/);
});

test("an authenticated regular user cannot enter admin", async () => {
  await assert.rejects(authGuard({ id: "member" }, { data: null, error: null }).requireAdmin(), /reason=forbidden/);
});

test("admin membership check fails closed on database errors", async () => {
  await assert.rejects(authGuard({ id: "member" }, { data: null, error: { message: "missing table" } }).requireAdmin(), /migrasi/);
});

test("verified admins may enter", async () => {
  const result = await authGuard({ id: "admin" }, { data: { user_id: "admin" }, error: null }).requireAdmin();
  assert.equal(result.user.id, "admin");
});

const { parseStockOpname } = load("lib/stock-validation.ts");
function form(overrides = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ bookId: "33333333-3333-4333-8333-333333333333", count: "0", version: "0", note: " Hitung fisik ", ...overrides })) result.set(key, value);
  return result;
}

test("stock form accepts zero and trims notes", () => {
  const result = parseStockOpname(form());
  assert.equal(result.data.count, 0);
  assert.equal(result.data.note, "Hitung fisik");
});

test("stock form rejects malformed IDs, quantities, versions and notes", () => {
  for (const values of [{ bookId: "bad-id" }, { count: "" }, { count: "-1" }, { count: "1.5" }, { count: "1e3" }, { count: "2147483648" }, { version: "-1" }, { note: " " }, { note: "x".repeat(501) }]) {
    assert.equal(typeof parseStockOpname(form(values)).error, "string", JSON.stringify(values));
  }
});

function actions(requireAdmin, client = {}) {
  const revalidated = [];
  return { revalidated, ...load("app/admin/actions.ts", {
    "next/navigation": { redirect },
    "next/cache": { revalidatePath: path => revalidated.push(path) },
    "@/lib/supabase/server": { createAuthClient: async () => client },
    "@/lib/admin": { requireAdmin },
    "@/lib/stock-validation": { parseStockOpname },
  }) };
}

test("stock server action verifies authorization before any mutation", async () => {
  const api = actions(async () => { throw new Error("UNAUTHORIZED"); });
  await assert.rejects(api.saveStockOpname({}, form()), /UNAUTHORIZED/);
  assert.equal(api.revalidated.length, 0);
});

test("stock action reports a stale version and does not revalidate", async () => {
  const api = actions(async () => ({ supabase: { rpc: async () => ({ error: { code: "40001" } }) } }));
  assert.match((await api.saveStockOpname({}, form())).error, /Stok sudah berubah/);
  assert.equal(api.revalidated.length, 0);
});

test("stock action sends the validated count to the transaction and refreshes admin", async () => {
  let sent;
  const api = actions(async () => ({ supabase: { rpc: async (name, args) => { sent = { name, args }; return { error: null }; } } }));
  assert.ok((await api.saveStockOpname({}, form())).success);
  assert.equal(sent.name, "record_stock_opname");
  assert.equal(sent.args.p_count, 0);
  assert.equal(sent.args.p_expected_version, 0);
  assert.equal(sent.args.p_note, "Hitung fisik");
  assert.deepEqual(api.revalidated, ["/admin"]);
});

test("failed login returns a generic error", async () => {
  const api = actions(null, { auth: { signInWithPassword: async () => ({ data: {}, error: { message: "Invalid credentials" } }) } });
  const input = new FormData(); input.set("email", "admin@example.com"); input.set("password", "wrong-password");
  assert.match((await api.login({}, input)).error, /Login gagal/);
});

test("successful Auth login without admin membership is signed out", async () => {
  let signedOut = false;
  const api = actions(null, {
    auth: { signInWithPassword: async () => ({ data: { user: { id: "member" } }, error: null }), signOut: async () => { signedOut = true; return { error: null }; } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  });
  const input = new FormData(); input.set("email", "member@example.com"); input.set("password", "password");
  assert.match((await api.login({}, input)).error, /belum diberi akses/);
  assert.equal(signedOut, true);
});

test("verified admin login redirects to the inventory page", async () => {
  const api = actions(null, {
    auth: { signInWithPassword: async () => ({ data: { user: { id: "admin" } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: "admin" }, error: null }) }) }) }),
  });
  const input = new FormData(); input.set("email", "admin@example.com"); input.set("password", "password");
  await assert.rejects(api.login({}, input), /REDIRECT:\/admin$/);
});

test("logout clears the current Supabase session and returns to login", async () => {
  let scope;
  const api = actions(null, { auth: { signOut: async options => { scope = options.scope; return { error: null }; } } });
  await assert.rejects(api.logout(), /REDIRECT:\/admin\/login$/);
  assert.equal(scope, "local");
});
