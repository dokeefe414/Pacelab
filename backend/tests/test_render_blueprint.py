"""Static checks for the opt-in Render infrastructure Blueprint.

This test does not create hosting resources, incur charges or validate
Render's entire live Blueprint schema. Operator must validate before apply.
"""
from pathlib import Path
import yaml


def test_render_blueprint_keeps_private_defaults_and_secret_wiring():
    path=Path(__file__).resolve().parents[2]/"render.yaml"
    definition=yaml.safe_load(path.read_text(encoding="utf-8"))
    assert definition["previews"]["generation"] is False or definition["previews"]["generation"]=="off"
    assert len(definition["services"])==1
    assert len(definition["databases"])==1
    service=definition["services"][0]
    assert service["type"]=="web"
    assert service["runtime"]=="docker"
    assert service["dockerfilePath"]=="./backend/Dockerfile"
    assert service["dockerContext"]=="./backend"
    assert service["healthCheckPath"]=="/api/ready"
    env={entry["key"]:entry for entry in service["envVars"]}
    assert env["PACELAB_ENV"]["value"]=="production"
    assert env["PACELAB_PUBLIC_SIGNUP"]["value"]=="false"
    assert env["PACELAB_SECRET_KEY"]["generateValue"] is True
    assert env["PACELAB_DATABASE_URL"]["fromDatabase"]["property"]=="connectionString"
    assert env["PACELAB_ASSISTANT_PROVIDER"]["value"]=="off"
    assert env["PACELAB_CORS_ORIGINS"]["value"]=="https://dokeefe414.github.io"
    assert service["name"].startswith("pacelab")
    text=path.read_text(encoding="utf-8")
    assert "OPENAI_API_KEY" not in text
    assert "POSTGRES_PASSWORD" not in text
    assert "replace-with" not in text
