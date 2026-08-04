# Sprint 107 — Clean Start (Trustworthy First Open)

Track: SDD (root cause has 4 distinct requirements across VS Code core, extension host, and webview; edge cases include cold-cache resolver behavior, workspace-trust computation, and a security-adjacent consent gap — squarely inside the SDD auto-detect signals in `.claude/skills/spec-driven-sprint/SKILL.md`)
Release tier: shell (R1 adds `patches/vscode/013-ritemark-configuration-defaults.patch`; R2/R3/R4 ride the same release as extension-tier work)
Branch: `sprint-107-clean-start` (NOT YET CREATED — plan is approved, but branch creation is under an explicit EXECUTION HOLD; see "Execution Hold" below. Do not create until the hold is lifted.)
Status: **Phase 2 (PLAN) — APPROVED by Jarmo 2026-08-04 ("Sprint accepted").** D1 and D2 are also decided (see Product Decisions). Execution (Phase 3: branch creation + implementation) is under an explicit HOLD until the v1.8.6 sprint queue reaches Sprint 107 — see "Execution Hold" immediately below. No code, patch, or branch exists yet.

## Execution Hold

**Implementation and branch creation are explicitly blocked until the v1.8.6 sprint queue reaches Sprint 107.** Jarmo's instruction, 2026-08-04, verbatim intent: "ära enne alusta kui järg jõuab kätte 107-le" (don't start before the queue reaches 107). This is a hard instruction, not a soft recommendation, and it stands independently of the plan approval and D1/D2 decisions below — approving the plan and deciding its open questions does not, by itself, authorize starting work.

