# Make PaceLab a working browser link

## v0.8 update: real files work in the public browser

The public site can now import **individual FIT, GPX or TCX running files**
without a login or server upload. This is done entirely with browser APIs:
raw bytes and GPS coordinates are discarded, and workout summaries plus
a maximum of 120 non-GPS sensor samples are saved to localStorage only
after explicit consent. Browser storage is not encrypted by PaceLab or
synchronized across devices. Use the private JSON backup/restore controls.

ZIP bulk upload, authenticated server account management and private
database persistence still require the separately hosted API.
See [the browser-import guide](browser-import.md) for format-specific limits,
privacy implications and tested compatibility.

## Current publishing setup: main branch, root directory

**Status: deployed successfully.** The November 4, 2026 GitHub Pages branch deployment completed successfully. PaceLab's frontend uses browser-supported JavaScript modules with relative imports and is served from the repository root.

1. Open [Settings → Pages](https://github.com/dokeefe414/Pacelab/settings/pages).
2. Under **Build and deployment**, set **Source → Deploy from a branch**.
3. Set **Branch: main**, **Folder: /(root)** and click **Save**.
4. Open the **published website:** [PaceLab browser demo](https://dokeefe414.github.io/Pacelab/).

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

## Capabilities and privacy

No downloads or installations are needed for visitors to use the **demo**.
Signed-in account features, secure workout persistence, raw COROS imports
and trained ML inference need a separately hosted HTTPS backend and database.
The static site should not ask visitors to enter a password for an unavailable
backend. No original COROS files or personal GPS routes are included in Pages.
