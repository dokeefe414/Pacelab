"""Shared account-scoped persistence for individual and ZIP imported activities."""
from datetime import timezone
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import User, Workout
from .schemas import WorkoutResponse


def _public(workout):
    return WorkoutResponse(
        id=workout.id, date=workout.date, type=workout.type,
        distanceMiles=workout.distance_miles, durationSeconds=workout.duration_seconds,
        notes=workout.notes, source=workout.source, startTime=workout.start_time,
        avgHeartRate=workout.avg_heart_rate, elevationGainMeters=workout.elevation_gain_meters,
        elapsedSeconds=workout.elapsed_seconds, elevationLossMeters=workout.elevation_loss_meters,
        maxHeartRate=workout.max_heart_rate, avgCadenceSpm=workout.avg_cadence_spm,
        avgPowerWatts=workout.avg_power_watts,
    )


def persist_activity(activity, user: User, db: Session):
    existing=db.scalar(select(Workout).where(
        Workout.user_id==user.id,Workout.source_hash==activity["sourceHash"]
    ))
    if existing:
        return {"imported":False,"reason":"same-file-hash","workout":_public(existing)}
    candidates=db.scalars(select(Workout).where(
        Workout.user_id==user.id,Workout.date==activity["date"],
        Workout.start_time.is_not(None),
    )).all()
    for previous in candidates:
        start=previous.start_time
        if start.tzinfo is None:
            start=start.replace(tzinfo=timezone.utc)
        if (abs((start-activity["startTime"]).total_seconds())<=60
            and abs(previous.distance_miles-activity["distanceMiles"])<=.08
            and abs(previous.duration_seconds-activity["durationSeconds"])<=45):
            return {"imported":False,"reason":"matching-activity","workout":_public(previous)}
    workout=Workout(
        user_id=user.id,date=activity["date"],start_time=activity["startTime"],
        type=activity["type"],distance_miles=activity["distanceMiles"],
        duration_seconds=activity["durationSeconds"],notes=activity["notes"],
        source=activity["source"],source_hash=activity["sourceHash"],
        avg_heart_rate=activity["avgHeartRate"],
        elevation_gain_meters=activity["elevationGainMeters"],
        elevation_loss_meters=activity["elevationLossMeters"],
        elapsed_seconds=activity["elapsedSeconds"],
        max_heart_rate=activity["maxHeartRate"],
        avg_cadence_spm=activity["avgCadenceSpm"],
        avg_power_watts=activity["avgPowerWatts"],
        laps_json=activity["laps"],track_json=activity["track"],
    )
    db.add(workout)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        collision=db.scalar(select(Workout).where(
            Workout.user_id==user.id,Workout.source_hash==activity["sourceHash"]
        ))
        if collision:
            return {"imported":False,"reason":"same-file-hash","workout":_public(collision)}
        raise HTTPException(409,"Unable to import activity due to a data conflict") from exc
    db.refresh(workout)
    return {"imported":True,"workout":_public(workout)}
