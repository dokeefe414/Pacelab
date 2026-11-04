"""Authentication dependency shared by account-bound endpoints."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .security import get_claims

bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    claims = get_claims(credentials.credentials) if credentials and credentials.scheme.lower() == "bearer" else None
    user = db.get(User, claims["sub"]) if claims else None
    if user is None or user.token_version != claims["ver"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    return user
