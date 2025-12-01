# RiteMark Native - Sprint Roadmap

**Last Updated:** 2025-11-30 (added AI reuse analysis)
**Team:** Jarmo (Product) + Claude (Engineering)

---

## Overview

This roadmap outlines all sprints needed to deliver RiteMark Native from POC to production-ready MVP and beyond.

| Sprint | Name | Status | Goal |
|--------|------|--------|------|
| 01 | POC | ✅ Complete | Validate VS Code fork approach |
| 02 | Full Editor | ✅ Complete | TipTap WYSIWYG editor working |
| 03 | AI & Polish | 📋 Planned | AI assistant, offline mode, UX cleanup |
| 04 | Multi-Platform | 📋 Planned | Windows, Linux builds + installers |
| 05 | Release Prep | 📋 Planned | Auto-update, CI/CD, documentation |
| 06+ | Post-MVP | 🔮 Future | Enhancements based on user feedback |

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

## 📋 Sprint 03: AI & Polish

**Goal:** Add AI assistant, offline detection, and polish the UX

**Duration:** ~4-6 days estimated

**Approach:** Reuse ~80% from ritemark-app AI implementation

### Code Reuse from ritemark-app

| Source File | Reuse | Adaptation Needed |
|-------------|-------|-------------------|
| `services/ai/openAIClient.ts` | 100% | Remove `dangerouslyAllowBrowser` |
| `services/ai/textSearch.ts` | 100% | None - editor-agnostic |
| `services/ai/apiKeyManager.ts` | Pattern | Use VS Code SecretStorage API |
| `services/ai/widgets/*` | 85% | Adapt UI for VS Code webview |
| `components/ai/AIChatSidebar.tsx` | 70% | Port to extension webview |
| `components/ai/SelectionIndicator.tsx` | 90% | Minor styling tweaks |

**Key Architecture from ritemark-app:**
- OpenAI GPT with streaming + function calling
- Widget system for modal operations (rephrase, find/replace)
- 3-tier text search (exact → markdown-normalized → unicode)
- Encrypted API key storage (AES-256-GCM)

### Deliverables

**AI Integration (reuse openAIClient + widgets):**
- [ ] AI chat sidebar in editor webview
- [ ] `rephraseText` tool - modal with before/after preview
- [ ] `findAndReplaceAll` tool - preview matches, case preservation
- [ ] `insertText` tool - smart positioning
- [ ] Streaming responses with cancel support
- [ ] Error handling (401, 429, timeout, offline)

**API Key Management (Option B - minimal):**
- [ ] Store key via VS Code SecretStorage (OS keychain-backed)
- [ ] Command: "RiteMark: Configure API Key" → input prompt
- [ ] AI sidebar shows "API key not configured" + setup button when missing
- [ ] Validate key format on entry (must start with `sk-`)

**Offline Mode:**
- [ ] Network connectivity detection
- [ ] Status bar indicator (Ready/Offline)
- [ ] AI panel shows "Connect for AI features" when offline
- [ ] All local editing works offline

**UX Polish:**
- [ ] Welcome screen (first-run experience)
- [ ] Hide unused VS Code views (Activity Bar cleanup)
- [ ] Simplify menus (remove dev-focused items)
- [ ] Keyboard shortcut: Cmd+Shift+A toggle AI sidebar
- [ ] "Open with Text Editor" context menu option

**Quality:**
- [ ] Error boundaries in webview
- [ ] Graceful degradation
- [ ] Performance optimization

### Exit Criteria
- [ ] AI features work (rephrase, find/replace, insert)
- [ ] Offline mode shows clear status
- [ ] First-run experience under 2 minutes
- [ ] Jarmo: "This is polished enough to show users"

---

## 📋 Sprint 04: Multi-Platform Builds

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

## 📋 Sprint 05: Release Preparation

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

## 🔮 Sprint 06+: Post-MVP (Future)

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
| Polish | 03 | ~1 week | 📋 Next |
| Platform | 04-05 | ~2 weeks | 📋 Planned |
| **MVP Total** | **01-05** | **~4 weeks** | **In Progress** |
| Post-MVP | 06+ | Ongoing | 🔮 Future |

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

**To start Sprint 03:**
1. Claude creates `docs/sprints/sprint-03-ai-polish/` folder
2. Claude researches AI integration approaches
3. Claude writes `sprint-plan.md` with detailed checklist
4. Jarmo reviews and approves
5. Development begins

---

## References

- Master Plan: `/ritemark/docs/research/vscode-native-app/README.md`
- Technical Spec: `/ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md`
- Sprint 01 Details: `sprint-01-poc/sprint-plan.md`
- Sprint 02 Details: `sprint-02-editor/sprint-plan.md`

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
