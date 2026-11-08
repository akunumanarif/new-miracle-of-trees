const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { before, after, test } = require("node:test");
const { PGlite } = require("@electric-sql/pglite");

let db;
const adminId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to anon, authenticated;
  `);
  await db.exec(readFileSync(resolve(__dirname, "../supabase/schema.sql"), "utf8"));
  const migration = readFileSync(resolve(__dirname, "../supabase/migrations/20261108_admin_inventory.sql"), "utf8");
  await db.exec(migration);
  await db.exec(migration); // Safe to run again on an existing installation.
  await db.query("insert into auth.users values ($1, 'admin@example.com'), ($2, 'member@example.com')", [adminId, memberId]);
  await db.query("insert into public.admin_users(user_id) values ($1)", [adminId]);
  await db.query(`insert into public.books(id,slug,title,author,category,age,format,price,description,status)
    values ($1,'inventory-book','Buku uji','Penulis','Alam','3–6 tahun','Hardback',99000,'Deskripsi','draft')`, [bookId]);
});

after(async () => { await db?.close(); });

async function asUser(id, work) {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [id ?? "", JSON.stringify({ email: id === adminId ? "admin@example.com" : "member@example.com" })]);
  try { return await work(); } finally { await db.exec("reset role"); }
}

const record = (count, version, note = "Hitung rak A") => db.query(
  "select public.record_stock_opname($1, $2, $3, $4)", [bookId, count, version, note]
);

test("anonymous visitors cannot read stock, history, or admin membership", async () => {
  await asUser(null, async () => {
    for (const table of ["inventory", "stock_opnames", "admin_users"]) {
      await assert.rejects(db.query(`select * from public.${table}`), { code: "42501" });
    }
    await assert.rejects(record(5, 0), { code: "42501" });
    assert.equal((await db.query("select * from public.books")).rows.length, 0);
  });
});

test("regular accounts cannot grant themselves admin access or record stock", async () => {
  await asUser(memberId, async () => {
    assert.equal((await db.query("select * from public.admin_users")).rows.length, 0);
    assert.equal((await db.query("select * from public.inventory")).rows.length, 0);
    await assert.rejects(db.query("insert into public.admin_users(user_id) values ($1)", [memberId]), { code: "42501" });
    await assert.rejects(record(5, 0), { code: "42501", message: "ADMIN_REQUIRED" });
    assert.equal((await db.query("select * from public.books")).rows.length, 0);
  });
});

test("admins can read draft books and their own membership", async () => {
  await asUser(adminId, async () => {
    assert.equal((await db.query("select * from public.books")).rows.length, 1);
    assert.equal((await db.query("select * from public.admin_users")).rows.length, 1);
  });
});

test("first opname initializes stock and writes a complete audit record", async () => {
  await asUser(adminId, async () => {
    await record(5, 0);
    const stock = (await db.query("select * from public.inventory")).rows[0];
    assert.equal(stock.quantity, 5);
    assert.equal(stock.version, 1);
    const log = (await db.query("select * from public.stock_opnames")).rows[0];
    assert.equal(log.previous_quantity, 0);
    assert.equal(log.counted_quantity, 5);
    assert.equal(log.difference, 5);
    assert.equal(log.book_title, "Buku uji");
    assert.equal(log.performed_by, adminId);
    assert.equal(log.performed_by_email, "admin@example.com");
  });
});

test("even admins cannot bypass the audit by writing tables directly", async () => {
  await asUser(adminId, async () => {
    await assert.rejects(db.query("update public.inventory set quantity = 100"), { code: "42501" });
    await assert.rejects(db.query("delete from public.stock_opnames"), { code: "42501" });
  });
});

test("a stale version cannot overwrite a newer count", async () => {
  await asUser(adminId, async () => {
    await assert.rejects(record(99, 0), { code: "40001", message: "STOCK_CONFLICT" });
    assert.equal((await db.query("select quantity from public.inventory")).rows[0].quantity, 5);
    assert.equal((await db.query("select * from public.stock_opnames")).rows.length, 1);
  });
});

test("negative, missing, and unannotated counts are rejected in the database", async () => {
  await asUser(adminId, async () => {
    for (const args of [[-1, 1, "Note"], [null, 1, "Note"], [3, null, "Note"], [3, 1, "   "], [3, 1, "x".repeat(501)]]) {
      await assert.rejects(record(...args), { code: "22023" });
    }
    assert.equal((await db.query("select quantity from public.inventory")).rows[0].quantity, 5);
  });
});

test("counting zero is allowed and records a negative difference", async () => {
  await asUser(adminId, async () => {
    await record(0, 1, "Rak kosong");
    const log = (await db.query("select * from public.stock_opnames where note = 'Rak kosong'")).rows[0];
    assert.equal(log.difference, -5);
    assert.equal((await db.query("select quantity from public.inventory")).rows[0].quantity, 0);
  });
});

test("an audit insert failure rolls back the stock update", async () => {
  await db.exec(`create function public.test_reject_log() returns trigger language plpgsql as $$
    begin raise exception 'TEST_AUDIT_FAILURE'; end; $$;
    create trigger test_audit_failure before insert on public.stock_opnames for each row execute function public.test_reject_log();`);
  await asUser(adminId, async () => {
    await assert.rejects(record(50, 2), /TEST_AUDIT_FAILURE/);
    const stock = (await db.query("select * from public.inventory")).rows[0];
    assert.equal(stock.quantity, 0);
    assert.equal(stock.version, 2);
    assert.equal((await db.query("select * from public.stock_opnames")).rows.length, 2);
  });
  await db.exec("drop trigger test_audit_failure on public.stock_opnames");
});

test("revoking membership immediately prevents reads and writes", async () => {
  await db.query("delete from public.admin_users where user_id = $1", [adminId]);
  await asUser(adminId, async () => {
    assert.equal((await db.query("select * from public.inventory")).rows.length, 0);
    assert.equal((await db.query("select * from public.stock_opnames")).rows.length, 0);
    await assert.rejects(record(8, 2), { code: "42501" });
  });
});
