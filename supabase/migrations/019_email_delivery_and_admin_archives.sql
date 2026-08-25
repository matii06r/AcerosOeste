-- Estado real de emails y archivo reversible de gestión.

alter table public.feedback_submissions
  add column if not exists email_error text;

alter table public.withdrawal_requests
  add column if not exists archived_at timestamptz,
  add column if not exists resolution_email_sent_at timestamptz,
  add column if not exists resolution_email_error text;

alter table public.orders
  add column if not exists billing_archived_at timestamptz;

alter table public.admin_notifications
  add column if not exists feedback_id uuid;

alter table public.admin_notifications
  drop constraint if exists admin_notifications_feedback_id_fkey;
alter table public.admin_notifications
  add constraint admin_notifications_feedback_id_fkey
  foreign key (feedback_id)
  references public.feedback_submissions(id)
  on delete cascade;

create index if not exists withdrawals_admin_active_created_idx
  on public.withdrawal_requests(created_at desc)
  where archived_at is null;

create index if not exists orders_billing_active_created_idx
  on public.orders(created_at desc)
  where billing_archived_at is null;

create or replace function public.notify_admin_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_notifications(
    type, title, body, actor_id, feedback_id
  ) values (
    'feedback',
    'Nueva sugerencia de ' || left(new.name, 80),
    left(new.message, 240),
    new.user_id,
    new.id
  );
  return new;
end;
$$;
