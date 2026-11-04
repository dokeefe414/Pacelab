# PaceLab 🏃 — Running analytics and race prediction

**PaceLab v0.4** is a full-stack, privacy-aware running analytics platform. Runners can import device activity files, inspect training trends and route traces, ask grounded questions about their recorded workouts, and experiment with race predictions.

Built by **Daniel O'Keefe** as a software-engineering and AI/ML portfolio project.

> **Status:** Engineering beta. This repo does not contain a deployed public service, a real-data-trained model, or a direct COROS OAuth sync. The race-equivalence baseline is mathematical; the supervised ML model is optional and experimental. Do not rely on the predictions for medical or training safety decisions.

## What's implemented

| Area | Functionality |
| --- | --- |
| Running dashboard | Weekly mileage, duration, average pace, activity breakdown |
| Device ingestion | Private FIT, GPX and TCX uploads (one activity per file; select multiple files together) |
| Workout details | Distance, duration, heart rate, ascent, device laps / approximate mile splits, schematic route, HR and elevation traces |
| Data persistence | FastAPI, PostgreSQL with Alembic migrations, authenticated accounts, user-isolated records |
| Duplicate detection | Hash-matched imports plus start-time/distance/duration cross-format checks |
| Workout management | Add, edit type/notes, delete, local CSV import/export |
| Advanced analytics | Last 7 vs prior 7 days, 12-week volume, weighted minutes, easy-pace trends, recorded race bests |
| Race models | Riegel baseline, latest recorded race equivalent, derived last-28-day features for optional trained model |
| ML experiment | Leakage-conscious CSV export, chronological train/validation/test splits, median vs random-forest comparison, test MAE and empirical interval coverage |
| Training assistant | Deterministic private statistics Q&A; optional externally hosted language model with aggregate-only context |
| Infrastructure | Docker Compose (local) and an HTTPS self-hosting example, frontend and backend GitHub Actions tests |

## Quick start: full application on Windows

Install **Docker Desktop**, then open PowerShell:

