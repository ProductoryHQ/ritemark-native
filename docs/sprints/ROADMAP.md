# RiteMark Native - Sprint Roadmap

**Last Updated:** 2025-12-07 (Sprint 07 complete)
**Team:** Jarmo (Product) + Claude (Engineering)

---

## Overview

This roadmap outlines all sprints for RiteMark Native from POC to production-ready MVP and beyond.

| Sprint | Name | Status | Goal |
|--------|------|--------|------|
| 01 | POC | ✅ Complete | Validate VS Code fork approach |
| 02 | Full Editor | ✅ Complete | TipTap WYSIWYG editor working |
| 03 | AI & Polish | ✅ Complete | AI assistant, offline mode, UX cleanup |
| 04 | Core Polish | ✅ Complete | VS Code chrome cleanup, minimal UI |
| 05 | Polish Fixes | ✅ Complete | Production build fixes, light mode |
| 06 | Icons UX | ✅ Complete | Custom Lucide file icon theme |
| 07 | Governor Refactor | ✅ Complete | CLAUDE.md as CEO, expert agents |
| 08 | Multi-Platform | 📋 Next | Windows, Linux builds + installers |
| 09 | Release Prep | 📋 Planned | Auto-update, CI/CD, documentation |
| 10+ | Post-MVP | 🔮 Future | Enhancements based on user feedback |

---

## ✅ Sprint 01: Proof of Concept (Complete)

**Goal:** Prove the VS Code fork approach works with minimal prototype

**Deliverables:**
- [x] VS Code OSS as git submodule (v1.94.0)
- [x] RiteMark branding (product.json, app name)
- [x] Built-in extension structure
- [x] Custom editor provider for .md files
- [x] Placeholder webview with edit/save

**Validated:** 2025-11-30 by Jarmo

---

## ✅ Sprint 02: Full Editor Integration (Complete)

**Goal:** Integrate real TipTap editor by reusing ritemark-app code

**Deliverables:**
- [x] Vite-based webview project
- [x] TipTap editor with all extensions
- [x] Markdown ↔ HTML conversion (marked/turndown)
- [x] postMessage bridge (extension ↔ webview)
- [x] File read/write to disk
- [x] Auto-save with debounce
- [x] Formatting bubble menu
- [x] Table controls
- [x] Code blocks with syntax highlighting
- [x] Image paste/drop support

**Validated:** 2025-11-30 by Jarmo

---

## ✅ Sprint 03: AI & Polish (Complete)

**Goal:** Add AI assistant, offline detection, and polish the UX

**Deliverables:**
- [x] AI chat sidebar in editor webview (Cmd+Shift+A)
- [x] `rephraseText`, `findAndReplaceAll`, `insertText` tools
- [x] API key management via VS Code SecretStorage
- [x] Offline mode detection
- [x] Welcome walkthrough (first-run experience)
- [x] Hide unused VS Code views

**Validated:** 2025-12-01 by Jarmo

---

## ✅ Sprint 04: Core Polish (Complete)

**Goal:** Strip VS Code chrome to create a clean, focused RiteMark experience

**Deliverables:**
- [x] Hide Accounts icon, Settings gear from activity bar
- [x] Hide language/encoding/EOL/spaces selectors from status bar
- [x] Hide Remote Indicator, Problems, Ports from status bar
- [x] Keep Terminal working (for Claude Code integration)
- [x] Clean, minimal interface for writing

**Validated:** 2025-12-04 by Jarmo

---

## ✅ Sprint 05: Polish & Fixes (Complete)

**Goal:** Fix production build issues, enforce light mode

**Deliverables:**
- [x] Fix RiteMark extension not loading in prod (symlink issue)
- [x] Boot in light mode by default
- [x] Welcome page logo in production
- [x] Remove unknown VS Code chat interface
- [x] macOS app icon (Apple HIG compliant)

**Validated:** 2025-12-05 by Jarmo

---

## ✅ Sprint 06: Icons & UX (Complete)

**Goal:** Custom file icon theme with Lucide icons

**Deliverables:**
- [x] Custom RiteMark file icon theme
- [x] Lucide-style SVG icons for common file types
- [x] Folder icons (open/closed states)
- [x] Branded Explorer experience

**Validated:** 2025-12-05 by Jarmo

