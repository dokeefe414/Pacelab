# Race-data governance and research ethics

PaceLab's race-prediction tools are an **experiment**, not a published
sports-science result. The public GitHub Pages website contains fictional
training data. Do not mix demonstration data with real performance labels.

## Ethical collection

Only use race and training records from athletes who have knowingly agreed
to the intended research use. Document the source, permission, date of
collection, allowed uses, withdrawal/deletion procedure and retention
window **outside this public repository**. Institutional research involving
human participants may require ethics/IRB review before collection.

PaceLab does not gather other runners' COROS histories automatically. Each
runner may export **their own account's** race-training CSV. Do not share
original FIT data, routes, student IDs, account emails or watch identifiers.

## A valid labeled example

Required fields in private CSV:

```csv
date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,hard_sessions_4w,longest_run_miles,finish_seconds
2026-09-20,5000,36.0,470,3,10,1198
```

This one-row example is **synthetic** and is not training data.

Each row's features come from logged workouts strictly before its actual
race date. The label is real race finish time. Same-day/future workouts
must not enter features. Invalid, missing or duplicate race labels need
manual verification.

## Optional multi-athlete column

To estimate generalization to runners unseen during training, append
a column called `athlete_id` with **stable pseudonyms**, never real names:

```csv
date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,hard_sessions_4w,longest_run_miles,finish_seconds,athlete_id
2026-09-20,5000,36.0,470,3,10,1198,runner_001
```

The optional group evaluator needs at least three distinct consented
pseudonyms and reports counts/metrics only. It uses GroupKFold, which
prevents overlap between training and test athletes but **does not
perform chronological holdout**. It supplements rather than replaces
the time-based evaluation.

## Readiness and limitations

A private account can query `GET /api/exports/race-readiness` to inspect
eligible row counts, distinct race dates and events. The current script
requires at least 60 genuine labeled race rows and 12 different dates,
and additional train/validation/test sufficiency checks. Passing these
counts **does not** establish statistical power or predictive quality.

Label provenance and course context matter. Different event distances,
weather, hilly courses, altitude, injuries, logging completeness and
training phases may confound predictions. Document these where possible;
the current feature set does not explicitly control for them.

## Experiment output

From the backend/ directory:

```bash
python -m ml.train --csv /secure/real-races.csv --output models/experiment.joblib
```

The trainer writes held-out temporal metrics, a model card and optional
athlete-disjoint cross-validation when permitted pseudonymous IDs exist.
Never use the held-out test partition for model selection, and never
interpret permutation importance as causation.

If there are too few real labeled races, the correct result is
**insufficient data**. Do not generate fake race finishes, label a
mathematical formula as learned AI, or present synthetic test scores as
actual athlete performance.

See [ML methodology](ml-methodology.md) and [privacy operations](privacy-and-operations.md).
