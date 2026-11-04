# PaceLab — AI-powered Running Analytics

**v0.2 feature branch:** A responsive workout dashboard backed by an optional authenticated FastAPI service, persistent PostgreSQL workout records, and an experimental ML training pipeline. This project is in active development.

## What works today

- Overview, workout history, weekly mileage, training insights, and explainable Riegel race equivalence.
- Local demo mode with synthetic example runs, CSV import/export, and browser-only storage.
- Optional account mode: register, sign in, log and delete your own workouts via authenticated API requests. User data is isolated in the database.
- FastAPI API docs, SQLAlchemy models, Alembic migrations, PostgreSQL Compose configuration and tests.
- Experimental ML form in the race predictor, connected to the optional trained-model API. Until configured, it explains that the service is unavailable.
- Model training script on **your real, labeled race-history CSV**. No machine learning model is shipped by default; the ML inference endpoint returns 503 until you configure your own trusted trained model. Reports held-out MAE and empirical interval coverage.

**Caution:** This is an engineering MVP, **not a public production service**. Registration lacks anti-abuse, email verification, hardened browser sessions and rate limiting. The model is experimental and should not be presented as validated or used as medical guidance.

## Quick start: full stack with Docker

Install Docker Desktop, then:

```bash
cp .env.example .env
# Edit .env: replace BOTH sample values with long, random, unique secrets.
docker compose up --build
```

Visit **http://localhost:8080**. Use **Sign in / Create account** to register. API and PostgreSQL stay on the internal Docker network; the frontend Nginx proxy routes `/api/` to FastAPI.

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp` if needed. Never commit your `.env` file.

## Local development without Docker

Requirements: Node.js 22+, Python 3.12+ and npm.

Terminal 1:

```bash
cd backend
python -m venv .venv
# Activate your venv (Windows PowerShell: .venv\\Scripts\\Activate.ps1)
python -m pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (repository root):

```bash
npm install
npm run dev
```

Visit the URL printed by Vite (usually http://localhost:5173). Vite proxies `/api` to localhost:8000. The API docs are at **http://localhost:8000/api/docs**. The default backend database is a local SQLite file; Compose uses PostgreSQL instead.

## Testing

```bash
npm test
npm run build
cd backend
python -m pytest -q
```

GitHub Actions run frontend and backend tests, a frontend production build, and a migration smoke test on branches and PRs.

## Machine-learning experiment (no fake trained model)

Provide a CSV of **60+ labeled race records**, with each row containing only features available *before* the race:

```csv
date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,hard_sessions_4w,longest_run_miles,finish_seconds
2026-02-01,5000,40,480,5,12,1150
```

The sample row above illustrates **format only**; it is not a dataset. From `backend/`:

```bash
pip install -r requirements-ml.txt
python -m ml.train --csv path/to/your-private-race-history.csv --output models/race_rf.joblib
```

Training uses chronological train/validation/test partitions, compares a median baseline to random forest, and reports held-out MAE and empirical prediction-interval coverage. Set `PACELAB_MODEL_PATH` on your API service to serve a trained trusted local artifact. Don't commit private race history or artifacts. **Data availability and model quality remain open problems.**

## CSV workout imports

```csv
date,type,distance_miles,duration,notes
2026-11-02,Easy,5.2,41:30,Comfortable morning run
2026-11-03,Intervals,4.5,31:00,Track workout
```

`date` (YYYY-MM-DD), `distance_miles`, and `duration` are required. Workouts are measured in miles and elapsed time. Imports in account mode create workouts on your connected backend; partial failures are reported, and duplicate detection uses date, type, distance and duration. Local workouts are **not automatically synced** when you sign in; export and import your CSV if you choose to upload them.

## Architecture and next steps

See [architecture](docs/architecture.md). A public deployment needs HTTPS, operational security, backups, logging, stable hosted PostgreSQL and secure session architecture. Future work: FIT/GPX ingestion, better athlete-specific baselines, prospective model evaluation, athlete privacy controls, and a natural-language training assistant.

Built by Daniel O'Keefe.
