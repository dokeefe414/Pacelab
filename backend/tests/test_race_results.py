from test_api import register, payload

RESULT = {"name": "Test meet", "eventMeters": 8000, "finishSeconds": 1713.6,
          "confirmed": True, "sourceUrl": "https://example.com/results"}


def test_official_results_persist_export_and_respect_ownership(client):
    auth = register(client)
    other = register(client, "other@example.com")
    data = {**payload(), "type": "Race", "raceResult": RESULT}
    created = client.post("/api/workouts", headers=auth, json=data)
    assert created.status_code == 201, created.text
    wid = created.json()["id"]
    assert created.json()["durationSeconds"] == 2400
    assert created.json()["raceResult"] == RESULT
    assert client.get(f"/api/workouts/{wid}", headers=other).status_code == 404
    assert client.put(f"/api/workouts/{wid}", headers=other, json=data).status_code == 404
    # Older clients omit the field; their edits must not destroy the result.
    edited = client.put(f"/api/workouts/{wid}", headers=auth, json=payload())
    assert edited.json()["raceResult"] == RESULT
    exported = client.get("/api/account/export", headers=auth).json()
    assert exported["workouts"][0]["raceResult"] == RESULT
    cleared = client.put(f"/api/workouts/{wid}", headers=auth, json={**payload(), "raceResult": None})
    assert cleared.json()["raceResult"] is None


def test_invalid_results_are_rejected(client):
    auth = register(client)
    for patch in [{"eventMeters": 7999}, {"finishSeconds": -1}, {"name": " "},
                  {"confirmed": "true"}, {"sourceUrl": "javascript:alert(1)"},
                  {"sourceUrl": "https://user:pass@example.com"}]:
        response = client.post("/api/workouts", headers=auth,
                               json={**payload(), "raceResult": {**RESULT, **patch}})
        assert response.status_code == 422, response.text
