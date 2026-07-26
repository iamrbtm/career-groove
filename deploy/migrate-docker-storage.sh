#!/usr/bin/env bash
set -Eeuo pipefail

readonly docker_source=/var/lib/docker
readonly containerd_source=/var/lib/containerd
readonly docker_target=/mnt/storage/docker-data
readonly containerd_target=/mnt/storage/containerd-data
readonly state_dir=/mnt/storage/docker-infrastructure
readonly backup_dir="${state_dir}/rollback-$(date -u +%Y%m%dT%H%M%SZ)"
readonly running_file="${backup_dir}/running-containers.txt"

if [[ "$(docker info --format '{{.DockerRootDir}}')" == "${docker_target}" ]]; then
  echo "Docker already uses ${docker_target}; migration is not required."
  exit 0
fi

mkdir -p "${backup_dir}/etc/docker" "${backup_dir}/etc/containerd"
touch "${running_file}"
docker ps --format '{{.Names}} {{.Image}}' |
  awk '$2 != "alpine:latest" { print $1 }' >"${running_file}"

if [[ -f /etc/docker/daemon.json ]]; then
  cp -a /etc/docker/daemon.json "${backup_dir}/etc/docker/daemon.json"
fi
if [[ -f /etc/containerd/config.toml ]]; then
  cp -a /etc/containerd/config.toml "${backup_dir}/etc/containerd/config.toml"
fi

rollback() {
  local exit_code=$?
  echo "Migration failed; restoring prior daemon configuration." >&2
  if [[ -f "${backup_dir}/etc/docker/daemon.json" ]]; then
    cp -a "${backup_dir}/etc/docker/daemon.json" /etc/docker/daemon.json
  else
    rm -f /etc/docker/daemon.json
  fi
  if [[ -f "${backup_dir}/etc/containerd/config.toml" ]]; then
    cp -a "${backup_dir}/etc/containerd/config.toml" /etc/containerd/config.toml
  else
    rm -f /etc/containerd/config.toml
  fi
  systemctl start containerd docker.socket docker.service || true
  if docker info >/dev/null 2>&1; then
    xargs -r docker start <"${running_file}" || true
  fi
  exit "${exit_code}"
}
trap rollback ERR

xargs -r docker stop --timeout 60 <"${running_file}"
systemctl stop docker.service docker.socket containerd.service

mkdir -p "${docker_target}" "${containerd_target}" /etc/docker /etc/containerd
rsync -aHAXx --numeric-ids --delete "${docker_source}/" "${docker_target}/"
rsync -aHAXx --numeric-ids --delete "${containerd_source}/" "${containerd_target}/"

install -m 0644 \
  /mnt/storage/docker/career_groove/.worktrees/expo-migration/deploy/docker-daemon.json \
  /etc/docker/daemon.json
install -m 0644 \
  /mnt/storage/docker/career_groove/.worktrees/expo-migration/deploy/containerd-config.toml \
  /etc/containerd/config.toml

dockerd --validate --config-file=/etc/docker/daemon.json
containerd --config /etc/containerd/config.toml config dump >/dev/null

systemctl start containerd docker.socket docker.service
timeout 90 bash -c 'until docker info >/dev/null 2>&1; do sleep 2; done'
while read -r container; do
  docker start "${container}" || echo "Could not restore ${container}" >&2
done <"${running_file}"
timeout 120 bash -c \
  'until [[ "$(docker ps --format "{{.Names}}" | wc -l)" -ge 1 ]]; do sleep 2; done'

[[ "$(docker info --format '{{.DockerRootDir}}')" == "${docker_target}" ]]
docker info --format '{{json .DriverStatus}}' | grep -q 'io.containerd.snapshotter.v1'

trap - ERR
find "${docker_source}" -mindepth 1 -xdev -delete
find "${containerd_source}" -mindepth 1 -xdev -delete
echo "${backup_dir}" >"${state_dir}/latest-successful-migration"
echo "Docker storage migration completed successfully."
