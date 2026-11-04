"""Synthetic FIT sensor regression tests; no private FIT files committed."""
from app.activity_import import _fit_distance, _fit_elevation, _fit_heart_rate, _semicircles

def test_missing_fit_samples():
    assert _fit_heart_rate(255) is None
    assert _fit_heart_rate(145) == 145
    assert _fit_elevation(65535) is None
    assert _fit_elevation(140.2) == 140.2
    assert _fit_distance(float("nan")) is None
    assert _semicircles(0x7fffffff) is None
    assert _semicircles(0) == 0
