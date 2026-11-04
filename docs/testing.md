# PaceLab verification and CI guide

PaceLab tests are intentionally layered. The public demo does not need
a live private database to run browser tests; the full API is validated
separately in Python, including a synthetic binary FIT upload.

## Frontend unit tests

From repository root:

```bash
npm install
npm test
npm run build
npm run check:docs
```

Tests use Node's built-in test runner. They cover time and pace formulas,
local summaries, route/trace transformations, training-calendar dates,
race-event filtering and side-by-side workout comparisons.

The Vite build serves as a production bundle check, but GitHub Pages can
also serve the source directly from the root in static demo mode.

## Browser end-to-end

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright tests the dashboard and sample-data disclosure, workout logging,
race-equivalence UI, navigation, tour and mobile mode.

An authenticated integration test mocks a **fictional** API account and a
synthetic workout to verify the detail dialog, HR/cadence/power charts
and grounded assistant evidence without using a real account.

### Regression: invisible workout detail button

The workout list and dashboard can both render a Details button for the
same ID. The test now selects the visible button specifically inside
`#workout-list`. Selecting the first matching button globally could target a
hidden dashboard page and time out. This bug is covered by browser CI.

When Playwright fails, check the GitHub Actions Browser E2E workflow,
screenshot and trace artifact. Do not remove assertions merely to make
CI green: inspect DOM state, route mocks and actual user interactions.

## Backend tests

From the backend/ directory:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
alembic upgrade head
```

Backend tests cover:

- Account registration/login and owner-scoped access
- Password-confirmed deletion and account export
- Health/readiness checks and sanitized operational request logging
- FIT, GPX and TCX decoding and missing sensor handling
- ZIP limits, duplicate files and cross-format duplicate detection
- Real parser entrypoint fed a **synthetic binary FIT** with pauses and laps
- Account-isolated assistant evidence and grounded stats
- Race training exports that exclude future and same-day information
- Chronological split, expanding backtest and optional model inference

The test fixture never contains original COROS FIT bytes, routes or real
device identifiers. Private activity structure can be compared using
[the local FIT validation utility](../backend/tools/verify_fit.py); outputs
are summary-only and should not be committed.

## Database migrations

Alembic revision history covers account/workout tables, imported activity
details and later running dynamics. Migrations must be tested against a
fresh database and representative older schema. **A successful SELECT 1
query alone is not enough to establish schema readiness**; /api/ready
checks the workouts table.

## Deployment-level checks

Review CI results on the exact proposed commit. A clean frontend build,
backend test suite and browser suite are required. The production runbook
adds shell syntax and Compose configuration checks. A private operator can
run `bash deploy/verify-public.sh https://YOUR-DOMAIN` **only after** an
HTTPS full-stack service has actually been deployed.

## What tests do not establish

- That user-specific COROS FIT files work on every watch firmware version
- That a public cloud deployment is secure or available
- That a trained race model predicts new athletes accurately
- That workouts represent complete athlete history
- That location, retention and consent policies have been independently audited

Be explicit about these remaining limits in the README and portfolio case study.


## v0.7 regressions

**Server-side account session rotation:** Python tests cover valid login,
sign-out from all devices, rejection of stale JWTs, password changes and
reauthentication. Token versions are stored in SQLite in tests and
PostgreSQL in the production reference.

**Browser security:** Playwright tests verify changing an account password,
signing out, and binding a token to the API address that issued it.
Tests use fictitious account data and network mocks.

**COROS disclosure:** Playwright verifies that the location-data
acknowledgment dialog appears before upload, cancellation makes **zero**
API calls, and a positive acknowledgment proceeds with the mocked file.
All FIT/GPX bytes in CI are synthetic.

**External AI opt-in:** Python tests mock the provider and assert it is
not called when the opt-in property is absent or false; tests confirm an
explicit positive opt-in is needed, without real provider requests.

**Research integrity:** Backend tests verify account-scoped race readiness,
data insufficiency messages, optional athlete-disjoint evaluation and that
pseudonymous IDs are omitted from aggregate reports.

**Infrastructure sanity:** A static YAML test inspects render.yaml for
a generated signing secret, private-by-default registration, a managed
database reference, narrow Pages CORS and an actual readiness endpoint.
This test does not prove live Render deployment, billing configuration,
backup safety or provider runtime compatibility.

### Verification before invitations

After *actual* cloud deployment, test the real assigned API URL, database
migrations, token revocation, original-device import accuracy, data export,
account deletion and HTTPS/CORS from a real browser. Check private backup
retention separately. CI alone is not a production security audit.

See [optional Render deployment](render-deployment.md).
