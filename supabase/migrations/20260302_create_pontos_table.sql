create table if not exists public.pontos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  data_local text not null,
  email text not null,
  nome text not null,
  role text not null,
  tipo text not null check (tipo in ('entrada', 'inicio_descanso', 'fim_descanso', 'saida')),
  latitude double precision,
  longitude double precision,
  selfie_url text,
  observacao text
);

create index if not exists idx_pontos_email_created_at on public.pontos (email, created_at desc);
create index if not exists idx_pontos_created_at on public.pontos (created_at desc);

alter table public.pontos enable row level security;

create policy "Allow authenticated read pontos"
  on public.pontos
  for select
  to authenticated
  using (true);

create policy "Allow service role full access pontos"
  on public.pontos
  as permissive
  for all
  to service_role
  using (true)
  with check (true);
