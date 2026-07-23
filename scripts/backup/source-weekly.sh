#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
backup_root="${CAREER_GROOVE_BACKUP_ROOT:-$repo_root/backups}"
timestamp="$(date +%Y%m%d_%H%M%S)"
manifest="$(mktemp)"

cleanup() {
  rm -f "$manifest"
}
trap cleanup EXIT

cd "$repo_root"
mkdir -p "$backup_root/source"

# Back up tracked files plus untracked files that are not ignored by .gitignore.
git ls-files -co --exclude-standard -z > "$manifest"

tar --null -T "$manifest" -czf "$backup_root/source/career_groove_source_${timestamp}.tar.gz"
tr '\0' '\n' < "$manifest" > "$backup_root/source/career_groove_source_${timestamp}_files.txt"

echo "Source backup written:"
echo "$backup_root/source/career_groove_source_${timestamp}.tar.gz"
echo "$backup_root/source/career_groove_source_${timestamp}_files.txt"
