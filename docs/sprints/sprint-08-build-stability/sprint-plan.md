# Sprint 08: Build Stability

**Goal:** Create a reliable, repeatable production build process without manual fixes

**Status:** Phase 4 (DEVELOP) - Implementation complete

---

## Problem Statement

Current build process is fragile:
- Files get corrupted (0-byte SVGs, JS files)
- Symlinks not followed by gulp (extension not included)
- Node version mismatches cause silent failures
- 25-minute builds fail at the end or produce broken apps
- Manual fixes required after every build

**Root causes identified:**
1. No pre-build environment validation
2. Gulp doesn't follow symlinks for ritemark extension
3. No post-build verification
4. Corrupted files in source not detected until runtime

---

## Success Criteria

- [x] Single command builds a working production app
- [x] Build fails fast if environment is wrong (< 30 seconds)
- [x] Build fails if critical files are corrupted
- [x] No manual copying of extension/icons after build
- [x] Build script documents itself (clear output)
- [x] vscode-expert agent enforces pre-build checks
- [x] BONUS: Claude Code hooks auto-validate before commits

---

## Deliverables

### 1. Pre-Build Validation Script (COMPLETE)

**File:** `scripts/validate-build-env.sh`

Validates in <30 seconds:
- Node version (v20.x required)
- Node architecture (arm64, not Rosetta)
- Symlink integrity
- Critical source files (webview.js, extension.js, ritemarkEditor.js)
- Config files (vite.config.ts, postcss.config.js)
- Icon files (12+ SVGs)
- CSS processing (no raw @tailwind directives)

### 2. Post-Build Validation Script (COMPLETE)

**File:** `scripts/validate-build-output.sh`

Validates production app:
- App bundle exists
- Extension directory included
- Critical files present with correct sizes
- Icon theme files present

### 3. Master Build Script (COMPLETE)

**File:** `scripts/build-prod.sh`

5-step automated pipeline:
1. Pre-build validation
2. VS Code gulp build (~25 min)
3. Copy extension to .app bundle
4. Verify extension copy
5. Post-build validation

### 4. vscode-expert Agent Update (COMPLETE)

Added to `.claude/agents/vscode-expert.md`:
- Pre-Build Checklist (MANDATORY) section
- Post-Build Validation section
- Common Build Issues table
- Build Pipeline diagram

### 5. Claude Code Hooks (BONUS - COMPLETE)

**Files:**
- `.claude/settings.json` - Hook configuration
- `.claude/hooks/pre-commit-validator.sh` - Validation script

Automatically runs before any `git commit` command:
- Validates symlink integrity
- Checks webview bundle size
- Verifies config files not empty
- Ensures CSS is processed
- Confirms TypeScript compiles

Blocks commit (exit 2) if any check fails.

---

## Implementation Checklist

### Phase 1: Create Scripts (COMPLETE)
- [x] Create `scripts/validate-build-env.sh`
- [x] Create `scripts/validate-build-output.sh`
- [x] Create `scripts/build-prod.sh`
- [x] Make all scripts executable (`chmod +x`)
- [x] Test pre-build validation (caught 3 issues - working!)

### Phase 2: Update Agents (COMPLETE)
- [x] Add pre-build checklist to `vscode-expert.md`
- [x] Build pipeline diagram added

### Phase 3: Claude Code Hooks (BONUS - COMPLETE)
- [x] Create `.claude/hooks/` directory
- [x] Create `pre-commit-validator.sh`
- [x] Create `.claude/settings.json` with PreToolUse hook

### Phase 4: Commit
- [ ] Commit all Sprint 08 deliverables
- [ ] Update ROADMAP.md to mark Sprint 08 complete

---

## Files Created/Modified

| File | Action | Status |
|------|--------|--------|
| `scripts/validate-build-env.sh` | Create | DONE |
| `scripts/validate-build-output.sh` | Create | DONE |
| `scripts/build-prod.sh` | Create | DONE |
| `.claude/agents/vscode-expert.md` | Update | DONE |
| `.claude/settings.json` | Create | DONE |
| `.claude/hooks/pre-commit-validator.sh` | Create | DONE |

---

## Validation Test Results

Pre-build validation script successfully caught:
1. Wrong Node version (v23 instead of v20)
2. Wrong architecture (x64/Rosetta instead of arm64)
3. Missing symlink

This proves the script works - it fails fast before a 25-minute wasted build.

---

## Approval

- [x] Jarmo approved this sprint plan (2025-12-07)

Sprint 08 implementation complete. Ready for commit.
