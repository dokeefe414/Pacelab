## Purpose

What user or engineering problem does this solve?

## Implementation

What changed? What decisions or tradeoffs matter?

## Verification

- [ ] npm test and npm run build
- [ ] npm run test:e2e (if frontend changed)
- [ ] python -m pytest -q, migrations (if backend changed)
- [ ] Production Compose and read-only smoke check (if deployment changed)

## Privacy and research honesty

- [ ] No secrets, private FIT/GPX/TCX exports, GPS tracks or database backups
- [ ] Personal endpoints enforce account authorization
- [ ] Missing workout/sensor fields are not invented
- [ ] ML evaluation reports baselines, temporal splits and limitations
- [ ] Documentation and UI disclosures are current

## Deployment

Which of these changes: **static GitHub Pages demo**, **private backend**, or
**both**? Does it require an operator action or data migration?
