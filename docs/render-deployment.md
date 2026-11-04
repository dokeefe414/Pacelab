# Optional Render-managed private backend

**Status: infrastructure code only. No hosted backend or billing has
been activated through this repository.** The public GitHub Pages demo at
https://dokeefe414.github.io/Pacelab/ continues to run independently.

The optional Render Blueprint prepares one Docker FastAPI service and one
managed PostgreSQL database for a private beta.

## Set up deliberately

1. Review [render.yaml](../render.yaml), the exact service plans, Render's
   current recurring prices and the privacy implications of storing GPS.
2. Sign into your own Render account and choose New → Blueprint.
3. Connect the GitHub repository `dokeefe414/Pacelab`; review the proposed
   resources and costs and explicitly approve resource creation.
4. Render generates the server-side JWT signing secret and injects the
   managed DB connection string, without committing secrets into GitHub.
5. Wait for an actual deployment success and confirm the assigned host by
   visiting `https://YOUR-ASSIGNED-HOST.onrender.com/api/ready`.
   This URL is a placeholder, not a claimed live endpoint.
6. Production public signup remains disabled by default. Provision beta
   accounts from a trusted operator console with
   `python -m app.create_user` after migrations.
7. Open PaceLab's Pages demo account dialog, enter the actual HTTPS
   API hostname ending with `/api`, and sign into the private account.

## How the two frontends differ

The Pages demo is a public static frontend with synthetic data, local
manual workout logging, formula race equivalents and offline stats.

The Render backend, once intentionally created, provides authenticated
private data persistence and FIT/GPX/TCX/ZIP imports. Nothing changes to
the public Pages site until a visitor chooses a trusted API address.

CORS permits the official Pages origin by default. CORS is not a substitute
for authentication or account ownership checks.

## Verification

```bash
curl -fsS https://YOUR-ASSIGNED-HOST.onrender.com/api/health
curl -fsS https://YOUR-ASSIGNED-HOST.onrender.com/api/ready
```

Confirm that both return successful JSON and that an unauthorized
request to `/api/workouts` returns 401. Then test login, password rotation,
revocation, FIT dedupe and account deletion using *synthetic* activities
before collecting anyone's GPS tracks.

## Security and cost boundaries

- Render may charge for ongoing web and PostgreSQL services. No charge is
  authorized by adding source files.
- The managed Postgres service needs provider-specific encrypted backups,
  retention and restore rehearsals; local Docker backup scripts do not
  automatically back up Render Postgres.
- Account registration remains private beta only. Login throttling is
  currently process-local, not an independently audited distributed shield.
- Account tokens can be invalidated across devices. Browser tokens are
  still stored in sessionStorage, not secure HttpOnly cookie sessions.
- An external LLM is disabled by default. Obtain informed consent and
  publish a privacy notice before enabling external transmissions.
- A production public launch requires stronger abuse monitoring, recovery,
  security review and a tested deletion/retention policy.

See [SECURITY.md](../SECURITY.md), [ops](privacy-and-operations.md) and
[Render Blueprint specification](https://render.com/docs/blueprint-spec).
