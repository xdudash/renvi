-- Block A (0036): relationship status gates dating, visibility modes, goals, couple profiles.
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
  select ('00000000-0000-0000-0000-0000000036' || lpad(n::text, 2, '0'))::uuid
$$;
-- Runs a statement and returns its SQLSTATE ('' when it succeeds).
create or replace function pg_temp.state(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return ''; exception when others then return sqlstate; end $$;
create or replace function pg_temp.feed() returns text language sql as $$
  select coalesce(string_agg(display_name, ',' order by display_name), '') from public.discover(50)
$$;

insert into auth.users (id, email, email_confirmed_at) select pg_temp.uid(n), 'm' || n || '@modes.test', now() from generate_series(1, 5) g(n);
insert into public.profiles (id, display_name, age, gender, seeking, country, city, intent, onboarding_done) values
  (pg_temp.uid(1), 'Me', 28, 'man', 'women', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(2), 'Anna', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(3), 'Bea', 27, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(4), 'Cili', 26, 'woman', 'men', 'SK', 'Bratislava', 'serious', true),
  (pg_temp.uid(5), 'Dan', 30, 'man', 'women', 'SK', 'Bratislava', 'serious', true);

-- ---- status gates dating ----
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.feed() = 'Anna,Bea,Cili', 'everyone is single by default: all three are in the feed');
select pg_temp.check((public.my_modes()->>'status') = 'single' and (public.my_modes()->>'dating_open')::boolean, 'my_modes: single, dating open');

select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check(pg_temp.state($$select public.set_relationship_status('divorced')$$) = '22023', 'invalid status is rejected');
select public.set_relationship_status('relationship');
select pg_temp.check(not (public.my_modes()->>'dating_open')::boolean, 'in a relationship: dating closed for me');
select pg_temp.check(pg_temp.feed() = '', 'in a relationship: my feed is empty');
select pg_temp.check(pg_temp.state(format($$select public.send_spark(%L, 'profile', null, null)$$, pg_temp.uid(5))) = 'P0007', 'in a relationship: cannot send a spark');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.feed() = 'Bea,Cili', 'a person in a relationship disappears from other feeds');
select pg_temp.check(pg_temp.state(format($$select public.send_spark(%L, 'profile', null, null)$$, pg_temp.uid(2))) = 'P0007', 'cannot spark a person whose dating is closed');

select pg_temp.as_user(pg_temp.uid(2));
select public.set_relationship_status('single');
select pg_temp.check((public.my_modes()->>'dating_open_at') is not null and not (public.my_modes()->>'dating_open')::boolean, 'back to single: dating opens only after a cooldown');
select pg_temp.check((public.my_modes()->>'dating_open_at')::timestamptz between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour', 'the cooldown is 7 days');
select pg_temp.check(pg_temp.state($$select public.set_visibility(true, true, 'all', false)$$) = '', 'single may switch dating on (still in the cooldown)');
select pg_temp.as_user(null);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.feed() = 'Bea,Cili', 'still in the cooldown: not in the feed');
select pg_temp.as_user(pg_temp.uid(2));
reset role; update public.profiles set dating_open_at = now() - interval '1 minute' where id = pg_temp.uid(2);
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.feed() = 'Anna,Bea,Cili', 'cooldown over: back in the feed');

-- ---- visibility ----
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check(pg_temp.state($$select public.set_visibility(true, true, 'everyone', false)$$) = '22023', 'invalid audience is rejected');
select public.set_visibility(false, true, 'women', false);
select pg_temp.check((public.my_modes()->>'dating')::boolean = false and public.my_modes()->>'audience' = 'women', 'visibility saved');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.feed() = 'Anna,Cili', 'dating switched off: not in the feed');
select pg_temp.as_user(pg_temp.uid(4));
select public.set_relationship_status('married');
select pg_temp.check(pg_temp.state($$select public.set_visibility(true, true, 'all', false)$$) = 'P0007', 'dating cannot be switched on while married');
select public.set_visibility(false, false, 'all', true);
select pg_temp.check((public.my_modes()->>'paused')::boolean, 'pause saved');

