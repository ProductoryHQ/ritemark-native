# Cloud Sharing Initiative — Sprint Plan (Plan of Record, rev. 2)

**Date:** 2026-06-12
**Status:** Proposed — supersedes the §8 sequencing in `2026-06-12-cloud-sharing-strategies.md`
**Strategic decisions by Jarmo (2026-06-12):** no BYO publishing, no free tier, server-side
user/account management is built first.

---

## 1. Strategy frame

**Product:** Ritemark Cloud — a paid account service. First feature: document sharing
(single file via link). Viewers never need an account or payment; authors must be
subscribers. No anonymous publishing of any kind.

**Consequences of the decisions:**

- *Paid-only collapses the abuse problem.* The largest open risk in the research (telegra.ph
  / Firefox Send weaponization) assumed free or anonymous publishing. Publishers with
  payment methods on file and revocable device tokens are not viable phishing
  infrastructure. The free-tier quota engineering, Turnstile gating, and expiry-pressure
  design from rev. 1 are all deleted.
- *Accounts-first is the correct dependency order.* With no free tier, entitlement checks
  must exist before any share endpoint is written. The account service is a platform
  investment: sync, team spaces, hosted flows all ride on it later. The account model is
  therefore designed wider than sharing — entitlements are a list of products
  (`sharing`, later `sync`, …), never a boolean.
- *The one gap paid-only creates:* nobody experiences value before paying → a trial policy
  is required (D-E).

---

## 2. Sprint sequence (next available number: 83)

Strict dependency chain; no parallelization. Sprints 83–85 ship dark; Sprint 86 is launch.

### Sprint 83 — `sprint-83-cloud-accounts` (SDD track) — foundation

**Goal:** deployed, operated account service; the app can sign in end-to-end.

- New backend repo (per D-D): Hono on Cloudflare Workers + D1.
- Data model (platform-wide): `users`, `oauth_identities`, `devices` (revocable per-device
  tokens), `subscriptions` (provider customer id, product, status, period end),
  `audit_log`. Entitlements derived from subscriptions, carried in short-TTL (~15 min)
  access JWTs.
- Auth: GitHub OAuth + email magic link (no passwords stored, ever). Email provider:
  Resend or Scaleway TEM (EU).
- Desktop device flow (RFC 8628 against our own service): app requests device code →
  browser sign-in + device approval → app polls → long-lived revocable device token in
  `SecretStorage` → exchanged for short-lived access JWTs.
- Minimal accounts web page: sign-in, device approval, device list/revoke, **account
  deletion (GDPR Art. 17) from day one**.
- Client slice: "Account" section in Settings (sign in/out, device status) — proves the
  loop E2E.
- Ops baseline: staging + prod, wrangler CI deploy, structured logging, alerting.
- **Exit criteria:** sign in from the app; revoke the device on the web page; app session
  dies.

**Primary risk:** first backend this team has operated. Mitigation: minimal surface,
managed primitives only (Workers/D1), Better Auth instead of hand-rolled auth (D-A).

### Sprint 84 — `sprint-84-billing-entitlements` (SDD track)

**Goal:** a user can subscribe; entitlement state is enforceable everywhere. Ships dark.

- Checkout + customer portal + idempotent, replay-safe webhook handler.
- Subscription state machine: `trialing → active → past_due (3-day grace) → canceled` —
  spec'd exhaustively in SDD scenarios.
- Trial policy implemented (D-E).
- Entitlement middleware written once here; every future paid endpoint uses it.
- Client: Subscribe / Manage subscription UI in Settings; locked-state UX for
  unsubscribed users.
- Fully tested against provider sandbox (webhook replay included).

**Key decision (D-B):** an Estonian micro-company selling B2C digital services EU-wide owes
VAT OSS in every member state. Stripe + Stripe Tax (~3% fees, we are merchant, we file) vs
merchant of record (Paddle / Lemon Squeezy, ~5% fees, they handle all VAT/invoicing/filings).
**Recommendation: Paddle as MoR** — the fee difference buys out an entire compliance
workstream.

