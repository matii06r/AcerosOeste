-- Contactos actuales y aceptación trazable de términos en el checkout.

alter table public.store_settings
  alter column freight_whatsapp set default '5491161781074',
  alter column sales_whatsapp set default '5491161781074';

update public.store_settings
set freight_whatsapp = '5491161781074'
where regexp_replace(coalesce(freight_whatsapp, ''), '[^0-9]', '', 'g')
  in ('1134322199', '5491134322199');

update public.store_settings
set sales_whatsapp = '5491161781074'
where regexp_replace(coalesce(sales_whatsapp, ''), '[^0-9]', '', 'g')
  in ('1134322199', '5491134322199');

alter table public.orders
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

comment on column public.orders.terms_accepted_at is
  'Fecha en la que el comprador aceptó los términos antes de crear la preferencia de pago.';
comment on column public.orders.terms_version is
  'Versión identificable de los términos aceptados por el comprador.';

create index if not exists orders_terms_version_idx
  on public.orders(terms_version, terms_accepted_at desc)
  where terms_accepted_at is not null;
