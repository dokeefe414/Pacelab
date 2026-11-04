"""Verify a local FIT export against known device totals, without publishing GPS.

Run from backend/:
    python -m tools.verify_fit PATH.fit --distance-km 10.0 --timer-sec 3000

Only derived totals are printed. No raw coordinates, device IDs, personal
notes or raw sensor samples are sent to a server or written to disk.
"""
import argparse
from pathlib import Path
from app.activity_import import MAX_FILE_BYTES, parse_activity


def verify(path, distance_km=None, timer_sec=None, hr=None):
    file=Path(path)
    if not file.is_file() or file.stat().st_size>MAX_FILE_BYTES:
        raise ValueError("FIT file missing or exceeds 10 MB")
    result=parse_activity(file.name,file.read_bytes())
    expected={}
    if distance_km is not None:
        delta=abs(result["distanceMiles"]*1.609344-distance_km)
        expected["distanceWithin25m"]=delta<=.025
    if timer_sec is not None:
        expected["timerWithin3s"]=abs(result["durationSeconds"]-timer_sec)<=3
    if hr is not None:
        expected["averageHeartRateWithin3bpm"]=result["avgHeartRate"] is not None and abs(result["avgHeartRate"]-hr)<=3
    summary={
        "source":result["source"],"distanceKm":round(result["distanceMiles"]*1.609344,3),
        "timerSeconds":result["durationSeconds"],"elapsedSeconds":result["elapsedSeconds"],
        "lapCount":len(result["laps"]),"routeSampleCount":len(result["track"]),
        "hasHeartRate":result["avgHeartRate"] is not None,
        "hasCadence":result["avgCadenceSpm"] is not None,
        "hasPower":result["avgPowerWatts"] is not None,
        "checks":expected,
    }
    if expected and not all(expected.values()):
        raise ValueError("FIT import differs from device reference totals: "+str(expected))
    return summary


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file",help="Locally saved FIT export, never public GitHub")
    parser.add_argument("--distance-km",type=float)
    parser.add_argument("--timer-sec",type=int)
    parser.add_argument("--hr",type=int)
    args=parser.parse_args()
    import json
    print(json.dumps(verify(args.file,args.distance_km,args.timer_sec,args.hr),indent=2))
