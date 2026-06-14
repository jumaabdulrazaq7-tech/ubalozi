create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, preferred_language, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'UBALOZINI Staff'),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'sales_person'),
    coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en'),
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users read product images" on storage.objects;
create policy "Authenticated users read product images"
on storage.objects for select
to authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and app_private.is_admin());

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and app_private.is_admin())
with check (bucket_id = 'product-images' and app_private.is_admin());

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and app_private.is_admin());
