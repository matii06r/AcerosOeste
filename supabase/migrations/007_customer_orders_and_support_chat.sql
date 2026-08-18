-- Autogestión segura de pedidos y chat privado entre clientes y administración.

alter table public.orders
  add column if not exists hidden_by_customer boolean not null default false;

-- El cliente puede cancelar únicamente pedidos todavía pendientes. Se usa una
-- función controlada para que nunca pueda alterar importes, pagos ni otros datos.
create or replace function public.cancel_own_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.orders%rowtype;
begin
  update public.orders
  set status = 'cancelled'
  where id = p_order_id
    and user_id = auth.uid()
    and status = 'pending'
  returning * into result;

  if not found then
    raise exception 'El pedido ya no puede cancelarse desde la cuenta';
  end if;
  return result;
end;
$$;

create or replace function public.hide_own_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.orders%rowtype;
begin
  update public.orders
  set hidden_by_customer = true
  where id = p_order_id
    and user_id = auth.uid()
    and status in ('cancelled', 'fulfilled')
  returning * into result;

  if not found then
    raise exception 'Este pedido debe estar cancelado o entregado para quitarlo';
  end if;
  return result;
end;
$$;

revoke all on function public.cancel_own_order(uuid) from public, anon;
revoke all on function public.hide_own_order(uuid) from public, anon;
grant execute on function public.cancel_own_order(uuid) to authenticated;
grant execute on function public.hide_own_order(uuid) to authenticated;

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support conversations participant read" on public.support_conversations;
drop policy if exists "support conversations customer insert" on public.support_conversations;
drop policy if exists "support conversations admin update" on public.support_conversations;
drop policy if exists "support messages participant read" on public.support_messages;
drop policy if exists "support messages participant insert" on public.support_messages;

create policy "support conversations participant read"
on public.support_conversations for select to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "support conversations customer insert"
on public.support_conversations for insert to authenticated
with check (user_id = auth.uid());

create policy "support conversations admin update"
on public.support_conversations for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "support messages participant read"
on public.support_messages for select to authenticated
using (
  exists (
    select 1 from public.support_conversations conversation
    where conversation.id = conversation_id
      and (conversation.user_id = auth.uid() or public.is_admin())
  )
);

create policy "support messages participant insert"
on public.support_messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.support_conversations conversation
    where conversation.id = conversation_id
      and (conversation.user_id = auth.uid() or public.is_admin())
  )
);

create or replace function public.touch_support_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.support_conversations
  set updated_at = now(), status = 'open'
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists support_message_touch_conversation on public.support_messages;
create trigger support_message_touch_conversation
after insert on public.support_messages
for each row execute function public.touch_support_conversation();

create index if not exists support_conversations_updated_idx
  on public.support_conversations(updated_at desc);
create index if not exists support_messages_conversation_created_idx
  on public.support_messages(conversation_id, created_at);

-- Los mensajes nuevos se transmiten sin recargar ni navegar la página.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end;
$$;
