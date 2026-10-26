#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_root="${CAREER_GROOVE_BACKUP_ROOT:-$repo_root/backups}"
database_url="${DATABASE_URL:-}"

year="$(date +%Y)"
week="WK$(date +%V)"
day="$(date +%a%d)"
hour="$(date +%-H)"
if [[ "$hour" == "0" ]]; then
  hour="24"
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
destination_dir="$backup_root/database/$year/$week/$day/$hour"
destination="$destination_dir/career_groove_db_${timestamp}.dump"
staging="$destination_dir/.career_groove_db_${timestamp}.dump.tmp"

if [[ -z "$database_url" ]]; then
  echo "[database-backup] Skipping: DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "$destination_dir"

if ! pg_dump "$database_url" --format=custom --no-owner --no-acl > "$staging"; then
  echo "[database-backup] pg_dump failed." >&2
  rm -f "$staging"
  exit 1
fi

if ! pg_restore --list "$staging" >/dev/null 2>&1; then
  echo "[database-backup] Invalid dump; discarding: $staging" >&2
  rm -f "$staging"
  exit 1
fi

mv "$staging" "$destination"

echo "Database backup written:"
echo "$destination"
