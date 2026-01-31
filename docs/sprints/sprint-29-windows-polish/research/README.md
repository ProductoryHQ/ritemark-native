# Sprint 29 Research Summary

This directory contains detailed analysis of 6 issues: 4 Windows-specific polish issues + 2 cross-platform export bugs, documented in `docs/analysis/win-minor-prob.md`.

## Research Documents

| Issue | Document | Complexity | Priority | Platform |
|-------|----------|------------|----------|----------|
| Dictate button visibility | `feature-flag-analysis.md` | **Simple** | High (quick win) | Windows |
| PDF export (images + unicode) | `pdf-export-analysis.md` | Medium | High | All |
| Word export (raw markdown) | `word-export-analysis.md` | Low-Medium | High | All |
| Welcome screen | `welcome-screen-analysis.md` | Medium | Medium | Windows |
| File Explorer icon | `icon-embedding-analysis.md` | Medium | Medium | Windows |
| Dark theme flash | `theme-flash-analysis.md` | Medium-Hard | Low (cosmetic) | Windows |

## Implementation Order (Recommended)

Based on complexity and impact:

### 1. Dictate Button (Simple, High Impact)
**Why first:**
- Easiest fix (10-15 lines of React code)
- Feature flag system already works
- High visibility issue
- Quick win to build momentum

**Estimated time:** 30 minutes
**Files:** 2 React files (App.tsx, DocumentHeader.tsx)
**Platform:** Windows

### 2. PDF Image Embedding (Medium, High Impact)
**Why second:**
- High user impact (export is broken feature)
- Medium complexity (PDFKit API is well-documented)
- Cross-platform (benefits all users)

**Estimated time:** 2-3 hours
**Files:** pdfExporter.ts
**Platform:** All

### 3. Word Export Fix (Low-Medium, High Impact)
**Why third:**
- High user impact (export is broken feature)
- Likely simple fix (line-ending normalization)
- Cross-platform (benefits all users)

**Estimated time:** 1-2 hours
**Files:** wordExporter.ts
**Platform:** All

### 4. PDF Unicode Support (Low, Medium Impact)
**Why fourth:**
- Simple fix (font change or ASCII fallback)
- Improves PDF quality
- Can be combined with #2

**Estimated time:** 1 hour
**Files:** pdfExporter.ts
**Platform:** All

### 5. Welcome Screen (Medium, Medium Impact)
**Why fifth:**
- Extension-based solution (no patch needed)
- Improves first-run experience
- Windows-specific polish

**Estimated time:** 1-2 hours
**Files:** extension.ts
**Platform:** Windows

### 6. File Explorer Icon (Medium, Medium Impact)
**Why sixth:**
- Requires understanding build system
- May need patch
- Long build time to test (~25 min)
- Windows-specific polish

**Estimated time:** 2-3 hours
**Files:** Build config or patch
**Platform:** Windows

### 7. Dark Theme Flash (Medium-Hard, Low Impact)
**Why last:**
- Most complex (requires VS Code source modification)
- Cosmetic issue (doesn't break functionality)
- Can be deferred if time-constrained

**Estimated time:** 2-4 hours
**Files:** VS Code theme service patch
**Platform:** Windows

**Total estimated time:** 10-17 hours

## Key Findings

### Windows-Specific Issues

#### Feature Flag System (Issue #3)
- ✅ Extension correctly evaluates platform
- ✅ Sends feature state to webview
- ❌ Webview doesn't use the data
- **Fix:** React prop passing (simple)

#### Icon Embedding (Issue #1)
- ✅ Icon asset exists (icon.ico, 143KB)
- ❌ Not embedded in Windows exe
- **Fix:** Build configuration or patch

#### Welcome Screen (Issue #2)
- ✅ Walkthrough is defined correctly
- ❌ VS Code shows generic welcome instead
- **Fix:** Extension activation + product.json config

#### Theme Flash (Issue #4)
- ✅ Extension sets correct default theme
- ❌ VS Code loads dark theme before extension config applies
- **Fix:** Patch VS Code theme service default

### Cross-Platform Export Bugs

#### PDF Export (Issue #5)
- ❌ Images replaced with "[Image]" text
- ❌ Unicode characters (☑ ☐) may not render with Helvetica font
- **Root cause:** Placeholder code never implemented; limited font glyphs
- **Fix:** Parse markdown images, fetch data, embed with PDFKit; use unicode font or ASCII fallback

#### Word Export (Issue #6)
- ❌ Outputs raw markdown instead of formatted document
- **Root cause:** 80% confident it's Windows line endings (`\r\n`) breaking regex patterns
- **Fix:** Normalize line endings before parsing: `markdown.replace(/\r\n/g, '\n')`
- **Complexity:** Likely a 1-line fix

## Testing Strategy

### Per-Issue Testing
Each fix should be tested independently:
1. Make change
2. Rebuild (webview or full app)
3. Test on Windows
4. Test on macOS (ensure no regression)

### Export Testing (Issues 5-6)
**PDF Export:**
1. Create markdown with:
   - Local images (relative paths)
   - Remote images (URLs)
   - Unicode checkboxes (☑ ☐)
   - Other unicode (→ ≈ 🎉)
2. Export to PDF
3. Verify: Images embedded, unicode renders correctly

**Word Export:**
1. Create markdown with:
   - Headings (H1-H6)
   - Bold, italic, both
   - Lists (ordered, unordered)
   - Checkboxes
   - Code blocks
2. Test on Windows (CRLF line endings)
3. Test on macOS (LF line endings)
4. Export to Word
5. Verify: All formatting preserved

### Integration Testing (Windows)
After all fixes:
1. Fresh Windows build
2. Delete user data folder
3. First launch checklist:
   - [ ] Light theme (no dark flash)
   - [ ] RiteMark walkthrough shows
   - [ ] No dictate button in header
4. File Explorer:
   - [ ] RiteMark icon on exe
5. Export features:
   - [ ] PDF with images works
   - [ ] Word formatting works

### Cross-Platform Verification
- **Windows:** All 6 issues fixed
- **macOS:** Dictate button still visible, export fixes work, no regressions

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PDF image embedding breaks layout | Medium | Medium | Add max-width constraints, test with various sizes |
| Word export still fails after line-ending fix | Low | Medium | Debug with sample files, check docx library |
| Build system changes break Windows build | Low | High | Test thoroughly, keep backups |
| Theme patch conflicts with upstream | Medium | Low | Use simple patch, document well |
| Welcome screen doesn't show on first launch | Medium | Medium | Multiple fallback approaches available |
| Unicode font increases PDF file size | Low | Low | Acceptable tradeoff for correct rendering |

## Dependencies

- **None** - All fixes are independent
- Can be implemented in any order
- Can ship partial fixes (e.g., just exports + dictate button)

## Success Metrics

- [ ] All 6 issues resolved
- [ ] Export features work correctly on all platforms
- [ ] No regressions on macOS
- [ ] Windows build passes qa-validator
- [ ] Jarmo confirms fixes on Windows test machine
