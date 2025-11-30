# CLAUDE.md - RiteMark Native

## START HERE

**Read the handover workplan first:**
- `docs/handover/WEEK-1-WORKPLAN.md` - Current sprint tasks
- `docs/handover/CONTEXT.md` - Project context and team structure

**Reference documentation (in ritemark repo):**
- `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/README.md` - Master plan
- `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md` - Technical spec

---

## Project Overview

RiteMark Native is a VS Code OSS fork with RiteMark built-in as the native markdown editor. This is a standalone branded app, **not an extension**.

**Target:** "RiteMark Desktop" - local-first markdown editing with offline support.

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
├── vscode/                 # VS Code OSS submodule (DO NOT EDIT directly)
├── extensions/ritemark/    # Built-in RiteMark extension
├── build/                  # Build scripts and configs
├── branding/               # Icons, logos, product.json overrides
├── scripts/                # Development and release scripts
└── docs/
    └── handover/           # Sprint workplans and context
```

---

## Development Commands

```bash
# Clone with submodules
git clone --recursive https://github.com/jarmo-productory/ritemark-native.git

# Setup (after cloning)
./scripts/setup.sh

# Build macOS
./scripts/build-mac.sh

# Run development (from vscode/ folder)
cd vscode && ./scripts/code.sh
```

---

## Working Protocol

### Before Making Changes

1. Check locked decisions above
2. Read current workplan in `docs/handover/`
3. If architectural decision needed → Ask Jarmo

### Commit Style

```
feat: add VS Code submodule (Task 1)
fix: resolve extension loading issue
docs: update workplan with progress
chore: clean up build scripts
```

### After Completing Tasks

1. Commit with clear message
2. Push to GitHub
3. Update workplan with status
4. Notify Jarmo for testing

---

## Related Repositories

| Repo | Purpose | Path |
|------|---------|------|
| ritemark | Web app (reference only) | `/Users/jarmotuisk/Projects/ritemark` |
| ritemark-native | **This repo** | `/Users/jarmotuisk/Projects/ritemark-native` |
| ritemark-shared | Shared packages (future) | `/Users/jarmotuisk/Projects/ritemark-shared` |

---

## Team

- **Jarmo** = Product Owner (decisions, testing, approval)
- **Claude** = Engineering (implementation, everything else)

**When uncertain → Ask Jarmo**
