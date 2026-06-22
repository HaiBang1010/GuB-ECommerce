#!/usr/bin/env bash
# Stop hook: typecheck every workspace that defines a `typecheck` script.
# If it fails, exit 2 to keep Claude working until types are clean.
# (Phase 0: if no package.json yet, this is a no-op.)
set -uo pipefail
[ -f package.json ] || exit 0

out=$(npm run --workspaces --if-present typecheck 2>&1)
status=$?
if [ "$status" -ne 0 ]; then
  {
    echo "Typecheck failed — fix the type errors before finishing:"
    printf '%s\n' "$out" | tail -n 60
  } >&2
  exit 2   # blocks Stop; feeds stderr back to Claude
fi
exit 0
