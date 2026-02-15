# Sprint 38: Patch Infrastructure Fix

## Goal
Eliminate patch drift between local development and CI by resetting the VS Code submodule to vanilla 1.94.0 and capturing ALL customizations as proper, testable patch files.

## Feature Flag Check
- [ ] Does this sprint need a feature flag?
  - **NO** — Infrastructure refactoring, no user-facing changes
  - Rationale: Fixing developer tooling and build system, not adding features

## Success Criteria
- [ ] Local VS Code submodule is vanilla 1.94.0 (no Sprint 03/04 commits)
- [ ] All 20 patches apply cleanly against vanilla VS Code 1.94.0
- [ ] Patches apply successfully in CI (GitHub Actions Windows build)
- [ ] CI validation script exists for local patch testing
- [ ] No differences between `./scripts/apply-patches.sh` output locally vs. CI

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| Reset submodule | Detach from Sprint-modified VS Code, checkout vanilla 1.94.0 |
| Audit patches 010-011 | Determine if already covered by Sprint commits → no-op patches? |
| Regenerate patch 012 | Welcome page branding (was deleted) |
| Fix patch 015 | Workbench font/typography base (CI context mismatch) |
| Fix patch 017 | Workbench titlebar controls (CI context mismatch) |
| Fix patch 020 | Icon harmonization (CI context mismatch) |
| CI simulation script | `scripts/test-patches-ci-mode.sh` — test patches against clean VS Code |
| Documentation | Update patch workflow docs with new validation steps |

## Problem Statement

### Current State
- Local VS Code submodule has Sprint 03/04 commits baked in
- CI clones vanilla VS Code 1.94.0 from Microsoft's repo
- Result: patches that work locally fail on CI (3 patches currently broken)

### Root Cause
- Patches 010-011 were created against vanilla, but Sprint 03/04 later made similar changes directly to submodule
- Patches 012, 015, 017, 020 reference files/context modified by Sprint commits
- No validation step to catch this drift before pushing

### Impact
- Windows builds fail on CI (patch application errors)
- Developers can't trust local patch testing
- Wastes GitHub Actions minutes on broken builds
- Blocks releases that depend on Windows builds

## Implementation Checklist

### Phase 1: Analysis & Audit
- [ ] Document current VS Code submodule state
  - [ ] List all Sprint 03/04 commits in `vscode/` (git log since 1.94.0)
  - [ ] Identify which customizations are captured as patches vs. direct commits
- [ ] Audit existing patches against vanilla VS Code 1.94.0
  - [ ] Clone fresh VS Code 1.94.0 to temp directory
  - [ ] Test each patch with `git apply --check`
  - [ ] Document which patches fail and why
- [ ] Map Sprint 03/04 commits to patch coverage
  - [ ] Do patches 010-011 overlap with direct commits?
  - [ ] Are there customizations NOT captured as patches?
- [ ] Create migration plan
  - [ ] List all changes that need new/updated patches
  - [ ] Determine patch regeneration order (dependency graph)

### Phase 2: Submodule Reset
- [ ] Backup current submodule state
  - [ ] Create branch `backup/sprint-03-04-state` in vscode/
  - [ ] Document commit hash for recovery if needed
- [ ] Reset to vanilla VS Code 1.94.0
  - [ ] `cd vscode && git checkout 1.94.0`
  - [ ] Verify no Sprint commits remain: `git log --oneline 1.94.0..HEAD` is empty
- [ ] Remove all patches temporarily
  - [ ] `./scripts/apply-patches.sh --reverse` (if implemented)
  - [ ] Or: `cd vscode && git checkout .` to clean slate

### Phase 3: Patch Regeneration
- [ ] **Patch 012** (welcome page branding)
  - [ ] Restore from git history or recreate manually
  - [ ] Apply and test on vanilla 1.94.0
  - [ ] Verify logo SVG files are created correctly
- [ ] **Patch 015** (workbench font/typography)
  - [ ] Identify context mismatch (gettingStartedGuide.css reference)
  - [ ] Regenerate against vanilla 1.94.0
  - [ ] Test in clean VS Code clone
