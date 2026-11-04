"""End-to-end smoke test for the optional supervised model.

Rows are synthetic TEST FIXTURES only. No synthetic artifact ships with PaceLab
or is presented to users as a validated model.
"""
import csv
from datetime import date, timedelta

import joblib
from ml.train import FEATURES, train


def test_training_pipeline_and_optional_inference(client, tmp_path, monkeypatch):
    csv_path = tmp_path / "test_fixture_only.csv"
    with csv_path.open("w", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(["date", *FEATURES, "finish_seconds"])
        for i in range(64):
            event = 5000 if i % 2 == 0 else 8000
            mileage = 30 + i * .15
            easy_pace = 510 - i * .7
            hard = 3 + i % 3
            long_run = 9 + i % 5
            finish = 900 + event * .085 - .8 * mileage + .35 * easy_pace
            writer.writerow([
                (date(2025,1,1)+timedelta(days=i)).isoformat(),
                event,mileage,easy_pace,hard,long_run,round(finish,2)
            ])
    path = tmp_path / "fixture-model.joblib"
    report = train(csv_path, path)
    assert report["training_rows"] > 0
    assert report["test_rows"] > 0
    assert report["test_mae_seconds"] >= 0
    assert "hist_gradient_boosting" in report["validation_mae_seconds"]
    assert "small_neural_net" in report["validation_mae_seconds"]
    assert path.with_suffix(".model-card.md").exists()
    assert path.with_suffix(".metrics.json").exists()
    assert "validation_permutation_importance_mae_seconds" in report
    artifact = joblib.load(path)  # We made this artifact ourselves.
    assert artifact["demo"] is False  # Flag means the trainer doesn't fabricate real-world dataset.
    monkeypatch.setenv("PACELAB_MODEL_PATH", str(path))
    account = client.post("/api/auth/register", json={"email":"inference-test@example.com", "password":"very-strong-password-123"})
    assert account.status_code == 201
    headers = {"Authorization": "Bearer " + account.json()["access_token"]}
    response = client.post("/api/predict/ml", headers=headers, json={
        "eventMeters": 5000, "weeklyMiles4w": 35,
        "averageEasyPaceSecondsPerMile": 480,
        "hardSessions4w": 4, "longestRunMiles": 10
    })
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["experimental"] is True
    assert data["estimatedSeconds"] > 0
    assert data["upperSeconds"] >= data["lowerSeconds"]
