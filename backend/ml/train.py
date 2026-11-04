"""Train an exploratory race-time model from a user's labeled race-history CSV.

Input schema: date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,
hard_sessions_4w,longest_run_miles,finish_seconds

Usage (from backend/):
  python -m ml.train --csv path/to/private-races.csv --output models/race_rf.joblib

Date-ordered 70/15/15 split, comparing a median baseline to random forest;
the middle validation partition calibrates a symmetric 90% absolute-residual
interval. The test partition is never used for training or interval calibration.
"""
import argparse
import csv
import json
import math
from datetime import date
from pathlib import Path

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
    from sklearn.dummy import DummyRegressor
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics import mean_absolute_error

    rows = read_rows(csv_path)
    n = len(rows)
    train_end, val_end = int(n * 0.7), int(n * 0.85)
    train_rows, val_rows, test_rows = rows[:train_end], rows[train_end:val_end], rows[val_end:]
    train_x = np.array([r[1] for r in train_rows])
    train_y = np.array([r[2] for r in train_rows])
    val_x = np.array([r[1] for r in val_rows])
    val_y = np.array([r[2] for r in val_rows])
    test_x = np.array([r[1] for r in test_rows])
    test_y = np.array([r[2] for r in test_rows])
    baseline = DummyRegressor(strategy="median").fit(train_x, train_y)
    model = RandomForestRegressor(n_estimators=200, min_samples_leaf=3, random_state=42, n_jobs=-1).fit(train_x, train_y)
    validation_baseline_mae = float(mean_absolute_error(val_y, baseline.predict(val_x)))
    validation_model_mae = float(mean_absolute_error(val_y, model.predict(val_x)))
    # Select using validation only, preserving a blind held-out test partition.
    chosen = model if validation_model_mae < validation_baseline_mae else baseline
    name = "random_forest" if chosen is model else "median_baseline"
    val_residuals = np.abs(val_y - chosen.predict(val_x))
    # Finite-sample split conformal quantile. May give infinite intervals with
    # very few samples; the minimum data size above prevents that in normal use.
    rank = math.ceil((len(val_residuals) + 1) * 0.9)
    half_width = float(np.sort(val_residuals)[min(rank, len(val_residuals)) - 1])
    test_prediction = chosen.predict(test_x)
    test_mae = float(mean_absolute_error(test_y, test_prediction))
    test_coverage = float(np.mean(np.abs(test_y - test_prediction) <= half_width))
    report = {
        "training_rows": len(train_rows), "validation_rows": len(val_rows), "test_rows": len(test_rows),
        "training_end_date": str(train_rows[-1][0]), "validation_end_date": str(val_rows[-1][0]),
        "validation_baseline_mae_seconds": round(validation_baseline_mae, 2),
        "validation_forest_mae_seconds": round(validation_model_mae, 2),
        "selected_model": name, "test_mae_seconds": round(test_mae, 2),
        "test_interval_coverage": round(test_coverage, 3), "interval_half_width_seconds": round(half_width, 2),
    }
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": chosen, "interval_half_width_seconds": half_width, "validation": report, "demo": False, "method": name}, output)
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    train(args.csv, args.output)
