"""PaceLab REST API: token-based accounts and per-user workout storage."""
import os

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, update, text as sql_text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .activity_import import ActivityParseError, MAX_FILE_BYTES, parse_activity
from .import_service import persist_activity
from .bulk_import import router as bulk_router
from .analytics import summarize_training
from .assistant import router as assistant_router
from .account import router as account_router
from .security_controls import security_middleware
from .insights import router as insights_router
from .training_export import router as training_export_router
from .db import get_db
from .dependencies import current_user
from .models import User, Workout
from .prediction import router as prediction_router
from .schemas import AuthResponse, LoginRequest, PublicUser, RegisterRequest, WorkoutPayload, WorkoutResponse, WorkoutDetailResponse
from .security import create_access_token, password_hash, verify_password

app = FastAPI(title="PaceLab API", version="0.9.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
origins = [x.strip() for x in os.getenv("PACELAB_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.middleware("http")(security_middleware)
app.include_router(account_router)
app.include_router(bulk_router)
app.include_router(prediction_router)
app.include_router(assistant_router)
app.include_router(insights_router)
app.include_router(training_export_router)


def workout_response(workout: Workout) -> WorkoutResponse:
    return WorkoutResponse(id=workout.id, date=workout.date, type=workout.type, distanceMiles=workout.distance_miles, durationSeconds=workout.duration_seconds, notes=workout.notes, raceResult=workout.race_result, source=workout.source, startTime=workout.start_time, avgHeartRate=workout.avg_heart_rate, elevationGainMeters=workout.elevation_gain_meters, elevationLossMeters=workout.elevation_loss_meters, elapsedSeconds=workout.elapsed_seconds, maxHeartRate=workout.max_heart_rate, avgCadenceSpm=workout.avg_cadence_spm, avgPowerWatts=workout.avg_power_watts)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pacelab-api"}


@app.get("/api/ready")
def readiness(db: Session = Depends(get_db)):
    """Use actual DB query to ensure migrations and connectivity are healthy."""
    try:
        # A live connection without migrated tables is NOT readiness.
        db.execute(sql_text("SELECT 1 FROM users LIMIT 1"))
        db.execute(sql_text("SELECT 1 FROM workouts LIMIT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ready", "database": "ok"}


@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if os.getenv('PACELAB_ENV', 'development').lower() == 'production' and os.getenv('PACELAB_PUBLIC_SIGNUP', 'false').lower() != 'true':
        raise HTTPException(403, 'Public registration is disabled; contact the server operator')
    user = User(email=str(data.email), password_hash=password_hash(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Email is already registered") from exc
    db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id, user.token_version), user=PublicUser(id=user.id, email=user.email))


@app.post("/api/auth/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email)))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return AuthResponse(access_token=create_access_token(user.id, user.token_version), user=PublicUser(id=user.id, email=user.email))


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def revoke_all_tokens(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Revokes every token issued before this sign-out, across all devices."""
    db.execute(update(User).where(User.id == user.id).values(token_version=User.token_version + 1))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/auth/me", response_model=PublicUser)
def me(user: User = Depends(current_user)):
    return PublicUser(id=user.id, email=user.email)


@app.get("/api/workouts", response_model=list[WorkoutResponse])
def list_workouts(
    limit: int = Query(default=250, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    workouts = db.scalars(
        select(Workout).where(Workout.user_id == user.id).order_by(Workout.date.desc(), Workout.created_at.desc(), Workout.id.desc()).limit(limit).offset(offset)
    ).all()
    return [workout_response(row) for row in workouts]


@app.post("/api/workouts", response_model=WorkoutResponse, status_code=status.HTTP_201_CREATED)
def create_workout(payload: WorkoutPayload, user: User = Depends(current_user), db: Session = Depends(get_db)):
    workout = Workout(user_id=user.id, date=payload.date, type=payload.type, distance_miles=payload.distanceMiles, duration_seconds=payload.durationSeconds, notes=payload.notes, race_result=payload.raceResult.model_dump() if payload.raceResult else None)
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout_response(workout)


def owned_workout(db: Session, workout_id: str, user_id: str) -> Workout:
    workout = db.get(Workout, workout_id)
    if workout is None or workout.user_id != user_id:
        raise HTTPException(404, "Workout not found")
    return workout


@app.put("/api/workouts/{workout_id}", response_model=WorkoutResponse)
def update_workout(workout_id: str, payload: WorkoutPayload, user: User = Depends(current_user), db: Session = Depends(get_db)):
    workout = owned_workout(db, workout_id, user.id)
    workout.date = payload.date
    workout.type = payload.type
    workout.distance_miles = payload.distanceMiles
    workout.duration_seconds = payload.durationSeconds
    workout.notes = payload.notes
    if "raceResult" in payload.model_fields_set:
        workout.race_result = payload.raceResult.model_dump() if payload.raceResult else None
    db.commit()
    db.refresh(workout)
    return workout_response(workout)


@app.delete("/api/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(workout_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    workout = owned_workout(db, workout_id, user.id)
    db.delete(workout)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/workouts/{workout_id}", response_model=WorkoutDetailResponse)
def workout_details(workout_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    workout = owned_workout(db, workout_id, user.id)
    return WorkoutDetailResponse(
        **workout_response(workout).model_dump(),
        laps=workout.laps_json or [], track=workout.track_json or [],
    )


@app.post("/api/activities/import")
async def upload_activity(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Parse at most 10 MiB in memory, discard original bytes, store private samples."""
    filename = file.filename or ""
    try:
        contents = await file.read(MAX_FILE_BYTES + 1)
        activity = parse_activity(filename, contents)
    except ActivityParseError as exc:
        raise HTTPException(422, str(exc)) from exc
    finally:
        await file.close()

    return persist_activity(activity, user, db)
