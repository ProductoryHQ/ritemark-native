# Release Plan — v1.9.0 Cloud Sharing

**Status:** In progress  
**Target:** v1.9.0  
**GitHub milestone:** `v1.9.0` — created 2026-06-14  
**Release type:** Full app + new cloud backend initiative  
**Release owner:** Jarmo  
**Created:** 2026-06-14  
**Strategy source:** `docs/development/analysis/2026-06-12-cloud-sharing-sprint-plan.md` and `docs/development/analysis/2026-06-12-cloud-sharing-strategies.md` from `origin/claude/festive-keller-tj8ne1`

## Release Thesis

Introduce the Ritemark Cloud strategy: a paid account-backed sharing service where authors can publish single Markdown documents via links, while viewers never need accounts. The first sprint in this release implements the new DLC process itself, so the multi-sprint cloud initiative has clear release, sprint, GitHub Issue, and agentic-harness coordination from day one.

## User-Facing Headlines

1. **Ritemark Cloud foundation** — accounts, device sign-in, billing/entitlements, and account management groundwork.
2. **Single-document sharing** — publish a Markdown document to a hosted link once entitled.
3. **Agent-native sharing** — shared docs are readable by humans and AI agents via clean Markdown / MCP-oriented endpoints.

## Scope Envelope

### In scope

- Sprint 84: implement the new DLC process, agentic-harness updates, and scheduled harness drift checking before cloud implementation begins.
- Accounts-first backend strategy: Hono on Cloudflare Workers + D1/R2, separate backend repo expected.
- Paid-only author model: subscribers can publish; viewers do not need accounts.
- Device auth from Ritemark desktop to cloud account.
- Billing, subscriptions, and entitlement enforcement before publish endpoints.
- Entitlement-gated publish/serve pipeline for single-file sharing.
- Public launch client UI: Share button, share popover, published state, My Shares, unpublish.
- Abuse/legal basics before first public link: abuse reporting, takedown workflow, size cap, Safe Browsing check, `noindex` default.

### Out of scope / explicitly deferred

- Free tier / anonymous publishing.
- BYO publishing.
- Multi-document sites / custom domains.
- View analytics.
- E2EE Secure Share mode.
- Live collaboration / comments.
- Background sync and team spaces.
- Task-board automation for DLC itself.

## Feature-Complete Definition

- [x] Sprint 84 DLC rollout completed, so release/sprint/issue state, harness rules, and twice-daily harness drift checking are in place.
- [ ] Cloud account service deployed and operated in staging/prod.
- [ ] Ritemark desktop can sign in, store a revocable device token, and lose access after revocation.
- [ ] Billing/subscription entitlement state is enforceable server-side and visible in Settings.
- [ ] Publish backend accepts only entitled authors and serves documents from isolated hosting domain.
- [ ] Share client UI lets users publish, copy link, update, unpublish, and manage shares.
- [ ] Abuse/legal launch checklist complete before any public sharing release.
- [ ] Architecture docs updated with the new cloud/backend layer.
- [ ] Release test checklist covers accounts, billing, publishing, serving, revoke/unpublish, and abuse/reporting flows.

## Sprint Map

| Sprint | Purpose | Issues | Dependency | PR | Status |
|---|---|---|---|---|---|
| sprint-84-dlc-rollout | Implement new DLC process docs/templates/harness updates, including scheduled harness equalizer | TBD | This release plan | TBD | Implemented; pending PR |
| sprint-85-cloud-accounts | Accounts foundation: backend repo, auth, device flow, account page, Settings sign-in | TBD | Sprint 84 | TBD | Proposed |
| sprint-86-billing-entitlements | Subscription checkout, customer portal, webhook state machine, entitlement middleware | TBD | Sprint 85 | TBD | Proposed |
| sprint-87-share-backend | Entitlement-gated publish/serve pipeline, agent-native endpoints, abuse stack | TBD | Sprint 86 | TBD | Proposed |
| sprint-88-share-client-launch | Desktop Share UI, My Shares, duplicate/open loop, launch docs/release assets | TBD | Sprint 87 | TBD | Proposed |

