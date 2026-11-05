"""Managed PostgreSQL URL conversion and source-of-truth configuration."""
from app.db import database_url


def test_render_postgres_url_normalized_to_installed_psycopg_driver(monkeypatch):
    monkeypatch.setenv("PACELAB_DATABASE_URL", "postgres://user:secret@private-db:5432/pacelab")
    assert database_url() == "postgresql+psycopg://user:secret@private-db:5432/pacelab"
    monkeypatch.setenv("PACELAB_DATABASE_URL", "postgresql://user:secret@private-db/pacelab")
    assert database_url() == "postgresql+psycopg://user:secret@private-db/pacelab"
    monkeypatch.setenv("PACELAB_DATABASE_URL", "postgresql+psycopg://user:secret@private-db/pacelab")
    assert database_url() == "postgresql+psycopg://user:secret@private-db/pacelab"


def test_sqlite_dev_url_untouched(monkeypatch):
    monkeypatch.setenv("PACELAB_DATABASE_URL", "sqlite:///./pacelab-dev.db")
    assert database_url() == "sqlite:///./pacelab-dev.db"
