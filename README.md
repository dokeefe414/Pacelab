# PaceLab 🏃

**Run your numbers.** A privacy-first running dashboard and race-equivalence calculator, designed to evolve into a production AI-powered running analytics platform.

## Features (v0.1)

- Responsive four-section dashboard: **Overview, Workout log, Race predictor, Insights**.
- Local workout tracking with distance, time, date, type, and notes.
- CSV import/export (including quoted fields, validation, and duplicate checks).
- Weekly mileage, training consistency, workout mix, and pace analytics.
- Explainable **Riegel race-equivalence formula** with a configurable exponent.
- Sample workouts for first-time exploration. Your first actual logged/imported workout replaces sample data.
- Data remains in the browser's localStorage; no server or account is used yet.
- Automated core tests and CI.

> **Important:** Race projections are mathematical equivalents from a user-provided reference performance, **not** personalized ML forecasts. The AI/model training phase is still planned. This app does not provide medical advice.

## Try it

If GitHub Pages is enabled for this repository, use the Pages URL shown in the repository settings. The app uses relative asset paths and can be hosted as a static site.

## Local development

Requires Node.js 20.19+ or 22+ and npm.

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite. To run tests and create the production bundle:

```bash
npm test
npm run build
npm run preview
```

For static hosting, deploy the `dist/` directory (or serve the root directory as static files).

## Import CSV format

```csv
date,type,distance_miles,duration,notes
2026-11-02,Easy,5.2,41:30,Comfortable morning run
2026-11-03,Intervals,4.5,31:00,Track workout
```

Required columns: `date` (YYYY-MM-DD), `distance_miles` (or `distance`/`miles`), `duration` (MM:SS or HH:MM:SS). Optional: `type`, `notes`. Distances are in **miles**, duration is elapsed time; importing does **not** currently support COROS FIT or GPX files. Export your data before clearing your browser's storage.

## Architecture

```text
index.html            UI views and dialog
styles.css            Responsive dark UI
src/core.js           Pure metrics, validation, CSV, race prediction
src/app.js            Rendering, event handling, localStorage
 tests/core.test.js   Node built-in test runner
.github/workflows/ci.yml
```

## Roadmap

1. **Backend:** FastAPI + PostgreSQL, authentication, migrations, and versioned REST API.
2. **Data ingestion:** Robust FIT/GPX integration, time zones, activity deduplication, upload limits.
3. **Model development:** Real athlete/race training data, chronological splits, baselines, feature engineering and evaluation. Avoid leakage from future workouts. Report MAE and calibrated intervals by event and ability level.
4. **AI assistant:** Explain workout trends using verified statistics with explicit tool access and guardrails; do not hallucinate training history.
5. **Production:** Docker, API integration tests, monitoring, security review, hosted frontend and backend.

## Quality and data notes

- The sample dataset is synthetic. It's only a UI demonstration and should never be presented as real athlete data.
- The predictor assumes race efforts on comparable terrain and conditions and is not individualized.
- Storage is per browser and device. Clearing local storage destroys unsaved records; CSV export provides a backup.
- This is an early frontend MVP, not yet a full-stack or machine-learning product.

Built by Daniel O'Keefe.
