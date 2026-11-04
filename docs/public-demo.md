# Optional browser demo for your portfolio

PaceLab can host its **frontend-only demo** on GitHub Pages without
deploying private athlete data or a live server.

1. Open this repository's **Settings → Pages**.
2. Select **GitHub Actions** as the Pages build/deployment source.
3. Open **Actions → Deploy static demo to GitHub Pages → Run workflow**.
4. A successful workflow shows the published demo URL.

The Pages demo starts with **synthetic workouts**. Visitors can use the
local dashboard, log workouts and calculate formula race equivalents.
Browser-only deterministic questions can be answered from synthetic or locally logged workouts. Server-backed FIT/GPX/TCX imports, account login, and externally powered LLM explanations require a separately hosted backend and **will not work** on a static-only demo.
Do not misrepresent the static demo as a public full-stack release.
