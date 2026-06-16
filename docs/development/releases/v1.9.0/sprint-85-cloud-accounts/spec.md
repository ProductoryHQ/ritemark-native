# Sprint 85 Spec — Cloud Accounts (native **client** slice)

> Client slice only. The backend spec + Architecture Proposal live in
> `ritemark-cloud/docs/development/releases/v1.9.0/sprint-01-account-service/spec.md`. Repo placement
> (D1) is locked in `ritemark-dev/decisions/D1-backend-repo-placement.md`.

## Purpose

Give Ritemark desktop a sign-in loop to Ritemark Cloud: authorize the app once via device flow, hold a
revocable device token in `SecretStorage`, exchange it for short-TTL access JWTs, and surface account
state + sign-out in Settings. Local editing stays free and has zero dependency on the cloud.

## Principles

- **Local editor stays free and unrestricted forever.** The Account section is additive; nothing local
  is paywalled or gated behind sign-in.
- **No tokens on disk outside `SecretStorage`; never logged.**
- **No stubbing the Settings page** (CLAUDE.md HARD RULE #1).

## Requirements (client)

### R8: Client Account section + device-flow client
As a user, I want to sign in to Ritemark Cloud from inside Ritemark and manage that session.

Acceptance criteria:
- The extension host runs an RFC 8628 device-flow client against the account service: requests a
  device code, opens the browser to sign-in + approval, polls `/device/token`, and stores the returned
  **long-lived revocable device token** in VS Code `SecretStorage`.
- The device token is exchanged for **short-TTL (~15 min) access JWTs** via `/token`; expiry triggers a
  silent refresh; refresh failure (e.g. device revoked) surfaces a re-sign-in state.
- Settings gains an **"Account" section**: signed-out shows "Sign in to Ritemark Cloud"; signed-in
  shows identity + device status + **Sign out**.
- **Sign out** clears the device token from `SecretStorage` and best-effort revokes the device server-side.
- The section uses existing shadcn `ui/` components (no custom HTML/CSS) and new `account:*` bridge
  message types following the `webview/src/bridge.ts` pattern. No model IDs or product code paths regress.
- No tokens are written to disk outside `SecretStorage` or logged.

## Non-requirements (client)

- The account **service** itself, auth endpoints, data model, accounts web page, revocation server side,
  GDPR deletion logic — all in `ritemark-cloud`.
- Billing/entitlement enforcement UI, sharing UI (later releases).

## Architecture touch-points (client)

The client codes against `ritemark-cloud/CONTRACT.md` (device-flow endpoints, access-JWT claims,
entitlement list) and must stay **version-skew tolerant** — the desktop app and backend never deploy
atomically. The webview never talks to the cloud; the extension host mediates over HTTPS.

**Gate item for this repo:** add the **Layer 0 backend pointer** to `docs/development/architecture.md`
(what the layer is, that it lives in `ritemark-cloud`, and the client touch-points). `Last updated`
≥ branch creation date.

## Resolved / open

- *Free tier?* No (Jarmo, 2026-06-12). Does not affect the client loop this sprint.
- *Where does the accounts web page live?* In `ritemark-cloud` (backend concern), not here.
