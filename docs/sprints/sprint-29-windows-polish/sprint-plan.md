# Sprint 29: Windows Polish + Export Fixes

## Goal
Fix 6 issues: 4 Windows-specific polish issues + 2 cross-platform export bugs to provide a polished user experience across all platforms.

## Feature Flag Check
- [x] Does this sprint need a feature flag?
  - NO: These are bug fixes and platform-specific UI corrections
  - We will USE existing feature flags (voice-dictation) but not create new ones

## Success Criteria

### Windows Polish (Issues 1-4)
- [ ] Windows executable shows RiteMark icon in File Explorer
- [ ] Welcome screen shows RiteMark walkthrough (not VS Code default)
- [ ] Dictate button is hidden on Windows (uses existing platform check)
- [ ] App opens with Light theme immediately (no dark flash)

### Export Fixes (Issues 5-6, Cross-Platform)
- [ ] PDF export embeds images (not "[Image]" text)
- [ ] PDF export renders unicode characters correctly (☑ ☐)
- [ ] Word export produces formatted document (not raw markdown)
- [ ] Word export handles Windows line endings correctly

## Deliverables

| Deliverable | Description | Platform |
|-------------|-------------|----------|
| File Explorer icon | Embed `icon.ico` into Windows executable during build | Windows |
| Welcome screen | Configure product.json or patch to show RiteMark walkthrough | Windows |
| Dictate button visibility | Use existing `features.voiceDictation` flag in webview UI | Windows |
| Default theme fix | Set default theme in product.json or patch VS Code defaults | Windows |
| PDF image embedding | Fetch and embed images instead of "[Image]" placeholder | All |
| PDF unicode support | Use font that supports ☑ ☐ or fallback rendering | All |
| Word markdown parsing | Fix parsing to handle Windows line endings and edge cases | All |

## Implementation Checklist

### Phase 1: Research (COMPLETE)
- [x] Document issues in `docs/analysis/win-minor-prob.md`
- [x] Verify icon.ico exists in branding/icons/
- [x] Confirm feature flag system is working
- [x] Identify theme flash cause
- [x] Analyze PDF exporter code
- [x] Analyze Word exporter code

### Phase 2: Dictate Button (Simplest - Use Existing Flag) ✅
- [x] Read feature flag system implementation
- [x] Update App.tsx to receive and store features from load message
- [x] Pass features prop to DocumentHeader
- [x] Conditionally render VoiceDictationButton based on features.voiceDictation
- [ ] Test on Windows build (button should be hidden)
- [ ] Test on macOS (button should be visible)

### Phase 3: PDF Export - Image Embedding ✅
- [x] Study PDFKit image embedding API
- [x] Parse markdown image syntax to extract paths
- [x] Convert relative paths to absolute (resolve relative to document)
- [x] Fetch image data (fs.readFileSync for local files)
- [x] Embed images into PDF at correct positions with fit constraint
- [x] Handle image errors gracefully (fallback to "[Image: alt]" if fetch fails)
- [ ] Test with: local images, remote URLs, missing images

### Phase 4: PDF Export - Unicode Support ✅
- [x] Identify unicode characters causing issues (☑ ☐)
- [x] Option B selected: Replace unicode with ASCII fallback ([x] [ ])
- [x] Update checkbox rendering in pdfExporter.ts
- [ ] Test: Export markdown with checkboxes, verify rendering

### Phase 5: Word Export - Markdown Parsing ✅
- [x] Debug: Log what content reaches exportToWord()
- [x] Check if content is raw markdown or HTML
- [x] Test parsing with Windows line endings (`\r\n`)
- [x] Update regex patterns to handle both `\n` and `\r\n` (normalize before parsing)
- [ ] Test: Bold, italic, headings, lists, checkboxes
- [ ] Verify formatted output in Word

### Phase 6: File Explorer Icon
- [ ] Locate Windows build configuration (gulpfile or build script)
- [ ] Find icon embedding configuration
- [ ] Update to reference `branding/icons/icon.ico`
- [ ] Test Windows build shows correct icon

### Phase 7: Welcome Screen ✅
- [x] Research VS Code welcome page configuration
- [x] Chose extension-based approach (no patch needed)
- [x] Add first-launch detection in extension.ts activation
- [x] Show walkthrough via command: `workbench.action.openWalkthrough`
- [ ] Test: Launch fresh install, verify RiteMark walkthrough shows

### Phase 8: Dark Theme Flash
- [ ] Check VS Code default theme location in source
- [ ] Option A: Add default theme to product.json
- [ ] Option B: Create patch to change hardcoded default theme
- [ ] Test: Launch app, verify no dark flash on startup

## Technical Notes

### Windows-Specific Issues (1-4)

#### Issue #1: File Explorer Icon
**Current:** icon.ico (143KB) exists but not embedded in exe
**Fix location:** Likely `vscode/build/gulpfile.vscode.win32.js` or similar
**Testing:** Unzip built app, check file icons in Windows Explorer

