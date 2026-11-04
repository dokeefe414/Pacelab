# PaceLab engineering decisions

This log explains why the current design choices exist and what could
replace them later. Dates reflect the repository evolution in 2026.

## ADR-001 — Keep a static browser demo separate from private accounts

**Decision:** Host a synthetic-data ES-module frontend on GitHub Pages,
with optional localStorage. Host any account-based FastAPI/PostgreSQL
application **separately** over HTTPS.

**Why:** A recruiter can try the demo immediately without an installation,
cloud bill or exposure of real athlete data. GitHub Pages cannot execute
a Python process or store secure account records.

**Tradeoff:** The demo's login and server-side imports cannot work without
a separately operated backend. The product must label this limitation.

## ADR-002 — Explicit user-exported COROS files first

**Decision:** Support FIT/GPX/TCX and bounded ZIP exports. Do not claim
official automatic COROS OAuth synchronization without provider
authorization and a dependable production integration.

**Why:** Exports give the runner control and allow transparent parsing.
**Tradeoff:** Imports are manual; watch firmware may vary and require
more private compatibility tests.

## ADR-003 — Persist original timing semantics

**Decision:** Keep timer/moving duration distinct from elapsed duration,
preserve device laps, and normalize lap pace only for charts.

**Why:** Pauses, track intervals and workout recovery produce different
duration and lap interpretations. Missing sensor values are retained as
missing instead of being invented.

## ADR-004 — Keep analytical formulas deterministic

**Decision:** Riegel race-equivalence and running summaries have simple,
inspectable calculations. Hard sessions and weighted minutes are
descriptive rather than physiological claims.

**Why:** Transparency helps athletes check the output. Complex AI models
should only be used when they measurably improve held-out predictions.

## ADR-005 — Chronological ML evaluation

**Decision:** Generate pre-race training features using only earlier dates,
compare multiple baselines, select on validation and reserve later
test outcomes for honest evaluation.

**Why:** Random shuffling of time-dependent athlete data can leak future
training patterns. **Tradeoff:** A chronological test alone does not
establish across-athlete or across-course generalization.

## ADR-006 — Owner-scoped persistence, private by default

**Decision:** Authenticate with signed short-lived tokens and filter
workout queries by server-derived owner ID. Keep location coordinates
private; raw source files are discarded after parsing. Public
registration is disabled by default in production.

**Tradeoff:** Bearer tokens without server-side revocation, basic
per-process throttling and backup retention require additional
engineering before inviting the public.

## ADR-007 — Provider-independent deployment runbook

**Decision:** Maintain a reference Docker Compose deployment with Caddy
TLS, Nginx, FastAPI and PostgreSQL. Do not tie the repository to one
cloud vendor or claim that a host was provisioned when none exists.

**Tradeoff:** The operator must provision a domain/server, control secrets,
backups and monitoring, and perform a separate deployment and review.

## ADR-008 — CI must test the actual visible user journey

**Decision:** A Playwright test explicitly selects a visible workout
details button inside the workout log, rather than a hidden dashboard
duplicate. CI runs frontend, backend and browser tests separately.

**Why:** A hidden DOM element can make a test time out without any
application bug. Tests must match how a person operates the interface.

## Future decisions requiring evidence

- Token revocation and secure cookie-backed session design
- Centralized rate limiting and authenticated browser origins
- Athlete consent, deletion/retention and opt-in external AI
- A suitable and sufficiently large real race dataset
- Hosting cost, security ownership and backup recovery objectives
- Large-scale plotting/performance for thousands of workouts
