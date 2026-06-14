# Sprint 85 Tasks — Cloud Accounts

Status source of truth, but only when it agrees with code. Do not pre-tick (see `spec-driven-sprint` skill, Discrepancy Detection). Tasks are physical artefacts, not goals.

## Phase 0: Gates (BLOCKS all code)
- [ ] Jarmo approved the sprint plan (Phase 2→3 gate).
- [ ] Decisions D1–D7 locked in [sprint-plan.md](sprint-plan.md) (D8–D9 may defer).
- [ ] Architecture Gate: Jarmo signed off on `spec.md` as the Architecture Proposal.
- [ ] Cross-repo DLC tracking question resolved.
- [ ] External setup done by Jarmo: GitHub OAuth app registered; `ritemark.site` acquired; billing account created; `abuse@…` mailbox; email provider confirmed.
- [ ] Create `ritemark-cloud` repo (D1) and the sprint branch in `ritemark-native` is `sprint-85-cloud-accounts`.

## Phase 1: Research (audit-first for risk)
- [ ] Confirm chosen auth library covers GitHub OAuth + magic link + device-flow on Workers; capture findings in `research/`.
- [ ] Decide `audit_log` retention vs GDPR minimization; record in spec Resolved Questions.
- [ ] Verify `subscriptions` schema matches the chosen billing provider's model (D7).

## Phase 2: Backend service + ops (R1)
- [ ] Scaffold Hono on Workers; `wrangler.toml` staging + prod.
- [ ] CI: deploy on merge, run migrations, smoke health endpoint.
- [ ] Structured logging + error/5xx alerting on both environments.
- [ ] Health endpoint (service + D1 connectivity).

## Phase 3: Data model (R2)
- [ ] Versioned D1 migrations: `users`, `oauth_identities`, `devices`, `subscriptions`, `audit_log`.
- [ ] Audit helper for security events.

## Phase 4: Auth + tokens (R3, R4, R7)
- [ ] GitHub OAuth sign-in → user + oauth_identity (link on repeat).
- [ ] Email magic-link sign-in (issue + consume; reject expired/used).
- [ ] Device flow: `/device/code`, `/device/token` poll, `/token` exchange.
- [ ] Access JWT (~15 min) with `entitlements[]`; silent refresh from device token.
- [ ] Entitlement-check middleware + unit test against a fake subscription.

## Phase 5: Accounts web page (R5, R6)
- [ ] Authenticated page: device list, per-device Revoke, Revoke all.
- [ ] Revocation invalidates device token; writes audit_log.
- [ ] Account deletion (GDPR Art. 17) with confirm; cascade + anonymize.

## Phase 6: Client Account slice (R8) — `ritemark-native`
- [ ] Device-flow client in extension host; token in `SecretStorage`; JWT refresh.
- [ ] Settings "Account" section (shadcn `ui/`, `account:*` bridge messages).
- [ ] Sign-out clears SecretStorage + best-effort server revoke.
- [ ] Signed-out / offline / error states.

## Phase 7: Architecture doc (Gate close)
- [ ] Add Layer 0 backend section to `docs/development/architecture.md`; `Last updated` ≥ branch date.

## Phase 8: QA and Closeout
- [ ] Backend unit tests (token exchange, JWT claims, entitlement middleware, revocation, deletion cascade).
- [ ] Auth integration tests against provider sandbox.
- [ ] Client tests (device-flow happy path, SecretStorage, Settings states).
- [ ] Manual QA: walk the [scenarios.md](scenarios.md) matrix — **especially "Revoke kills the app session"** (the exit test).
- [ ] Run `./scripts/validate-qa.sh` (ritemark-native client changes).
- [ ] Update `docs/development/architecture.md`, release-plan tracker, and any user docs (account sign-in) if behavior is user-visible.
- [ ] Update linked GitHub issues / milestone `v1.9.0`.
- [ ] Commit and push; PR review via `pr-reviewer`.

## Manual QA Matrix
Refers back to [scenarios.md](scenarios.md) — do not duplicate. Each scenario gets a pass/fail mark at Phase 8.
