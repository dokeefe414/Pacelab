"""Isolated FIT decoder adapter test, independent of binary fixture availability."""
from datetime import datetime, timedelta, timezone
import fitdecode

from app.activity_import import parse_activity


class Frame:
    frame_type = fitdecode.FIT_FRAME_DATA
    def __init__(self, name, **fields):
        self.name, self.fields = name, fields
    def get_value(self, key):
        return self.fields.get(key)


class FakeReader:
    def __init__(self, buffer):
        assert buffer.read() == b"example-fit-file"
    def __enter__(self): return self
    def __exit__(self, exc_type, exc, traceback): return False
    def __iter__(self):
        start = datetime(2026,11,3,12,tzinfo=timezone.utc)
        yield Frame("record", timestamp=start, distance=0, heart_rate=130, position_lat=0, position_long=0, altitude=90)
        yield Frame("record", timestamp=start+timedelta(seconds=300), distance=1000, heart_rate=150, position_lat=1000000, position_long=0, altitude=100)
        yield Frame("lap", total_distance=1000, total_timer_time=300)
        yield Frame("session", sport="running", start_time=start, total_distance=1000, total_timer_time=300, avg_heart_rate=140, total_ascent=10)


def test_fit_adapter_maps_session_and_records(monkeypatch):
    monkeypatch.setattr(fitdecode, "FitReader", FakeReader)
    data = parse_activity("workout.fit", b"example-fit-file")
    assert data["distanceMiles"] > 0.6
    assert data["avgHeartRate"] == 140
    assert data["elevationGainMeters"] == 10
    assert len(data["laps"]) == 1
    assert len(data["track"]) == 2
    assert data["startTime"].utcoffset().total_seconds() == 0
