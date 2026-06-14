# Sprint 85 Spec — Cloud Accounts (Foundation)

> This spec **doubles as the Architecture Proposal** for the new backend Layer 0 (see §Architecture Proposal). Jarmo's sign-off here clears the Sprint Architecture Gate.

## Purpose

Stand up Ritemark Cloud's identity/account platform: a deployed account service plus a Ritemark desktop sign-in loop with revocable device tokens. This is the dependency floor for paid sharing (Sprint 87) and billing (Sprint 86) — built wider than sharing so future products (`sync`, team spaces) ride the same identity layer.

## Principles

- **Local editor stays free and unrestricted forever.** Cloud is additive; nothing local is paywalled or gated behind an account.
- **No passwords, ever.** Identity comes from OAuth + magic link only.
- **Revocability is a first-class feature**, not an afterthought — per-device tokens, kill-switch, account deletion from day one.
- **Entitlements are a product list, never a boolean.** `["sharing"]` today; `["sharing","sync"]` later.
- **Minimal dissemination / minimal data.** Store only what identity and billing require; design for GDPR from the first commit.

## Requirements

> Acceptance criteria marked **(gated: Dx)** depend on an external decision locked in [sprint-plan.md](sprint-plan.md). They become concrete once that decision is fixed.

### R1: Operated account service

As the Ritemark team, I want a deployed, observable backend so the account loop runs in staging and prod, not just locally.

Acceptance criteria:
- Service deploys to **staging and prod** via CI (wrangler). (gated: D4)
- Structured request logging and basic alerting (error rate, 5xx) are live on both environments.
- A health endpoint returns service + DB connectivity status.
- Secrets (OAuth client secrets, JWT signing key, email API key) come from environment/secret bindings, never committed.

### R2: Platform data model

As the platform, I want a schema that serves identity now and billing/products later.

Acceptance criteria:
- Tables exist: `users`, `oauth_identities`, `devices`, `subscriptions`, `audit_log`.
- `devices` carries a per-device revocable token reference, created-at, last-seen, and a revoked-at column.
- `subscriptions` carries provider customer id, product, status, current-period-end — shape compatible with the chosen billing provider. (gated: D7)
- `audit_log` records security-relevant events (sign-in, device-create, device-revoke, account-delete).
- Schema migrations are versioned and runnable in CI.

### R3: Authentication (no passwords)

As a user, I want to sign in with GitHub or an email link so I never create or store a password.

Acceptance criteria:
- GitHub OAuth sign-in creates/links a `users` row + `oauth_identities` row. (gated: D2, D3)
- Email magic-link sign-in works via the chosen email provider. (gated: D5)
- No password field exists anywhere in the schema or code.
- Repeated sign-in with the same identity links to the existing user (no duplicate accounts).

### R4: Desktop device flow

As a Ritemark desktop user, I want to authorize the app once and have it hold a revocable token.

Acceptance criteria:
- App initiates an RFC 8628-style device flow against our service: requests a device code, opens the browser to sign-in + device approval.
- App polls and, on approval, receives a **long-lived revocable device token** stored in VS Code `SecretStorage`.
- The device token is exchanged for **short-TTL (~15 min) access JWTs** carrying the user id + entitlement list.
- Access JWT expiry triggers a silent refresh using the device token; failure surfaces a re-sign-in prompt.
- No tokens are written to disk outside `SecretStorage` or logged.

### R5: Device revocation (the headline exit test)

As a user, I want to revoke a device from the web and have that app immediately lose access.

Acceptance criteria:
- The accounts web page lists the user's devices (label, last-seen) and offers per-device **Revoke** and **Revoke all**.
- After revocation, the device token can no longer mint access JWTs.
- The app session dies within one access-JWT TTL (≤15 min) and shows a re-sign-in state.
- Revocation is recorded in `audit_log`.

### R6: Account deletion (GDPR Art. 17)

As a user, I want to delete my account and associated personal data.

