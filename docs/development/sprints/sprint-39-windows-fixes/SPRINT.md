# Sprint 39 — Windows Fixes

**Branch:** `sprint/39-windows-fixes`
**Status:** Phase 2 — PLAN (awaiting approval)
**Goal:** Fix all Windows-specific issues found during code audit before Windows release.

---

## Scope

### A. Windows Branding (patch `001-ritemark-branding.patch`)

| # | File (in vscode/) | Problem | Fix |
|---|---|---|---|
| A1 | `resources/win32/VisualElementsManifest.xml:8` | `ShortDisplayName="Code - OSS"` | `"Ritemark"` |
| A2 | `resources/win32/code_150x150.png` | VS Code placeholder (395 bytes) | Ritemark tile PNG |
| A3 | `resources/win32/code_70x70.png` | VS Code placeholder (338 bytes) | Ritemark tile PNG |
| A4 | `build/lib/electron.ts:110-111` | `companyName: 'Microsoft Corporation'` | `'Productory'` |
| A5 | `build/gulpfile.vscode.ts:481,485` | rcedit metadata: Microsoft, 2022 | Productory, 2026 |
| A6 | `resources/win32/appx/AppxManifest.xml:18,23` | Publisher = Microsoft | Productory |
| A7 | `resources/server/manifest.json:2-3` | `"Code - OSS"` | `"Ritemark"` |
| A8 | `src/vs/workbench/browser/media/code-icon.svg` | VS Code icon in titlebar (Windows/Linux only) | Ritemark SVG |

### B. Mac-Specific Code (broken on Windows)

| # | File (in extensions/ritemark/) | Problem | Fix |
|---|---|---|---|
| B1 | `src/excelEditorProvider.ts:223-242` | `open -Ra` + "Numbers" fallback | Platform detection, `start` on Windows |
| B2 | `src/docxEditorProvider.ts:163-175` | `open -Ra` + "Pages" fallback | Platform detection, `start` on Windows |
| B3 | `src/ritemarkEditor.ts:1013-1032` | Same Excel/Numbers issue | Share utility with B1 |
| B4 | `webview/.../SpreadsheetToolbar.tsx:7,27,37-40` | "Open in Numbers" button | Platform-aware label |
| B5 | `src/ritemarkEditor.ts:371-372` | macOS System Preferences URL for mic | Windows Sound settings |
| B6 | `webview/.../FormattingBubbleMenu.tsx` | Tooltips show "Cmd+K" | Platform-aware Ctrl/Cmd |

### C. Windows-Incomplete Functionality

| # | File (in extensions/ritemark/) | Problem | Fix |
|---|---|---|---|
| C1 | `src/update/githubClient.ts:119-129` | Only looks for darwin DMG | Add Windows exe/zip pattern |

### D. Editor Issues

| # | Problem | Root Cause |
|---|---|---|
| D1 | White cursor between paragraphs on Windows | ProseMirror `caret-color: transparent` + Windows rendering |

---

## Implementation Plan

### Phase 1: Platform utility foundation
- Create shared `openExternal.ts` utility with platform detection
- Add platform info message to webview (`process.platform`)

### Phase 2: Branding patch update (A1, A4-A7)
- Update `001-ritemark-branding.patch` with all text-based branding fixes
- VisualElementsManifest, electron.ts, gulpfile, AppxManifest, server manifest

### Phase 3: Branding assets (A2, A3)
- Generate Ritemark tile PNGs (150x150, 70x70) from existing Icon-256.png
- Add to `branding/win32/` and update copy script in `apply-patches.sh`

### Phase 4: Mac-specific backend (B1, B2, B3, B5)
- Replace `open -Ra` with platform-aware file opening
- Replace macOS System Preferences with Windows Sound settings
- Use shared utility from Phase 1

### Phase 5: Mac-specific webview (B4, B6)
- "Open in Numbers" → platform-aware label ("Open in Excel" / "Open in Numbers")
- "Cmd+K" tooltips → platform-aware "Ctrl+K" / "Cmd+K"

### Phase 6: Windows update service (C1)
- Add Windows artifact pattern to githubClient.ts
- Verify against actual GitHub Actions artifact naming

### Phase 7: Cursor fix (D1)
- Add `caret-color` override in Editor.tsx to ensure visible cursor
- Test on Windows dark/light backgrounds

---

## Resolved Questions

1. **A2/A3 tile PNGs:** Generate from existing `branding/icons/Icon-256.png` (confirmed by Jarmo)
2. **C1 update service:** Windows artifact is `Ritemark-setup.exe`, published to ritemark-public repo same as DMG. Pattern from screenshot: `Ritemark-setup.exe` (alongside `Ritemark-arm64.dmg`, `Ritemark-x64.dmg`)

---

## Priority

**Must-fix:** A1-A7, B1-B6, C1, D1
**Nice-to-have:** C2-C3 (Whisper already gated by feature flag `platforms: ['darwin']`)
