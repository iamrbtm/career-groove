#!/usr/bin/env bash
set -euo pipefail

tmp="$(mktemp)"
created_env_file=0
if [[ ! -e .env ]]; then
  : > .env
  created_env_file=1
fi

cleanup() {
  rm -f "$tmp"
  if [[ "$created_env_file" -eq 1 ]]; then
    rm -f .env
  fi
}
trap cleanup EXIT

docker compose config --no-interpolate > "$tmp"

rg -q 'source: .*db/data' "$tmp"
rg -q 'target: /var/lib/postgresql/data' "$tmp"
! rg -q '^  ollama:$' "$tmp"
rg -q 'host\.docker\.internal[=:]host-gateway' "$tmp"
rg -q 'CAREER_GROOVE_OLLAMA_BASE_URL:-http://host\.docker\.internal:11434' "$tmp"
for service in document-worker mobile-notification-worker follow-up-worker backup-scheduler; do
  rg -U -q "^  ${service}:\n    profiles:\n      - workers$" "$tmp"
done
rg -U -q '^  document-worker:.*?depends_on:\n      db:\n        condition: service_healthy\n      redis:\n        condition: service_healthy' "$tmp"
rg -U -q '^  backup-scheduler:.*?depends_on:\n      db:\n        condition: service_healthy' "$tmp"