---

## ✅ Sprint 07: Governor Refactor (Complete)

**Goal:** Transform CLAUDE.md into Governor/CEO pattern with expert agents

**Deliverables:**
- [x] CLAUDE.md refactored to routing table (~143 lines)
- [x] `sprint-manager` agent - 6-phase workflow, HARD approval gates
- [x] `qa-validator` agent - quality checks before commits
- [x] `webview-expert` agent - TipTap/Vite/React specialist
- [x] Enhanced `vscode-expert` agent - trigger keywords, scope boundaries
- [x] Self-check protocol before every response
- [x] HARD enforcement gates for sprint approval and commits

**Validated:** 2025-12-07 by Jarmo

---

## 📋 Sprint 08: Multi-Platform Builds (Next)

**Goal:** Windows and Linux builds with proper installers

**Deliverables:**

**Windows Build:**
- [ ] VS Code build for win32-x64
- [ ] MSI installer
- [ ] Code signing (optional for beta)
- [ ] Test on Windows machine

**Linux Build:**
- [ ] VS Code build for linux-x64
- [ ] AppImage package
- [ ] .deb package (optional)
- [ ] Test on Linux (VM or hardware)

**macOS Polish:**
- [ ] Universal build (arm64 + x64)
- [ ] DMG installer with custom background
- [ ] Code signing with Developer ID
- [ ] Notarization

**Build Scripts:**
- [ ] `scripts/build-windows.sh`
- [ ] `scripts/build-linux.sh`
- [ ] `scripts/build-mac.sh` (enhanced)
- [ ] `scripts/package-all.sh`

---

## 📋 Sprint 09: Release Preparation (Planned)

**Goal:** CI/CD, auto-update, documentation for public release

**Deliverables:**

**CI/CD Pipeline:**
- [ ] GitHub Actions: build on push/PR
- [ ] GitHub Actions: release on tag
- [ ] Parallel platform builds
- [ ] Artifact upload to releases

**Auto-Update System:**
- [ ] Update manifest endpoint
- [ ] In-app update notification
- [ ] Background download
- [ ] Restart to apply

**Documentation:**
- [ ] README with installation instructions
- [ ] Troubleshooting guide
- [ ] Keyboard shortcuts reference

---

## 🔮 Sprint 10+: Post-MVP (Future)

**Goal:** Enhancements based on user feedback

**Potential Features:**

**Editor Enhancements:**
- [ ] Custom themes support
- [ ] Focus mode (hide chrome)
- [ ] Typewriter mode
- [ ] Word count / reading time
- [ ] Spell check integration

**File Management:**
- [ ] Recent files list
- [ ] Favorites/pinned files
- [ ] File templates
- [ ] Quick switcher (Cmd+P for files)

**AI Enhancements:**
- [ ] Chat-style AI assistant
- [ ] Grammar/style suggestions
- [ ] Translation
- [ ] Custom prompts

**Settings UI:**
- [ ] Dedicated RiteMark Settings webview
- [ ] API key management with status indicator
- [ ] Theme preferences

---

## Timeline Summary

| Phase | Sprints | Status |
|-------|---------|--------|
| Foundation | 01-02 | ✅ Done |
| AI & UX | 03 | ✅ Done |
| Polish | 04-06 | ✅ Done |
| Governance | 07 | ✅ Done |
| Platform | 08-09 | 📋 Next |
| **MVP Total** | **01-09** | **In Progress** |
| Post-MVP | 10+ | 🔮 Future |

---

## Sprint Workflow

Every sprint follows the 6-phase workflow managed by `sprint-manager` agent:

1. **RESEARCH** - Read docs, explore codebase, identify risks
2. **PLAN** - Create sprint-plan.md with checklist
3. **⚠️ STOP** - **HARD GATE: Wait for Jarmo approval**
4. **DEVELOP** - Implement checklist items
5. **TEST** - qa-validator checks, Jarmo validates
6. **DEPLOY** - Final commit, push, tag

**Governance:** See `.claude/agents/` for expert agents that enforce this workflow.

---

## References

- Sprint details: `docs/sprints/sprint-XX-*/sprint-plan.md`
- Expert agents: `.claude/agents/`
- Skills: `.claude/skills/vscode-development/`
