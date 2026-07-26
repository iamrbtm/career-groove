#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[a-f0-9]{7,40}$ ]]; then
  echo "Usage: $0 <git-commit-sha>" >&2
  exit 64
fi

export CAREER_GROOVE_IMAGE_TAG=$1
readonly services=(api web document-worker backup-scheduler)

docker compose pull "${services[@]}"
docker compose up -d --no-build --wait "${services[@]}"

for service in "${services[@]}"; do
  image="$(docker compose images --format json "${service}" |
    jq -r 'if type == "array" then .[0].Repository + ":" + .[0].Tag else .Repository + ":" + .Tag end')"
  echo "${service}: ${image}"
done
