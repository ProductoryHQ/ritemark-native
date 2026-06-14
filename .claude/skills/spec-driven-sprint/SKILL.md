---
name: spec-driven-sprint
description: >
  Spec-driven sprint playbook for Ritemark — five-artifact SDD structure
  (spec, scenarios, technical-plan, tasks, sprint-plan) with mid-sprint
  scope-change protocol and audit-first pattern for risky requirements.
  Use when sprint-manager flags an SDD-track sprint, or when the user
  explicitly invokes "spec-driven", "SDD", or "R1/R2/..." numbering.
allowed-tools: Read, Write, Edit, Glob, Grep
metadata:
  version: 1.0.0
---

# Spec-Driven Sprint Playbook

This is Ritemark's lightweight repo-local spec-driven development convention. It is NOT a clone of GitHub Spec Kit or a heavy formal SDD framework — it is the five-artifact structure that Sprint 72 stabilised, with explicit rules for keeping artifacts and code in agreement.

## When to Use This Skill

Pull this skill **at the start of a full-track sprint** when ANY of these holds:

- The sprint description lists **three or more distinct user-facing requirements** (signs: numbered list of behaviours, multiple linked issues, words like "and" / "plus" between scope chunks).
- The sprint touches **edge cases that are hard to surface from code review alone**: path traversal, link classification, permission boundaries, symlink resolution, cross-platform path handling, security gates.
- The sprint crosses **multiple components**: webview ↔ bridge ↔ extension host ↔ filesystem / external command.
- Mid-sprint scope expansion is likely (an unfinished feature on top of a larger flow).

If the sprint is a **single-domain fix, refactor, or build tweak**, do NOT pull this skill — sprint-manager's lightweight track is sufficient and the SDD ceremony is dead weight.

## The Five Artifacts

All five live under `docs/development/releases/vX.Y.Z/sprint-NN-short-name/` for release-bound sprints. Always create them in this order — each builds on the previous.

### 1. `spec.md` — the behaviour contract

**Purpose:** unambiguous statement of what the sprint must deliver, written from the user's point of view, with explicit acceptance criteria.

Structure:

```markdown
# Sprint NN Spec

## Purpose
[2-3 sentence statement of the user value this sprint delivers.]

## Principles
- [Principle 1 — e.g. "Preserve Markdown portability"]
- [Principle 2]

## Requirements

### R1: [Short title]
As a [user role], I want [behaviour], so [outcome].

Acceptance criteria:
- [Concrete, testable assertion 1]
- [Concrete, testable assertion 2]

### R2: [...]

## Non-Requirements
- [What is explicitly NOT in scope]

## Resolved Questions
[Document decisions made during the sprint, with rationale]

## Open Questions
[Real unknowns]
```

**Hard rules:**
- Every requirement gets a stable ID (`R1`, `R2`, `R3a`, …). These IDs travel through scenarios, tech plan, tasks, code comments, and commit messages.
- Acceptance criteria are **concrete and testable**. "Works well" is not an acceptance criterion. "Cmd-click on a Markdown link opens it in Ritemark's custom editor" is.
- When scope changes mid-sprint, **add a new requirement** (R7, R8, …) rather than editing an existing one. Old requirements are part of the audit trail.

### 2. `scenarios.md` — BDD-style behaviour examples

**Purpose:** concrete examples that pin down what each requirement looks like in use. These become the manual QA matrix for free.

Structure:

```markdown
# Sprint NN Scenarios

## Feature: [Name, ties to R1]

### Scenario: [Short title]
Given [context]
When [user action]
Then [observable outcome]
And [further observable outcome]
```

**Hard rules:**
- One scenario per concrete behaviour. Two scenarios for the same requirement are fine if they show different paths (happy path, edge case, refusal).
- Negative scenarios (rejection paths) are required for any requirement that has security or correctness implications (path traversal, missing files, dangerous protocols).
- These scenarios become the manual QA checklist in `tasks.md` Phase 5/QA. **Do not duplicate** — `scenarios.md` is the source, `tasks.md` checkboxes refer back to it.

### 3. `technical-plan.md` — architecture and implementation approach

**Purpose:** how the spec and scenarios will be delivered. Implementation-oriented but not yet code.

Structure:

