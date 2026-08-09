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
