# PaceLab Research Track 1 — Forecast robustness under distribution shift

**Research status:** controlled, synthetic-only method development.
**No human participant data, privately exported watch files, race results,
GPS routes or real-athlete prediction claims are used in this experiment.**

This study starts the project's central technical mission: understand whether
updating a race-forecasting model after changing data conditions can improve
**future** predictions, without leaking future results into its forecast.

## Research question

> Given an identical prediction model and earlier labeled history, how do
> four update policies respond when the input distribution, output noise or
> mapping between training features and race finish time changes?

### Hypotheses (to be tested, not assumed)

1. A frozen model will be less robust to a genuine change of the
   feature-to-finish relationship than an adaptation policy.
2. Frequent sliding-window retraining may react faster but may overfit
   noisy or stationary regimes; it need not beat the frozen baseline.
3. A residual-triggered update may reduce compute/retraining while
   retaining some responsiveness, but can produce false alarms under
   variance changes.
4. A covariate-only shift can change prediction error without changing
   the true conditional mapping; extrapolation failure must not be
   confused with a change in the target mechanism.
5. Better accuracy on generated data does not imply that the update
   policy works on actual athletes, race courses or training seasons.

## Why we are doing synthetic experiments first

Actual runners do not provide clean experimental interventions. Racing
frequency is low, workouts are incompletely recorded, and course terrain,
weather, illness, tapering and athlete development introduce confounders.

A *mathematical generator* allows us to fix the exact intervention time,
retain identical pre-intervention trajectories between comparisons, and
test causal ordering before collecting more complex real data.

**This generator is not a model of exercise physiology.** Its coefficients
are arbitrary and have no empirical interpretation; changing a feature
does not demonstrate a causal effect of that training variable in people.

## The experiment

All data use PaceLab's existing feature schema, with the event fixed at 5K
to isolate changing feature mechanisms from differences between events:

| Feature | Synthetic definition |
|---|---|
| Event distance | Constant 5,000 meters |
| Weekly mileage over 4 weeks | Truncated Gaussian-like generator |
| Average Easy/Recovery pace | Truncated Gaussian-like generator |
| Hard sessions in 4 weeks | Rounded, bounded random feature |
| Longest run | Truncated Gaussian-like generator |
| Target | Mathematical linear relationship + Gaussian noise |

The 5 features mirror the existing real-race CSV layout, but the training
features and targets are **randomly generated**, not recorded running data.

Let the current synthetic observation be \(X_t\), and its finish-time label
be \(Y_t\). The baseline regime is:

\[
Y_t = 1200 - 2.2(M_t-38)+0.65(P_t-490)
      -4(H_t-3)-0.9(L_t-11)+\varepsilon_t
\]

with \(\varepsilon_t\sim N(0,18^2)\). These numbers were chosen for test
construction. They are *not* fitted to athletic outcomes.

All scenarios use the same RNG seed and draw order. Their histories match
exactly **before** the intervention boundary. At strength \(s=0\), all
intervention types reduce to the stationary generator.

### Pre-registered shift scenarios

| Condition | Intervention after boundary | Main failure mode |
|---|---|---|
| Stationary | None; boundary is a placebo | False alarms / unnecessary refits |
| Covariate | Mileage, pace, longest-run mean/spread changes | Extrapolation / input shift |
| Concept | Target intercept and mileage coefficient change | Changed conditional relationship |
| Noise | Target noise standard deviation increases | Apparent degradation without relationship shift |
| Combined | Covariate + concept + noise changes | Multiple simultaneous challenges |

Default protocol: **220 observations per seed**, initial labeled prefix of
**80**, intervention boundary at **140** (60 pre-boundary forecasts, 80
post-boundary forecasts), seeds **7, 19 and 41**. The stationary case
uses the same pseudo-boundary for honest negative-control comparison.

The intervention strength defaults to 1.0 and can be varied between 0
and 3. Response curves across severity levels are a future research
extension; selecting severity based on desired model performance is not
allowed.

## Naive comparator plus four controlled update policies

The simple **last-known-race** baseline uses the most recent *already
observed* 5K finish as its next 5K forecast, without fitting an ML model.
It provides a necessary challenge to more complex learned strategies.

The four learned policies use the **same model class**: StandardScaler
+ Ridge regression with alpha 12. Only the update policy changes.

| Policy | Training schedule | Expected tradeoff |
|---|---|---|
| Naive last race | Repeat the last already observed 5K finish | No fitting; responsive but noisy |
| Frozen | Fit first 80 labeled points once | Low compute, no shift adaptation |
| Periodic | Refit on all previously observed labels every 20 results | Tracks slow trends but retains old regimes |
| Rolling | Refit on most recent 48 labels before every forecast | Responsive, expensive, can forget stable history |
| Change-triggered | Monitor normalized absolute residuals; refit on latest 48 labels only after alarm | Lower update frequency, possible delay/false positives |

