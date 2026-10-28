-- profiles.language had NOT NULL DEFAULT 'RU', so a user who never chose a language got 'RU' from the
-- profile, and the client applied it over the language chosen locally. NULL now means "never chosen".
-- Existing rows are NOT touched: whether they were chosen explicitly is not knowable.
-- The check constraint (language in (...)) still allows NULL, because a check passes on NULL.
alter table public.profiles alter column language drop not null;
alter table public.profiles alter column language drop default;
-- save_onboarding (0002) uses coalesce(p_patch->>'language', language): a patch without a language keeps NULL.
