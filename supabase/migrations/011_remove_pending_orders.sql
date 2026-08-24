-- Pendiente deja de ser un estado comercial: los intentos sin pago quedan
-- ocultos y sólo se publican cuando Mercado Pago confirma seña o pago total.

update public.orders
set status = 'awaiting_payment'
where status = 'pending';

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (
    status in (
      'awaiting_payment',
      'deposit_paid',
      'paid',
      'in_transit',
      'fulfilled',
      'cancelled'
    )
  );

alter table public.orders
  alter column status set default 'awaiting_payment';
