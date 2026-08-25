-- Arrepentimiento, clasificación de productos y facturación asistida.
-- Los precios de public.products.price continúan siendo precios finales al público.

alter table public.products
  add column if not exists sale_type text not null default 'standard';

alter table public.products
  drop constraint if exists products_sale_type_check;
alter table public.products
  add constraint products_sale_type_check
  check (sale_type in ('standard', 'customizable', 'made_to_order'));

create table if not exists public.product_pricing (
  product_id uuid primary key references public.products(id) on delete cascade,
  base_net_price numeric(12,2) not null default 0 check (base_net_price >= 0),
  vat_rate numeric(5,2) not null default 21 check (vat_rate between 0 and 100),
  payment_fee_rate numeric(5,2) not null default 7 check (payment_fee_rate between 0 and 99),
  commercial_margin_rate numeric(5,2) not null default 0 check (commercial_margin_rate between 0 and 500),
  rounding_unit numeric(12,2) not null default 100 check (rounding_unit >= 0),
  updated_at timestamptz not null default now()
);

alter table public.product_pricing enable row level security;
drop policy if exists "product pricing admin read" on public.product_pricing;
drop policy if exists "product pricing admin write" on public.product_pricing;
create policy "product pricing admin read"
on public.product_pricing for select to authenticated
using (public.is_admin());
create policy "product pricing admin write"
on public.product_pricing for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.product_pricing from anon;
grant select, insert, update, delete on public.product_pricing to authenticated;

alter table public.store_settings
  add column if not exists vat_rate numeric(5,2) not null default 21,
  add column if not exists payment_fee_rate numeric(5,2) not null default 7,
  add column if not exists commercial_margin_rate numeric(5,2) not null default 0,
  add column if not exists pricing_rounding numeric(12,2) not null default 100,
  add column if not exists invoice_mode text not null default 'assisted',
  add column if not exists issuer_tax_status text not null default 'pending_accountant',
  add column if not exists issuer_cuit text,
  add column if not exists invoice_point_of_sale integer,
  add column if not exists default_invoice_type text;

alter table public.store_settings
  drop constraint if exists store_settings_invoice_mode_check;
alter table public.store_settings
  add constraint store_settings_invoice_mode_check
  check (invoice_mode in ('assisted', 'automated', 'disabled'));

alter table public.orders
  add column if not exists billing_condition text,
  add column if not exists billing_name text,
  add column if not exists billing_document_type text,
  add column if not exists billing_document_number text,
  add column if not exists billing_address text,
  add column if not exists billing_status text not null default 'pending';

alter table public.orders
  drop constraint if exists orders_billing_status_check;
alter table public.orders
  add constraint orders_billing_status_check
  check (billing_status in ('pending', 'partial', 'invoiced', 'not_applicable'));

alter table public.order_items
  add column if not exists sale_type text not null default 'standard',
  add column if not exists unit_net_price numeric(12,2),
  add column if not exists vat_rate numeric(5,2) not null default 21,
  add column if not exists unit_vat_amount numeric(12,2);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  invoice_type text not null,
  scope text not null default 'full',
  point_of_sale integer,
  invoice_number bigint,
  cae text,
  cae_expiration date,
  issued_at timestamptz not null default now(),
  net_amount numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 21,
  vat_amount numeric(12,2) not null default 0,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  pdf_path text,
  status text not null default 'authorized',
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_type, point_of_sale, invoice_number)
);

alter table public.invoices
  drop constraint if exists invoices_scope_check;
alter table public.invoices
  add constraint invoices_scope_check
  check (scope in ('deposit', 'full', 'balance', 'credit_note'));
alter table public.invoices
  drop constraint if exists invoices_status_check;
alter table public.invoices
  add constraint invoices_status_check
  check (status in ('draft', 'authorized', 'sent', 'cancelled'));

alter table public.invoices enable row level security;
drop policy if exists "invoices own read" on public.invoices;
drop policy if exists "invoices admin write" on public.invoices;
create policy "invoices own read"
on public.invoices for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "invoices admin write"
on public.invoices for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.invoices from anon;
grant select, insert, update, delete on public.invoices to authenticated;
create index if not exists invoices_order_created_idx
  on public.invoices(order_id, created_at desc);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  reason text,
  status text not null default 'submitted',
  resolution_reason text,
  refund_amount numeric(12,2),
  mp_refund_id text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.withdrawal_requests
  drop constraint if exists withdrawal_requests_status_check;
