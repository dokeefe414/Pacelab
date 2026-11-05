# Real-race evaluation and the Race evidence lab

PaceLab can now audit one athlete's records and replay forecasts chronologically.
Open **Insights → Athlete Studio → Race evidence lab**. This works with local
workouts and the signed-in account's already-loaded records. It does not require
a hosted model, a new server endpoint or a database migration.

This is retrospective exploratory research. The panel does not select a winner,
change the production predictor or claim that a small race history validates ML.
The existing 60-row training-artifact readiness gate is unchanged. The lab's
12-date threshold is only a minimum for an exploratory ridge fit.

## Prepare actual results

1. Import your FIT/GPX/TCX files using the existing import controls, or restore
   your private PaceLab JSON backup. Account mode uses your own account records.
2. In Workout details, label genuine completed races **Race**. Imports default
   to a training type; neither fast pace nor an 8 km watch distance proves a race.
3. Verify race date, official distance and finish time. The current schema uses
   workout distance/duration as labels, not a separate official-results record.
   If the imported timer is not the official finish, retain a private backup and
   correct the underlying record via the existing workout API or a reviewed
   backup. Do not create a second copy and leave both in the evaluation.
4. Inspect **data quality and exclusions**. Resolve possible duplicates before
   interpreting errors. No audit action edits or deletes the original workouts.
5. Filter to one event and compare methods on the **same scored races**. Expand a
   race for its reference results, forecast, signed error, prior training dates,
   sessions and feature values. Export JSON and Markdown for a private review.

Supported events are 800 m, mile (1609.344 m), 3000 m, 5000 m, 8000 m and 10000 m.
A labeled race's watch distance is matched within 2.5%; this does not certify
course length. In particular, 1600 m and one mile should not be conflated when
entering official results. Terrain, wind, temperature, effort and illness are
not adjusted for. Check these limitations before interpreting small errors.

## Audit rules

- Invalid calendar dates, post-cutoff records, nonpositive/nonfinite durations
  or distances, durations over 24 hours and distances over 200 miles are excluded.
- Races outside the event tolerance and races with timer/elapsed disagreements
  over five seconds are excluded for review.
- Repeated IDs or source hashes on the same day, and same-day summaries within
  0.015 mi and five seconds, are possible duplicates. Both are excluded. This
  conservative rule can exclude genuine identical doubles; review the originals.
- A reused ID/hash on a later date excludes the later record without retroactively
  invalidating the earlier record. Records after the cutoff cannot change this.
- Unknown training types need review and never contribute model features.
- Missing/invalid average heart rate is disclosed but is not an exclusion: heart
  rate is not a feature in these models. Missing sensors are never filled with zero.

The audit covers the supplied snapshot, not whether every run was logged or
whether the labeling is correct. It cannot establish training-history completeness.
This is a replay of today's records, not proof that these forecasts were actually
issued before the races. Future corrections to historical records can change a replay.

## Fixed protocol `real-races-v1`

For target race date `t`, all reference races have dates **strictly less than t**.
No race or workout on `t` contributes to its forecast. Multiple same-day races
are kept out of each other's history. Input order does not determine forecasts.
For the latest-race reference, ties on date sort by event meters then duration;
this is a deterministic convention, not a guess about within-day race order.

| Method | Earlier evidence used |
|---|---|
| Previous same-distance race | Most recent earlier result in the same matched event |
| Latest race · Riegel | Latest earlier race, scaled by `(target/source)^1.06` |
| Frozen ridge | First 12 eligible distinct race dates; coefficients and scaling remain fixed |
| Expanding ridge | All eligible earlier race dates, refitted before each target |
| Rolling 12-date ridge | Last 12 eligible distinct race dates, refitted before each target |

A feature-eligible race needs at least five non-race sessions in `[t−28, t)` and
some explicitly labeled Easy/Recovery distance. The four features are:

- Total non-race miles in that window divided by four (logged volume, not an
  estimate of unrecorded training).
- Easy/Recovery total seconds divided by total miles (distance-weighted pace).
- Number of Tempo/Intervals sessions.
- Longest non-race run in miles.

Each ridge fit standardizes features using **its training subset only** (population
standard deviations, with constant columns assigned scale 1). The target is finish
seconds normalized to 5000 m using the fixed 1.06 exponent. With centered target
`y` and standardized design `Z`, coefficients solve:

`(ZᵀZ + 10 I) β = Zᵀ(y − mean(y))`.

The intercept is the training target mean; it is not penalized. A small 4×4
positive-definite system is solved directly in JavaScript. Normalized predictions
are converted back to the target distance. Nonfinite/nonpositive outputs are
withheld. There is no hyperparameter search, test-outcome model selection or
claim that the chosen exponent, penalty, lookback or window are optimal.
The Python artifact trainer remains a separate experiment; this panel does not
load or claim to reproduce that trainer's selected model.

## Metrics and interpretation

JSON includes per-method n, MAE, RMSE and signed bias, per-event metrics and a
complete matrix of pairwise comparisons on the intersection of available
forecasts. The UI shows paired comparisons against both Riegel and frozen ridge.
Negative paired MAE difference favors the row method **on those same races**.
Unavailable forecasts are null with a reason and never counted as zero error.

Compare rolling/expanding with frozen to investigate adaptation, then check
whether either improves over simple baselines. Different event mixes can distort
pooled errors; use the event filter. Repeated races from one runner are correlated.
No confidence intervals or significance claims are reported. A few improvements
are not evidence of generalization to new athletes or future seasons.

## Reproduce a report offline

Requires Node.js 22 or newer. The evaluation script itself uses no npm packages
or network services. Input is a **single athlete's** camelCase workout array,
`pacelab-local-backup-v1` JSON backup, or `pacelab-account-export-v1` JSON backup.
A training-feature CSV alone is insufficient for this raw-data audit.

```bash
npm run research:evaluate -- --input /path/to/private-backup.json --output-dir private-results --as-of 2026-11-05 --source real
```

Explicit cutoff and source are required. The source is a provenance declaration,
not automatic verification. Keep the input snapshot and code commit for exact
reproduction. The CLI writes `race-evaluation.json` and `race-report.md`, recording
protocol settings and the SHA-256 of the original input bytes. Repeating the
command with identical input, date and code produces byte-identical outputs.
Browser exports use the same engine and include the date/protocol; the CLI adds
the raw-input checksum. Browser exports always contain the full evaluation,
even when the panel is filtered to a single event.

The only committed example is **entirely artificial**:

```bash
npm run research:evaluate -- --input fixtures/race-study-synthetic.json --output-dir private-results --as-of 2025-12-31 --source synthetic
```

This deterministic fixture exercises feature windows, method updates and reports.
It is a software test, not a benchmark demonstrating real-athlete performance.
It is separate from the [controlled-shift experiment](distribution-shift-study.md).

## Privacy and verification

The lab calculates locally using the active workspace; it adds no network call.
Exports omit GPS, notes, emails, activity IDs and file hashes but still contain
private dates, finish times and training summaries. Do not commit private inputs
or reports. `private-results/` and the CLI report filenames are ignored by Git.
CI uses only the artificial fixture and uploads only its outputs.

Unit tests cover audit exclusions, no target/future/same-day leakage, model update
policies, constant-target ridge behavior, matched errors, deterministic reports
and both backup formats. Browser tests cover sample/empty modes, real-workspace
replays, filters, disclosure details, downloads and mobile rendering. Existing
backend, import, account and synthetic-shift checks remain in place.
