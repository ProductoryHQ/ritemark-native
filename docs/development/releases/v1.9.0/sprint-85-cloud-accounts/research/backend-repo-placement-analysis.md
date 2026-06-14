# Research — Backend Repo Placement (D1): same repo vs separate repo

**Date:** 2026-06-14
**Status:** Decision memo for Jarmo — D1 is his to lock. Nothing in Sprint 85 proceeds until this is decided.
**Question:** Should the Ritemark Cloud backend (Hono on Cloudflare Workers + D1/R2) live **in `ritemark-native`** (monorepo) or in a **separate repo** (`ritemark-cloud`)? The strategy doc assumed separate ("D-D"); Jarmo flagged that this is an assumption, not consensus. This memo argues it properly.

> Scope note: the **client** cloud slice (Settings "Account" section, device-flow client, `SecretStorage`) lives in `ritemark-native` **either way** — it is part of the extension. This decision is *only* about where the **backend service** lives.

## What makes this decision specific to Ritemark (not a generic monorepo debate)

Three repo-specific facts dominate the analysis:

1. **`ritemark-native` is intermittently PUBLIC.** The dev repo is toggled `--visibility public` for Windows large-runner CI on every full release, then back to private (see `release-manager` agent + the v1.7.2 firefight). We also have a documented incident where `docs-internal/` leaked while tracked despite `.gitignore` — recorded lesson: **".gitignore is not a security boundary."** A backend holds live production secrets (OAuth client secrets, JWT signing key, billing webhook secret, DB/deploy tokens). Putting that in a repo that flips public is a standing security hazard.

2. **Client and backend are inherently independently deployed and version-skew tolerant.** A desktop app installed weeks ago (shipped via DMG, slow notarized cadence) must keep working against today's backend (deployed many times a day via wrangler). They can *never* deploy atomically. The product shape **forces** backward/forward-compatible API contracts regardless of repo layout — which removes the main reason monorepos exist (atomic cross-cutting commits).

3. **The toolchains and CI are alien to each other.** `ritemark-native` CI = ~25-min Electron builds, notarization, Windows large runners, patch application, an 8 MB webview bundle, a giant `vscode/` submodule. The backend = `wrangler deploy`, D1 migrations, seconds-long deploys. Sharing a repo means sharing (or carefully path-filtering around) all that machinery and its secrets.

## Options

### Option A — Separate repo `ritemark-cloud` (RECOMMENDED)
Backend in its own repo (private, never toggled public), its own CI (wrangler), its own secrets and deploy policy. `ritemark-native` keeps only the client slice.

### Option B — Monorepo (backend inside `ritemark-native`)
Backend under e.g. `cloud/` in `ritemark-native`, path-filtered CI so backend changes don't trigger Electron builds.

### Option C — Separate *cloud* monorepo
A new repo that is itself a small monorepo: `backend/` + a shared `contract/` types package (+ a future accounts web app). Still separate from `ritemark-native`; "mono" only for cloud concerns.

## Evaluation

| Criterion | A: separate `ritemark-cloud` | B: monorepo in `ritemark-native` | C: separate cloud monorepo |
|---|---|---|---|
| **Secrets vs public toggle** | ✅ isolated; never public | ❌ prod secrets in an intermittently-public repo | ✅ isolated |
| **CI / build coupling** | ✅ independent, fast | ⚠️ needs strict path-filtering; easy to misconfigure next to release CI | ✅ independent |
| **Deploy cadence** | ✅ independent | ⚠️ tangled with release process | ✅ independent |
| **Atomic client+backend change** | ❌ two PRs — but skew-tolerance is required anyway, so low real cost | ✅ one PR (benefit largely illusory given forced compat) | ❌ two PRs |
| **Shared API contract / types** | ⚠️ keep in sync via a published contract doc or tiny versioned package | ✅ shared in-repo | ✅ shared in the cloud monorepo, consumed by client as a dep |
| **Dev environment clarity** | ✅ focused (Workers/Node only) | ❌ contributors clone Electron + submodule to touch the backend | ✅ focused |
| **Policy / access control** | ✅ own branch protection, deploy keys, smaller blast radius | ❌ one policy must serve both app and backend | ✅ own policy |
| **DLC tracking** | ⚠️ cross-repo (solvable, see below) | ✅ one repo | ⚠️ cross-repo |
| **Reversibility** | ✅ easy to fold in later if wrong | ✅ easy to split out later | ✅ |

## On the "dev environment & policy consensus" Jarmo raised

- **Dev environment:** a backend contributor on Option B must clone a multi-GB VS Code fork with a submodule and arm64/Electron toolchain just to edit a Worker. On A/C they `git clone ritemark-cloud && npm i && wrangler dev`. The desktop and backend dev loops have nothing in common; one repo muddies onboarding and CI for both.
- **Policy:** branch protection, required reviews, who holds deploy credentials, and the public/private switch are all *different policies* for an app vs a live service. Two repos = two clean policies. One repo = one policy forced to straddle both, with the secrets sitting in the riskier (public-toggling) place.

## Locked-decision / principle check (architectural-design skill)

No locked decision governs repo placement directly, but the project's **boundary discipline** does apply by analogy: Ritemark already keeps hard layers apart (webview sandboxed behind `bridge.ts`; VS Code as a submodule, not merged into the extension). A separate backend repo is the same instinct — keep a genuinely different layer behind a clean, versioned API boundary rather than dissolving it into the app repo for convenience. It is also fully **reversible** (a separate repo can be vendored in later, and a monorepo can be split out later), so this is not a one-way door.

## Recommendation

**Option A — separate `ritemark-cloud` repo** (private, under `ProductoryHQ`, never toggled public). Decisive reasons: (1) the secrets-vs-public-toggle hazard is real and specific to this project; (2) the product *requires* client/backend version-skew tolerance, so the monorepo's headline benefit (atomic commits) mostly evaporates; (3) the toolchains/CI/cadence are alien. Option C is a fine evolution of A *later* if a shared contract package or an accounts web app makes a small cloud monorepo worthwhile — but start with a single backend repo.

### Mitigations for A's two real downsides
- **Shared contract:** define the API surface (token claims, entitlement shape, device-flow endpoints) once. Start as a short `CONTRACT.md` in `ritemark-cloud`; promote to a tiny versioned `@ritemark/cloud-contract` types package only if drift becomes real. The surface is a handful of endpoints — low drift risk.
- **DLC cross-repo tracking gap:** keep the sprint's SDD docs **canonical in `ritemark-native`** (where the DLC lives); the release-plan Tracker rows reference `ritemark-cloud` PR URLs. Optionally drop a one-line `AGENTS.md`/`README` pointer in `ritemark-cloud` back to the governing sprint folder. This resolves the open cross-repo question recorded in `sprint-plan.md`.

## Decision needed from Jarmo (locks D1)
- [ ] **A** — separate `ritemark-cloud` repo (recommended), or
- [ ] **B** — monorepo in `ritemark-native`, or
- [ ] **C** — separate cloud monorepo (backend + shared contract).

Once D1 is locked, `spec.md` §Architecture Proposal and the `sprint-plan.md` D1 row are updated to match, and the DLC cross-repo tracking note is finalized accordingly.
