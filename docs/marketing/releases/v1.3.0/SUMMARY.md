# Ritemark v1.3.0 Release Summary

**Release Date:** 2026-02-06
**Version:** 1.3.0
**Type:** Major (new document viewers)

---

## What's Included in This Release

### Major Features

1. **PDF Viewer** (Sprint 32)
   - Read-only preview with continuous scroll
   - Text selection and copy
   - Zoom controls (50%-200%, Fit Width, Fit Page)
   - Page navigation
   - Lazy loading for performance

2. **DOCX Viewer** (Sprint 32)
   - Faithful visual rendering (fonts, colors, alignment)
   - Images, tables, and complex formatting preserved
   - Read-only preview
   - "Open in Word" button

3. **CSV Enhancements** (Sprint 32)
   - Column sorting (click headers)
   - Add rows via toolbar button
   - Preserves row indices during sort

4. **Claude Code Node** (Sprint 30)
   - New Flows node type
   - Executes tasks via Anthropic Agent SDK
   - Enables agentic workflows

5. **Platform Expansion** (Sprint 25 + Infrastructure)
   - Intel Mac support (darwin-x64)
   - GitHub Actions CI for automated builds
   - Windows build automation

---

## Files Created

### Release Materials
- `/docs/marketing/releases/v1.3.0/changelog.md` - CHANGELOG entry
- `/docs/marketing/releases/v1.3.0/release-notes.md` - Detailed release notes
- `/docs/marketing/releases/v1.3.0/social.md` - Social media copy (Twitter/LinkedIn)
- `/docs/marketing/releases/v1.3.0/SUMMARY.md` - This file

### Updated Files
- `/docs/marketing/landing-page/version.md` - Updated to v1.3.0
- `/docs/marketing/landing-page/features.md` - Updated Document Preview feature, added screenshot needs
- `/docs/CHANGELOG.md` - Added v1.3.0 entry and version history

---

## Key Marketing Messages

### Primary Message
**"From markdown editor to unified document workspace"**

Ritemark now handles PDFs, Word documents, and enhanced CSV operations alongside markdown editing - all in one local-first app.

### Target Audiences

1. **Writers & Content Creators**
   - Reference PDFs and Word docs while writing
   - All documents in one workspace

2. **Researchers & Knowledge Workers**
   - Preview research papers (PDF) alongside notes
   - Review formatted reports (DOCX) without switching apps

3. **Data-Driven Writers**
   - Sort and explore CSV data
   - Add rows inline
   - Write documentation next to the data

4. **AI Automation Users**
   - Claude Code node for complex research workflows
   - Agentic automation possibilities

### Key Differentiators

- **Privacy-first:** All processing local, no cloud uploads
- **Unified workspace:** Text + Data + Flow in one app
- **Faithful rendering:** PDFs and DOCX look exactly as authored
- **Cross-platform:** macOS (Apple Silicon + Intel) and Windows

---

## Technical Highlights

### Bundle Size
- Webview: ~3.95MB (up from ~900KB)
- PDF.js worker: ~1MB (separate file)
- Total: ~5MB (at target limit)

### Dependencies Added
- react-pdf@10.3.0 (PDF rendering)
- docx-preview@0.3.4 (DOCX rendering)
- @anthropic-ai/claude-agent-sdk@0.2.29 (Claude Code integration)

### Platform Support
- macOS Apple Silicon (darwin-arm64) - primary
- macOS Intel (darwin-x64) - NEW
- Windows 32-bit (win32-x64) - via GitHub Actions

---

## Known Limitations (For Documentation)

### PDF Viewer
- Large files (>50MB) may cause performance issues
- Password-protected PDFs not supported
- PDF forms are read-only

### DOCX Viewer
- Old .doc format (Word 97-2003) not supported
- VBA macros ignored
- Track changes not displayed

### CSV Enhancements
- Multi-line cells not yet supported (future)
- Delete row not implemented (future)
- Column operations (add/delete/rename) deferred

---

## Screenshot Needs

Priority screenshots for landing page and marketing:

1. **PDF Viewer** - Show multiple pages with zoom controls
2. **DOCX Viewer** - Show formatted document with colors/tables
3. **CSV Sort** - Show column header with sort indicators
4. **Claude Code Node** - Show Flows editor with Claude Code node connected

---

## Next Steps (Not Automated)

1. **Build & Test**
   - macOS arm64 build (local)
   - macOS x64 build (GitHub Actions)
   - Windows build (GitHub Actions)
   - Manual testing checklist (see release notes)

2. **GitHub Release**
   - Create release tag `v1.3.0`
   - Upload DMG files (arm64 + x64)
   - Upload Windows installer
   - Copy release notes as GitHub release description
   - Link to full release notes in repo

3. **Landing Page Update** (productory-2026 repo)
   - Update version number
   - Update "Document Preview" feature description
   - Add "UPDATED" badge to Flows and Document Preview
   - Consider adding screenshots (if available)

4. **Social Media** (Manual)
   - Post Twitter/X announcement (copy in social.md)
   - Post LinkedIn announcement (copy in social.md)
   - Consider blog post (optional, not in scope)

5. **Documentation**
   - Update README.md with v1.3.0 features (if needed)
   - Update any "Getting Started" guides mentioning file types

---

## Sprint References

- **Sprint 32:** PDF/DOCX Preview & CSV Editing
- **Sprint 30:** Claude Code Node
- **Sprint 25:** CI/CD Pipeline

---

## productory-2026 Handoff

The following content is ready for the productory-2026 agent to consume:

1. **Version Update**
   - Source: `/docs/marketing/landing-page/version.md`
   - Action: Update landing page version display

2. **Feature Updates**
   - Source: `/docs/marketing/landing-page/features.md`
   - Action: Update "Document Preview" feature card
   - Action: Update "Ritemark Flows" feature card
   - Action: Add "UPDATED" badges

3. **Release Notes**
   - Source: `/docs/marketing/releases/v1.3.0/release-notes.md`
   - Action: Link from landing page changelog/updates section

4. **Social Copy**
   - Source: `/docs/marketing/releases/v1.3.0/social.md`
   - Action: Manual post (no automation)

---

**Status:** Release content complete and ready for build/distribution phase.
