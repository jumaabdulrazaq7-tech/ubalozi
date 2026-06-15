-- Phase 7 security hardening: remove unauthenticated table access.
-- Supabase Auth login does not require anon table privileges on ERP tables.

begin;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.create_pos_sale(
  uuid,
  uuid,
  jsonb,
  jsonb,
  numeric,
  numeric,
  date
) to authenticated;

grant execute on function public.collect_debt_payment(
  uuid,
  payment_method,
  numeric,
  text
) to authenticated;

grant execute on function public.update_own_avatar_url(text) to authenticated;

commit;
