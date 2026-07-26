#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[a-f0-9]{7,40}$ ]]; then
  echo "Usage: $0 <git-commit-sha>" >&2
  exit 64
fi

export CAREER_GROOVE_IMAGE_TAG=$1
readonly project_root=${CAREER_GROOVE_PROJECT_ROOT:-/mnt/storage/docker/career_groove}
readonly compose_file="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P
)/docker-compose.yml"
readonly infrastructure_env="${project_root}/.env.infrastructure"
readonly image_services=(api web document-worker backup-scheduler)
readonly runtime_services=(db api web document-worker backup-scheduler ollama)

if [[ ! -f "${project_root}/.env" || ! -f "${infrastructure_env}" ]]; then
  echo "Production environment files are missing under ${project_root}" >&2
  exit 1
fi

compose=(
  docker compose
  -p career_groove
  --project-directory "${project_root}"
  -f "${compose_file}"
  --env-file "${project_root}/.env"
  --env-file "${infrastructure_env}"
  --profile backups
  --profile local-ai
)

"${compose[@]}" pull "${image_services[@]}"
"${compose[@]}" up -d --no-build --remove-orphans --wait "${runtime_services[@]}"

for service in "${image_services[@]}"; do
  image="$("${compose[@]}" images --format json "${service}" |
    jq -r 'if type == "array" then .[0].Repository + ":" + .[0].Tag else .Repository + ":" + .Tag end')"
  echo "${service}: ${image}"
done