#### Issue #2: Welcome Screen
**Current:** Shows VS Code default Welcome page
**Expected:** Shows RiteMark walkthrough (already defined in package.json)
**Fix location:** product.json or VS Code welcome page patch
**Reference:** Extension already has walkthrough at `extensions/ritemark/package.json` lines 126-164

#### Issue #3: Dictate Button
**Current:** Button visible on Windows (feature doesn't work on win32)
**Expected:** Button hidden on Windows
**Fix location:** Webview UI (App.tsx, DocumentHeader.tsx)
**Flag status:** Already exists - `voice-dictation` with `platforms: ['darwin']`
**Data flow:** Extension sends `features: { voiceDictation: false }` on Windows

#### Issue #4: Dark Theme Flash
**Current:** VS Code loads Dark Modern, then switches to Light Modern
**Expected:** Load Light Modern immediately
**Fix location:** VS Code core default theme setting
**Options:**
  - product.json: Add `"defaultTheme": "Default Light Modern"`
  - Patch: Modify VS Code's hardcoded default theme

### Cross-Platform Export Bugs (5-6)

#### Issue #5: PDF Export - Images and Unicode
**Current:**
- Images replaced with "[Image]" text (line 344 of pdfExporter.ts)
- Unicode checkboxes (☑ ☐) may not render with Helvetica font

**Expected:**
- Images embedded in PDF
- Unicode characters render correctly

**Fix location:** `extensions/ritemark/src/export/pdfExporter.ts`

**Technical details:**
- PDFKit supports image embedding via `doc.image(buffer, x, y, options)`
- Need to parse markdown image syntax: `![alt](path)`
- Convert relative paths to absolute (reuse webview's image path logic)
- Fetch image data (local files or URLs)
- For unicode: Use font with glyph support (DejaVu, Noto Sans) or fallback to ASCII

**Complexity:** Medium - PDFKit API is well-documented, but image positioning requires careful layout calculation

#### Issue #6: Word Export - Raw Markdown Output
**Current:** Word document shows raw markdown (`# Header`, `**bold**`, `- [ ] task`)
**Expected:** Formatted document with proper headings, bold/italic, checkboxes

**Fix location:** `extensions/ritemark/src/export/wordExporter.ts`

**Possible causes:**
1. Wrong content passed to exporter (HTML instead of markdown?)
2. Windows line endings (`\r\n`) breaking regex patterns
3. Parsing logic failing on certain markdown syntax

**Analysis of current code:**
- `parseMarkdownToDocx()` has logic for headings, lists, code blocks, bold/italic
- Uses regex patterns that may not handle `\r\n`
- Example: `/^(#{1,6})\s+(.+)$/` won't match if line ends with `\r\n`

**Fix strategy:**
1. Normalize line endings: `markdown.replace(/\r\n/g, '\n')`
2. Debug: Log content entering `exportToWord()` to verify it's markdown
3. Test regex patterns with real Windows-generated content

**Complexity:** Medium - Code structure looks correct, likely just line-ending normalization needed

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Icon embedding breaks build | High | Test on Windows VM before committing |
| Welcome screen patch conflicts with upstream | Medium | Use product.json if possible (cleaner) |
| Theme fix doesn't work on first launch | Low | Document workaround if needed |
| PDF image embedding breaks layout | Medium | Add max-width constraints, test with various image sizes |
| Word export still fails after line-ending fix | Medium | Debug with sample files, check docx library compatibility |
| Unicode font increases PDF file size | Low | Acceptable tradeoff for correct rendering |

## Status
**Current Phase:** 3 (DEVELOP - In Progress)
**Approval Required:** NO (approved by Jarmo)

## Approval
- [x] Jarmo approved this sprint plan ("kinnitan" - 2026-01-31)

## Branch
`fix/windows-minor-issues`

## Implementation Priority

Based on complexity and impact:

1. **Dictate Button** (30 min) - Quick win, high visibility
2. **PDF Image Embedding** (2-3 hrs) - High user impact, medium complexity
3. **Word Export Fix** (1-2 hrs) - High user impact, likely simple fix
4. **PDF Unicode Support** (1 hr) - Medium impact, simple
5. **Welcome Screen** (1-2 hrs) - Medium impact, extension-based
6. **File Explorer Icon** (2-3 hrs) - Medium impact, requires build understanding
7. **Dark Theme Flash** (2-4 hrs) - Low impact (cosmetic)

**Total estimated time:** 10-17 hours

## Related Documents
- Analysis: `docs/analysis/win-minor-prob.md`
- Feature flags: `extensions/ritemark/src/features/flags.ts`
- Extension package: `extensions/ritemark/package.json` (walkthrough definition)
- Product config: `branding/product.json`
- PDF exporter: `extensions/ritemark/src/export/pdfExporter.ts`
- Word exporter: `extensions/ritemark/src/export/wordExporter.ts`
