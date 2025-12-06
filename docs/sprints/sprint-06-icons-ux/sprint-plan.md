# Sprint 06: Icons & UX Polish

**Goal:** Custom file icon theme with Lucide icons for branded Explorer experience

**Status:** PLANNING - Awaiting approval

**Branch:** `sprint-06-icons-ux`

---

## Exit Criteria (Jarmo Validates)

- [ ] Custom RiteMark file icon theme installed by default
- [ ] Lucide-style icons for common file types
- [ ] Folder icons (open/closed states)
- [ ] Explorer looks cohesive and branded

---

## Phase 1: RESEARCH - COMPLETE

See `research/` folder:
- `icon-theme-architecture.md` - VS Code theme system documentation
- `icon-mapping.md` - Lucide icon mapping plan

**Key Findings:**
1. Icon themes are JSON files mapping file types to SVG/font icons
2. Priority: fileNames > languageIds > fileExtensions > default
3. Seti theme has 2300+ lines - we'll start minimal
4. SVG icons recommended (simpler than font-based)

---

## Phase 2: PLAN - READY FOR APPROVAL

### Task 1: Download Lucide SVG Icons
- [ ] Download from https://lucide.dev/icons/
- [ ] Icons needed (minimal set):
  - `file-text.svg` - Markdown files
  - `file.svg` - Generic file
  - `file-code.svg` - JS/HTML
  - `file-code-2.svg` - TypeScript
  - `braces.svg` - JSON
  - `paintbrush.svg` - CSS
  - `image.svg` - Image files
  - `folder.svg` - Folder closed
  - `folder-open.svg` - Folder open
  - `package.svg` - package.json
  - `book-open.svg` - README
  - `settings.svg` - Config files

### Task 2: Create Icon Theme Extension Structure
- [ ] Create `extensions/ritemark/fileicons/` directory
- [ ] Create `ritemark-icon-theme.json` with mappings
- [ ] Add `contributes.iconThemes` to package.json

### Task 3: Implement Icon Mappings
- [ ] Define `iconDefinitions` for each SVG
- [ ] Map file extensions:
  - `.md`, `.mdx` → markdown icon
  - `.json` → braces icon
  - `.js`, `.mjs`, `.cjs` → file-code
  - `.ts`, `.tsx` → file-code-2
  - `.html`, `.htm` → file-code
  - `.css`, `.scss`, `.less` → paintbrush
  - `.png`, `.jpg`, `.svg`, `.gif` → image
  - `.yaml`, `.yml` → settings
- [ ] Map special filenames:
  - `package.json` → package
  - `README.md` → book-open
- [ ] Set folder icons (closed/expanded)
- [ ] Set default fallback icon

### Task 4: Set as Default Theme
- [ ] Update product.json or defaults to use `ritemark-icons`
- [ ] Verify theme loads on startup

---

## Phase 3: DEVELOP

_Pending approval - will implement tasks above_

---

## Phase 4: TEST & VALIDATE

- [ ] All mapped file types display correct icons
- [ ] Folders show open/closed states correctly
- [ ] Icons render at proper size (not too big/small)
- [ ] Theme works in production build
- [ ] No broken/missing icons for common files

---

## Phase 5: CLEANUP

- [ ] Remove any test files
- [ ] Document icon mappings

---

## Phase 6: CI/CD DEPLOY

- [ ] Commit all changes
- [ ] Push to GitHub
- [ ] Create release build

---

## Files to Create/Modify

```
extensions/ritemark/
├── package.json                              ← Add iconThemes contribution
├── fileicons/
│   ├── ritemark-icon-theme.json             ← Theme definitions
│   └── icons/
│       ├── file-text.svg                    ← Markdown
│       ├── file.svg                         ← Default file
│       ├── file-code.svg                    ← JS/HTML
│       ├── file-code-2.svg                  ← TypeScript
│       ├── braces.svg                       ← JSON
│       ├── paintbrush.svg                   ← CSS
│       ├── image.svg                        ← Images
│       ├── folder.svg                       ← Folder closed
│       ├── folder-open.svg                  ← Folder open
│       ├── package.svg                      ← package.json
│       ├── book-open.svg                    ← README
│       └── settings.svg                     ← Config files
```

Also potentially:
- `branding/product.json` - Set default icon theme

---

## Questions for Jarmo

1. **Markdown icon:** Use standard Lucide `file-text` or want a custom branded icon?
2. **Brand colors:** Should icons use RiteMark accent colors, or keep neutral?
3. **Scope:** Start with minimal ~12 icons as planned, or want more coverage?

---

## Time Estimate

Minimal set (12 icons): ~2 hours implementation
Extended set (30+ icons): ~4 hours implementation

---

## Dependencies

- None - Sprint 05 foundation is complete
