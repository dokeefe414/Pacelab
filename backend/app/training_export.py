"""Export race training rows with features drawn only from dates BEFORE each race."""
import csv
import io
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from .analytics import EVENTS
from .db import get_db
from .dependencies import current_user
from .models import User, Workout

router = APIRouter(prefix="/api/exports", tags=["exports"])
FIELDS = ["date","event_meters","weekly_miles_4w","average_easy_pace_seconds_per_mile","hard_sessions_4w","longest_run_miles","finish_seconds"]


def labeled_race_rows(workouts):
    data = sorted(workouts, key=lambda w:(w.date,w.created_at))
    output = []
    for race in data:
        if race.type != "Race" or race.date > date.today():
            continue
        distance = race.distance_miles * 1609.344
        matches = [d for d in EVENTS.values() if abs(d-distance)/d <= .025]
        if not matches:
            continue
        # Strictly prior calendar dates exclude same-day or future race leakage.
        begin = race.date - timedelta(days=28)
        training = [w for w in data if begin <= w.date < race.date and w.type != "Race"]
        easy = [w for w in training if w.type in {"Easy","Recovery"}]
        easy_miles = sum(w.distance_miles for w in easy)
        if len(training) < 5 or not easy_miles:
            continue
        output.append({
            "date": race.date.isoformat(), "event_meters": min(matches, key=lambda d:abs(d-distance)),
            "weekly_miles_4w": round(sum(w.distance_miles for w in training)/4, 3),
            "average_easy_pace_seconds_per_mile": round(sum(w.duration_seconds for w in easy)/easy_miles, 2),
            "hard_sessions_4w": sum(w.type in ("Tempo","Intervals") for w in training),
            "longest_run_miles": round(max((w.distance_miles for w in training),default=0), 3),
            "finish_seconds": race.duration_seconds,
        })
    return output


@router.get("/race-training.csv")
def export_race_training_csv(user:User=Depends(current_user), db:Session=Depends(get_db)):
    records = db.scalars(select(Workout).where(Workout.user_id == user.id)).all()
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=FIELDS)
    writer.writeheader()
    rows = labeled_race_rows(records)
    writer.writerows(rows)
    return Response(content=stream.getvalue(),media_type="text/csv",headers={
        "Content-Disposition": 'attachment; filename="pacelab-race-training.csv"',
        "Cache-Control": "private, no-store",
        "X-PaceLab-Valid-Race-Rows": str(len(rows)),
    })
