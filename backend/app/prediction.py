"""Mathematical race baseline and optional externally trained ML artifact."""
import os
from functools import lru_cache
from pathlib import Path
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from .analytics import summarize_training
from .db import get_db
from .dependencies import current_user
from .models import User, Workout

from .schemas import RaceFeatures, RiegelRequest

router = APIRouter(prefix="/api/predict", tags=["predictions"])


@router.post("/riegel")
def riegel_prediction(data: RiegelRequest):
    estimate = data.referenceSeconds * (data.targetMeters / data.referenceMeters) ** data.exponent
    return {"estimatedSeconds": round(estimate, 2), "method": "riegel", "experimental": False, "message": "Race equivalence, not a personalized forecast."}


@lru_cache(maxsize=2)
def load_model(path: str):
    # joblib uses pickle; only trusted locally produced artifacts may be loaded.
    import joblib
    return joblib.load(path)


@router.post("/ml")
def machine_learning_prediction(features: RaceFeatures):
    path = os.getenv("PACELAB_MODEL_PATH")
    if not path or not Path(path).is_file():
        raise HTTPException(503, "No validated model artifact has been configured")
    try:
        bundle = load_model(path)
    except (ImportError, OSError, ValueError, KeyError) as exc:
        raise HTTPException(503, "Model artifact is unavailable") from exc
    if not isinstance(bundle, dict) or "model" not in bundle or "interval_half_width_seconds" not in bundle:
        raise HTTPException(503, "Model artifact is not compatible")
    if bundle.get("demo") and os.getenv("PACELAB_ENV", "development").lower() == "production":
        raise HTTPException(503, "Synthetic demonstration models cannot be served in production")
    row = [[features.eventMeters, features.weeklyMiles4w, features.averageEasyPaceSecondsPerMile, features.hardSessions4w, features.longestRunMiles]]
    estimate = float(bundle["model"].predict(row)[0])
    radius = float(bundle["interval_half_width_seconds"])
    return {"estimatedSeconds": round(estimate, 2), "lowerSeconds": round(max(0, estimate - radius), 2), "upperSeconds": round(estimate + radius, 2), "method": bundle.get("method", "unknown"), "experimental": True, "trainedOnSyntheticData": bool(bundle.get("demo", False)), "validation": bundle.get("validation", {}), "warning": "Research-only estimate; reliability depends on quality and coverage of training data."}


@router.get("/history")
def recorded_race_prediction(
    targetMeters: float = Query(ge=800, le=10000),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Conservative personalized formula baseline from recent logged race efforts."""
    after = date.today() - timedelta(days=365)
    races = db.scalars(select(Workout).where(
        Workout.user_id == user.id, Workout.type == "Race",
        Workout.date >= after, Workout.date <= date.today(),
    )).all()
    supported = [w for w in races if 800 <= w.distance_miles * 1609.344 <= 10000]
    if not supported:
        raise HTTPException(404, "No qualifying Race workouts in the past year")
    # Use the freshest race effort; avoid cherry-picking a faster historical race
    # as if it represented today's actual fitness.
    recent = max(supported, key=lambda w: (w.date, w.created_at))
    reference_meters = recent.distance_miles * 1609.344
    estimate = recent.duration_seconds * (targetMeters/reference_meters)**1.06
    return {
        "estimatedSeconds": round(estimate, 2),
        "targetMeters": targetMeters, "method": "recent-race-riegel-baseline",
        "reference": {"date": recent.date.isoformat(), "distanceMeters": round(reference_meters, 1), "seconds": recent.duration_seconds},
        "raceCount": len(supported),
        "experimental": True,
        "warning": "Formula extrapolation from your most recent recorded race, not a trained or validated personal ML forecast.",
    }


@router.get("/features")
def derived_race_features(
    eventMeters: float = Query(ge=800, le=10000),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    records = db.scalars(select(Workout).where(Workout.user_id == user.id)).all()
    facts = summarize_training(records)
    recent = facts["last28"]
    pace = recent["easyPaceSecondsPerMile"]
    return {
        "features": {
            "eventMeters": eventMeters,
            "weeklyMiles4w": round(recent["miles"]/4, 2),
            "averageEasyPaceSecondsPerMile": pace,
            "hardSessions4w": recent["hardSessions"],
            "longestRunMiles": recent["longestRunMiles"],
        },
        "complete": bool(recent["activities"] and pace is not None),
        "activityCount": recent["activities"],
        "warning": "Computed from the 28 days of logged training before today. Missing workouts and future-date leakage must be handled before model evaluation.",
    }
