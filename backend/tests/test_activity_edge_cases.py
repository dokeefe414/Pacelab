"""Synthetic compatibility tests. No personal COROS activity data is included."""
from datetime import datetime, timedelta, timezone
from app.activity_import import _build, _downsample, _laps_from_points


def test_pauses_and_distance_reset_do_not_make_negative_splits():
    points = [
        {"distanceMiles":0.1,"elapsed":10},
        {"distanceMiles":0.9,"elapsed":300},
        {"distanceMiles":0.8,"elapsed":350},
        {"distanceMiles":1.2,"elapsed":450},
    ]
    laps=_laps_from_points(points)
    assert all(l["durationSeconds"]>0 for l in laps)


def test_downsample_caps_trace_and_keeps_endpoints():
    records=[{"elapsed":i,"distanceMiles":i/100} for i in range(5000)]
    out=_downsample(records)
    assert len(out)==500
    assert out[0] == records[0]
    assert out[-1] == records[-1]


def test_elapsed_outdoor_gps_and_missing_heart_rate():
    start=datetime(2026,11,3,tzinfo=timezone.utc)
    points=[]
    for i in range(12):
        points.append({
            "time":start+timedelta(seconds=60*i),
            "lat":41.0+.0007*i, "lon":-75.0,
            "elevationMeters":100+i,
            "distanceMeters":i*100.0,
            "heartRate":None,
        })
    result=_build(points,source="gpx")
    assert result["durationSeconds"]==660
    assert result["distanceMiles"]>0
    assert result["avgHeartRate"] is None
    assert result["elevationGainMeters"]==11
