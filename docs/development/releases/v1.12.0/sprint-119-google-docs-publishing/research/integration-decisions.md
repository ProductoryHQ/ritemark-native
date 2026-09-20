# Sprint 119 Integration Decisions

**Status:** In progress. Opened 2026-09-20. This file is the Phase 0 gate: no OAuth production configuration, dependency, message contract or product code starts until Jarmo approves it.<br>
**Decisions:** 8 (see [spec.md](../spec.md) § Phase 0 Decisions). Decision 6 is partly recorded below; the rest are open.<br>
**Rule:** every entry records what was observed, when, and by whom. No credential, token or secret value belongs in this file.

## Decision status

| # | Decision | Status |
|---|---|---|
| 1 | OAuth desktop flow, redirect/PKCE/state, scope set, consent publication, test accounts, release credential injection | Partly recorded (credentials below); flow not yet canaried |
| 2 | Direct Markdown import vs DOCX conversion vs native Docs API | Open |
| 3 | Template selection/grant/copy semantics | Open |
| 4 | Create and same-ID Sync sequence, idempotency, verification, retry/cancel | Open |
| 5 | Binding schema, workspace identity, rename/copy/Save As/account switch | Open |
| 6 | Credentials and operations | Recorded 2026-09-20; publication and verification open |
| 7 | Feature flag, telemetry allowlist, threat model, dependency choice, architecture impact, canary matrix | Open |
| 8 | Google user-data facts for the Ritemark privacy policy (R11) | Open |

## Decision 6 — credentials and operations

Recorded 2026-09-20 by Claude, driven in the browser with Jarmo present, in the Google Cloud console as jarmo@productory.eu.

### Project

An existing project was reused rather than creating a new one.

| Field | Value |
|---|---|
| Project name | Ritemark |
| Project ID | `root-cathode-471905-q1` |
| Project number | `620148959973` |
| Organization | None. The project sits directly under the account, not under a Productory organization resource |
| Owner account | jarmo@productory.eu (Productory Workspace) |

### Enabled APIs

| API | State |
|---|---|
| Google Drive API | Already enabled before this sprint |
| Google Docs API | Enabled 2026-09-20 |
| Google Picker API | Enabled 2026-09-20 |
| Google Search Console API | Already enabled; unrelated to this sprint |

### OAuth application

| Field | Value |
|---|---|
| Publishing status | Testing |
| User type | External |
| App name | Ritemark |
| User support email | jarmo@productory.eu |
| Developer contact | jarmo@productory.eu |
| Application home page | `https://ritemark.app/en/` |
| Privacy policy link | `https://ritemark.app/en/privacy/`, added 2026-09-20 once the page was live |
| Terms of service link | `https://ritemark.app/en/terms/`, added 2026-09-20 |
| Authorized domains | `ritemark.app` |
| Logo | None uploaded |
| Test users | jarmo@productory.eu (1 of the 100 pre-verification cap) |

Until 2026-09-20 the Audience page refused publication because Branding was incomplete. With the two links saved, that block is gone and a **Publish app** action is now offered. It has deliberately not been used: publication waits for the Phase 0 gate and for the open items below.

### Legal pages (R11 evidence)

`ritemark-web` shipped its Sprint 26, "Ritemark's own privacy policy and terms of use", merged as PR #119 and deployed. Checked live on 2026-09-20:

| URL | Status |
|---|---|
| `https://ritemark.app/en/privacy/` | 200 |
| `https://ritemark.app/en/terms/` | 200 |
| `https://ritemark.app/et/privacy/` | 200 |
| `https://ritemark.app/et/terms/` | 200 |
| `https://www.productory.ai/en/privacy/` | 200, and since 2026-09-20 it points at the Ritemark policy |

The English privacy policy names Productory Services OÜ as provider with info@productory.eu, is dated 18 September 2026, and carries over the Ritemark commitments: local files, PostHog EU analytics with its opt-out, and the direct AI provider routes. It has **no Google Docs section yet** — that text is decision 8 and is written from the Phase 0 facts.

