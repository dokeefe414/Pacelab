#!/usr/bin/env bash
# Test an already hosted HTTPS full-stack app; read-only requests only.
set -euo pipefail
if [[ $# -ne 1 ]]; then
  echo "Usage: bash deploy/verify-public.sh https://YOUR-DOMAIN" >&2
  exit 2
fi
base="$1"
base="${base%/}"
if [[ "$base" != https://* || "$base" == *"@"* ]]; then
  echo "Supply HTTPS URL with no credentials." >&2
  exit 2
fi
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
echo "Checking public HTML..."
curl -fsS --max-time 15 "$base/" | grep -i "PaceLab" >/dev/null || { echo "No PaceLab HTML" >&2; exit 1; }
echo "Checking liveness..."
curl -fsS --max-time 15 "$base/api/health" |
python3 -c 'import json,sys; assert json.load(sys.stdin)["status"]=="ok"'
echo "Checking database readiness..."
curl -fsS --max-time 15 "$base/api/ready" |
python3 -c 'import json,sys; assert json.load(sys.stdin)["status"]=="ready"'
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$base/api/workouts")"
if [[ "$status" != "401" ]]; then
  echo "Expected 401 from anonymous workout API, got $status" >&2
  exit 1
fi
echo "Smoke checks passed. This does not replace security review."
