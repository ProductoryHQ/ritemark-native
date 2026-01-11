# RiteMark Native - Sprint Roadmap

**Last Updated:** 2026-01-11 (Sprint 17 complete)
**Team:** Jarmo (Product) + Claude (Engineering)

* * *

## Overview

This roadmap outlines all sprints for RiteMark Native from POC to production-ready MVP and beyond.

| Sprint | Name | Status | Goal |
| --- | --- | --- | --- |
| 01 | POC | ✅ Complete | Validate VS Code fork approach |
| 02 | Full Editor | ✅ Complete | TipTap WYSIWYG editor working |
| 03 | AI & Polish | ✅ Complete | AI assistant, offline mode, UX cleanup |
| 04 | Core Polish | ✅ Complete | VS Code chrome cleanup, minimal UI |
| 05 | Polish Fixes | ✅ Complete | Production build fixes, light mode |
| 06 | Icons UX | ✅ Complete | Custom Lucide file icon theme |
| 07 | Governor Refactor | ✅ Complete | CLAUDE.md as CEO, expert agents |
| 08 | Build Stability | ✅ Complete | Validate builds, patch system |
| 09 | Menu Audit | ✅ Complete | Remove code-focused menu items |
| 10 | Installers | ✅ Complete | macOS DMG installer |
| 11 | Quick Wins | ✅ Complete | Word count, CMD+B fix, autosave, H3, sticky AI header |
| 12 | Document Properties | ✅ Complete | YAML front-matter UI for metadata |
| 13 | Task Lists | ✅ Complete | GFM task checkboxes (`- [ ]` / `- [x]`) |
| 14 | Block Interactions | ✅ Complete | Block hover/drag/delete interactions |
| 15 | Paste Enhancements | ✅ Complete | Smart paste from web, Word, etc. |
| 16 | Auto-Update | ✅ Complete | Update notifications via GitHub Releases |
| 17 | File Preview | ✅ Complete | CSV preview with inline editing |
| 18+ | Post-MVP | 🔮 Future | Enhancements based on feedback |

* * *

## ✅ Sprint 01: Proof of Concept (Complete)

**Goal:** Prove the VS Code fork approach works with minimal prototype

**Deliverables:**

-   VS Code OSS as git submodule (v1.94.0)
    
-   RiteMark branding (product.json, app name)
    
-   Built-in extension structure
    
-   Custom editor provider for .md files
    
-   Placeholder webview with edit/save
    

**Validated:** 2025-11-30 by Jarmo

* * *

## ✅ Sprint 02: Full Editor Integration (Complete)

**Goal:** Integrate real TipTap editor by reusing ritemark-app code

**Deliverables:**

-   Vite-based webview project
    
-   TipTap editor with all extensions
    
-   Markdown ↔ HTML conversion (marked/turndown)
    
-   postMessage bridge (extension ↔ webview)
    
-   File read/write to disk
    
-   Auto-save with debounce
    
-   Formatting bubble menu
    
-   Table controls
    
-   Code blocks with syntax highlighting
    
-   Image paste/drop support
    

**Validated:** 2025-11-30 by Jarmo

* * *

## ✅ Sprint 03: AI & Polish (Complete)

**Goal:** Add AI assistant, offline detection, and polish the UX

**Deliverables:**

-   AI chat sidebar in editor webview (Cmd+Shift+A)
    
-   `rephraseText`, `findAndReplaceAll`, `insertText` tools
    
-   API key management via VS Code SecretStorage
    
-   Offline mode detection
    
-   Welcome walkthrough (first-run experience)
    
-   Hide unused VS Code views
    

**Validated:** 2025-12-01 by Jarmo

* * *

## ✅ Sprint 04: Core Polish (Complete)

**Goal:** Strip VS Code chrome to create a clean, focused RiteMark experience

**Deliverables:**

-   Hide Accounts icon, Settings gear from activity bar
    
-   Hide language/encoding/EOL/spaces selectors from status bar
    
-   Hide Remote Indicator, Problems, Ports from status bar
    
-   Keep Terminal working (for Claude Code integration)
    
-   Clean, minimal interface for writing
    

**Validated:** 2025-12-04 by Jarmo

* * *

