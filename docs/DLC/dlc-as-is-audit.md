# Development Lifecycle AS IS Audit

**Date:** 2026-06-14  
**Scope:** Current Ritemark Native development lifecycle, documentation, GitHub metadata, and agentic harness.  
**Purpose:** Capture how the process works today and where it creates risk before defining the implementation plan.

---

## Audit Summary

Ritemark already behaves like a release-train product:

```text
Release
└── Sprints
    └── GitHub Issues
```

But the current documentation and operating rhythm still mostly treat **sprints as the top-level planning object**. Releases are assembled later from completed sprints, and feature-completeness is decided close to release time.

This AS IS audit records the current strengths and gaps. The implementation plan lives separately in [`dlc-to-be-implementation-plan.md`](./dlc-to-be-implementation-plan.md).

---

## Sources Reviewed

### Repository process docs

-   `AGENTS.md`
    
-   `docs/development/README.md`
    
-   `docs/development/architecture.md`
    
-   `docs/development/release-process/NOTARIZATION.md`
    
-   `docs/development/sprints/ROADMAP.md`
    
-   `docs/development/sprints/WISHLIST.md`
    
-   recent sprint docs, especially:
    
    -   `sprint-72-markdown-navigation-annotations/`
        
    -   `sprint-74-ai-sidebar-composer-polish/`
        
    -   `sprint-76-acp-opencode/`
        
    -   `sprint-77-unified-agent-library-p1/`
        
    -   `sprint-79-runtime-unification/`
        
    -   `sprint-80-scheduled-tasks-daemon/`
        
    -   `sprint-81-excel-editing/`
        
    -   `sprint-82-drawio-diagrams/`
        
    -   `sprint-83-dictation-mic-fix/`
        
-   release docs, especially:
    
    -   `docs/releases/v1.7.2/`
        
    -   `docs/releases/v1.7.3/`
        
    -   `docs/releases/v1.8.0/`
        
    -   `docs/CHANGELOG.md`
        

### Agent/skill process docs

-   `.agents/skills/*/SKILL.md`
    
-   `.claude/agents/sprint-manager.md`
    
-   `.claude/agents/release-manager.md`
    
-   `.claude/agents/qa-validator.md`
    
-   `.claude/agents/pr-reviewer.md`
    
-   `.claude/agents/product-marketer.md`
    
-   `.claude/skills/spec-driven-sprint/SKILL.md`
    
-   `.claude/skills/release/SKILL.md`
    
-   `.claude/settings.json`
    
-   `.github/ISSUE_TEMPLATE/*`
    
-   `.github/PULL_REQUEST_TEMPLATE.md`
    

### Internal docs with lifecycle implications

-   `docs-internal/quality-assurance/README.md`
    
-   `docs-internal/quality-assurance/strategy-overview.md`
    
-   `docs-internal/quality-assurance/implementation-roadmap.md`
    
-   `docs-internal/architecture/high-level-architecture.md`
    
-   `docs-internal/architecture/to-be-proposal.md`
    

### Live GitHub metadata sampled on 2026-06-14

-   Issues up to #121.
    
-   PRs up to #120.
    
-   Notable current examples:
    
    -   v1.8.0 milestone used on issues #110, #111, #116.
        
    -   PRs #113, #114, #115, #118, #120 map to sprints 79, 80, 81, 82, 83.
        
    -   Open architecture issues #105–#109 track multi-sprint technical debt candidates.
        
    -   Issue #119 explicitly points toward task management / GitHub Issues-first boards.
        

* * *

## How the Process Works Today

### 1\. Planning center of gravity: Sprint-first

The operating rhythm is currently:

```text
Pick sprint → plan sprint → branch/implement → QA/PR → later roll into release
```

Evidence:

-   `docs/development/sprints/` is the richest planning area.
    
-   Modern sprints often have strong artifacts:
    
    -   `sprint-plan.md`
        
    -   `spec.md`
        
    -   `scenarios.md`
        
    -   `technical-plan.md`
        
    -   `tasks.md`
        
    -   optional `research/`, `notes/`, mocks, fixtures.
        
