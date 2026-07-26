#!/usr/bin/env bash
set -Eeuo pipefail

readonly running_file=/mnt/storage/docker-infrastructure/restart-containers.txt
mkdir -p "$(dirname "${running_file}")"
docker ps --format '{{.Names}} {{.Image}}' |
  awk '$2 != "alpine:latest" { print $1 }' >"${running_file}"

systemctl restart containerd.service docker.socket docker.service
timeout 90 bash -c 'until docker info >/dev/null 2>&1; do sleep 2; done'

while read -r container; do
  docker start "${container}" >/dev/null
done <"${running_file}"

[[ "$(docker info --format '{{.DockerRootDir}}')" == "/mnt/storage/docker-data" ]]
docker info --format '{{json .DriverStatus}}' |
  grep -q 'io.containerd.snapshotter.v1'
echo "Docker restart verification completed."
