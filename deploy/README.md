# PaceLab reference HTTPS deployment

The infrastructure files are **scaffolding**. PaceLab is not yet an audited,
publicly deployed production service.

## Requirements

A server with Docker Compose and ports 80/443 open; a DNS A/AAAA record
for your domain; unique secrets; database backups, operations monitoring,
and a security review of auth, uploads, and privacy.

Create .env with:
- POSTGRES_PASSWORD: a strong random password
- PACELAB_SECRET_KEY: an independent random signing secret, at least 32 characters
- PACELAB_DOMAIN: your registered domain

Run:

    docker compose -f compose.production.yml up -d --build
    docker compose -f compose.production.yml exec api python -m app.create_user

Visit https://YOUR-DOMAIN. The Caddy reverse proxy automatically requests TLS
certificates once public DNS is correctly configured. Registration is disabled
in production by default. The operator can provision private-beta users
interactively using the create_user command.

## Optional grounded assistant

Add to .env if you explicitly want an external LLM:

    PACELAB_ASSISTANT_PROVIDER=openai
    PACELAB_ASSISTANT_MODEL=YOUR_RESPONSES_API_MODEL
    OPENAI_API_KEY=YOUR_SECRET_KEY

The assistant sends your question and **aggregate training stats** to the
provider, not email, workout notes, raw GPS or tokens. Without these settings,
the assistant responds deterministically from your private database.

## Optional real-data model

Train on a real labeled race-history CSV via backend/ml/train.py. Copy only
your own trusted model to backend/models, then set:

    PACELAB_MODEL_PATH=/app/models/race_rf.joblib

Never upload an arbitrary joblib/pickle file from users: loading untrusted
pickle is dangerous. Keep the ML estimate labeled experimental.

## Public release blocker checklist

- Add a distributed rate limiter for login, assistant and uploads
- Harden auth (secure HttpOnly cookies, refresh/revocation, CSRF defenses)
- Add password reset, email verification, account export/deletion policies
- Pen-test API authorization and uploaded FIT/GPX/TCX parsing
- Test restoration of database backups and TLS certificate renewal
- Review geographic track privacy/retention and athlete consent
- Add monitoring, data retention, security alerts and abuse prevention
- Test on real browsers, devices and production-sized activity libraries

The sample deployment should not hold sensitive real athlete data until
these controls are implemented and reviewed.
