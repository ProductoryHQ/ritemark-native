# Research: Current Open-Source Readiness State

**Sprint:** 39 - Open Source Launch
**Phase:** 1 - Research
**Date:** 2026-02-25

---

## What Already Exists (Pre-Sprint)

The strategic analysis (`docs/analysis/OPEN-SOURCE-STRATEGY.md`) is already complete and decisions are locked. This research focuses on the _actual repo state_ — what files exist, what is missing, and what the CI/CD situation looks like.

### Files That Already Exist (Completed Before This Sprint)

| File | Status | Notes |
|------|--------|-------|
| `TRADEMARK.md` | Done | Full trademark policy, Productory OÜ owns brand |
| `branding/LICENSE` | Done | Brand assets all rights reserved, directs to TRADEMARK.md |
| `README.md` | Partial | MIT noted at bottom, no contribution/build sections |

### Files That Are Missing (Sprint Deliverables)

| File | Priority | Notes from Strategy Doc |
|------|----------|------------------------|
| `LICENSE` (repo root) | Critical | MIT, copyright Productory OÜ — referenced by `branding/LICENSE` |
| `CODE_OF_CONDUCT.md` | Critical | Contributor Covenant v2.1 |
| `SECURITY.md` | Important | Security reporting process |
| `CONTRIBUTING.md` | Critical | Developer setup + contribution guidelines (human-facing) |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Important | Structured bug report template |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Important | Feature request template |
| `.github/PULL_REQUEST_TEMPLATE.md` | Important | PR template with checklist |
| `.github/workflows/pr-checks.yml` | Important | CI on every PR |

---

## Repository Structure Observations

### CI/CD Current State

Two workflows exist:
- `.github/workflows/build-macos-x64.yml` — triggers on `v*` tags only
- `.github/workflows/build-windows.yml` — triggers on `v*` tags only

Neither runs on pull requests. For open-source contributors to get feedback on their PRs, a PR-triggered workflow is needed. The PR check should be lightweight (TypeScript compile + patch dry-run), not a full 25-minute build.

### Hardcoded Personal References Found

Auditing for `jarmo-productory` and personal paths:

- `README.md` line 47: `https://github.com/jarmo-productory/ritemark-public/releases/...` (macOS download)
- `README.md` line 50: `https://github.com/jarmo-productory/ritemark-public/releases/...` (Windows download)
- `docs/sprints/sprint-20-lightweight-updates/sprint-plan.md`: references `jarmo-productory/ritemark-public` in manifest URLs — these are internal sprint docs, acceptable to leave
- `.github/workflows/build-macos-x64.yml`: no personal URLs, uses `GITHUB_TOKEN` correctly
- `scripts/release-dmg.sh`: likely references the public repo — needs audit

Key question for Jarmo: Is the GitHub org migration (`jarmo-productory` → `ritemark` org) happening as part of this sprint or separately? The strategy doc lists it as a separate decision. For now, the plan treats README download links as needing updating to point to the main repo releases (not `ritemark-public`), but the org migration is out of scope.

### Scripts with Personal Paths

The scripts were authored for local macOS development. Key personal path observed in CLAUDE.md:
```bash
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use 20 && cd /Users/jarmotuisk/Projects/ritemark-native && ./scripts/build-prod.sh 2>&1'
```
This path (`/Users/jarmotuisk/Projects/ritemark-native`) is in CLAUDE.md only (not in committed scripts). The actual scripts use relative paths (`./scripts/`) so they are fine. No personal absolute paths found in scripts themselves.

---

## Dependency License Audit (Preliminary)

From `docs/analysis/OPEN-SOURCE-STRATEGY.md` section 3.4:

| Dependency | License | Risk |
|------------|---------|------|
| VS Code OSS | MIT | None |
| TipTap | MIT | None |
| Orama | Apache 2.0 | None (compatible with MIT distribution) |
| OpenAI SDK | Apache 2.0 | None |
| gray-matter | MIT | None |
| pdfkit | MIT | None |
| docx | MIT | None |
| xlsx (SheetJS) | Apache 2.0 | None |

Risk areas to verify with `npx license-checker`:
- Any GPL/LGPL/AGPL dependencies would be incompatible with MIT distribution
- Strategy doc identifies this as low risk given the project's tech choices

The full audit requires running `npx license-checker --summary` in `extensions/ritemark/` — documented as a Phase 3 task.

---

## CONTRIBUTING.md Scope Analysis

The strategy doc describes two distinct audiences:

1. **Human contributors** (the target for CONTRIBUTING.md) — developers who want to fix bugs, add features, or improve the project
2. **AI development workflow** (CLAUDE.md) — the Claude Code agent governance system

Key insight: The existing developer knowledge lives entirely in `CLAUDE.md`, which is an AI governance doc. CONTRIBUTING.md needs to extract the human-relevant setup steps and translate them into instructions that don't assume Claude Code.

Content needed:
- Prerequisites: Node 20, git, macOS (primary), Windows/Linux (community)
- Clone with submodules: `git clone --recurse-submodules`
- Apply patches: `./scripts/apply-patches.sh`
- Install dependencies: `npm install` in both `vscode/` and `extensions/ritemark/`
- Dev mode: `./scripts/build-mac.sh` or equivalent
- Making changes: Where to edit (always `extensions/ritemark/`, never `vscode/` directly)
- VS Code changes: Use `./scripts/create-patch.sh`
- Building webview: `cd extensions/ritemark/webview && npm run build`
- Testing: Extension compilation check, webview build check
- Contribution guidelines and what won't be merged

---

## Good First Issues from WISHLIST

Candidates for `good first issue` labeling based on WISHLIST.md:

| Issue | Complexity | Why Good First |
|-------|------------|----------------|
| "BUG: Columns have no max-width" (DataTable.tsx:516) | Low | Specific file + line reference, CSS fix |
| "CSV row deletion with context menu" | Low-Medium | UI addition, isolated component |
| "Recent files list on welcome page" | Medium | Clear scope, VS Code API available |
| "Custom Welcome tab icon" (Windows) | Low | Icon/CSS only, isolated |
| "PowerPoint (.pptx) preview" | Medium | Follow existing pattern (PDF/Excel preview) |
| "Batch export folder as .zip of DOCX" | Medium | Extend existing export module |

These should be filed as GitHub issues with `good first issue` + `help wanted` labels after the repo goes public. Documenting them in the sprint plan for the "identify good first issues" deliverable.

---

## GitHub Discussions Plan

From strategy doc section 5.4, three initial categories:
1. **General** — Q&A, introductions, help
2. **Ideas** — Feature requests not yet filed as issues
3. **Show & Tell** — Workflows, use cases, integrations

This is a GitHub repo setting (not a file), so it's a task for Jarmo to enable in Settings > Features > Discussions. The sprint plan will document this as a manual step.

---

## Sprint Number Conflict Note

The strategy doc was written when the ROADMAP labeled sprint 20 as "Post-MVP". However, sprint-20 through sprint-38 have since been completed. The open-sourcing sprint is correctly numbered **Sprint 39**.

The sprint directory has been created as `sprint-39-open-source` accordingly.
