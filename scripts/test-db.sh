#!/usr/bin/env bash
# Runs all migrations on a throw-away Postgres database and executes the behavioural tests.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
DB=${TEST_DB:-renvi_test}
psql -qc "drop database if exists $DB" -c "create database $DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f supabase/tests/bootstrap.sql
for f in supabase/migrations/*.sql; do psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f"; done
out=$(psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql 2>&1) || { echo "$out" | grep -E "ERROR|FAILED"; exit 1; }
echo "$out" | grep -c "ok -" | xargs -I{} echo "{} database checks passed"
