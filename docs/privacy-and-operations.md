# PaceLab privacy and operations

**Engineering beta only. Not a completed independent security audit.**

PaceLab stores athlete workout duration, distance and notes. Imported files
can add private GPS, heart rate, cadence, power, elevation and split information.
Even reduced GPS samples may disclose someone's home or commute.

The account owner can export their data in JSON or permanently delete their
account from the live database. Old backups may continue to retain copies
until your retention window expires. Do not claim a deletion instantly
scrubs all possible backups.

## Browser-local imports: a distinct privacy boundary

The public GitHub Pages app can process single FIT/GPX/TCX files entirely
within the user's browser. It discards raw input bytes and does **not**
store latitude or longitude in localStorage. The user explicitly accepts
storage of activity summaries and up to 120 sensor samples on that device.

Browser localStorage is not encrypted by PaceLab, does not synchronize
between devices, and is not a durable backup. Full JSON backup downloads
include sensor readings and should be stored securely; clearing site data
or using private-browsing mode can erase imported workouts. No network
request is made by this local import path. [Technical details](browser-import.md).

## Active protections

- User-scoped workout authorization and Argon2 password hashing.
- Short-lived JWT bearer tokens; registration disabled by default in
  production. JWT generation numbers now support global token revocation
  after password change/sign-out. The browser still uses tab-local
  sessionStorage rather than hardened HttpOnly cookie sessions.
- Per-process request limits, redacted JSON request logging, request IDs,
  cache controls, file-size limits and hardened ZIP/XML parsing.
- Liveness at /api/health and database readiness at /api/ready.
- Original FIT, GPX and TCX uploads processed in memory; only bounded
  downsampled track data retained. Bulk exports are not extracted to disk.
- Optional external language model disabled by default. The opt-in provider
  receives an athlete question and aggregate stats, not original routes.

## Backups

Run from the deployed server's repo root, with a running production Compose
stack, as the authorized operator. Store backups **outside** this repository
on encrypted, access-restricted storage.

~~~bash
bash deploy/backup-postgres.sh /secure/pacelab-backups/2026-11-04.dump
bash deploy/test-restore-postgres.sh /secure/pacelab-backups/2026-11-04.dump
~~~

The first creates a custom-format PostgreSQL archive and checks it is readable.
The second restores into a throwaway database, validates that public tables
exist and cleans up the temporary database. **Neither script intentionally
overwrites or drops the live database.** Run backups regularly using a scheduler
you control, test restores, rotate off-site encrypted copies, and apply a
clearly communicated deletion/retention policy. These scripts alone do not
provide automated retention, scheduling or offsite recovery.

## Required before a real public launch

Centralized rate limits across workers, secure session revocation/refresh,
account verification and recovery, consent UX, access reviews, privacy/legal
policies, penetration testing of the upload and ZIP stack, and alerting.
Monitor backup failures and periodically rehearse restore procedures.
Use HTTPS, a secret manager, least-privilege database credentials and verified
production DNS. Do not include personal FIT files in public test fixtures.

The GitHub Pages demo is frontend-only with synthetic data. It has no
authenticated backend unless separately configured and hosted.


## Consent, data-use and account actions (v0.7)

Before a COROS import, PaceLab asks for affirmative acknowledgment that
sampling GPS data can retain sensitive coordinates and timestamps in the
private account. Canceling the dialog sends **no activity file**.

The assistant answers locally from verified statistics by default.
Only if the user opts into **one external AI question** may the server
transmit that question and aggregate metrics to its configured provider.
Raw route points, notes and account email are intentionally excluded.

Signing out through the server or changing an account password revokes
all previously issued tokens across devices via an account generation
counter. In a network failure, clearing the browser token does **not**
prove the server revoked every token; token expiry remains 60 minutes.

For opt-in managed hosting, review the Render costs and managed database
backup policy before creation. Cloud provider backups must be explicitly
accounted for in retention/deletion policy. Adding render.yaml does not
activate any infrastructure.
