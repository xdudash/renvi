-- Security Advisor: seven public functions without a fixed search_path (function_search_path_mutable).
-- ALTER FUNCTION only adds the setting: bodies, owners, triggers and privileges stay exactly as they were.
-- Checked first: every object these bodies touch is either schema-qualified (public.is_admin()) or in pg_catalog
-- (now(), jsonb_build_object, to_jsonb, cardinality, current_user, tg_op), and none is SECURITY DEFINER, so the
-- behaviour is unchanged. Older migrations (0001–0035) are not edited.
alter function public.touch_updated_at() set search_path = public;
alter function public.guard_profile_update() set search_path = public;
alter function public.guard_profile_insert() set search_path = public;
alter function public.guard_profile_delete() set search_path = public;
alter function public.guard_photo_update() set search_path = public;
alter function public.profiles_set_published_at() set search_path = public;
alter function public.profile_details_json(public.profiles) set search_path = public;
