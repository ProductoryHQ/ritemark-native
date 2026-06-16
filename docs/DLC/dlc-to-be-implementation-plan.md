# Development Lifecycle TO BE Implementation Plan

**Date:** 2026-06-14  
**Scope:** Implementation plan for moving Ritemark Native to an explicit **Release → Sprints → GitHub Issues** lifecycle.  
**Source audit:** [`dlc-as-is-audit.md`](./dlc-as-is-audit.md)

---

## Implementation Thesis

Keep the existing sprint and release execution disciplines, but add a lightweight release-planning layer above them:

- releases get a GitHub milestone as soon as they appear on the map;
- sprints live under their parent release folder;
- GitHub Issues are the backlog atoms;
- `release-plan.md` is the internal source of truth for scope, sprint map, issue intake, risks, and feature-complete state;
- `docs/releases/vX.Y.Z/` stays focused on release execution and publishing assets.

### Multi-repo extension (2026-06-16 governance migration)

The lifecycle described here remains the **per-repo** canon. It is now wrapped by a **multi-repo governance layer**, defined canonically in the parent governance repo: `ritemark-dev/governance/dev-process-model.md`. In short:

- **Sprints are repo-scoped; a release may be single- or cross-repo.** Each repo keeps the in-repo `release-plan.md` + sprint structure described here, unchanged.
- A **cross-repo release** is coordinated by a *register* at `ritemark-dev/releases/vX.Y.Z/release-register.md`, which maps the participating repo sprints. The register sits **on top of** each repo's `release-plan.md`; it does not replace it.
- Backend work lives in the separate private `ritemark-cloud` repo (D1 locked: `ritemark-dev/decisions/D1-backend-repo-placement.md`).

---

## Target Lifecycle

### Canonical hierarchy

```text
Release
├── Release plan
├── Sprint 1
│   ├── GitHub Issue(s)
│   ├── Sprint docs
│   ├── PR(s)
│   └── QA evidence
├── Sprint 2
│   └── ...
└── Release closeout
    ├── Release test checklist
    ├── Changelog
    ├── Release notes
    ├── Marketing/screenshots if needed
    ├── Update feed metadata
    └── Release gates
```

### New planning flow

```text
1. Release discovery / audit
2. Release plan
3. Issue triage into release
4. Sprint slicing
5. Sprint implementation
6. Sprint closeout into the release plan tracker section
7. Release feature-complete review
8. Release execution gates
9. Release publication
10. Post-release learning / backlog re-triage
```

The main change is steps 1–4. Current process is strong from step 5 onward.

* * *

## Proposed Document Structure

### Separate development planning from publishing

The lifecycle should use a small two-folder model:

-   `docs/development/releases/vX.Y.Z/` for internal planning.
    
-   `docs/releases/vX.Y.Z/` for release execution and public-facing assets.
    

Keep this deliberately lightweight. The development side starts as **one living release plan**, not a folder full of process files.

```text
docs/development/releases/v1.9.0/
├── release-plan.md          # release-level scope, sprint map, issue intake, risks, feature-complete
├── sprint-84-task-boards/   # sprint folder belongs to this release
│   ├── sprint-plan.md
│   ├── spec.md             # only for SDD/complex sprints
│   ├── scenarios.md
│   ├── technical-plan.md
│   └── tasks.md
└── sprint-85-polish/
    └── sprint-plan.md

docs/releases/v1.9.0/
├── TEST-CHECKLIST.md
├── changelog.md
├── release-notes.md
└── screenshots/             # optional, only when release notes need images
```

The rules:

-   **One internal release planning document** per release: `docs/development/releases/vX.Y.Z/release-plan.md`.
    
-   **One public/release folder** per release: `docs/releases/vX.Y.Z/`.
    
-   Do not create separate tracker/risk/feature-complete files by default.
    