**Primary risk:** billing correctness (stranded paying user = reputation event). Small LOC,
zero rush tolerance.

### Sprint 85 — `sprint-85-share-backend` (SDD track)

**Goal:** entitlement-gated publish/serve pipeline, abuse-ready, agent-native from day one.

- `POST /publish` (entitlement-gated, presigned R2 PUT); serving on a separate cookie-less
  domain (`ritemark.site/<slug>`); republish = overwrite.
- Agent-native layer ships here (≈1 day once serving exists): `GET /<slug>.md`,
  `Accept: text/markdown` negotiation, per-doc MCP resource endpoint, `llms.txt`.
- OG-card Worker (unfurl = growth loop).
- Link controls: password protection, expiry, unpublish, revoke-all.
- **DSA/abuse stack (legally mandatory before the first public link):** Art. 16 report
  endpoint + footer link, abuse@ inbox + takedown runbook, takedown-by-slug, 5 MB size
  cap, Safe Browsing check on outbound links, `noindex` default.
- Strict CSP; content rendered from stored markdown through the existing sanitizing
  pipeline — raw HTML is never stored or served.

Paid-only simplification: every publisher is identified, paying, and revocable — no quota
engineering, no anonymous endpoints.

### Sprint 86 — `sprint-86-share-client-launch` (full track)

**Goal:** the user-facing feature + public launch.

- Share button in document header → publish, link to clipboard, published-state indicator.
- Publish-on-save with explicit debounce (coalesce autosaves; ≥10 s between republishes).
- Share popover: password/expiry controls, "Ask your AI" (.md URL copy), unpublish.
- "My shares" list in Settings.
- `ritemark://duplicate` URI handler ("Duplicate to Ritemark" button on every published
  page) — requires a small VS Code patch (011) registering the URI scheme (macOS
  Info.plist + Windows registry).
- Launch: pricing page, user docs, release notes (product-marketer), release Gates 1 + 2.

### Post-launch (Sprint 87+, demand-driven — not planned now)

View analytics ("who viewed"), E2EE Secure Share mode, custom domains, live-updating links
(self-hosted Hocuspocus; never TipTap Cloud). These are retention/upsell features inside
the paid plan, no longer conversion levers.

---

## 3. Decisions remaining (with recommendations)

| # | Decision | Recommendation |
|---|---|---|
| D-A | Auth stack | Better Auth, self-hosted on Workers (control, EU story, $0) over Clerk (managed, faster, vendor-coupled identity) |
| D-B | Billing | Paddle as merchant of record — buys out EU VAT OSS compliance |
| D-C | Infra | Cloudflare Workers + D1 + R2 for v1; EU-native (Hetzner/Bunny) is a later migration if "EU-hosted" becomes a marketing pillar |
| D-D | Repo | New repo `ritemark-cloud` — backend deploys stay out of the VS Code build pipeline |
| D-E | Trial | 14-day trial, no card upfront — the trial replaces the cut free tier |
| D-F | Price | $6/mo or $60/yr — paid-only supports a higher anchor than the $5 freemium benchmark; still under Obsidian Publish |

**Jarmo's prerequisites before Sprint 83 Phase 3:** GitHub OAuth App registration,
`ritemark.site` domain, Paddle (or Stripe) account, abuse@ mailbox.

---

## 4. Architecture Gate

This initiative adds a Layer 0 (backend service) that `docs/development/architecture.md`
does not describe. The Sprint 83 spec doubles as the Architecture Proposal (auth model,
repo placement, data model, infra choice); `architecture.md` gains the new layer as part of
Sprint 83's definition of done. D-A through D-D are the gate decisions; Jarmo's sign-off on
the Sprint 83 spec is the gate approval.
