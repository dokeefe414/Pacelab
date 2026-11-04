"""No external AI requests without explicit per-request runner consent."""
import pytest
from app import assistant


def signup(client,email="consent@example.com"):
    result=client.post("/api/auth/register",json={
        "email":email,"password":"strong-account-password123",
    })
    assert result.status_code==201,result.text
    return {"Authorization":"Bearer "+result.json()["access_token"]}


def test_external_model_is_never_called_without_explicit_consent(client,monkeypatch):
    headers=signup(client)
    requests=[]
    async def stub(question,facts):
        requests.append((question,facts))
        return "Only a synthetic test response."
    monkeypatch.setenv("PACELAB_ASSISTANT_PROVIDER","openai")
    monkeypatch.setattr(assistant,"_llm_phrase",stub)
    basic=client.post("/api/assistant/ask",headers=headers,json={
        "question":"How many miles did I run?"
    })
    assert basic.status_code==200
    assert basic.json()["engine"]=="verified-statistics"
    assert basic.json()["externalProcessingUsed"] is False
    assert requests==[]
    selected=client.post("/api/assistant/ask",headers=headers,json={
        "question":"How many miles did I run?","allowExternalProcessing":True,
    })
    assert selected.status_code==200
    assert len(requests)==1
    assert selected.json()["externalProcessingUsed"] is True
    assert selected.json()["engine"]=="language-model-with-verified-statistics"
    assert "email" not in requests[0][1]
    assert "track" not in str(requests[0][1])
    assert "notes" not in str(requests[0][1])