## ✅ Sprint 05: Polish & Fixes (Complete)

**Goal:** Fix production build issues, enforce light mode

**Deliverables:**

-   Fix RiteMark extension not loading in prod (symlink issue)
    
-   Boot in light mode by default
    
-   Welcome page logo in production
    
-   Remove unknown VS Code chat interface
    
-   macOS app icon (Apple HIG compliant)
    

**Validated:** 2025-12-05 by Jarmo

* * *

## ✅ Sprint 06: Icons & UX (Complete)

**Goal:** Custom file icon theme with Lucide icons

**Deliverables:**

-   Custom RiteMark file icon theme
    
-   Lucide-style SVG icons for common file types
    
-   Folder icons (open/closed states)
    
-   Branded Explorer experience
    

**Validated:** 2025-12-05 by Jarmo

* * *

## ✅ Sprint 07: Governor Refactor (Complete)

**Goal:** Transform CLAUDE.md into Governor/CEO pattern with expert agents

**Deliverables:**

-   CLAUDE.md refactored to routing table (~143 lines)
    
-   `sprint-manager` agent - 6-phase workflow, HARD approval gates
    
-   `qa-validator` agent - quality checks before commits
    
-   `webview-expert` agent - TipTap/Vite/React specialist
    
-   Enhanced `vscode-expert` agent - trigger keywords, scope boundaries
    
-   Self-check protocol before every response
    
-   HARD enforcement gates for sprint approval and commits
    

**Validated:** 2025-12-07 by Jarmo

* * *

## ✅ Sprint 08: Build Stability (Complete)

**Goal:** Validate builds work reliably, establish patch system

**Deliverables:**

-   Build validation workflow
    
-   Patch system for VS Code customizations
    
-   `scripts/apply-patches.sh` - Apply all patches
    
-   `scripts/create-patch.sh` - Create new patches
    
-   Documentation for patch workflow
    

**Validated:** 2025-12-07 by Jarmo

* * *

## ✅ Sprint 09: Menu Audit & Cleanup (Complete)

**Goal:** Remove code-focused menu items for a clean markdown editor experience

**Deliverables:**

**Edit Menu Cleanup:**

-   Remove "Emmet: Expand Abbreviation"
    
-   Remove "Toggle Line Comment"
    
-   Remove "Toggle Block Comment"
    

**Go Menu:**

-   Removed entire Go menu (code navigation not needed)
    

**View Menu Cleanup:**

-   Remove Extensions panel
    
-   Remove Appearance submenu
    
-   Remove Editor Layout submenu
    

**Patches Created:**

-   `003-remove-edit-menu-code-items.patch`
    
-   `004-hide-extensions-view-menu.patch`
    
-   `005-remove-go-menu.patch`
    
-   `006-cleanup-view-menu.patch`
    

**Bonus:**

-   `scripts/validate-patches.sh` - Pre-build validation (catches errors in 2 min vs 25 min)
    
-   `docs/menu-customization.md` - Documentation
    

**Validated:** 2025-12-08 by Jarmo

* * *

## ✅ Sprint 10: Installers (Complete)

**Goal:** Professional macOS installer

**Deliverables:**

-   DMG with drag-to-Applications UI
-   Custom volume icon and background
-   Build guardrails (prevent accidental broken builds)
-   SHA256 checksum

**Validated:** 2025-12-13 by Jarmo

* * *

## ✅ Sprint 11: Quick Wins (Complete)

**Goal:** High-value, low-complexity UX improvements

**Deliverables:**

-   Word count / reading time in status bar
-   CMD+B shortcut fixed (toggles bold, not sidebar)
-   Code block font size increased (14px → 16px)
-   H3 button in formatting bubble menu
-   Autosave enabled by default (1 second delay)
-   AI panel header made sticky

**Validated:** 2025-12-13 by Jarmo

* * *

## ✅ Sprint 12: Document Properties (Complete)

**Goal:** Visual interface for document metadata (YAML front-matter)

**Deliverables:**

-   Properties Panel component above editor
-   YAML front-matter parsing with `gray-matter`
-   Property types: Text, Date, Tags, Status
-   Minimal empty state ("Add properties" button)
-   Long text handling with auto-resize textarea
-   Two-way sync: extension ↔ webview

