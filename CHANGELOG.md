# PaceLab changelog

Versions describe repository capabilities, **not** public production
deployment or race-model validation. See README for the current limits.

## v0.6 — athlete performance center and product readiness (2026-11)

- Fixed hidden DOM target in signed-in Playwright workout-details test.
- Added 12-week mileage/calendar tiles and consecutive-day consistency.
- Added per-event race progression without inventing personal bests.
- Added two-workout normalized pace, time and distance comparison.
- Improved question-relevant workout evidence in the grounded assistant.
- Allowed optionally configuring an independently hosted HTTPS API from
  the public Pages preview (no account server automatically provided).
- Added provider-independent deployment preflight and HTTP smoke checks,
  a security policy, detailed API/architecture/ML/test documents and
  a portfolio engineering case study.

## v0.5 — COROS dynamics, evaluation and private-beta tooling

- Preserved FIT timer versus elapsed duration, cadence, power and sensor detail.
- Improved time-series model comparison with additional baselines and
  generated model cards (still experimental, requires genuine labeled data).
- Added database readiness, scrubbed request logging and backup/restore tools.
- Extended synthetic binary FIT import, owner-isolation and browser tests.

## v0.4 — imports, privacy and browser QA

- Guided synthetic-data demo tour and transparent privacy labels.
- Added bounded FIT/GPX/TCX ZIP imports and duplicate detection.
- Added account self-service export/deletion and basic request throttling.
- Added Playwright Chromium end-to-end tests.

## v0.3 — full-stack activity intelligence foundation

- Implemented FastAPI, account-scoped PostgreSQL workout persistence,
  Alembic migrations and sensor-rich activity views.
- Added weekly and 12-week analytics, race history, grounded assistant,
  transparent race formula, offline ML export and chronological evaluation.
- Added Docker and reference HTTPS deployment configuration.

## Important scope disclosure

- The public GitHub Pages link is a static browser demo using fictional runs.
- The private full-stack backend requires separate hosting and security work.
- No model has been claimed validated on a broad genuine runner cohort.
- Private COROS activity bytes, GPS traces and credentials are excluded
  from this repository and its documentation.
