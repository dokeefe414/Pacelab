import csv
from datetime import date, timedelta
import pytest
from ml.train import read_rows


def test_ml_csv_requires_rows(tmp_path):
    path = tmp_path / "races.csv"
    with path.open("w", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow(["date", "event_meters", "weekly_miles_4w", "average_easy_pace_seconds_per_mile", "hard_sessions_4w", "longest_run_miles", "finish_seconds"])
        for i in range(60):
            writer.writerow([(date(2025,1,1)+timedelta(days=i)).isoformat(),5000,45,450,4,12,1100+i])
    rows = read_rows(path)
    assert len(rows) == 60
    assert rows[0][0] < rows[-1][0]


def test_ml_bad_labels_rejected(tmp_path):
    path = tmp_path / "bad.csv"
    path.write_text("date,event_meters,weekly_miles_4w,average_easy_pace_seconds_per_mile,hard_sessions_4w,longest_run_miles,finish_seconds\n2026-01-01,5000,40,480,4,11,not-a-time\n")
    with pytest.raises(ValueError):
        read_rows(path)
