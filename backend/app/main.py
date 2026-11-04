"""PaceLab REST API: token-based accounts and per-user workout storage."""
import os

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import get_db
from .dependencies import current_user
from .models import User, Workout
from .prediction import router as prediction_router
from .schemas import AuthResponse, LoginRequest, PublicUser, RegisterRequest, WorkoutPayload, WorkoutResponse
from .security import create_access_token, password_hash, verify_password

app = FastAPI(title="PaceLab API", version="0.2.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
origins = [x.strip() for x in os.getenv("PACELAB_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.include_router(prediction_router)


def workout_response(workout: Workout) -> WorkoutResponse:
    return WorkoutResponse(id=workout.id, date=workout.date, type=workout.type, distanceMiles=workout.distance_miles, durationSeconds=workout.duration_seconds, notes=workout.notes)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pacelab-api"}


@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    user = User(email=str(data.email), password_hash=password_hash(data.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Email is already registered") from exc
    db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=PublicUser(id=user.id, email=user.email))


@app.post("/api/auth/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == str(data.email)))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return AuthResponse(access_token=create_access_token(user.id), user=PublicUser(id=user.id, email=user.email))


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
    workout = Workout(user_id=user.id, date=payload.date, type=payload.type, distance_miles=payload.distanceMiles, duration_seconds=payload.durationSeconds, notes=payload.notes)
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
    db.commit()
    db.refresh(workout)
    return workout_response(workout)


@app.delete("/api/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(workout_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    workout = owned_workout(db, workout_id, user.id)
    db.delete(workout)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
