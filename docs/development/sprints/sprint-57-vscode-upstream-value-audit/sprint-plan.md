# Sprint 57: VS Code Upstream Value Audit

## Status

In Progress - Phase 3 upgrade implementation checkpointed on `1.117.0`.

## Context

Ritemark's VS Code OSS base is currently on `1.109.5` from Sprint 41. Since then, upstream VS Code has moved through weekly Stable releases (`1.110` through `1.117`) and has a rolling `1.118` update page as of April 24, 2026.

The goal of this sprint is not just to "catch up" mechanically. The useful question is whether upstream now contains capabilities that can make Ritemark feel more valuable, calmer, faster, or more agent-native for real users.

## Goal

Audit the VS Code upstream delta from `1.109.5` to the latest practical target, identify user-facing opportunities for Ritemark, and prepare a low-risk upgrade plan that protects existing Ritemark branding, layout, extension loading, and document-first workflows.

## User-Value Hypothesis

The most promising upstream value for Ritemark users is in four areas:

1. Better agent workflows: permissions, background sessions, debug logs, customizations, agent app patterns, and terminal/browser tooling.
2. Better document and media context: image/video carousel, binary/image file support, screenshots and browser artifacts inside chat.
3. Better trust and admin controls: MCP sandboxing, network filters, clearer agent permissions.
4. Better extension and platform base: TypeScript 6, Python environments, webview tab icons, portable mode API, and terminal fixes that may reduce custom patch burden.

## Scope

- Audit upstream release notes and tags from `1.110` through the current latest update page.
- Pick a recommended upgrade target: stable tag first, rolling page only if a tag exists and build scripts can consume it cleanly.
- Map upstream changes to Ritemark user value, not only developer maintenance value.
- Identify patch-stack risk against:
  - `patches/vscode/001-ritemark-branding.patch`
  - `patches/vscode/002-ritemark-ui-layout.patch`
  - `patches/vscode/003-ritemark-menu-cleanup.patch`
  - `patches/vscode/004-ritemark-build-system.patch`
  - `patches/vscode/005-ritemark-windows-and-oss-fixes.patch`
  - `patches/vscode/006-ritemark-dev-launch-fallback.patch`
- Produce a decision memo before implementation.

## Out of Scope

- Updating the `vscode/` submodule in the same step as sprint setup.
- Rebasing or rewriting the patch stack before the audit is accepted.
- Release packaging, notarization, or distribution changes.
- Enabling upstream Copilot-specific features as Ritemark product features without a privacy/product decision.

## Deliverables

- [x] Initial research memo: `research/upstream-value-audit.md`
- [x] Target-version decision: exact upstream tag and fallback tag
- [x] Patch-risk matrix after submodule diff inspection
- [x] User-value shortlist with "ship / explore / ignore" decisions
- [x] Implementation checklist for a follow-up update phase
- [x] Validation checkpoint using `./scripts/validate-qa.sh`

## Suggested Phases

### Phase 1 - Audit and decision

- [x] Initialize the `vscode/` submodule in this sprint branch/worktree.
- [x] Verify current local base and upstream tags.
- Compare release notes and selected commits from `1.109.5` to the chosen target.
- [x] Decide whether to target `1.117.0` immediately or wait for a clean `1.118.0` tag.

### Phase 2 - Patch impact spike

- [x] Run `./scripts/apply-patches.sh --dry-run` on the unchanged base.
- [x] Move the submodule to the target tag in a throwaway checkpoint.
- [x] Re-run patch dry-run and classify conflicts by patch.
- [x] Identify whether conflicts are pure context drift, product decisions, or broken invariants.

### Phase 3 - Upgrade implementation

- [x] Update the submodule.
- [x] Repair the patch stack in the smallest coherent changes.
- Preserve Ritemark invariants from Sprint 41:
  - [x] Ritemark branding and About dialog
  - [x] right-side AI/sidebar behavior
  - [x] terminal not restored into editor area
  - [x] extension loading and markdown editor rendering
  - [x] no unwanted startup permission prompts

### Phase 4 - Product-value enablement

- Turn only proven upstream improvements into Ritemark-facing product changes.
- Prefer low-friction defaults and guarded settings over noisy new UI.
- Document any feature flags or admin/privacy decisions needed before exposure.

## Success Criteria

- Ritemark has a clear upstream target and rationale.
- The team knows which upstream changes are genuinely valuable for Ritemark users.
- Patch-stack risks are known before implementation begins.
- The implementation phase can start without rediscovering Sprint 41 lessons.
- Before merge/readiness, the branch passes `./scripts/validate-qa.sh` and the relevant VS Code compile/smoke checks.

## Current Findings

- `vscode/` submodule initialized successfully in this worktree.
- Baseline confirmed locally: VS Code OSS `1.109.5`.
- Existing patch stack applies cleanly to the current base: `6/6` patches pass `./scripts/apply-patches.sh --dry-run`.
- Target spike completed on `1.117.0`.
- Patch spike result on raw `1.117.0`: `1/6` patches applied cleanly and `5/6` conflicted.
- Repair result on the upgraded tree:
  - `001-ritemark-branding.patch` rebased and validated by reverse/apply round-trip.
  - `002-ritemark-ui-layout.patch` rebased and validated by reverse/apply round-trip.
  - `003-ritemark-menu-cleanup.patch` rebased and validated by reverse/apply round-trip.
  - `004-ritemark-build-system.patch` applied cleanly without rewrite.
  - `005-ritemark-windows-and-oss-fixes.patch` rebased and validated by reverse/apply round-trip.
  - `006-ritemark-dev-launch-fallback.patch` rebased and validated by reverse/apply round-trip.
- Current patch status from `./scripts/apply-patches.sh --dry-run` on the upgraded tree:
  - `001` through `006`: already applied
- Validation checkpoint:
  - `./scripts/validate-qa.sh` passed on the Sprint 57 worktree after fixing worktree-local setup issues:
    - restored `vscode/extensions/ritemark` symlink
    - installed `extensions/ritemark` dependencies
    - installed `vscode/` dependencies
    - aligned local Node runtime to upstream `.nvmrc` (`22.22.1`)

## Next Step

Turn the repaired upgrade spike into merge-ready implementation notes:

- summarize what changed in `002` and `003` versus upstream
- decide which upstream `1.117` capabilities should be shipped, explored, or ignored for Ritemark users
- document the environment delta discovered during validation:
  - VS Code `1.117.0` now expects Node `22.22.1` from `.nvmrc`
  - clean worktrees need `vscode/` and `extensions/ritemark` installs before QA will be meaningful

## Research Sources

- VS Code release archive: https://code.visualstudio.com/updates/archive
- VS Code 1.110 release notes: https://code.visualstudio.com/updates/v1_110
- VS Code 1.111 release notes: https://code.visualstudio.com/updates/v1_111
- VS Code 1.112 release notes: https://code.visualstudio.com/updates/v1_112
- VS Code 1.113 release notes: https://code.visualstudio.com/updates/v1_113
- VS Code 1.114 release notes: https://code.visualstudio.com/updates/v1_114
- VS Code 1.115 release notes: https://code.visualstudio.com/updates/v1_115
- VS Code 1.116 release notes: https://code.visualstudio.com/updates/v1_116
- VS Code 1.117 release notes: https://code.visualstudio.com/updates/v1_117
- VS Code 1.118 update page: https://code.visualstudio.com/updates/v1_118
