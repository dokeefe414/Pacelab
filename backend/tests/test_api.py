def register(client, email="runner@example.com"):
    response = client.post("/api/auth/register", json={"email": email, "password": "very-strong-password-123"})
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def payload(distance=5):
    return {"date": "2026-11-03", "type": "Easy", "distanceMiles": distance, "durationSeconds": 2400, "notes": "Good aerobic run"}


def test_health_and_docs(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/openapi.json").status_code == 200


def test_auth_register_login_me(client):
    auth = register(client, "Runner@Example.Com")
    assert client.get("/api/auth/me", headers=auth).json()["email"] == "runner@example.com"
    assert client.post("/api/auth/register", json={"email": "RUNNER@example.com", "password": "very-strong-password-123"}).status_code == 409
    login = client.post("/api/auth/login", json={"email": "RUNNER@EXAMPLE.COM", "password": "very-strong-password-123"})
    assert login.status_code == 200
    assert client.post("/api/auth/login", json={"email": "runner@example.com", "password": "incorrect"}).status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer broken.token"}).status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/register", json={"email": "x@e.com", "password": "short"}).status_code == 422


def test_crud_and_isolation(client):
    a = register(client, "a@example.com")
    b = register(client, "b@example.com")
    assert client.get("/api/workouts").status_code == 401
    first = client.post("/api/workouts", headers=a, json=payload())
    assert first.status_code == 201, first.text
    wid = first.json()["id"]
    assert client.get("/api/workouts", headers=b).json() == []
    assert client.put("/api/workouts/" + wid, headers=b, json=payload(7)).status_code == 404
    assert client.delete("/api/workouts/" + wid, headers=b).status_code == 404
    assert client.get("/api/workouts", headers=a).json()[0]["distanceMiles"] == 5
    edit = client.put("/api/workouts/" + wid, headers=a, json=payload(7))
    assert edit.status_code == 200 and edit.json()["distanceMiles"] == 7
    assert client.post("/api/workouts", headers=a, json=payload(0)).status_code == 422
    assert client.get("/api/workouts?limit=1&offset=0", headers=a).status_code == 200
    assert client.get("/api/workouts?limit=1000", headers=a).status_code == 422
    assert client.delete("/api/workouts/" + wid, headers=a).status_code == 204
    assert client.get("/api/workouts", headers=a).json() == []


def test_riegel_and_model_unavailable(client, monkeypatch):
    result = client.post("/api/predict/riegel", json={"referenceSeconds":1200, "referenceMeters":5000, "targetMeters":5000})
    assert result.status_code == 200 and result.json()["estimatedSeconds"] == 1200
    assert client.post("/api/predict/riegel", json={"referenceSeconds":0, "referenceMeters":5000, "targetMeters":8000}).status_code == 422
    monkeypatch.delenv("PACELAB_MODEL_PATH", raising=False)
    ml = client.post("/api/predict/ml", json={"eventMeters":5000, "weeklyMiles4w":40, "averageEasyPaceSecondsPerMile":480, "hardSessions4w":5, "longestRunMiles":12})
    assert ml.status_code == 503


def test_race_export_requires_auth_and_returns_header(client):
    assert client.get("/api/exports/race-training.csv").status_code == 401
    auth = register(client, "race-csv@example.com")
    response = client.get("/api/exports/race-training.csv", headers=auth)
    assert response.status_code == 200
    assert response.headers["x-pacelab-valid-race-rows"] == "0"
    assert response.text.startswith("date,event_meters,weekly_miles_4w,")
