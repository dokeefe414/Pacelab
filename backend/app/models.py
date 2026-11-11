"""Relational data models; each workout belongs to exactly one account."""
from datetime import date, datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    workouts: Mapped[list["Workout"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Workout(Base):
    __tablename__ = "workouts"
    __table_args__ = (
        Index("ux_workouts_user_source_hash", "user_id", "source_hash", unique=True),
        CheckConstraint("distance_miles > 0 AND distance_miles <= 200", name="ck_workouts_distance"),
        CheckConstraint("duration_seconds > 0 AND duration_seconds <= 86400", name="ck_workouts_duration"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="Easy")
    distance_miles: Mapped[float] = mapped_column(Float, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    race_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    source_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    avg_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    elevation_gain_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    elevation_loss_meters: Mapped[float | None] = mapped_column(Float, nullable=True)
    elapsed_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avg_cadence_spm: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_power_watts: Mapped[float | None] = mapped_column(Float, nullable=True)
    laps_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    track_json: Mapped[list | None] = mapped_column(JSON, nullable=True)
    user: Mapped[User] = relationship(back_populates="workouts")
