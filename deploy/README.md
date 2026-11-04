# PaceLab full-stack deployment: operator runbook

> **Status:** A reference deployment that is not yet hosted or security-audited.
> The public GitHub Pages link is a static preview; it cannot run FastAPI or
> PostgreSQL. This guide is for operating a **separate private-beta host**.

## Required resources

- A Linux server or VM with Docker Engine and Compose v2
- Domain name with A/AAAA records pointed at the host
- Open inbound TCP ports 80 and 443 for Caddy, and an outbound internet path
  so Caddy can obtain certificates
- At least enough resources for Python, Nginx, PostgreSQL and the OS
  (size based on observed imports/usage; do not promise a fixed capacity)
- Private .env with strong independent secrets and an operator-maintained
  secure database backup location
- A privacy notice, informed athlete consent, and an approved security plan

A public full-stack deployment for strangers is **not recommended** yet;
the current registration behavior is deliberately private-by-default.

## 1. Prepare the host

Install Docker Engine, the Docker Compose plugin, Python 3 and curl from
your operating system's official package sources. Restrict SSH to trusted
administrators and do not expose PostgreSQL or Uvicorn ports to the internet.

Clone and enter the repository:

```bash
git clone https://github.com/dokeefe414/Pacelab.git
cd Pacelab
cp .env.example .env
chmod 600 .env
```

Create independent, high-entropy values for POSTGRES_PASSWORD and
PACELAB_SECRET_KEY and populate the .env file. Also set:

```dotenv
POSTGRES_PASSWORD=REPLACE_WITH_SECURE_RANDOM_PASSWORD
PACELAB_SECRET_KEY=REPLACE_WITH_DISTINCT_RANDOM_SIGNING_SECRET
PACELAB_DOMAIN=pacelab.your-real-domain.tld
```

Do **not** commit .env, passwords or any original COROS FIT files.
The example values above intentionally fail production preflight.

## 2. Validate before deployment

```bash
bash deploy/preflight.sh
docker compose -f compose.production.yml config --quiet
```

Preflight checks secret lengths, placeholders, domain format and
Compose parsing without printing secrets. This is **not** a replacement
for verifying DNS, firewall, disk encryption, TLS or upload security.

## 3. Start the database and application

```bash
docker compose -f compose.production.yml up -d --build
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=80 api
```

The API container runs **alembic upgrade head** during startup and its
readiness probe checks the workouts table. The database service uses a
persistent Docker volume. Caddy handles certificate issuance for the
domain when DNS and inbound ports are configured correctly.

The production stack publishes only Caddy on TCP 80/443. Nginx proxies
/api requests to FastAPI inside the private Docker network.

## 4. Create private-beta account

Public registration is **disabled by default** in production. Create a
private account with an interactive password prompt:

```bash
docker compose -f compose.production.yml exec api python -m app.create_user
```

Do not pass private passwords in CLI arguments or commit account data.

## 5. Verify HTTPS functionality

```bash
bash deploy/verify-public.sh https://pacelab.your-real-domain.tld
```

This read-only check verifies frontend HTML, API health, database
readiness and rejection of an unauthenticated workout request.

Then use a regular browser to sign in and import a **non-sensitive
synthetic activity fixture**. Do not test with private athlete data
before completing the security review.

## 6. Optional: connect the public Pages browser to your API

GitHub Pages remains a separate static front end at
https://dokeefe414.github.io/Pacelab/. It cannot provide your private
database on its own.

In the public browser demo's account dialog, enter your own HTTPS
API address, such as `https://pacelab.your-real-domain.tld/api`, then
sign in with the private account you created.

To permit this **specific public frontend origin**, the production
Compose example includes both your own HTTPS domain and the official
PaceLab Pages origin in PACELAB_CORS_ORIGINS:

- https://pacelab.your-real-domain.tld
- https://dokeefe414.github.io

Restrict additional origins. CORS is a browser boundary, **not**
authentication; all personal endpoints still require owner-scoped
bearer tokens. Public signup stays disabled by default.

## 7. Backups and recovery

Backups include private GPS and notes. Select a private **encrypted**
storage path outside the Git repository:

```bash
bash deploy/backup-postgres.sh /secure/pacelab-backups/backup-2026-11-04.dump
bash deploy/test-restore-postgres.sh /secure/pacelab-backups/backup-2026-11-04.dump
```

The second script restores to a disposable database and removes it;
it does not restore over the live account database.

Operators must separately configure periodic scheduling, encrypted
off-site storage, rotation, notifications, restore drills and retention
that complies with their user-facing privacy commitments.

## 8. Diagnose failures

| Symptom | Likely check |
|---|---|
| HTTPS certificate unavailable | DNS A/AAAA, port 80/443 and Caddy logs |
| API responds 502 | API health, migrations, container logs |
| /api/ready returns 503 | Database health or missing workouts table |
| Login gives 403 on registration | Expected production behavior: operator-create users |
| ZIP import HTTP 413 | Source file/ZIP limits and 26 MB proxy maximum |
| Browser CORS error | Exact HTTPS origin, configured domain, stale container |
| ML returns 503 | Expected until a trusted real-data model is configured |
| Assistant gives deterministic answer | Expected unless provider explicitly enabled |

Log inspection:

```bash
docker compose -f compose.production.yml ps
docker compose -f compose.production.yml logs --tail=120 api
docker compose -f compose.production.yml logs --tail=120 web
docker compose -f compose.production.yml logs --tail=120 caddy
```

PaceLab request logs use scrubbed paths and request IDs but logs and
infrastructure monitoring must still be access-restricted.

## 9. Upgrade and rollback planning

Before an upgrade: take an encrypted database backup and **verify its
restore**, record the current commit, and review pending Alembic
migrations. Plan maintenance for schema changes that cannot safely
be rolled back.

```bash
git pull --ff-only
bash deploy/preflight.sh
docker compose -f compose.production.yml up -d --build
bash deploy/verify-public.sh https://pacelab.your-real-domain.tld
```

For a broken **frontend-only** change, redeploy a reviewed prior commit.
For backend/migration incidents, **do not blindly downgrade** the
database. Reconstruct from a tested backup under a documented recovery
procedure, with a maintenance window and user communication.

## Known blockers before inviting real public users

- Distributed rate limiting, account verification, consent and password reset
- Token revocation / hardened browser session architecture
- Formal privacy/retention policy, alerting and abuse monitoring
- Independent security review of uploads and cross-account authorization
- Encrypted scheduled backups with owner-tested recovery objectives
- Production traffic, browser and accessibility acceptance testing
- Clear policy for optional language-model data transmission

See [SECURITY.md](../SECURITY.md),
[architecture](../docs/architecture.md),
[operations/privacy](../docs/privacy-and-operations.md) and
[testing](../docs/testing.md).

No host, DNS, provider account, credential or billing resource is created
by committing the files in this repository.
