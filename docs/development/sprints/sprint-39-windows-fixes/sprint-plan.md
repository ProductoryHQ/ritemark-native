# Sprint 39: Windows Fixes

## Goal

Fix all branding, platform-compatibility, and functionality issues found in the Windows code audit so the Windows build is ready for release.

---

## Feature Flag Check

- [x] Does this sprint need a feature flag?
  - NO: These are bug fixes and platform compatibility corrections.
  - Voice dictation is already behind an existing flag (`platforms: ['darwin']`).
  - No new features are being added that require gating.

---

## Success Criteria

### A — Branding (Must-fix)
- [ ] Windows Start Menu tile shows "Ritemark" (not "Code - OSS")
- [ ] Windows executable file properties show "Productory" (not "Microsoft Corporation")
- [ ] Windows tile PNGs (150x150, 70x70) show Ritemark branding (not VS Code placeholder)
- [ ] gulpfile rcedit metadata shows Productory + 2026 (not Microsoft + 2022)
- [ ] AppxManifest.xml publisher shows Productory
- [ ] server/manifest.json shows "Ritemark"

### B — Mac-specific code (Must-fix)
- [ ] Excel/Numbers open actions work cross-platform (macOS: `open -a`, Windows: `start`)
- [ ] Word/Pages open actions work cross-platform (macOS: `open -a`, Windows: `start`)
- [ ] "Open in Numbers" button is hidden on Windows (Numbers does not exist)
- [ ] Microphone settings link opens the correct OS settings on each platform
- [ ] Keyboard shortcut tooltips show "Cmd+K" on macOS and "Ctrl+K" on Windows

### C — Windows-incomplete functionality (C1 must-fix, C2 nice-to-have)
- [ ] Auto-update correctly resolves Windows download URL from GitHub release assets
- [ ] Whisper binary path function returns null (not throw) on unsupported platforms

### D — Cursor issue (Must-fix)
- [ ] White cursor artifact between paragraphs is resolved on Windows

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| Branding patch additions | Extend `001-ritemark-branding.patch` with A1, A4, A5, A6, A7 fixes |
| Windows tile PNGs | Ritemark-branded `code_150x150.png` and `code_70x70.png` in `branding/win32/` + copy step |
| Cross-platform open helpers | `src/utils/openExternal.ts` — platform-aware app launch utilities |
| Updated excelEditorProvider | Uses shared helper instead of macOS-only `open` commands |
| Updated docxEditorProvider | Uses shared helper instead of macOS-only `open` commands |
| Updated ritemarkEditor (open) | Uses shared helper for Excel open action |
| Updated ritemarkEditor (mic settings) | Platform-aware microphone settings URL |
| SpreadsheetToolbar platform-aware | Hides "Numbers" on Windows, uses platform passed from extension |
| FormattingBubbleMenu platform-aware | Shows "Cmd+K" on macOS, "Ctrl+K" on Windows |
| Platform in webview load message | Extension sends `platform: process.platform` in load message |
| App.tsx platform state | Stores platform and passes to children |
| githubClient.ts multi-platform | Resolves correct download URL for win32, darwin-arm64, darwin-x64 |
| whisperCpp.ts safe null return | Returns null instead of throwing on unsupported platforms |
| Cursor fix | CSS fix for white cursor artifact between paragraphs on Windows |

---

## Implementation Checklist

### Phase 1: Research (COMPLETE)
- [x] Audit all 17 issues (A1-A7, B1-B6, C1-C3, D1)
- [x] Document branding issues in `research/01-branding-audit.md`
- [x] Document mac-specific code issues in `research/02-mac-specific-code.md`
- [x] Document Windows-incomplete functionality in `research/03-windows-incomplete-functionality.md`
- [x] Document cursor issue in `research/04-cursor-issue.md`
- [x] Confirm sprint number (39) and create sprint directory

### Phase 2: Platform helper + webview platform (Foundation)

These tasks unlock B4, B6, and parts of B1-B3. Do these first.

- [ ] Add `platform: process.platform` to the load message in `src/ritemarkEditor.ts`
- [ ] Create `src/utils/openExternal.ts` with `checkAppInstalled()` and `openInExternalApp()` helpers (macOS + Windows + Linux branches)
- [ ] Update `App.tsx` to receive and store `platform` from load message, pass as prop

### Phase 3: Branding patch (A1, A4-A7)

- [ ] Extend `patches/vscode/001-ritemark-branding.patch` with fix for A1 (VisualElementsManifest ShortDisplayName)
- [ ] Extend patch for A4 (electron.ts companyName and copyright)
- [ ] Extend patch for A5 (gulpfile.vscode.ts rcedit CompanyName + LegalCopyright year)
- [ ] Extend patch for A6 (AppxManifest.xml publisher)
- [ ] Extend patch for A7 (server/manifest.json name)
- [ ] Run `./scripts/apply-patches.sh --dry-run` to verify patch applies cleanly

### Phase 4: Branding assets (A2, A3)

- [ ] Create or source Ritemark-branded 150x150 PNG tile → `branding/win32/code_150x150.png`
- [ ] Create or source Ritemark-branded 70x70 PNG tile → `branding/win32/code_70x70.png`
- [ ] Add copy step to `scripts/apply-patches.sh` (or equivalent) to copy tiles into `vscode/resources/win32/` after patch application

