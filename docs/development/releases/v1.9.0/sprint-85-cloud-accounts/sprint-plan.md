# Sprint 85 — Cloud Accounts (Foundation)

Track: **SDD** (auto-detected: multi-component backend + auth/security edge cases + new architectural layer)
Branch: `sprint-85-cloud-accounts`
Status: **Phase 2 (PLAN)** — awaiting Jarmo plan approval **and** the external-decision lock below. No implementation code until both clear.
Parent release: [`../release-plan.md`](../release-plan.md) — v1.9.0 Cloud Sharing
Strategy source: `docs/development/analysis/2026-06-12-cloud-sharing-sprint-plan.md` (Plan of Record, rev. 2) + `…-cloud-sharing-strategies.md` (research)

> **Numbering note:** the strategy Plan of Record calls this sprint "Sprint 83 — cloud-accounts". After Sprint 84 became the DLC rollout, the cloud sequence was renumbered: accounts **85** → billing **86** → share-backend **87** → client-launch **88**. This folder uses the release-plan numbering.

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract **+ Architecture Proposal** (this sprint's spec doubles as the Architecture Gate submission).
- [scenarios.md](scenarios.md) — BDD behaviour examples (becomes the manual QA matrix).
- [technical-plan.md](technical-plan.md) — architecture and workstreams.
- [tasks.md](tasks.md) — implementation checklist.

## Goal

A deployed, operated Ritemark Cloud **account service**, and a Ritemark desktop that can sign in end-to-end, hold a revocable device token, and lose access when the device is revoked. Ships **dark** (no user-facing launch). No publishing or billing yet — this is the platform other cloud sprints ride on.

## Why first / dependency rationale

Jarmo's strategic decisions (2026-06-12) — **no free tier, no anonymous publishing, no BYO publishing** — mean entitlement checks must exist *before* any share endpoint. So the account/identity layer is built first, and is designed **wider than sharing**: entitlements are a list of products (`sharing`, later `sync`, …), never a boolean.

## MVP Scope (workstream-level; full contract in spec.md)

- **Backend repo + service:** new repo (`ritemark-cloud` proposed), Hono on Cloudflare Workers + D1, deployed to staging + prod with CI.
- **Data model (platform-wide):** `users`, `oauth_identities`, `devices` (revocable per-device tokens), `subscriptions` (provider customer id, product, status, period end), `audit_log`. Entitlements derived from subscriptions, carried in short-TTL (~15 min) access JWTs.
- **Auth:** GitHub OAuth + email magic link; **no passwords stored, ever**.
- **Desktop device flow** (RFC 8628 against our own service): device code → browser sign-in + approval → app polls → long-lived revocable device token in `SecretStorage` → exchanged for short-lived access JWTs.
- **Accounts web page (minimal):** sign-in, device approval, device list/revoke, **account deletion (GDPR Art. 17) from day one**.
- **Client slice:** "Account" section in Ritemark Settings (sign in/out, device status) — proves the loop E2E.
- **Ops baseline:** staging + prod, wrangler CI deploy, structured logging, alerting.

## Out of scope (this sprint)

Billing/checkout/entitlement enforcement UI (→ Sprint 86), any publish/share endpoint (→ Sprint 87), share client UI (→ Sprint 88). The `subscriptions` table exists but is not yet written to by a billing provider.

## Architecture Gate (HARD — blocks Phase 3)

This initiative adds a new **backend Layer 0** that `docs/development/architecture.md` does not describe. Per the `architectural-design` skill, this triggers the Sprint Architecture Gate. **`spec.md` doubles as the Architecture Proposal** (auth model, repo placement, data model, infra choice, token lifecycle). Jarmo's sign-off on `spec.md` **is** the gate approval; `architecture.md` gains the new layer as part of this sprint's definition of done.

## Decisions needed before Phase 3 (consolidated — gates implementation)

These were scattered across the two analysis docs + the release-plan prerequisites; consolidated here with the strategy's recommendation. **Each needs Jarmo's lock (confirm recommendation or override) before any code.**

| # | Decision | Strategy recommendation | Status |
|---|---|---|---|
| D1 | Backend repo | New repo `ritemark-cloud` (keeps backend out of the VS Code build pipeline) | ☐ open |
| D2 | Auth stack | Better Auth, self-hosted on Workers (control, EU story, $0) vs Clerk (managed, faster) | ☐ open |
| D3 | Identity providers | GitHub OAuth + email magic link (Apple sign-in deferred) | ☐ open |
| D4 | Infra | Cloudflare Workers + D1 (+ R2 later for sharing) | ☐ open |
| D5 | Email provider | Resend or Scaleway TEM (EU) | ☐ open |
| D6 | Sharing domain | `ritemark.site` (cookie-less, separate from app/update-feed domain) — register now even though serving lands in Sprint 87 | ☐ open |
| D7 | Billing provider (forward dep) | Paddle as Merchant of Record (buys out EU VAT OSS) — not built here, but the `subscriptions` schema must match the provider's model | ☐ open |
| D8 | Trial policy | 14-day trial, no card upfront | ☐ open (mainly Sprint 86) |
| D9 | Price | $6/mo or $60/yr | ☐ open (mainly Sprint 88 launch) |

External setup Jarmo owns (not code): register GitHub OAuth app, acquire `ritemark.site`, create Paddle/Stripe account, create `abuse@…` mailbox, confirm email provider.

## Success Criteria (mirror spec acceptance criteria)

- [ ] Account service deployed to staging **and** prod with CI (wrangler), structured logging, and alerting.
- [ ] User can sign in from Ritemark desktop end-to-end (device flow).
- [ ] Device token stored in `SecretStorage`; short-TTL access JWT exchange works.
- [ ] Web page lists devices; revoking a device kills the app session (the headline exit test).
- [ ] Account deletion (GDPR Art. 17) works from day one.
- [ ] No passwords are ever stored.
- [ ] `architecture.md` updated with the new backend Layer 0.

## Primary Risk

First backend service this team has operated. Mitigation: minimal surface, managed primitives only (Workers/D1), proven auth library instead of hand-rolled, staging/prod + alerting from day one. (Release-plan Risk Register: "First operated backend service" — High.)

## Cross-Repo Tracking Question (needs a decision)

Most of this sprint's code lands in the **new `ritemark-cloud` repo**, not `ritemark-native`. Open question for Jarmo: how is a sprint that primarily builds another repo tracked under this DLC? Options to consider — keep the sprint docs here (canonical) and reference `ritemark-cloud` PRs in the tracker; or mirror a lightweight sprint pointer in the backend repo. This is itself a small DLC-process gap to resolve before Phase 3.

## Approval

- [ ] Jarmo approved this sprint plan (Phase 2→3 gate).
- [ ] Decisions D1–D7 locked (D8–D9 may defer to later sprints).
- [ ] Architecture Gate: Jarmo signed off on `spec.md` as the Architecture Proposal.
