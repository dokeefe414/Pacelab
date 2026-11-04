#!/usr/bin/env bash
# Operator-only preflight: no deployment, DB mutation or secret printing.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null || { echo "Docker Compose v2 is required" >&2; exit 1; }
[[ -r .env ]] || { echo "Create a private .env first" >&2; exit 1; }
python3 - <<'PY'
from pathlib import Path
import re,sys
values={}
for raw in Path(".env").read_text(encoding="utf-8").splitlines():
    raw=raw.strip()
    if not raw or raw.startswith("#") or "=" not in raw:continue
    k,v=raw.split("=",1)
    values[k.strip()]=v.strip().strip("'\"")
secret=values.get("PACELAB_SECRET_KEY","")
password=values.get("POSTGRES_PASSWORD","")
domain=values.get("PACELAB_DOMAIN","")
bad=("replace","changeme","your_","example","localhost")
errors=[]
if len(secret)<32 or any(part in secret.lower() for part in bad):
    errors.append("PACELAB_SECRET_KEY: use a unique 32+ character production secret")
if len(password)<24 or any(part in password.lower() for part in bad):
    errors.append("POSTGRES_PASSWORD: use a unique 24+ character password")
if password==secret:errors.append("Use distinct secrets for JWT signing and PostgreSQL")
if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]{1,251}[A-Za-z0-9])",domain) or "." not in domain or domain.endswith(".example"):
    errors.append("PACELAB_DOMAIN must be a real DNS hostname for this server")
for error in errors:print("ERROR:",error,file=sys.stderr)
if errors:sys.exit(1)
print("Environment secret length and hostname checks passed.")
PY
docker compose -f compose.production.yml config --quiet
echo "Production Compose configuration parses successfully."
echo "DNS, TLS, backups, privacy and security controls still require independent verification."