-   Put those concerns as sections inside `release-plan.md`:
    
    -   sprint map;
        
    -   issue intake;
        
    -   risks/blockers;
        
    -   feature-complete checklist;
        
    -   decisions log.
        
-   Keep `docs/DLC/` as the process-design and templates area, not as the active release planning area.
    

Supporting process structure:

```text
docs/DLC/
├── dlc-audit-as-is-to-be.md       # this file
├── release-planning-playbook.md   # next doc
├── issue-triage-playbook.md       # next doc
└── templates/
    ├── release-plan.md
    └── sprint-closeout-to-release.md

docs/development/releases/
└── vX.Y.Z/
    ├── release-plan.md
    ├── sprint-NN-name/
    │   └── sprint-plan.md
    └── sprint-NN-next/
        └── sprint-plan.md

docs/releases/
└── vX.Y.Z/
    ├── TEST-CHECKLIST.md
    ├── changelog.md
    ├── release-notes.md
    └── screenshots/
```

Escalation rule: default to one `release-plan.md`. If a release becomes noisy, simplify sections inside that file before adding more process files.

GitHub rule: as soon as a release appears on the roadmap/map, create the matching GitHub milestone (`vX.Y.Z`). The milestone is the shared external reference for parallel agents working in separate worktrees; `release-plan.md` is the shared internal reference.

* * *

## Proposed Release Plan Template

```markdown
# Release vX.Y.Z Plan — [Theme]

**Status:** Mapped | Planned | In progress | Feature complete | Release candidate | Shipped  
**Target:** vX.Y.Z  
**GitHub milestone:** `vX.Y.Z` — create as soon as this release is on the map  
**Release type:** Full app | Extension-only | Patch  
**Release owner:** Jarmo  
**Engineering owner:** Agent/session/branch owner  
**Created:** YYYY-MM-DD  

## Release Thesis

One paragraph: why this release exists.

## User-Facing Headlines

1. Primary headline
2. Secondary headline
3. Supporting improvement

## Scope Envelope

### In scope
- ...

### Out of scope / explicitly deferred
- ...

## Feature-Complete Definition

- [ ] Sprint A done and merged
- [ ] Sprint B done and merged
- [ ] Linked P0/P1 issues closed or explicitly deferred
- [ ] Architecture doc updated if needed
- [ ] Release test checklist covers every user-facing feature
- [ ] Changelog/release notes draft exists

## Sprint Plan

| Sprint | Purpose | Issues | Dependency | Target PR | Status |
|---|---|---|---|---|---|
| sprint-NN-name | ... | #123, #124 | none | TBD | planned |

## GitHub Issue Intake

| Issue | Type | Decision | Sprint | Notes |
|---|---|---|---|---|
| #123 | feature | include | sprint-NN | ...
| #124 | bug | include if time | sprint-NN+1 | ...
| #125 | architecture | defer | future | ...

## Risk Register

| Risk | Severity | Owner | Retirement plan | Status |
|---|---|---|---|---|

## Release QA Strategy

- Sprint scenarios that must roll up into `TEST-CHECKLIST.md`.
- Cross-platform coverage.
- Manual test owner.
- Automation required before Gate 1.

## Documentation/Marketing Strategy

- User docs to update.
- Release notes angle.
- Screenshots needed.
- Known limitations to disclose.

## Decisions Log

| Date | Decision | Source |
|---|---|---|
```

* * *

## Proposed Release Plan Tracker Section

Keep a lightweight tracker table inside `release-plan.md`:

```markdown
## Sprint / Issue / PR Tracker

| Sprint | Branch | PR | Issues | Merge status | QA status | Release-note status |
|---|---|---|---|---|---|---|
| sprint-79-runtime-unification | sprint-79-runtime-unification | #113 | #102 | merged | pass/partial | drafted |
| sprint-80-scheduled-tasks-daemon | sprint-80-scheduled-tasks-daemon | #114 | — | merged | partial manual | drafted |
```

Rules:

-   Every release-bound sprint appears here.
    
