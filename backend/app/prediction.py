"""Mathematical race baseline and optional externally trained ML artifact."""
import os
from functools import lru_cache
from pathlib import Path
from fastapi import APIRouter, HTTPException

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
    return {"estimatedSeconds": round(estimate, 2), "lowerSeconds": round(max(0, estimate - radius), 2), "upperSeconds": round(estimate + radius, 2), "method": "random_forest", "experimental": True, "trainedOnSyntheticData": bool(bundle.get("demo", False)), "validation": bundle.get("validation", {}), "warning": "Research-only estimate; reliability depends on quality and coverage of training data."}
