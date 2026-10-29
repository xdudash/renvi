-- Hosted Supabase installs pgcrypto in the `extensions` schema, not `public`. A function with
-- search_path = public that calls a pgcrypto function unqualified works locally but fails in production.
\set QUIET 1
begin;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not p_ok then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
select pg_temp.check(not exists (
  select 1 from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
    and p.prosrc ~ '(^|[^.a-z_])(gen_random_bytes|gen_salt|crypt|digest|hmac|pgp_[a-z_]+)\s*\('),
  'no public function calls pgcrypto unqualified (breaks on hosted Supabase)');
rollback;
