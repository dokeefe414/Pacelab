"""Validated public API payloads. Camel-case workout keys match the frontend."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


WorkoutType = Literal["Easy", "Long", "Tempo", "Intervals", "Race", "Recovery"]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return str(value).strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return str(value).strip().lower()


class PublicUser(BaseModel):
    id: str
    email: EmailStr


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: PublicUser


class WorkoutPayload(BaseModel):
    date: date
    type: WorkoutType = "Easy"
    distanceMiles: float = Field(gt=0, le=200, allow_inf_nan=False)
    durationSeconds: int = Field(gt=0, le=86400)
    notes: str = Field(default="", max_length=300)


class WorkoutResponse(WorkoutPayload):
    id: str
    source: str | None = None
    startTime: datetime | None = None
    avgHeartRate: int | None = None
    elevationGainMeters: float | None = None
    elevationLossMeters: float | None = None
    elapsedSeconds: int | None = None
    maxHeartRate: int | None = None
    avgCadenceSpm: float | None = None
    avgPowerWatts: float | None = None


class WorkoutDetailResponse(WorkoutResponse):
    laps: list[dict] = Field(default_factory=list)
    track: list[dict] = Field(default_factory=list)


class AssistantRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    allowExternalProcessing: bool = False


class EventRequest(BaseModel):
    targetMeters: float = Field(ge=800, le=10000, allow_inf_nan=False)


class RiegelRequest(BaseModel):
    referenceSeconds: float = Field(gt=0, le=86400, allow_inf_nan=False)
    referenceMeters: float = Field(gt=0, le=100000, allow_inf_nan=False)
    targetMeters: float = Field(gt=0, le=100000, allow_inf_nan=False)
    exponent: float = Field(default=1.06, ge=1, le=1.3, allow_inf_nan=False)


class RaceFeatures(BaseModel):
    eventMeters: float = Field(ge=800, le=10000, allow_inf_nan=False)
    weeklyMiles4w: float = Field(ge=0, le=200, allow_inf_nan=False)
    averageEasyPaceSecondsPerMile: float = Field(ge=180, le=1800, allow_inf_nan=False)
    hardSessions4w: float = Field(ge=0, le=28, allow_inf_nan=False)
    longestRunMiles: float = Field(ge=0, le=100, allow_inf_nan=False)



class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=12, max_length=128)
