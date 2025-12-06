# CLAUDE.md - RiteMark Native

## Project Overview

RiteMark Native is a VS Code OSS fork with RiteMark built-in as the native markdown editor. This is a standalone branded app, **not an extension**.

**Target:** Local-first markdown editing with offline support.

---

## Architecture (Locked Decisions)

| Component | Choice | Notes |
|-----------|--------|-------|
| VS Code OSS | Git submodule | NOT a fork - easy upstream sync |
| Integration | Custom Editor Provider | .md files open in RiteMark webview |
| Marketplace | Hidden | Prevent extension conflicts |
| Telemetry | Minimal, opt-out | Privacy first |

---

## Repository Structure

```
ritemark-native/
├── vscode/                      # VS Code OSS submodule (DO NOT EDIT directly)
│   └── extensions/ritemark/     # SYMLINK → ../../extensions/ritemark
├── extensions/ritemark/         # RiteMark extension SOURCE (edit here!)
│   ├── src/                     # TypeScript source
│   ├── out/                     # Compiled JS
│   ├── webview/                 # React webview (TipTap editor)
│   └── media/                   # webview.js bundle (~900KB)
├── branding/                    # Icons, logos, product.json overrides
├── scripts/                     # Development and release scripts
├── VSCode-darwin-arm64/         # Production build output
└── docs/
    ├── analysis/                # Technical analysis documents
    └── sprints/                 # Sprint documentation
```

### Critical: Extension Symlink

`vscode/extensions/ritemark` **MUST be a symlink** to `../../extensions/ritemark`:

```bash
# Verify symlink exists
ls -la vscode/extensions/ritemark
# Should show: ritemark -> ../../extensions/ritemark

# If broken (shows as directory), restore:
rm -rf vscode/extensions/ritemark
cd vscode/extensions && ln -s ../../extensions/ritemark ritemark
```

**Why:** Dev mode runs from `vscode/extensions/`, prod build follows symlink and copies files.

---

## Development Environment (Jarmo's Mac)

| Component | Version | Notes |
|-----------|---------|-------|
| macOS | 15.5 (Sequoia) | |
| Architecture | **arm64** | Apple Silicon - CRITICAL |
| Node | **v22.14.0** | Must be arm64, not x86_64! |
| Python | 3.11.3 | |
| Xcode CLI | Installed | |

**Build target:** `darwin-arm64`

### Verify Node Architecture

```bash
node -p "process.arch"  # MUST show "arm64"
file $(which node)      # Should show arm64
```

If wrong, switch Node: `nvm use 22.14.0`

---

## Development Commands

```bash
# Run development mode
cd vscode && ./scripts/code.sh

# Build production app (~25 min)
cd vscode && yarn gulp vscode-darwin-arm64

# Run production app
open "VSCode-darwin-arm64/RiteMark Native.app"

# Rebuild extension only
cd extensions/ritemark && npm run compile

# Rebuild webview only
cd extensions/ritemark/webview && npm run build
```

---

## Common Issues

### Extension not loading in dev mode
**Cause:** Symlink replaced with directory copy
**Fix:** Restore symlink (see above)

### Webview blank (white editor area)
**Cause:** Corrupted webview node_modules, webview.js too small (~64KB vs ~900KB)
**Fix:**
```bash
cd extensions/ritemark/webview
rm -rf node_modules package-lock.json
npm install && npm run build
ls -la ../media/webview.js  # Should be ~900KB
```

### Native module architecture mismatch
**Cause:** Node running as x86_64 under Rosetta
**Fix:** Switch to arm64 Node, clean reinstall all node_modules

For detailed troubleshooting: `.claude/skills/vscode-development/TROUBLESHOOTING.md`

---

## Sprint Development Routine

**Every sprint follows these phases. NO PHASE CAN BE SKIPPED.**

### Phase 1: RESEARCH
- Read existing documentation
- Explore codebase / dependencies
- Document findings in `docs/sprints/sprint-XX/research/`

### Phase 2: PLAN
- Create `sprint-plan.md` with clear checklist
- **⚠️ STOP: Wait for Jarmo's approval before proceeding**

### Phase 3: DEVELOP
- Implement checklist items
- Commit frequently with clear messages

### Phase 4: TEST & VALIDATE
- Verify all checklist items work
- Test both dev and production builds

### Phase 5: CLEANUP
- Remove debug code
- Update documentation

### Phase 6: DEPLOY
- Final commit, push to GitHub
- Tag release if applicable

---

## Commit Style

```
feat: add VS Code submodule (Sprint 1, Task 1)
fix: resolve extension loading issue
docs: update sprint plan with progress
chore: clean up build scripts
```

---

## Team

- **Jarmo** = Product Owner (decisions, testing, approval)
- **Claude** = Engineering (implementation, everything else)

**When uncertain → Ask Jarmo**
