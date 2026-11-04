"""Password hashing and short-lived signed access tokens."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

_DEFAULT_DEV_SECRET = "pacelab-unsafe-local-development-secret-do-not-deploy"
_SECRET = os.getenv("PACELAB_SECRET_KEY", _DEFAULT_DEV_SECRET)
_ENVIRONMENT = os.getenv("PACELAB_ENV", "development").lower()

if _ENVIRONMENT == "production" and (
    _SECRET == _DEFAULT_DEV_SECRET or len(_SECRET) < 32
    or _SECRET.lower().startswith(("replace-", "example-", "changeme", "your-"))
):
    raise RuntimeError("PACELAB_SECRET_KEY must be a unique secret of at least 32 characters in production")

hashing = PasswordHash.recommended()
ALGORITHM = "HS256"
ISSUER = "pacelab"
TOKEN_LIFETIME_MINUTES = 60


def password_hash(plain: str) -> str:
    return hashing.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return hashing.verify(plain, hashed)


def create_access_token(user_id: str, token_version: int = 0) -> str:
    """Versioned tokens allow an account to revoke every prior access token."""
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iss": ISSUER, "iat": now, "exp": now + timedelta(minutes=TOKEN_LIFETIME_MINUTES),
         "ver": int(token_version)},
        _SECRET, algorithm=ALGORITHM,
    )


def get_claims(token: str) -> dict | None:
    try:
        data = jwt.decode(
            token, _SECRET, algorithms=[ALGORITHM], issuer=ISSUER,
            options={"require": ["sub", "iss", "iat", "exp", "ver"]},
        )
        if (not isinstance(data.get("sub"), str)
            or not data["sub"]
            or type(data.get("ver")) is not int
            or data["ver"] < 0):
            return None
        return data
    except InvalidTokenError:
        return None


def get_subject(token: str) -> str | None:
    claims = get_claims(token)
    return claims["sub"] if claims else None