-   Every release-bound issue appears here or in the release plan's deferral table.
    
-   PR merge does not equal release done.
    
-   QA status must distinguish automated, dev-mode manual, packaged app, and cross-platform.
    
* * *

## Shared State Machines

These state machines are intentionally simple. They give parallel agents in different worktrees the same reference points without requiring a heavy project-management system.

### Release state machine

**Source of truth:** `docs/development/releases/vX.Y.Z/release-plan.md` + GitHub milestone `vX.Y.Z`.

```text
Mapped
  → Planned
  → In progress
  → Feature complete
  → Release candidate
  → Shipped
```

Side states:

-   `Blocked` — a blocker prevents progress, but the release is still intended.
    
-   `Deferred` — release moved out of the active horizon.
    
-   `Cancelled` — release/theme intentionally abandoned.
    

State meanings:

| State | Meaning | Required reference point |
| --- | --- | --- |
| Mapped | Release exists as a candidate/theme on the roadmap. | GitHub milestone created; stub `release-plan.md` may exist. |
| Planned | Scope envelope, candidate sprints, and issue intake are written. | `release-plan.md` has sprint map + feature-complete definition. |
| In progress | At least one release sprint is active. | Tracker table has active sprint rows. |
| Feature complete | All included sprints are merged or explicitly deferred. | Milestone has no untriaged release blocker; tracker complete. |
| Release candidate | Packaging/release gates have started. | `TEST-CHECKLIST.md` exists; release-process gates active. |
| Shipped | Release published. | GitHub release + update feed published; release notes final. |

### Sprint state machine

**Source of truth:** sprint folder under its release + release-plan tracker row.

```text
Proposed
  → Planned
  → In progress
  → In review
  → Merged
  → Closed
```

Side states:

-   `Blocked` — cannot proceed without a decision, dependency, or failing-gate fix.
    
-   `Deferred` — removed from this release but may return later.
    
-   `Split` — scope divided into multiple sprints/issues.
    

State meanings:

| State | Meaning | Required reference point |
| --- | --- | --- |
| Proposed | Sprint is a candidate slice for a release. | Row in release plan sprint map. |
| Planned | Sprint folder and `sprint-plan.md` exist. | Sprint folder under `docs/development/releases/vX.Y.Z/`. |
| In progress | Branch/worktree implementation is active. | Branch/PR referenced in release tracker. |
| In review | PR opened or review/QA underway. | PR linked from release tracker. |
| Merged | PR merged to `main`. | Tracker row updated; linked issues updated. |
| Closed | Sprint closeout is complete. | QA/release-note/architecture impacts recorded. |

### GitHub Issue state machine

**Source of truth:** GitHub issue labels + milestone, mirrored in the release plan issue table.

```text
Open
  → In sprint
  → Done
```

Side states:

-   `Blocked` — accepted but blocked by an external decision/dependency.
    
-   `Deferred` — explicitly out of the current release.
    
-   `Split` — replaced by child issues or sprint-specific tasks.
    
-   `Won't do` — intentionally rejected.
    

State meanings:

| State | Meaning | Required reference point |
| --- | --- | --- |
| Open | Issue exists in GitHub and may or may not be release-bound yet. It is not inside an active sprint. | Type/severity labels when useful; milestone set if release-bound; release plan issue table updated if relevant. |
| In sprint | Issue is assigned to an active sprint and may be in implementation or PR review. | Sprint listed in issue comment/table; PR linked when one exists. |
| Done | Shipped into `main` or closed as completed. | Issue closed; release notes impact recorded if user-facing. |

Minimum labels needed if using labels:

-   `status:open`
    
-   `status:in-sprint`
    
-   `status:blocked`
    
-   `status:deferred`
    
-   `status:done`
    

* * *

## Agentic Harness Canon

Release planning should also declare which agentic harness is expected to operate on the work. This is not a separate lifecycle layer; it is the execution support system for the **Release → Sprints → GitHub Issues** hierarchy.

