"""Transparent, account-scoped training summaries; never infer medical readiness."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

INTENSITY_WEIGHTS = {
    "Recovery": 0.7, "Easy": 1.0, "Long": 1.1,
    "Tempo": 1.35, "Intervals": 1.5, "Race": 1.7,
}
EVENTS = {"800m": 800.0, "Mile": 1609.344, "3K": 3000.0, "5K": 5000.0, "8K": 8000.0, "10K": 10000.0}


def _within(items, start, end):
    return [w for w in items if start <= w.date <= end]


def _sum_miles(items):
    return round(sum(w.distance_miles for w in items), 2)


def _weighted_minutes(items):
    return round(sum(w.duration_seconds / 60 * INTENSITY_WEIGHTS.get(w.type, 1) for w in items), 1)


def _paces(items):
    miles = sum(w.distance_miles for w in items)
    return round(sum(w.duration_seconds for w in items)/miles, 1) if miles else None


def personal_bests(workouts):
    races = [w for w in workouts if w.type == "Race"]
    records = []
    for name, meters in EVENTS.items():
        candidates = [w for w in races if abs(w.distance_miles * 1609.344 - meters) / meters <= 0.025]
        if candidates:
            best = min(candidates, key=lambda w: w.duration_seconds)
            records.append({"event": name, "date": best.date.isoformat(), "seconds": best.duration_seconds, "workoutId": best.id})
    return records


def summarize_training(workouts, today=None):
    today = today or date.today()
    workouts = [w for w in workouts if w.date <= today]
    first_monday = today - timedelta(days=today.weekday())
    rows = []
    for ago in range(11, -1, -1):
        monday = first_monday - timedelta(days=7*ago)
        relevant = _within(workouts, monday, monday + timedelta(days=6))
        rows.append({
            "week": monday.isoformat(), "miles": _sum_miles(relevant),
            "minutes": round(sum(w.duration_seconds for w in relevant)/60, 1),
            "weightedMinutes": _weighted_minutes(relevant),
            "activities": len(relevant), "averagePaceSecondsPerMile": _paces(relevant),
        })
    last7 = _within(workouts, today-timedelta(days=6), today)
    prior7 = _within(workouts, today-timedelta(days=13), today-timedelta(days=7))
    last28 = _within(workouts, today-timedelta(days=27), today)
    easy28 = [w for w in last28 if w.type in {"Easy","Recovery"}]
    mixed = defaultdict(float)
    for workout in last28:
        mixed[workout.type] += workout.distance_miles
    heart_rates = [w.avg_heart_rate for w in last28 if w.avg_heart_rate is not None]
    return {
        "asOf": today.isoformat(), "totalActivities": len(workouts),
        "last7": {"miles": _sum_miles(last7), "activities": len(last7), "minutes": round(sum(w.duration_seconds for w in last7)/60, 1)},
        "previous7": {"miles": _sum_miles(prior7), "activities": len(prior7)},
        "last28": {
            "miles": _sum_miles(last28), "activities": len(last28), "weightedMinutes": _weighted_minutes(last28),
            "averagePaceSecondsPerMile": _paces(last28),
            "easyPaceSecondsPerMile": _paces(easy28),
            "hardSessions": sum(w.type in {"Tempo","Intervals","Race"} for w in last28),
            "longestRunMiles": round(max((w.distance_miles for w in last28), default=0), 2),
            "averageRecordedHeartRate": round(sum(heart_rates)/len(heart_rates)) if heart_rates else None,
            "milesByType": {key: round(val, 2) for key,val in sorted(mixed.items())},
        },
        "weeks": rows, "personalBests": personal_bests(workouts),
        "caveats": [
            "Data excludes future-dated workouts and depends on what has been logged.",
            "Weighted training minutes are illustrative effort proxies, not a validated medical or physiological load metric.",
            "Pace and heart-rate averages combine different terrain, conditions and devices.",
        ],
    }


def grounded_answer(question, facts):
    lower = question.lower()
    w7 = facts["last7"]; p7 = facts["previous7"]; w28 = facts["last28"]
    if not facts["totalActivities"]:
        return "No workouts are recorded in this account yet. Import a FIT, GPX or TCX file, or log a workout to start analyzing real data."
    if any(token in lower for token in ["race", "pr", "personal best", "fastest"]):
        records = facts["personalBests"]
        if not records:
            return "There are no logged Race workouts at supported standard distances yet. Mark a workout as Race to track your personal bests. Race predictions need a real reference performance."
        text = "; ".join(f'{record["event"]}: {record["seconds"]} seconds on {record["date"]}' for record in records)
        return "Your recorded race bests (based on finish times, not predictions): " + text + "."
    if any(token in lower for token in ["heart", "hr", "pulse"]):
        hr = w28["averageRecordedHeartRate"]
        return (f"Average recorded session heart rate across workouts in the last 28 days: {hr} bpm." if hr else "No workout-level heart-rate data is available in your last 28 days. Try importing a FIT file with heart-rate samples.") + " Comparisons may be affected by sensor and workout intensity."
    if any(token in lower for token in ["pace", "speed", "faster", "slower"]):
        pace = w28["easyPaceSecondsPerMile"]
        if pace is None:
            return "No Easy or Recovery workout pace data was logged in the last 28 days."
        mins = int(pace // 60); secs = round(pace) % 60
        return f"Your distance-weighted Easy/Recovery pace across the last 28 days is {mins}:{secs:02d} per mile. This alone does not establish a fitness change."
    if any(token in lower for token in ["consistent", "week", "progress", "trend", "mileage", "volume"]):
        delta = round(w7["miles"]-p7["miles"], 1)
        direction = "more" if delta >= 0 else "fewer"
        return f"You logged {w7['miles']} miles over the last seven days versus {p7['miles']} miles in the prior seven days ({abs(delta)} {direction} miles). In the last 28 days you recorded {w28['activities']} workouts and {w28['miles']} miles. Changes in logging completeness also affect this comparison."
    if any(token in lower for token in ["load", "hard", "intensity", "recovery", "stress"]):
        return f"In the last 28 days you logged {w28['hardSessions']} Tempo, Intervals or Race workouts. The illustrative weighted-minutes total is {w28['weightedMinutes']} (arbitrary weighting). This cannot diagnose recovery, fatigue or injury risk."
    return f"Your account contains {facts['totalActivities']} workouts, including {w28['activities']} in the last 28 days ({w28['miles']} miles). Ask about mileage trends, easy pace, heart rate, hard sessions or recorded race bests."
