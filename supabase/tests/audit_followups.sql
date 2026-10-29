-- Atomic billing commits must reject work computed from an obsolete row and leave the event retryable.
begin;
insert into auth.users(id,email) values ('10000000-0000-4000-8000-000000000001','followups@example.test');
do $$
declare uid uuid := '10000000-0000-4000-8000-000000000001'; before_row jsonb; wrote jsonb;
begin
  select jsonb_build_object('user_id',user_id,'tier',tier,'store',store,'sandbox',sandbox,
    'expires_at',expires_at,'product_id',product_id,'last_event_ms',last_event_ms)
    into before_row from public.subscriptions where user_id=uid;
  wrote := jsonb_build_object('user_id',uid,'tier','premium','store','app_store','sandbox',false,
    'expires_at',null,'product_id','premium.year','last_event_ms',300);
  perform public.billing_commit(jsonb_build_object('id','atomic-new','type','RENEWAL','user_id',uid,'event_ms',300),
    jsonb_build_array(jsonb_build_object('user_id',uid,'row',before_row)), jsonb_build_array(wrote));
  begin
    perform public.billing_commit(jsonb_build_object('id','atomic-stale','type','RENEWAL','user_id',uid,'event_ms',100),
      jsonb_build_array(jsonb_build_object('user_id',uid,'row',before_row)),
      jsonb_build_array(wrote || '{"tier":"plus","last_event_ms":100}'::jsonb));
    raise exception 'FAILED: outdated billing commit accepted';
  exception when serialization_failure then null;
  end;
  if (select tier from public.subscriptions where user_id=uid) <> 'premium' then raise exception 'FAILED: stale state regression'; end if;
  if exists(select 1 from public.billing_events where id='atomic-stale') then raise exception 'FAILED: failed event recorded'; end if;
  if not public.billing_commit(jsonb_build_object('id','atomic-new','type','RENEWAL','user_id',uid,'event_ms',300),'[]','[]') then
    raise exception 'FAILED: duplicate event not recognized';
  end if;
  raise notice 'ok - billing snapshot conflict preserves newer state and leaves event retryable';
  select jsonb_build_object('user_id',user_id,'tier',tier,'store',store,'sandbox',sandbox,
    'expires_at',expires_at,'product_id',product_id,'last_event_ms',last_event_ms)
    into before_row from public.subscriptions where user_id=uid;
  begin
    perform public.billing_commit(jsonb_build_object('id','atomic-rollback','type','TRANSFER','user_id',uid,'event_ms',400),
      jsonb_build_array(jsonb_build_object('user_id',uid,'row',before_row),
        jsonb_build_object('user_id','10000000-0000-4000-8000-000000000099','row',null)),
      jsonb_build_array(wrote || '{"tier":"free","last_event_ms":400}'::jsonb,
        wrote || '{"user_id":"10000000-0000-4000-8000-000000000099","last_event_ms":400}'::jsonb));
    raise exception 'FAILED: billing transfer with missing recipient accepted';
  exception when foreign_key_violation then null;
  end;
  if (select tier from public.subscriptions where user_id=uid) <> 'premium' or
    exists(select 1 from public.billing_events where id='atomic-rollback') then
    raise exception 'FAILED: partial billing transfer or receipt survived rollback';
  end if;
  if has_function_privilege('authenticated','public.billing_commit(jsonb,jsonb,jsonb)','execute') or
    has_function_privilege('anon','public.billing_commit(jsonb,jsonb,jsonb)','execute') then
    raise exception 'FAILED: billing commit exposed to clients';
  end if;
  raise notice 'ok - billing commits roll back all writes and receipt on failure and are service-only';
end $$;
-- A removed photo must immediately stop being readable by other users, even if the blob remains.
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000002','photo-owner@example.test',now()),
 ('10000000-0000-4000-8000-000000000003','photo-viewer@example.test',now());
insert into public.profiles(id,display_name,age,gender,seeking,intent,country,city,onboarding_done,terms_accepted_at,adult_confirmed_at,sensitive_consent_at)
values ('10000000-0000-4000-8000-000000000002','Owner',30,'man','women','serious','SK','Bratislava',true,now(),now(),now()),
 ('10000000-0000-4000-8000-000000000003','Viewer',30,'woman','men','serious','SK','Bratislava',true,now(),now(),now());
insert into public.profile_photos(profile_id,storage_path) values
 ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002/profile/photo.jpg');
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$
begin
 if not public.can_read_media('10000000-0000-4000-8000-000000000002/profile/photo.jpg') then raise exception 'FAILED: published photo inaccessible'; end if;
 delete from public.profile_photos where profile_id='10000000-0000-4000-8000-000000000002';
 if public.can_read_media('10000000-0000-4000-8000-000000000002/profile/photo.jpg') then raise exception 'FAILED: removed photo still accessible'; end if;
 perform set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
 if not public.can_read_media('10000000-0000-4000-8000-000000000002/profile/photo.jpg') then raise exception 'FAILED: owner lost media access'; end if;
 raise notice 'ok - removed profile photo loses third-party storage access and owner retains access';
end $$;
-- A malformed feature flag previously passed validation and broke tier_flag at runtime.
do $$
begin
  begin
    perform public.admin_config_validate('tier_limits','{"free":{"daily_likes":20,"see_incoming":2},"plus":{"daily_likes":20},"premium":{"daily_likes":20}}');
    raise exception 'FAILED: numeric feature flag accepted';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok - tier boolean flags reject numeric values';
end $$;
rollback;