-- ---- goals ----
select pg_temp.as_user(pg_temp.uid(5));
select pg_temp.check(pg_temp.state($$select public.set_goals('{}')$$) = '22023', 'empty goals are rejected');
select pg_temp.check(pg_temp.state($$select public.set_goals('{company,wine}')$$) = '22023', 'unknown goal is rejected');
select public.set_goals('{look,company,company}');
select pg_temp.check((public.my_modes()->'goals') = '["company","look"]'::jsonb, 'goals are saved without duplicates, sorted');

-- ---- couples ----
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check(pg_temp.state($$select public.couple_create_code()$$) = 'P0007', 'a code needs the status "couple"');
select public.set_relationship_status('couple');
create temp table t_code as select public.couple_create_code()->>'code' as code;
grant select on t_code to authenticated;
select pg_temp.check((select code from t_code) ~ '^[A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3}$', 'code format XXX-XXX without look-alike characters');
select pg_temp.check((public.couple_create_code()->>'code') = (select code from t_code), 'asking again returns the same open code');
select pg_temp.check((public.couple_accept((select code from t_code))->>'found')::boolean = false, 'cannot accept your own code');
select pg_temp.as_user(pg_temp.uid(3));
select pg_temp.check((public.couple_preview((select lower(code) from t_code))->>'name') = 'Me', 'preview shows who invited (case-insensitive code)');
select pg_temp.check((public.couple_accept('ZZZ-999')->>'found')::boolean = false, 'unknown code is rejected');
select pg_temp.check((public.couple_accept((select code from t_code))->>'partner_id')::uuid = pg_temp.uid(1), 'accept links the profiles');
select pg_temp.check((public.my_modes()->>'status') = 'couple', 'the invitee becomes "couple" too');
select pg_temp.check((public.my_couple()->'partner'->>'name') = 'Me' and (public.my_couple()->>'status') = 'active', 'my_couple shows the partner');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.my_couple()->'partner'->>'name') = 'Bea', 'and the other way round');
select pg_temp.check(pg_temp.feed() = '', 'a couple is out of the dating feed');
select pg_temp.as_user(pg_temp.uid(5));
select public.set_relationship_status('couple');
select pg_temp.check((public.couple_accept((select code from t_code))->>'found')::boolean = false, 'a used code no longer works');
select pg_temp.check(pg_temp.state($$select count(*) from public.couples$$) = '42501', 'couples table is closed to direct reads');
-- expired code
create temp table t_code2 as select public.couple_create_code()->>'code' as code;
reset role; update public.couples set expires_at = now() - interval '1 minute' where code = (select code from t_code2);
select pg_temp.as_user(pg_temp.uid(2));
select pg_temp.check((public.couple_accept((select code from t_code2))->>'found')::boolean = false, 'an expired code is rejected');
-- guess limit
do $$ declare i int; s text; begin
  for i in 1..9 loop s := pg_temp.state($q$select public.couple_preview('AAA-AA2')$q$); end loop;
  if s <> 'P0006' then raise exception 'FAILED: guessing is not limited (%)', s; end if;
  raise notice 'ok - code guessing is limited to 8 attempts per hour';
end $$;
-- leaving
select pg_temp.as_user(pg_temp.uid(3));
select public.couple_leave();
select pg_temp.check((public.my_modes()->>'status') = 'relationship' and public.my_couple() is null, 'leaving ends the couple and sets a neutral status');
select pg_temp.as_user(pg_temp.uid(1));
select pg_temp.check((public.my_modes()->>'status') = 'relationship', 'the partner gets the neutral status too');
-- changing status away from couple ends a pending invite
select public.set_relationship_status('couple');
select public.couple_create_code();
select public.set_relationship_status('single');
select pg_temp.check(public.my_couple() is null, 'leaving the "couple" status cancels the open invite');
rollback;
