"""Password hashing and short-lived signed access tokens."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

_DEFAULT_DEV_SECRET = "pacelab-unsafe-local-development-secret-do-not-deploy"
_SECRET = os.getenv("PACELAB_SECRET_KEY", _DEFAULT_DEV_SECRET)
_ENVIRONMENT = os.getenv("PACELAB_ENV", "development").lower()

if _ENVIRONMENT == "production" and (_SECRET == _DEFAULT_DEV_SECRET or len(_SECRET) < 32):
    raise RuntimeError("PACELAB_SECRET_KEY must be a unique secret of at least 32 characters in production")

hashing = PasswordHash.recommended()
ALGORITHM = "HS256"
ISSUER = "pacelab"
TOKEN_LIFETIME_MINUTES = 60


def password_hash(plain: str) -> str:
    return hashing.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return hashing.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iss": ISSUER, "iat": now, "exp": now + timedelta(minutes=TOKEN_LIFETIME_MINUTES)},
        _SECRET, algorithm=ALGORITHM,
    )


def get_subject(token: str) -> str | None:
    try:
        data = jwt.decode(token, _SECRET, algorithms=[ALGORITHM], issuer=ISSUER, options={"require": ["sub", "iss", "iat", "exp"]})
        subject = data.get("sub")
        return subject if isinstance(subject, str) and subject else None
    except InvalidTokenError:
        return None
