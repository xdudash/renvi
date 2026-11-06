#!/usr/bin/env bash
# Runs all migrations on a throw-away Postgres database and executes the behavioural tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
DB=${TEST_DB:-renvi_test}
psql -qc "drop database if exists $DB" -c "create database $DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/tests/bootstrap.sql
for f in supabase/migrations/*.sql; do psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"; done

# SQL suites, in a fixed order. A suite listed here but not present on this branch is skipped.
run_sql() {
  local file=$1 label=$2
  [ -f "$file" ] || return 0
  out=$(psql -d "$DB" -v ON_ERROR_STOP=1 -f "$file" 2>&1) || { echo "$out" | grep -E "ERROR|FAILED"; exit 1; }
  echo "$out" | grep -c "ok -" | xargs -I{} echo "{} $label checks passed"
}
run_sql supabase/tests/rls.sql "database"
run_sql supabase/tests/demo_bots.sql "demo-bot"
run_sql supabase/tests/security.sql "security-audit"
run_sql supabase/tests/rate_limits.sql "rate-limit / push-token"
run_sql supabase/tests/profile_language.sql "profile-language"
run_sql supabase/tests/digest.sql "weekly-digest"
run_sql supabase/tests/video_calls.sql "video-call"
run_sql supabase/tests/voice.sql "voice-message"
run_sql supabase/tests/audit_server.sql "audit server-rules"
run_sql supabase/tests/admin.sql "admin-panel"
run_sql supabase/tests/admin_ui.sql "admin-ui (review fixes)"
run_sql supabase/tests/extensions.sql "extension-portability"
run_sql supabase/tests/integration.sql "cross-feature"

run_sql supabase/tests/analytics.sql "analytics"
run_sql supabase/tests/identity_auth.sql "identity and verified email"
run_sql supabase/tests/demo_access.sql "demo access"
run_sql supabase/tests/audit_followups.sql "audit followups"
run_sql supabase/tests/audit_concurrency.sql "transaction locks"
run_sql supabase/tests/no_subscriptions.sql "free for everyone (no subscriptions)"
run_sql supabase/tests/bugfixes.sql "bug hunt 2026-10-29"
run_sql supabase/tests/profile_details.sql "profile details"
run_sql supabase/tests/detail_filters.sql "detail filters + analytics retention"
run_sql supabase/tests/recycle_passes.sql "passed profiles come back"
run_sql supabase/tests/modes_pairs.sql "modes, status and couples"
run_sql supabase/tests/plans.sql "plans"
run_sql supabase/tests/company_couples.sql "company and couples"
run_sql supabase/tests/playbook.sql "playbook (men's course)"
run_sql supabase/tests/plus_money.sql "plus and money"
run_sql supabase/tests/chats_unified.sql "unified chat list"
run_sql supabase/tests/plan_extras.sql "plan extras (21:00 check, polls, company hello)"
run_sql supabase/tests/search_path.sql "fixed search_path"
run_sql supabase/tests/revenuecat_events.sql "RevenueCat events"

# Edge Function unit tests (pure TypeScript, no network).
shopt -s nullglob
tests=(supabase/tests/*.test.ts)
if [ ${#tests[@]} -gt 0 ]; then
  if command -v bun >/dev/null; then bun test "${tests[@]}"; else echo "bun not found: Edge Function tests skipped"; fi
fi
