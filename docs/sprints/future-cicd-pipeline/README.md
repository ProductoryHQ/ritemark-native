# Sprint 24: Cross-Platform CI/CD Pipeline

**Status:** Phase 3 (DEVELOP) - Approved ✅
**Started:** 2026-01-25
**Goal:** Achieve Level 1 ("Works") CI/CD maturity

---

## Quick Summary

This sprint implements automated GitHub Actions workflows to build RiteMark Native for Windows (x64) and macOS (arm64). We're moving from Level 0 ("Hope" - manual builds only) to Level 1 ("Works" - automated builds with quality gates).

### What We're Building

1. **`.github/workflows/ci.yml`** - Fast PR validation (TypeScript, lint)
2. **`.github/workflows/build-windows.yml`** - Windows x64 production build
3. **`.github/workflows/build-macos.yml`** - macOS arm64 production build
4. **`.github/workflows/release.yml`** - Multi-platform GitHub Release
5. **Update service fixes** - Platform-aware asset detection
6. **Build scripts** - Windows PowerShell + QA check script

### Key Decisions

- **Windows:** x64 only (no ARM)
- **macOS:** arm64 only (Intel via Rosetta)
- **Linux:** Out of scope
- **Signing:** Not in CI (manual post-build)
- **Release:** Draft only (manual publish)
- **Scope:** Level 1 ("Works") - basic automation

---

## Sprint Structure

```
docs/sprints/sprint-24-cicd-pipeline/
├── README.md                           # This file
├── sprint-plan.md                      # Detailed plan with checklist
├── research/
│   ├── 01-current-state.md            # Analysis of existing build system
│   ├── 02-cicd-architecture.md        # Workflow design and best practices
│   ├── 03-technical-decisions.md      # Decision log and risk analysis
│   ├── 04-delivery-architecture.md    # CI/CD + Agent integration
│   └── 05-pre-mortem.md               # What could go wrong? (NEW)
└── notes/                              # Implementation notes (Phase 3+)
    └── .gitkeep
```

---

## Research Highlights

### Delivery Architecture (Key Insight)

**CI/CD automates the BUILD, not the RELEASE.**

```
CI/CD (automated) ──► Draft Release ──► release-manager ──► product-marketer
       │                    │                  │                    │
       │                    │                  │                    └── Content
       │                    │                  └── Quality gates + publish
       │                    └── Artifacts ready for testing
       └── Builds both platforms in parallel
```

The existing agents (release-manager, product-marketer) remain essential:
- **release-manager**: Gate 1 (technical) + Gate 2 (Jarmo tests) + publish
- **product-marketer**: Release notes, changelog, social copy

CI removes the manual build burden but preserves human-in-the-loop safety.

See `research/04-delivery-architecture.md` for the complete flow diagram.

### Current State (Level 0)
- ❌ No `.github/workflows/` directory
- ❌ No automated builds
- ❌ No PR validation
- ✅ Manual macOS builds work (`build-prod.sh`)
- ❌ Windows builds broken (assumes cross-compilation)

### Target State (Level 1)
- ✅ Automated builds on tag push
- ✅ Windows x64 ZIP artifact
- ✅ macOS arm64 DMG artifact
- ✅ Draft GitHub Releases
- ✅ Quality gates (webview validation, TypeScript checks)
- ❌ Not signed (manual signing post-build)
- ❌ No smoke tests (add in Level 2)

---

## Approval Gate

**Current Phase:** 3 (DEVELOP) ✅
**Gate:** PASSED - Jarmo approved on 2026-01-25

This sprint follows the 6-phase workflow enforced by `sprint-manager` agent:
1. ✅ **RESEARCH** - Complete
2. ✅ **PLAN** - Approved
3. 🔄 **DEVELOP** - In Progress
4. ⏸️ **TEST & VALIDATE** - Pending
5. ⏸️ **CLEANUP** - Pending
6. ⏸️ **DEPLOY** - Pending

**Scope addition:** release-manager agent update included per Jarmo's request.

---

## Next Steps (After Approval)

1. Create `.github/workflows/` directory
2. Implement 4 workflow files (ci, build-windows, build-macos, release)
3. Create `scripts/build-windows.ps1` and `scripts/qa-check.sh`
4. Fix update service platform detection
5. Test all workflows with manual triggers
6. Create test release (e.g., `v0.0.1-test`)
7. Validate artifacts locally
8. Clean up and document
9. Enable for production releases

---

## Success Criteria

### Must Have (Blocking)
- [ ] Windows build produces working ZIP
- [ ] macOS build produces working DMG
- [ ] Both builds validate webview.js integrity
- [ ] Draft GitHub Release with both artifacts
- [ ] Checksums generated
- [ ] Update service detects platform correctly

### Should Have (Quality)
- [ ] PR validation catches TypeScript errors
- [ ] Build time < 45 min per platform
- [ ] Within GitHub free tier (< 2000 min/month)

---

## References

### Internal
- **Windows Build Audit:** `docs/analysis/windows-build-audit.md`
- **Current macOS Build:** `scripts/build-prod.sh`
- **Release Manager Agent:** `.claude/agents/release-manager.md`
- **Product Marketer Agent:** `.claude/agents/product-marketer.md`
- **Sprint Manager Agent:** `.claude/agents/sprint-manager.md`

### External
- **VSCodium Windows CI:** https://github.com/VSCodium/vscodium/blob/master/.github/workflows/stable-windows.yml
- **VS Code Build Prerequisites:** https://github.com/microsoft/vscode/wiki/How-to-Contribute
- **Electron Forge CI Patterns:** https://www.electronforge.io/guides/code-signing

---

**Last Updated:** 2026-01-25 (Phase 2 - added delivery architecture research)
