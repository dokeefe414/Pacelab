import json
import logging

from app.security_controls import safe_route


def test_health_and_readiness(client):
    assert client.get("/api/health").json()["status"]=="ok"
    response=client.get("/api/ready")
    assert response.status_code==200
    assert response.json()["database"]=="ok"
    assert len(response.headers["x-request-id"])==32
    assert response.headers["cache-control"]=="private, no-store"


def test_structured_logs_do_not_contain_query_or_auth(client,caplog):
    with caplog.at_level(logging.INFO,logger="pacelab.requests"):
        client.get("/api/health?email=secret@example.com",
                   headers={"Authorization":"Bearer private-token"})
    records=[json.loads(record.message) for record in caplog.records if record.name=="pacelab.requests"]
    assert records
    last=records[-1]
    assert last["path"]=="/api/health"
    assert last["method"]=="GET"
    assert last["status"]==200
    assert "private-token" not in str(last)
    assert "secret@example.com" not in str(last)


def test_scrub_workout_identifier():
    assert safe_route("/api/workouts/123e4567-e89b-12d3-a456-426614174000")=="/api/workouts/:id"



def test_database_readiness_fails_without_migrated_tables(client,tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.db import get_db
    from app.main import app
    engine=create_engine("sqlite:///"+str(tmp_path/"unmigrated.sqlite"))
    def empty_db():
        with Session(engine) as session:
            yield session
    app.dependency_overrides[get_db]=empty_db
    try:
        response=client.get("/api/ready")
        assert response.status_code==503
        assert response.json()["detail"]=="Database unavailable"
    finally:
        app.dependency_overrides.pop(get_db,None)
        engine.dispose()
