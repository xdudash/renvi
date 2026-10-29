-- Credentials stay in Auth. Admins may discover only explicitly registered demo accounts.
create or replace function public.admin_demo_accounts()
returns table(id uuid, email text, display_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return query
    select u.id, u.email::text, p.display_name
    from public.demo_bots b
    join auth.users u on u.id = b.user_id
    left join public.profiles p on p.id = u.id
    where lower(u.email) ~ '^[^@[:space:]]+@demo[.]renvi[.]app$'
      and not exists (select 1 from public.admins a where a.user_id = u.id)
    order by u.email;
end $$;
revoke all on function public.admin_demo_accounts() from public, anon;
grant execute on function public.admin_demo_accounts() to authenticated;
-- The Edge Function reserves a password-free admin_actions record before calling Auth,
-- then changes only its status. Clients retain SELECT-only audit permissions.
