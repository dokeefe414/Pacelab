"""Chronological rolling-origin evaluation for labeled race records.

Each fold trains ONLY on strictly earlier calendar dates. Multiple races on
the same date stay in one fold, not across train/test boundaries.
The reference race-equivalence comparator uses the last training-period
result only, NOT future outcomes.

This is exploratory research. Different athletes and distribution shift
require independent out-of-athlete prospective evaluation before claims.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from math import ceil, sqrt
from statistics import mean, median

from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def grouped_dates(rows, train_fraction=.70, val_fraction=.15):
    dates=sorted({row[0] for row in rows})
    if len(dates)<12:
        raise ValueError("Need at least 12 different race dates for leakage-safe chronological splits")
    first=max(1,int(len(dates)*train_fraction))
    second=max(first+1,int(len(dates)*(train_fraction+val_fraction)))
    if second>=len(dates):
        second=len(dates)-1
    boundaries=(dates[first],dates[second])
    train=[row for row in rows if row[0]<boundaries[0]]
    validation=[row for row in rows if boundaries[0]<=row[0]<boundaries[1]]
    test=[row for row in rows if row[0]>=boundaries[1]]
    if not train or not validation or not test:
        raise ValueError("Chronological split produced an empty partition")
    return train,validation,test


def model_candidates():
    return {
        "median_baseline": DummyRegressor(strategy="median"),
        "ridge": make_pipeline(StandardScaler(),Ridge(alpha=20.0)),
        "random_forest": RandomForestRegressor(n_estimators=140,min_samples_leaf=3,random_state=42,n_jobs=1),
        "hist_gradient_boosting": HistGradientBoostingRegressor(max_iter=90,max_leaf_nodes=7,
            min_samples_leaf=5,l2_regularization=12.0,learning_rate=.045,random_state=42),
        "small_neural_net": make_pipeline(StandardScaler(),
            MLPRegressor(hidden_layer_sizes=(16,),activation="relu",solver="lbfgs",
                         alpha=12.0,max_iter=250,random_state=42)),
    }


def predict_riegel_from_training(train_rows,target_rows):
    """Uses only race finishes strictly earlier than the prediction date."""
    known=sorted(train_rows,key=lambda row:row[0])
    predictions=[]
    for row in target_rows:
        older=[reference for reference in known if reference[0]<row[0]]
        if not older:
            predictions.append(None)
            continue
        reference=older[-1]
        seconds=reference[2]
        from_meters=reference[1][0]
        to_meters=row[1][0]
        predictions.append(seconds*(to_meters/from_meters)**1.06)
    return predictions


def numerical_metrics(actual,predictions):
    if len(actual)!=len(predictions) or not actual:
        raise ValueError("Evaluation needs matching nonempty prediction series")
    errors=[abs(y-p) for y,p in zip(actual,predictions)]
    return {
        "n":len(actual),
        "mae_seconds":round(mean(errors),3),
        "rmse_seconds":round(sqrt(mean((y-p)**2 for y,p in zip(actual,predictions))),3),
        "median_absolute_error_seconds":round(median(errors),3),
    }


def _xy(rows):
    return [r[1] for r in rows],[r[2] for r in rows]


def compare_models(train,val):
    x_train,y_train=_xy(train)
    x_val,y_val=_xy(val)
    predictions={}
    fitted={}
    for name,model in model_candidates().items():
        model.fit(x_train,y_train)
        predictions[name]=list(map(float,model.predict(x_val)))
        fitted[name]=model
    return fitted,{name:numerical_metrics(y_val,pred) for name,pred in predictions.items()}


def chronological_backtest(rows,n_folds=4):
    """Expanding windows over distinct date groups, no same-day leakage."""
    dates=sorted({row[0] for row in rows})
    if len(dates)<max(12,2*(n_folds+1)):
        raise ValueError("Insufficient distinct race dates for rolling validation")
    n_folds=min(n_folds,max(2,len(dates)//8))
    # First history includes at least ~1/(folds+1) of calendar dates.
    fold_size=max(1,len(dates)//(n_folds+1))
    series=defaultdict(lambda:{"actual":[],"predicted":[]})
    diagnostics=[]
    for i in range(n_folds):
        end=min(len(dates),fold_size*(i+2))
        start=fold_size*(i+1)
        if start>=end:
            continue
        train=[r for r in rows if r[0]<dates[start]]
        val=[r for r in rows if dates[start]<=r[0]<=dates[end-1]]
        if not train or not val:
            continue
        models,_=compare_models(train,val)
        y=[r[2] for r in val]
        for name,model in models.items():
            preds=list(map(float,model.predict([r[1] for r in val])))
            series[name]["actual"].extend(y)
            series[name]["predicted"].extend(preds)
        refs=predict_riegel_from_training(train,val)
        for target,pred in zip(y,refs):
            if pred is not None:
                series["riegel_last_known_race"]["actual"].append(target)
                series["riegel_last_known_race"]["predicted"].append(pred)
        diagnostics.append({
            "train_end":str(max(r[0] for r in train)),
            "test_start":str(min(r[0] for r in val)),
            "test_end":str(max(r[0] for r in val)),
            "train_rows":len(train),"test_rows":len(val),
        })
    return {
        "folds":diagnostics,
        "models":{name:numerical_metrics(data["actual"],data["predicted"]) for name,data in series.items() if data["actual"]},
        "warning":"Expanding-window backtest, not a prospective or out-of-athlete validation. Do not compare methods using test to select a production winner.",
    }