-   `.claude/agents/sprint-manager.md` defines detailed sprint sizing, phases, branch gates, and SDD-vs-plain-track logic.
    
-   `.claude/skills/spec-driven-sprint/SKILL.md` is now the most complete requirements discipline in the repo.
    
-   `AGENTS.md` has hard gates around sprint existence, branch naming, and not developing on `main`.
    

This is a good implementation discipline. The weakness is that it starts at sprint level, not release level.

### 2\. Release docs exist, but mostly as packaging/marketing/closeout artifacts

`docs/releases/` is active and valuable. Recent release folders contain:

-   `release-notes.md`
    
-   `changelog.md`
    
-   `TEST-CHECKLIST.md`
    
-   sometimes `MARKETING.md`, `GITHUB_RELEASE.md`, `PRE-RELEASE-AUDIT.md`, screenshots, blog/social files.
    

v1.8.0 is a good example of an implicit release rollup. It names:

-   Sprint 79 — runtime unification.
    
-   Sprint 80 — scheduled tasks daemon.
    
-   Sprint 81 — Excel editing.
    
-   Sprint 82 — draw.io diagrams.
    
-   Sprint 83 — dictation mic fix.
    

The release notes are strong after-the-fact synthesis. The missing artifact is a pre-implementation **release plan** that says, before the sprints begin:

-   why these sprints belong together;
    
-   what is required for v1.8.0 to be feature-complete;
    
-   what is explicitly deferred;
    
-   which GitHub Issues are in/out;
    
-   what risk must be retired before release branching/packaging.
    

### 3\. Release process is strong at shipping gates, not roadmap gates

`.agents/skills/release-process/SKILL.md`, `.claude/agents/release-manager.md`, and `.claude/skills/release/SKILL.md` are detailed and battle-tested for distribution:

-   preflight;
    
-   version bump;
    
-   signed DMG;
    
-   notarization order;
    
-   Gate 1 / Gate 2 human approval;
    
-   update feed publication;
    
-   full vs extension-only release decision.
    

This is release **execution** discipline. It does not define release **planning** discipline.

The release manager asks, "Can this release be safely published?"  
The missing release planner asks, "What is this release, and which sprints/issues must land for it to be complete?"

### 4\. GitHub Issues already act as backlog atoms, but inconsistently

Recent sprint docs and PRs frequently reference issues:

-   Sprint 72 references #79, #80, #81.
    
-   Sprint 74 references #82, #84, #86, #93.
    
-   Sprint 76 implements research from #52 and mentions #92.
    
-   Sprint 81 fixes #110.
    
-   Sprint 82 implements #111.
    
-   Sprint 83 fixes #116.
    

PRs also increasingly encode the mapping:

-   PR #113: Sprint 79.
    
-   PR #114: Sprint 80.
    
-   PR #115: Sprint 81 + issue #110.
    
-   PR #118: Sprint 82 + issue #111.
    
-   PR #120: Sprint 83 + issue #116.
    

But GitHub metadata is not yet canonical:

-   Some issues use milestones (`1.8.0`), others use version labels (`v1.7.3`), others have neither.
    
-   PRs generally do not have milestones, even when they are release-bound.
    
-   The PR template says "Closes #", but does not ask for release or sprint linkage.
    
-   Issue templates capture bug/feature details, but do not ask for release target, sprint candidate, acceptance criteria, or deferral decision.
    

### 5\. There is no explicit Release object in docs

The closest current equivalents are:

-   `docs/releases/vX.Y.Z/release-notes.md` — public-facing narrative.
    
-   `docs/releases/vX.Y.Z/changelog.md` — structured change summary.
    
-   `docs/releases/vX.Y.Z/TEST-CHECKLIST.md` — release test matrix.
    
-   `docs/releases/vX.Y.Z/PRE-RELEASE-AUDIT.md` — used in some versions.
    
