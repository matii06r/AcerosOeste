-- Notificaciones comerciales para clientes y administración.
-- Limpia avisos antiguos, elimina los asociados a cuentas/chats borrados y
-- crea novedades en vivo para pagos, estados de pedidos y mensajes del admin.

delete from public.admin_notifications
where is_read = true
   or actor_id is null;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_type_check;

alter table public.admin_notifications
  add constraint admin_notifications_type_check
  check (type in ('question', 'message', 'sale'));

alter table public.admin_notifications
  add column if not exists order_id uuid;

alter table public.admin_notifications
  add column if not exists question_id uuid
  references public.questions(id) on delete cascade;

alter table public.admin_notifications
  add column if not exists message_id uuid
  references public.support_messages(id) on delete cascade;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_actor_id_fkey;

alter table public.admin_notifications
  add constraint admin_notifications_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete cascade;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_conversation_id_fkey;

alter table public.admin_notifications
  add constraint admin_notifications_conversation_id_fkey
  foreign key (conversation_id)
  references public.support_conversations(id) on delete cascade;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_order_id_fkey;

alter table public.admin_notifications
  add constraint admin_notifications_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete cascade;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('order', 'message')),
  title text not null,
  body text not null default '',
  order_id uuid references public.orders(id) on delete cascade,
  conversation_id uuid
    references public.support_conversations(id) on delete cascade,
  message_id uuid references public.support_messages(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.user_notifications enable row level security;

drop policy if exists "user notifications own read"
  on public.user_notifications;
drop policy if exists "user notifications own update"
  on public.user_notifications;
drop policy if exists "user notifications own delete"
  on public.user_notifications;

create policy "user notifications own read"
on public.user_notifications for select to authenticated
using (user_id = auth.uid());

create policy "user notifications own update"
on public.user_notifications for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "user notifications own delete"
on public.user_notifications for delete to authenticated
using (user_id = auth.uid());

revoke all on public.user_notifications from anon;
revoke insert on public.user_notifications from authenticated;
grant select, update, delete on public.user_notifications to authenticated;

create index if not exists user_notifications_user_created_idx
  on public.user_notifications(user_id, created_at desc);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications(user_id, is_read, created_at desc);

create or replace function public.notify_admin_new_question()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_name text;
  actor_is_admin boolean;
begin
  select coalesce(profile.role = 'admin', false)
  into actor_is_admin
  from public.profiles profile
  where profile.id = new.user_id;

  if coalesce(actor_is_admin, false) then
    return new;
  end if;

  select product.name into product_name
  from public.products product
  where product.id = new.product_id;

  insert into public.admin_notifications(
    type,
    title,
    body,
    actor_id,
    product_id,
    question_id
  ) values (
    'question',
    'Nueva pregunta en ' || coalesce(product_name, 'un producto'),
    left(new.question, 240),
    new.user_id,
    new.product_id,
    new.id
  );
  return new;
end;
$$;

create or replace function public.notify_admin_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  actor_is_admin boolean;
begin
  select
    coalesce(nullif(trim(profile.full_name), ''), 'Un cliente'),
    coalesce(profile.role = 'admin', false)
  into actor_name, actor_is_admin
  from public.profiles profile
  where profile.id = new.sender_id;

  if coalesce(actor_is_admin, false) then
    return new;
  end if;

  insert into public.admin_notifications(
    type,
    title,
    body,
    actor_id,
    conversation_id,
    message_id
  ) values (
    'message',
    'Nuevo mensaje de ' || coalesce(actor_name, 'un cliente'),
    left(new.body, 240),
    new.sender_id,
    new.conversation_id,
    new.id
  );
  return new;
end;
$$;

create or replace function public.order_notification_label(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    string_agg(
      greatest(item.quantity, 1)::text || '× ' || item.product_name,
      ' · '
      order by item.id
    ),
    'Tu compra en Aceros Oeste'
  )
  from public.order_items item
  where item.order_id = p_order_id;
$$;

create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_label text;
  notification_title text;
  notification_body text;
  pending_balance numeric(12,2);
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if new.status not in (
    'deposit_paid',
    'paid',
    'in_transit',
    'fulfilled',
    'cancelled'
  ) then
    return new;
  end if;

  product_label := public.order_notification_label(new.id);
  pending_balance := greatest(
    0,
    coalesce(new.subtotal, 0) - coalesce(new.amount_to_pay, 0)
  );

  notification_title := case new.status
    when 'deposit_paid' then 'Seña acreditada'
    when 'paid' then 'Pago confirmado'
    when 'in_transit' then 'Tu pedido está en camino'
    when 'fulfilled' then 'Pedido entregado'
    when 'cancelled' then 'Pedido cancelado'
    else 'Novedad sobre tu pedido'
  end;

  notification_body := case new.status
    when 'deposit_paid' then
      product_label || '. Saldo pendiente: $' ||
      trim(to_char(pending_balance, 'FM999G999G999G990')) ||
      '. Te contactaremos para coordinar los próximos pasos.'
    when 'paid' then
      product_label || '. El pago total fue acreditado correctamente.'
    when 'in_transit' then
      product_label || '. Nos pondremos en contacto para coordinar la entrega.'
    when 'fulfilled' then
      product_label || '. El pedido figura como entregado.'
    when 'cancelled' then
      product_label || '. Comunicate con nosotros si necesitás asistencia.'
    else product_label
  end;

  if new.user_id is not null and exists (
    select 1 from public.profiles profile where profile.id = new.user_id
  ) then
    insert into public.user_notifications(
      user_id,
      type,
      title,
      body,
      order_id
    ) values (
      new.user_id,
      'order',
      notification_title,
      left(notification_body, 500),
      new.id
    );
  end if;

  if old.status = 'awaiting_payment'
     and new.status in ('deposit_paid', 'paid') then
    insert into public.admin_notifications(
      type,
      title,
      body,
      actor_id,
      order_id
    ) values (
      'sale',
      case
        when new.status = 'deposit_paid' then 'Nueva venta con seña acreditada'
        else 'Nueva venta pagada'
      end,
      left(
        coalesce(new.customer_name, 'Cliente') || ' compró ' || product_label,
        500
      ),
      case
        when exists (
          select 1 from public.profiles profile where profile.id = new.user_id
        ) then new.user_id
        else null
      end,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_notify_status_change on public.orders;
create trigger orders_notify_status_change
after update of status on public.orders
for each row execute function public.notify_order_status_change();

create or replace function public.notify_customer_new_admin_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_is_admin boolean;
  customer_id uuid;
  related_order_id uuid;
begin
  select coalesce(profile.role = 'admin', false)
  into sender_is_admin
  from public.profiles profile
  where profile.id = new.sender_id;

  if not coalesce(sender_is_admin, false) then
    return new;
  end if;

  select conversation.user_id, conversation.order_id
  into customer_id, related_order_id
  from public.support_conversations conversation
  where conversation.id = new.conversation_id;

  if customer_id is null then
    return new;
  end if;

  insert into public.user_notifications(
    user_id,
    type,
    title,
    body,
    order_id,
    conversation_id,
    message_id
  ) values (
    customer_id,
    'message',
    case
      when related_order_id is null then 'Nuevo mensaje de Aceros Oeste'
      else 'Nuevo mensaje sobre tu compra'
    end,
    left(new.body, 500),
    related_order_id,
    new.conversation_id,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists support_messages_notify_customer
  on public.support_messages;
create trigger support_messages_notify_customer
after insert on public.support_messages
for each row execute function public.notify_customer_new_admin_message();

alter table public.user_notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime
      add table public.user_notifications;
  end if;
end;
$$;
