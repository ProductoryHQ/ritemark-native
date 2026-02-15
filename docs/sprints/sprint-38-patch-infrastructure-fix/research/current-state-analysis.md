# Current State Analysis — Sprint 38

**Date:** 2026-02-15
**Phase:** Research (Phase 1)

## Problem Overview

Our VS Code submodule has diverged from vanilla 1.94.0 due to Sprint 03/04 commits made directly to the submodule. This causes patches to fail in CI (which clones vanilla VS Code) even though they work locally.

## Current Patch Inventory

Total patches: 20 (numbered 001-021, missing 012)

### Patches that work on vanilla VS Code 1.94.0
- 001: Terminal default to right sidebar
- 002: Hide chat sidebar
- 003: Remove Edit menu code items
- 004: Hide extensions view menu
- 005: Remove Go menu
- 006: Cleanup View menu
- 007: About dialog Ritemark version
- 008: Fix jschardet git extension
- 009: Enable microphone in webview
- 013: Disable integrity check
- 014: Default light theme
- 016: Workbench sidebar top tabs layout
- 018: Workbench explorer UI
- 019: Workbench right sidebar
- 021: Breadcrumbs ribbon height icons

**Status:** 15/20 patches confirmed working against vanilla VS Code

### Patches that "already applied" locally (suspicious)
- 010: Hide accounts/manage gear
- 011: Hide run/debug sidebar

**Issue:** These were created against vanilla, but Sprint 03/04 likely made overlapping changes directly to submodule. Need to verify:
1. Do they still apply on vanilla 1.94.0? (YES, per CI logs)
2. Are they redundant now? (NO — CI needs them)

**Status:** Actually WORKING on CI — false alarm. These are fine.

### Patches missing or broken
- **012: Welcome page branding** — DELETED by mistake
  - Was removed from patches/ directory
  - Known issue: SVG file creation fails during patch application
  - Needs regeneration or different approach (manual file copy in branding/)

- **015: Workbench font and typography base** — FAILS on CI
  - Error: Context mismatch (references gettingStartedGuide.css)
  - Likely created against Sprint-modified files
  - Needs regeneration against vanilla 1.94.0

- **017: Workbench titlebar controls** — FAILS on CI
  - Error: Context mismatch in layoutActions.ts
  - Applied after patch 006 (View menu cleanup)
  - Needs regeneration with correct context after 006

- **020: Icon harmonization** — FAILS on CI
  - Error: Context mismatch in iconRegistry.ts
  - Lucide icon changes likely conflict with Sprint commits
  - Needs regeneration against vanilla 1.94.0

**Status:** 4 patches broken (1 deleted, 3 context mismatches)

## Sprint 03/04 Submodule Commits

**TODO in Phase 1:** Document exact commits made to vscode/ during Sprint 03/04.

Expected changes:
- Lucide icon system integration
- Welcome page branding (logo, colors)
- Layout customizations (sidebar, titlebar)
- Typography improvements

**Action:** Run `cd vscode && git log 1.94.0..HEAD --oneline` to list all commits since vanilla.

## CI Workflow Analysis

From `.github/workflows/build-windows.yml`:

```yaml
- name: Clone VS Code OSS (1.94.0)
  shell: bash
  run: |
    git clone --depth 1 --branch 1.94.0 https://github.com/microsoft/vscode.git r/vscode
    echo "VS Code 1.94.0 cloned"
```

**Key insight:** CI always clones **vanilla** VS Code 1.94.0 from Microsoft's repo, NOT our submodule.

Then:
```yaml
- name: Apply patches
  shell: bash
  working-directory: r
  run: ./scripts/apply-patches.sh
```

This means:
1. CI starts with pristine VS Code 1.94.0
2. Applies our patches on top
3. Any patch that depends on Sprint commits will fail

**Conclusion:** Local submodule MUST match CI behavior → reset to vanilla 1.94.0.

## Patch Application Logic

From `scripts/apply-patches.sh`:

1. Check if patch already applied: `git apply --check --reverse`
2. If not applied, try: `git apply`
3. If fails, try 3-way merge: `git apply --3way`

**Issue with Sprint commits:**
- Locally: Patch sees Sprint changes → reports "already applied" → skips
- CI: Patch tries to apply → context mismatch → fails (even with 3-way)

**Solution:** Remove Sprint commits, ensure ALL customizations come from patches only.

## Missing Patch 012 Investigation

**Historical note from MEMORY.md:**
> Patch 012 (Welcome Page Branding) — **Known broken** — never applies cleanly due to SVG file creation. Logo fix applied directly in submodule (not via patch).

**Implication:** Patch 012 was intentionally abandoned in favor of direct submodule edit. This is exactly the anti-pattern causing our current problem.

**Sprint 38 goal:** Either fix patch 012 to work reliably, OR move branding assets to `branding/` directory and copy them in `apply-patches.sh` (like we do for icons).

## Next Steps (Phase 1)

1. Clone fresh VS Code 1.94.0 to temporary directory
2. Test each patch individually with `git apply --check`
3. Document exact failure messages for 012, 015, 017, 020
4. List all Sprint 03/04 commits in submodule
5. Create coverage matrix: which commits are covered by patches?
6. Identify any "orphan" customizations (not in patches)

**Deliverable:** Complete audit report ready for Jarmo's review before proceeding to Phase 2.

---

## References
- CI workflow: `.github/workflows/build-windows.yml`
- Patch scripts: `scripts/apply-patches.sh`, `scripts/create-patch.sh`
- MEMORY.md: Notarization, build, and patch notes
- CLAUDE.md: Patch system documentation
