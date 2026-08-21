-- Clientes y trabajos publicados desde el panel administrador.
create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  category text not null default 'Gastronomía',
  description text not null default '',
  logo_url text,
  images text[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_projects enable row level security;
drop policy if exists "client projects public read" on public.client_projects;
drop policy if exists "client projects admin write" on public.client_projects;
create policy "client projects public read" on public.client_projects
  for select using (is_active or public.is_admin());
create policy "client projects admin write" on public.client_projects
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create index if not exists client_projects_order_idx
  on public.client_projects(sort_order, created_at desc);
