create extension if not exists pgcrypto;

create table if not exists public.cadastros (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text,
  password_hash text not null,
  role text not null default 'seguranca',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cadastros_updated_at on public.cadastros;
create trigger trg_cadastros_updated_at
before update on public.cadastros
for each row
execute function public.set_updated_at();

alter table public.cadastros enable row level security;

create policy "Allow authenticated read cadastros"
  on public.cadastros
  for select
  to authenticated
  using (true);

create policy "Allow service role full access cadastros"
  on public.cadastros
  as permissive
  for all
  to service_role
  using (true)
  with check (true);
