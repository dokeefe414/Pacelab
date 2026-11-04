# PaceLab security policy

PaceLab has a **public synthetic-data demo** and a **self-hostable private-beta
backend**. The server has not undergone an independent security audit. Do not
open registration to the public or accept sensitive data from strangers until
the release checklist below is complete.

## Report a vulnerability

Use GitHub's **Security → Report a vulnerability** workflow if private
reporting is enabled. Otherwise, open a public issue **without including**
exploit steps, authentication tokens, private routes, sensitive filenames or
personal details, and request a private reporting channel. Do not test
another athlete's data or account without explicit authorization.

## Data handling

- FIT/GPX/TCX/ZIP uploads can include home locations, heart rate and timestamps.
- Original file bytes are parsed in memory and discarded. A bounded sample of
  coordinates and derived workout data **is retained** in the private account.
- JWT access tokens are browser session-scoped and short-lived. Token
  generation checks now support cross-device revocation on password change
  and sign-out. Per-device revocation, refresh and hardened cookie sessions
  are not implemented.
- Rate limits are process-local, not a distributed defense against abuse.
- The optional external language model is disabled by default. When enabled,
  a user question and aggregate stats leave PaceLab. Consent is needed.
- Account deletion removes current database rows; old backups may retain
  copies under the documented operator retention policy.
- Joblib models are trusted operator artifacts only. Untrusted pickle/joblib
  loading can run arbitrary code.

## Hardening gates before public accounts

- [ ] HTTPS verified and origin/firewall rules reviewed
- [ ] Credential rotation, least privilege and secrets management
- [ ] Distributed throttling, authentication abuse monitoring and token revocation
- [ ] Account verification, recovery and consent/privacy policy
- [ ] Independent upload-parser and account-authorization security review
- [ ] Encrypted automated backups with restore drills and retention enforcement
- [ ] Monitoring, alerts, data deletion process and incident response
- [ ] Real-user and mobile/browser regression testing

See [production runbook](deploy/README.md) and [privacy guidance](docs/privacy-and-operations.md).


## New v0.7 controls

- Auth tokens are bound to the issuing API URL in the browser.
- Server sign-out/password rotation invalidate all older tokens.
- External AI phrasing requires explicit per-question opt-in.
- GPS-bearing file imports require a positive privacy acknowledgment
  before any file request is transmitted.
- An opt-in Render hosting Blueprint exists as code. It is not a live
  server, a billing authorization or a completed security audit.
