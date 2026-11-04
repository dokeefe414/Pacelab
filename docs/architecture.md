# PaceLab architecture (v0.2)

```text
                    HTTPS / same-origin reverse proxy
Browser (React migration planned; today: vanilla ES modules)
  ├── Local demo mode: localStorage + downloadable CSV
  └── Account mode: tab-scoped bearer token
         │
         ▼
     FastAPI REST API
       ├── auth: Argon2 hashes + 1-hour JWT
       ├── workouts: authorization by authenticated user.id
       ├── race baseline: deterministic Riegel formula
       └── experimental ML: optional trusted local model artifact
         │
         ▼
     SQLAlchemy ORM → PostgreSQL (Compose) / SQLite (local tests)
           ↑
     Alembic schema migrations
```

## Security and scope

- The model is not trained on personal workouts by default. ML training needs a separate labeled race-history CSV.
- Local demo data and authenticated account data are deliberately separate. Local workouts are **not** silently uploaded on login.
- Token is stored in sessionStorage for the active tab, not in CSV exports. Browser JavaScript can access it; hardened production auth should move to secure HttpOnly cookies and implement CSRF protections where relevant.
- No rate limiting or email verification yet. Do not expose public registration without anti-abuse measures, secure TLS, monitoring, and operational hardening.
- Each workout operation checks ownership server-side; deleting another account's ID results in HTTP 404.
- For production, configure PACELAB_ENV=production, unique PACELAB_SECRET_KEY, an HTTPS frontend/API deployment, DB backups, and secure secret management.
- Use Alembic migrations, not create_all, for application schema lifecycle.

## Model evaluation

- Input labels are real race finishes, training features come only from periods preceding each race.
- Date-ordered training, validation, and test partitions reduce temporal leakage; for multi-athlete cross-validation or prospective use, also evaluate participant generalization and availability of training history.
- Compare a simple median baseline to random forest; select on validation only; report held-out test MAE and interval coverage.
- Intervals rely on exchangeability assumptions and can fail under distribution shift. Treat them as exploratory, not guaranteed calibrated uncertainty.
- Never check in raw user training records or private model artifacts.
