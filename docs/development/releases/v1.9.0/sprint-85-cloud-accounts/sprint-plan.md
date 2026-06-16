# Sprint 85 — Cloud Accounts (native **client** slice)

Track: **SDD**
Branch: `sprint-85-cloud-accounts`
Status: **Phase 2 (PLAN)** — awaiting Jarmo plan approval. No client implementation code until approved.
Repo: `ritemark-native` (this repo). Cross-repo release: **v1.9.0 Cloud Accounts**.

> **Scope (post governance migration, 2026-06-16):** This sprint builds **only the client slice** in
> `ritemark-native` — the Settings "Account" section, the device-flow client, and `SecretStorage`
> token handling. The **account service backend** is a separate repo-scoped sprint in `ritemark-cloud`
> (`sprint-01-account-service`). The two are coordinated by the cross-repo register:
> `ritemark-dev/releases/v1.9.0/release-register.md`. (Folder keeps the name `sprint-85-cloud-accounts`
> to match the branch and the in-repo DLC gate; it is the native client slice of the cloud-accounts
> release.)

## SDD Artifacts (this repo / client slice)

- [spec.md](spec.md) — client behaviour contract (R8 Account section + device-flow client) + the
  architectural pointer to the backend.
- [scenarios.md](scenarios.md) — client BDD examples + the shared revoke-kills-session E2E exit test.
- [technical-plan.md](technical-plan.md) — client workstreams (device-flow client, Settings section,
  architecture-doc update).
- [tasks.md](tasks.md) — client implementation checklist.

> Backend SDD (service, auth, data model, device-flow endpoints, accounts web page) lives in
> `ritemark-cloud/docs/development/releases/v1.9.0/sprint-01-account-service/`. The repo-placement
> decision (D1) is locked in `ritemark-dev/decisions/D1-backend-repo-placement.md`.

## Goal

Ritemark desktop can sign in to Ritemark Cloud end-to-end: device flow → long-lived revocable device
token in `SecretStorage` → short-TTL access JWTs → and it loses access when the device is revoked.
The Settings "Account" section proves the loop. Ships dark.

## MVP Scope (client)

- **Device-flow client** in the extension host: request device code, open browser to sign-in +
  approval, poll, store the device token in `SecretStorage`, exchange/refresh access JWTs. Follows the
  outbound-HTTPS pattern in `src/update/githubClient.ts`.
- **Settings "Account" section**: signed-out → "Sign in to Ritemark Cloud"; signed-in → identity +
  device status + sign-out. Uses existing shadcn `ui/` components and `account:*` bridge messages
  following `webview/src/bridge.ts`. **No stubbing of the Settings page** (HARD RULE #1).
- **Architecture doc**: add the Layer 0 backend **pointer** to `docs/development/architecture.md`.

## Out of scope (this repo / sprint)

The account service and everything backend (→ `ritemark-cloud` account-service sprint). Billing,
sharing UI, publish endpoints (later releases).

## Dependency

Consumes `ritemark-cloud`'s account service (the device flow talks to the live backend). The client
**cannot be E2E-tested until the service is deployed** — coordinate via the register; the shared
"revoke kills the app session" test needs both repos' code.

## Approval

- [ ] Jarmo approved this (client) sprint plan (Phase 2→3 gate).
- [ ] Architecture Gate: the backend Architecture Proposal lives in the `ritemark-cloud` spec; this
      repo's gate item is the `architecture.md` Layer 0 pointer.