-   `docs/development/sprints/ROADMAP.md` — old sprint roadmap, now stale.
    
-   GitHub milestones — used partially.
    

What is missing:

```text
docs/development/releases/vX.Y.Z/release-plan.md
```

or, if we prefer to keep all release planning with release notes:

```text
docs/releases/vX.Y.Z/release-plan.md
```

This document should exist before the first sprint in the release begins.

### 6\. Architecture gates are sprint-level, but release-level risk is not accumulated

`docs/development/architecture.md` has an excellent sprint architecture gate:

-   update architecture docs when module structure, message contracts, feature flags, or binary manifest change;
    
-   keep `Last updated` current.
    

This prevents sprint-local drift. But release-level planning needs a higher aggregation:

-   Which architecture risks are accepted into this release?
    
-   Which sprints depend on each other?
    
-   Which architecture issues are intentionally deferred?
    
-   Does the release leave the architecture in a coherent state?
    

Example: v1.8.0 contains a real dependency chain:

```text
Sprint 79 runtime unification
→ Sprint 80 scheduled tasks daemon
→ Sprint 80/79 approval behavior in release QA
```

The release notes explain this after the fact. A release plan should own it before implementation.

### 7\. QA model is mature but split across locations

Current QA layers:

-   `./scripts/validate-qa.sh`
    
-   `./scripts/release-preflight.sh`
    
-   `.agents/skills/qa-validation/SKILL.md`
    
-   `.claude/agents/qa-validator.md`
    
-   `.github/PULL_REQUEST_TEMPLATE.md`
    
-   `docs-internal/quality-assurance/*`
    
-   sprint `scenarios.md` / `tasks.md`
    
-   release `TEST-CHECKLIST.md`
    

The current practice is good but decentralized. The TO BE release layer should connect them:

```text
Issue acceptance criteria
→ Sprint scenarios/tasks
→ Release test checklist
→ Release gates
```

### 8\. The old roadmap is stale

`docs/development/sprints/ROADMAP.md` says it was last updated around Sprint 19.5. The actual repo is now beyond Sprint 83.

This is not a problem if that file is considered historical. It is a problem if agents/users still discover it as the roadmap.

Recommendation:

-   Freeze it as historical, or archive it.
    
-   Replace with a release-oriented roadmap under `docs/DLC/` or `docs/development/releases/`.
    

### 9\. `.agents` and `.claude` encode two process eras

`.claude` contains a detailed agent-manager era:

-   mandatory sprint manager;
    
-   hard approval gates;
    
-   release manager;
    
-   qa validator;
    
-   product marketer.
    

`.claude/agents/` currently contains named role agents such as `sprint-manager`, `release-manager`, `qa-validator`, `pr-reviewer`, `product-marketer`, `ux-expert`, `vscode-expert`, and `webview-expert`. `.claude/skills/` contains reusable playbooks such as `spec-driven-sprint`, `release`, `feature-flags`, `ritemark-flows`, `ritemark-automation`, and `vscode-development`.

`.agents` currently contains Codex-specific **skills** that are slimmer and more direct:

-   `qa-validation`
    
-   `release-process`
    
-   `feature-flags`
    
-   `vscode-development`
    
-   `webview-development`
    
-   `ritemark-*`
    

There is currently no `.agents/agents/` folder in the repo, but the lifecycle model should reserve that place for Codex/native agent definitions if/when we add them. The important rule is that `.claude/agents`, `.claude/skills`, `.agents/agents`, and `.agents/skills` are all part of the same **agentic harness** and should be visible from release/sprint planning.

Important observation: the process has evolved from Claude-only command-and-control toward a more repo-native, skill-based system. The TO BE docs should not depend on one agent implementation. They should describe the lifecycle in repo terms, and agents/skills should support it.

* * *

## Strengths Worth Preserving

### Strong sprint artifact discipline

The SDD sprint pattern is excellent when scope is complex:

