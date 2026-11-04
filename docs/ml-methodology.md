# PaceLab race-model research methodology

**Research status: experimental.** PaceLab does **not** ship a personal race
prediction model that has demonstrated accuracy on a representative, genuine
athlete dataset. The public demo uses a deterministic race-equivalence
formula. The code below is an *experiment pipeline*, not evidence of a
validated race forecast.

## Research question

Can pre-race training summaries predict finish time for standard track and
cross-country event distances more accurately than a simple statistical or
latest-race Riegel baseline? How stable are errors under temporal distribution
shift and changing training conditions?

## Label requirements

A labeled training example is a real Race workout at a supported event
(800 m, mile, 3K, 5K, 8K or 10K). Each example contains the actual recorded
finish time and only features from workouts **strictly before that race date**.

Expected CSV schema:

```csv
date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,hard_sessions_4w,longest_run_miles,finish_seconds
2026-08-01,5000,36.5,475,4,11.2,1200
```

The row above is **fictional and for schema illustration only**, not an
observed race or training measurement.

Feature definitions:

| Feature | Derivation |
|---|---|
| event_meters | Known target event, not inferred from the label |
| weekly_miles_4w | Sum of training mileage in 28 days before race / 4 |
| average_easy_pace_seconds_per_mile | Distance-weighted pace across Easy/Recovery training |
| hard_sessions_4w | Tempo/Intervals sessions before race |
| longest_run_miles | Maximum logged training distance before race |
| finish_seconds | Actual race finish time, **supervised label only** |

Race date, future performances and same-day workouts do not enter the feature
vector. The exporter excludes races with fewer than five prior workouts
or no Easy/Recovery pace. It also excludes future-dated races.

## Dataset quality gates

The trainer requires at least 60 labeled real race rows and sufficient
distinct dates for date-grouped evaluation; more data is generally necessary
to make reliable claims, especially for multiple events or different runners.

Before interpreting accuracy, check:

1. Are all events measured accurately and normalized to the same clock units?
2. Are any race times workouts incorrectly labeled Race?
3. Is incomplete training logging mistaken for a true lower volume?
4. Are multiple athletes mixed without an athlete identifier?
5. Did race conditions, terrain, age, injury or changing training goals
   materially change the data distribution?
6. Are repeated races or duplicate imports accidentally counted twice?

The current CSV does not encode athlete ID or conditions; therefore it
**cannot verify athlete-disjoint generalization**. This is a significant
limitation for multi-runner claims.

## Model comparison

The offline experiment compares:

- Median finish-time regression baseline
- Standardized ridge regression
- Random forest
- Histogram gradient boosting
- A small, strongly regularized neural-network baseline
- Latest known prior-race Riegel race equivalence

The neural model is deliberately small; a larger deep network on 60
rows is not evidence of a more powerful predictor.

## Holdout design and leakage control

Chronological split: earliest approximately 70% of race dates for training,
next 15% for validation, most recent 15% for testing, with **same-date races
kept in the same partition**. Model selection uses **validation error**.
The selected model is evaluated on the held-out later test partition.

Additional expanding-window folds evaluate past-to-future errors, never
training on rows at or after each held-out fold. The Riegel comparator
uses only known prior races and does not look up future reference efforts.

This setup helps detect time-dependent problems, but it cannot guarantee
generalization under athlete or course shift. Repeated tuning on the
test set would violate the holdout's purpose.

## Evaluation metrics

| Metric | Why it matters |
|---|---|
| MAE (seconds) | Typical absolute prediction error |
| RMSE (seconds) | More sensitivity to large misses |
| Per-event error | A pooled score can hide 800m vs 8K differences |
| Empirical interval coverage | Tests how often claimed intervals contain outcomes |
| Riegel/median comparisons | A complex model should earn its extra complexity |
| Validation permutation importance | Association with forecast error, **not causation** |

A symmetric residual-derived interval is not a calibrated guarantee under
future distribution shift; with small datasets, its uncertainty is substantial.
The experiment explicitly reports observed coverage instead of treating
nominal 90% as proven.

## Run an experiment

From the backend/ directory:

```bash
python -m pip install -r requirements-ml.txt
python -m ml.train --csv /secure/real-races.csv --output models/pacelab-race.joblib
```

Outputs (not committed):

- pacelab-race.joblib: operator-trusted serialized model
- pacelab-race.metrics.json: chronological results and comparison
- pacelab-race.model-card.md: readable model/dataset limitations

Never load a joblib file from an untrusted source. Never publish a
private athlete training CSV. The website's ML endpoint is unavailable
until a suitable trusted artifact is configured by the operator.

## Explicit release criteria

Do not claim a model is reliable or outperforming baselines unless:

- Records come from consented genuine results with documented provenance.
- Results exceed simple baselines on a **held-out** chronology.
- There is enough coverage for intended events and athletes.
- Model error and interval coverage are reported with uncertainty.
- Athlete-disjoint evaluation is performed if claiming generalization.
- Inference handles missing data and out-of-distribution inputs honestly.
- An operator independently reviews model, privacy and deployment risks.

The project's time-series-distribution-shift research provides a useful
future direction, but is **not yet a validated component of PaceLab**.
