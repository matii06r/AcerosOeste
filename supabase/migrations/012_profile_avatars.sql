-- Avatares configurables para clientes y administradores.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_preset text not null default 'person';

alter table public.profiles
  drop constraint if exists profiles_avatar_preset_check;

alter table public.profiles
  add constraint profiles_avatar_preset_check
  check (avatar_preset in ('person', 'chef', 'builder', 'tools', 'steel', 'star'));

update public.profiles
set avatar_preset = 'person'
where avatar_preset is null
   or avatar_preset not in ('person', 'chef', 'builder', 'tools', 'steel', 'star');

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile avatars public read" on storage.objects;
drop policy if exists "profile avatars own insert" on storage.objects;
drop policy if exists "profile avatars own update" on storage.objects;
drop policy if exists "profile avatars own delete" on storage.objects;

create policy "profile avatars public read"
on storage.objects for select
using (bucket_id = 'profile-avatars');

create policy "profile avatars own insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "profile avatars own update"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "profile avatars own delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
