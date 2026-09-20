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
| Privacy policy link | Empty — blocked on the `ritemark-web` pages (R11) |
| Terms of service link | Empty — blocked on the `ritemark-web` pages (R11) |
| Authorized domains | `ritemark.app` |
| Logo | None uploaded |
| Test users | jarmo@productory.eu (1 of the 100 pre-verification cap) |

Google states on the Audience page that the app cannot be published until the Branding configuration is complete, which currently means the missing privacy and terms links.

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

- **Publication and verification.** The app stays in Testing, where refresh tokens expire after seven days for non-profile scopes such as `drive.file`. Publishing needs the privacy and terms URLs, so it is blocked on the `ritemark-web` pages. Verification lead time is unknown and runs on Google's clock.
- **Dedicated test account.** Only jarmo@productory.eu is a test user. A separate test account is still needed so canary evidence does not depend on the owner's own Drive.
- **Project ownership.** The project has no organization. Whether it should move under a Productory organization resource, and who the second owner is, is Jarmo's decision and is not yet made.
- **The legacy web client** shares this project's consent screen. Publishing and verifying the project therefore also affects that client. Jarmo has not yet confirmed whether that web application is still in use.
- **Release credential injection.** Which client the shipped app uses, and how its ID reaches the build, is undecided and belongs with decision 1.
