#!/usr/bin/env bash
# End-to-end run against a Supabase project (local `supabase start` or staging) and the web build.
# Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, REVENUECAT_WEBHOOK_SECRET, APP_URL
# Optional: PROTOTYPE_HTML (path to the private iOS prototype) to also produce side-by-side screenshots.
#
# Setup must succeed (set -e). The test scripts all run even if one fails, but the run exits non-zero
# if ANY script exited non-zero (each script exits 1 when any of its steps failed).
set -euo pipefail
cd "$(dirname "$0")"
# Setup failures are annotated too (visible on the PR page).
trap 'echo "::error title=E2E setup::failed: $BASH_COMMAND (line $LINENO)"' ERR
mkdir -p out/flow out/app out/ref out/sheets
node reset.mjs >/dev/null
psql "$DATABASE_URL" -qc "delete from public.admins a using auth.users u where u.id = a.user_id and u.email like '%@renvi.test'"
node seed.mjs

trap - ERR
failed_scripts=()
for script in signup auth main extra invite; do
  if ! node "$script.e2e.mjs"; then
    failed_scripts+=("$script.e2e.mjs")
  fi
done

if [ -n "${PROTOTYPE_HTML:-}" ]; then
  node capture-prototype.mjs && node capture-all.mjs && python3 sheets.py
fi

if [ "${#failed_scripts[@]}" -gt 0 ]; then
  echo "E2E FAILED in: ${failed_scripts[*]}" >&2
  exit 1
fi
echo "E2E: all scripts passed"