### Harness folders

```text
.claude/
├── agents/                 # Claude role agents: release-manager, qa-validator, pr-reviewer, etc.
└── skills/                 # Claude reusable playbooks: release, spec-driven-sprint, ritemark-flows, etc.

.agents/
├── agents/                 # reserved for Codex/native repo agents when introduced
└── skills/                 # Codex skills: qa-validation, release-process, feature-flags, etc.
```

Current AS IS note: `.agents/agents/` does not exist yet. That is fine. The TO BE process should still reserve it so the repo has one obvious place for Codex/native role agents later.

Important distinction: `.agents/skills` is **not** the Codex equivalent of `.claude/agents`. `.agents/skills` maps most closely to `.claude/skills`: reusable procedural playbooks. `.claude/agents` are role agents. Until Codex/native role agents exist in this repo, compare `.claude/agents` to `.agents/skills` only by **responsibility coverage**, not by artifact type.

### Implementation impact

When we implement this DLC, update the agentic harness so agents follow the new source-of-truth hierarchy instead of the old sprint-first habit.

| Harness part | Change needed |
|---|---|
| `AGENTS.md` | Add the canonical hierarchy, release milestone rule, release/sprint/issue state machines, and sprint folders under `docs/development/releases/vX.Y.Z/`. |
| `.agents/skills/release-process` | Add a pre-release-planning check: active release must have `release-plan.md`, GitHub milestone, tracker, and feature-complete state before release execution gates start. |
| `.agents/skills/qa-validation` | Check/update the parent release plan tracker before any ready/ship handoff. |
| `.agents/skills/sprint-workflow` | If used explicitly, create/update sprint folders under the parent release folder, not global `docs/development/sprints/`. |
| `.claude/agents/sprint-manager` | Mirror the new Release → Sprint → Issue model and stop treating sprint docs as the top-level object. |
| `.claude/agents/release-manager` + `.claude/skills/release` | Require the GitHub milestone and release plan state before version bump / packaging. |
| `.claude/agents/qa-validator` + `pr-reviewer` | Verify PRs link release, sprint, and issues; verify release-plan tracker updates. |
| `.claude/agents/product-marketer` | Pull release story from `docs/development/releases/vX.Y.Z/release-plan.md` before drafting public release notes. |
| `.claude/agents/harness-equalizer` | Add a Ritemark-scheduled, twice-daily harness drift checker that compares `.claude/**` and `.agents/**` process responsibilities and proposes/applies minimal alignment fixes through scheduled-run review. It must not imply that `.agents/skills` are Codex role agents. |
| Future `.agents/agents/` | If added, make role agents read/write the same release plan + milestone state, not private agent-local state. |

Keep this as harness maintenance, not extra release paperwork.

* * *

## Proposed GitHub Issue Taxonomy

### Issue type labels

Keep GitHub labels simple and decision-oriented:

-   `type:bug`
    
-   `type:feature`
    
-   `type:architecture`
    
-   `type:qa`
    
-   `type:release`
    
-   `type:docs`
    
-   `type:research`
    

Current `bug` and `enhancement` can remain, but the release planning system benefits from stricter labels.

### Lifecycle labels

-   `status:open`
    
-   `status:in-sprint`
    
-   `status:blocked`
    
-   `status:deferred`
    
-   `status:done`
    

### Release labels or milestones

Prefer **milestones** for release membership:

-   `v1.9.0`
    
-   `v2.0.0`
    
-   `Backlog`
    

Use labels only for non-exclusive classification. Avoid mixing `v1.7.3` label with `1.8.0` milestone style.

Create the milestone as soon as the release is in `Mapped` state, even before all sprints are known. This gives every parallel worktree/agent a stable shared target.

### Sprint labels

Optional but useful:

-   `sprint-84`
    
-   `sprint-85`
    

