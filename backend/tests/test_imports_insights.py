"""End-to-end imported activity, ownership, duplicate and insight tests."""
from datetime import date, datetime, timedelta, timezone
import io

from app.activity_import import parse_activity, ActivityParseError
def register(client, email):
    response = client.post("/api/auth/register", json={"email": email, "password": "very-strong-password-123"})
    assert response.status_code == 201, response.text
    return {"Authorization": "Bearer " + response.json()["access_token"]}


def payload(distance=5):
    return {"date": "2026-11-03", "type": "Easy", "distanceMiles": distance, "durationSeconds": 2400, "notes": "Good aerobic run"}


def fixture_gpx():
    return b'''<?xml version="1.0"?>
<gpx version="1.1" creator="PaceLab-test" xmlns="http://www.topografix.com/GPX/1/1"
 xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<trk><name>Demo workout</name><trkseg>
<trkpt lat="41.0000" lon="-75.0000"><ele>100</ele><time>2026-11-03T12:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>130</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="41.0060" lon="-75.0000"><ele>110</ele><time>2026-11-03T12:03:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="41.0120" lon="-75.0000"><ele>105</ele><time>2026-11-03T12:06:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>145</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
</trkseg></trk></gpx>'''


def fixture_tcx():
    return b'''<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity Sport="Running">
<Id>2026-11-03T12:00:00Z</Id><Lap StartTime="2026-11-03T12:00:00Z">
<TotalTimeSeconds>360</TotalTimeSeconds><DistanceMeters>1335</DistanceMeters>
<Track><Trackpoint><Time>2026-11-03T12:00:00Z</Time><Position><LatitudeDegrees>41</LatitudeDegrees><LongitudeDegrees>-75</LongitudeDegrees></Position><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>135</Value></HeartRateBpm></Trackpoint>
<Trackpoint><Time>2026-11-03T12:06:00Z</Time><Position><LatitudeDegrees>41.012</LatitudeDegrees><LongitudeDegrees>-75</LongitudeDegrees></Position><DistanceMeters>1335</DistanceMeters><HeartRateBpm><Value>155</Value></HeartRateBpm></Trackpoint></Track>
</Lap></Activity></Activities></TrainingCenterDatabase>'''


def test_gpx_parses_hr_route_and_elevation():
    activity = parse_activity("RUN.GPX", fixture_gpx())
    assert activity["source"] == "gpx"
    assert activity["avgHeartRate"] == 142
    assert activity["elevationGainMeters"] == 10
    assert activity["durationSeconds"] == 360
    assert 0.80 < activity["distanceMiles"] < 0.90
    assert len(activity["track"]) == 3


def test_tcx_parses_laps():
    a = parse_activity("run.tcx", fixture_tcx())
    assert a["source"] == "tcx" and len(a["laps"]) == 1
    assert a["laps"][0]["source"] == "device_lap"
    assert a["durationSeconds"] == 360


def test_malicious_or_missing_gpx_rejected():
    bad = b'<!DOCTYPE a [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><gpx>&xxe;</gpx>'
    for file, content in [("bad.gpx", bad), ("empty.gpx", b""), ("wrong.txt", b"whatever")]:
        try:
            parse_activity(file, content)
            assert False, "Unexpectedly accepted unsupported activity"
        except ActivityParseError:
            pass


def test_end_to_end_import_duplicate_and_owner(client):
    a = register(client, "a-import@example.com")
    b = register(client, "b-import@example.com")
    def upload(auth, name, data):
        return client.post("/api/activities/import", headers=auth, files={"file": (name, data, "application/octet-stream")})

    assert upload({}, "test.gpx", fixture_gpx()).status_code == 401
    result = upload(a, "test.gpx", fixture_gpx())
    assert result.status_code == 200, result.text
    assert result.json()["imported"]
    wid = result.json()["workout"]["id"]

    detail = client.get("/api/workouts/" + wid, headers=a)
    assert detail.status_code == 200
    assert detail.json()["avgHeartRate"] == 142
    assert len(detail.json()["track"]) == 3
    assert client.get("/api/workouts/" + wid, headers=b).status_code == 404

    duplicate = upload(a, "same.gpx", fixture_gpx())
    assert not duplicate.json()["imported"]
    assert duplicate.json()["reason"] == "same-file-hash"
    cross = upload(a, "coros.tcx", fixture_tcx())
    assert not cross.json()["imported"]
    assert cross.json()["reason"] == "matching-activity"
    assert len(client.get("/api/workouts", headers=a).json()) == 1

    separately = upload(b, "test.gpx", fixture_gpx())
    assert separately.json()["imported"]
    assert len(client.get("/api/workouts", headers=b).json()) == 1
    assert upload(a, "bad.fit", b"bad").status_code == 422
    assert upload(a, "invalid.pdf", b"x").status_code == 422


def test_insights_assistant_and_race_history(client, monkeypatch):
    auth = register(client, "insights@example.com")
    today = date.today()
    for typ, distance in [("Race", 3.10686), ("Easy", 5), ("Tempo", 6)]:
        row = payload(distance)
        row["date"] = today.isoformat()
        row["type"] = typ
        assert client.post("/api/workouts", headers=auth, json=row).status_code == 201
    facts = client.get("/api/insights/summary", headers=auth)
    assert facts.status_code == 200
    assert facts.json()["last28"]["activities"] == 3
    assert facts.json()["last28"]["hardSessions"] == 2
    assert facts.json()["personalBests"][0]["event"] == "5K"
    prediction = client.get("/api/predict/history?targetMeters=8000", headers=auth)
    assert prediction.status_code == 200 and prediction.json()["reference"]["seconds"] == 2400
    features = client.get("/api/predict/features?eventMeters=8000", headers=auth)
    assert features.status_code == 200 and features.json()["complete"]
    monkeypatch.delenv("PACELAB_ASSISTANT_PROVIDER", raising=False)
    answer = client.post("/api/assistant/ask", headers=auth, json={"question": "How many miles did I run this week?"})
    assert answer.status_code == 200 and answer.json()["engine"] == "verified-statistics"
    assert "miles" in answer.json()["answer"].lower()
    assert client.post("/api/assistant/ask", json={"question":"Give me mileage"}).status_code == 401
    assert client.get("/api/insights/summary").status_code == 401
    assert client.get("/api/predict/history?targetMeters=5000").status_code == 401
