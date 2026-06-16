# Sprint 85 Tasks — Cloud Accounts (native **client** slice)

Status source of truth, but only when it agrees with code. Do not pre-tick (see `spec-driven-sprint`
skill, Discrepancy Detection). Backend tasks live in `ritemark-cloud/.../sprint-01-account-service/tasks.md`.

## Phase 0: Gates (BLOCKS client code)
- [ ] Jarmo approved this client sprint plan (Phase 2→3 gate).
- [ ] D1 locked (done — parent register/decision). D2–D7 are backend decisions, owned by the cloud sprint.
- [ ] Architecture Gate: backend Architecture Proposal signed off in the `ritemark-cloud` spec; this
      repo's gate item is the `architecture.md` Layer 0 pointer (Phase 2 below).
- [ ] Dependency note: the account service must be reachable (staging) to E2E-test the client.

## Phase 1: Client Account slice (R8)
- [ ] Device-flow client in the extension host; device token in `SecretStorage`; access-JWT exchange + refresh.
- [ ] Settings "Account" section (shadcn `ui/`, `account:*` bridge messages following `webview/src/bridge.ts`).
- [ ] Sign-out clears SecretStorage + best-effort server revoke.
- [ ] Signed-out / offline / error states. No stubbing of the Settings page.

## Phase 2: Architecture doc (Gate close, this repo)
- [ ] Add the Layer 0 backend **pointer** to `docs/development/architecture.md`; `Last updated` ≥ branch date.

## Phase 3: QA and Closeout
- [ ] Client tests (device-flow happy path mocked, SecretStorage, JWT refresh failure → re-sign-in, Settings states).
- [ ] `./scripts/validate-qa.sh` (native client changes).
- [ ] Manual QA: walk [scenarios.md](scenarios.md) — coordinate the shared **"Revoke kills the app
      session"** E2E test with the cloud account-service sprint (needs the live backend).
- [ ] Update `docs/development/architecture.md`, this repo's release-plan tracker, and the cross-repo register.
- [ ] Update linked GitHub issues / milestone `v1.9.0`.
- [ ] Commit and push; PR review via `pr-reviewer`.

## Manual QA Matrix
Refers back to [scenarios.md](scenarios.md) — do not duplicate. Each scenario gets a pass/fail mark at Phase 3.
