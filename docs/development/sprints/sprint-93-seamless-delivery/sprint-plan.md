# Sprint 93: Seamless Extension Delivery

Track: SDD (three workstreams — one-command extension release, Claude-Code-style update UX, process/harness changes — spanning release scripting, the extension host update platform, and process docs; retains the SDD designation from the release plan)

**RE-CUT 2026-07-10.** This directory previously held a combined draft (`sprint-91-seamless-updates`, four workstreams + a droppable esbuild sub-workstream). Per `docs/development/releases/v1.8.2/release-plan.md`'s Housekeeping note, that draft is superseded: CI de-risk already shipped in `sprint-91-windows-foundation`; esbuild bundling is now its own sprint, `sprint-92-esbuild-bundling`. This document and its four SDD siblings (`spec.md`, `scenarios.md`, `technical-plan.md`, `tasks.md`) are rewritten to cover ONLY this sprint's remaining scope (old W2/W3/W4), with requirement IDs R3-R17 preserved unchanged for traceability.

Branch: `sprint-93-seamless-delivery` (created 2026-07-12, based on `main` — sprint-92 already merged there, so this satisfies the original "base off sprint-92" intent without a separate branch)

Status: Phase 3 (IMPLEMENTATION) — approved by Jarmo 2026-07-12, starting with W2 per tasks.md sequencing

Parent release: [`docs/development/releases/v1.8.2/release-plan.md`](../../releases/v1.8.2/release-plan.md) — v1.8.2 "Sturdy & Seamless Delivery (Windows-first)", sprint #3 of 3.

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (R3-R17, source of truth; R1/R2/R18 retired, see spec.md's RE-CUT NOTICE)
- [scenarios.md](scenarios.md) — BDD examples / manual QA matrix (S1-S16)
- [technical-plan.md](technical-plan.md) — workstreams, current-state audit, message/file shapes
- [tasks.md](tasks.md) — implementation checklist with binary done-when criteria
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + decisions)

## Goal

Fix the (currently broken/stale) one-command extension-release path, flip its default UX to background-download + "Relaunch to update" (Claude-Code-style), and document the resulting two-tier (shell vs. extension) release process across `CLAUDE.md` and the relevant agents/skills — so most future Ritemark changes ship in minutes via the extension fast lane instead of a multi-day shell rebuild.

## Dependency

**Depends on `sprint-92-esbuild-bundling`** (soft dependency — see `technical-plan.md`'s W2.1 design note: this sprint's correctness fix stands on its own; sprint-92 only makes the RESULT smaller/simpler). **Branch bases off `sprint-92-esbuild-bundling`, not `main`** — see Approval Gate below.

## Linked Issues

None yet — this sprint originates from an approved analysis doc rather than a filed issue. Phase E's GitHub `enhancement` issue is filed at sprint close (see `tasks.md` Sprint close).

## MVP Scope

- **W2 — One-command extension release:** repair `scripts/create-extension-release.sh`'s stale, hardcoded, already-broken file list (confirmed: references three nonexistent paths, omits ~100 real current files) with dynamic enumeration; wrap it as `scripts/release-extension.sh` with a new preflight (release-tier guard + `engines.vscode` check).
- **W3 — Claude-Code-style update UX:** background download + sha256 verify + silent staging, status-bar "Relaunch to update", apply-on-next-start, N−1 rollback on failed activation (currently dead-code cleanup logic gets its first real call site), new `ritemark.updates.mode` setting (`auto` default).
- **W4 — Process & harness:** `CLAUDE.md` release-tier rule, `release` skill's extension-release procedure (replacing stale `vsce package` text this codebase never actually used), `sprint-manager`/`release-manager`/`qa-validator` two-tier updates (extending existing tables, not duplicating), new `docs/development/RELEASING.md` guide for Jarmo. No manual `.codex/**`/`AGENTS.md` edits — `harness-equalizer` syncs those.

Full requirement-level detail lives in `spec.md` (R3-R17).

## Product Decisions

