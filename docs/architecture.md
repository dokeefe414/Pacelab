# PaceLab engineering architecture — v0.3

\`\`\`mermaid
flowchart TB
  COROS[User-exported COROS FIT / GPX / TCX] --> WEB[Browser: dashboard + import]
  WEB -->|Bearer token over HTTPS in deployment| API[FastAPI /api]
  WEB -->|Local demo only| LOCAL[localStorage]
  API --> AUTH[Argon2 hash / JWT user identity]
  API --> PARSER[Size-limited FIT / XML parsing]
  PARSER --> DEDUP[File SHA-256 and cross-format duplicate checks]
  DEDUP --> DB[(PostgreSQL / SQLite dev)]
  API --> STATS[Account-scoped analytics and personal bests]
  STATS --> ASSIST[Deterministic assistant]
  ASSIST -->|Opt-in aggregates, no GPS| LLM[External Responses API]
  DB --> EXPORT[Per-account pre-race feature CSV]
  EXPORT --> TRAIN[Offline temporal validation ML trainer]
  TRAIN -->|Trusted artifact only| MODEL[Experimental inference API]
  API --> WEB
\`\`\`

## Data model

- **User:** email (unique), Argon2 password hash, creation timestamp, UUID.
- **Workout:** owner UUID, date, type, distance (miles), duration (seconds), notes,
  optional start time, source format, source-file SHA-256, average HR,
  ascent meters, lap JSON, downsampled track JSON.
- Unique composite index on \`(user_id, source_hash)\` permits manual workouts
  with null hashes while preventing duplicate uploads of the same bytes.
- The full GPX/FIT/TCX file is not retained; imported private route points
  are capped at 500 sampled points per workout. They may still reveal home
  locations and must remain protected.

Database revisions:
- \`0001_accounts_workouts\`
- \`0002_activity_detail\`

Migrations use Alembic rather than runtime auto-create. Local app uses SQLite
by default; Docker uses PostgreSQL and separate DB credentials to safely
encode special characters in passwords.

## Authentication and isolation

- Short-lived JWT bearer access token, tab-scoped session storage on web.
- Every account-specific endpoint derives the owner from verified token.
- GET/PUT/DELETE workout detail checks owner, returning 404 cross-user.
- Import checks size, format, duplicate hashes and matching start/distance. ZIP imports are read from memory without extracting paths to disk; per-file and total expansion limits mitigate compressed-file abuse.
- Static web server never stores the API signing secret or LLM API key.
- Public registration defaults to off in production; operator account creation
  is interactive and password is never part of CLI arguments.

These are useful engineering controls, **not a complete security review**:
rate limiting, refresh/revocation, cookie hardening, user deletion, backup/restore,
privacy consent, and an incident response system are still missing.

## Analytics interpretation

Training totals are descriptive. The 12-week illustrative effort proxy uses
\`duration_minutes × weight(workout_type)\`, e.g., Easy=1.0, Tempo=1.35,
Intervals=1.5; it is **not** TRIMP, a validated fatigue score, or advice on
training safety. Personal bests are only from runs explicitly labeled \`Race\`
and close to standard 800m/Mile/3K/5K/8K/10K distances.

The default assistant uses deterministic answers from data in the user's
account; optional external LLM requests include a compact aggregate-only
statistics object and the question, not notes or coordinates. The system
instruction prohibits fabricated observations, but language models may still
make errors; verify any claims against the visible metrics.

## Leakage prevention in race modeling

Each export row is generated from workouts occurring **strictly before** the
race date. Same-day sessions are excluded because time order may be unknown.
Features: 4-week mean mileage, Easy/Recovery pace, hard-session count, longest
run. Label: real recorded race duration.

The offline model applies date-based train/validation/test splits. Validation
chooses between median baseline and forest, while an absolute-residual interval
uses split-conformal-like quantiles. Test MAE and empirical coverage are
measured on a held-out later partition. Calibration can fail under time or
athlete distribution shift; it is not a reliability guarantee. Data
requirements, athlete consent, external generalization and sport-specific
normalization remain research problems.

## Deployment

- Local: Docker Compose (Nginx frontend, FastAPI, PostgreSQL).
- Example internet-facing beta: [compose.production.yml](../compose.production.yml)
  with Caddy HTTPS; domain and DNS are required.
- Only Caddy publishes ports 80/443 in the production example.
- Never expose Python, PostgreSQL, raw model artifacts or signing secrets
  publicly; use network isolation and a proper backup strategy.

See [Deployment checklist](../deploy/README.md).