```markdown
# Sprint NN Technical Plan

## Architecture Overview
[Which components touch this sprint and how they communicate]

## Workstream 1: [Name]

### Extension Host
[What lands where, message shapes, helper module names]

### Webview Side
[UI components, TipTap extensions, bridge calls]

### Tests
[Unit-test candidates, manual smokes]

## Workstream 2: [...]
```

**Hard rules:**
- One workstream per logical chunk of work. Workstreams map roughly to requirements but not always 1:1 — sometimes one workstream serves two requirements (e.g. shared helper).
- Code snippets in the tech plan are **proposed shapes**, not the final code. The final code may diverge — when it does, update tech plan first, then change code.
- If a workstream proposes a new module or file, list its path. The tasks list later references those paths.

### 4. `tasks.md` — the implementation checklist

**Purpose:** the running progress tracker. Status here is the source of truth for "what is done" — but ONLY when it agrees with the code (see Discrepancy Detection below).

Structure:

```markdown
# Sprint NN Tasks

## Phase 1: [...]
- [ ] [Concrete task, ties to a workstream or requirement]

## Phase N: QA and Closeout
- [ ] Run focused automated tests
- [ ] Run `./scripts/validate-qa.sh`
- [ ] Update `docs/CHANGELOG.md`
- [ ] Update relevant release notes
- [ ] Update linked GitHub issues
- [ ] Commit and push
```

**Hard rules:**
- Tasks are **physical artefacts** (files written, functions implemented, tests added), not goals ("make it work").
- When marking `[x]`, the corresponding code change must already exist on the active branch. **Do not pre-tick** — that lies to the next person and gets caught later (see Discrepancy Detection).
- Manual QA matrix lives under Phase N (the final phase) and refers back to `scenarios.md`.

### 5. `sprint-plan.md` — the higher-level intent

**Purpose:** the doc you give a stakeholder who wants to know what this sprint is about without reading the spec. Includes linked issues, status, product decisions, success criteria.

