from tools.verify_fit import verify
from test_binary_fit_smoke import sample_fit


def test_private_fit_verification_uses_only_safe_derived_totals(tmp_path):
    path=tmp_path/"not-real-export.fit"
    path.write_bytes(sample_fit())
    result=verify(path,distance_km=2.0,timer_sec=600,hr=155)
    assert result["source"]=="fit"
    assert result["lapCount"]==2
    assert result["checks"]=={
        "distanceWithin25m":True,"timerWithin3s":True,
        "averageHeartRateWithin3bpm":True,
    }
    assert "track" not in result
    assert "lat" not in result