`productory-2026` PR #21, "Move Ritemark legal details to ritemark.app", was reviewed and merged on 2026-09-20 as `815bf85c`, and the deploy is live. Each Productory legal page now carries a short Ritemark section linking to the matching ritemark.app page in the same language, verified after the deploy:

| Productory page | Links to |
|---|---|
| `/en/privacy/` | `ritemark.app/en/privacy/` |
| `/en/terms/` | `ritemark.app/en/terms/` |
| `/et/privacy/` | `ritemark.app/et/privacy/` |
| `/et/terms/` | `ritemark.app/et/terms/` |

The review checked that nothing was lost between the two documents. Every Ritemark commitment removed from Productory's terms — MIT License, "AS IS", the liability limitation, the AI provider policy links, user responsibilities, best-effort support, and the AI-output review duty — is present on ritemark.app, as are the privacy items: the PostHog policy link, analytics on by default with its opt-out, the direct AI routes, feedback transmission, and that Productory receives no copy of the workspace. The Productory URLs did not move, so 1.11-era in-app links still land on a correct page.

S79 is therefore satisfied on the web side. It closes for this sprint when the in-app links also point at ritemark.app, which is product code behind the Phase 0 gate.

Two open points:

- The Estonian pages live at `/et/privacy/` and `/et/terms/`, English slugs, while other Estonian routes use Estonian ones such as `/et/tugi`. Both `productory-2026` (`src/config/legal.ts`) and this sprint's in-app links hardcode the current slugs, so a later rename in `ritemark-web` must update both.
- `productory-2026` still contains `src/app/ritemark/components/RitemarkFooter.tsx`, whose legal links point at the Productory pages. That section 301s to ritemark.app and is not served, and a separate task already covers removing the dead Ritemark code there.

### Scopes

`https://www.googleapis.com/auth/drive.file` is registered, and Google classifies it as non-sensitive. No sensitive or restricted scope is registered. Any scope beyond this needs a written necessity proof and Jarmo's approval (R2).

### Clients

| Client | Type | Created | Notes |
|---|---|---|---|
| Ritemark | Web application | 2025-09-12 | Pre-existing, presumably the earlier web Ritemark. Not modified by this sprint |
| Ritemark desktop (Phase 0) | Desktop app | 2026-09-20 | Created for the Phase 0 canaries |

Desktop client ID, public build configuration per Google's installed-app guidance:

```
620148959973-bpog94okgjf7lh95hebl4i9ecrq76gbi.apps.googleusercontent.com
```

The client secret Google issued with it is held by Jarmo in his password manager. It is never committed, logged, or written into this repository, and Google will not display it again. Google's installed-app documentation says a distributed desktop app cannot keep a secret, so it is not treated as a security boundary; the real secrets remain the user's tokens and the per-attempt PKCE verifier (R2).

### Open items for this decision

- **Publication and verification.** The app stays in Testing, where refresh tokens expire after seven days for non-profile scopes such as `drive.file`. Since 2026-09-20 nothing in the console blocks publication, so this is now a decision rather than a missing prerequisite: publish only after the Phase 0 gate fixes the scope set, and after the privacy policy states the Google facts (decision 8). Verification lead time is unknown and runs on Google's clock.
- **Dedicated test account.** Only jarmo@productory.eu is a test user. A separate test account is still needed so canary evidence does not depend on the owner's own Drive.
- **Project ownership.** The project has no organization. Whether it should move under a Productory organization resource, and who the second owner is, is Jarmo's decision and is not yet made.
- **The legacy web client** shares this project's consent screen. Publishing and verifying the project therefore also affects that client. Jarmo has not yet confirmed whether that web application is still in use.
- **Release credential injection.** Which client the shipped app uses, and how its ID reaches the build, is undecided and belongs with decision 1.