alter table public.withdrawal_requests
  add constraint withdrawal_requests_status_check
  check (status in (
    'submitted', 'under_review', 'awaiting_return', 'refund_pending',
    'refunded', 'rejected', 'closed'
  ));

alter table public.withdrawal_requests enable row level security;
drop policy if exists "withdrawals own read" on public.withdrawal_requests;
drop policy if exists "withdrawals admin update" on public.withdrawal_requests;
create policy "withdrawals own read"
on public.withdrawal_requests for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "withdrawals admin update"
on public.withdrawal_requests for update to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.withdrawal_requests from anon;
revoke insert, delete on public.withdrawal_requests from authenticated;
grant select, update on public.withdrawal_requests to authenticated;
create index if not exists withdrawals_status_created_idx
  on public.withdrawal_requests(status, created_at desc);
create unique index if not exists withdrawals_open_order_idx
  on public.withdrawal_requests(order_id)
  where status not in ('rejected', 'closed');

drop trigger if exists product_pricing_set_updated_at on public.product_pricing;
create trigger product_pricing_set_updated_at before update on public.product_pricing
for each row execute function public.set_updated_at();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices
for each row execute function public.set_updated_at();
drop trigger if exists withdrawals_set_updated_at on public.withdrawal_requests;
create trigger withdrawals_set_updated_at before update on public.withdrawal_requests
for each row execute function public.set_updated_at();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('invoice-documents', 'invoice-documents', false, 10485760, array['application/pdf'])
on conflict(id) do update
set public = false, file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf'];

drop policy if exists "invoice documents admin insert" on storage.objects;
drop policy if exists "invoice documents authorized read" on storage.objects;
drop policy if exists "invoice documents admin update" on storage.objects;
drop policy if exists "invoice documents admin delete" on storage.objects;
create policy "invoice documents admin insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'invoice-documents' and public.is_admin());
create policy "invoice documents authorized read"
on storage.objects for select to authenticated
using (
  bucket_id = 'invoice-documents'
  and exists (
    select 1 from public.invoices invoice
    where invoice.pdf_path = name
      and (invoice.user_id = auth.uid() or public.is_admin())
  )
);
create policy "invoice documents admin update"
on storage.objects for update to authenticated
using (bucket_id = 'invoice-documents' and public.is_admin());
create policy "invoice documents admin delete"
on storage.objects for delete to authenticated
using (bucket_id = 'invoice-documents' and public.is_admin());

alter table public.admin_notifications
  drop constraint if exists admin_notifications_type_check;
alter table public.admin_notifications
  add constraint admin_notifications_type_check
  check (type in ('question', 'message', 'sale', 'withdrawal', 'invoice'));

alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;
alter table public.user_notifications
  add constraint user_notifications_type_check
  check (type in ('order', 'message', 'withdrawal', 'invoice'));

create or replace function public.notify_new_withdrawal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications(
    type, title, body, actor_id, order_id
  ) values (
    'withdrawal',
    'Nueva solicitud de arrepentimiento',
    new.request_code || ' · ' || new.customer_name,
    new.user_id,
    new.order_id
  );
  return new;
end;
$$;
drop trigger if exists withdrawal_notify_admin on public.withdrawal_requests;
create trigger withdrawal_notify_admin
after insert on public.withdrawal_requests
for each row execute function public.notify_new_withdrawal();

create or replace function public.notify_invoice_available()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.status in ('authorized', 'sent') then
    insert into public.user_notifications(
      user_id, type, title, body, order_id
    ) values (
      new.user_id,
      'invoice',
      'Tu factura ya está disponible',
      new.invoice_type || ' · $' || trim(to_char(new.gross_amount, 'FM999G999G999G990')),
      new.order_id
    );
  end if;
  return new;
end;
$$;
drop trigger if exists invoice_notify_customer on public.invoices;
create trigger invoice_notify_customer
after insert on public.invoices
for each row execute function public.notify_invoice_available();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'withdrawal_requests'
  ) then
    alter publication supabase_realtime add table public.withdrawal_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'invoices'
  ) then
    alter publication supabase_realtime add table public.invoices;
  end if;
end;
$$;
