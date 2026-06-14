# Sprint 85 Technical Plan — Cloud Accounts

> Proposed shapes, not final code. Decision-dependent items are tagged (gated: Dx) per [sprint-plan.md](sprint-plan.md). Most code lands in the new `ritemark-cloud` repo; only Workstream 5 is in `ritemark-native`.

## Architecture Overview

```text
Ritemark desktop (ritemark-native)                Ritemark Cloud (ritemark-cloud, NEW)
┌───────────────────────────────┐                ┌──────────────────────────────────────┐
│ Settings webview (Account UI)  │                │ Hono on Cloudflare Workers             │
│        ↕ bridge                │   HTTPS        │  /device/code  /device/token  /token   │
│ Extension host                 │  ───────────▶ │  /auth/github  /auth/magic             │
│  device-flow client            │   (JWT)        │  /devices  /account (delete)           │
│  SecretStorage (device token)  │                │  D1: users, oauth_identities, devices, │
└───────────────────────────────┘                │      subscriptions, audit_log          │
        webview never calls cloud directly        └──────────────────────────────────────┘
```

The webview never talks to the cloud; the extension host mediates (consistent with existing bridge boundaries). Local editing has **zero** dependency on the cloud.

## Workstream 1: Backend service + ops (R1) — `ritemark-cloud`

- Scaffold Hono on Workers; `wrangler.toml` with staging + prod environments. (gated: D4)
- CI: deploy on merge, run migrations, smoke the health endpoint.
- Structured logging + alerting (error rate / 5xx). Secrets via bindings.
- Health endpoint reporting service + D1 connectivity.

## Workstream 2: Data model + migrations (R2) — `ritemark-cloud`

- Versioned D1 migrations for `users`, `oauth_identities`, `devices`, `subscriptions`, `audit_log`.
- `devices`: token ref (hashed), label, created_at, last_seen_at, revoked_at.
- `subscriptions`: provider_customer_id, product, status, current_period_end — schema matched to provider. (gated: D7)
- Audit helper writes security events from one place.

## Workstream 3: Auth + tokens (R3, R4, R7) — `ritemark-cloud`

- Integrate the chosen auth library; wire GitHub OAuth + email magic link. (gated: D2, D3, D5)
- RFC 8628 device endpoints: `/device/code`, `/device/token` (poll), `/token` (device→access JWT exchange).
- Access JWT: ~15 min TTL, signed with key from secret binding, carries `sub` + `entitlements[]` derived from active subscriptions.
- Reusable entitlement-check middleware (unit-tested against a fake subscription).

## Workstream 4: Accounts web page (R5, R6) — `ritemark-cloud`

- Minimal authenticated page: device list + per-device Revoke + Revoke all; account deletion with confirm.
- Revocation invalidates device token; deletion runs the GDPR Art. 17 path; both write `audit_log`.

## Workstream 5: Client Account slice (R8, consumes R4) — `ritemark-native`

- Device-flow client in the extension host (request code, open browser, poll, store token in `SecretStorage`, refresh JWT). Reference outbound-HTTPS pattern in `src/update/githubClient.ts`.
- Settings "Account" section via existing `RitemarkSettingsProvider` + shadcn `ui/` components; new `account:*` bridge message types following the existing `webview/src/bridge.ts` pattern.
- Sign-out clears `SecretStorage` + best-effort server revoke.
- **No stubbing of the existing Settings page** (CLAUDE.md HARD RULE #1).

## Workstream 6: Architecture doc update (Architecture Gate) — `ritemark-native`

- Add the Layer 0 backend section to `docs/development/architecture.md` (service, repo, data model, token lifecycle, client touch-points). `Last updated` ≥ branch creation date.

## Tests

- Backend unit tests: token exchange, JWT claims, entitlement middleware (fake subscription), revocation invalidation, account-deletion cascade.
- Auth integration: GitHub OAuth round-trip + magic-link issue/consume against provider sandbox.
- Client: device-flow happy path (mocked service), SecretStorage read/write, signed-out/offline Settings states.
- Manual QA: the [scenarios.md](scenarios.md) matrix, especially the revoke-kills-session exit test.

## Cross-repo note

`ritemark-cloud` PRs are tracked from this sprint's tracker rows in the release plan. Resolve the cross-repo DLC tracking question (sprint-plan.md) before Phase 3.
