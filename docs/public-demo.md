# Make PaceLab a working browser link

## Recommended: publish directly from main (no build workflow)

GitHub Actions deployment has been queued without publishing the site.
PaceLab's frontend uses browser-supported JavaScript modules with relative
imports and can be served directly from the repository root.

1. Open [Settings → Pages](https://github.com/dokeefe414/Pacelab/settings/pages).
2. Under **Build and deployment**, set **Source → Deploy from a branch**.
3. Set **Branch: main**, **Folder: /(root)** and click **Save**.
4. Once GitHub reports the Pages site is published, open
   **https://dokeefe414.github.io/Pacelab/**.

The repository includes `.nojekyll` to serve the HTML, CSS and JavaScript
files directly, with no npm build required. This is a **static demonstration
only**, using synthetic workouts, browser-local storage, and a local
statistics assistant. The full FastAPI/Postgres service is not deployed.

## If the link still gives 404

- Confirm the **Source** actually shows `Deploy from a branch`, not
  `GitHub Actions`, and the selected folder is `/(root)`.
- Confirm the repository is **public**, and that GitHub Pages now shows
  a **Visit site** link and a successful deployment.
- If Pages displays an error or a pending approval, follow its exact
  message. A queued GitHub Actions job is not proof of a published site.
- Confirm the address is `/Pacelab/` (matching the repository name).
- If you just enabled Pages, refresh after publication completes. A site
  remains unavailable until GitHub has finished publishing it.

## Optional: built artifact through Actions

The repository also has a workflow under
[Actions → Deploy static demo to GitHub Pages](https://github.com/dokeefe414/Pacelab/actions/workflows/pages-demo.yml).
That approach requires **Source: GitHub Actions**, a successful workflow
run and available Actions workers. If all actions remain queued, use
the recommended branch route instead.

## Capabilities and privacy

No downloads or installations are needed for visitors to use the **demo**.
Signed-in account features, secure workout persistence, raw COROS imports
and trained ML inference need a separately hosted HTTPS backend and database.
The static site should not ask visitors to enter a password for an unavailable
backend. No original COROS files or personal GPS routes are included in Pages.