Do not rely on sprint labels as the only release mapping. Sprint labels are implementation grouping; milestone is release grouping.

### Suggested issue frontmatter/comments

Every issue accepted into a release should have:

```markdown
## Lifecycle

- Release target: vX.Y.Z
- Sprint candidate: sprint-NN-name
- Decision: include | defer | split | research first
- Acceptance criteria:
  - [ ] ...
- Release-note impact: none | changelog | release-notes headline | docs/user update
```

* * *

## Proposed PR Template Changes

Current PR template asks for "Closes #", test steps, and a checklist. Add lifecycle mapping:

```markdown
## Lifecycle

- Release: vX.Y.Z / none
- Sprint: sprint-NN-name / none
- Issues: closes #...
- User-facing change: yes/no
- Release notes needed: yes/no
- Architecture doc touched/needed: yes/no
```

Add closeout checks:

```markdown
- [ ] Release plan tracker updated, if release-bound
- [ ] Linked issues updated/closed/deferred
- [ ] Sprint docs updated
- [ ] Release notes/changelog updated or explicitly not needed
```

* * *

## Proposed Issue Template Changes

### Bug report additions

```markdown
## Severity / Release Impact

- Blocks current release? yes/no/unknown
- Regression from version:
- Workaround:
```

### Feature request additions

```markdown
## Lifecycle Fit

- Candidate release:
- Candidate sprint:
- Is this a headline feature, supporting feature, or polish?
- Is research/audit needed before implementation?
```

### Architecture issue template

Create a third template for architecture/technical debt:

```markdown
## Architecture Area

## Current Cost

## Proposed Direction

## Release Impact

## Sprint Slicing Idea

## Risks If Deferred
```

This is especially relevant for open issues #105–#109.

* * *

## Proposed Lifecycle Gates

### Gate A — Release Discovery Gate

When a release first appears on the map:

- [ ] GitHub milestone `vX.Y.Z` created as soon as the release appears on the map;
- [ ] a minimal `release-plan.md` stub exists, even if most sections are `TBD`;
- [ ] one-line release idea/theme written;
- [ ] known "must consider" issues added if obvious.

Do **not** require full issue triage, dependency mapping, or deferral decisions at this gate. This gate is only a shared reference point so parallel agents/worktrees can point at the same release.

### Gate B — Release Plan Gate

Before implementation sprints start:

- [ ] `release-plan.md` exists;
- [ ] release thesis or scope paragraph written;
- [ ] sprint list exists, even if later sprints are rough;
- [ ] feature-complete definition exists;
- [ ] GitHub milestone link is recorded in `release-plan.md`;
- [ ] issues assigned to milestone or deferred.
- [ ] obvious dependencies, blockers, and known deferrals recorded.

### Gate C — Sprint Entry Gate

Before a sprint begins:

- [ ] sprint maps to one release, or explicitly says "not release-bound";
- [ ] sprint issues are listed;
- [ ] branch name and PR target are clear;
- [ ] SDD/plain/lightweight track selected if needed;
- [ ] release plan tracker row added.

### Gate D — Sprint Closeout Gate

Before marking sprint done:

- [ ] PR merged or explicitly not merged;
- [ ] issues closed/updated/deferred;
- [ ] scenarios/tasks verified;
- [ ] release plan tracker updated;
- [ ] release notes/changelog impact recorded;
- [ ] architecture doc updated if applicable.

### Gate E — Release Feature-Complete Gate

Before release packaging starts:

- [ ] all release sprints done or explicitly deferred;
- [ ] open release milestone contains no untriaged blocker;
- [ ] release plan tracker complete;
- [ ] `TEST-CHECKLIST.md` covers all user-facing changes;
- [ ] known limitations documented;
- [ ] release notes draft matches shipped scope.

### Gate F — Existing Release Execution Gates

Keep the current release-manager/release-process gates:

-   preflight;
    
-   signed DMG;
    
-   Gate 1 human testing;
    
