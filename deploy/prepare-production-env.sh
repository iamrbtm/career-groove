#!/usr/bin/env bash
set -Eeuo pipefail

readonly project_root=${1:-/mnt/storage/docker/career_groove}
readonly source_env="${project_root}/.env"
readonly infrastructure_env="${project_root}/.env.infrastructure"
readonly image_tag=${2:?Provide the immutable image tag}

read_env() {
  local key=$1
  [[ -f "${source_env}" ]] || return 0
  sed -n "s/^${key}=//p" "${source_env}" | tail -n 1
}

postgres_password="$(
  docker inspect career_groove-db-1 --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^POSTGRES_PASSWORD=//p' |
    tail -n 1
)"
if [[ -z "${postgres_password}" ]]; then
  echo "Could not recover the active PostgreSQL password" >&2
  exit 1
fi

provider_key="$(read_env PROVIDER_ENCRYPTION_KEY)"
if (( ${#provider_key} < 32 )); then
  provider_key="$(read_env AUTH_SECRET)"
fi
if (( ${#provider_key} < 32 )); then
  provider_key="$(openssl rand -hex 32)"
fi

worker_secret="$(read_env INTERNAL_WORKER_SECRET)"
if (( ${#worker_secret} < 32 )); then
  worker_secret="$(openssl rand -hex 32)"
fi

umask 077
{
  printf 'ALLOWED_ORIGINS=%s\n' \
    "${ALLOWED_ORIGINS:-https://careergroove.website}"
  printf 'CAREER_GROOVE_IMAGE_TAG=%s\n' "${image_tag}"
  printf 'EXPO_PUBLIC_API_URL=%s\n' \
    "${EXPO_PUBLIC_API_URL:-https://careergroove.website}"
  printf 'INTERNAL_WORKER_SECRET=%s\n' "${worker_secret}"
  printf 'OLLAMA_MODELS_DIR=%s\n' "${project_root}/.ollama"
  printf 'POSTGRES_PASSWORD=%s\n' "${postgres_password}"
  printf 'PROVIDER_ENCRYPTION_KEY=%s\n' "${provider_key}"
} >"${infrastructure_env}"
chmod 0600 "${infrastructure_env}"

echo "Prepared ${infrastructure_env} with mode 0600."
