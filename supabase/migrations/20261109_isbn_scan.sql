begin;

-- Run after 20261108_book_details.sql. Manual duplicates remain allowed.
alter table public.books add column if not exists created_via_isbn_scan boolean not null default false;
grant insert (created_via_isbn_scan) on public.books to authenticated;

create or replace function public.canonical_book_isbn(input_isbn text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  value text := upper(regexp_replace(input_isbn, '[[:space:]-]', '', 'g'));
  body text;
  total integer := 0;
  i integer;
begin
  if value ~ '^[0-9]{9}[0-9X]$' then
    body := '978' || left(value, 9);
    for i in 1..12 loop
      total := total + substring(body, i, 1)::integer * case when i % 2 = 0 then 3 else 1 end;
    end loop;
    return body || ((10 - total % 10) % 10)::text;
  end if;
  return value;
end;
$$;
create index if not exists books_canonical_isbn_idx on public.books (public.canonical_book_isbn(isbn));

create or replace function public.find_book_by_isbn(input_isbn text)
returns table(id uuid, title text) language sql stable security invoker set search_path = '' as $$
  select b.id, b.title from public.books b
  where (select public.is_admin())
    and public.canonical_book_isbn(b.isbn) = public.canonical_book_isbn(input_isbn)
  order by b.id limit 1;
$$;
revoke all on function public.find_book_by_isbn(text) from public, anon;
grant execute on function public.find_book_by_isbn(text) to authenticated;

create or replace function public.guard_scanned_book_isbn()
returns trigger language plpgsql set search_path = '' as $$
declare canonical text := public.canonical_book_isbn(new.isbn);
begin
  if tg_op = 'INSERT' and new.created_via_isbn_scan and (canonical is null or canonical !~ '^97[89][0-9]{10}$') then
    raise exception 'Scanned book requires an ISBN' using errcode = '23514';
  end if;
  if canonical is not null and canonical <> '' then
    -- All writers for the same ISBN share this lock, including manual inserts
    -- and ISBN edits, so concurrent scans cannot both pass the duplicate check.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(canonical, 0));
    if tg_op = 'INSERT' and new.created_via_isbn_scan and exists (
      select 1 from public.books b where public.canonical_book_isbn(b.isbn) = canonical
    ) then
      raise exception 'ISBN already exists; add manually' using errcode = '23505', constraint = 'books_scanned_isbn_duplicate';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists books_guard_scanned_isbn on public.books;
create trigger books_guard_scanned_isbn before insert or update of isbn on public.books
for each row execute function public.guard_scanned_book_isbn();

commit;
