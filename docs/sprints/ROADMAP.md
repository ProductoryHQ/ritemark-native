# RiteMark Native - Sprint Roadmap

**Last Updated:** 2025-12-01 (Sprint 03 complete)
**Team:** Jarmo (Product) + Claude (Engineering)

---

## Overview

This roadmap outlines all sprints needed to deliver RiteMark Native from POC to production-ready MVP and beyond.

| Sprint | Name | Status | Goal |
|--------|------|--------|------|
| 01 | POC | ✅ Complete | Validate VS Code fork approach |
| 02 | Full Editor | ✅ Complete | TipTap WYSIWYG editor working |
| 03 | AI & Polish | ✅ Complete | AI assistant, offline mode, UX cleanup |
| 04 | Core Polish | 📋 Next | VS Code chrome cleanup, branding, menus |
| 05 | Multi-Platform | 📋 Planned | Windows, Linux builds + installers |
| 06 | Release Prep | 📋 Planned | Auto-update, CI/CD, documentation |
| 07+ | Post-MVP | 🔮 Future | Enhancements based on user feedback |

---

## ✅ Sprint 01: Proof of Concept (Complete)

**Goal:** Prove the VS Code fork approach works with minimal prototype

**Duration:** ~3 days

**Deliverables:**
- [x] VS Code OSS as git submodule (v1.94.0)
- [x] RiteMark branding (product.json, app name)
- [x] Built-in extension structure
- [x] Custom editor provider for .md files
- [x] Placeholder webview with edit/save

**Exit Criteria:**
- [x] App launches with RiteMark branding
- [x] Opening .md file shows custom editor (not text editor)
- [x] Feels like "RiteMark Native" not "VS Code with extension"

**Validated:** 2025-11-30 by Jarmo

---

## ✅ Sprint 02: Full Editor Integration (Complete)

**Goal:** Integrate real TipTap editor by reusing ritemark-app code

**Duration:** ~4 days

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

**Exit Criteria:**
- [x] Real TipTap editor renders in webview
- [x] Can edit content (bold, italic, headings, lists, tables, code blocks)
- [x] Changes auto-save to disk
- [x] Jarmo: "I can do real work in this"

**Validated:** 2025-11-30 by Jarmo

---

## ✅ Sprint 03: AI & Polish (Complete)

**Goal:** Add AI assistant, offline detection, and polish the UX

**Duration:** ~2 days (2025-11-30 to 2025-12-01)

**Approach:** Reuse ~80% from ritemark-app AI implementation

### Deliverables

**AI Integration:**
- [x] AI chat sidebar in editor webview (Cmd+Shift+A)
- [x] `rephraseText` tool - modal with style options
- [x] `findAndReplaceAll` tool - preview matches, case preservation
- [x] `insertText` tool - smart positioning
- [x] Streaming responses with cancel support
- [x] Error handling (401, 429, timeout, offline)

**API Key Management:**
- [x] Store key via VS Code SecretStorage (OS keychain-backed)
- [x] Command: "RiteMark: Configure API Key" → input prompt
- [x] AI sidebar shows "API key not configured" + setup button when missing
- [x] Validate key format on entry (must start with `sk-`)

**Offline Mode:**
- [x] Network connectivity detection
- [x] AI panel shows offline message when disconnected
- [x] All local editing works offline

**UX Polish:**
- [x] Welcome walkthrough (first-run experience)
- [x] Hide unused VS Code views (Debug, Extensions, Outline, Timeline)
- [x] Lucide icon font integration for cleaner activity bar
- [x] Activity bar icon size optimization (16px)
- [x] Keyboard shortcut: Cmd+Shift+A toggle AI sidebar

### Exit Criteria
- [x] AI features work (rephrase, find/replace, insert)
- [x] Offline mode shows clear status
- [x] First-run walkthrough experience
- [x] Jarmo: "This is polished enough to show users"

**Validated:** 2025-12-01 by Jarmo

---

## 📋 Sprint 04: Core Polish

**Goal:** Strip VS Code chrome to create a clean, focused RiteMark experience

**Duration:** ~3-5 days estimated

### Areas to Address

**Activity Bar:**
- [ ] Hide Accounts icon (or rebrand for RiteMark)
- [ ] Hide Settings gear (move to menu only)
- [ ] Ensure only Explorer, Search, SCM visible
- [ ] Consider hiding activity bar entirely (sidebar-only mode)

**Status Bar:**
- [ ] Hide language mode selector (always Markdown)
- [ ] Hide encoding selector
- [ ] Hide line endings selector
- [ ] Hide spaces/tabs indicator
- [ ] Keep: Line/column, Git branch, RiteMark status
- [ ] Custom RiteMark status items (word count?)

**Panel Area (Terminal/Problems/Output):**
- [ ] Decide: Hide entirely or keep minimal?
- [ ] If keeping: disable Terminal, Problems tabs
- [ ] Remove keyboard shortcuts for panels

**Menus:**
- [ ] Hide Debug menu entirely
- [ ] Hide Terminal menu entirely
- [ ] Simplify View menu (remove dev items)
- [ ] Simplify Help menu (RiteMark-specific)
- [ ] Review File menu (remove workspace items?)
- [ ] Review Edit menu (keep standard items)

**Title Bar:**
- [ ] Show "RiteMark" not "Code - OSS"
- [ ] Custom window title format
- [ ] macOS: Native title bar styling

**Welcome/Start:**
- [ ] Disable VS Code welcome tab
- [ ] RiteMark walkthrough as default
- [ ] Empty state when no file open