The residual monitor is a simple **one-sided Page–Hinkley-style** statistic
with a slack/threshold specified *before* testing. The normalization scale
comes from a sequential 20-result calibration within the initial 80
labeled observations (fit only on the earlier subset). It is a heuristic,
**not** a statistically calibrated change-point significance test.

### Non-negotiable causal ordering

~~~text
At observation t:
  1. Fit/refit from records indexed strictly < t, if scheduled.
  2. Predict target y_t with features x_t.
  3. Save prediction and model's latest training index.
  4. Reveal the actual race label y_t.
  5. Update residual monitor and, if necessary, refit using <= t.
  6. Use the updated model at t+1 or later.
~~~

A later label, including the intervention outcome at \(t\), must **never**
change any earlier prediction. The unit tests deliberately perturb future
labels to verify that predictions through that boundary are unchanged.

This study assumes labels arrive immediately after each forecast.
In real running, race results may arrive later or at irregular intervals.
That time-delay is not simulated here.

## Measurements and transparency

For each seed/scenario/policy, report MAE, RMSE and median absolute error
**separately before and after** the shift boundary. Do not hide
stationary or variance-only degradation.

Record change-detector alarms before the boundary (false positives in
the controlled synthetic study), number of post-boundary alarms and
delay to first post-boundary alarm, if any. This is detection behavior;
an alarm does not prove a meaningful athletic change.

The JSON report contains:
- exact seeds, scenario definitions, sample size and intervention position
- summary error metrics, individual replication metrics
- seed-paired post-boundary MAE differences against frozen (negative
  means lower error for that synthetic pair, not statistical significance)
- detector alarm counts and delays
- explicit assumptions, intended use and limitations

The companion CSV contains aggregated metrics only, with no real data.

**Important:** The three default seeds are convenient for CI and
debugging, **not sufficient for a significance or superiority claim**.
Any eventual comparison should use a larger, predeclared set of paired
seeds, report uncertainty in policy differences, and independently
test additional shifts and delayed-label behavior.

## Reproduce locally

From repository root on any system with Python 3.12:

~~~bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q tests/test_shift_experiment.py
python -m ml.shift_experiment --output-dir /tmp/pacelab-shift-results
~~~

Windows PowerShell equivalent for the benchmark:

~~~powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q tests/test_shift_experiment.py
python -m ml.shift_experiment --output-dir shift-results
~~~

Outputs:
- shift-summary.json
- shift-metrics.csv

Both are reproducible synthetic summaries with no athlete identifiers.
The scheduled/manual
[Shift Research CI workflow](../.github/workflows/shift-research.yml)
runs the same command and stores an artifact containing the generated
report. Workflows are not evidence of validation with real runners.

### Interpretation checklist

- Did rolling beat frozen **after** concept shift? By how much, for
  which seeds, and what did it cost during the stationary period?
- Did the change detector fire **before** the shift? If so, why?
- Does the noise-only shift cause false concept-change alarms?
- Was a reduction in MAE robust across seeds or driven by outliers?
- Was the periodic model competitive with the more complex policy?
- Are the assumptions and limitations printed alongside the outputs?

A single seed or scenario showing improvement is not evidence of a
universally better adaptive forecaster.

## Research roadmap after this experiment

1. **Sensitivity curves**: predeclare intervention-strength grid
   and plot paired policy error differences with uncertainty.
2. **Delayed sparse labels**: simulate races on an irregular calendar,
   with workout data between outcomes and different label delays.
3. **Time-varying dynamical generators**: add state-space processes
   and autocorrelated perturbations, not only IID Gaussian features.
4. **Robust drift detection**: calibrate detection thresholds on
   *training-only* stationary/noise null scenarios; compare
   detectors with explicit false-alarm and detection-delay metrics.
5. **Conservative online conformal intervals**: evaluate coverage
   changes and interval width, emphasizing nonexchangeability.
6. **Consent-based real-race evaluation**: use actual Race-labeled
   records, strict earlier-date features, anonymized subject grouping,
   chronological and athlete-disjoint holdouts, and independent audit.
7. **User-facing prediction**: only consider enabling an adaptive
   prediction feature when it outperforms strong baselines on genuinely
   held-out races and has honest uncertainty/limitations.

## Research quality gates

A convincing ML research contribution needs more than more code. The
theoretical question, mechanism of change, metric, test protocol and
conditions under which adaptation fails must all be clear.

The eventual paper or poster should report negative results and
stress tests, not just the best-performing example. Avoid leakage,
data dredging, and turning generated coefficients into biological
explanations.

Related guides:
[Race ML methodology](ml-methodology.md) ·
[Research data governance](race-data-governance.md) ·
[System architecture](architecture.md) ·
[Production beta checklist](production-beta-checklist.md).
