"""Prequential, controlled distribution-shift research for race forecasting.

SYNTHETIC-ONLY: these are generated mathematical features and outcomes, not
observations about athletes or a validated running physiology simulation.

Question: holding the forecaster class fixed, which update policy survives
a change of input distribution, target relationship, or observation noise?

Every forecast is issued before seeing its target; any change detector fires
only after the target is revealed and can update the *next* forecast.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import mean

import numpy as np
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .evaluate import numerical_metrics

SCENARIOS = ("stationary", "covariate", "concept", "noise", "combined")
POLICIES = ("frozen", "periodic", "rolling", "change_triggered")
FEATURES = (
    "event_meters", "weekly_miles_4w",
    "average_easy_pace_seconds_per_mile",
    "hard_sessions_4w", "longest_run_miles",
)
DEFAULT_SEEDS = (7, 19, 41)


def generate_synthetic_races(*, scenario: str, seed: int, n: int = 220,
                             shift_at: int = 140, strength: float = 1.0):
    """Generate a controlled input/label mechanism using independent RNG.

    Pre-shift outcomes match across scenarios for the SAME seed. This
    paired design isolates intervention effects. Event is fixed at 5K to
    avoid mixing event-distance variance with distribution drift.

    No hidden future features, test labels, runner IDs or real GPS appear.
    Returns the existing race trainer's (date, feature-vector, target) format.
    """
    if scenario not in SCENARIOS:
        raise ValueError("Unknown shift scenario")
    if not 30 <= n <= 20000 or not 10 <= shift_at < n - 5:
        raise ValueError("Invalid sequence length or shift location")
    if not math.isfinite(strength) or not 0 <= strength <= 3:
        raise ValueError("strength must be between zero and three")
    rng = np.random.default_rng(seed)
    initial_date = date(2022, 1, 1)
    rows = []
    for i in range(n):
        # Draw the same primitive random numbers in every scenario;
        # only the equations change after the controlled intervention.
        u = rng.normal(size=4)
        z = float(rng.normal())
        post = i >= shift_at
        do_covariate = post and scenario in ("covariate", "combined")
        do_concept = post and scenario in ("concept", "combined")
        do_noise = post and scenario in ("noise", "combined")
        spread = 1.0 + (0.30 * strength if do_covariate else 0.0)
        miles = float(np.clip(38 + 7 * u[0] * spread +
                              (15 * strength if do_covariate else 0), 8, 110))
        easy_pace = float(np.clip(490 + 23 * u[1] * spread -
                                  (24 * strength if do_covariate else 0), 300, 780))
        hard = float(np.clip(round(3 + 1.2 * u[2] +
                                   (1.2 * strength if do_covariate else 0)), 0, 9))
        longest = float(np.clip(11 + 1.9 * u[3] * spread +
                                 (2.0 * strength if do_covariate else 0), 3, 25))
        # The following coefficient choices are illustrative math only.
        expected = (1200 - 2.2 * (miles - 38) +
                    0.65 * (easy_pace - 490) - 4 * (hard - 3) -
                    0.9 * (longest - 11))
        if do_concept:
            expected += strength * (90 + 3.4 * (miles - 38))
        sigma = 18 + (32 * strength if do_noise else 0)
        finish_seconds = max(400.0, expected + sigma * z)
        rows.append((initial_date + timedelta(days=7 * i),
                     [5000.0, miles, easy_pace, hard, longest],
                     float(finish_seconds)))
    return rows


class PageHinkley:
    """One-sided cumulative monitor of *observed* normalized absolute error.

    Parameters are selected from the original pre-shift calibration prefix.
    This is a basic monitored residual heuristic, not an independently
    calibrated change-point test.
    """

    def __init__(self, *, slack: float = 0.35, threshold: float = 8.0):
        if slack < 0 or threshold <= 0:
            raise ValueError("Invalid detector parameters")
        self.slack = slack
        self.threshold = threshold
        self.reset()

    def reset(self):
        self.cumulative = 0.0
        self.minimum = 0.0

    def observe(self, normalized_absolute_error: float) -> bool:
        if not math.isfinite(normalized_absolute_error) or normalized_absolute_error < 0:
            raise ValueError("Expected finite, nonnegative normalized error")
        self.cumulative += normalized_absolute_error - 1.0 - self.slack
        self.minimum = min(self.minimum, self.cumulative)
        return (self.cumulative - self.minimum) >= self.threshold


def _fit(rows):
    if not rows:
        raise ValueError("At least one prior labeled row required")
    model = make_pipeline(StandardScaler(), Ridge(alpha=12.0))
    model.fit([r[1] for r in rows], [r[2] for r in rows])
    return model


def _calibration_scale(rows, initial_train: int):
    """Time-ordered calibration strictly inside the initial training prefix."""
    calibration_size = max(8, min(20, initial_train // 4))
    cutoff = initial_train - calibration_size
    if cutoff < 20:
        raise ValueError("Initial prefix too short for detector calibration")
    model = _fit(rows[:cutoff])
    errors = [abs(float(model.predict([r[1]])[0]) - r[2])
              for r in rows[cutoff:initial_train]]
    return max(8.0, float(mean(errors)))


def prequential_forecasts(rows, *, initial_train: int = 80,
                          window: int = 48, periodicity: int = 20,
                          detector_threshold: float = 8.0,
                          detector_slack: float = 0.35):
    """Run four forecasting policies with a strict prediction→observation order.

    The event at t is *predicted* from data indexed <t. Once its true finish
    is known, the detector may retrain with rows <=t, effective from t+1.

    Consequence: no method may access row t's outcome or later labels
    while predicting row t. Returned training_end_index permits auditing.
    """
    if initial_train < 35 or initial_train >= len(rows) - 5:
        raise ValueError("Need substantial training and future evaluation")
    if window < 20 or window > initial_train:
        raise ValueError("Window must be between 20 and initial_train")
    if periodicity < 1:
        raise ValueError("periodicity must be positive")
    dates = [r[0] for r in rows]
    if any(a >= b for a, b in zip(dates, dates[1:])):
        raise ValueError("Chronology must be strictly increasing; group same-day races first")
    if not all(len(r[1]) == len(FEATURES) and
               all(math.isfinite(float(v)) for v in (*r[1], r[2]))
               for r in rows):
        raise ValueError("Nonfinite or malformed feature/target vector")

    frozen = _fit(rows[:initial_train])
    periodic = _fit(rows[:initial_train])
    adaptive = _fit(rows[:initial_train])
    periodic_end = initial_train - 1
    adaptive_end = initial_train - 1
    baseline_scale = _calibration_scale(rows, initial_train)
    detector = PageHinkley(slack=detector_slack, threshold=detector_threshold)
    results = {name: [] for name in POLICIES}
    alarms = []

    for t in range(initial_train, len(rows)):
        # Periodic update uses only known observations prior to t.
        if t > initial_train and (t - initial_train) % periodicity == 0:
            periodic = _fit(rows[:t])
            periodic_end = t - 1
        rolling_start = max(0, t - window)
        rolling = _fit(rows[rolling_start:t])
        x = [rows[t][1]]
        actual = float(rows[t][2])
        models = {
            "frozen": (frozen, initial_train - 1),
            "periodic": (periodic, periodic_end),
            "rolling": (rolling, t - 1),
            "change_triggered": (adaptive, adaptive_end),
        }
        for name, (model, last_seen) in models.items():
            estimate = float(model.predict(x)[0])
            results[name].append({
                "index": t, "date":rows[t][0].isoformat(),
                "actual":actual, "prediction":estimate,
                "absolute_error":abs(actual-estimate),
                "training_end_index":last_seen,
            })
            if last_seen >= t:
                raise AssertionError("Training target leakage detected")

        # Time t's label is NOW observed. Retraining here only changes
        # forecasts from t+1 onward; the record at t remains unchanged.
        deviation = results["change_triggered"][-1]["absolute_error"] / baseline_scale
        if detector.observe(deviation):
            alarms.append(t)
            adaptive = _fit(rows[max(0,t + 1 - window):t + 1])
            adaptive_end = t
            detector.reset()

    return {
        "strategies":results, "alarms":alarms,
        "calibration_mae_floor_seconds":round(baseline_scale,3),
        "assumption":"Race finish label is available immediately AFTER its forecast. No delayed result reports are simulated.",
    }


def summarize_run(rows, forecasts, *, shift_at: int):
    out = {}
    for strategy, points in forecasts["strategies"].items():
        by_phase = {}
        for phase, items in (
            ("before_boundary", [p for p in points if p["index"] < shift_at]),
            ("after_boundary", [p for p in points if p["index"] >= shift_at]),
        ):
            if not items:
                raise ValueError("Each evaluation phase must contain observations")
            by_phase[phase] = numerical_metrics(
                [p["actual"] for p in items], [p["prediction"] for p in items])
        out[strategy] = by_phase
    alarms = forecasts["alarms"]
    post = [index for index in alarms if index >= shift_at]
    return {
        "policies":out,
        "detector": {
            "total_alarms":len(alarms),
            "before_boundary_alarms":sum(index < shift_at for index in alarms),
            "first_after_boundary_delay":post[0]-shift_at if post else None,
            "after_boundary_alarms":len(post),
        },
    }


def paired_post_differences(replications):
    """Report seed-paired post-boundary MAE differences versus frozen.

    Negative seconds = policy improves over the frozen model ON THAT
    SYNTHETIC SEED. No p-values or population significance are implied.
    """
    grouped = defaultdict(list)
    for run in replications:
        reference = run["policies"]["frozen"]["after_boundary"]["mae_seconds"]
        for policy in POLICIES:
            if policy == "frozen":
                continue
            alternative = run["policies"][policy]["after_boundary"]["mae_seconds"]
            grouped[(run["scenario"], policy)].append({
                "seed":run["seed"],
                "delta_mae_seconds":round(alternative-reference, 3),
            })
    comparisons = []
    for (scenario, policy), differences in sorted(grouped.items()):
        deltas = [item["delta_mae_seconds"] for item in differences]
        comparisons.append({
            "scenario":scenario, "policy":policy,
            "seed_pairs":differences,
            "n_seed_pairs":len(deltas),
            "mean_paired_delta_mae_seconds":round(mean(deltas), 3),
            "seeds_better_than_frozen":sum(value < 0 for value in deltas),
            "interpretation":"Negative means better than frozen on this synthetic cohort; this is not an athlete efficacy estimate.",
        })
    return comparisons


def run_benchmark(*, seeds=DEFAULT_SEEDS, scenarios=SCENARIOS,
                  n: int = 220, initial_train: int = 80,
                  shift_at: int = 140, window: int = 48,
                  strength: float = 1.0):
    """A fixed protocol: same policies, prechosen scenarios and RNG seeds.

    No model or policy is selected based on the post-intervention errors.
    Every summary names the synthetic source explicitly.
    """
    seeds = tuple(int(s) for s in seeds)
    scenarios = tuple(scenarios)
    if not seeds or len(set(seeds)) != len(seeds):
        raise ValueError("Provide nonempty unique seeds")
    if not scenarios or any(s not in SCENARIOS for s in scenarios):
        raise ValueError("Choose valid scenarios")
    if not initial_train + 10 <= shift_at < n - 10:
        raise ValueError("Need at least 10 pre/post observations after initial fitting")
    raw = []
    accum = defaultdict(lambda: {"actual":[],"prediction":[]})
    for scenario in scenarios:
        for seed in seeds:
            rows = generate_synthetic_races(scenario=scenario, seed=seed,
                                             n=n, shift_at=shift_at,
                                             strength=strength)
            forecasts = prequential_forecasts(rows, initial_train=initial_train,
                                             window=window)
            report = summarize_run(rows, forecasts, shift_at=shift_at)
            raw.append({
                "scenario":scenario,"seed":seed,
                "policies":report["policies"],
                "detector":report["detector"],
            })
            for policy, points in forecasts["strategies"].items():
                for p in points:
                    phase = "before_boundary" if p["index"] < shift_at else "after_boundary"
                    key = (scenario, policy, phase)
                    accum[key]["actual"].append(p["actual"])
                    accum[key]["prediction"].append(p["prediction"])

    summary = []
    for (scenario, policy, phase), values in sorted(accum.items()):
        metrics = numerical_metrics(values["actual"], values["prediction"])
        summary.append({"scenario":scenario,"policy":policy,"phase":phase,**metrics})
    return {
        "metadata":{
            "data_source":"controlled_synthetic_generator_only",
            "research_status":"method_prototype_not_athlete_validated",
            "feature_columns":FEATURES, "seeds":list(seeds),
            "scenarios":list(scenarios), "n_per_seed":n,
            "initial_labeled_prefix":initial_train,
            "regime_boundary_index":shift_at,
            "boundary_interpretation":"pseudo-boundary only for stationary condition",
            "sliding_window":window, "periodicity":20,
            "severity":strength,
            "policy_definitions":{
                "frozen":"Ridge+standardization fitted once to first labeled prefix",
                "periodic":"Ridge refitted on all earlier labels every 20 outcomes",
                "rolling":"Ridge refitted using most recent 48 prior outcomes each prediction",
                "change_triggered":"Residual monitor updates Ridge on latest 48 labels only AFTER detecting an observed high error",
            },
            "nonclaims":[
                "Synthetic races and coefficients do not represent sports physiology",
                "No model was tuned using post-boundary outcomes",
                "All methods observe the previous finish immediately after prediction",
                "Three seeds are not sufficient for a statistical superiority claim",
                "Lower synthetic MAE does not establish real race prediction accuracy",
            ],
        },
        "summary":summary, "replications":raw,
        "paired_post_differences":paired_post_differences(raw),
    }


def save_report(report, output_dir):
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    (output/"shift-summary.json").write_text(
        json.dumps(report, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    columns = ("scenario", "policy", "phase", "n",
               "mae_seconds", "rmse_seconds",
               "median_absolute_error_seconds")
    with (output/"shift-metrics.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows({k: row[k] for k in columns} for row in report["summary"])
    return str(output/"shift-summary.json"), str(output/"shift-metrics.csv")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True,
                        help="Directory for synthetic-only JSON/CSV")
    parser.add_argument("--seeds", default="7,19,41",
                        help="Comma-separated fixed RNG seeds")
    parser.add_argument("--strength", type=float, default=1.0)
    args=parser.parse_args(argv)
    seeds=tuple(int(item.strip()) for item in args.seeds.split(","))
    report=run_benchmark(seeds=seeds, strength=args.strength)
    paths=save_report(report,args.output_dir)
    print("SYNTHETIC-ONLY distribution-shift benchmark; NOT a real athlete model")
    for row in report["summary"]:
        if row["phase"] == "after_boundary":
            print(f"{row['scenario']:>11} | {row['policy']:<16} | "
                  f"post-boundary MAE {row['mae_seconds']:>7.2f}s "
                  f"(n={row['n']})")
    print("Saved:", *paths, sep="\n  ")
    return report


if __name__ == "__main__":
    main()
