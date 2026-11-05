"""Pure reliability tests; all race values are synthetic code fixtures."""
from datetime import date
from ml.reliability import interval_coverage_report, feature_drift, event_error_support
import pytest


def row(day, event, pace, time):
    return (date(2026,10,day),[event,30.,pace,3.,10.],time)


def test_coverage_reports_uncertainty_not_fake_accuracy():
    data=interval_coverage_report([100,200,300,400],[99,204,299,360],5)
    assert data["covered"]==3
    assert data["observed_coverage"]==.75
    assert data["wilson_95_lower"]<.75<data["wilson_95_upper"]
    assert data["wilson_95_upper"]<=1
    assert interval_coverage_report([100],[100],0)["observed_coverage"]==1
    with pytest.raises(ValueError):interval_coverage_report([100],[99,101],5)


def test_feature_drift_is_measurement_not_model_selection():
    train=[row(1,5000,510,1200),row(2,5000,490,1190)]
    later=[row(3,5000,480,1180),row(4,5000,550,1300)]
    report=feature_drift(train,later,["event","miles","easy_pace","hard","longest"])
    assert report["features"]["easy_pace"]["test_outside_training_range"]==2
    assert report["features"]["event"]["test_outside_training_range"]==0
    assert "must never" in report["warning"]
    with pytest.raises(ValueError):feature_drift(train,later,["event"])


def test_event_reporting_requires_enough_outcomes():
    test=[row(i+1,5000,490,1200) for i in range(3)]+[row(i+4,8000,490,1800) for i in range(5)]
    pred=[1201]*3+[1801]*5
    report=event_error_support(test,pred,min_support=5)
    assert report["5000"]["mae_seconds"] is None
    assert report["5000"]["status"]=="insufficient_held_out_examples"
    assert report["8000"]["mae_seconds"]==1
    assert report["8000"]["status"]=="descriptive_only"
