# PaceLab changelog

Versions describe repository capabilities, **not** public production
deployment or race-model validation. See README for the current limits.

## Research Track 1 — Distribution-shift forecasting (2026-11)

- Built a seed-paired, strictly synthetic generator with stationary,
  covariate, relationship, noise and combined interventions.
- Compared a naive last-race forecast with frozen, scheduled, rolling
  and residual-triggered Ridge policies using causal prequential evaluation.
- Added before/after MAE/RMSE, paired post-shift differences, false alarms
  and first post-intervention detection delay diagnostics.
- Verified reproducibility and enforced no-future-label leakage in tests.
- Added an independent GitHub Actions workflow creating reproducible,
  anonymous synthetic JSON/CSV research artifacts.
- Documented hypotheses, math, negative controls and limitations.
- **No synthetic experiment is evidence of real-athlete model validity.**

## v0.9 — Athlete Studio and evidence-first research (2026-11)

- Rebuilt the athlete analytics experience with a monthly 3/6/12-month
  mileage view and an interactive 12-week mileage/Easy pace chart.
- Added *fair completed-week* four-week volume comparisons excluding
  the partial current week; no projected training sessions.
- Added selectable recorded telemetry charts (heart rate, cadence, power,
  elevation, segment pace) with sample coverage and no invented readings.
- Added distance-aware device Lap Lab: normalized lap pace, recoveries
  separated from comparable efforts, descriptive pace variability.
- Improved mobile navigation with backdrop, Escape dismissal,
  aria-expanded state and accessible form/chart labels.
- Extended authenticated insights to include server-computed monthly
  statistics and completed-week comparisons, with unit tests.
- Added held-out interval-coverage uncertainty diagnostics, descriptive
  range-drift measurements and minimum support for per-event ML errors.
- Expanded browser, backend, research and mobile regressions, documentation
  and a production release-gate checklist.
- **Public browser features are live when deployment succeeds.** Hosted
  accounts, external COROS sync and validated ML forecasts are not claimed.

## v0.8 — privacy-first real-workout browser app (2026-11)

- Added client-side FIT/GPX/TCX decoding with checksum/field validation,
  sample limits, and **no GPS coordinates stored**.
- Tested four private running FIT files locally without committing originals,
  as well as synthetic FIT and GPX fixtures in automated tests.
- Enabled manual race classification and notes on locally imported workouts.
- Added local race-history equivalents, research readiness, and leakage-
  conscious pre-race feature CSV export without a hosted API.
- Added local full JSON backup/restore, validation and mobile privacy
  messaging for browser-only data.
- Added explicit privacy-first import documentation and Render DB URL
  compatibility regression tests.
- Cloud-hosted accounts are **not** claimed live; original FIT files/routes
  remain private, and ML remains experimental.

## v0.7 — private-beta account security and research integrity (2026-11)

- Added database-backed revocation of all access tokens on server sign-out
  and password change, with dedicated account-security UI and tests.
- Bound tokens to one API base; changing the server address clears the token.
- Required per-question consent for an optional external language model.
- Added a privacy acknowledgment before GPS-bearing COROS uploads.
- Added genuine-race dataset readiness checks, optional pseudonymous
  athlete-disjoint evaluation, and wearable sensor-coverage summaries.
- Added a review-only Render Blueprint for a Docker API and managed database,
  plus a cloud deployment runbook and static configuration tests.
- Expanded engineering docs, CI and privacy/security tests.
- **A live cloud API and a validated real-data model are not claimed.**

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
