-- Lista administrativa de usuarios y sincronización de datos de contacto.
-- La política existente de profiles permite ver todos los registros sólo al admin.

alter table public.profiles
  add column if not exists email text;

-- Completa perfiles de usuarios anteriores sin modificar roles ya configurados.
insert into public.profiles as profile (id, full_name, phone, email, role, created_at)
select
  user_row.id,
  coalesce(user_row.raw_user_meta_data->>'full_name', ''),
  coalesce(user_row.raw_user_meta_data->>'phone', ''),
  user_row.email,
  case
    when lower(coalesce(user_row.email, '')) = 'gestionacerosoeste@gmail.com'
      then 'admin'
    else 'customer'
  end,
  user_row.created_at
from auth.users as user_row
on conflict (id) do update
set
  email = excluded.email,
  full_name = case
    when nullif(trim(profile.full_name), '') is null
      then excluded.full_name
    else profile.full_name
  end,
  phone = case
    when nullif(trim(profile.phone), '') is null
      then excluded.phone
    else profile.phone
  end;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.email,
    'customer'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone;
  return new;
end;
$$;

create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_profile_email();

create index if not exists profiles_created_at_idx
  on public.profiles(created_at desc);
create index if not exists profiles_email_lower_idx
  on public.profiles(lower(email));
