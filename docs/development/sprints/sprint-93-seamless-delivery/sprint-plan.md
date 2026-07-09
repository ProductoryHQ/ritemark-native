# Sprint 91: Seamless Update Delivery

Track: SDD (folds 4 approved workstreams — CI de-risk, one-command extension release, Claude-Code-style
update UX, process/harness changes — plus a droppable esbuild-bundling workstream, spanning CI
workflows, release scripting, the extension host, and process docs)

Branch: `sprint-91-seamless-updates`
Status: Phase 2 — plan written, awaiting Jarmo approval

Release tier: **extension**

**Reasoning:** this sprint touches `.github/workflows/*` (repo-internal CI tooling, not shipped inside
the app bundle), `scripts/release-extension*.sh` (new repo tooling), `extensions/ritemark/src/update/**`
+ `extensions/ritemark/package.json` config (ships via the extension zip, not the shell), `.claude/**`
+ `docs/**` (pure process documentation), and — if W-D is not dropped — an esbuild bundling change to
HOW `extensions/ritemark/out/` is built, which is still extension-tier output, not a shell/patches/
native-module/branding change. Checked against this sprint's OWN release-tier guard denylist (R4):
none of `patches/`, the `vscode/` submodule pointer, `branding/product.json`,
`extensions/ritemark/binaries/agents/`, or the app-layout script list are touched. **Conclusion: this
sprint ships as an extension release once merged**, consistent with the source plan's own thesis that
nearly all sprint work belongs on the extension tier.

---

## SDD Artifacts

- [spec.md](spec.md) — behaviour contract (source of truth)
- [scenarios.md](scenarios.md) — BDD examples (manual QA matrix S1–S18)
- [technical-plan.md](technical-plan.md) — workstreams, current-state audit, message/file shapes
- [tasks.md](tasks.md) — implementation checklist with binary done-when criteria
- [sprint-plan.md](sprint-plan.md) — this file (intent + status + decisions)

---

## Goal

Flip the default release vehicle from "every change ships as a full shell rebuild" to "extension
changes ship in under an hour via a background-download, Relaunch-to-update experience", while making
the rare shell release boring and the CI pipeline that supports it safer to iterate on.

## Source

[`docs/development/analysis/2026-07-07-seamless-update-delivery-plan.md`](../../analysis/2026-07-07-seamless-update-delivery-plan.md)
— approved by Jarmo to fold Phases A–D into this single sprint; Phase E stays backlog.

## Linked Issues

None yet — this sprint originates from an approved analysis doc rather than a filed issue. Phase E's
GitHub `enhancement` issue is filed at sprint close (see `tasks.md` Sprint close).

## MVP Scope

- **W1 — CI/pipeline de-risk:** `workflow_dispatch` triggers for Windows/macOS-x64 CI (replacing
  `push: tags: v*`); weekly slim Windows canary on free `windows-latest`. Prerequisite (not sprint
  scope): the in-flight v1.8.1 Windows CI fix must be green first.
- **W2 — One-command extension release:** `scripts/release-extension.sh` with a release-tier guard and
  `engines.vscode` compatibility check.
- **W3 — Claude-Code-style update UX:** background download + sha256 verify + silent staging, status-bar
  "Relaunch to update", apply-on-next-start, N−1 rollback on failed activation, new
  `ritemark.updates.mode` setting (`auto` default).
- **W4 — Process & harness:** `CLAUDE.md` release-tier rule, `release` skill extension procedure,
  `sprint-manager`/`release-manager`/`qa-validator` two-tier updates, new `docs/development/RELEASING.md`
  guide for Jarmo. No manual `.codex/**`/`AGENTS.md` edits — `harness-equalizer` syncs those.
