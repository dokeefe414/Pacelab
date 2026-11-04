"""Optional athlete-disjoint evaluation for consented pseudonymous race data.

The core dataset exporter is *single-account*: it has no athlete_id field.
If users separately assemble a multi-athlete research CSV, each row may
include a pseudonymous athlete_id column. This evaluator checks whether
a model generalizes to entirely unseen athletes, and does NOT print IDs.

GroupKFold does not impose chronological order. Do not mistake it for a
prospective or temporal holdout.
"""
import csv
from collections import defaultdict
from pathlib import Path

from sklearn.model_selection import GroupKFold

from .evaluate import model_candidates, numerical_metrics
from .train import read_rows


def athlete_disjoint_evaluation(csv_path):
    path=Path(csv_path)
    with path.open(newline="",encoding="utf-8-sig") as handle:
        reader=csv.DictReader(handle)
        if "athlete_id" not in (reader.fieldnames or ()):
            return {
                "status":"not_applicable",
                "reason":"CSV has no athlete_id column; across-athlete generalization cannot be checked.",
            }
        records=list(reader)
    if any(not str(r.get("athlete_id") or "").strip() for r in records):
        raise ValueError("Each multi-athlete race row needs a pseudonymous athlete_id")
    # read_rows validates target/features and produces the same stable date
    # order as the parallel group sort used below.
    data=read_rows(csv_path)
    groups=sorted(
        ((str(r["date"]),str(r["athlete_id"]).strip()) for r in records),
        key=lambda entry:entry[0],
    )
    labels=[entry[1] for entry in groups]
    identities=set(labels)
    if len(identities)<3:
        return {
            "status":"insufficient_athletes",
            "athleteCount":len(identities),
            "reason":"Need at least 3 pseudonymous athletes for a group-disjoint evaluation.",
        }
    x=[row[1] for row in data]
    y=[row[2] for row in data]
    folds=GroupKFold(n_splits=min(3,len(identities)))
    aggregate=defaultdict(lambda:{"actual":[],"predicted":[]})
    for train_idx,test_idx in folds.split(x,y,groups=labels):
        train_x=[x[i] for i in train_idx]
        train_y=[y[i] for i in train_idx]
        test_x=[x[i] for i in test_idx]
        test_y=[y[i] for i in test_idx]
        for name,model in model_candidates().items():
            model.fit(train_x,train_y)
            outputs=list(map(float,model.predict(test_x)))
            aggregate[name]["actual"].extend(test_y)
            aggregate[name]["predicted"].extend(outputs)
    return {
        "status":"evaluated",
        "athleteCount":len(identities),
        "evaluatedRows":len(data),
        "models":{
            name:numerical_metrics(item["actual"],item["predicted"])
            for name,item in aggregate.items()
        },
        "warning":"Group-disjoint cross-validation is not a time-ordered or prospective test. "
                  "Input athlete IDs were not included in this report. "
                  "Do not claim broad generalization without an independent cohort.",
    }
