# PaceLab — Running Intelligence

## ▶️ [Try PaceLab in your browser](https://dokeefe414.github.io/Pacelab/)

**No downloads or installation needed.** Explore the interactive running dashboard, sample workouts, training analytics, race-equivalence calculator, and local training assistant.

> **Published browser demo:** GitHub Pages successfully deployed PaceLab from `main` on November 4, 2026. This version includes interactive sample data and browser-local features. Account login, private COROS file imports, and hosted ML inference still require a separate backend.

**A full-stack running analytics and experimental race-prediction platform.**

Built by Daniel O'Keefe as a software-engineering and AI/ML portfolio project.

**Current release: v0.5 private-beta code.** The public GitHub repository contains the
application, tests and deployment configuration. **The sample-data Pages demo has deployed successfully, but the full-stack backend is not publicly hosted.** The race
prediction model requires genuine labeled data before any performance claims.

## What PaceLab does

| Area | Capabilities |
| --- | --- |
| Activities | Import single FIT, TCX, GPX or bounded bulk ZIP exports, with owner-scoped deduplication |
| COROS details | Separate moving timer and elapsed time; cadence, power, HR, elevation, GPS samples and recorded device laps when available |
| Training intelligence | Weekly mileage, training consistency, route and pace plots, normalized splits, heart-rate distribution, and comparison between any two periods |
| Race history | Recorded PBs and formula-based Riegel equivalents of recent races |
| Machine learning | Date-grouped splits and rolling backtests; median, ridge, random forest, boosting, tiny neural baseline and prior-race Riegel comparisons |
| Training assistant | Verified statistics, recent supporting workouts and an optional provider-backed wording layer |
| Engineering | FastAPI, authenticated user data, PostgreSQL, Alembic migrations, Docker, privacy tools and Playwright end-to-end tests |
| Operations | Database health probes, redacted request logs, backup scripts and isolated restore checks |

**The demo is synthetic.** Real race predictions are never labeled validated
unless an appropriate labeled dataset is evaluated, with meaningful held-out
errors and generalization checks. Training-weight and HR-band visualizations are
not medical or physiological recommendations.

## Run the complete application locally

Install Docker Desktop. In PowerShell:

~~~powershell
git clone https://github.com/dokeefe414/Pacelab.git
cd Pacelab
Copy-Item .env.example .env
notepad .env
~~~

Replace the sample database password and JWT secret in your private .env file
with **separate secure random values**, then run:

~~~powershell
docker compose up --build
~~~

Open **http://localhost:8080**. Register, log runs, or sign in and import your
FIT/GPX/TCX/ZIP exports. The backend and PostgreSQL use an internal Docker
network. For the local non-Docker setup see [the architecture guide](docs/architecture.md).
Do not commit .env, original FIT files, private data exports or database dumps.

## Real COROS compatibility

Four real, private COROS FIT files were inspected independently (a race, long
run, easy run and interval workout). Their session distances, timer durations,
elapsed durations and device-lap structures were compared with the original
COROS summaries. **No private FIT bytes, GPS coordinates or device IDs appear
in this repository.** There are additional synthetic binary FIT decoder
tests and missing-data tests in backend/tests.

The independent private-byte inspection is not a substitute for a complete
end-to-end import into a running PaceLab account. Validate on your own machine:

~~~powershell
cd backend
python -m tools.verify_fit "C:\private\run.fit" --distance-km 10.0 --timer-sec 3000
~~~

The tool reports only summary diagnostics; it never prints raw GPS. Enter the
actual activity distance/time from your watch, rather than the sample values.
Use the **Workout log → FIT / GPX / ZIP** button to import up to 50 selected
files or one ZIP containing up to 100 supported activity files (25 MB
compressed / 80 MB expanded / 10 MB per activity).

A FIT session can report **timer time shorter than total elapsed time** if
the watch was paused. Stored lap distances can vary for structured workouts.
Fixed heart-rate bands are not your personalized physiological zones.

## Model evaluation: research, not prediction hype

A signed-in runner can mark real races and choose **Race predictor → Export
real race-training CSV**. Each labeled row uses only data from the 28 days
strictly before the race. Same-day/future workouts are excluded, and rows
without enough prior training are omitted.

The experiment needs **60+ genuine labeled race rows** across enough distinct
dates. Four privately inspected workouts are NOT a suitable training dataset.

From backend/:

~~~bash
python -m pip install -r requirements-ml.txt
python -m ml.train --csv path/to/private-training.csv --output models/race-model.joblib
~~~

The trainer evaluates a median baseline, ridge regression, random forest,
histogram gradient boosting and a compact neural network. It also compares a
prior-race Riegel equivalent, uses rolling date-based backtests, reports
held-out MAE/RMSE and event-level errors, and saves JSON metrics plus a
human-readable **model card**. Permutation importance uses validation, not
held-out test data. Intervals and model accuracy can fail under distribution
shift. User/athlete-disjoint evaluation is still needed before generalizing
across runners. Models must be trusted and manually configured on the backend.

## AI assistant

Without external credentials, the assistant explains data already recorded
in the browser or authenticated account. In signed-in mode it returns links
to recent supporting workouts, so answers can be checked. By default,
no LLM provider is required. An optional externally configured provider
receives the user's question and aggregated metrics, not raw routes, emails,
workout notes or tokens. Athlete consent and a privacy notice are necessary
before turning that on for other people.

## One-click browser access — no downloads

The **live sample-data browser demo** runs directly from this
repository's static files (`index.html`, `styles.css`, and `src/`).
It does not require Node, Vite or an API server to **view** it.

**Deployment setup (already completed):**

1. Open [Settings → Pages](https://github.com/dokeefe414/Pacelab/settings/pages).
2. Under **Build and deployment**, set **Source = Deploy from a branch**.
3. Choose **Branch = main** and **Folder = /(root)**, then **Save**.
4. Visit `https://dokeefe414.github.io/Pacelab/` once GitHub publishes.

The repository publishes from `main` without a separate custom Actions deployment workflow. The `.nojekyll` file ensures GitHub serves the raw static assets.
See [browser demo setup](docs/public-demo.md) for troubleshooting.

**What works without a backend:** Synthetic sample workouts, local logging,
training charts, deterministic training Q&A and formula-based race estimates.
**What needs a hosted API:** Accounts, COROS FIT/GPX/TCX/ZIP imports and
experimental trained-model inference.

## Quality checks

~~~bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e

cd backend
python -m pip install -r requirements-dev.txt
pytest -q
alembic upgrade head
~~~

GitHub Actions runs frontend tests/build, browser E2E, Python tests,
database migrations, backup script syntax and Compose validation.

## Security & operations

A runner can export their **complete private account record** (including
coordinates), or delete it from the active database. Older backups may
retain data under your operator retention policy.

See [privacy and operations](docs/privacy-and-operations.md),
[self-hosting instructions](deploy/README.md),
[architecture](docs/architecture.md) and
[frontend-only demo guide](docs/public-demo.md).

Production still requires domain, HTTPS, centralized multi-worker rate
limits, account recovery/verification, token revocation/session hardening,
monitoring and tested data-retention procedures. Do not host strangers'
sensitive running data until those controls have been reviewed.
