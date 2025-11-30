# Sprint 01: Proof of Concept

**Goal:** Prove the VS Code fork approach works with a minimal prototype

**Status:** 🔴 NOT STARTED

---

## Exit Criteria (Jarmo Validates)

- [ ] App launches with RiteMark branding (not VS Code)
- [ ] Opening .md file shows custom editor (not text editor)
- [ ] Feels like "RiteMark Native" not "VS Code with extension"

---

## Phase Checklist

### Phase 1: RESEARCH ✅
- [x] Read master plan documentation
- [x] Read technical spec (OPTION-B)
- [x] Document project context
- [x] Verify development environment

### Phase 2: PLAN ⏳
- [x] Create sprint folder structure
- [x] Write sprint-plan.md (this file)
- [ ] **Jarmo approval to proceed**

### Phase 3: DEVELOP
- [ ] **Task 1:** Add VS Code OSS as submodule (v1.94.0)
- [ ] **Task 2:** Set up build environment (npm install, compile)
- [ ] **Task 3:** Create branding overrides (product.json, placeholder icons)
- [ ] **Task 4:** Create built-in extension structure
- [ ] **Task 5:** Wire extension into VS Code build
- [ ] **Task 6:** Create macOS build (darwin-arm64)

### Phase 4: TEST & VALIDATE
- [ ] VS Code OSS compiles from source
- [ ] RiteMark branding visible (app name, icon)
- [ ] .md files open in custom editor
- [ ] Prototype webview shows file content
- [ ] macOS .app bundle runs
- [ ] Jarmo tests and approves

### Phase 5: CLEANUP
- [ ] Remove any debug/temp code
- [ ] Update documentation
- [ ] Code review

### Phase 6: CI/CD DEPLOY
- [ ] Final commit
- [ ] Push to GitHub
- [ ] Tag: `v0.1.0-poc`

---

## Task Details

### Task 1: Add VS Code OSS Submodule

```bash
cd /Users/jarmotuisk/Projects/ritemark-native
git submodule add https://github.com/microsoft/vscode.git vscode
cd vscode && git checkout 1.94.0 && cd ..
git add . && git commit -m "feat: add VS Code OSS as submodule (v1.94.0)"
```

**Verify:** `vscode/` folder exists with VS Code source

---

### Task 2: Build Environment

```bash
cd vscode
npm install
npm run compile
./scripts/code.sh  # Should launch VS Code OSS
```

**Note:** First build takes 10-30 minutes

---

### Task 3: Branding Overrides

Create in `branding/`:
- `product.json` - App name, identifiers
- `icons/` - Placeholder icons (512x512 colored squares)

---

### Task 4: Built-in Extension

Create in `extensions/ritemark/`:
- `package.json` - Extension manifest
- `src/extension.ts` - Entry point
- `src/ritemarkEditor.ts` - Custom editor provider
- `media/editor.html` - Webview placeholder

---

### Task 5: Wire Extension

Copy extension to `vscode/extensions/ritemark/` before build.

---

### Task 6: macOS Build

```bash
cd vscode
npm run gulp vscode-darwin-arm64
# Output: ../VSCode-darwin-arm64/
```

---

## Troubleshooting

**VS Code won't build:**
- Check Node version (need 18+)
- `npm cache clean --force`
- Delete `node_modules` and reinstall

**Extension not loading:**
- Check `package.json` syntax
- Verify extension in `extensions/` folder
- Check Developer Tools console

---

## Notes

_Implementation notes will be added during development_
