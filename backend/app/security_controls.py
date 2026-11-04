"""Small in-process abuse guard and response security headers.

For a single container/small private beta only. A public multi-worker release
requires centralized rate limits at the trusted edge (e.g. Redis or gateway).
"""
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import Request
from fastapi.responses import JSONResponse

from .security import get_subject

LIMITS = {
    "/api/auth/login": (12, 60),
    "/api/auth/register": (6, 60),
    "/api/assistant/ask": (30, 60),
    "/api/activities/import": (25, 60),
    "/api/activities/import-bulk": (8, 60),
    "/api/account": (5, 60),
}


class SlidingWindowGuard:
    def __init__(self):
        self._lock = Lock()
        self._visits = defaultdict(deque)

    def allow(self, key: str, count: int, seconds: int, now: float | None = None):
        now = monotonic() if now is None else now
        with self._lock:
            stamps = self._visits[key]
            while stamps and stamps[0] <= now-seconds:
                stamps.popleft()
            if len(stamps) >= count:
                return False
            stamps.append(now)
            # Cap memory use for long-lived instances / random probing.
            if len(self._visits) > 10000:
                for k in list(self._visits)[:2500]:
                    if not self._visits[k] or self._visits[k][-1] < now-300:
                        self._visits.pop(k,None)
            return True


rate_guard = SlidingWindowGuard()


async def security_middleware(request: Request, call_next):
    path = request.url.path
    if request.method != "OPTIONS" and path in LIMITS:
        authorization = request.headers.get("authorization","")
        identity = None
        if authorization.lower().startswith("bearer "):
            identity = get_subject(authorization[7:].strip())
        # Ignore untrusted client supplied X-Forwarded-For; direct remote IP
        # must be configured correctly behind a trusted reverse proxy.
        identity = identity or (request.client.host if request.client else "unknown")
        count,window = LIMITS[path]
        if not rate_guard.allow(path+":"+identity,count,window):
            return JSONResponse(status_code=429, content={"detail":"Too many requests. Try again later."},
                                headers={"Retry-After":str(window), "Cache-Control":"no-store"})
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "private, no-store"
    return response
