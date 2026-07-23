#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_root="${CAREER_GROOVE_BACKUP_ROOT:-$repo_root/backups}"
compose_file="${CAREER_GROOVE_COMPOSE_FILE:-$repo_root/docker-compose.yml}"
db_service="${CAREER_GROOVE_DB_SERVICE:-db}"
db_name="${CAREER_GROOVE_DB_NAME:-career_groove}"
db_user="${CAREER_GROOVE_DB_USER:-career_groove}"
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

mkdir -p "$destination_dir"
cd "$repo_root"

if [[ -n "$database_url" ]]; then
  pg_dump "$database_url" --format=custom --no-owner --no-acl > "$destination"
else
  docker compose -f "$compose_file" exec -T "$db_service" \
    pg_dump -U "$db_user" -d "$db_name" --format=custom --no-owner --no-acl \
    > "$destination"
fi

echo "Database backup written:"
echo "$destination"
