"""Authenticated self-service data export and permanent account deletion."""
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .db import get_db
from .dependencies import current_user
from .models import User, Workout
from .security import verify_password, password_hash
from .schemas import PasswordChangeRequest

router = APIRouter(prefix="/api/account", tags=["account"])


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    confirm: str = Field(pattern="^DELETE MY ACCOUNT$")


def serialize_activity(workout: Workout):
    return {
        "id": workout.id,
        "date": workout.date.isoformat(), "type": workout.type,
        "distanceMiles": workout.distance_miles, "durationSeconds": workout.duration_seconds,
        "notes": workout.notes, "raceResult": workout.race_result,
        "startTime": workout.start_time.isoformat() if workout.start_time else None,
        "source": workout.source, "avgHeartRate": workout.avg_heart_rate,
        "elevationGainMeters": workout.elevation_gain_meters,
        "elevationLossMeters": workout.elevation_loss_meters,
        "elapsedSeconds": workout.elapsed_seconds, "maxHeartRate": workout.max_heart_rate,
        "avgCadenceSpm": workout.avg_cadence_spm, "avgPowerWatts": workout.avg_power_watts,
        "laps": workout.laps_json or [], "track": workout.track_json or [],
    }


@router.get("/export")
def export_account_data(user: User = Depends(current_user), db: Session = Depends(get_db)):
    records = db.scalars(select(Workout).where(Workout.user_id == user.id).order_by(Workout.date)).all()
    payload = {"format": "pacelab-account-export-v1", "email": user.email,
               "workouts": [serialize_activity(w) for w in records]}
    stream = io.BytesIO(json.dumps(payload,ensure_ascii=False,separators=(",",":")).encode("utf-8"))
    return StreamingResponse(stream, media_type="application/json",headers={
        "Content-Disposition": 'attachment; filename="pacelab-private-export.json"',
        "Cache-Control": "private, no-store",
    })


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(payload: DeleteAccountRequest, user: User = Depends(current_user),
                   db: Session = Depends(get_db)):
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(403, "Incorrect password")
    db.delete(user)  # ORM cascade deletes all account-owned workouts, laps and tracks.
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)



@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(payload: PasswordChangeRequest, user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    """Change password and invalidate every existing device's access token."""
    if not verify_password(payload.currentPassword, user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    if payload.currentPassword == payload.newPassword:
        raise HTTPException(422, "New password must differ from the current password")
    hashed = password_hash(payload.newPassword)
    db.execute(update(User).where(User.id == user.id).values(
        password_hash=hashed, token_version=User.token_version + 1,
    ))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
