# PaceLab REST API — v0.9

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
| POST | /auth/logout | Yes | Revoke all current account tokens across devices |
| GET | /auth/me | Yes | Return own email and account ID |
| GET | /workouts?limit=250&offset=0 | Yes | Paginate own workout summary records |
| POST | /workouts | Yes | Create manual workout |
| GET | /workouts/{id} | Yes | Get own workout detail, laps and trace |
| PUT | /workouts/{id} | Yes | Update own workout type, notes and summary values |
| DELETE | /workouts/{id} | Yes | Delete owned workout |
| POST | /activities/import | Yes | One FIT, GPX or TCX (10 MB limit) |
| POST | /activities/import-bulk | Yes | Bounded ZIP of supported activities |
| GET | /insights/summary | Yes | Aggregated facts, recent history, six monthly totals and completed four-week comparison |
| POST | /assistant/ask | Yes | Grounded answer and selected relevant workouts |
| POST | /predict/riegel | No | Mathematical race-equivalence baseline |
| GET | /predict/history | Yes | Last recorded Race equivalent |
| GET | /predict/features | Yes | Aggregate most recent 28 days to model features |
| POST | /predict/ml | Yes | Experimental trusted-model estimate if configured |
| GET | /exports/race-training.csv | Yes | Time-lagged pre-race training rows |
| GET | /exports/race-readiness | Yes | Eligible labeled race counts and caveats |
| GET | /account/export | Yes | Full private account JSON export |
| POST | /account/password | Yes | Change password and invalidate all tokens |
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


## Session lifecycle (v0.7)

Every bearer token includes a server-checked account generation number.
Calling `POST /api/auth/logout` revokes **all** previous access tokens
for this account, across devices. It returns HTTP 204.

`POST /api/account/password` requires a correct current password and a
different new password containing at least 12 characters:

```json
{
  "currentPassword": "EXAMPLE_CURRENT_PASSWORD",
  "newPassword": "EXAMPLE_DISTINCT_LONG_PASSWORD"
}
```

After a successful password change, all previous sessions are invalid.
Reauthenticate using the new password. Browser tokens are bound to the
API address that issued them; changing that address clears stored credentials.

## Optional external assistant processing

`POST /api/assistant/ask` accepts `allowExternalProcessing` (boolean,
**default false**). Without explicit per-request consent, the server
returns deterministic verified statistics and does not contact an external
AI provider—even if one is configured on the server.

```json
{"question":"What changed in my mileage?","allowExternalProcessing":false}
```

The response provides `externalProcessingUsed` and supporting account
workout records. Enabling external processing may transmit the question
and aggregated training statistics but not raw GPS, notes or account email
by design. Opt-in applies to only that question.

## Research-data readiness

`GET /api/exports/race-readiness` is authenticated and reports eligible
label counts, distinct race dates, per-event counts and the minimum
requirements for an experiment. This endpoint does not train or validate
a model. The authenticated CSV export remains private.

## Athlete Studio response fields (v0.9)

The authenticated **GET /insights/summary** response includes
`athleteStudio.monthly`, six months of calendar-bucket summaries
with month label, partial flag, logged mileage, total minutes,
workout/race counts, distance-weighted easy pace (or null) and
percentage of workouts carrying an average recorded HR.

`athleteStudio.completedFourWeekComparison` returns the earlier and
most-recent four **completed** Monday–Sunday weeks, their mileage
difference, and a warning that missing logs cannot be treated as rest.

These endpoints remain owner-scoped. The public Pages app derives the
same concepts directly from browser-local workouts and does not make
a server request for them. See [Athlete Studio definitions](athlete-studio.md).
