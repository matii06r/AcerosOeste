-- Sincronización en vivo de tienda, pedidos, preguntas y chat.
-- También habilita borrado seguro de mensajes y conversaciones.

create or replace function public.delete_support_message(p_message_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_conversation uuid;
begin
  select message.conversation_id
  into affected_conversation
  from public.support_messages as message
  where message.id = p_message_id
    and (message.sender_id = auth.uid() or public.is_admin());

  if affected_conversation is null then
    raise exception 'No tenés permiso para eliminar este mensaje';
  end if;

  delete from public.support_messages where id = p_message_id;
  update public.support_conversations
  set updated_at = now()
  where id = affected_conversation;
  return affected_conversation;
end;
$$;

create or replace function public.delete_support_conversation(
  p_conversation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.support_conversations as conversation
  where conversation.id = p_conversation_id
    and (conversation.user_id = auth.uid() or public.is_admin());

  if not found then
    raise exception 'No tenés permiso para eliminar esta conversación';
  end if;
  return p_conversation_id;
end;
$$;

revoke all on function public.delete_support_message(uuid) from public, anon;
revoke all on function public.delete_support_conversation(uuid) from public, anon;
grant execute on function public.delete_support_message(uuid) to authenticated;
grant execute on function public.delete_support_conversation(uuid) to authenticated;

-- Conserva los datos anteriores necesarios para identificar UPDATE y DELETE.
alter table public.products replica identity full;
alter table public.categories replica identity full;
alter table public.client_projects replica identity full;
alter table public.store_settings replica identity full;
alter table public.questions replica identity full;
alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.profiles replica identity full;
alter table public.support_conversations replica identity full;
alter table public.support_messages replica identity full;

-- Agrega cada tabla una sola vez a la publicación de Supabase Realtime.
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'products',
    'categories',
    'client_projects',
    'store_settings',
    'questions',
    'orders',
    'order_items',
    'profiles',
    'support_conversations',
    'support_messages'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end;
$$;
