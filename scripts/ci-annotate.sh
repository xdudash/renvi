#!/usr/bin/env bash
# Runs a check; on failure, prints its error lines as GitHub annotations (visible on the PR page).
# Usage: scripts/ci-annotate.sh "<title>" <command...>
title=$1; shift
out=$("$@" 2>&1); code=$?
printf '%s\n' "$out"
if [ $code -ne 0 ]; then
  printf '%s\n' "$out" | grep -E 'error|Error|FAIL|✖|warning' | grep -v '^\s*$' | head -40 | while IFS= read -r line; do
    printf '::error title=%s::%s\n' "$title" "$(printf '%s' "$line" | tr -d '\r' | sed 's/%/%25/g')"
  done
fi
exit $code