\`\`\`powershell
git clone https://github.com/dokeefe414/Pacelab.git
cd Pacelab
Copy-Item .env.example .env
notepad .env
\`\`\`

**Replace** \`POSTGRES_PASSWORD\` and \`PACELAB_SECRET_KEY\` with independent, secure random values. The sample secrets are NOT for deployment.

\`\`\`powershell
docker compose up --build
\`\`\`

Visit **http://localhost:8080** and select **Sign in / Create account**.

If you want to run without Docker:

Terminal 1:

\`\`\`powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
\`\`\`

Terminal 2 (repository root):

\`\`\`powershell
npm install
npm run dev
\`\`\`

Visit the local Vite URL (normally http://localhost:5173). API docs: **http://localhost:8000/api/docs**. Local non-Docker development defaults to SQLite; Docker uses PostgreSQL.

## Import COROS workouts

1. On COROS, open the recorded activity and select **Export Data**. Choose **FIT** to retain heart-rate/sensor metrics; GPX is an option if you only need a timed GPS track.
2. For bulk history, sign in to **COROS Training Hub** on desktop, go to **Activity List → Export Data**, and request **FIT or TCX**. Extract the ZIP download to individual activity files.
3. In PaceLab, sign in and go to **Workout log → FIT / GPX / TCX**. Select up to 50 files per batch (up to **10 MB per file**).
4. Open a workout's **Details** to see its route trace, HR and elevation charts, splits and notes. Change workout type to **Race** for actual race efforts so that PR analytics and race-history prediction can use them.

**Important limitations:** PaceLab does not currently auto-connect to COROS accounts, import ZIP archives directly, read daily sleep/HRV data, or guarantee full fidelity for every vendor-specific FIT field. Some export files may omit HR, GPS or lap data. Bad files are rejected with a reason; repeat imports are skipped. Original uploaded file bytes are not stored, but **reduced GPS coordinate samples are saved privately in your account**.

Official COROS instructions: [Export workout data](https://support.coros.com/hc/en-us/articles/360043975752-Exporting-Workout-Data-and-Uploading-to-3rd-Party-Apps) · [Bulk activity export](https://support.coros.com/hc/en-us/articles/25002333092500-Requesting-a-Bulk-Export-of-COROS-Data).

## Race predictions: three different things

1. **Riegel formula:** Convert a known result (e.g., 5K) to an equivalent time at another race distance using \`T2 = T1 * (D2 / D1)^1.06\`. Transparent and not personalized to your training.
2. **Latest-race baseline:** Uses the latest \`Race\` workout from the previous year as the reference effort. This uses your actual history, but is still a formula baseline rather than trained machine learning.
3. **Experimental trained ML model:** Only available after the operator provides a trusted, real-data-trained model. Its features can be auto-filled from the last 28 days of workouts. This endpoint otherwise returns a clear unavailable-model message.

### Train a real dataset (not generated fake results)

Sign in, mark actual races correctly, then select **Race predictor → Export real race-training CSV**. Each labeled row uses the **28 days strictly BEFORE the race**. If there aren't five preceding training workouts and an Easy/Recovery pace, the race is omitted. No race result or same-day workout enters its own features.

From the \`backend/\` directory:

\`\`\`bash
python -m pip install -r requirements-ml.txt
python -m ml.train --csv path/to/real-race-training.csv --output models/race_rf.joblib
\`\`\`

Training currently requires **at least 60 real, labeled race records**, typically more than one runner's short history. Combine records only with appropriate permission. A date-grouped 70/15/15 split compares **median, ridge and random-forest** models. A previous-race Riegel comparator and a rolling-origin backtest report out-of-sample errors. Selection uses validation only; held-out test results include MAE, RMSE, event-level errors and empirical interval coverage. A `.metrics.json` report is saved next to the model artifact. This is a research experiment, not a clinically or athletically validated performance model.

For Docker, place your own trusted artifact under \`backend/models/\`, and set \`PACELAB_MODEL_PATH=/app/models/race_rf.joblib\` in your root \`.env\`. Never use untrusted joblib artifacts (they can execute code when loaded). Models and raw training data are gitignored.

## Assistant

The **AI assistant** tab answers from logged statistics by default (mileage changes, easy pace, heart-rate summaries, hard workouts, race personal bests). It **does not invent workouts or claim to diagnose injuries**.

To opt into generative phrasing, set on the server:

\`\`\`dotenv
PACELAB_ASSISTANT_PROVIDER=openai
PACELAB_ASSISTANT_MODEL=YOUR_RESPONSES_API_MODEL
OPENAI_API_KEY=YOUR_SECRET_KEY
\`\`\`

Restart the API. The provider receives only the user question and verified **aggregate statistics**; private GPS traces, workout notes, email addresses and credentials are not intentionally included. API use may incur provider costs; verify user consent and privacy obligations. Without these settings, deterministic answers work without an external API.

## Workouts CSV

For manual / local CSV import:

\`\`\`csv
date,type,distance_miles,duration,notes
2026-11-02,Easy,5.2,41:30,Comfortable morning run
2026-11-03,Intervals,4.5,31:00,Track workout
\`\`\`

Duration is \`MM:SS\` or \`HH:MM:SS\`; distance is in **miles**. This basic CSV does **not** preserve raw device traces, heart-rate samples, lap data or GPS, so keep your original FIT/GPX/TCX files for archival purposes.

## Structure

\`\`\`text
index.html / styles.css
src/
  app.js                   Application shell, log and baseline calculator
  api.js                   Authenticated backend HTTP client
  core.js                  Workout time, CSV and aggregation utilities
  intelligence.js          Activity details/imports, insights and assistant UI
  intelligence-core.js     Training trend / route plotting utilities
backend/
  app/                     FastAPI routes, authentication, import, analytics
  migrations/              Alembic database schema history
  ml/                      Offline race model training/evaluation
  tests/                   Auth, isolation, imports, analytics, training rows
compose.yml                Local full stack
compose.production.yml     HTTPS deployment reference with Caddy
deploy/                    Deployment setup and security checklist
.github/workflows/         Frontend and backend CI
\`\`\`

## Optional public portfolio demo

For a browser-playable **frontend-only** demonstration, follow
[GitHub Pages setup](docs/public-demo.md) and run the included manual
deployment workflow. Sample workouts are synthetic; the browser-only statistics assistant works in demo mode, while backend accounts, FIT uploads and server-side LLM explanations require your own hosted API.

## Tests and deployment

\`\`\`bash
npm install && npm test && npm run build
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
alembic upgrade head
\`\`\`

GitHub Actions also runs the frontend build and Python migration smoke test.

See [Architecture & privacy](docs/architecture.md) and [Self-hosting requirements](deploy/README.md). Production hosting, account recovery, rate limiting, privacy policy, live integration testing and security hardening remain required before collecting other athletes' data online.

**Roadmap:** stronger FIT compatibility, true COROS provider integration when authorized API access exists, calibrated ML evaluation with genuine datasets, privacy-preserving account deletion, secure hosted deployment, and polished mobile flows.
