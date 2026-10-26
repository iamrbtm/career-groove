#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
src_root="${CAREER_GROOVE_BACKUP_SOURCE_ROOT:-$repo_root}"
backup_root="${CAREER_GROOVE_BACKUP_ROOT:-$repo_root/backups}"
timestamp="$(date +%Y%m%d_%H%M%S)"
manifest="$(mktemp)"

cleanup() {
  rm -f "$manifest"
}
trap cleanup EXIT

if [[ ! -e "$src_root/.git" ]]; then
  echo "[source-backup] Skipping: source root is not a git repository: $src_root" >&2
  exit 1
fi

mkdir -p "$backup_root/source"

# Back up tracked files plus untracked files that are not ignored by .gitignore.
(cd "$src_root" && git ls-files -co --exclude-standard -z) > "$manifest"

(cd "$src_root" && tar --null -T "$manifest" -czf "$backup_root/source/career_groove_source_${timestamp}.tar.gz")
tr '\0' '\n' < "$manifest" > "$backup_root/source/career_groove_source_${timestamp}_files.txt"

echo "Source backup written:"
echo "$backup_root/source/career_groove_source_${timestamp}.tar.gz"
echo "$backup_root/source/career_groove_source_${timestamp}_files.txt"
