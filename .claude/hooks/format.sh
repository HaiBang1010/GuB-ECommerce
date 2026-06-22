#!/usr/bin/env bash
# PostToolUse(Edit|Write): format the file Claude just wrote with Prettier / prisma format.
# Reads the hook JSON from stdin; needs `jq` on PATH. Never blocks (always exit 0).
set -uo pipefail
input=$(cat)
file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -z "$file" ] && exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css) 
    if [ -x "node_modules/.bin/prettier" ]; then
      node_modules/.bin/prettier --write "$file" >/dev/null 2>&1 || true
    fi
    ;;
  *.prisma)
    npx --no-install prisma format --schema "$file" >/dev/null 2>&1 || true
    ;;
esac
exit 0
