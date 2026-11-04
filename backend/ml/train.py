"""Train an exploratory race-time model from a user's labeled race-history CSV.

Input schema: date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,
hard_sessions_4w,longest_run_miles,finish_seconds

Usage (from backend/):
  python -m ml.train --csv path/to/private-races.csv --output models/race_rf.joblib

Date-grouped chronological 70/15/15 split comparing median, ridge and random forest;
the middle validation partition calibrates an approximate 90% interval.
Also reports rolling backtests, a prior-race Riegel comparator, per-event test
errors and the held-out test results, without selecting on the test split.
"""
import argparse
import csv
import json
import math
from statistics import mean
from sklearn.inspection import permutation_importance
from datetime import date
from pathlib import Path
from .evaluate import chronological_backtest, grouped_dates, model_candidates, predict_riegel_from_training, numerical_metrics

FEATURES = [
    "event_meters", "weekly_miles_4w", "average_easy_pace_seconds_per_mile",
    "hard_sessions_4w", "longest_run_miles",
]
TARGET = "finish_seconds"
COLUMNS = ["date", *FEATURES, TARGET]


def read_rows(path):
    records = []
    with open(path, newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames or not set(COLUMNS).issubset(reader.fieldnames):
            raise ValueError("CSV requires columns: " + ", ".join(COLUMNS))
        for line, row in enumerate(reader, 2):
            try:
                day = date.fromisoformat(row["date"])
                features = [float(row[key]) for key in FEATURES]
                result = float(row[TARGET])
                if not all(math.isfinite(x) for x in [*features, result]) or any(x <= 0 for x in [features[0], features[2], result]) or any(x < 0 for x in [features[1], features[3], features[4]]):
                    raise ValueError("Non-finite or invalid value")
                if not (800 <= features[0] <= 10000):
                    raise ValueError("event_meters out of supported range")
            except (ValueError, TypeError, KeyError) as exc:
                raise ValueError(f"Invalid CSV row {line}: {exc}") from exc
            records.append((day, features, result))
    if len(records) < 60:
        raise ValueError("At least 60 labeled race records are needed for this experimental training script")
    records.sort(key=lambda item: item[0])
    return records


def train(csv_path, output_path):
    import joblib
    import numpy as np
    from sklearn.metrics import mean_absolute_error

    rows=read_rows(csv_path)
    train_rows,val_rows,test_rows=grouped_dates(rows)
    if len(train_rows)<30 or len(val_rows)<5 or len(test_rows)<5:
        raise ValueError("Need enough distinct chronological race records in each partition")

    train_x=np.array([r[1] for r in train_rows])
    train_y=np.array([r[2] for r in train_rows])
    val_x=np.array([r[1] for r in val_rows])
    val_y=np.array([r[2] for r in val_rows])
    test_x=np.array([r[1] for r in test_rows])
    test_y=np.array([r[2] for r in test_rows])

    models=model_candidates()
    validation={}
    for name,model in models.items():
        model.fit(train_x,train_y)
        validation[name]=float(mean_absolute_error(val_y,model.predict(val_x)))

    # Choose ONLY using validation, never the held-out test set.
    name=min(validation,key=validation.get)
    chosen=models[name]
    residuals=np.abs(val_y-chosen.predict(val_x))
    rank=math.ceil((len(residuals)+1)*.90)
    # Tiny validation cohorts are known to have unstable empirical calibration.
    half_width=float(np.sort(residuals)[min(rank,len(residuals))-1])
    predictions=chosen.predict(test_x)
    test_mae=float(mean_absolute_error(test_y,predictions))
    coverage=float(np.mean(np.abs(test_y-predictions)<=half_width))

    riegel_predictions=predict_riegel_from_training(train_rows,test_rows)
    known=[(actual,pred) for actual,pred in zip(test_y,riegel_predictions) if pred is not None]
    riegel_mae=float(mean(abs(y-p) for y,p in known)) if known else None
    test_median=round(float(mean_absolute_error(test_y,models["median_baseline"].predict(test_x))),2)
    events={}
    for meters in sorted(set(float(r[1][0]) for r in test_rows)):
        indices=[i for i,r in enumerate(test_rows) if float(r[1][0])==meters]
        if indices:
            events[str(int(meters))]={
                "n":len(indices),
                "mae_seconds":round(float(np.mean(np.abs(test_y[indices]-predictions[indices]))),2),
            }
    backtest=chronological_backtest(rows)
    # Permutation importance is estimated on the validation cohort only.
    # It is model-specific association, not a causal explanation.
    importances=permutation_importance(chosen,val_x,val_y,
        scoring="neg_mean_absolute_error",n_repeats=5,random_state=42,n_jobs=1)
    importance={key:round(float(importance),3) for key,importance
        in zip(FEATURES,importances.importances_mean)}


    report={
        "dataset_origin":"user_supplied_labeled_race_results",
        "training_rows":len(train_rows),
        "validation_rows":len(val_rows),
        "test_rows":len(test_rows),
        "training_end_date":str(train_rows[-1][0]),
        "validation_end_date":str(val_rows[-1][0]),
        "test_start_date":str(test_rows[0][0]),
        "validation_mae_seconds":{key:round(value,2) for key,value in validation.items()},
        "validation_baseline_mae_seconds":round(validation["median_baseline"],2),
        "validation_forest_mae_seconds":round(validation["random_forest"],2),
        "selected_model":name,
        "validation_permutation_importance_mae_seconds":importance,
        "test_records_per_event":{str(int(meters)):sum(float(r[1][0])==meters for r in test_rows)
            for meters in sorted(set(float(r[1][0]) for r in test_rows))},
        "test_mae_seconds":round(test_mae,2),
        "test_rmse_seconds":numerical_metrics(list(test_y),list(predictions))["rmse_seconds"],
        "test_median_baseline_mae_seconds":test_median,
        "test_riegel_baseline_mae_seconds":round(riegel_mae,2) if riegel_mae is not None else None,
        "test_interval_coverage":round(coverage,3),
        "interval_half_width_seconds":round(half_width,2),
        "test_per_event":events,
        "rolling_backtest":backtest,
        "limitations":[
            "Chronological partitions reduce but do not eliminate distribution shift.",
            "Single-athlete data may not generalize to other runners.",
            "Repeated athletes pooled without an athlete-disjoint split may inflate generalization.",
            "Intervals are empirical and may fail under future changes in performance.",
            "Models are exploratory; no clinical or athletic validation is claimed."
        ]
    }
    output=Path(output_path)
    output.parent.mkdir(parents=True,exist_ok=True)
    joblib.dump({
        "model":chosen,
        "interval_half_width_seconds":half_width,
        "validation":report,
        "demo":False,
        "method":name,
    },output)
    report_path=output.with_suffix(".metrics.json")
    report_path.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    # Human-readable experiment report, intentionally independent of any UI hype.
    model_card=output.with_suffix(".model-card.md")
    leaderboard="\n".join(
        f"| {candidate} | {error:.2f} s |" for candidate,error
        in sorted(validation.items(),key=lambda pair:pair[1])
    )
    model_card.write_text(
        "# PaceLab — Exploratory race-time model card\n\n"
        "## Status\nNot externally validated or production-certified. "
        "Only operator-supplied labeled data were used.\n\n"
        "## Validation comparison (lower is better)\n"
        "| Model | Validation MAE |\n|---|---:|\n"+leaderboard+"\n\n"
        f"Selected on validation: **{name}**.\n\n"
        f"Held-out later-date test MAE: **{test_mae:.2f} seconds**.\n\n"
        f"Median baseline MAE: **{test_median:.2f} seconds**.\n\n"
        f"Riegel prior-race comparator MAE: **{riegel_mae:.2f} seconds**.\n\n"
        f"Observed 90% interval coverage: **{coverage:.1%}**; "
        f"estimated interval half-width: {half_width:.1f} seconds. "
        "Nominal intervals are not distribution-shift guarantees.\n\n"
        "## Features\n"
        + "\n".join(f"- {name}" for name in FEATURES)
        + "\n\n## Evaluation caveats\n"
        + "\n".join("- "+c for c in report["limitations"])
        + "\n\nDo not present this model as a guaranteed race forecast.\n",
        encoding="utf-8")
    print(json.dumps(report,indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    train(args.csv, args.output)
