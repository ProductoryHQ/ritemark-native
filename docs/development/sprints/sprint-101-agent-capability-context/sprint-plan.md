# Sprint 101: Improve Agent System Prompt with Comprehensive Ritemark Capability Context

Track: SDD (auto-detected — see rationale below)
Override with: "use plain full track"
Release tier: extension
Branch: `sprint-101-agent-capability-context` (create immediately after Jarmo approves this plan — no code before that)

## Track Decision

**Recommend SDD.** Signals present:
- ≥3 distinct user-facing/behavioral requirements once decomposed (edit-mode applies changes to the active file; selection+surrounding-context used safely; document content vs. editor metadata distinguished; native-capability awareness across comments/links/slash-commands/diagrams/file-ops; explicit fallback with no invented support).
- Multi-component: three runtime-specific prompt injection mechanisms (Claude SDK `systemPrompt.append`, Codex `baseInstructions`/`extraSystemPrompt` REPLACE, ACP per-turn text injection with no system-prompt concept at all) plus a new shared capability-context module that must feed all three correctly.
- This is exactly the shape Sprint 72 (the canonical SDD worked example per the `spec-driven-sprint` skill) used for annotation/comment behavior — a behavior contract with acceptance criteria per capability domain, verified through representative scenarios, is a better fit than a plain checklist.
- Mid-scope-expansion risk is real: "comprehensive capability context" naturally invites scope creep (new capabilities get added to Ritemark between when this plan is written and when it ships); SDD's requirement-ID discipline and Mid-Sprint Scope Change Protocol are the right tool for that.

Recommend pulling `.claude/skills/spec-driven-sprint/SKILL.md`. As with Sprint 99, `spec.md`/`scenarios.md`/`technical-plan.md` do not exist yet — they are the remainder of Phase 2 and must be authored before Phase 3 branch/code work starts. This sprint-plan.md drafts provisional requirement numbers below as a starting point for `spec.md`.

Jarmo can override with "use plain full track" if the SDD ceremony feels like overkill once the capability inventory (Phase 1) turns out smaller than expected.

## Release Context

**Decided (Jarmo, 2026-07-21):** this sprint ships in the same **v1.8.5** release as Sprints 98–100, sequenced LAST (98 → 99 → 100 → 101). Rationale for the ordering: prompt-injection code paths (`AgentRunner.ts`, `CodexRuntime.ts`, `AcpRuntime.ts`) are also touched by Sprint 99's multi-session work, so letting session-lifecycle changes settle first avoids this sprint rebasing against a moving target. (Version note: 1.9.0 is reserved by Jarmo for potential cloud capabilities — this bundle is v1.8.5 despite carrying a shell-tier release.)

## Goal

Rewrite/expand the agent system prompt into an authoritative, maintainable capability description so agents (Claude Code, Codex, OpenCode) behave like Ritemark-native collaborators rather than generic chat assistants: they apply edits directly instead of describing them, use selection/surrounding context correctly, know about Ritemark-specific features (comments, internal links, slash commands, diagrams, file ops), and clearly decline when a capability genuinely isn't available rather than inventing support for it.

## Linked Issues

- #154 — primary issue this sprint closes
- #97 — cross-runtime conversation context: NOTE the synergy (both touch runtime-specific prompt/context plumbing) but do NOT scope-creep into #97's actual ask (shared context across DIFFERENT runtimes' conversations). This sprint's shared module makes capability context consistent ACROSS runtimes; it does not make conversation state itself shared across runtimes — that stays #97's separate concern.

## Origin

An ERGO memo session surfaced the concrete failure: the agent correctly discussed Markdown footnote syntax but had no awareness of Ritemark's own comment system — a native capability it should have reached for instead.

## Current-State Ground Truth (verified — cite in spec.md/technical-plan.md)

Three runtimes use three DIFFERENT, non-shared prompt mechanisms today:

1. **Claude Code** — SDK call `systemPrompt: { preset: 'claude_code', append: fullAppend }` at `src/agent/AgentRunner.ts:833`; `fullAppend` = `safetyAppend` + `_extraSystemPromptAppend` (`AgentRunner.ts:817-818`), with `_extraSystemPromptAppend` set from config at `:474`. Claude's mechanism is APPEND-based — whatever capability context this sprint adds gets appended to Claude's own baseline, not replacing it.
2. **Codex** — `CODEX_BASE_INSTRUCTIONS` const at `src/codex/CodexRuntime.ts:30` (short, ~5 sentences, already somewhat Ritemark-aware but minimal), passed as `baseInstructions` at `:264`. Critically, `config.extraSystemPrompt` currently REPLACES `CODEX_BASE_INSTRUCTIONS` entirely rather than appending to it.
3. **OpenCode/ACP** — NO system-prompt mechanism exists at all today. Only per-turn text injection (`[Currently editing: ...]` + context blocks) at `src/acp/AcpRuntime.ts:115-123`.