**Validated:** 2025-12-14 by Jarmo

* * *

## ✅ Sprint 13: Task Lists (Complete)

**Goal:** GFM task list checkboxes with full roundtrip support

**Deliverables:**

-   TipTap TaskList/TaskItem extensions
-   Slash command `/task` for creating task lists
-   Markdown roundtrip: `- [ ]` / `- [x]` syntax preserved
-   Bubble menu list buttons (bullet, ordered, task)
-   Toggle behavior: click active list to convert to paragraph

**Validated:** 2025-12-15 by Jarmo

* * *

## ✅ Sprint 14: Block Interactions (Complete)

**Goal:** Improve block-level editing with hover controls and drag/drop

**Deliverables:**

-   Block hover menu with delete button
-   Drag handle for reordering blocks
-   Visual feedback during drag operations

**Validated:** 2026-01-08 by Jarmo

* * *

## ✅ Sprint 15: Paste Enhancements (Complete)

**Goal:** Smart paste handling from various sources

**Deliverables:**

-   Intelligent paste from web pages
-   Word/Google Docs paste support
-   Clean HTML-to-Markdown conversion

**Validated:** 2026-01-09 by Jarmo

* * *

## ✅ Sprint 16: Auto-Update (Complete)

**Goal:** In-app update notifications via GitHub Releases

**Deliverables:**

-   Update module (8 TypeScript files)
-   GitHub Releases API integration
-   Version comparison (semantic versioning)
-   Notification UI with Install/Later/Don't Show buttons
-   User preference persistence
-   Startup scheduler (10s delay)

**Validated:** 2026-01-11 by Jarmo

* * *

## ✅ Sprint 17: File Preview (Complete)

**Goal:** CSV file preview with inline editing

**Deliverables:**

-   CSV files open in tabular view
-   Inline cell editing with auto-save
-   Row numbers column (Excel-style)
-   Virtual scrolling for large files (up to 10k rows)
-   Large file warning (>5MB)
-   TanStack Table + Virtual integration
-   Excel support deferred to Sprint 19 (requires CustomEditorProvider)

**Validated:** 2026-01-11 by Jarmo

* * *

## 🔮 Sprint 18+: Post-MVP (Future)

**Goal:** Enhancements based on user feedback

**Potential Features:**

-   Blockquote styling
-   Recent files list
-   File templates
-   Export to PDF/DOCX
-   AI image generation (Gemini)
-   Excel file preview (Sprint 19 planned)
    

* * *

## Timeline Summary

| Phase | Sprints | Status |
| --- | --- | --- |
| Foundation | 01-02 | ✅ Done |
| AI & UX | 03 | ✅ Done |
| Polish | 04-06 | ✅ Done |
| Governance | 07 | ✅ Done |
| Build Stability | 08 | ✅ Done |
| Menu Cleanup | 09 | ✅ Done |
| Installers | 10 | ✅ Done |
| Quick Wins | 11 | ✅ Done |
| Document Properties | 12 | ✅ Done |
| Task Lists | 13 | ✅ Done |
| Block Interactions | 14 | ✅ Done |
| Paste Enhancements | 15 | ✅ Done |
| Auto-Update | 16 | ✅ Done |
| File Preview | 17 | ✅ Done |
| **MVP Total** | **01-17** | **✅ Complete** |
| Post-MVP | 18+ | 🔮 Future |

* * *

## Sprint Workflow

Every sprint follows the 6-phase workflow managed by `sprint-manager` agent:

1.  **RESEARCH** - Read docs, explore codebase, identify risks
    
2.  **PLAN** - Create sprint-plan.md with checklist
    
3.  **⚠️ STOP** - **HARD GATE: Wait for Jarmo approval**
    
4.  **DEVELOP** - Implement checklist items
    
5.  **TEST** - qa-validator checks, Jarmo validates
    
6.  **DEPLOY** - Final commit, push, tag
    

**Governance:** See `.claude/agents/` for expert agents that enforce this workflow.

* * *

## References

-   Sprint details: `docs/sprints/sprint-XX-*/sprint-plan.md`
    
-   Expert agents: `.claude/agents/`
    
-   Skills: `.claude/skills/vscode-development/`