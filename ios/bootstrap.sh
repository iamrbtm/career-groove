#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen 2.45.4 or newer is required: https://github.com/yonaskolb/XcodeGen"
  exit 1
fi
xcodegen generate
echo "Generated $(pwd)/CareerGroove.xcodeproj"