**Documented asymmetry:** `src/views/UnifiedViewProvider.ts:286-288` explicitly notes "extraSystemPrompt is APPENDED by Claude Code but REPLACES Codex's" — as a direct consequence, only Claude currently receives `BROWSER_ROUTING_HINT`. This sprint must fix this asymmetry, not merely add more text on top of it (adding capability context on top of an append/replace mismatch would make Codex WORSE — replacing its already-Ritemark-aware base instructions with something that doesn't include them).

**The natural seam:** `runtime/AgentRuntime.ts:32` already has `extraSystemPrompt?: string` in the shared `RuntimeSessionConfig` — this is the existing single config field all three adapters read from. The fix is a shared capability-context module feeding this field, PLUS per-runtime injection adapters that each honor their own runtime's actual mechanism (append for Claude, append-not-replace for Codex once fixed, per-turn injection for ACP since it has no system-prompt concept).

## Provisional Requirements (draft numbering for `spec.md`)

- **R1 — Edit-mode applies changes directly.** When acting in an editing context, the agent applies changes to the active file rather than describing them in chat prose.
- **R2 — Selection-aware, context-safe editing.** The agent uses the active selection and surrounding document context correctly when it's relevant, without leaking irrelevant or stale context into unrelated requests.
- **R3 — Document content vs. editor metadata distinction.** The agent correctly distinguishes Markdown document content from Ritemark-native editor metadata (comments are the running example — anchored to text ranges, not part of the Markdown body) and doesn't confuse the two.
- **R4 — Native capability awareness.** The agent knows about and correctly reaches for Ritemark-native features when appropriate: comments, internal links, slash commands, diagrams (drawio), file operations, export.
- **R5 — Honest fallback.** When a requested capability genuinely isn't available, the agent says so clearly rather than inventing/hallucinating support for it.
- **R6 — Unified injection across runtimes.** The append/replace asymmetry between Claude and Codex is fixed; OpenCode gets an equivalent per-turn capability-context injection path since it has no system-prompt mechanism. All three runtimes receive materially the same capability context, expressed through each runtime's own native mechanism.
- **R7 — Single-source maintainability.** Capability-context text lives in exactly ONE shared module; adding a new capability to Ritemark requires editing that one module, not three runtime-specific files.

Non-Requirements (explicit):
- Full resolution of #97 (shared conversation context/state ACROSS runtimes) — this sprint only unifies the CAPABILITY-DESCRIPTION text/mechanism, not conversation state.
- Redesigning the underlying capabilities themselves (comments model, drawio integration, etc.) — this sprint describes existing capabilities accurately, it does not add new ones.
- A user-facing settings UI for capability context (no such UI is planned; this is prompt-engineering + plumbing, not a user setting).

## Feature Flag Check

- Does this sprint need a `features/flags.ts` feature flag? **Likely NO.** This is a prompt-content and prompt-plumbing change — reversible by a straightforward revert of the shared module + the two adapter fixes, with no data migration, no schema change, and no risk of leaving users in a broken state if rolled back. Unlike Sprint 99's store reshape, there's no persisted-state blast radius here. Document this reasoning in `spec.md`'s "Resolved Questions" once finalized; revisit only if the capability-inventory phase (Phase 1) surfaces something riskier than expected (e.g. if fixing the Codex append/replace behavior turns out to change existing tool-use behavior non-trivially).

## Success Criteria

- [ ] Representative test suite demonstrates agents pick the CORRECT native Ritemark capability for representative requests (comments vs. plain text, internal links vs. plain paste, slash commands, diagrams, file ops) across all three runtimes
- [ ] Edit-mode requests result in changes actually applied to the active file, not just described in chat
- [ ] Selection + surrounding context is used correctly and safely (verified via representative scenarios, not just code review)
- [ ] Agent correctly distinguishes document content from editor metadata (comments) in representative tests
- [ ] Agent gives a clear, honest fallback message when a capability is genuinely unavailable, in at least one deliberately-unsupported-request test case per runtime
- [ ] Codex `extraSystemPrompt` no longer REPLACES `CODEX_BASE_INSTRUCTIONS` — appends to it (or an equivalent structural fix), and `BROWSER_ROUTING_HINT` (or its successor) reaches Codex the same way it reaches Claude
- [ ] OpenCode/ACP receives an equivalent capability-context injection despite having no system-prompt mechanism
- [ ] Capability-context text lives in exactly one shared module; adding a capability is demonstrated to require editing only that module (a dry-run addition during QA, e.g. a placeholder capability, proves this without shipping it)
- [ ] `docs/development/architecture.md` updated if the shared module changes the structure of `src/runtime/` (Sprint Architecture Gate check — confirm during Phase 2 whether this rises to that bar)

## Deliverables

| Deliverable | Description |
|-------------|--------------|
| `spec.md` | R1-R7 (or renumbered) with acceptance criteria — authored before Phase 3 |
| `scenarios.md` | BDD scenarios per requirement, incl. the fallback/honesty negative cases |
| `technical-plan.md` | Shared capability-context module design + per-runtime injection adapters |
| Shared capability-context module (new, `src/ai/` or `src/runtime/` — exact location decided in Phase 1/technical-plan.md) | Single source of truth for capability text, structured (e.g. per-capability sections) not a single prose blob |
| `CodexRuntime.ts` append/replace fix | `extraSystemPrompt` appends to `CODEX_BASE_INSTRUCTIONS` instead of replacing it |
| `AgentRunner.ts` injection wiring | Confirms Claude continues to receive the shared module via its existing append path |
| `AcpRuntime.ts` injection path | New per-turn capability-context injection alongside existing `[Currently editing: ...]` context blocks |
| `UnifiedViewProvider.ts` update | Resolves the documented asymmetry note at `:286-288` (update the comment once fixed, don't leave a stale note describing an asymmetry that no longer exists) |
| Representative test suite | Small suite covering editing/comments/links/diagrams/file-ops across runtimes — mix of unit-testable plumbing checks and manual/CDP-harness behavior checks, clearly labeled which is which |

## Implementation Checklist (phases — see `tasks.md` for the granular tracker)

### Phase 0: SDD Artifacts
- [ ] Author `spec.md` (R1-R7, acceptance criteria)
- [ ] Author `scenarios.md` (BDD examples incl. negative/fallback cases)
- [ ] Author `technical-plan.md` (shared module design, per-runtime adapters, exact module location)
- [ ] Jarmo approves sprint-plan.md + SDD artifact set

### Phase 1: Capability Inventory + Manifest Design
- [ ] Enumerate the ACTUAL current tool/feature surface: comments model (Sprint 94/97 behavior), internal links, slash commands, diagrams (drawio integration), file operations, export — grounded in the real code, not assumed from memory
- [ ] Design the capability-context module structure: single module, per-capability sections, versioned so drift from the real tool surface is detectable
- [ ] Decide exact module location and per-runtime adapter shape (Claude append, Codex append-fix, ACP per-turn injection)
- [ ] Confirm whether this qualifies as a Sprint Architecture Gate change (new module at `src/<subsystem>/` level) — record the determination in `technical-plan.md`

### Phase 2: Implementation
- [ ] Implement the shared capability-context module per Phase 1's design
- [ ] Fix `CodexRuntime.ts` extraSystemPrompt append/replace asymmetry
- [ ] Confirm/adjust `AgentRunner.ts` Claude append path continues to work with the new shared module
- [ ] Implement ACP per-turn capability-context injection in `AcpRuntime.ts`
- [ ] Update `UnifiedViewProvider.ts:286-288` comment to reflect the fixed (not asymmetric) behavior
- [ ] Confirm `BROWSER_ROUTING_HINT` (or equivalent) now reaches all three runtimes consistently

### Phase 3: Representative Behavior Tests
- [ ] Unit-testable plumbing checks: shared module content reaches each runtime's actual config/message correctly (mockable, no live agent needed)
- [ ] Representative live-behavior suite (small, explicitly scoped) via flow-testing / ritemark-automation CDP harness: editing applies to file, comments vs. content distinction, internal link handling, slash command awareness, diagram awareness, file-ops awareness, honest fallback on an unsupported request
- [ ] Explicit write-up of what's unit-testable vs. what remains manual QA — do not overstate automated coverage of live agent behavior

### Phase 4: QA, Cleanup, Docs
- [ ] Run representative test suite across all three runtimes
- [ ] Update `docs/development/architecture.md` if Phase 1 determined this is a Sprint Architecture Gate change
- [ ] Remove debug code / temp fixtures
- [ ] Recommend `qa-validator` for Phase 4→5 sign-off
- [ ] Recommend `qa-validator` again for prod-build sign-off (if bundled into a release) or at merge (if shipped as a standalone extension update)

## QA / Manual Test Plan

| Scenario | How to test |
|----------|--------------|
| Edit-mode applies directly | Ask the agent to make a specific text change; confirm the active file changes rather than the agent describing the change in chat, across all three runtimes |
| Selection-aware editing | Select a specific range, ask for a targeted change; confirm the agent uses the selection correctly and doesn't touch unrelated document regions |
| Comments vs. content | Ask the agent something that requires distinguishing a Ritemark comment from document body text; confirm it doesn't conflate the two |
| Native capability reach | Representative requests per capability: add an internal link, use a slash command, reference/insert a diagram, perform a file operation, export — confirm the agent reaches for the RIGHT native capability rather than a generic text-based workaround |
| Honest fallback | Deliberately request something genuinely unsupported; confirm the agent says so plainly rather than inventing a fake capability |
| Cross-runtime consistency | Same representative request run against Claude, Codex, and OpenCode; confirm materially equivalent capability awareness across all three (allowing for each runtime's own native mechanism) |
| Codex append fix | Confirm Codex's base instructions are no longer silently replaced when `extraSystemPrompt`/capability context is present |
| Maintainability dry-run | Add a placeholder capability entry to the shared module only; confirm all three runtimes reflect it without touching runtime-specific files (then revert the placeholder before shipping) |

## Sprint Exit: Dev-Mode Self-Validation (MANDATORY — before any handoff to Jarmo)

**Standing rule (Jarmo 2026-07-21):** Claude runs dev mode and validates the sprint's results HIMSELF before telling Jarmo anything is ready. Jarmo must never be the first person to find out the work doesn't run.

1. Launch dev mode: `/rundev` (`./vscode/scripts/code.sh` from project root — serves from `out/`; remember CSS/static assets do not auto-copy from `src/` to `out/`).
2. Drive the running instance and verify representative capability prompts per runtime — edit-applies-to-file, selection-aware edit, comments-vs-content, and the honest-fallback case. Use the `ritemark-automation` CDP harness for scripted UI verification and screenshots; check the console for errors.
3. Fix whatever fails and re-verify — do not hand over a known-broken build.
4. Only then notify Jarmo: state what was verified, attach/describe evidence (screenshots for UI work), and name exactly what he should look at.

This step sits BEFORE `qa-validator` sign-off and before any release gate. It is not optional and not delegable to Jarmo.

## Risks

- "Comprehensive capability context" is an open-ended target — Phase 1's inventory could surface more surface area than expected. If so, apply the Mid-Sprint Scope Change Protocol (new R-numbers, not silent expansion of existing ones) rather than letting scope balloon unnoticed.
- Fixing Codex's append/replace behavior touches an existing, working code path (`CodexRuntime.ts:264`) — must be verified not to regress current Codex behavior for sessions that don't use `extraSystemPrompt` at all.
- Live-agent behavior testing is inherently harder to pin down than unit tests — be honest in Phase 3 about what's actually verified vs. what's "looks right in a few manual runs." Don't let the representative test suite overclaim coverage.
- Sequencing with Sprint 99: both sprints touch `AgentRunner.ts`/`CodexRuntime.ts`/`AcpRuntime.ts`. Landing after Sprint 99 (as planned) avoids a rebase, but if Sprint 99 slips, re-confirm this sprint's prompt-injection changes still apply cleanly against whatever session-lifecycle shape Sprint 99 actually shipped.

## Status

**Track:** SDD (approved 2026-07-23)
**Current Phase:** Implementation complete + dev-mode self-validated — awaiting Jarmo's own dev validation, then qa-validator + merge into the v1.8.5 bundle
**Self-validation (2026-07-23):** #154 flagship scenario driven live in dev mode on **Claude** and **Codex** — both applied the edit directly and used the Ritemark `<!-- … -->` comment carrier (not a Markdown footnote), preserving the existing `<mark data-comment data-comment-id="c1">`. OpenCode/ACP delivery unit-proven only (BYOK not configured in the dev profile). 38 unit assertions green (capabilityContext 14, Codex 11, ACP 13); clean typecheck + bundle.

## Approval

- [ ] Jarmo approved this sprint plan (and, for SDD track, the completed spec.md/scenarios.md/technical-plan.md set once authored)

**Awaiting Jarmo approval — no code until approved.**
