-- Permisos y estados finales de administración.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','deposit_paid','paid','in_transit','fulfilled','cancelled'));

alter table public.orders
  add column if not exists payment_email_sent_at timestamptz,
  add column if not exists shipment_email_sent_at timestamptz;

drop policy if exists "questions own or admin delete" on public.questions;
create policy "questions own or admin delete"
on public.questions for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "orders admin delete completed" on public.orders;
create policy "orders admin delete completed"
on public.orders for delete to authenticated
using (public.is_admin() and status in ('fulfilled','cancelled'));

