alter table public.profiles
add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users read profile avatars" on storage.objects;
create policy "Authenticated users read profile avatars"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-avatars');

drop policy if exists "Users upload own profile avatar" on storage.objects;
create policy "Users upload own profile avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Users update own profile avatar" on storage.objects;
create policy "Users update own profile avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Users delete own profile avatar" on storage.objects;
create policy "Users delete own profile avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = auth.uid()::text
);

create or replace function public.update_own_avatar_url(p_avatar_url text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set avatar_url = nullif(p_avatar_url, '')
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

grant execute on function public.update_own_avatar_url(text) to authenticated;
