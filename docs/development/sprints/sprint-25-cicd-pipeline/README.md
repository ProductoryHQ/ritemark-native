# Sprint 25: Cross-Platform CI/CD Pipeline

**Status:** Phase 0 COMPLETE. Awaiting approval for Phase 3.
**Started:** 2026-01-27
**Goal:** Level 1 CI/CD — automated builds for Windows x64 + macOS arm64, draft GitHub Releases.

---

## Current State

**Phase 0 (PoC) passed.** Windows build works on GitHub Actions. Jarmo tested 2026-01-28 — app launches, .md files open.

Three issues found during testing (icon, sidebar, installer) are scoped into Phase 3.

### Remaining Phases

| Phase | What | Status |
|-------|------|--------|
| 3 | Harden Windows build (icon, patches, installer) | Pending approval |
| 4 | Create remaining workflows (build-macos, ci, release) | Pending |
| 5 | Update service cross-platform support | Pending |
| 6 | Test, clean up, deploy | Pending |

See `sprint-plan.md` for the full checklist.

---

## Phase 0 Results (2026-01-28)

**Windows PoC Build: SUCCESS** — GitHub Actions run #21445463668

### What Worked
- VS Code compiles on `windows-latest` runner
- Extension copied correctly (not symlinked)
- Patches applied (with fallback)
- Webview bundle + extension.js validated
- Artifact uploaded (~168MB ZIP)
- App launches and opens .md files

### Known Issues

| Issue | Fix (Phase 3) |
|-------|--------------|
| Ritemark icon missing | `cp branding/icons/icon.ico vscode/resources/win32/code.ico` before build |
| Sidebar: Run/Debug, Extensions, Accounts, Manage visible | Create patches 010, 011; update patch 004 |
| No installer (ZIP only) | Add `installer/ritemark.iss` + Inno Setup 6.4.3 in CI |

Detailed research on each fix is in `sprint-plan.md` and the `research/` folder.

---

## Sprint Structure

```
docs/sprints/sprint-25-cicd-pipeline/
├── README.md                           # This file
├── sprint-plan.md                      # Implementation checklist
├── review-findings-and-suggestions.md  # Codex code review (9 findings)
└── research/
    ├── 01-current-state.md
    ├── 02-cicd-architecture.md
    ├── 03-technical-decisions.md
    ├── 04-delivery-architecture.md
    └── 05-pre-mortem.md
```

---

**Last Updated:** 2026-01-28
