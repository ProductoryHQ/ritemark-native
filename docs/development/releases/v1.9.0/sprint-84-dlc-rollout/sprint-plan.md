# Sprint 84 — DLC Rollout

**Status:** ✅ Done — merged to `main` 2026-06-14 (merge commit `ae68c92`, PR [#122](https://github.com/ProductoryHQ/ritemark-native/pull/122)). QA passed; pr-reviewer APPROVED.  
**Parent release:** `docs/development/releases/v1.9.0/release-plan.md`  
**Branch:** `sprint-84-dlc-rollout`  
**Track:** Lightweight process/documentation sprint  

## Goal

Implement the new development lifecycle canon so repo docs, GitHub templates, and agentic harness instructions consistently use **Release → Sprints → GitHub Issues**.

## Success Criteria

- [x] `docs/DLC/dlc-as-is-audit.md` and `docs/DLC/dlc-to-be-implementation-plan.md` are final and internally consistent.
- [x] `AGENTS.md` points to the new DLC canon and reflects release-first planning.
- [x] GitHub issue templates include lightweight lifecycle fields.
- [x] PR template includes release/sprint/issues/release-notes/architecture fields.
- [x] `.agents` skills impacted by DLC are updated.
- [x] `.claude` agents/skills impacted by DLC are updated or have a compatibility note.
- [x] A scheduled `harness-equalizer` agent exists to check `.claude/**` and `.agents/**` drift twice daily.
- [x] `harness-equalizer` is written as a proper work-instruction (Role/Objective/Process/Output/Constraints) with a directional **CLAUDE → CODEX** governance model.
- [x] Claude role agents are mirrored into Codex as `.codex/agents/*.toml` subagents (verified format, not the dead-config `.agents/agents/*.md`).
- [x] No implementation code changes are mixed into this sprint.

## Implementation Checklist

### 1. DLC docs

- [x] Review `docs/DLC/dlc-as-is-audit.md` for stale TO BE content.
- [x] Review `docs/DLC/dlc-to-be-implementation-plan.md` for AS IS leftovers and terminology drift.
- [x] Remove remaining inconsistent terms, old global sprint folder assumptions, and stale issue states.

### 2. Repo guidance

- [x] Update `AGENTS.md` with the new canonical hierarchy.
- [x] Document that release-bound sprints live under `docs/development/releases/vX.Y.Z/`.
- [x] Document GitHub milestone creation when release enters `Mapped` state.

### 3. GitHub templates

- [x] Update `.github/ISSUE_TEMPLATE/bug_report.md` with release impact fields.
- [x] Update `.github/ISSUE_TEMPLATE/feature_request.md` with candidate release/sprint fields.
- [x] Update `.github/PULL_REQUEST_TEMPLATE.md` with lifecycle linkage fields.

### 4. Agentic harness

- [x] Update `.agents/skills/release-process/SKILL.md` for release-plan/milestone prechecks.
- [x] Update `.agents/skills/qa-validation/SKILL.md` for release tracker checks before ready/ship handoff.
- [x] Update `.agents/skills/sprint-workflow/SKILL.md` only as opt-in behavior: parent release folder awareness, no auto-invocation.
- [x] Update `.claude/agents/sprint-manager.md` to treat release as parent object.
- [x] Update `.claude/agents/release-manager.md` and `.claude/skills/release/SKILL.md` to require release plan + milestone before packaging.
- [x] Update `.claude/agents/qa-validator.md` / `pr-reviewer.md` with release/sprint/issue checks.
- [x] Add `.claude/agents/harness-equalizer.md` with Ritemark `schedule:` frontmatter for twice-daily harness comparison.
- [x] Clarify that `.agents/skills` are Codex skills, not equivalents of `.claude/agents`; compare them only by responsibility coverage.
- [x] Remove the obsolete Sprint 80 test fixture `.claude/agents/s1-daily-brief.md` (`enabled: false` happy-path scheduler agent, no live code references) — in-scope harness cleanup, approved by Jarmo 2026-06-14.

### 5. Directional harness equalizer + Codex role-agents (added 2026-06-14, Jarmo-approved plan)

- [x] Rewrite `.claude/agents/harness-equalizer.md` as a work-instruction: Role / Objective / Process / Output / Constraints; directional **CLAUDE → CODEX** (the equalizer never edits the Claude canon, only flags it); `schedule:` frontmatter unchanged.
- [x] **Verification:** confirmed from two primary sources (official `developers.openai.com/codex/subagents` + GitHub issue `openai/codex#18823`) that Codex role agents are `.codex/agents/*.toml` (`name`/`description`/`developer_instructions`), **not** `.agents/agents/*.md` — the latter would have been dead config.
- [x] Create `.codex/agents/*.toml` for the 8 domain role agents: pr-reviewer, qa-validator, release-manager, sprint-manager, vscode-expert, webview-expert, product-marketer, ux-expert. Each points to its matching Codex skill where one exists.
- [x] Skip Claude-runtime-only agents (`harness-equalizer`, `knowledge-builder`) — recorded as intentional asymmetry.
- [x] Document the directional canon + `.codex/agents/` convention in `AGENTS.md` (new "Harness Governance" subsection).
- [x] Validate all 8 TOML files parse with the 3 required fields; `scheduleParser.test.ts` still green.

## Testing / Verification Procedure

This sprint is process/docs-only, so success is verified by consistency checks and scenario walkthroughs rather than product UI tests.

### 1. Structure check

- [x] `docs/DLC/dlc-as-is-audit.md` exists.
- [x] `docs/DLC/dlc-to-be-implementation-plan.md` exists.
- [x] `docs/development/releases/v1.9.0/release-plan.md` exists.
- [x] This sprint lives under its parent release folder: `docs/development/releases/v1.9.0/sprint-84-dlc-rollout/sprint-plan.md`.
- [x] `.claude/agents/harness-equalizer.md` exists and has enabled schedule frontmatter.
- [x] No new files are added under the old global sprint path for this sprint.

Suggested command:

```bash
test -f docs/DLC/dlc-as-is-audit.md
test -f docs/DLC/dlc-to-be-implementation-plan.md
test -f docs/development/releases/v1.9.0/release-plan.md
test -f docs/development/releases/v1.9.0/sprint-84-dlc-rollout/sprint-plan.md
grep -q 'name: harness-equalizer' .claude/agents/harness-equalizer.md
grep -q 'cron: "0 9,21 \\* \\* \\*"' .claude/agents/harness-equalizer.md
```

### 2. Terminology consistency check

- [x] The TO BE plan uses the hierarchy **Release → Sprints → GitHub Issues**.
- [x] The TO BE plan does not recommend a separate release ledger file.
- [x] GitHub Issue states are only `Open → In sprint → Done` plus side states.
- [x] Release state starts at `Mapped`, not a heavyweight discovery gate.

Suggested command:

```bash
grep -RIn "release-ledger\\|status:triage\\|status:accepted\\|status:planned" docs/DLC/dlc-to-be-implementation-plan.md docs/development/releases/v1.9.0/release-plan.md
```

Expected: no stale lifecycle recommendations. Contextual historical mentions in the AS IS audit are acceptable only if clearly described as AS IS.

### 3. Template/harness walkthrough

Manually walk these three scenarios and mark pass/fail in this sprint plan:

- [x] **Scenario A — New mapped release:** A future agent can read the TO BE plan and know to create a GitHub milestone plus `docs/development/releases/vX.Y.Z/release-plan.md` stub.
- [x] **Scenario B — New sprint:** A future agent can tell that release-bound sprint folders belong under `docs/development/releases/vX.Y.Z/`, not under the old global sprint folder.
- [x] **Scenario C — Existing GitHub issue:** A future agent can classify an issue as `Open`, move it to `In sprint`, and close it as `Done` without inventing extra lifecycle states.
- [x] **Scenario D — Harness drift:** The scheduled `harness-equalizer` can compare Claude and Codex harness files without treating itself as a separate lifecycle authority.

### 4. Diff scope check

- [x] Diff contains only documentation, templates, and agentic harness instruction changes (including the harness-file deletion of `s1-daily-brief.md`).
- [x] No product implementation files under `extensions/ritemark/src`, `extensions/ritemark/webview/src`, or `patches/vscode` changed unless explicitly approved.

Suggested command:

```bash
git diff --name-only
```

### 5. QA command

Before closeout, run the repo QA gate if any executable scripts/templates/hooks are changed. Result: `./scripts/validate-qa.sh` passed on 2026-06-14.

Targeted schedule check for the new `harness-equalizer` agent: `cd extensions/ritemark && npx tsx src/daemon/scheduleParser.test.ts` passed on 2026-06-14.

## Non-Goals

- No product feature implementation.
- No release packaging.
- No task-board automation.
- No GitHub milestone mutation unless Jarmo explicitly asks.

## Open Questions

1. Has GitHub milestone `v1.9.0` been created? **Resolved: yes, created 2026-06-14.**
2. Should this process rollout be tracked as a GitHub issue? **No issue created during this sprint; release plan keeps the tracker.**
3. Should `.claude/**` be updated now, or only after Codex-side docs/templates are finalized? **Resolved: updated now for harness compatibility.**