- **W-D — GH [#105](https://github.com/ProductoryHQ/ritemark-native/issues/105) (esbuild extension host bundling):** highest-risk workstream, own QA tasks, explicitly
  droppable mid-sprint via the Mid-Sprint Scope Change Protocol without endangering W1–W4.

Full requirement-level detail lives in `spec.md` (R1–R18).

## Product Decisions

- **2026-07-07:** Auto-apply staged updates on next start by default (`ritemark.updates.mode: "auto"`).
  Jarmo may override to `"prompt"`-as-default at plan approval if preferred; current default follows
  the source plan's Claude-Code-style recommendation.
- **2026-07-07:** Version-skew support window = latest shell version only (`minAppVersion` = latest
  shell). Multi-version compatibility matrices are out of scope. Jarmo may override at plan approval.
- **2026-07-07:** Windows canary = slim, free public-runner (`windows-latest`) job, weekly schedule,
  explicitly NOT `windows-8core`. Jarmo may override cadence (e.g. monthly, right before a planned
  shell release) at plan approval.
- **2026-07-07:** Extension releases get a slim per-surface QA checklist; full `TEST-CHECKLIST.md`
  stays reserved for shell releases. Jarmo may override at plan approval.
- **2026-07-07:** Phase E (native shell auto-update via VS Code's `updateUrl`) is an explicit non-goal
  — tracked as a future GitHub `enhancement` issue, not implemented here.

## Feature Flag Check

- W1 (CI triggers, canary): no flag — CI/tooling change, not user-facing runtime behaviour.
- W2 (release script): no flag — release tooling, not shipped app behaviour.
- W3 (update UX): the `auto`/`prompt` `mode` setting IS the user-facing control; no additional feature
  flag layered on top, following the Sprint 90 precedent (flags aren't plumbed to settings UI since
  Sprint 67 removed flag toggles from Settings — see project memory). If a kill-switch independent of
  `mode` is wanted (e.g. to disable background staging entirely without touching the `mode` setting),
  Jarmo can request one added to `extensions/ritemark/src/features/flags.ts` with `status: 'stable'`
  per HARD RULE #2 — not added by default to avoid an unused knob.
- W4 (process docs): not applicable — no runtime code.
- W-D (esbuild bundling): no flag — build-pipeline change, not a runtime feature toggle; the existing
  fail-safe is "prod build + manual QA before merge", same bar as any build-system change.

## Success Criteria

Mirrors `spec.md` Acceptance section at a high level:

- [ ] Windows/macOS-x64 CI trigger via `workflow_dispatch`, no longer on tag push (R1)
- [ ] Weekly slim Windows canary catches runner-image breakage on a free public runner (R2)
- [ ] `scripts/release-extension.sh` ships a compatible extension release end-to-end (R3)
- [ ] Release-tier guard blocks an extension release when shell-tier files changed (R4)
- [ ] `engines.vscode` compatibility check blocks an incompatible extension release (R5)
- [ ] Extension updates download, verify, and stage silently in `auto` mode; status-bar
      "Relaunch to update" works (R6, R7)
- [ ] Un-clicked staged updates auto-apply on next app start (R8)
- [ ] Failed activation rolls back to N−1 without leaving a broken extension host (R9)
- [ ] `mode: "prompt"` preserves today's notification flow; full-app updates unaffected by `mode` (R10)
- [ ] `CLAUDE.md`, `release` skill, `sprint-manager`, `release-manager`, `qa-validator`, and new
      `docs/development/RELEASING.md` all reflect the two-tier release model (R11–R16)
- [ ] No manual `.codex/**`/`AGENTS.md` edits land in this sprint (R17)
- [ ] TypeScript compiles; pre-commit hook passes; `qa-validator` signs off
- [ ] (If not dropped) extension host is a single esbuild bundle; prod build boots cleanly (R18)

## Pre-Implementation Gate

No Phase 0 audit gate blocks the start of coding — unlike Sprint 90's rasterization uncertainty, this
sprint's riskiest unknowns (R9 rollback mechanism, W-D's require()/native-binary audit) are scoped as
in-workstream audits with documented fallback/scope-change paths, not sprint-start blockers. Start
work per the phase order in `tasks.md`; treat W3.5 (rollback) and W-D's two audits as points where an
implementation-time research note may be appended to `tasks.md` before coding continues, per the notes
already embedded in `technical-plan.md`.

## Approval Gate Reminder (HARD)

- **No implementation code until Jarmo approves this sprint plan.** Release phrases: "approved",
  "Jarmo approved", "proceed".
- **Immediately after approval, before any code edit:** create the sprint branch.
  ```bash
  git checkout -b sprint-91-seamless-updates
  git branch --show-current   # must print sprint-91-seamless-updates
  ```
  Sprint code never lands on `main` directly — this applies to every workstream in this sprint,
  including the pure-documentation W4 edits.
- **Sprint-end gates:** every commit requires the pre-commit hook to pass; sprint close additionally
  requires `qa-validator` sign-off (Phase 4→5) and — since this sprint's own conclusion is an
  extension-tier release — the light gate from the (this-sprint-updated) `release-manager` two-tier
  model: Jarmo installs the change via the in-app updater or a local dev path, tests the changed
  surfaces (CI workflow dispatch, `release-extension.sh` dry run, update-mode UX, and, if shipped,
  the bundled extension host), and gives the approval phrase. No notarization, no 60-min hardening, no
  Windows CI, no repo-visibility toggle for THIS sprint's own release, per its own tier conclusion
  above.

## Non-Goal: Phase E (native shell auto-update)

VS Code's own `updateUrl` (Squirrel.Mac on macOS, `inno_updater.exe` on Windows) so even shell releases
become "restart to update" is explicitly OUT of scope for this sprint. At sprint close, file a GitHub
`enhancement` issue on `ProductoryHQ/ritemark-native` referencing this sprint and the source analysis
doc; do not implement any part of Phase E here.

## Approval

- [ ] Jarmo approved this sprint plan
