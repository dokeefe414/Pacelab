#!/usr/bin/env bash
# Restore into a THROWAWAY database, not the live application database.
set -euo pipefail
if [[ $# -ne 1 || ! -r "$1" ]]; then echo "Usage: bash deploy/test-restore-postgres.sh backup.dump" >&2; exit 2; fi
name="pacelab_restorecheck_${RANDOM}_${RANDOM}"
cleanup(){
  docker compose -f compose.production.yml exec -T db dropdb -U pacelab --if-exists "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker compose -f compose.production.yml exec -T db createdb -U pacelab "$name"
docker compose -f compose.production.yml exec -T db pg_restore -U pacelab --no-owner --no-acl --exit-on-error --dbname="$name" < "$1"
docker compose -f compose.production.yml exec -T db psql -U pacelab -d "$name" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | grep -Eq '[1-9][0-9]*'
echo "Temporary restore succeeded; live database was not modified."
