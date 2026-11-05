"""Synthetic-only tests for causal prequential distribution-shift research.

Fixtures are generated in CI, do not contain real athletes, and intentionally
test strict forecast-before-observation ordering.
"""
from copy import deepcopy
from math import isfinite

import pytest

from ml.shift_experiment import (
    PageHinkley, SCENARIOS, POLICIES,
    generate_synthetic_races, prequential_forecasts,
    run_benchmark, save_report,
)


def test_synthetic_generator_is_reproducible_and_paired_pre_shift():
    a=generate_synthetic_races(scenario="stationary",seed=11,n=120,shift_at=75)
    b=generate_synthetic_races(scenario="combined",seed=11,n=120,shift_at=75)
    copy=generate_synthetic_races(scenario="stationary",seed=11,n=120,shift_at=75)
    assert a==copy
    assert a[:75]==b[:75]  # identical random draws before intervention
    assert a[75:]!=b[75:]
    assert all(len(row[1])==5 and row[1][0]==5000 for row in a)
    assert all(row[2]>0 and isfinite(row[2]) for row in a)
    assert len({row[0] for row in a})==120
    zero=generate_synthetic_races(scenario="combined",seed=11,n=120,
                                 shift_at=75,strength=0)
    assert a==zero


def test_scenario_and_parameter_validation():
    with pytest.raises(ValueError,match="Unknown shift"):
        generate_synthetic_races(scenario="unknown",seed=1)
    with pytest.raises(ValueError,match="strength"):
        generate_synthetic_races(scenario="concept",seed=1,strength=float("nan"))
    with pytest.raises(ValueError,match="shift"):
        generate_synthetic_races(scenario="concept",seed=1,n=60,shift_at=58)


def test_page_hinkley_updates_only_with_seen_residuals():
    d=PageHinkley(slack=0.25,threshold=3)
    assert not d.observe(1.0)
    assert not d.observe(1.0)
    assert d.observe(3.0) is False
    assert d.observe(3.0) is True
    d.reset()
    assert not d.observe(1.0)
    with pytest.raises(ValueError):
        d.observe(-1)


def test_forecasts_use_only_strictly_earlier_labeled_data():
    data=generate_synthetic_races(scenario="concept",seed=3,n=116,shift_at=76)
    result=prequential_forecasts(data,initial_train=42,window=24,periodicity=9)
    assert set(result["strategies"])==set(POLICIES)
    for policy, series in result["strategies"].items():
        assert len(series)==len(data)-42,policy
        assert series[0]["index"]==42
        for item in series:
            assert item["training_end_index"]<item["index"]
    assert all(42<=t<len(data) for t in result["alarms"])
    # At time t=60, labels at t>=60 are unknown. Modify ALL future
    # outcomes (including t=60) and verify earlier predictions are identical.
    changed=deepcopy(data)
    for t in range(60,len(data)):
        day, features, seconds=changed[t]
        changed[t]=(day,features,seconds+400)
    altered=prequential_forecasts(changed,initial_train=42,window=24,periodicity=9)
    for policy in POLICIES:
        original=result["strategies"][policy]
        modified=altered["strategies"][policy]
        assert all(a["prediction"]==b["prediction"]
                   for a,b in zip(original,modified) if a["index"]<=60),policy
    # Even if time 60 triggers a detector, any model update affects t>=61.


def test_stale_and_duplicate_chronology_rejected():
    data=generate_synthetic_races(scenario="stationary",seed=2,n=90,shift_at=55)
    invalid=deepcopy(data)
    invalid[55]=(invalid[54][0],invalid[55][1],invalid[55][2])
    with pytest.raises(ValueError,match="strictly increasing"):
        prequential_forecasts(invalid,initial_train=40,window=24)


def test_benchmark_produces_only_tagged_synthetic_metrics(tmp_path):
    report=run_benchmark(seeds=(2,),scenarios=("stationary","concept"),
                         n=108,initial_train=40,shift_at=65,window=24)
    assert report["metadata"]["data_source"]=="controlled_synthetic_generator_only"
    assert report["metadata"]["research_status"]=="method_prototype_not_athlete_validated"
    assert len(report["summary"])==2*5*2
    assert len(report["replications"])==2
    assert len(report["paired_post_differences"])==2*4
    for comparison in report["paired_post_differences"]:
        assert comparison["n_seed_pairs"]==1
        assert comparison["seed_pairs"][0]["seed"]==2
        base=next(r for r in report["replications"]
                  if r["scenario"]==comparison["scenario"])
        observed=base["policies"][comparison["policy"]]["after_boundary"]["mae_seconds"]
        frozen=base["policies"]["frozen"]["after_boundary"]["mae_seconds"]
        assert abs(comparison["mean_paired_delta_mae_seconds"]-(observed-frozen))<0.002
    for record in report["summary"]:
        assert record["n"]>0
        assert record["mae_seconds"]>=0
        assert isfinite(record["rmse_seconds"])
    output=save_report(report,tmp_path)
    assert all(__import__("pathlib").Path(path).exists() for path in output)
    json_text=__import__("pathlib").Path(output[0]).read_text()
    assert '"data_source": "controlled_synthetic_generator_only"' in json_text
    assert "gps" not in json_text.lower()


def test_prepost_boundary_must_have_evaluation_support():
    with pytest.raises(ValueError,match="pre/post"):
        run_benchmark(seeds=(1,),scenarios=("concept",),n=90,
                      initial_train=40,shift_at=45,window=24)
    with pytest.raises(ValueError,match="unique"):
        run_benchmark(seeds=(1,1),scenarios=("concept",),n=100,
                      initial_train=40,shift_at=65,window=24)