- **2026-07-10 (this plan, re-cut):** W1 (CI de-risk) is removed from this sprint's scope entirely — already shipped in `sprint-91-windows-foundation` (its W4 tasks W4-2/W4-3/W4-5/W4-7/W4-8/W4-9 are marked done; W4-4/W4-6 are pending-push smoke tests, not blocking this sprint). This sprint's `release` skill edit (R12) must NOT re-touch Step 5 (CI dispatch), which sprint-91 already updated.
- **2026-07-10 (this plan, re-cut):** The esbuild-bundling workstream is removed entirely and now lives in `sprint-92-esbuild-bundling` as its own sprint, per the release plan's dependency-ordered Sprint Map. This sprint depends on it (soft dependency, see Dependency section above).
- **2026-07-10 (this plan):** `scripts/create-extension-release.sh` already exists and is repaired/extended, not replaced wholesale — its manifest/feed-generation logic was verified correct during planning; only its hardcoded file-enumeration is broken. *Jarmo may override and request a from-scratch rewrite instead, but the repair approach preserves working, already-correct code.*
- **2026-07-07 (carried over from the original draft):** Auto-apply staged updates on next start by default (`ritemark.updates.mode: "auto"`). Jarmo may override to `"prompt"`-as-default at plan approval if preferred.
- **2026-07-07 (carried over):** Version-skew support window = latest shell version only (`minAppVersion` = latest shell). Multi-version compatibility matrices are out of scope. (Already structurally enforced by `generate-update-feed.mjs`'s per-`appVersion` de-duplication, per `technical-plan.md` — this decision has more mechanical backing than the original draft knew.)
- **2026-07-07 (carried over):** Extension releases get a slim per-surface QA checklist; full `TEST-CHECKLIST.md` stays reserved for shell releases. Jarmo may override at plan approval.
- **2026-07-07 (carried over):** Phase E (native shell auto-update via VS Code's `updateUrl`) is an explicit non-goal — tracked as a future GitHub `enhancement` issue, not implemented here.
- **2026-07-12 (W3.5 go/no-go, implementation time):** the activation-integrity mechanism (`activationIntegrity.ts`, `context.globalState`-based) touches only `extensions/ritemark/src/` — no `product.json`, no `scripts/` bootstrap file — so W2.1's own shell-tier release guard would never have blocked shipping it as a fast-lane extension release. **GO, no tension, no escalation needed.** Separately: this mechanism only catches RUNTIME activation failures (an exception during `activate()`'s body); it does NOT solve a syntactically-invalid `out/extension.js` (the v1.7.1 precedent, a load-time failure that prevents this module's own code from running at all). A true fix for that narrower case would need a check before the extension host attempts to load the module — i.e. a VS Code core patch, genuinely shell-tier. Decision: **do not build that now** — the load-time case is already substantially mitigated by W2.1's preflight (blocks releasing when `tsc --noEmit` fails) and W2.2's dynamic file enumeration + content-sentinel checks, and VS Code core itself isolates a failed activation without crashing the app (confirmed by reading `extHostExtensionService.ts`'s `ExtensionsActivator`/`onExtensionActivationError`). Filed as a residual gap, not silently expanded into this sprint's scope.

## Feature Flag Check

- W2 (release script): no flag — release tooling, not shipped app behaviour.
- W3 (update UX): the `auto`/`prompt` `mode` setting IS the user-facing control; no additional feature flag layered on top, following the Sprint 90 precedent (flags aren't plumbed to Settings UI since Sprint 67). If a kill-switch independent of `mode` is wanted, Jarmo can request one added to `extensions/ritemark/src/features/flags.ts` with `status: 'stable'` per HARD RULE #2 — not added by default to avoid an unused knob.
- W4 (process docs): not applicable — no runtime code.

## Success Criteria

Mirrors `spec.md`'s Acceptance section at a high level:

- [ ] `scripts/release-extension.sh` ships a compatible extension release end-to-end using the verified per-file manifest model (not zip) (R3)
- [ ] The stale-file-enumeration bug in the existing release script is fixed — no more nonexistent-path references, no more omitted real files (R3, S2)
- [ ] Release-tier guard blocks an extension release when shell-tier files changed, INCLUDING the two new sprint-91 paths (R4)
- [ ] `engines.vscode` compatibility check blocks an incompatible extension release (R5)
- [ ] Extension updates download, verify, and stage silently in `auto` mode; status-bar "Relaunch to update" works (R6, R7)
- [ ] Un-clicked staged updates auto-apply on next app start (R8)
- [ ] Failed activation rolls back to N−1 without leaving a broken extension host (R9)
- [ ] `mode: "prompt"` preserves today's notification flow; full-app updates unaffected by `mode` (R10)
- [ ] `CLAUDE.md`, `release` skill, `sprint-manager`, `release-manager`, `qa-validator`, and new `docs/development/RELEASING.md` all reflect the two-tier release model (R11-R16)
- [ ] No manual `.codex/**`/`AGENTS.md` edits land in this sprint (R17)
- [ ] TypeScript compiles; pre-commit hook passes; `qa-validator` signs off

## Pre-Implementation Gate

No Phase 0 audit-gate blocks the START of coding (unlike sprint-92's mandatory Phase 0 spike) — this sprint's riskiest unknown (W3.5 rollback mechanism) is scoped as an in-workstream audit with a documented fallback path, not a sprint-start blocker. Start work per the phase order in `tasks.md`; treat W3.4 (confirm the VS Code core version-resolution hypothesis) and W3.5 (rollback) as points where an implementation-time research note may be appended to `tasks.md` before coding continues.

## Approval Gate (HARD — read before touching code)

Per repo CLAUDE.md and the user's global instruction ("never start sprint coding before me (user) actually approves sprint plan"):

1. **No implementation code until Jarmo approves this sprint plan.** Release phrases: "approved", "Jarmo approved", "proceed".
2. **Immediately after approval, before any code edit:** create the sprint branch OFF `sprint-92-esbuild-bundling` (not `main`), per this sprint's dependency:
   ```bash
   git checkout sprint-92-esbuild-bundling
   git checkout -b sprint-93-seamless-delivery
   git branch --show-current   # must print sprint-93-seamless-delivery
   ```
   If `sprint-92-esbuild-bundling` has not been approved/started yet when this sprint is approved, confirm with Jarmo whether to (a) wait for sprint-92 to land first, or (b) branch off `main` instead and accept the fallback (larger file-enumeration list, no functional loss — see `technical-plan.md`'s soft-dependency framing). Do not silently choose — this is exactly the kind of sequencing call that belongs to Jarmo per the dependency note in the release plan.
3. Sprint code never lands on `main` directly.
4. Standard commit gate: pre-commit hook (`.claude/hooks/pre-commit-validator.sh`) must pass on every commit.
5. Sprint-end gates: `qa-validator` sign-off (Phase 4→5), and — since this sprint's own conclusion is an extension-tier release by its own R4 guard (touches only `scripts/`, `extensions/ritemark/src/update/**` + `package.json` config, `.claude/**`, `docs/**`) — the LIGHT gate from this sprint's own updated `release-manager` two-tier model: Jarmo tests the change via the in-app "Relaunch to update" flow or a local dev path, tests changed surfaces, gives the approval phrase. No notarization, no 60-min hardening, no Windows CI, no repo-visibility toggle for this sprint's own release, per its own tier conclusion. **Practical note:** since v1.8.2 ships as one shell release train (sprint-91 + sprint-92 + sprint-93 together), this sprint's work will likely first ship AS PART of the v1.8.2 shell release rather than standalone — the "ships as extension release" conclusion applies to any FUTURE sprint using this sprint's own tooling, not necessarily to how v1.8.2 itself reaches users. Confirm with Jarmo/`release-manager` at Phase 6 which path applies.

## Non-Goal: Phase E (native shell auto-update)

VS Code's own `updateUrl` (Squirrel.Mac on macOS, `inno_updater.exe` on Windows) so even shell releases become "restart to update" is explicitly OUT of scope for this sprint. At sprint close, file a GitHub `enhancement` issue on `ProductoryHQ/ritemark-native` referencing this sprint and the source analysis doc; do not implement any part of Phase E here.

## Approval

- [x] Jarmo approved this sprint plan (2026-07-12, "tee vahecommit ja siis alusta 93'ga")
