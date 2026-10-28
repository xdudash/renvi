-- Referral codes: Latin letters and digits only (safe in links and easy to dictate).
create or replace function public.my_referral() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text; done int; goal int; prefix text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select code into c from public.referral_codes where user_id = auth.uid();
  if c is null then
    prefix := regexp_replace(upper(coalesce((select display_name from public.profiles where id = auth.uid()), '')), '[^A-Z]', '', 'g');
    if length(prefix) < 2 then prefix := 'RN'; end if;
    loop
      c := substr(prefix, 1, 2) || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
      begin
        insert into public.referral_codes (user_id, code) values (auth.uid(), c);
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  end if;
  select count(*) into done from public.referral_signups where code = c and status in ('verified','rewarded');
  select (value->>'goal')::int into goal from public.app_config where key = 'referral';
  return jsonb_build_object('code', c, 'verified', done, 'goal', coalesce(goal, 5));
end $$;
-- Re-issue any code that contains non-Latin characters.
delete from public.referral_codes where code !~ '^[A-Z0-9-]+$' and not exists (select 1 from public.referral_signups s where s.code = referral_codes.code);