### Phase 5: Mac-specific code fixes (B1-B3)

- [ ] Refactor `excelEditorProvider.ts` to use `openExternal.ts` helpers (remove macOS-only `open -Ra` / `open -a`)
- [ ] Refactor `docxEditorProvider.ts` to use `openExternal.ts` helpers (remove macOS-only `open -Ra` / `open -a`, remove Pages reference)
- [ ] Refactor `ritemarkEditor.ts` Excel open methods to use `openExternal.ts` helpers
- [ ] Fix `ritemarkEditor.ts` `system:openMicSettings` handler with platform branch (B5)

### Phase 6: Webview platform-aware UI (B4, B6)

- [ ] Update `SpreadsheetToolbar.tsx` to accept `platform` prop, hide "Open in Numbers" on Windows
- [ ] Update `FormattingBubbleMenu.tsx` to show `Cmd` on darwin and `Ctrl` on win32/linux (B6)
- [ ] Trace prop chain: confirm `platform` flows from `App.tsx` → `SpreadsheetToolbar` and `FormattingBubbleMenu`

### Phase 7: Windows update URL (C1)

- [ ] Update `githubClient.ts` `getDownloadUrl()` to detect `process.platform` + `process.arch`
- [ ] Add Windows asset name pattern (verify naming from CI/CD artifacts — check sprint-25 workflow files)
- [ ] Add darwin-x64 pattern for Intel Mac support
- [ ] Verify `getManifestUrl()` does not need platform-specific changes

### Phase 8: Whisper safe null (C2)

- [ ] Update `whisperCpp.ts` `getWhisperBinaryPath()` to return `null` instead of throwing
- [ ] Update all call sites to handle `null` return gracefully

### Phase 9: Cursor fix (D1)

- [ ] Inspect `.ProseMirror-gapcursor` CSS in webview styles
- [ ] Inspect TipTap editor config for GapCursor extension
- [ ] Apply fix (likely CSS) and note in `notes/` what the root cause was

### Phase 10: TypeScript compile check

- [ ] Run `cd extensions/ritemark && npx tsc --noEmit` — zero errors required

---

## Technical Notes

### Cross-platform open commands

| Platform | Check if app installed | Open file in app |
|----------|----------------------|-----------------|
| macOS | `open -Ra "App Name"` | `open -a "App Name" "filePath"` |
| Windows | try launching and catch error | `start "" "App Name" "filePath"` |
| Linux | `which appname` | `xdg-open "filePath"` |

### Windows asset name pattern (C1)

Check `.github/workflows/` for the artifact upload step to confirm the Windows artifact naming.
Expected pattern: something like `Ritemark-win32-x64-1.4.0.exe` or `Ritemark-Setup-1.4.0.exe`.

### Patch workflow reminder

```bash
# Verify patches apply cleanly
./scripts/apply-patches.sh --dry-run

# After editing patch file, test full apply
./scripts/apply-patches.sh --reverse && ./scripts/apply-patches.sh
```

### Files changed in this sprint

**VS Code patches (via `patches/vscode/001-ritemark-branding.patch`):**
- `vscode/resources/win32/VisualElementsManifest.xml`
- `vscode/build/lib/electron.ts`
- `vscode/build/gulpfile.vscode.ts`
- `vscode/resources/win32/appx/AppxManifest.xml`
- `vscode/resources/server/manifest.json`

**Binary assets (direct copy via script):**
- `vscode/resources/win32/code_150x150.png`
- `vscode/resources/win32/code_70x70.png`

**Extension source:**
- `extensions/ritemark/src/utils/openExternal.ts` (new)
- `extensions/ritemark/src/excelEditorProvider.ts`
- `extensions/ritemark/src/docxEditorProvider.ts`
- `extensions/ritemark/src/ritemarkEditor.ts`
- `extensions/ritemark/src/update/githubClient.ts`
- `extensions/ritemark/src/voiceDictation/whisperCpp.ts`

**Webview:**
- `extensions/ritemark/webview/src/App.tsx`
- `extensions/ritemark/webview/src/components/header/SpreadsheetToolbar.tsx`
- `extensions/ritemark/webview/src/components/FormattingBubbleMenu.tsx`
- `extensions/ritemark/webview/src/styles/` (cursor fix CSS)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Binary PNG files cannot be in text patch | Medium | Use `branding/win32/` + copy script step |
| Windows asset filename pattern unknown | Medium | Check GitHub Actions workflow before writing C1 fix |
| `start ""` Windows command may fail with spaces in path | Low | Quote path properly: `start "" "App Name" "C:\\path with spaces\\file.xlsx"` |
| Patch conflict with existing branding hunk | Medium | Regenerate patch after applying changes manually, verify full apply |
| Cursor CSS fix on macOS side effects | Low | Only target Windows-visible class or use safe universal fix |
| TypeScript compile errors from refactoring | Medium | Run `tsc --noEmit` after each phase |

---

## Priorities Recap

**Must-fix before Windows release:** A1-A7, B1-B6, C1, D1
**Nice-to-have:** C2 (Whisper safe null)

---

## Status

**Current Phase:** 2 (PLAN)
**Approval Required:** YES — waiting for Jarmo's approval before Phase 3

## Branch

`fix/windows-fixes-sprint-39`

## Approval

- [ ] Jarmo approved this sprint plan
