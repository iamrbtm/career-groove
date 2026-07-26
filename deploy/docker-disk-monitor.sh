#!/usr/bin/env bash
set -Eeuo pipefail

readonly warning_percent=75
readonly critical_percent=85

check_mount() {
  local mount_point=$1
  local usage
  usage="$(df -P "${mount_point}" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
  if (( usage >= critical_percent )); then
    logger -p daemon.err -t docker-storage-monitor \
      "CRITICAL: ${mount_point} is ${usage}% full"
  elif (( usage >= warning_percent )); then
    logger -p daemon.warning -t docker-storage-monitor \
      "WARNING: ${mount_point} is ${usage}% full"
  fi
}

check_mount /
check_mount /mnt/storage

if ! docker info >/dev/null 2>&1; then
  logger -p daemon.err -t docker-storage-monitor \
    "CRITICAL: Docker daemon is unavailable"
fi
