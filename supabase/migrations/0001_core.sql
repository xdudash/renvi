-- RENVI core schema. Everything is in the public schema; access is governed by RLS.
create extension if not exists pgcrypto;

-- ---------- configuration (editable by admins, read by everyone) ----------
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config (key, value) values
  ('tier_limits', '{"free":{"daily_likes":20,"see_incoming":false,"advanced_filters":false,"undo_pass":false,"incognito":false},
                    "plus":{"daily_likes":100,"see_incoming":true,"advanced_filters":true,"undo_pass":true,"incognito":false},
                    "premium":{"daily_likes":300,"see_incoming":true,"advanced_filters":true,"undo_pass":true,"incognito":true}}'),
  ('prices_preliminary', '{"plus":{"month":9.99,"year":59.99},"premium":{"month":19.99,"year":119.99}}'),
  ('countries', '["SK","CZ","AT","DE","PL","HU","SI","HR","IT","FR","ES","PT","NL","BE","LU","IE","DK","SE","FI","EE","LV","LT","RO","BG","GR","CY","MT"]'),
  ('launch_countries', '["SK"]'),
  ('languages', '["SK","CS","EN","RU","UA"]');

-- ---------- admins ----------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age smallint,
  gender text check (gender in ('man','woman','nonbinary','undisclosed')),
  seeking text check (seeking in ('men','women','everyone')),
  intent text check (intent in ('serious','casual','friends','unsure')),
  country text not null default 'SK',
  city text,
  bio text not null default '' check (char_length(bio) <= 500),
  interests text[] not null default '{}' check (cardinality(interests) <= 5),
  music_title text,
  music_url text,
  language text not null default 'RU' check (language in ('SK','CS','EN','RU','UA')),
  onboarding_step smallint not null default 0,
  onboarding_done boolean not null default false,
  terms_accepted_at timestamptz,
  adult_confirmed_at timestamptz,
  sensitive_consent_at timestamptz,
  paused boolean not null default false,
  show_active boolean not null default true,
  incognito boolean not null default false,
  verification_status text not null default 'none'
    check (verification_status in ('none','pending','approved','rejected')),
  blocked_until timestamptz,
  suspended_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exact birth date and coordinates never leave this table; only the owner and admins read it.
create table public.private_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  birthdate date,
  lat double precision,
  lng double precision,
  location_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  kind text not null default 'photo' check (kind in ('photo','video')),
  position smallint not null default 0,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.profile_photos (profile_id, position);

create table public.profile_prompts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null,
  answer text not null check (char_length(answer) between 1 and 300),
  position smallint not null default 0
);
create index on public.profile_prompts (profile_id);

-- ---------- interactions ----------
create table public.passes (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

create table public.sparks (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  target_kind text not null default 'profile' check (target_kind in ('profile','photo','prompt')),
  target_ref uuid,
  comment text check (char_length(comment) <= 280),
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  unique (from_id, to_id)
);
create index on public.sparks (to_id, created_at desc);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.profiles(id),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text check (char_length(body) <= 2000),
  photo_path text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index on public.messages (match_id, created_at);

create table public.match_settings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  muted boolean not null default false,
  archived boolean not null default false,
  primary key (user_id, match_id)
);

create table public.match_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

create table public.dates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  place_key text not null check (place_key in ('eurovea','oldtown','castle','sad','custom')),
  place_custom text check (char_length(place_custom) between 2 and 60),
  day date not null,
  starts_at time not null,
  note text check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.dates (match_id, created_at desc);

-- ---------- safety ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid references public.profiles(id) on delete set null,
  target_message_id uuid references public.messages(id) on delete set null,
  reason text not null check (reason in ('fake','photos','harassment','scam','underage','illegal','other')),
  details text check (char_length(details) <= 1000),
  message_snapshot text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  decision text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  details text not null check (char_length(details) between 5 and 1000),
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  created_at timestamptz not null default now()
);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text,
  body text not null check (char_length(body) between 5 and 2000),
  include_history boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.account_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('warning','suspension','ban')),
  reason text not null,
  until timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- billing (written only by the server, never by the client) ----------
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','plus','premium')),
  store text check (store in ('app_store','play_store')),
  expires_at timestamptz,
  sandbox boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------- notifications ----------
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now()
);

-- ---------- error journal ----------
create table public.error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  area text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger dates_touch before update on public.dates for each row execute function public.touch_updated_at();
