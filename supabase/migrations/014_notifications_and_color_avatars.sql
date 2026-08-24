-- Centro de notificaciones administrativo, avisos por email y avatares por color.

alter table public.profiles
  drop constraint if exists profiles_avatar_preset_check;

update public.profiles
set avatar_preset = case avatar_preset
  when 'chef' then 'orange'
  when 'builder' then 'red'
  when 'tools' then 'sky'
  when 'star' then 'purple'
  when 'steel' then 'blue'
  when 'person' then 'blue'
  else 'blue'
end;

alter table public.profiles
  alter column avatar_preset set default 'blue';

alter table public.profiles
  add constraint profiles_avatar_preset_check
  check (
    avatar_preset in (
      'orange',
      'blue',
      'red',
      'purple',
      'pink',
      'green',
      'sky'
    )
  );

-- Nombre comercial inicial de la cuenta administrativa. Luego puede editarse
-- desde Mi cuenta sin modificar el email ni el rol.
update public.profiles
set full_name = 'Aceros Oeste'
where lower(coalesce(email, '')) = 'gestionacerosoeste@gmail.com';

alter table public.questions
  add column if not exists admin_email_sent_at timestamptz;

alter table public.support_messages
  add column if not exists admin_email_sent_at timestamptz;

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('question', 'message')),
  title text not null,
  body text not null default '',
  actor_id uuid references public.profiles(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  conversation_id uuid references public.support_conversations(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.admin_notifications enable row level security;

drop policy if exists "admin notifications read" on public.admin_notifications;
drop policy if exists "admin notifications update" on public.admin_notifications;
drop policy if exists "admin notifications delete" on public.admin_notifications;

create policy "admin notifications read"
on public.admin_notifications for select to authenticated
using (public.is_admin());

create policy "admin notifications update"
on public.admin_notifications for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "admin notifications delete"
on public.admin_notifications for delete to authenticated
using (public.is_admin());

revoke all on public.admin_notifications from anon;
revoke insert on public.admin_notifications from authenticated;
grant select, update, delete on public.admin_notifications to authenticated;

create index if not exists admin_notifications_unread_created_idx
  on public.admin_notifications(is_read, created_at desc);

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
    product_id
  ) values (
    'question',
    'Nueva pregunta en ' || coalesce(product_name, 'un producto'),
    left(new.question, 240),
    new.user_id,
    new.product_id
  );
  return new;
end;
$$;

drop trigger if exists questions_notify_admin on public.questions;
create trigger questions_notify_admin
after insert on public.questions
for each row execute function public.notify_admin_new_question();

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
    conversation_id
  ) values (
    'message',
    'Nuevo mensaje de ' || coalesce(actor_name, 'un cliente'),
    left(new.body, 240),
    new.sender_id,
    new.conversation_id
  );
  return new;
end;
$$;

drop trigger if exists support_messages_notify_admin on public.support_messages;
create trigger support_messages_notify_admin
after insert on public.support_messages
for each row execute function public.notify_admin_new_message();

alter table public.admin_notifications replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'admin_notifications'
  ) then
    alter publication supabase_realtime
      add table public.admin_notifications;
  end if;
end;
$$;

