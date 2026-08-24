-- Permisos seguros de avatar, fotos congeladas por pedido y chat privado por compra.

-- La migración 002 restringió correctamente qué columnas puede modificar cada
-- cliente. Al incorporar avatares hay que ampliar ese permiso sin exponer role.
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url, avatar_preset)
  on public.profiles to authenticated;

drop policy if exists "profile own update" on public.profiles;
create policy "profile own update"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Conserva la foto que tenía el producto al confirmar la compra, aunque luego
-- la publicación se modifique o se elimine.
alter table public.order_items
  add column if not exists product_image_url text;

update public.order_items item
set product_image_url = product.images[1]
from public.products product
where item.product_id = product.id
  and item.product_image_url is null
  and coalesce(array_length(product.images, 1), 0) > 0;

-- Una conversación general por cliente y una conversación independiente por
-- pedido. El pedido se valida dentro de una función controlada.
alter table public.support_conversations
  add column if not exists order_id uuid references public.orders(id) on delete cascade;

alter table public.support_conversations
  drop constraint if exists support_conversations_user_id_key;

create unique index if not exists support_conversations_general_user_unique
  on public.support_conversations(user_id)
  where order_id is null;

create unique index if not exists support_conversations_order_unique
  on public.support_conversations(order_id)
  where order_id is not null;

create index if not exists support_conversations_order_idx
  on public.support_conversations(order_id);

drop policy if exists "support conversations customer insert"
  on public.support_conversations;
create policy "support conversations customer insert"
on public.support_conversations for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    order_id is null
    or exists (
      select 1
      from public.orders own_order
      where own_order.id = order_id
        and own_order.user_id = auth.uid()
    )
  )
);

create or replace function public.get_or_create_order_conversation(p_order_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  order_owner uuid;
  result public.support_conversations%rowtype;
begin
  select customer_order.user_id
  into order_owner
  from public.orders customer_order
  where customer_order.id = p_order_id
    and customer_order.status in (
      'deposit_paid',
      'paid',
      'in_transit',
      'fulfilled',
      'cancelled'
    )
    and (
      customer_order.user_id = auth.uid()
      or public.is_admin()
    );

  if order_owner is null then
    raise exception 'No tenés acceso a este pedido';
  end if;

  insert into public.support_conversations(user_id, order_id)
  values (order_owner, p_order_id)
  on conflict (order_id) where order_id is not null
  do update set order_id = excluded.order_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.get_or_create_order_conversation(uuid)
  from public, anon;
grant execute on function public.get_or_create_order_conversation(uuid)
  to authenticated;
