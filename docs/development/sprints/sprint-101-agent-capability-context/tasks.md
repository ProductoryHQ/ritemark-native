# Sprint 101 Tasks — Agent Capability Context

Branch: `sprint-101-agent-capability-context` (created)

## Phase 0: SDD Artifacts + Branch
- [x] Write `spec.md` (R1-R7, full acceptance criteria)
- [x] Write `scenarios.md` (BDD scenarios per requirement, incl. fallback/negative cases)
- [x] Write `technical-plan.md` (shared module design, per-runtime adapters, exact location)
- [x] Jarmo approves sprint-plan.md + SDD artifact set
- [x] `git checkout -b sprint-101-agent-capability-context` (off `main`)
- [x] `git branch --show-current` confirms `sprint-101-agent-capability-context`

## Phase 1: Capability Inventory + Manifest Design
- [x] Enumerate current comments model behavior (on-disk `<!-- -->` / `<mark data-comment>`; `///` is a live-editor rule)
- [x] Enumerate internal links handling (relative-path Markdown links + workspace containment)
- [x] Enumerate slash commands (USER-ONLY; structural blocks achievable as plain Markdown)
- [x] Enumerate diagrams / drawio integration (USER-ONLY; agent may reference `.drawio.svg`, not author)
- [x] Enumerate file operations surface (workspace-bounded, approval-gated, excluded paths)
- [x] Enumerate export capability (USER-ONLY)
- [x] Design shared capability-context module structure (single module, per-capability sections, versioned)
- [x] Module location decided: `src/ai/capabilityContext.ts` (recorded in `technical-plan.md`)
- [x] Per-runtime adapter shape decided: Claude append, Codex base-fix, ACP per-turn once-per-session
- [x] Architecture Gate determination: NOT a gate change (new file in existing `src/ai/`); light architecture.md update done

## Phase 2: Implementation
- [x] Implement `src/ai/capabilityContext.ts` (structured sections + `renderCapabilityContext`)
- [x] `CodexRuntime.ts`: `buildCodexBaseInstructions` — context IS the base; no silent replace
- [x] `AgentRunner.ts` / `ClaudeCodeRuntime.ts`: confirmed existing append path carries the context (no code change needed)
- [x] `AcpRuntime.ts`: `buildAcpPromptText` + once-per-session capability-context injection
- [x] `UnifiedViewProvider.ts`: per-runtime descriptor → `renderCapabilityContext`; asymmetry comment replaced; `BROWSER_ROUTING_HINT` const removed
- [x] `BROWSER_ROUTING_HINT` (now the browser section) reaches Claude + Codex, gated on real browser availability
- [ ] Regression check (live): existing Codex edit turn still applies edits — verify in dev-mode

## Phase 3: Representative Behavior Tests
- [x] Unit: `capabilityContext.test.ts` — 14 checks (content invariants, per-descriptor browser, single-source guard, dry-run structural property)
- [x] Unit: `CodexRuntime.test.ts` Test 10 — `buildCodexBaseInstructions` context-is-base + fallback
- [x] Unit: `AcpRuntime.test.ts` Tests 9–10 — `buildAcpPromptText` order + once-per-session injection
- [ ] Live (dev-mode, per runtime): edit-mode applies to file
- [ ] Live: comments-vs-content ("add a note" → `<!-- -->`, not footnote)
- [ ] Live: honest fallback ("export to PDF")
- [ ] Live: internal link → relative Markdown link
- [x] Write-up of unit-tested vs. manual-QA scope (scenarios.md "Coverage honesty note")

## Phase 4: QA, Cleanup, Docs
- [ ] Run full representative test suite across all three runtimes (dev-mode)
- [x] Maintainability dry-run covered by the structural single-source unit test (Claude≡Codex modulo edit-tool)
- [x] `docs/development/architecture.md` updated (Capability Context subsection)
- [ ] Remove debug code / temp fixtures (none introduced)
- [ ] `qa-validator` for Phase 4→5 sign-off
- [ ] `qa-validator` at merge / prod-build sign-off (bundled into v1.8.5)
- [ ] Close #154 once acceptance criteria met; cross-link #97 as related-but-not-resolved