**Keyboard Shortcuts:**
- [ ] Disable dev shortcuts (Cmd+Shift+P → hide dev commands)
- [ ] Ensure RiteMark shortcuts work (Cmd+Shift+A, etc.)
- [ ] Review conflicting shortcuts

**Context Menus:**
- [ ] Simplify editor context menu
- [ ] Simplify explorer context menu
- [ ] Add "Open with Text Editor" option

### Exit Criteria
- [ ] App feels like "RiteMark" not "VS Code"
- [ ] No dev-focused UI elements visible
- [ ] Clean, minimal interface
- [ ] Jarmo: "This doesn't feel like VS Code anymore"

---

## 📋 Sprint 05: Multi-Platform Builds

**Goal:** Windows and Linux builds with proper installers

**Duration:** ~4-5 days estimated

### Deliverables

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

### Exit Criteria
- [ ] All 3 platforms build successfully
- [ ] Installers work on clean machines
- [ ] No security warnings on install
- [ ] Jarmo can test Windows/Linux (or delegate)

---

## 📋 Sprint 06: Release Preparation

**Goal:** CI/CD, auto-update, documentation for public release

**Duration:** ~5-7 days estimated

### Deliverables

**CI/CD Pipeline:**
- [ ] GitHub Actions: build on push/PR
- [ ] GitHub Actions: release on tag
- [ ] Parallel platform builds
- [ ] Artifact upload to releases
- [ ] Build status badges

**Auto-Update System:**
- [ ] Update manifest endpoint
- [ ] In-app update notification
- [ ] Background download
- [ ] Restart to apply
- [ ] Defer update option (7 days)

**Documentation:**
- [ ] README with installation instructions
- [ ] Troubleshooting guide
- [ ] Keyboard shortcuts reference
- [ ] Contributing guide (optional)

**Telemetry (Optional):**
- [ ] Anonymous usage metrics
- [ ] Error reporting (opt-in)
- [ ] Privacy policy

### Exit Criteria
- [ ] Tag v1.0.0 → automatic release
- [ ] Auto-update works end-to-end
- [ ] Documentation complete
- [ ] Ready for beta testers

---

## 🔮 Sprint 07+: Post-MVP (Future)

**Goal:** Enhancements based on user feedback

These items are **not committed** - prioritization depends on user needs.

### Potential Features

**Editor Enhancements:**
- [ ] Custom themes support
- [ ] Focus mode (hide chrome)
- [ ] Typewriter mode
- [ ] Word count / reading time
- [ ] Spell check integration
- [ ] Find and replace in editor

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

**Settings UI (Option C - deferred from Sprint 03):**
- [ ] Dedicated RiteMark Settings webview
- [ ] API key management with status indicator
- [ ] Theme preferences
- [ ] Editor defaults
- [ ] AI model selection

**Collaboration (Maybe):**
- [ ] Export to PDF
- [ ] Export to HTML
- [ ] Share via link (cloud upload)

**Integration:**
- [ ] Git status in sidebar
- [ ] Simple git operations (commit, push)
- [ ] Obsidian vault compatibility

---

## Timeline Summary

| Phase | Sprints | Est. Duration | Status |
|-------|---------|---------------|--------|
| Foundation | 01-02 | ~1 week | ✅ Done |
| AI & UX | 03 | ~2 days | ✅ Done |
| Core Polish | 04 | ~3-5 days | 📋 Next |
| Platform | 05-06 | ~2 weeks | 📋 Planned |
| **MVP Total** | **01-06** | **~4-5 weeks** | **In Progress** |
| Post-MVP | 07+ | Ongoing | 🔮 Future |

---

## Sprint Workflow Reminder

Every sprint follows the same phases:

1. **RESEARCH** - Read docs, explore codebase, identify risks
2. **PLAN** - Create sprint-plan.md with checklist
3. **⚠️ STOP** - Wait for Jarmo approval
4. **DEVELOP** - Implement checklist items
5. **TEST** - Jarmo validates on Mac
6. **CLEANUP** - Remove debug code, update docs
7. **CI/CD** - Commit, push, tag

---

## Next Steps

**To start Sprint 04:**
1. Claude creates `docs/sprints/sprint-04-core-polish/` folder
2. Claude researches VS Code core modification points
3. Claude writes `sprint-plan.md` with detailed checklist
4. Jarmo reviews and approves
5. Development begins

---

## References

- Master Plan: `/ritemark/docs/research/vscode-native-app/README.md`
- Technical Spec: `/ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md`
- Sprint 01 Details: `sprint-01-poc/sprint-plan.md`
- Sprint 02 Details: `sprint-02-editor/sprint-plan.md`
- Sprint 03 Details: `sprint-03-ai-polish/sprint-plan.md`

### AI Implementation Reference (ritemark-app)

Key files to study/copy for Sprint 03:

```
/ritemark/ritemark-app/src/
├── services/ai/
│   ├── openAIClient.ts      # Core AI logic (673 lines) - REUSE
│   ├── apiKeyManager.ts     # Encrypted key storage - ADAPT
│   ├── textSearch.ts        # 3-tier text search - REUSE
│   ├── toolExecutor.ts      # Tool execution - ADAPT
│   └── widgets/
│       ├── core/            # Widget system architecture
│       ├── rephrase/        # Rephrase modal widget
│       └── find-replace/    # Find/replace with preview
└── components/ai/
    ├── AIChatSidebar.tsx    # Main chat UI (757 lines)
    └── SelectionIndicator.tsx
```

**AI Tools available:**
1. `rephraseText` - Rephrase with style options (longer/shorter/formal/casual)
2. `findAndReplaceAll` - Bulk replace with case preservation
3. `insertText` - Smart positioning (start/end/anchor-based)