-   hardening / notarization;
    
-   CI platform fan-out;
    
-   Gate 2 human testing;
    
-   GitHub release;
    
-   update feed publication.
    

* * *

## Release-Level Slicing Rules

### Rule 1 — One release can contain multiple sprints

This is already true in v1.8.0. Make it explicit.

### Rule 2 — One sprint should normally belong to one release

Avoid one sprint partially shipping in multiple releases unless it is intentionally split.

### Rule 3 — One GitHub Issue may be split across sprints, but only with explicit sub-issues or checklist sections

If an issue is too large:

-   split the issue into smaller issues; or
    
-   keep the epic issue open and create child issues.
    

### Rule 4 — Architecture epics need release strategy

Architecture issues (#105–#109 style) should be accepted into a release only when the release plan says:

-   what user or developer outcome it enables;
    
-   what risk it retires;
    
-   how it is sliced;
    
-   what is allowed to remain unfinished.
    

### Rule 5 — Patches and release packaging work require release-level risk review

Any work touching:

-   `patches/vscode/`
    
-   `branding/`
    
-   `.github/workflows/`
    
-   `scripts/build*`
    
-   signing/notarization/update feed
    

should appear in the release risk register, not just sprint tasks.

* * *

## Example: Recasting v1.8.0 in the TO BE Model

v1.8.0 currently reads as:

```text
Release v1.8.0
├── Sprint 79 Runtime unification
├── Sprint 80 Scheduled tasks daemon
├── Sprint 81 Excel editing
├── Sprint 82 draw.io diagrams
└── Sprint 83 Dictation mic fix
```

In the TO BE model, the release plan would likely have said:

### Release thesis

Make Ritemark stronger for technical/document-heavy work: diagrams, scheduled agents, editable spreadsheets, and a unified agent architecture.

### Feature-complete definition

- [x] Runtime unification merged because scheduled agents need runtime factory/approval consistency.
- [x] Scheduled tasks usable while app is open.
- [x] Excel editing basic value-editing scope works.
- [x] draw.io markdown embedding works offline.
- [x] dictation mic regression fixed or explicitly deferred as release blocker.

### Issue intake

-   #110 included in Sprint 81.
    
-   #111 included in Sprint 82.
    
-   #116 included in Sprint 83.
    
-   #105–#109 deferred as future architecture releases, except the pieces touched by Sprint 79/82.
    

### Release risk register

-   Draw.io vendoring size/licensing/offline behavior.
    
-   Daemon safe approval model.
    
-   Runtime unification regression across Claude/Codex/OpenCode.
    
-   Excel save/hot-exit behavior.
    
-   Microphone permissions on Electron 39/macOS Tahoe.
    

This is mostly what happened. The improvement is making it visible before the work starts.

* * *

## Migration Plan

### Phase 1 — Document the new lifecycle

Create:

-   `docs/DLC/release-planning-playbook.md`
    
-   `docs/DLC/issue-triage-playbook.md`
    
-   `docs/DLC/templates/release-plan.md`
    

Update:

-   `AGENTS.md` with release-level planning rules.
    
-   `.github/PULL_REQUEST_TEMPLATE.md`
    
-   `.github/ISSUE_TEMPLATE/*`
    

### Phase 2 — Pilot on next release

For v1.9.0 or the next planned version:

-   create `docs/development/releases/vX.Y.Z/release-plan.md`;
    
-   create GitHub milestone `vX.Y.Z`;
    
-   triage candidate issues into include/defer/split;
    
-   define sprint sequence before first implementation sprint;
    
-   maintain the sprint/issue/PR tracker section inside `release-plan.md` during PRs.
    

### Phase 3 — Close the loop after release

After the release ships:

-   compare release plan vs shipped release notes;
    
-   record scope changes and why;
    
-   update templates;
    
-   archive or mark stale roadmap files.
    

### Phase 4 — Automate only after the manual routine works

Following the QA strategy principle: automate only after manual routine catches real risk.

Possible later automation:

-   script checks that every sprint in release plan has a tracker row;
    
-   script checks that release milestone issues are all closed/deferred before release preflight;
    
-   script extracts issue/PR/sprint mappings into release notes draft;
    
-   script validates PR template lifecycle fields.
    

* * *

## Concrete Recommendations

### R1 — Create release planning as a first-class docs area

Add:

```text
docs/development/releases/
docs/DLC/templates/
```

### R2 — Use GitHub milestones for releases

Use milestones as release membership. Avoid version labels for release membership.

### R3 — Add a tracker section to each active release plan

This becomes the operational bridge between docs and GitHub without adding another file.

### R4 — Update issue templates

Add lifecycle fields to bug/feature templates and create an architecture issue template.

### R5 — Update PR template

Require release/sprint/issues/release-notes/architecture fields.

### R6 — Archive or relabel stale roadmap

`docs/development/sprints/ROADMAP.md` should become either:

-   `docs/development/sprints/ROADMAP-archive.md`; or
    
-   a short pointer to the new release roadmap.
    

### R7 — Add "sprint closeout to release" checklist

Every sprint should answer:

-   Which release?
    
-   Which issues?
    
-   Which PR?
    
-   User-facing change?
    
-   Release notes updated?
    
-   Architecture updated?
    
-   QA evidence?
    

### R8 — Treat architecture issues as release candidates, not loose debt

Open architecture issues #105–#109 should be grouped into one or more release themes, not randomly pulled into feature sprints.

### R9 — Keep release execution gates separate from release planning gates

Do not overload the current release-process skill. It is good at shipping gates. Add a planning layer before it.

### R10 — Make issue #119 a design input, not an immediate implementation

Issue #119 ("Task management: federated task boards (GitHub Issues first) with AI handoff") aligns with this lifecycle shift. But first define the manual Release → Sprint → Issue process; then design task-board automation around it.

* * *

## Open Questions for Jarmo

1.  **Where should active release plans live?**  
    Recommendation: `docs/development/releases/vX.Y.Z/`, with public release assets remaining in `docs/releases/vX.Y.Z/`.
    
2.  **Should GitHub milestones become mandatory for release-bound issues and PRs?**  
    Recommendation: yes for issues, optional but recommended for PRs.
    
3.  **Should releases have names/themes beyond version numbers?**  
    Example: "v1.8.0 — Documents for technical writers" or "v1.9.0 — Task management foundation".
    
4.  **How far ahead should release planning go?**  
    Recommendation: one release actively planned, one release sketched, backlog beyond that.
    
5.  **Should architecture debt be planned as dedicated architecture releases or mixed into feature releases?**  
    Recommendation: both are valid, but every architecture issue needs an explicit release decision.
    
6.  **How much should live in the public release folder?**  
    Recommendation: keep `docs/releases/vX.Y.Z/` lean: `TEST-CHECKLIST.md`, `changelog.md`, `release-notes.md`, and screenshots only when needed. Generate/add `PRE-RELEASE-AUDIT.md`, `github-release.md`, or `MARKETING.md` only for releases that actually need them.
    
7.  **Do we want a GitHub "epic" convention?**  
    GitHub Issues does not natively enforce hierarchy. We can use labels and linked issues, or adopt a parent/child convention manually.
    

* * *

## Suggested Next Step

Do not implement automation yet.

First create the manual playbook and pilot it on the next release:

1.  Draft `docs/DLC/release-planning-playbook.md`.
    
2.  Draft `docs/DLC/templates/release-plan.md`.
    
3.  Pick next target release.
    
4.  Create its single-file release plan under `docs/development/releases/vX.Y.Z/release-plan.md`.
    
5.  Triage current open issues into:
    
    -   include;
        
    -   defer;
        
    -   split;
        
    -   research first.
        

Once one release has successfully run this way, automate the repetitive parts.
