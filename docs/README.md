# PaceLab documentation index

PaceLab is intentionally documented for three audiences: a visitor trying the
demo, a developer evaluating the architecture, and an operator securing a
private beta. **The GitHub Pages preview does not host personal accounts.**

| Document | Purpose |
|---|---|
| [README](../README.md) | Project overview, browser demo, quick start and status |
| [System architecture](architecture.md) | Data flow, storage, schemas and threat boundaries |
| [API reference](api.md) | Authentication, workout/import and analysis endpoints |
| [Browser-local wearable import](browser-import.md) | Private FIT/GPX/TCX decoding, backup, consent and limits |
| [Athlete Studio](athlete-studio.md) | Monthly/weekly training trends, sensor charts, comparable laps and accessibility |
| [Production beta gates](production-beta-checklist.md) | Hosted account, privacy, security, backups, monitoring and ML sign-off |
| [Testing](testing.md) | Unit, integration, browser and synthetic FIT tests |
| [ML methodology](ml-methodology.md) | Dataset provenance, leakage, models, metrics and pitfalls |
| [Real-race evaluation](real-race-evaluation.md) | Private audit, chronological forecasts, paired comparisons and reproducible reports |
| [Distribution-shift study](distribution-shift-study.md) | Synthetic controlled regimes, causal online updates and reproducibility |
| [Research data governance](race-data-governance.md) | Consent, pseudonyms, readiness thresholds and reporting |
| [Portfolio case study](case-study.md) | Design motivation, skills demonstrated and tradeoffs |
| [Engineering decisions](decisions.md) | Rationale and alternatives for major choices |
| [Demo publishing](public-demo.md) | GitHub Pages static-only behavior |
| [HTTPS operations](../deploy/README.md) | Self-hosting setup, troubleshooting and rollback |
| [Optional Render hosting](render-deployment.md) | Blueprint resources, managed Postgres, operator deployment and costs |
| [Privacy/backup](privacy-and-operations.md) | Sensitive running data, deletion and backups |
| [Security policy](../SECURITY.md) | Responsible disclosure and public release gates |
| [Contributing](../CONTRIBUTING.md) | Development and review standards |

## The two deployment modes

**Public local-first app:** Static JavaScript/CSS/HTML on GitHub Pages.
It starts with fictional workouts, but a user can privately parse running
FIT/GPX/TCX files and save reduced workout/sensor summaries (no GPS
coordinates) in that browser. Browser-local data is **not automatically
synced** or backed up. No account API is connected by default.

**Private full stack:** Docker Compose with FastAPI, PostgreSQL, Nginx and
Caddy. It can store real account-owned workout records and import user-exported
COROS FIT files. This requires a separately provisioned host, DNS, HTTPS,
backups, operations and security review. It has **not** been provisioned from
this repository automatically.

## Privacy rule for examples

All documentation fixtures, charts and expected outputs must be synthetic or
clearly anonymous. Private COROS binaries, device IDs, accounts and routes do
not belong in documentation, screenshots, CI artifacts or Git history.
