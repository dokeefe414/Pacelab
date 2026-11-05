# PaceLab — production beta release gates

**This is a release checklist, not a claim of a live secure backend.**
GitHub Pages hosts the browser-local app; optional Render service creation
requires explicit account-owner approval of cloud resources and billing.

## Cloud operations
- [ ] Choose an operator-controlled provider; review recurring charges.
- [ ] Approve service/managed database creation and document the deployment.
- [ ] Provision secrets outside GitHub; run Alembic migrations.
- [ ] Confirm HTTPS, DNS, CORS, firewall and `/api/ready`.
- [ ] Keep public account signup disabled during closed beta.

## Athlete privacy and account safety
- [ ] User consent and a written GPS/heart-rate/retention privacy notice.
- [ ] Owner-scoped authorization tests for every personal endpoint.
- [ ] Review malicious ZIP/FIT/XML inputs, size limits and abuse prevention.
- [ ] Centralized rate limits, session lifecycle and password recovery.
- [ ] Independently review browser session storage and external AI opt-in.
- [ ] Encrypt backups, schedule them, and test restore + deletion retention.

## Service reliability
- [ ] Monitor API health and database readiness with actionable alerts.
- [ ] Test server crash and database outage handling.
- [ ] Test deployment rollback including potentially irreversible migrations.
- [ ] Run `deploy/verify-public.sh` against the actual approved HTTPS host.
- [ ] Obtain owner sign-off before accepting real athlete GPS imports.

## Research integrity
- [ ] Gather permissioned genuine race labels and check data completeness.
- [ ] Ensure training features come from strictly earlier dates.
- [ ] Report chronological held-out error and compare simple baselines.
- [ ] Use athlete-disjoint evaluation for across-runner generalization claims.
- [ ] Publish per-event held-out sample sizes; suppress tiny-cohort MAE.
- [ ] Report empirical interval coverage and its statistical uncertainty.
- [ ] Inspect training-range feature drift without selecting on test results.
- [ ] Never claim a synthetic fixture validates personalized forecasts.

## Sign-off evidence

Record reviewer, date, links to release CI, actual deployment smoke tests,
backup restore proof, security assessment and rollback plan. All unchecked
items are **outstanding**—green code tests are not a penetration test or
a hosted production launch.

Track hosting in [GitHub issue #23](https://github.com/dokeefe414/Pacelab/issues/23).
Read the [Render runbook](render-deployment.md) and
[security policy](../SECURITY.md).