- Sprints 102–106 run first, in order. Sprint 102 is complete; Sprint 103 is currently in progress; Sprints 104–106 have not started.
- `git checkout -b sprint-107-clean-start` — and any code or patch edit — remains blocked until the queue reaches Sprint 107.
- Once the hold lifts, the Phase 2→3 gate is unchanged: branch creation is the IMMEDIATE FIRST ACTION, before any code edit (per CLAUDE.md's Sprint Branch Rule and the sprint-manager HARD GATE). The hold does not change or shortcut that sequence — it only delays when the sequence is allowed to begin.
- If asked to start implementation before the queue reaches Sprint 107, the correct response is to point back to this section and decline, not to proceed.

## SDD Artifacts

- [research/product-json-defaults-audit.md](./research/product-json-defaults-audit.md) — audit-first evidence base for R1 (source-level verification: exactly why the mechanism is dead on desktop today and exactly how the fix engages the existing `EditorResolverService`/`WorkspaceTrustManagementService` code paths).
- [spec.md](./spec.md) — the behavior contract (R1–R4).
- [scenarios.md](./scenarios.md) — BDD examples; the manual QA matrix. ★ scenarios are the minimum regression set for any future release touching `patches/`, `branding/product.json`, or the daemon scheduler.
- [technical-plan.md](./technical-plan.md) — architecture (workstreams W0–W4).
- [tasks.md](./tasks.md) — the implementation checklist.

## Primary Source

[docs/development/analysis/2026-08-04-md-opens-as-code-trust-ux.md](../../../analysis/2026-08-04-md-opens-as-code-trust-ux.md) — the root-cause analysis this sprint implements, with an empirical reproduction performed on the installed v1.8.5 production app. This sprint-plan and spec.md do not re-derive the mechanisms that document already established; they cite it and add source-level verification on top (see the audit doc).

## Goal

Make the ordinary act of double-clicking a `.md` file work correctly and trustworthily on the very first launch — no plain-text flash, no trust modal, no Restricted Mode — by activating a `product.json` mechanism that has been silently dead since Sprint 57, while closing the one real gap that disabling workspace trust would otherwise open (unconsented scheduled-agent automation), healing users already stuck by the bug, and removing an adjacent, now-unwanted onboarding card under Jarmo's explicit order.

## Linked Issues

None pre-filed. This sprint originates directly from a root-cause analysis Jarmo commissioned on 2026-08-04, not from a queued `enhancement`-labeled GitHub issue. A GitHub issue can be filed for release-note/milestone linkage once implementation starts, at Jarmo's discretion (out of scope for this planning pass — no Bash/`gh` access from this planning session).

## MVP Scope

Four requirements, each independently shippable except where noted:

- **R1 — Wire `product.json` `configurationDefaults` into the desktop configuration bootstrap.** New patch 013. The core fix; everything else in this sprint either depends on it (R2) or is independent of it (R3, R4).
- **R2 — Trust posture stays off; add consent for schedule-triggered autonomous runs.** Depends on R1 shipping first (R2's acceptance criteria assume trust-off is already a real, effective default).
- **R3 — Heal existing stuck text tabs on activation.** Independent of R1/R2; can implement in parallel.
- **R4 — Remove the "Claude is ready" welcome card.** Independent of R1/R2/R3; can implement in parallel. Explicitly authorized by Jarmo on 2026-08-04 despite CLAUDE.md's default feature-preservation rule.

Full requirement detail and acceptance criteria: [spec.md](./spec.md).

## Product Decisions

### Decided

- **2026-08-04 (Jarmo, scoping this sprint):** trust posture is T-off (`security.workspace.trust.enabled: false`), not T-tame. Sprint 57's original intent, now actually shipped. Rationale: consumer-app norm; Ritemark users are not reviewing untrusted code checkouts.
- **2026-08-04 (Jarmo, scoping this sprint):** the "Claude is ready" welcome card is removed outright ("korja ära ka see veider Claude'i tervitus box! Seda pole enam vaja"), not redesigned or gated behind a new flag. This explicitly overrides CLAUDE.md's default feature-preservation rule for this one surface only; every adjacent setup-flow surface (`OnboardingWizard`, `CodexSetupView`, `OpenCodeSetupView`, the genuine `needsSetup` states) is unaffected.

- **2026-08-04 (Jarmo): D1 — Option A.** Per-workspace opt-in toast, reviewable/revocable in Agent Library. Full comparison and rationale kept below for the record; Option B is the rejected alternative.
- **2026-08-04 (Jarmo): D2 — grandfather** (recommendation accepted). Workspaces where the daemon is already actively scheduling tasks today keep working without a retroactive consent prompt. New workspaces (no run history) get the D1/Option A flow.
- **2026-08-04 (Jarmo): sprint plan APPROVED** ("Sprint accepted") — with an explicit execution hold. See "Execution Hold" above; approving the plan and deciding D1/D2 does not, by itself, authorize starting implementation.

### D1 detail — Daemon consent model for schedule-triggered runs (R2)

Two options were presented per Jarmo's own framing of the choice; **Option A is selected** (decided 2026-08-04). Option B's full text is kept below as the rejected alternative for the record, not as a live choice.

| | Option A — per-workspace opt-in toast (SELECTED) | Option B — user-level dirs only by default (rejected, kept for the record) |
|---|---|---|
| **Mechanism** | First time the daemon finds a schedule-eligible `.claude/agents`/`.agents` file in a workspace, show a non-blocking notification ("This folder defines N scheduled AI agent(s). Run them automatically here?"). Consent stored per-workspace, reviewable/revocable later in Agent Library. | Workspace-relative scanning is off by default; a new user-level (non-workspace) agents directory is scanned unconditionally. A workspace's own scheduled agents only fire after an explicit per-workspace enable toggle in Agent Library. |
| **Default-safe?** | Only after the first schedule-eligible file is seen — before that, silent (nothing to consent to). | Fully default-safe from the moment a folder is opened — zero prompts, zero surprise, ever. |
| **Friction on the common case** | Low — one toast, once per workspace, then it just works. | Higher — every user, including one who wrote their own trusted per-project scheduled agent, must find Agent Library and flip a switch before their own file ever fires. |
| **New surface required** | Small — a consent-state store (reuses the existing `context.workspaceState` pattern `DaemonResultStore` already uses) + one notification + an Agent Library review/revoke control. | Larger — invents a user-level/global agents directory concept that does not exist anywhere in the current daemon code (`AGENT_DIRS` is 100% workspace-relative today) on top of the same Agent Library control Option A also needs. |
| **Precisely targets the named risk?** | Yes — the risk is schedule-triggered autonomous firing in a workspace the user hasn't vetted; the toast gates exactly that moment. | Yes, but by making the default behavior unconditionally more conservative for everyone, not by targeting the moment of risk. |

**Decided 2026-08-04 (Jarmo): Option A**, matching the recommendation. Rationale (unchanged from the original writeup): it closes the exact gap named in scope with the smallest new mechanism, preserves today's "drop a scheduled agent file in your own project and it works" behavior for the common case, and avoids inventing a user-level directory concept the codebase has no precedent for.

### D2 detail — Legacy workspace transition

For a workspace where the daemon is already actively scheduling tasks today (pre-sprint), does shipping this sprint pause it until the user grants consent, or is "already running before this shipped" treated as implicit legacy consent (grandfathered — no prompt, no service gap)?

**Decided 2026-08-04 (Jarmo): grandfather** (recommendation accepted). A workspace with existing `DaemonResultStore` run history for a given task is evidence the user already has, and is relying on, working scheduled automation there; re-litigating consent for it on upgrade would be a regression dressed up as a safety feature. New workspaces (no run history) get the D1/Option A flow.

D1 and D2 are now resolved and no longer block Phase 2 (W2) *on their own*. The sprint-wide **Execution Hold** (above) still blocks every workstream, including Phase 2, until the v1.8.6 sprint queue reaches Sprint 107 — resolving D1/D2 informs *how* Phase 2 will be built, not *when* it may start.

## Success Criteria

Mirrors [spec.md](./spec.md)'s acceptance criteria at a high level; check only when observably met on a real build.

- [ ] A fresh profile's first `.md` double-click from Finder/Explorer opens directly in the Ritemark editor — no text-editor flash, no trust modal, no Restricted Mode badge (R1).
- [ ] The other five product.json-mapped file types resolve correctly on first launch too, and unmapped types are unaffected (R1).
- [ ] No workspace-trust modal or Restricted Mode badge appears on any launch shape, ever, once patch 013 ships (R2).
- [ ] A schedule-eligible agent file in a workspace that has never been opened before does not fire on its schedule until the user has granted consent per the decided D1 mechanism (R2).
- [ ] Existing users with a stuck plain-text `.md` tab get healed to the Ritemark editor automatically, once, on the first activation after this ships (R3).
- [ ] A user who deliberately reopens a `.md` file as Text Editor after the healer's one-shot marker is set is left alone (R3).
- [ ] A Claude-ready sidebar with no conversation shows the normal composer directly — no "Claude is ready / Get Started" card — while `OnboardingWizard`, `CodexSetupView`, `OpenCodeSetupView`, and the genuine `needsSetup` states are all unaffected (R4).
- [ ] Manual QA matrix in scenarios.md passes on both darwin-arm64 and win32-x64 builds.

## Pre-Implementation Gate

R1 is the highest-risk requirement in this sprint (it patches a VS Code core bootstrap path that runs on every startup). Per the `spec-driven-sprint` skill's audit-first pattern, it received a source-level audit BEFORE this plan was finalized rather than after implementation — see [research/product-json-defaults-audit.md](./research/product-json-defaults-audit.md). The audit's conclusion is **ship, no blocker found**, with the exact minimum-viable diff identified (two files: `product.ts` interface field, `configuration.ts` constructor extension) and the ordering argument that most needed independent verification (does the default-scope value actually reach `EditorResolverService`'s cold-cache hatch?) confirmed by reading `getAllUserAssociations()` directly rather than assumed. A live spike (Phase 0 in tasks.md) still re-verifies this empirically before Phase 1 is considered done — the audit is evidence, not a substitute for running the code.

## Dependencies and Blockers

- No dependency on Sprint 103/104/105 (the Plan/queue/comments critical path) — this sprint is independent and can proceed in parallel, similar to Sprint 106.
- **Execution Hold (see above) blocks every workstream, including branch creation, until the v1.8.6 sprint queue reaches Sprint 107** (sprints 102–106 run first; 103 is currently in progress). This supersedes the sequencing notes below for START timing — they describe internal order once execution begins, not permission to begin early.
- D1 and D2 are decided (2026-08-04, see Product Decisions). R2 (Phase 2/W2) still sequences after R1 (Phase 1/W1) has shipped and passed its live spike, per technical-plan.md's order of implementation — this is an internal ordering note, not an open approval gate.
- R3 and R4 have no blockers beyond the general sprint approval gate, which is satisfied — they still wait for the Execution Hold to lift like everything else in this sprint.
- This sprint's shell-tier patch (013) and product.json-consumption change, combined with R2's trust-posture change, weighs v1.8.6's overall release-type decision toward a full app release (Gate 1 + Gate 2, notarization, Windows CI) rather than an extension-only release — recorded in `release-plan.md`.

## Risks

| Risk | Mitigation |
|---|---|
| A wrong initialization-ordering assumption in R1's patch subtly breaks configuration loading more broadly (not just editor associations) | Phase 0 audit-first review before writing patch code; Phase 0 live spike before Phase 1 is considered done; additive-only change to `DefaultConfiguration`'s constructor (existing web mechanism untouched) |
| R2's consent UX reads as "yet another prompt" if implemented as a blocking modal | Option A is explicitly a non-blocking notification, not a modal; consent is also reviewable/revocable later rather than a one-shot forced choice |
| R3's tab healer touches every user's restored tab state on upgrade; a selection bug could scramble unrelated open tabs | Pure, unit-tested candidate-selection function scoped tightly to file-scheme `.md`/`.markdown` `TabInputText` tabs only; one-shot `globalState` guard prevents repeat runs |
| R4 removes a UI surface that turns out to gate something not caught by this sprint's audit | Traced the entire click handler chain (`dismissWelcome` → store → host message → config write) before scoping R4; no other side effect found. Automatic-firing of the same bookkeeping (technical-plan W4) removes the residual risk of a stale flag |

## Approval Gate

- [x] Jarmo approved creating this SDD sprint plan — 2026-08-04.
- [x] Jarmo has reviewed spec.md/scenarios.md/technical-plan.md/tasks.md and approved the plan's CONTENT for implementation — 2026-08-04 ("Sprint accepted").
- [x] D1 (daemon consent model) decided by Jarmo — 2026-08-04: Option A (per-workspace opt-in toast).
- [x] D2 (legacy workspace transition) decided by Jarmo — 2026-08-04: grandfather.
- [ ] **EXECUTION HOLD lifted** — implementation may not start until the v1.8.6 sprint queue reaches Sprint 107 (sprints 102–106 complete first; 103 is currently in progress). Jarmo's explicit instruction, 2026-08-04 ("ära enne alusta kui järg jõuab kätte 107-le") — not a soft recommendation. See "Execution Hold" above.
- [ ] Sprint branch `sprint-107-clean-start` created — **only after** the hold above is lifted. Branch creation remains the IMMEDIATE FIRST ACTION once execution starts (HARD GATE, unchanged) — no code edit precedes it. No code, patch, or branch exists as of this writing.
