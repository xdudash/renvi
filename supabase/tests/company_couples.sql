-- Block S (0038): company («привет») and couples modes.
\set QUIET 1
begin;
create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  if p_uid is null then execute 'set local role anon'; else execute 'set local role authenticated'; end if;
end $$;
create or replace function pg_temp.check(p_ok boolean, p_name text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create or replace function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-0000000038' || lpad(n::text, 2, '0'))::uuid
$$;
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;
create or replace function pg_temp.names() returns text language sql as $$
  select coalesce(string_agg(x->>'name', ',' order by x->>'name'), '') from jsonb_array_elements(public.company_feed(50)) x
$$;

insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'c' || n || '@company.test', now() from generate_series(1, 9) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done, interests) values
  (pg_temp.uid(1), 'Me', 28, 'man', 'women', 'SK', 'Bratislava', 'serious', true, array['hiking','wine']),
  (pg_temp.uid(2), 'Anna', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, array['hiking']),
  (pg_temp.uid(3), 'Bea', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, array['wine','hiking']),
  (pg_temp.uid(4), 'Cili', 26, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, '{}'),
  (pg_temp.uid(5), 'Far', 30, 'man', 'women', 'CZ', 'Praha', 'serious', true, '{}'),
  (pg_temp.uid(6), 'Zita', 31, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, '{}'),
  (pg_temp.uid(7), 'Pavol', 33, 'man', 'women', 'SK', 'Bratislava', 'serious', true, '{}'),
  (pg_temp.uid(8), 'Dora', 29, 'woman', 'men', 'SK', 'Bratislava', 'serious', true, '{}'),
  (pg_temp.uid(9), 'Emil', 30, 'man', 'women', 'SK', 'Bratislava', 'serious', true, '{}');

-- ---- company ----
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.names() = 'Anna,Bea,Cili,Dora,Emil,Pavol,Zita', 'everybody open to company in my city, other countries are not shown');
select pg_temp.as_user(pg_temp.uid(2));
select public.set_relationship_status('relationship');
select pg_temp.check(pg_temp.names() like '%Bea%', 'a person in a relationship still has company');
select public.set_visibility(false, true, 'women', false);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.names() not like '%Anna%', 'audience "women" hides her from men');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.names() like '%Anna%', 'but women still see her');
select public.set_visibility(true, false, 'all', false);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.names() not like '%Bea%', 'company switched off: not shown');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state($$select public.company_feed(5)$$) = 'P0007', 'company switched off: closed for me too');
select public.set_visibility(true, true, 'all', false);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.company_feed(5)->0->>'name') = 'Bea', 'ordered by common interests first');
select pg_temp.check(pg_temp.state($$select public.set_company_look('{market,bogus}')$$) = '22023', 'bad look-for category rejected');
select public.set_company_look('{rink,market,rink}');
select pg_temp.check((select company_look from public.profiles where id = pg_temp.uid(1)) = '{market,rink}' and (public.my_modes()->'company_look') = '["market", "rink"]'::jsonb, 'look-for saved without duplicates and shown in my_modes');

-- hello is not a like
select pg_temp.check((public.company_hello(pg_temp.uid(3))->>'connected')::boolean = false, 'one-sided hello does not connect');
select pg_temp.check(pg_temp.names() not like '%Bea%', 'a person I said hello to leaves my feed');
select pg_temp.check((select count(*) from public.matches where kind = 'company') = 0, 'no chat yet');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check((public.company_feed(5)->0->>'name') = 'Me' and (public.company_feed(5)->0->>'said_hello')::boolean, 'she sees who said hello first');
select pg_temp.check((public.company_hello(pg_temp.uid(1))->>'connected')::boolean, 'mutual hello connects');
select pg_temp.check((select count(*) from public.list_matches()) >= 1, 'chat is in the conversation list');
select pg_temp.check(pg_temp.state(format($$select public.company_hello(%L)$$, pg_temp.uid(3))) = 'P0002', 'cannot say hello to yourself');
select public.company_pass(pg_temp.uid(4));
select pg_temp.check(pg_temp.names() not like '%Cili%', 'passed person is hidden');
reset role;
select pg_temp.check((select kind from public.matches where user_a = least(pg_temp.uid(1), pg_temp.uid(3)) and user_b = greatest(pg_temp.uid(1), pg_temp.uid(3))) = 'company', 'match kind is company');
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state($$select * from public.company_hellos$$) = '42501', 'hello table is closed to direct reads');

-- ---- couples ----
select pg_temp.as_user(pg_temp.uid(6));
select pg_temp.check(pg_temp.state($$select public.couples_feed(5)$$) = 'P0007', 'couples feed needs a linked couple');
select public.set_relationship_status('couple');
create temp table t_c1 as select public.couple_create_code()->>'code' as code;
select pg_temp.as_user(pg_temp.uid(7));
select public.set_relationship_status('couple');
select public.couple_accept((select code from t_c1));
select pg_temp.as_user(pg_temp.uid(8));
select public.set_relationship_status('couple');
create temp table t_c2 as select public.couple_create_code()->>'code' as code;
select pg_temp.as_user(pg_temp.uid(9));
select public.set_relationship_status('couple');
select public.couple_accept((select code from t_c2));
select pg_temp.as_user(pg_temp.uid(6));
select pg_temp.check(jsonb_array_length(public.couples_feed(5)) = 1 and (public.couples_feed(5)->0->'people'->1->>'name') in ('Dora','Emil'), 'a couple sees the other couple');
create temp table t_cid as select (public.couples_feed(5)->0->>'couple_id')::uuid as id;
select pg_temp.check(not (public.couples_hello((select id from t_cid))->>'connected')::boolean, 'one-sided couples hello does not connect');
select pg_temp.check(jsonb_array_length(public.couples_feed(5)) = 0, 'a couple I greeted leaves the feed');
select pg_temp.as_user(pg_temp.uid(9));
create temp table t_cid2 as select (public.couples_feed(5)->0->>'couple_id')::uuid as id;
select pg_temp.check((public.couples_feed(5)->0->>'said_hello')::boolean, 'they see that we said hello');
select pg_temp.check((public.couples_hello((select id from t_cid2))->>'connected')::boolean, 'mutual couples hello connects');
reset role;
select pg_temp.check((select count(*) from public.matches where kind = 'couples') = 1, 'one couples chat opened');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.state($$select public.couples_feed(5)$$) = 'P0007', 'a single person has no couples feed');
rollback;
