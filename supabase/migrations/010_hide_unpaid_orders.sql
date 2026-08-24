-- Los intentos de checkout quedan ocultos hasta que Mercado Pago confirme
-- el pago total o la seña configurada en la tienda.

update public.store_settings
set deposit_percentage = 50
where id = 1;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (
    status in (
      'awaiting_payment',
      'pending',
      'deposit_paid',
      'paid',
      'in_transit',
      'fulfilled',
      'cancelled'
    )
  );

-- Los pedidos pendientes existentes fueron generados antes de abrir Mercado
-- Pago. Si no tienen pago acreditado, dejan de mostrarse en ambos paneles.
update public.orders
set status = 'awaiting_payment'
where status = 'pending'
  and mp_payment_id is null;

drop policy if exists "orders own read" on public.orders;
create policy "orders own read"
on public.orders for select to authenticated
using (
  status <> 'awaiting_payment'
  and (user_id = auth.uid() or public.is_admin())
);

drop policy if exists "items own read" on public.order_items;
create policy "items own read"
on public.order_items for select to authenticated
using (
  exists (
    select 1
    from public.orders as customer_order
    where customer_order.id = order_id
      and customer_order.status <> 'awaiting_payment'
      and (
        customer_order.user_id = auth.uid()
        or public.is_admin()
      )
  )
);

create index if not exists orders_visible_created_idx
  on public.orders(created_at desc)
  where status <> 'awaiting_payment';
