const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { before, after, test } = require("node:test");
const { PGlite } = require("@electric-sql/pglite");

let db, bookId;
const adminId = "11111111-1111-4111-8111-111111111111";
const memberId = "22222222-2222-4222-8222-222222222222";
before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema auth to anon, authenticated;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, delete on storage.objects to authenticated;
  `);
  for (const file of ["schema.sql", "migrations/20261108_admin_inventory.sql", "migrations/20261108_book_management.sql", "migrations/20261108_book_management.sql", "migrations/20261108_book_details.sql", "migrations/20261108_book_details.sql", "migrations/20261108_public_book_stock.sql", "migrations/20261108_public_book_stock.sql"]) {
    await db.exec(readFileSync(resolve(__dirname, "../supabase", file), "utf8"));
  }
  await db.query("insert into auth.users values ($1,'admin@example.com'),($2,'member@example.com')", [adminId, memberId]);
  await db.query("insert into public.admin_users(user_id) values ($1)", [adminId]);
  for (let i = 0; i < 2; i++) await db.exec(readFileSync(resolve(__dirname, "../supabase/migrations/20261109_isbn_scan.sql"), "utf8"));
});
after(async () => { await db?.close(); });
async function asUser(id, work) {
  await db.exec(`set role ${id ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  try { return await work(); } finally { await db.exec("reset role"); }
}
const insert = () => db.query(`insert into public.books(slug,title,author,category,age,format,price,description)
  values ('new-book','Buku baru','Penulis','Alam','3–6 tahun','Hardback',99000,'Cerita anak') returning id,status,revision`);

test("anonymous visitors and regular members cannot create products", async () => {
  await asUser(null, async () => { await assert.rejects(insert(), { code: "42501" }); });
  await asUser(memberId, async () => { await assert.rejects(insert(), { code: "42501" }); });
});
test("admins can create a draft book with a generated ID", async () => {
  await asUser(adminId, async () => {
    const book = (await insert()).rows[0];
    bookId = book.id;
    assert.equal(book.status, "draft");
    assert.equal(book.revision, 0);
  });
});
test("unpublished products are hidden from visitors", async () => {
  await asUser(null, async () => { assert.equal((await db.query("select * from public.books")).rows.length, 0); });
  await asUser(null, async () => { assert.equal((await db.query("select public.get_book_stock($1) as quantity", [bookId])).rows[0].quantity, null); });
});
test("admins can publish; the revision automatically changes", async () => {
  await asUser(adminId, async () => {
    const rows = (await db.query("update public.books set status='published' where id=$1 and revision=0 returning revision", [bookId])).rows;
    assert.equal(rows[0].revision, 1);
    assert.equal((await db.query("update public.books set title='Stale edit' where id=$1 and revision=0 returning id", [bookId])).rows.length, 0);
  });
  await asUser(null, async () => { assert.equal((await db.query("select * from public.books")).rows.length, 1); });
});
test("regular members cannot edit even publicly visible books", async () => {
  await asUser(memberId, async () => {
    assert.equal((await db.query("update public.books set title='Unauthorized' where id=$1 returning id", [bookId])).rows.length, 0);
    assert.equal((await db.query("select title from public.books where id=$1", [bookId])).rows[0].title, "Buku baru");
  });
});

test("visitors see exact stock of published books without access to inventory or history", async () => {
  await asUser(null, async () => {
    assert.equal((await db.query("select public.get_book_stock($1) as quantity", [bookId])).rows[0].quantity, 0);
  });
  await db.query("insert into public.inventory(book_id,quantity) values ($1,2)", [bookId]);
  for (const user of [null, memberId]) {
    await asUser(user, async () => {
      assert.equal((await db.query("select public.get_book_stock($1) as quantity", [bookId])).rows[0].quantity, 2);
    });
  }
  await asUser(null, async () => {
    await assert.rejects(db.query("select * from public.inventory"), { code: "42501" });
    await assert.rejects(db.query("select * from public.stock_opnames"), { code: "42501" });
    assert.equal((await db.query("select public.get_book_stock('99999999-9999-4999-8999-999999999999') as quantity")).rows[0].quantity, null);
  });
});

test("publishing details and gallery can be edited only by admins", async () => {
  await asUser(adminId, async () => {
    await db.query("update public.books set isbn='9781917044325', page_count=16, publication_date='2025-07-17', arrival_note='Mei 2027', preorder_closes_on='2026-11-11', gallery_images=array['https://catalog.example.com/storage/v1/object/public/book-covers/admin/page.webp'] where id=$1", [bookId]);
    const book = (await db.query("select page_count, gallery_images from public.books where id=$1", [bookId])).rows[0];
    assert.equal(book.page_count, 16);
    assert.equal(book.gallery_images.length, 1);
    await assert.rejects(db.query("update public.books set page_count=-1 where id=$1", [bookId]), { code: "23514" });
  });
  await asUser(memberId, async () => {
    assert.equal((await db.query("update public.books set arrival_note='Unauthorized' where id=$1 returning id", [bookId])).rows.length, 0);
  });
});
test("admins cannot override revision or delete books with the application role", async () => {
  await asUser(adminId, async () => {
    await assert.rejects(db.query("update public.books set revision=0 where id=$1", [bookId]), { code: "42501" });
    await assert.rejects(db.query("delete from public.books where id=$1", [bookId]), { code: "42501" });
  });
});

