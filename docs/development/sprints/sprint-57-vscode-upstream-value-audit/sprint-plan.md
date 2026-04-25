# Sprint 57: VS Code Upstream Value Audit

## Status

Planned - research/audit first.

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
- [ ] Target-version decision: exact upstream tag and fallback tag
- [ ] Patch-risk matrix after submodule diff inspection
- [ ] User-value shortlist with "ship / explore / ignore" decisions
- [ ] Implementation checklist for a follow-up update phase
- [ ] Validation plan using `./scripts/validate-qa.sh` before readiness handoff

## Suggested Phases

### Phase 1 - Audit and decision

- Initialize the `vscode/` submodule in this sprint branch/worktree.
- Verify current local base and upstream tags.
- Compare release notes and selected commits from `1.109.5` to the chosen target.
- Decide whether to target `1.117.0` immediately or wait for a clean `1.118.0` tag.

### Phase 2 - Patch impact spike

- Run `./scripts/apply-patches.sh --dry-run` on the unchanged base.
- Move the submodule to the target tag in a throwaway checkpoint.
- Re-run patch dry-run and classify conflicts by patch.
- Identify whether conflicts are pure context drift, product decisions, or broken invariants.

### Phase 3 - Upgrade implementation

- Update the submodule.
- Repair the patch stack in the smallest coherent changes.
- Preserve Ritemark invariants from Sprint 41:
  - Ritemark branding and About dialog
  - right-side AI/sidebar behavior
  - terminal not restored into editor area
  - extension loading and markdown editor rendering
  - no unwanted startup permission prompts

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

