# Publish PaceLab as a click-to-open browser demo

The static PaceLab frontend is already built with Vite and can be served
for free using GitHub Pages. No software installation is necessary to open
the published demo.

## Enable once (repository owner)

1. Open [PaceLab → Settings → Pages](https://github.com/dokeefe414/Pacelab/settings/pages).
2. Under **Build and deployment**, choose **GitHub Actions** as the Source.
3. Open [Actions → Deploy static demo to GitHub Pages](https://github.com/dokeefe414/Pacelab/actions/workflows/pages-demo.yml).
4. Select **Run workflow** on the `main` branch.
5. Wait for GitHub Actions to report successful deployment. Use the URL it displays.

The *expected* GitHub Pages address for this repository is
`https://dokeefe414.github.io/Pacelab/`, but do not share it as a
working live link until the workflow successfully publishes and the
address responds. When enabled, new frontend changes merged into `main`
are deployed automatically by the existing workflow.

## What the public demo can and cannot do

**Works without a backend:** Synthetic running log, manual local training
entry, charts, race-equivalence formula, and local deterministic assistant.

**Requires hosted server:** Private login, cloud workout persistence,
FIT/GPX/TCX/ZIP imports, real personalized ML inference, and optional
provider-backed assistant. All such features remain under your control
and must not be represented as publicly hosted by this Pages demo.

Pages publishes only the Vite `dist/` artifact. No raw private COROS FIT
files, GPS routes, PostgreSQL databases, tokens, or secrets are included.

## Troubleshooting

- A deployment failure mentioning an unavailable Pages site usually
  means Settings → Pages has not been configured for GitHub Actions yet.
- If the link shows 404, check the deployment workflow and the repository
  Pages settings; repository URLs are case-sensitive.
- If the demo looks stale, reload after the deployment completes.
- If private account sign-in is unavailable, that's expected on the
  static Pages deployment unless you configure a separate HTTPS API.

The full private-beta backend can be deployed independently later after
the security checklist in `deploy/README.md`.