test("batch stock lookup exposes only the requested published books", async () => {
  const hidden = (await db.query("insert into public.books(slug,title,author,category,age,format,price,description) values ('hidden-stock','Hidden','Author','Alam','3','Hardback',1,'Hidden') returning id")).rows[0].id;
  await asUser(null, async () => {
    const result = await db.query("select * from public.get_books_stock($1::uuid[])", [[bookId, hidden, "99999999-9999-4999-8999-999999999999"]]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].book_id, bookId);
    assert.equal(result.rows[0].quantity, 2);
  });
});
test("archiving hides a product without discarding stock or history", async () => {
  await db.query("insert into public.inventory(book_id,quantity) values ($1,10) on conflict (book_id) do update set quantity=excluded.quantity", [bookId]);
  await asUser(adminId, async () => {
    await db.query("update public.books set status='archived' where id=$1", [bookId]);
    assert.equal((await db.query("select quantity from public.inventory where book_id=$1", [bookId])).rows[0].quantity, 10);
  });
  await asUser(null, async () => {
    assert.equal((await db.query("select * from public.books")).rows.length, 0);
    assert.equal((await db.query("select public.get_book_stock($1) as quantity", [bookId])).rows[0].quantity, null);
  });
});
test("book cover bucket has a public URL and restricts file sizes and MIME types", async () => {
  const bucket = (await db.query("select * from storage.buckets where id='book-covers'")).rows[0];
  assert.equal(bucket.public, true);
  assert.equal(Number(bucket.file_size_limit), 5242880);
  assert.deepEqual(bucket.allowed_mime_types, ["image/jpeg", "image/png", "image/webp"]);
});
test("ISBN lookup is admin-only and detects draft or archived ISBN-10 equivalents", async () => {
  const existingId = (await db.query(`insert into public.books(slug,title,author,category,age,format,price,description,isbn,status)
    values ('isbn-existing','Existing ISBN','Author','Alam','3','Hardback',1,'Book','0-306-40615-2','archived') returning id`)).rows[0].id;
  await asUser(null, async () => {
    await assert.rejects(db.query("select * from public.find_book_by_isbn('9780306406157')"), { code: "42501" });
  });
  await asUser(memberId, async () => {
    assert.equal((await db.query("select * from public.find_book_by_isbn('9780306406157')")).rows.length, 0);
  });
  await asUser(adminId, async () => {
    assert.equal((await db.query("select * from public.find_book_by_isbn('978-0-306-40615-7')")).rows[0].id, existingId);
    await assert.rejects(db.query(`insert into public.books(slug,title,author,category,age,format,price,description,isbn,created_via_isbn_scan)
      values ('isbn-scan-rejected','Duplicate','Author','Alam','3','Hardback',1,'Book','9780306406157',true)`), { code: "23505", constraint: "books_scanned_isbn_duplicate" });
    await db.query(`insert into public.books(slug,title,author,category,age,format,price,description,isbn)
      values ('isbn-manual-allowed','Manual duplicate','Author','Alam','3','Hardback',1,'Book','9780306406157')`);
  });
});
test("unique scanned books save and future scans are blocked", async () => {
  const insertScanned = slug => db.query(`insert into public.books(slug,title,author,category,age,format,price,description,isbn,created_via_isbn_scan)
    values ($1,'Scanned','Author','Alam','3','Hardback',1,'Book','9780804429573',true) returning id`, [slug]);
  await asUser(memberId, async () => { await assert.rejects(insertScanned('isbn-member'), { code: "42501" }); });
  await asUser(adminId, async () => {
    assert.equal((await insertScanned('isbn-first-scan')).rows.length, 1);
    await assert.rejects(insertScanned('isbn-second-scan'), { code: "23505" });
    await assert.rejects(db.query(`insert into public.books(slug,title,author,category,age,format,price,description,created_via_isbn_scan)
      values ('isbn-missing','Scanned','Author','Alam','3','Hardback',1,'Book',true)`), { code: "23514" });
  });
});
test("only admins may upload covers and must use their own upload folder", async () => {
  const upload = name => db.query("insert into storage.objects(bucket_id,name) values ('book-covers',$1)", [name]);
  await asUser(memberId, async () => { await assert.rejects(upload(`${memberId}/cover.webp`), { code: "42501" }); });
  await asUser(adminId, async () => {
    await assert.rejects(upload(`${memberId}/cover.webp`), { code: "42501" });
    await upload(`${adminId}/cover.webp`);
    assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
  });
});
test("regular accounts cannot delete covers; admins can clean up their own uploads", async () => {
  await asUser(memberId, async () => { assert.equal((await db.query("delete from storage.objects returning id")).rows.length, 0); });
  await asUser(adminId, async () => { assert.equal((await db.query("delete from storage.objects returning id")).rows.length, 1); });
});
