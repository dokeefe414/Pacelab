#!/usr/bin/env bash
# Sensitive GPS and workout data: store encrypted outside the repository.
set -euo pipefail
umask 077
if [[ $# -ne 1 ]]; then echo "Usage: bash deploy/backup-postgres.sh /secure/path/backup.dump" >&2; exit 2; fi
destination="$1"
mkdir -p "$(dirname "$destination")"
if [[ -e "$destination" ]]; then echo "File already exists" >&2; exit 2; fi
tmp="${destination}.incomplete.$$"
trap 'rm -f "$tmp"' EXIT
docker compose -f compose.production.yml exec -T db pg_dump -U pacelab --format=custom --no-owner --no-acl --dbname=pacelab > "$tmp"
docker compose -f compose.production.yml exec -T db pg_restore --list < "$tmp" > /dev/null
mv -- "$tmp" "$destination"
echo "Backup written: $destination"