Structure (already in sprint-manager's "Full template" — extend with):

```markdown
## SDD Artifacts

- [spec.md](spec.md) is the product and behavior contract.
- [technical-plan.md](technical-plan.md) records the architecture.
- [scenarios.md](scenarios.md) captures behavior examples.
- [tasks.md](tasks.md) is the implementation checklist.
```

**Hard rules:**
- Status line at the top: track (`SDD`), current phase, branch, worktree.
- Success Criteria list mirrors spec.md's acceptance criteria at high level — checkbox per criterion, ticked only when the criterion is observably met.
- Product decisions are documented inline with date stamps. When a decision changes mid-sprint, **add a new entry** dated to today, don't overwrite the old one.

## Mid-Sprint Scope Change Protocol

When the sprint owner expands or alters scope after Phase 2, **update docs first, code second.** Order matters:

1. **`spec.md`** — add the new requirement (R7, R8, …) with full acceptance criteria. Or, if revising an existing requirement, leave the original entry in place and add a "(revised YYYY-MM-DD)" addendum. Do NOT silently rewrite history.
2. **`scenarios.md`** — add BDD scenarios for the new requirement, including negative cases.
3. **`technical-plan.md`** — add a new workstream, or note where the change lands in existing workstreams.
4. **`tasks.md`** — add a new phase (Phase N+1: …) with concrete tasks.
5. **`sprint-plan.md`** — update MVP Scope and Status; add a Product Decision entry dated today explaining the why.

**Only then** start writing code for the new scope.

The audit trail this leaves is the entire point of SDD. A future reader can answer "when and why did R7 appear?" without git-blame archaeology.

## Audit-First for Risky Requirements

When a requirement is high-risk (might be impossible, might require parser surgery, might fail on a platform we don't have), put a **dedicated audit** under `research/` BEFORE implementation:

```
docs/development/releases/vX.Y.Z/sprint-NN/research/
└── <topic>-audit.md   # e.g. comment-callout-audit.md
```

The audit captures:
- What we tested and how (fixtures, paths exercised)
- What we observed (concrete failure modes, surviving cases)
- The decision: **ship**, **defer with blockers documented**, or **partial ship with scope reduction**
- Precise blockers if deferred, so the next sprint starts from a known-good baseline

The Sprint 72 audit for comment callouts (`research/comment-callout-audit.md`) saved several days of TipTap parser work by surfacing the marked → Turndown round-trip gap before any code was written. Replicate this pattern for anything that smells risky.

## Requirement ID Discipline

Requirement IDs (`R1`, `R7`, `R3a`) travel from spec.md through every artifact and into the code. Specifically:

| Location | Format |
| --- | --- |
| `spec.md` | `### R7: Internal Link Navigation` |
| `scenarios.md` | `## Feature: Internal Link Navigation` (with R-ID in feature description) |
| `technical-plan.md` | `## Workstream 7: Internal Link Navigation (R7)` |
| `tasks.md` | `## Phase 7: Internal Link Navigation (R7) + cleanup (added YYYY-MM-DD)` |
| `sprint-plan.md` Implementation Notes | "- `R7`: Implemented and verified ..." |
| Code comments | `// Sprint NN R7: setNodeMarkup-based level change` |
| Commit message | `fix(sprint-NN): address Codex PR #89 review (R7 host/path + anchor)` |

This makes `grep -rn "R7"` a real cross-artefact query. Without ID discipline, every doc update is hand-correlated.

## Discrepancy Detection (the "lied tasks.md" pattern)

The most common SDD failure: `tasks.md` shows `[x]` for items that aren't actually done in code. This is what Sprint 72's first dev verification caught — Phase 4 was marked complete but the TOC right-click code didn't exist on the branch.

This is a **manual discipline, not an automated check.** A grep-driven "did you type `setHeadingLevel` somewhere?" verifies naming, not correctness — the implementer could satisfy the grep without satisfying the requirement. The real safety nets are code review (the `pr-reviewer` agent + human PR review) and manual dev verification of every requirement.

What to actually do:

1. **Before ticking `[x]`, verify the code change is on the active branch.** `git diff main...HEAD -- <file>` should show the work; `git log --oneline main..HEAD` should reference the requirement. If you cannot point at a commit that did the work, do not tick the box.
2. **At Phase 4/QA, walk every `[x]`-ed task and ask "where is this in the code?"** For a task like `Add \`setHeadingLevel\` helper`, that means opening `headingUtils.ts` and confirming the function exists. For a task like `Wire context menu`, that means opening the component and confirming the JSX is there.
3. **When in doubt, demote `[x]` back to `[ ]`** rather than ship a lie. Sprint 72's first dev verification did exactly this for Phase 4 and reopened the work.
4. **Trust pr-reviewer and the human reviewer to catch what discipline misses.** Sprint 72's Codex review caught two P1 issues the unit tests had not anticipated; that is the safety net that actually fires.

## Anti-Patterns to Avoid

- **Editing requirements in place.** R3 today is not allowed to mean something different from R3 yesterday. Add R3a, R3b, or a new R-number; preserve history.
- **`tasks.md` as wish list.** Tasks are physical artefacts ("Write `setHeadingLevel` in `headingUtils.ts`"), not goals ("Make TOC level changes work nicely").
- **Skipping scenarios.md.** Without it, the manual QA matrix at sprint-end is improvised; verification gaps slip through.
- **Audit-after-implementation.** Auditing a requirement after writing the code defeats the purpose — the code shapes the audit's conclusions. Audit first or accept the risk.
- **One giant commit at sprint-end.** SDD-track sprints land cleaner if work is committed per workstream during Phase 3. The sprint-end PR can still be squash-merged (Ritemark convention), but the WIP branch keeps a useful history for the reviewer.

## Output Expectations

When you (the agent) are operating under this skill:

- Reference requirement IDs in code comments and commit messages.
- Before writing code for a new requirement, confirm the requirement exists in `spec.md`. If not, either pause for spec update or write the spec first.
- When a scope change is requested mid-sprint, refuse to write code until the Mid-Sprint Scope Change Protocol above is followed.
- At Phase 4 / QA / sprint-end, walk every `[x]`-ed task and confirm the matching code change is on the active branch before declaring "ready to commit". This is a manual discipline; no automated check enforces it.

## See Also

- `sprint-manager` agent — picks SDD vs plain full track at sprint kickoff and surfaces the decision for user override.
- `qa-validator` agent — runs the build / patches / TypeScript / debug-code gate at sprint-end. It does **not** check `[x]`-vs-code consistency (see Discrepancy Detection above for why that is a manual discipline).
- `pr-reviewer` agent — the real safety net for "did the code do what `tasks.md` claimed?" — catches what discipline misses.
- Historical Sprint 72 (`docs/development/sprints/sprint-72-markdown-navigation-annotations/`) is the canonical worked example — read its spec.md, scenarios.md, technical-plan.md, tasks.md, and sprint-plan.md to see this skill in practice.
