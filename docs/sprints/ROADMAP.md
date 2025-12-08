# RiteMark Native - Sprint Roadmap

**Last Updated:** 2025-12-08 (Sprint 09 complete)
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
| 08 | Build Stability | ✅ Complete | Validate builds, patch system |
| 09 | Menu Audit | ✅ Complete | Remove code-focused menu items |
| 10 | Installers | 📋 Planned | macOS DMG + Windows installer |
| 11+ | Post-MVP | 🔮 Future | CI/CD, auto-update, enhancements |

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

## ✅ Sprint 08: Build Stability (Complete)

**Goal:** Validate builds work reliably, establish patch system

**Deliverables:**
- [x] Build validation workflow
- [x] Patch system for VS Code customizations
- [x] `scripts/apply-patches.sh` - Apply all patches
- [x] `scripts/create-patch.sh` - Create new patches
- [x] Documentation for patch workflow

**Validated:** 2025-12-07 by Jarmo

---

## ✅ Sprint 09: Menu Audit & Cleanup (Complete)

**Goal:** Remove code-focused menu items for a clean markdown editor experience

**Deliverables:**

**Edit Menu Cleanup:**
- [x] Remove "Emmet: Expand Abbreviation"
- [x] Remove "Toggle Line Comment"
- [x] Remove "Toggle Block Comment"

**Go Menu:**
- [x] Removed entire Go menu (code navigation not needed)

**View Menu Cleanup:**
- [x] Remove Extensions panel
- [x] Remove Appearance submenu
- [x] Remove Editor Layout submenu

**Patches Created:**
- [x] `003-remove-edit-menu-code-items.patch`
- [x] `004-hide-extensions-view-menu.patch`
- [x] `005-remove-go-menu.patch`
- [x] `006-cleanup-view-menu.patch`

**Bonus:**
- [x] `scripts/validate-patches.sh` - Pre-build validation (catches errors in 2 min vs 25 min)
- [x] `docs/menu-customization.md` - Documentation

**Validated:** 2025-12-08 by Jarmo

---

## 📋 Sprint 10: Installers (Planned)

**Goal:** Professional installers for macOS and Windows

**macOS Installer:**
- [ ] DMG with drag-to-Applications UI
- [ ] Custom volume icon and background
- [ ] Unsigned for now (no Apple Developer account)
- [ ] SHA256 checksum
- [ ] Installation guide with Gatekeeper bypass instructions

**Windows Installer:**
- [ ] Research: MSI vs NSIS vs Electron Builder
- [ ] Basic installer (unsigned for beta)
- [ ] Desktop/Start menu shortcuts
- [ ] Test on Windows machine

**Scripts:**
- [ ] `scripts/create-dmg.sh`
- [ ] `scripts/create-windows-installer.sh`

---

## 🔮 Sprint 11+: Post-MVP (Future)

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
| Build Stability | 08 | ✅ Done |
| Menu Cleanup | 09 | ✅ Done |
| Installers | 10 | 📋 Next |
| **MVP Total** | **01-10** | **In Progress** |
| Post-MVP | 11+ | 🔮 Future |

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
