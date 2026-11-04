"""Parse COROS/other device FIT, GPX and TCX activity exports.

No third-party credentials, outbound requests, or raw-file retention.
All incoming files are size-limited, parsed without entity resolution, and
downsampled before their track data is saved per authenticated account.
"""
from __future__ import annotations

import hashlib
import io
import math
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

import fitdecode
from defusedxml import ElementTree as SafeET

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_POINTS = 60000
MAX_STORED_POINTS = 500
MILES_PER_METER = 1 / 1609.344


class ActivityParseError(ValueError):
    pass


def _name(element):
    return element.tag.rsplit("}", 1)[-1]


def _find_text(element, name):
    for child in element.iter():
        if _name(child) == name and child.text:
            return child.text.strip()
    return None


def _numeric(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (ValueError, TypeError, OverflowError):
        return None


def _time(value):
    if isinstance(value, datetime):
        dt = value
    elif value:
        try:
            dt = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _haversine(lat1, lon1, lat2, lon2):
    radius = 6371000.0
    a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(math.radians(lon2-lon1)/2)**2
    return 2 * radius * math.asin(min(1, math.sqrt(a)))


def _coordinates(lat, lon):
    latitude, longitude = _numeric(lat), _numeric(lon)
    return (latitude, longitude) if latitude is not None and longitude is not None and -90 <= latitude <= 90 and -180 <= longitude <= 180 else (None, None)


def _downsample(points, max_points=MAX_STORED_POINTS):
    if len(points) <= max_points:
        return points
    return [points[round(i * (len(points)-1)/(max_points-1))] for i in range(max_points)]


def _laps_from_points(points):
    """Build approximate one-mile splits using timestamp/distance samples."""
    result = []
    start_at = 0.0
    previous_distance = 0.0
    previous_elapsed = 0.0
    for point in points:
        distance = point["distanceMiles"]
        elapsed = point["elapsed"]
        if distance is None or elapsed is None:
            continue
        if distance < previous_distance:
            continue
        while distance >= len(result) + 1:
            target = len(result) + 1
            fraction = (target-previous_distance)/(distance-previous_distance) if distance > previous_distance else 1
            crossing = previous_elapsed + fraction*(elapsed-previous_elapsed)
            duration = crossing-start_at
            if duration > 0:
                result.append({"number": len(result)+1, "distanceMiles": 1.0, "durationSeconds": round(duration), "source": "approx_mile"})
            start_at = crossing
        previous_distance, previous_elapsed = distance, elapsed
    return result[:200]


def _build(points, *, distance_meters=None, duration_seconds=None, elapsed_seconds=None, start=None, heart_rate=None, max_heart_rate=None, elevation_gain=None, elevation_loss=None, avg_cadence=None, avg_power=None, laps=None, source):
    if not points and (distance_meters is None or duration_seconds is None or start is None):
        raise ActivityParseError("Activity has no usable time and distance information")
    timed = [p for p in points if p.get("time") is not None]
    first = start or (timed[0]["time"] if timed else None)
    last = timed[-1]["time"] if timed else None
    if first is None:
        raise ActivityParseError("Activity has no start timestamp")
    duration = duration_seconds if duration_seconds is not None else ((last-first).total_seconds() if last else None)
    if duration is None or not (0 < duration <= 86400):
        raise ActivityParseError("Activity duration must be between 1 second and 24 hours")
    wall_elapsed = elapsed_seconds if elapsed_seconds is not None else ((last-first).total_seconds() if last else duration)
    if not (0 < wall_elapsed <= 86400):
        raise ActivityParseError("Invalid elapsed activity duration")
    traveled = distance_meters
    if traveled is None and points:
        traveled = points[-1].get("distanceMeters")
    if traveled is None or not (0 < traveled <= 321868.8):
        raise ActivityParseError("Activity has no valid distance")
    if elevation_gain is None:
        up = 0
        prev_elev = None
        for p in points:
            elevation = _fit_elevation(p.get("elevationMeters"))
            if elevation is not None and prev_elev is not None and elevation > prev_elev:
                up += elevation-prev_elev
            if elevation is not None:
                prev_elev = elevation
        elevation_gain = up if prev_elev is not None else None
    if elevation_loss is None:
        down, previous = 0.0, None
        for point in points:
            altitude = _fit_elevation(point.get("elevationMeters"))
            if previous is not None and altitude is not None and previous > altitude:
                down += previous-altitude
            if altitude is not None:
                previous=altitude
        elevation_loss = round(down, 1) if previous is not None else None
    hr_values = [p["heartRate"] for p in points if p.get("heartRate") is not None and 30 <= p["heartRate"] <= 230]
    if heart_rate is None and hr_values:
        heart_rate = round(mean(hr_values))
    if heart_rate is not None and not (30 <= heart_rate <= 230):
        heart_rate = None
    if max_heart_rate is None and hr_values:
        max_heart_rate = max(hr_values)
    if max_heart_rate is not None and not (30 <= max_heart_rate <= 230):
        max_heart_rate = None
    if avg_cadence is not None and not (0 < avg_cadence <= 260):
        avg_cadence = None
    if avg_power is not None and not (0 < avg_power < 2500):
        avg_power = None
    track = []
    for p in points:
        point_time = p.get("time")
        track.append({
            "elapsed": round(max(0, (point_time-first).total_seconds()), 1) if point_time else None,
            "distanceMiles": round(p["distanceMeters"]*MILES_PER_METER, 4) if p.get("distanceMeters") is not None else None,
            "heartRate": _fit_heart_rate(p.get("heartRate")),
            "cadenceSpm": round(p["cadenceSpm"], 1) if _numeric(p.get("cadenceSpm")) is not None and 0 <= p["cadenceSpm"] <= 260 else None,
            "powerWatts": round(p["powerWatts"]) if _numeric(p.get("powerWatts")) is not None and 0 <= p["powerWatts"] < 2500 else None,
            "elevationMeters": round(p["elevationMeters"], 1) if _fit_elevation(p.get("elevationMeters")) is not None else None,
            "lat": round(p["lat"], 6) if p.get("lat") is not None else None,
            "lon": round(p["lon"], 6) if p.get("lon") is not None else None,
        })
    valid_laps = (laps or [])[:200]
    if not valid_laps:
        valid_laps = _laps_from_points(track)
    return {
        "date": first.date(), "startTime": first, "durationSeconds": round(duration),
        "elapsedSeconds": round(max(duration, wall_elapsed)),
        "distanceMiles": round(traveled*MILES_PER_METER, 4), "type": "Easy",
        "notes": "Imported from " + source.upper() + " activity",
        "source": source, "avgHeartRate": round(heart_rate) if heart_rate else None,
        "elevationGainMeters": round(elevation_gain, 1) if elevation_gain is not None else None,
        "elevationLossMeters": round(elevation_loss, 1) if elevation_loss is not None else None,
        "maxHeartRate": round(max_heart_rate) if max_heart_rate is not None else None,
        "avgCadenceSpm": round(avg_cadence, 1) if avg_cadence is not None else None,
        "avgPowerWatts": round(avg_power, 1) if avg_power is not None else None,
        "laps": valid_laps, "track": _downsample(track),
    }


def _xml_points(root, is_tcx):
    points = []
    total = 0.0
    prev_coords = None
    for element in root.iter():
        if _name(element) != ("Trackpoint" if is_tcx else "trkpt"):
            continue
        if len(points) >= MAX_POINTS:
            raise ActivityParseError("Too many activity samples")
        lat, lon = (_coordinates(_find_text(element, "LatitudeDegrees"), _find_text(element, "LongitudeDegrees"))
                    if is_tcx else _coordinates(element.attrib.get("lat"), element.attrib.get("lon")))
        if lat is not None and prev_coords is not None:
            total += _haversine(*prev_coords, lat, lon)
        if lat is not None:
            prev_coords = (lat, lon)
        explicit_distance = _numeric(_find_text(element, "DistanceMeters")) if is_tcx else None
        if explicit_distance is not None and explicit_distance >= 0:
            total = explicit_distance
        heart_rate = _numeric(_find_text(element, "Value" if is_tcx else "hr"))
        elevation = _numeric(_find_text(element, "AltitudeMeters" if is_tcx else "ele"))
        when = _time(_find_text(element, "Time" if is_tcx else "time"))
        points.append({"time": when, "lat": lat, "lon": lon, "distanceMeters": total, "heartRate": round(heart_rate) if heart_rate is not None else None, "elevationMeters": elevation})
    if not points:
        raise ActivityParseError("No activity trackpoints found")
    return points


def parse_gpx(contents):
    try:
        root = SafeET.fromstring(contents)
    except Exception as exc:
        raise ActivityParseError("Invalid GPX XML") from exc
    if _name(root) != "gpx":
        raise ActivityParseError("Expected a GPX file")
    points = _xml_points(root, False)
    if any(p["time"] is None for p in points):
        raise ActivityParseError("GPX track needs timestamps; routes without time cannot become workouts")
    return _build(points, source="gpx")


def parse_tcx(contents):
    try:
        root = SafeET.fromstring(contents)
    except Exception as exc:
        raise ActivityParseError("Invalid TCX XML") from exc
    if _name(root) != "TrainingCenterDatabase":
        raise ActivityParseError("Expected a TCX file")
    activities = [x for x in root.iter() if _name(x) == "Activity"]
    if len(activities) != 1:
        raise ActivityParseError("One TCX activity per file is required")
    activity = activities[0]
    sport = activity.attrib.get("Sport", "").lower()
    if sport and sport not in {"running", "run"}:
        raise ActivityParseError("Only running activities can be imported")
    points = _xml_points(activity, True)
    total_distance = 0.0
    total_time = 0.0
    laps = []
    for element in activity.iter():
        if _name(element) != "Lap":
            continue
        distance = _numeric(_find_text(element, "DistanceMeters"))
        duration = _numeric(_find_text(element, "TotalTimeSeconds"))
        if distance is not None and duration is not None and distance > 0 and duration > 0:
            total_distance += distance
            total_time += duration
            laps.append({"number": len(laps)+1, "distanceMiles": round(distance*MILES_PER_METER, 4), "durationSeconds": round(duration), "source": "device_lap"})
    if any(p["time"] is None for p in points) and not laps:
        raise ActivityParseError("TCX track needs timestamped points or lap summaries")
    return _build(points, source="tcx", distance_meters=total_distance or None, duration_seconds=total_time or None, laps=laps)


def _fit_get(message, field):
    try:
        return message.get_value(field)
    except (KeyError, ValueError, AttributeError):
        return None


def _semicircles(value):
    """Default fitdecode processor returns raw FIT semicircles, not degrees."""
    number = _numeric(value)
    if number is None or number == 0x7fffffff:
        return None
    return number * (180.0 / (2**31))


def _fit_heart_rate(value):
    """FIT uint8 255 is missing, not a 255 bpm reading."""
    bpm = _numeric(value)
    return round(bpm) if bpm is not None and 30 <= bpm <= 230 else None


def _fit_elevation(value):
    """Drop invalid/unreasonable altitude readings before plotting or ascent."""
    meters = _numeric(value)
    return meters if meters is not None and -500 <= meters <= 9000 else None


def _fit_distance(value):
    meters = _numeric(value)
    return meters if meters is not None and 0 <= meters <= 321868.8 else None


def parse_fit(contents):
    points = []
    session = None
    device_laps = []
    try:
        with fitdecode.FitReader(io.BytesIO(contents)) as reader:
            for frame in reader:
                if getattr(frame, "frame_type", None) != fitdecode.FIT_FRAME_DATA:
                    continue
                if frame.name == "session":
                    session = frame
                elif frame.name == "lap":
                    distance = _numeric(_fit_get(frame, "total_distance"))
                    duration = _numeric(_fit_get(frame, "total_timer_time")) or _numeric(_fit_get(frame, "total_elapsed_time"))
                    if distance and duration and distance > 0 and duration > 0:
                        device_laps.append({"number": len(device_laps)+1, "distanceMiles": round(distance*MILES_PER_METER, 4), "durationSeconds": round(duration), "source": "device_lap"})
                elif frame.name == "record":
                    if len(points) >= MAX_POINTS:
                        raise ActivityParseError("Too many activity samples")
                    lat,lon = _coordinates(_semicircles(_fit_get(frame,"position_lat")), _semicircles(_fit_get(frame,"position_long")))
                    points.append({
                        "time": _time(_fit_get(frame,"timestamp")), "lat":lat, "lon":lon,
                        "distanceMeters":_fit_distance(_fit_get(frame,"distance")),
                        "heartRate":_fit_heart_rate(_fit_get(frame,"heart_rate")),
                        "cadenceSpm": (_numeric(_fit_get(frame,"cadence")) or 0) * 2 if _numeric(_fit_get(frame,"cadence")) is not None else None,
                        "powerWatts": _numeric(_fit_get(frame,"power")),
                        "elevationMeters":_fit_elevation(_fit_get(frame,"enhanced_altitude")) if _fit_get(frame,"enhanced_altitude") is not None else _fit_elevation(_fit_get(frame,"altitude")),
                    })
    except ActivityParseError:
        raise
    except Exception as exc:
        raise ActivityParseError("Invalid or unreadable FIT activity") from exc
    if session is None:
        raise ActivityParseError("FIT file has no session summary")
    sport = str(_fit_get(session,"sport") or "").lower()
    if sport and sport not in {"running", "run", "1"}:
        raise ActivityParseError("Only running activities can be imported")
    start = _time(_fit_get(session,"start_time"))
    duration = _numeric(_fit_get(session,"total_timer_time")) or _numeric(_fit_get(session,"total_elapsed_time"))
    elapsed = _numeric(_fit_get(session,"total_elapsed_time"))
    distance = _fit_distance(_fit_get(session,"total_distance"))
    ascent = _numeric(_fit_get(session,"total_ascent"))
    hr = _fit_heart_rate(_fit_get(session,"avg_heart_rate"))
    avg_cadence = _numeric(_fit_get(session, "avg_cadence"))
    avg_power = _numeric(_fit_get(session, "avg_power"))
    descent = _numeric(_fit_get(session, "total_descent"))
    max_hr = _fit_heart_rate(_fit_get(session, "max_heart_rate"))
    return _build(points, source="fit", start=start, duration_seconds=duration, elapsed_seconds=elapsed,
                  distance_meters=distance, heart_rate=hr, max_heart_rate=max_hr,
                  elevation_gain=ascent, elevation_loss=descent,
                  avg_cadence=avg_cadence*2 if avg_cadence is not None else None,
                  avg_power=avg_power, laps=device_laps)


def parse_activity(filename: str, contents: bytes):
    suffix = Path(filename).suffix.lower()
    if suffix not in {".fit", ".gpx", ".tcx"}:
        raise ActivityParseError("Only .fit, .gpx and .tcx files are supported")
    if not contents or len(contents) > MAX_FILE_BYTES:
        raise ActivityParseError("File must be nonempty and no larger than 10 MB")
    parser = {".fit": parse_fit, ".gpx": parse_gpx, ".tcx": parse_tcx}[suffix]
    workout = parser(contents)
    workout["sourceHash"] = hashlib.sha256(contents).hexdigest()
    return workout