Acceptance criteria:
- The accounts web page offers account deletion with an explicit confirm.
- Deletion removes `users`, `oauth_identities`, `devices` rows and anonymizes/removes personal data in `audit_log` per retention policy.
- After deletion, all that user's device tokens are invalid and sign-in starts fresh.
- The deletion path is documented for the privacy policy.

### R7: Entitlement model (token-carried, enforced later)

As the platform, I want entitlements derived from subscriptions and carried in the access token so future paid endpoints check one place.

Acceptance criteria:
- Access JWT contains an `entitlements` array derived from active `subscriptions` rows.
- With no subscription, `entitlements` is empty (no product access) — and that is the expected state this sprint (billing ships in Sprint 86).
- A reusable server-side entitlement check (middleware shape) is defined and unit-tested against a fake subscription, even though no real provider writes subscriptions yet.

### R8: Client Account section in Settings

As a user, I want to see and manage my cloud sign-in inside Ritemark.

Acceptance criteria:
- Settings gains an "Account" section: signed-out shows "Sign in to Ritemark Cloud"; signed-in shows account identity + device status + sign-out.
- Sign-out clears the device token from `SecretStorage` and (best-effort) revokes the device server-side.
- The section uses existing shadcn `ui/` components (no custom HTML/CSS); no model IDs or product code paths regressed.
- The Settings page remains the full implementation (no stubbing — see CLAUDE.md HARD RULE #1).

## Non-Requirements

- Billing checkout, customer portal, webhook handling, entitlement *enforcement UI* (Sprint 86).
- Any publish/serve/share endpoint or sharing domain serving (Sprint 87).
- Share button, My Shares, or any document-sharing UI (Sprint 88).
- Apple sign-in, SSO, team accounts, sync.

## Architecture Proposal (Architecture Gate submission)

**New layer.** Ritemark gains a **Layer 0 backend service** independent of the VS Code build. It is reached only by the extension host over HTTPS; the webview never talks to it directly (extension host mediates, consistent with existing bridge boundaries).

**Repo placement (D1).** New repo `ritemark-cloud`, deployed independently. Rationale: backend deploys must not enter the ~25-min VS Code/Electron build pipeline, and the backend has a different release cadence, language runtime (Workers), and ops model. `ritemark-native` holds only the client slice (Settings Account section + device-flow client + token storage).

**Auth model (D2/D3).** OAuth (GitHub) + email magic link via a proven auth library (Better Auth recommended) on Workers. Desktop uses RFC 8628 device flow. Token lifecycle: long-lived **device token** (revocable, in `SecretStorage`) → short-TTL **access JWT** (~15 min, carries entitlements) via refresh. Signing key in secret binding; rotation plan documented.

**Infra (D4).** Cloudflare Workers + D1 (SQLite) for v1; R2 added in Sprint 87 for sharing. EU-native (Bunny/Hetzner) is a later migration only if "EU-hosted, no US parent" becomes a marketing pillar.

**Data flow (sign-in):** app → `POST /device/code` → browser sign-in + approve → app polls `POST /device/token` → device token → `POST /token` exchanges device token for access JWT → authenticated calls carry the JWT.

**Security boundaries:** no passwords; tokens never logged or written outside `SecretStorage`; per-device revocation + global kill-switch; strict CORS on the API; secrets via bindings; `audit_log` for security events.

**Impact on `docs/development/architecture.md`:** add the Layer 0 backend section (service, repo, data model, token lifecycle, client touch-points) as part of this sprint's definition of done. The `Last updated` date must be ≥ the sprint branch creation date.

## Resolved Questions

- *Free tier?* No. Paid-only, no anonymous publishing, no BYO publishing (Jarmo, 2026-06-12). This reverses the research doc's free-tier/BYO recommendation.
- *Boolean entitlement or product list?* Product list (R7), for forward compatibility.

## Open Questions

- Cross-repo sprint tracking under the DLC (see sprint-plan.md "Cross-Repo Tracking Question").
- Exact `audit_log` retention period vs GDPR minimization (decide during Phase 1 research).
- Whether the accounts web page lives in `ritemark-cloud` or a separate marketing site (lean: in `ritemark-cloud` for v1).
