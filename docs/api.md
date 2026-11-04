# PaceLab REST API — v0.6

Base path: **/api** on a separately deployed FastAPI service.
A standalone GitHub Pages demo has **no** hosted API.
For local Docker, browse http://localhost:8080 and proxy API calls through
the frontend Nginx service. The OpenAPI interface is at **/api/docs**
when running the backend.

All private endpoints require
`Authorization: Bearer <short-lived-token>`, where the token is obtained
from login or registration. The browser keeps it in sessionStorage.

## Endpoints

| Method | Endpoint | Auth | Behavior |
|---|---|---|---|
| GET | /health | No | Liveness independent of database |
| GET | /ready | No | Checks database connectivity and workouts table |
| POST | /auth/register | No* | Create account; disabled in production by default |
| POST | /auth/login | No | Sign in and receive a signed JWT |
| GET | /auth/me | Yes | Return own email and account ID |
| GET | /workouts?limit=250&offset=0 | Yes | Paginate own workout summary records |
| POST | /workouts | Yes | Create manual workout |
| GET | /workouts/{id} | Yes | Get own workout detail, laps and trace |
| PUT | /workouts/{id} | Yes | Update own workout type, notes and summary values |
| DELETE | /workouts/{id} | Yes | Delete owned workout |
| POST | /activities/import | Yes | One FIT, GPX or TCX (10 MB limit) |
| POST | /activities/import-bulk | Yes | Bounded ZIP of supported activities |
| GET | /insights/summary | Yes | Aggregated facts and recent history |
| POST | /assistant/ask | Yes | Grounded answer and selected relevant workouts |
| POST | /predict/riegel | No | Mathematical race-equivalence baseline |
| GET | /predict/history | Yes | Last recorded Race equivalent |
| GET | /predict/features | Yes | Aggregate most recent 28 days to model features |
| POST | /predict/ml | Yes | Experimental trusted-model estimate if configured |
| GET | /exports/race-training.csv | Yes | Time-lagged pre-race training rows |
| GET | /account/export | Yes | Full private account JSON export |
| DELETE | /account | Yes | Permanently delete active account after password confirmation |

*Production public registration stays OFF unless explicitly changed by
the operator. A real public release needs anti-abuse controls,
email verification and consent.

## Representative requests

### Create a manual workout

```http
POST /api/workouts
Authorization: Bearer YOUR_PRIVATE_TOKEN
Content-Type: application/json

{
  "date": "2026-11-04",
  "type": "Easy",
  "distanceMiles": 5.0,
  "durationSeconds": 2400,
  "notes": "Comfortable aerobic run"
}
```

The service returns the workout ID and summary. This example is fictional.

### Ask a grounded question

```http
POST /api/assistant/ask
Authorization: Bearer YOUR_PRIVATE_TOKEN
Content-Type: application/json

{"question": "How has my mileage changed over two weeks?"}
```

Response contains verified aggregate-derived text, the execution engine,
as-of date, a small selection of **relevant workout IDs** for navigation
and a disclaimer. The selected list is not necessarily all activities
used to compute aggregate statistics.

### Import a COROS ZIP export

Send a multipart/form-data upload with field name **file** and a ZIP archive
containing FIT, GPX or TCX activities. Caps include approximately 25 MB
compressed, 80 MB uncompressed and at most 100 accepted activity files.
Each file is checked for duplicates. The response includes counts for
imported, duplicate and failed files.

### Try a formula baseline without signing in

```http
POST /api/predict/riegel
Content-Type: application/json

{
  "referenceSeconds": 1200,
  "referenceMeters": 5000,
  "targetMeters": 1609.344,
  "exponent": 1.06
}
```

This is a transparent formula, **not** personalized machine learning.

## Important response and error semantics

- **200/201/204:** success, created or deleted.
- **401:** missing or invalid/expired bearer token.
- **403:** disallowed account action or failed password confirmation.
- **404:** missing workout, or another user's workout (no owner disclosure).
- **409:** duplicate email or database conflict.
- **413:** upload too large.
- **422:** failed schema validation, bad ZIP or unsupported activity content.
- **429:** per-process request limit reached; inspect Retry-After.
- **503:** unavailable configured ML model or failed database readiness.

The API sends private no-store cache headers on /api/ endpoints and
X-Request-ID for ordinary requests. The request logger omits raw questions,
notes, GPS, credentials and query strings.

## Data and unit conventions

- Distances on workout endpoints: **miles**
- Race distances on prediction endpoints: **meters**
- Durations/pace features: **seconds**
- Source heart rate: **beats per minute**
- Running cadence: **steps per minute**
- Optional power: **device-reported watts**
- Missing sensors remain **null**, not measured zero

## Security rules for clients

Never put a bearer token into a GitHub issue, public URL, log, email or
client-side error report. Avoid storing raw GPS and account exports in
public cloud folders. Use HTTPS for all network calls except local-only
development on loopback.
