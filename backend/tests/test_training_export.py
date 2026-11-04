from datetime import date, timedelta
from types import SimpleNamespace
from app.training_export import labeled_race_rows


def workout(day, typ, miles, seconds, uid):
    return SimpleNamespace(date=day,type=typ,distance_miles=miles,duration_seconds=seconds,
                           created_at=day,id=uid)


def test_feature_rows_precede_race():
    race_day = date.today()
    sessions = [workout(race_day-timedelta(days=i+1),"Easy",5,2400,str(i)) for i in range(5)]
    sessions += [workout(race_day,"Tempo",100,1000,"same_day"),
                 workout(race_day,"Race",3.10686,1200,"race"),
                 workout(race_day+timedelta(days=1),"Easy",50,3000,"future")]
    rows = labeled_race_rows(sessions)
    assert len(rows)==1
    assert rows[0]["event_meters"]==5000
    assert rows[0]["weekly_miles_4w"]==6.25
    assert rows[0]["hard_sessions_4w"]==0
    assert rows[0]["average_easy_pace_seconds_per_mile"]==480
    assert rows[0]["finish_seconds"]==1200


def test_few_sessions_not_exported():
    d=date.today()
    assert labeled_race_rows([workout(d,"Race",3.10686,1200,"r")])==[]
