"""Race model reliability diagnostics, separate from model selection.

Never use held-out test diagnostics to retune the selected model. These
reports are descriptive, small-sample-aware, and omit athlete identities.
"""
from __future__ import annotations

from math import sqrt, isfinite


def interval_coverage_report(actual, predicted, radius, confidence_z=1.96):
    """Report observed interval coverage AND its Wilson uncertainty bounds.

    The 95% Wilson interval describes uncertainty in measured coverage. It is
    not a 95% forecast interval and assumes independent trials, which repeated
    races from the same athlete may violate.
    """
    if not actual or len(actual) != len(predicted):
        raise ValueError("Need equal nonempty actual and predicted sequences")
    if not isfinite(radius) or radius < 0:
        raise ValueError("Interval radius must be finite and nonnegative")
    if not all(isfinite(float(x)) for x in [*actual, *predicted]):
        raise ValueError("Predictions and outcomes must be finite")
    n=len(actual)
    hits=sum(abs(y-p)<=radius for y,p in zip(actual,predicted))
    p=hits/n
    z2=confidence_z**2
    denom=1+z2/n
    center=(p+z2/(2*n))/denom
    margin=confidence_z*sqrt((p*(1-p)+z2/(4*n))/n)/denom
    return {
        "n":n, "covered":hits, "observed_coverage":round(p,4),
        "wilson_95_lower":round(max(0,center-margin),4),
        "wilson_95_upper":round(min(1,center+margin),4),
        "assumptions":"Wilson binomial approximation; repeated races may be correlated. Neither nominal 90% nor observed coverage guarantees future coverage.",
    }


def feature_drift(train_rows, test_rows, names):
    """Flag test feature values outside ranges seen in strictly earlier train.

    Inputs: (date, [features], seconds) from the offline ML pipeline.
    This uses the test cohort only for diagnostics, NOT model selection.
    """
    if not train_rows or not test_rows:
        raise ValueError("Both train and test rows are required")
    if not names or len(names)!=len(train_rows[0][1]):
        raise ValueError("Names must match feature dimensions")
    output={}
    for index,name in enumerate(names):
        earlier=[float(r[1][index]) for r in train_rows]
        future=[float(r[1][index]) for r in test_rows]
        if not all(isfinite(n) for n in [*earlier,*future]):
            raise ValueError("Feature values must be finite")
        low,high=min(earlier),max(earlier)
        outside=sum(v<low or v>high for v in future)
        output[name]={
            "training_min":round(low,3),
            "training_max":round(high,3),
            "test_outside_training_range":outside,
            "test_count":len(future),
            "outside_share":round(outside/len(future),3),
        }
    return {
        "features":output,
        "warning":"Range coverage is a diagnostic, not a validated distribution-shift detector. Model selection must never use held-out test diagnostics.",
    }


def event_error_support(test_rows, predictions, min_support=5):
    """Do not show unstable per-event MAE for tiny test cohorts."""
    if len(test_rows)!=len(predictions) or min_support<2:
        raise ValueError("Need aligned test data and minimum support of at least two")
    events=sorted({float(row[1][0]) for row in test_rows})
    report={}
    for event in events:
        indexes=[i for i,row in enumerate(test_rows) if float(row[1][0])==event]
        key=str(int(event))
        if len(indexes)<min_support:
            report[key]={
                "n":len(indexes),"mae_seconds":None,
                "status":"insufficient_held_out_examples"
            }
            continue
        errors=[abs(float(test_rows[i][2])-float(predictions[i])) for i in indexes]
        report[key]={
            "n":len(indexes),
            "mae_seconds":round(sum(errors)/len(errors),2),
            "status":"descriptive_only",
        }
    return report
