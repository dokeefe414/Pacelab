from datetime import date
from types import SimpleNamespace
from app.periods import month_summaries, completed_four_week_comparison


def run(day, miles=5, typ="Easy", hr=None):
    return SimpleNamespace(date=date.fromisoformat(day), distance_miles=miles,
       type=typ, duration_seconds=2400, avg_heart_rate=hr)


def test_monthly_records_exclude_future_and_preserve_missing_sensor_semantics():
    today=date(2026,11,4)
    rows=month_summaries([
        run("2026-09-10",5,hr=135),
        run("2026-09-11",5,typ="Race"),
        run("2026-10-10",4,typ="Recovery"),
        run("2026-11-01",8),
        run("2026-11-07",999),
    ],today=today,months=3)
    assert [row["month"] for row in rows]==["2026-09","2026-10","2026-11"]
    assert rows[0]["heartRateCoveragePercent"]==50
    assert rows[0]["races"]==1
    assert rows[1]["easyPaceSecondsPerMile"]==600
    assert rows[2]["miles"]==8
    assert rows[2]["partial"] is True


def test_complete_weeks_compare_equal_length_four_week_windows():
    today=date(2026,11,4)  # Wednesday
    data=[run((date(2026,11,2)-__import__("datetime").timedelta(days=7*i)).isoformat(),
              100 if i==0 else 5) for i in range(9)]
    r=completed_four_week_comparison(data,today=today)
    assert r["earlierFourWeekMiles"]==20
    assert r["recentFourWeekMiles"]==20
    assert r["differenceMiles"]==0
    assert r["currentWeekExcluded"] is True
