# Sprint 38: Patch Infrastructure Fix

**Goal:** Eliminate patch drift between local development and CI by resetting VS Code submodule to vanilla 1.94.0 and capturing ALL customizations as proper patches.

**Status:** Phase 1 — Research & Analysis

---

## Quick Links

- **Sprint Plan:** [`sprint-plan.md`](./sprint-plan.md)
- **Current State Analysis:** [`research/current-state-analysis.md`](./research/current-state-analysis.md)

---

## Problem Statement

Our VS Code submodule has Sprint 03/04 commits baked into it, but CI clones vanilla VS Code 1.94.0. This causes:
- Patches work locally but fail on CI (3 patches currently broken)
- Windows builds fail in GitHub Actions
- No reliable way to test patches before pushing

## Solution

1. Reset local VS Code submodule to vanilla 1.94.0 (remove Sprint commits)
2. Capture ALL customizations as patches against vanilla
3. Regenerate broken patches: 012, 015, 017, 020
4. Create CI simulation script for local patch validation
5. Update developer workflow to prevent future drift

## Approval Status

- [ ] **Jarmo approval required before Phase 3 (patch regeneration)**

---

## Directory Contents

```
sprint-38-patch-infrastructure-fix/
├── README.md                           # This file
├── sprint-plan.md                      # Full sprint plan with checklist
└── research/
    └── current-state-analysis.md       # Current patch inventory & CI analysis
```

---

## Key Deliverables

1. **Reset submodule** — VS Code back to vanilla 1.94.0
2. **Fix patches** — 012, 015, 017, 020 regenerated
3. **CI simulation** — `scripts/test-patches-ci-mode.sh`
4. **Documentation** — Updated patch workflow guide

---

## Timeline

| Phase | Description | Gate |
|-------|-------------|------|
| 1 | Research & Analysis | Auto (when documented) |
| 2 | Submodule Reset | **APPROVAL REQUIRED** |
| 3 | Patch Regeneration | Auto (when patches pass CI sim) |
| 4 | CI Simulation Tooling | Auto (when script works) |
| 5 | Testing & Validation | Auto (when all tests pass) |
| 6 | Cleanup & Documentation | Auto (when docs updated) |

---

**Last updated:** 2026-02-15
