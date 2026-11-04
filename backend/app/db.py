"""SQLAlchemy connection configuration. Schema changes are applied with Alembic."""
import os
from collections.abc import Iterator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def database_url() -> str:
    return os.getenv("PACELAB_DATABASE_URL", "sqlite:///./pacelab-dev.db")


def make_engine(url: str | None = None):
    url = url or database_url()
    options = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, connect_args=options)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
