-- Sugerencias constructivas y archivado seguro de pedidos finalizados.
-- Los pedidos comerciales no se eliminan: se ocultan del panel operativo para
-- conservar facturas, arrepentimientos, chats y trazabilidad.

alter table public.orders
  add column if not exists admin_archived_at timestamptz;

create index if not exists orders_admin_active_created_idx
  on public.orders(created_at desc)
  where admin_archived_at is null;

create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  category text not null default 'general',
  order_reference text,
  message text not null,
  status text not null default 'new',
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.feedback_submissions
  drop constraint if exists feedback_submissions_category_check;
alter table public.feedback_submissions
  add constraint feedback_submissions_category_check
  check (category in ('producto', 'atencion', 'entrega', 'sitio', 'general'));

alter table public.feedback_submissions
  drop constraint if exists feedback_submissions_status_check;
alter table public.feedback_submissions
  add constraint feedback_submissions_status_check
  check (status in ('new', 'reviewed', 'resolved', 'discarded'));

alter table public.feedback_submissions enable row level security;

drop policy if exists "feedback admin read" on public.feedback_submissions;
drop policy if exists "feedback admin update" on public.feedback_submissions;
drop policy if exists "feedback admin delete" on public.feedback_submissions;

create policy "feedback admin read"
on public.feedback_submissions for select to authenticated
using (public.is_admin());

create policy "feedback admin update"
on public.feedback_submissions for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "feedback admin delete"
on public.feedback_submissions for delete to authenticated
using (public.is_admin());

revoke all on public.feedback_submissions from anon;
revoke insert on public.feedback_submissions from authenticated;
grant select, update, delete on public.feedback_submissions to authenticated;

create index if not exists feedback_email_created_idx
  on public.feedback_submissions(lower(email), created_at desc);

alter table public.admin_notifications
  drop constraint if exists admin_notifications_type_check;
alter table public.admin_notifications
  add constraint admin_notifications_type_check
  check (type in ('question', 'message', 'sale', 'withdrawal', 'invoice', 'feedback'));

create or replace function public.notify_admin_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications(type, title, body, actor_id)
  values (
    'feedback',
    'Nueva sugerencia de ' || left(new.name, 80),
    left(new.message, 240),
    new.user_id
  );
  return new;
end;
$$;

drop trigger if exists feedback_notify_admin on public.feedback_submissions;
create trigger feedback_notify_admin
after insert on public.feedback_submissions
for each row execute function public.notify_admin_new_feedback();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feedback_submissions'
  ) then
    alter publication supabase_realtime add table public.feedback_submissions;
  end if;
end;
$$;
