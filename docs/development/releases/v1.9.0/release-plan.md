# Release Plan — v1.9.0 (ritemark-native slice)

**Repo:** `ritemark-native`. **Status:** In progress. **Milestone:** `v1.9.0`.
**Release type:** Cross-repo (spans `ritemark-native` + `ritemark-cloud`).

> **Cross-repo coordination lives in the register**, not here. The release-level thesis, risk
> register, cross-repo decisions, and the map of which repos build what are in the parent governance
> repo: `ritemark-dev/releases/v1.9.0/release-register.md`. Per the governance model
> (`ritemark-dev/governance/dev-process-model.md`): **sprints are repo-scoped; releases may be
> cross-repo.** This file covers only **this repo's** sprints, so this repo's DLC gates resolve here.

## This repo's contribution to v1.9.0

1. **DLC rollout** (sprint-84) — the development-lifecycle process + harness updates (done).
2. **Account client slice** (sprint-85) — the Settings "Account" section, the device-flow client, and
   `SecretStorage` device-token handling that signs the desktop app in to Ritemark Cloud. Consumes the
   account service built in `ritemark-cloud` (see register). Ships dark.

The **account service backend** (auth, device-flow endpoints, accounts web page, data model, ops) is
**not in this repo** — it lives in `ritemark-cloud` (D1 locked). The webview never calls the cloud
directly; the extension host mediates over HTTPS. Local editing has zero cloud dependency.

## Sprint Map (this repo)

| Sprint | Purpose | Issues | PR | Status |
|---|---|---|---|---|
| sprint-84-dlc-rollout | New DLC process docs/templates/harness updates + scheduled harness equalizer | — (process) | #122 | Merged to main 2026-06-14 (`ae68c92`) |
| sprint-85-cloud-accounts | Account **client** slice: Settings Account section, device-flow client, `SecretStorage`, JWT refresh, sign-out, offline state (consumes ritemark-cloud) | TBD | TBD | Plan re-scoped (governance migration); awaiting approval |

> The cloud account **service** sprint is tracked in `ritemark-cloud` and mapped by the register.

## Sprint / PR Tracker (this repo)

| Sprint | Branch | PR | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|
| sprint-84-dlc-rollout | `sprint-84-dlc-rollout` | #122 | Merged 2026-06-14 (`ae68c92`) | passed 2026-06-14 | process/internal |
| sprint-85-cloud-accounts | `sprint-85-cloud-accounts` | TBD | governance migration in progress | not run | not drafted |

## Decisions affecting this repo

| # | Decision | Resolution | Source |
|---|---|---|---|
| D1 | Backend repo placement | **LOCKED: separate private `ritemark-cloud`** | `ritemark-dev/decisions/D1-backend-repo-placement.md` |
| D2–D7 | Auth stack, identity, infra, email, billing | Owned by the cloud `account-service` sprint | `ritemark-cloud` |

## Documentation / release assets

- Dark sprints (85+) update `architecture.md` (Layer 0 pointer) and internal docs; no public changelog
  until a user-facing feature ships in a later release.
- Public release notes must not promise cloud sharing until the launch release scope is complete.
