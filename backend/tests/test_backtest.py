from datetime import date,timedelta
from ml.evaluate import grouped_dates,chronological_backtest,predict_riegel_from_training


def rows():
    dates=[date(2025,1,1)+timedelta(days=i) for i in range(65)]
    result=[]
    for i,d in enumerate(dates):
        result.append((d,[5000 if i%2 else 8000,40+i*.15,460-i*.22,4,11],1200+i*.25+250*(i%2)))
        if i==18:  # Group two races on one date
            result.append((d,[5000,42,465,3,12],1300))
    return sorted(result,key=lambda row:row[0])


def test_grouped_dates_never_cross_partition():
    t,v,e=grouped_dates(rows())
    assert max(x[0] for x in t)<min(x[0] for x in v)
    assert max(x[0] for x in v)<min(x[0] for x in e)
    assert len(t)+len(v)+len(e)==len(rows())


def test_rolling_folds_and_riegel_use_previous_date_only():
    output=chronological_backtest(rows())
    assert len(output["folds"])==4
    assert "ridge" in output["models"]
    assert "random_forest" in output["models"]
    assert "hist_gradient_boosting" in output["models"]
    assert "small_neural_net" in output["models"]
    assert "median_baseline" in output["models"]
    assert "riegel_last_known_race" in output["models"]
    assert all(f["train_end"]<f["test_start"] for f in output["folds"])
    day=date(2025,1,5)
    known=[(day,[5000,40,480,4,12],1200)]
    target=[(day,[8000,40,480,4,12],2000),
            (day+timedelta(days=1),[8000,40,480,4,12],2000)]
    assert predict_riegel_from_training(known,target)[0] is None
    assert predict_riegel_from_training(known,target)[1]>1200
