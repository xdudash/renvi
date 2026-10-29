-- Follow-up audit fixes (billing commit checks were removed together with subscriptions in 0029).
begin;
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
-- The one remaining limit (daily_spark_limit) accepts only a whole number; a malformed value is refused.
do $$
begin
  begin
    perform public.admin_config_validate('daily_spark_limit','"20"');
    raise exception 'FAILED: string spark limit accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.admin_config_validate('tier_limits','{"free":{"daily_likes":20}}');
    raise exception 'FAILED: removed tier_limits key accepted';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'ok - spark limit must be a number and tier_limits is gone';
end $$;
rollback;
