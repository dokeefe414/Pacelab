# PaceLab v0.9 — Athlete Studio

**Status:** Available in the browser-based app using synthetic sample workouts
or your own imported FIT/GPX/TCX training data. No cloud account is required.

**Launch:** [Open PaceLab](https://dokeefe414.github.io/Pacelab/) → **Insights**.

Athlete Studio shows descriptive running analytics—not medical advice,
a prescribed workout plan, or a validated injury/recovery predictor.

## Features and use

| Feature | What it does | Important limitation |
|---|---|---|
| Monthly mileage | 3, 6 or 12 calendar months, logged distance and workout counts | The current month is marked partial |
| Weekly progression | Logged weekly mileage or distance-weighted Easy/Recovery pace | Never extrapolates an incomplete week |
| Completed-week comparison | Compares the 4 latest completed weeks against the 4 preceding them | Missing workouts cannot be inferred as rest |
| Telemetry | Switch between recorded HR, cadence, power, elevation and derived segment pace | Requires at least 2 usable sensor records |
| Lap lab | Normalized split paces, fastest comparable device lap and descriptive pace variability | Short recovery-size laps are excluded from effort ranking |
| Race progression | Actual Race-labeled records near standard event distances | Does not invent unrecorded races |
| Two-workout comparison | Distances, durations, normalized pace and recorded HR where present | Terrain and training purpose are not controlled |

Open **Workout log → FIT / GPX / TCX** and import a run locally after reviewing
the privacy/storage warning. From **Insights**, choose a monthly time window
or switch the weekly metric. Open **Workout log → Details** to select a
sensor chart or inspect the recorded lap table. Classify genuine races as
**Race** to populate race-specific analysis.

**Back up** device-local data with Workout log → Backup local data. These
backup files are not encrypted by PaceLab and contain private training
and sensor information; store them privately.

## Definitions

**Monthly volume:** Sum of logged workout distances in miles that fall in
a given calendar month on or before today's date. The current calendar
month is always labeled incomplete. The chart does not project how
many miles the runner will complete by month end.

**Completed-week mileage:** Monday–Sunday calendar weeks. Compare the most
recent four completed weeks against the preceding four completed weeks,
excluding the currently incomplete week from both windows.

**Easy/Recovery pace:** `sum(timer seconds) / sum(miles)` among recorded
Easy/Recovery workouts, expressed in seconds per mile. This is a
distance-weighted average, not the arithmetic mean of the per-run paces.

**Lap pace:** `timer duration / lap distance`. Device laps shorter than
0.25 miles are tagged as short/recovery-size. Among longer laps,
comparability requires distance within ±15% of the median longer-lap
distance. The fastest comparable lap and pace coefficient of variation
are descriptive metrics, not inferred workout intensity.

**Telemetry:** Plots use recorded observations only. Invalid and missing
heart-rate, cadence, power, elevation or pace readings are discarded,
never replaced by estimated values. The arithmetic average of plotted
samples is *not* equivalent to a time-weighted or device-reported
whole-session average.

## Architecture

~~~mermaid
flowchart TD
    A[Browser-local FIT / GPX / TCX import] --> B[(Device-local workout summaries)]
    C[Optional private authenticated API] --> D[(Account-owned workouts)]
    B --> E[Athlete Studio]
    D --> E
    E --> F[Monthly and completed-week totals]
    E --> G[Selectable sensor timeline]
    E --> H[Distance-aware device lap analysis]
    E --> I[Actual Race result history]
~~~

- Pure calculations: `src/athlete-studio-core.js`, tested in
  `tests/athlete-studio.test.js`.
- UI renderer: `src/athlete-studio.js`, independent of any frontend
  framework or third-party chart platform.
- Workout detail integration: `src/intelligence.js`, which uses real
  sensor timelines and laps from the chosen activity.
- App lifecycle and navigation: `src/app.js` with expanded keyboard
  and mobile controls.
- API counterpart: `backend/app/periods.py` reports monthly summaries and
  completed four-week changes via authenticated `GET /api/insights/summary`.
- Browser acceptance coverage: `e2e/athlete-studio.spec.js` and
  `e2e/account-analytics.spec.js`.

The public GitHub Pages app **does not run PostgreSQL or FastAPI**. Account
synchronization requires separately deployed cloud infrastructure.

## Accessibility and performance

Charts include semantic labels and accompanying text summaries. Native
select controls are keyboard-operable. Mobile navigation has explicit
`aria-expanded` and `aria-controls` states and can be closed with Escape
or by clicking the backdrop. Reduced-motion preferences are respected.

Data views are bounded by source activity/file sample caps; no giant chart
dependency or remote data request is needed for the locally stored records.

## Test and interpretation limits

Run `npm test`, `npm run test:e2e` and `npm run build`. From `backend/`,
run `python -m pytest -q` for API and research checks.

Real-world usability, assistive-technology compatibility, multi-device
synchronization, official COROS integration and sports-science validity
have **not** been independently certified.

See [privacy-first imports](browser-import.md),
[research methods](ml-methodology.md), and
[security controls](../SECURITY.md).

## Race evidence lab

Insights now includes a private data audit, race-by-race forecast replay,
method/event filters and downloadable reports. See [real-race evaluation](real-race-evaluation.md)
for the fixed causal protocol, exclusions and interpretation limits.
