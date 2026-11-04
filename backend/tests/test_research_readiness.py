"""Private race-readiness stats and optional group-disjoint backtesting."""
import csv
from datetime import date,timedelta

from ml.athlete_groups import athlete_disjoint_evaluation


def register(client,email):
    res=client.post("/api/auth/register",json={
        "email":email,"password":"really-strong-password-1234",
    })
    assert res.status_code==201,res.text
    return {"Authorization":"Bearer "+res.json()["access_token"]}


def test_race_readiness_is_owner_scoped_and_honest(client):
    a=register(client,"race-ready-a@example.com")
    b=register(client,"race-ready-b@example.com")
    assert client.get("/api/exports/race-readiness").status_code==401
    client.post("/api/workouts",headers=a,json={
        "date":"2026-11-03","type":"Race","distanceMiles":3.10686,
        "durationSeconds":1220,"notes":"Only a race, no preceding training",
    })
    data=client.get("/api/exports/race-readiness",headers=a)
    assert data.status_code==200
    assert data.json()["totalLoggedRaces"]==1
    assert data.json()["eligibleLabeledRows"]==0
    assert not data.json()["canStartExperimentalTraining"]
    assert data.json()["additionalRowsNeeded"]==60
    other=client.get("/api/exports/race-readiness",headers=b).json()
    assert other["totalLoggedRaces"]==0


def synthetic_rows(path,include_ids=True):
    columns=["date","event_meters","weekly_miles_4w",
             "average_easy_pace_seconds_per_mile","hard_sessions_4w",
             "longest_run_miles","finish_seconds"]
    if include_ids:columns.append("athlete_id")
    with path.open("w",newline="") as stream:
        writer=csv.DictWriter(stream,fieldnames=columns)
        writer.writeheader()
        for i in range(64):
            row={
                "date":str(date(2025,1,1)+timedelta(days=i)),
                "event_meters":5000 if i%2 else 8000,
                "weekly_miles_4w":35+i*.15,
                "average_easy_pace_seconds_per_mile":470-i*.12,
                "hard_sessions_4w":3+i%3,
                "longest_run_miles":9+i%5,
                "finish_seconds":1200+i*3,
            }
            if include_ids:row["athlete_id"]="fictional-athlete-"+str(i%4)
            writer.writerow(row)


def test_optional_athlete_disjoint_results_omit_private_ids(tmp_path):
    source=tmp_path/"synthetic-not-real.csv"
    synthetic_rows(source)
    result=athlete_disjoint_evaluation(source)
    assert result["status"]=="evaluated"
    assert result["athleteCount"]==4
    assert result["models"]["ridge"]["n"]==64
    assert "fictional-athlete" not in str(result)


def test_no_athlete_id_is_explicitly_not_evaluated(tmp_path):
    source=tmp_path/"synthetic-no-athlete.csv"
    synthetic_rows(source,include_ids=False)
    result=athlete_disjoint_evaluation(source)
    assert result["status"]=="not_applicable"
