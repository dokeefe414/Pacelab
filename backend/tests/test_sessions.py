"""Account token generation and password rotation are server-backed."""
from app.security import get_claims, create_access_token


def credentials(client, email, password="very-strong-password-123"):
    result=client.post("/api/auth/register",json={"email":email,"password":password})
    assert result.status_code==201,result.text
    return {"Authorization":"Bearer "+result.json()["access_token"]}


def test_all_devices_signed_out_after_server_revoke(client):
    user=credentials(client,"signout@example.com")
    other=credentials(client,"unaffected@example.com")
    second=client.post("/api/auth/login",json={
        "email":"signout@example.com","password":"very-strong-password-123",
    })
    assert second.status_code==200
    second_token={"Authorization":"Bearer "+second.json()["access_token"]}
    assert client.get("/api/auth/me",headers=user).status_code==200
    assert client.post("/api/auth/logout",headers=user).status_code==204
    assert client.get("/api/auth/me",headers=user).status_code==401
    assert client.get("/api/auth/me",headers=second_token).status_code==401
    assert client.get("/api/auth/me",headers=other).status_code==200
    fresh=client.post("/api/auth/login",json={
        "email":"signout@example.com","password":"very-strong-password-123",
    })
    assert fresh.status_code==200
    assert client.get("/api/auth/me",headers={
        "Authorization":"Bearer "+fresh.json()["access_token"]}).status_code==200


def test_password_change_requires_current_and_rotates_all_tokens(client):
    user=credentials(client,"rotation@example.com")
    payload={"currentPassword":"incorrect-password","newPassword":"new-long-password-abc"}
    assert client.post("/api/account/password",headers=user,json=payload).status_code==403
    assert client.get("/api/auth/me",headers=user).status_code==200
    payload["currentPassword"]="very-strong-password-123"
    assert client.post("/api/account/password",headers=user,json=payload).status_code==204
    assert client.get("/api/account/export",headers=user).status_code==401
    assert client.post("/api/auth/login",json={
        "email":"rotation@example.com","password":"very-strong-password-123",
    }).status_code==401
    new=client.post("/api/auth/login",json={
        "email":"rotation@example.com","password":"new-long-password-abc",
    })
    assert new.status_code==200
    assert client.post("/api/account/password",headers={
        "Authorization":"Bearer "+new.json()["access_token"]},json={
        "currentPassword":"new-long-password-abc","newPassword":"new-long-password-abc",
    }).status_code==422


def test_malformed_tokens_have_no_trusted_claims(client):
    assert get_claims("not-a-jwt") is None
    assert client.get("/api/auth/me",headers={
        "Authorization":"Bearer "+create_access_token("nonexistent-user",55)
    }).status_code==401
