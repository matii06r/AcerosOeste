-- Ejecutar en Supabase > SQL Editor. No contiene contraseñas ni claves privadas.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'customer')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), name text not null,
  slug text not null unique, description text not null default '', details text not null default '',
  price numeric(12,2) not null check(price >= 0), stock_quantity int not null default 0 check(stock_quantity >= 0),
  category_id uuid references public.categories(id) on delete set null,
  images text[] not null default '{}', sku text unique, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, question text not null check(char_length(question) between 2 and 500),
  answer text, is_visible boolean not null default true, created_at timestamptz not null default now(), answered_at timestamptz
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','deposit_paid','paid','fulfilled','cancelled')),
  payment_type text not null check(payment_type in ('full','deposit')), subtotal numeric(12,2) not null,
  deposit_percentage numeric(5,2), amount_to_pay numeric(12,2) not null,
  mp_preference_id text, mp_payment_id text, customer_name text not null, customer_email text,
  customer_phone text not null, created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  unit_price numeric(12,2) not null, quantity int not null check(quantity > 0), subtotal numeric(12,2) not null
);
create table if not exists public.store_settings (
  id int primary key default 1 check(id=1), deposit_percentage numeric(5,2) not null default 30 check(deposit_percentage between 1 and 100),
  freight_whatsapp text not null default '5491134322199', sales_whatsapp text not null default '5491134322199',
  contact_email text not null default 'gestionacerosoeste@gmail.com', address_1 text, address_2 text,
  instagram_url text, facebook_url text, updated_at timestamptz not null default now()
);
insert into public.store_settings(id,address_1,address_2,instagram_url,facebook_url)
values(1,'Av. San Martín 4092',null,'https://www.instagram.com/aceros_oeste/','https://www.facebook.com/aceros.oeste.2025')
on conflict(id) do nothing;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.questions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_settings enable row level security;

-- Permite reanudar una instalación que quedó aplicada parcialmente.
drop policy if exists "profile own read" on public.profiles;
drop policy if exists "profile own update" on public.profiles;
drop policy if exists "categories public read" on public.categories;
drop policy if exists "categories admin write" on public.categories;
drop policy if exists "products public read" on public.products;
drop policy if exists "products admin write" on public.products;
drop policy if exists "questions public read" on public.questions;
drop policy if exists "questions customer insert" on public.questions;
drop policy if exists "questions admin update" on public.questions;
drop policy if exists "orders own read" on public.orders;
drop policy if exists "orders admin update" on public.orders;
drop policy if exists "items own read" on public.order_items;
drop policy if exists "settings public read" on public.store_settings;
drop policy if exists "settings admin write" on public.store_settings;

create policy "profile own read" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "profile own update" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "categories public read" on public.categories for select using(true);
create policy "categories admin write" on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "products public read" on public.products for select using(is_active or public.is_admin());
create policy "products admin write" on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "questions public read" on public.questions for select using(is_visible or public.is_admin());
create policy "questions customer insert" on public.questions for insert to authenticated with check(user_id=auth.uid());
create policy "questions admin update" on public.questions for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "orders own read" on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "orders admin update" on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "items own read" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
create policy "settings public read" on public.store_settings for select using(true);
create policy "settings admin write" on public.store_settings for update to authenticated using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true;
drop policy if exists "product images public read" on storage.objects;
drop policy if exists "product images admin insert" on storage.objects;
drop policy if exists "product images admin update" on storage.objects;
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images public read" on storage.objects for select using(bucket_id='product-images');
create policy "product images admin insert" on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
create policy "product images admin update" on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin());
create policy "product images admin delete" on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());

-- Después de crear el usuario desde Authentication > Users, convertí SOLO ese usuario en admin:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='gestionacerosoeste@gmail.com');