## Issue Intake

| Issue | Decision | Sprint | Notes |
|---|---|---|---|
| TBD | Create a GitHub epic/issue for Ritemark Cloud Sharing | sprint-85+ | Should be assigned to the release milestone once created. |
| TBD | Create issue for Sprint 84 DLC rollout if external tracking is desired | sprint-84-dlc-rollout | Process sprint; may not need a product issue. |

## Key Strategy Decisions From Source Branch

| Decision | Plan |
|---|---|
| Product model | Ritemark Cloud is paid account service; first paid feature is single-document sharing. |
| Viewer model | Viewers never need account/payment. Authors must be subscribers. |
| Free tier | No free tier and no anonymous publishing. Trial policy required. |
| Backend | New repo, likely `ritemark-cloud`; Hono on Cloudflare Workers + D1/R2. |
| Auth | GitHub OAuth + email magic link; desktop device flow. |
| Billing | Paddle as Merchant of Record recommended to avoid EU VAT OSS workstream. |
| Trial | 14-day trial, no card upfront recommended. |
| Price | $6/mo or $60/yr proposed. |
| Sharing domain | Separate cookie-less domain such as `ritemark.site/<slug>`. |
| Agent-native layer | Serve HTML for humans, `.md`/content negotiation for agents, MCP resource endpoint. |

## Prerequisites / Decisions Needed Before Cloud Implementation

- [x] Confirm GitHub milestone `v1.9.0` exists.
- [x] Create GitHub milestone `v1.9.0` if it does not exist yet.
- [ ] Decide and create backend repo (`ritemark-cloud` recommended by strategy doc).
- [ ] Register GitHub OAuth app.
- [ ] Confirm sharing domain (`ritemark.site` proposed).
- [ ] Choose billing provider (Paddle recommended; Stripe alternative).
- [ ] Create abuse mailbox (`abuse@...`).
- [ ] Confirm email provider (Resend or Scaleway TEM proposed).

## Sprint / Issue / PR Tracker

| Sprint | Branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| sprint-84-dlc-rollout | `sprint-84-dlc-rollout` | TBD | TBD | implemented; pending PR | `./scripts/validate-qa.sh` passed 2026-06-14 | process/internal |
| sprint-85-cloud-accounts | TBD | TBD | TBD | not started | not run | not drafted |
| sprint-86-billing-entitlements | TBD | TBD | TBD | not started | not run | not drafted |
| sprint-87-share-backend | TBD | TBD | TBD | not started | not run | not drafted |
| sprint-88-share-client-launch | TBD | TBD | TBD | not started | not run | not drafted |

## Risk Register

| Risk | Severity | Retirement plan | Status |
|---|---|---|---|
| First operated backend service | High | Keep Sprint 85 minimal; managed primitives; staging/prod deploy and alerting from day one. | Open |
| Billing correctness / stranded paying user | High | Dedicated billing sprint with sandbox tests and replay-safe webhooks. | Open |
| Abuse/legal for public hosting | High | No anonymous publishing; implement DSA notice/report/takedown before first public link. | Open |
| Scope creep into sync/collab/custom domains | Medium | Explicitly defer to post-launch. | Open |
| DLC process rollout blocks cloud sprint start | Medium | Sprint 84 completed; DLC is no longer blocking cloud sprint planning. | Retired |

## Documentation / Release Assets Strategy

- Public release notes should not promise cloud sharing until Sprint 88 launch scope is complete.
- Dark sprints (85–87) should update architecture and internal docs, but only limited public changelog if no user-facing feature ships.
- Launch sprint needs docs for account sign-in, subscription, sharing, unpublish, password/expiry controls if included, and abuse/reporting expectations.

## Decisions Log

| Date | Decision | Source |
|---|---|---|
| 2026-06-12 | No BYO publishing, no free tier, accounts-first. | Cloud sharing sprint plan, Jarmo decisions |
| 2026-06-14 | Sprint 84 starts release by implementing new DLC process. | Jarmo |
| 2026-06-14 | Renumber cloud sequence after Sprint 84: accounts → billing → backend → client launch. | Replan |