- [ ] **Patch 017** (workbench titlebar controls)
  - [ ] Identify context mismatch (layoutActions.ts after patch 006)
  - [ ] Regenerate with correct line numbers/context
  - [ ] Test dependency chain: 001-006 → 017
- [ ] **Patch 020** (icon harmonization)
  - [ ] Identify context mismatch (iconRegistry.ts)
  - [ ] Regenerate against vanilla 1.94.0
  - [ ] Test Lucide icon imports are correctly patched
- [ ] **Patches 010-011** (accounts/debug hiding)
  - [ ] Test against vanilla: do they apply? (If "already applied", investigate)
  - [ ] If overlapping with Sprint commits, remove no-op portions
  - [ ] Verify final patch achieves intended hiding behavior

### Phase 4: CI Simulation Tooling
- [ ] Create `scripts/test-patches-ci-mode.sh`
  - [ ] Clone fresh VS Code 1.94.0 to temp directory
  - [ ] Copy patches to temp clone
  - [ ] Apply patches in order (same logic as apply-patches.sh)
  - [ ] Report success/failure for each patch
  - [ ] Clean up temp directory on completion
- [ ] Add validation flags to `apply-patches.sh`
  - [ ] `--verify` mode: check all patches before applying any
  - [ ] Fail fast on first conflict (don't attempt 3-way merge)
- [ ] Document usage in CLAUDE.md
  - [ ] Add to "Self-Check Protocol" for patch-related work
  - [ ] Require CI simulation pass before committing new patches

### Phase 5: Testing & Validation
- [ ] Local validation
  - [ ] Run `./scripts/test-patches-ci-mode.sh`
  - [ ] All 20 patches must apply cleanly
  - [ ] Apply patches to actual submodule: `./scripts/apply-patches.sh`
  - [ ] Build dev mode: `./scripts/code.sh` → verify app launches
  - [ ] Test 3-5 key customizations visually (e.g., Lucide icons, hidden menus)
- [ ] CI validation (dry-run)
  - [ ] Push to feature branch `fix/patch-infrastructure`
  - [ ] Trigger GitHub Actions Windows build
  - [ ] Verify "Apply patches" step succeeds
  - [ ] Check build completes successfully
- [ ] Documentation validation
  - [ ] Update `.claude/skills/vscode-development/SKILL.md` with new workflow
  - [ ] Add troubleshooting entry for patch drift
  - [ ] Update CLAUDE.md if needed (patch validation gates)

### Phase 6: Cleanup & Documentation
- [ ] Remove backup branch if reset successful
- [ ] Update `.gitmodules` if needed (already points to microsoft/vscode)
- [ ] Add pre-commit reminder in CLAUDE.md
  - [ ] "Before committing patches, run `./scripts/test-patches-ci-mode.sh`"
- [ ] Create runbook: `docs/sprints/sprint-38-patch-infrastructure-fix/PATCH-WORKFLOW.md`
  - [ ] How to create patches (use create-patch.sh)
  - [ ] How to test patches locally (CI simulation)
  - [ ] How to debug patch conflicts
  - [ ] What to do if Sprint work requires direct submodule edits (NEVER — always patch)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lose Sprint 03/04 customizations | High | Backup branch created, all changes captured as patches |
| New patches break existing patches | Medium | Apply in dependency order, test full chain |
| CI still fails after regeneration | Medium | Run CI simulation locally first, iterate until clean |
| Forgot to capture a customization | Medium | Visual diff between backup branch and patched result |
| Breaking dev workflow during sprint | Low | Work on feature branch, don't touch main until validated |

## Status
**Current Phase:** 1 (Analysis & Audit)
**Approval Required:** YES — Jarmo must approve before Phase 3 (patch regeneration)

## Approval
- [ ] Jarmo approved this sprint plan

---

## Notes

### Patch Numbering
- Current: 001-021 (no 012)
- After sprint: 001-021 (012 restored)
- Do NOT renumber — breaks git history and references

### Validation Philosophy
- **Local testing is not enough** — must simulate CI environment
- CI clones vanilla VS Code, so local dev should too
- Sprint commits to submodule = anti-pattern → always use patches

### Future Prevention
- Add `test-patches-ci-mode.sh` to PR checklist
- Consider pre-push git hook (optional, not enforced)
- Update sprint-manager to check patch validation before Phase 4
