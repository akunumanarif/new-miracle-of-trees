create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  category text not null,
  age text not null,
  format text not null,
  price integer not null check (price >= 0),
  cover text not null default '📚',
  accent text not null default '#173f8a',
  description text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_new boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.books enable row level security;
revoke all on table public.books from anon, authenticated;
grant select on table public.books to anon, authenticated;

create policy "Published books are publicly readable"
on public.books for select
to anon, authenticated
using (status = 'published');

create index if not exists books_status_created_at_idx
on public.books (status, created_at desc);
