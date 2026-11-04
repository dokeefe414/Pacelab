"""Training insights API, bounded to the authenticated runner."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .analytics import summarize_training
from .db import get_db
from .dependencies import current_user
from .models import User, Workout

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("/summary")
def insights_summary(user: User = Depends(current_user), db: Session = Depends(get_db)):
    workouts = db.scalars(select(Workout).where(Workout.user_id == user.id)).all()
    return summarize_training(workouts)
