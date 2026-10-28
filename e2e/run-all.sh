#!/usr/bin/env bash
# End-to-end run against a Supabase project (local `supabase start` or staging) and the web build.
# Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, REVENUECAT_WEBHOOK_SECRET, APP_URL
# Optional: PROTOTYPE_HTML (path to the private iOS prototype) to also produce side-by-side screenshots.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/flow out/app out/ref out/sheets
node reset.mjs >/dev/null
psql "$DATABASE_URL" -qc "delete from public.admins a using auth.users u where u.id = a.user_id and u.email like '%@renvi.test'"
node seed.mjs
node signup.e2e.mjs
node main.e2e.mjs
node extra.e2e.mjs
node invite.e2e.mjs
if [ -n "${PROTOTYPE_HTML:-}" ]; then
  node capture-prototype.mjs && node capture-all.mjs && python3 sheets.py
fi
