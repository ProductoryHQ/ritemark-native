# Sprint 25: Cross-Platform CI/CD Pipeline

**Status:** Phase 1 (RESEARCH) - Incorporating review findings
**Started:** 2026-01-27
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
docs/sprints/sprint-25-cicd-pipeline/
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

**Current Phase:** 1 (RESEARCH) - Updating with review findings

This sprint follows the 6-phase workflow enforced by `sprint-manager` agent:
1. 🔄 **RESEARCH** - Incorporating Codex review (9 findings)
2. ⏸️ **PLAN** - Pending (needs re-approval with fixes)
3. ⏸️ **DEVELOP** - Pending
4. ⏸️ **TEST & VALIDATE** - Pending
5. ⏸️ **CLEANUP** - Pending
6. ⏸️ **DEPLOY** - Pending

**History:** Originally Sprint 24 (pivoted to RAG). Research preserved, now Sprint 25.
**Scope addition:** release-manager agent update included per Jarmo's request.

---

## Codex Review (2026-01-27)

External code review identified 9 gaps. All accepted. See `review-findings-and-suggestions.md` for full details.

**Must fix before development:**

| # | Finding | Fix |
|---|---------|-----|
| 1 | `release.yml` calls build workflows without `workflow_call` | Add `on: workflow_call` to build workflows |
| 2 | PR validation scope conflict (Level 1 vs Level 2) | Resolve: PR validation IS Level 1 |
| 3 | Windows symlink fix missing from Phase 3 checklist | Add junction/copy step to Windows workflow |
| 4 | Version consistency gate missing | Add tag↔package.json↔product.json check in CI |
| 5 | Electron/Node ABI risk | Pin Node to VS Code's version, log Electron/Node versions |
| 6 | Windows MSVC toolchain not enforced | Add explicit MSVC setup/validation step |
| 7 | Windows long-path risk | Use short checkout path (`path: r`) + enable long paths |
| 8 | Artifact naming not validated | Add assertion step in release.yml before publishing |
| 9 | Update service lacks test plan | Add manual test checklist for Windows update flow |

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

**Last Updated:** 2026-01-27 (Renamed to Sprint 25, incorporated Codex review findings)
