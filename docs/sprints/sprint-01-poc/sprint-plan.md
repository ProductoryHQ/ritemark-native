# Sprint 01: Proof of Concept

**Goal:** Prove the VS Code fork approach works with a minimal prototype

**Status:** 🟢 COMPLETE

---

## Exit Criteria (Jarmo Validates)

- [x] App launches with RiteMark branding (not VS Code)
- [x] Opening .md file shows custom editor (not text editor)
- [x] Feels like "RiteMark Native" not "VS Code with extension"

**Validated:** 2025-11-30 by Jarmo

---

## Phase Checklist

### Phase 1: RESEARCH ✅
- [x] Read master plan documentation
- [x] Read technical spec (OPTION-B)
- [x] Document project context
- [x] Verify development environment

### Phase 2: PLAN ✅
- [x] Create sprint folder structure
- [x] Write sprint-plan.md (this file)
- [x] **Jarmo approval to proceed**

### Phase 3: DEVELOP ✅
- [x] **Task 1:** Add VS Code OSS as submodule (v1.94.0)
- [x] **Task 2:** Set up build environment (npm install, compile)
- [x] **Task 3:** Create branding overrides (product.json, placeholder icons)
- [x] **Task 4:** Create built-in extension structure
- [x] **Task 5:** Wire extension into VS Code build
- [x] **Task 6:** Dev mode launch (full macOS build deferred - too slow for POC)

### Phase 4: TEST & VALIDATE ✅
- [x] VS Code OSS compiles from source
- [x] RiteMark branding visible (app name, icon)
- [x] .md files open in custom editor
- [x] Prototype webview shows file content
- [x] Dev mode runs successfully
- [x] Jarmo tests and approves

### Phase 5: CLEANUP ✅
- [x] No debug/temp code to remove
- [x] Documentation updated
- [x] Sprint plan updated

### Phase 6: CI/CD DEPLOY ⏳
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

### Task 6: Dev Mode Launch

For fast iteration, use dev mode instead of full macOS build:

```bash
cd vscode
./scripts/code.sh
```

Full macOS build (`gulp vscode-darwin-arm64`) takes 15-30 minutes - use only for releases.

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

**Dev mode Electron path issue:**
- If branding changes app name, rename `.build/electron/Code - OSS.app` to match `nameLong` in product.json

---

## Notes

- POC validated successfully on 2025-11-30
- Dev mode workflow is much faster than full builds (seconds vs 20+ minutes)
- Full macOS build deferred to Sprint 2 for release preparation
- Custom editor provider works as expected
