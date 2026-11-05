"""Calendar-period summaries shared by authenticated athlete insights.

Never extrapolate a partial current month/week to imply an actual recorded
performance. Unknown logging completeness cannot be inferred as zero training.
"""
from __future__ import annotations

from datetime import date, timedelta


def month_summaries(workouts, *, today: date | None = None, months: int = 6):
    today = today or date.today()
    if months < 1 or months > 24:
        raise ValueError("months must be between 1 and 24")
    entries=[w for w in workouts if w.date <= today]
    month_index=today.year*12+(today.month-1)
    rows=[]
    for ago in range(months-1,-1,-1):
        i=month_index-ago
        year,zero_month=divmod(i,12)
        start=date(year,zero_month+1,1)
        next_year,next_month=divmod(i+1,12)
        end=date(next_year,next_month+1,1)
        selected=[w for w in entries if start<=w.date<end]
        easy=[w for w in selected if w.type in ("Easy","Recovery")]
        easy_distance=sum(w.distance_miles for w in easy)
        usable_hr=sum(w.avg_heart_rate is not None for w in selected)
        rows.append({
            "month":start.strftime("%Y-%m"),
            "partial":ago==0,
            "miles":round(sum(w.distance_miles for w in selected),2),
            "minutes":round(sum(w.duration_seconds for w in selected)/60,1),
            "activities":len(selected),
            "races":sum(w.type=="Race" for w in selected),
            "easyPaceSecondsPerMile":round(
                sum(w.duration_seconds for w in easy)/easy_distance,1
            ) if easy_distance>0 else None,
            "heartRateCoveragePercent":round(100*usable_hr/len(selected),1) if selected else 0,
        })
    return rows


def completed_four_week_comparison(workouts, *, today: date | None = None):
    today=today or date.today()
    monday=today-timedelta(days=today.weekday())
    past=[w for w in workouts if w.date < monday]
    weeks=[]
    for ago in range(8,0,-1):
        start=monday-timedelta(days=7*ago)
        end=start+timedelta(days=7)
        week=[w for w in past if start<=w.date<end]
        weeks.append(round(sum(w.distance_miles for w in week),2))
    early=round(sum(weeks[:4]),2)
    recent=round(sum(weeks[4:]),2)
    return {
        "earlierFourWeekMiles":early,
        "recentFourWeekMiles":recent,
        "differenceMiles":round(recent-early,2),
        "currentWeekExcluded":True,
        "warning":"Only completed weeks are compared. Missing logs cannot be interpreted as rest or lower fitness."
    }