```text
sprint-plan.md      intent/status/decisions
spec.md             behavioral contract
scenarios.md        manual QA matrix
technical-plan.md   implementation map
tasks.md            executable checklist
```

Do not weaken this. Put it under releases.

### Good branch discipline

The rule "one sprint = one feature branch" keeps work reviewable. Preserve it.

### Good QA scripts

`validate-qa.sh` and `release-preflight.sh` are concrete and repo-specific. Preserve and strengthen them.

### Good release execution gates

The Gate 1 / Gate 2 release process is hard-earned institutional knowledge. Preserve it. Release planning should feed it better input, not replace it.

### Good architecture gate

The architecture doc is a living source of truth and should remain a closeout deliverable for architecture-changing sprints.

### Good release notes quality

v1.8.0 release notes are strong because they synthesize "why this release matters." That narrative should be planned earlier, not only written later.

* * *

## Gaps / Failure Modes

### Gap 1 — Release feature-complete definition happens too late

Today a release becomes a bundle of completed sprints. That means feature-complete is partly discovered after implementation.

Risk:

-   Big themes sprawl.
    
-   Critical dependencies are discovered mid-release.
    
-   Release notes become a salvage/synthesis activity instead of the planned story.
    

### Gap 2 — Issue intake is not normalized

Issues can be:

-   feature ideas;
    
-   bugs;
    
-   architecture debt;
    
-   release blockers;
    
-   future epics;
    
-   sprint implementation tasks.
    

But templates do not classify them into the lifecycle.

Risk:

-   Same-sized "issue" can mean one bug fix or a multi-sprint epic.
    
-   Release planning has to infer too much from titles/comments.
    

### Gap 3 — Milestones/labels are inconsistent

Live GitHub metadata shows mixed usage:

-   v1.8.0 milestone exists and is used on some issues.
    
-   v1.7.3 appears as a label.
    
-   many sprint-bound PRs have no milestone.
    

Risk:

-   It is hard to answer "what is in this release?" from GitHub alone.
    
-   Docs and GitHub can drift.
    

### Gap 4 — No canonical dependency map

Some sprints depend on previous sprints. Example:

```text
Sprint 80 scheduled tasks depends on Sprint 79 runtime unification.
```

This is documented inside sprint docs, but not release-owned.

Risk:

-   Parallel sprint planning can start in the wrong order.
    
-   Release scope looks independent when it is not.
    

### Gap 5 — Release docs are mixed public/private/planning artifacts

`docs/releases/vX.Y.Z/` currently contains a mix of:

-   public release notes;
    
-   changelog;
    
-   marketing copy;
    
-   screenshots;
    
-   test checklists;
    
-   pre-release audits.
    

This works, but once release planning starts earlier, we need a clearer distinction between:

-   internal planning;
    
-   release execution;
    
-   public communication.
    

### Gap 6 — Old roadmap competes with newer reality

`docs/development/sprints/ROADMAP.md` is historical but named like a current roadmap.

Risk:

-   Agents or humans may treat stale sprint 20-era planning as current.
    

### Gap 7 — SDD task consistency is manually enforced

`.claude/skills/spec-driven-sprint/SKILL.md` correctly warns that tasks can become a wishlist and that checked boxes need code evidence. But no release-level checklist verifies:

-   issue acceptance criteria satisfied;
    
-   sprint scenarios passed;
    
-   release checklist includes the feature;
    
-   linked issues were updated.
    

### Gap 8 — Architecture debt has no release intake lane

Issues #105–#109 are architecture-level. They are too large to treat like normal feature requests.

Risk:

-   Architecture work either blocks feature releases unexpectedly or gets deferred indefinitely.
    

### Gap 9 — Product/marketing story is late-bound

`product-marketer` and release notes work after release gates. But release-level planning should already know:

-   headline;
    
-   secondary headline;
    
-   what is user-visible;
    
-   what is under the hood;
    
-   what not to mention yet.
    

* * *
