#!/usr/bin/env bash
set -Eeuo pipefail

exec 9>/run/docker-cache-prune.lock
if ! flock -n 9; then
  logger -t docker-maintenance "Cache prune skipped because another run is active"
  exit 0
fi

before="$(docker buildx du 2>/dev/null | awk '/^Total:/ { print $2 }')"
docker buildx prune --force --filter "until=168h" >/dev/null
after="$(docker buildx du 2>/dev/null | awk '/^Total:/ { print $2 }')"
logger -t docker-maintenance \
  "Weekly cache prune completed: before=${before:-unknown} after=${after:-unknown}"
