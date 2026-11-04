# Contributing to PaceLab

PaceLab values reproducible engineering, accessible design, athlete privacy
and transparent AI evaluation.

## Start locally

Frontend (repository root):

~~~bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
~~~

Backend (from the backend/ directory):

~~~bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
alembic upgrade head
~~~

See [testing guide](docs/testing.md) for mocked API flows and CI troubleshooting.

## v0.7 security and research standards

Any change to authentication must preserve token revocation, API-origin
binding and account isolation. COROS import changes require privacy
acknowledgment and synthetic regression fixtures.

External AI integrations must remain opt-in per question; never assume
a server API key is consent. Multi-athlete research data needs documented
participant permission and pseudonyms, with no real records committed.

The optional Render Blueprint is infrastructure code only, and cloud
hosting changes must disclose cost/secret/backup implications.

## Pull request standards

1. Explain the user problem, technical design, limitations, and rollback plan.
2. Add unit tests to pure analytics and parser changes.
3. Add a browser regression test if UI behavior changes.
4. Ensure private endpoints derive account ownership from the validated token.
5. Never commit real FIT exports, GPS traces, credentials, secrets or DB dumps.
6. Evaluate ML experiments on **chronologically held-out real records**;
   do not pass synthetic fixture metrics off as real athletic results.
7. Update README, API docs, architecture, model caveats and migrations as relevant.

## Engineering conventions

- Frontend: ES modules and browser-local synthetic preview, with DOM labels,
  clear empty states and responsive layouts.
- Backend: FastAPI/Pydantic, SQLAlchemy and versioned Alembic migrations.
- Time: seconds, distinguish moving/timer from elapsed.
- Distance: miles internally, convert on boundaries to meters when needed.
- Missing sensor data must stay missing, not become a fabricated zero reading.
- HTML inserted dynamically must escape user-generated text.
- Rate-limit abuse and keep sensitive URL parameters out of logs.

## Release behavior

Changes are developed on a branch with a reviewed pull request. Frontend,
backend and Playwright CI should be green before merging. The public synthetic
demo publishes from the main branch through GitHub Pages; a production
backend requires an independent operator deployment.

See [SECURITY.md](SECURITY.md) before reporting a vulnerability.
