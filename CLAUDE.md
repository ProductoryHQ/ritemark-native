# CLAUDE.md - RiteMark Native

## START HERE

**Current sprint:**
- `docs/sprints/sprint-02-editor/sprint-plan.md` - Current sprint checklist
- `docs/sprints/sprint-02-editor/research/` - Sprint research & context

**Previous sprints:**
- `docs/sprints/sprint-01-poc/` - ✅ Complete (POC validated)

**Reference documentation (in ritemark repo):**
- `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/README.md` - Master plan
- `/Users/jarmotuisk/Projects/ritemark/docs/research/vscode-native-app/OPTION-B-full-fork.md` - Technical spec

---

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
├── vscode/                 # VS Code OSS submodule (DO NOT EDIT directly)
├── extensions/ritemark/    # Built-in RiteMark extension
├── build/                  # Build scripts and configs
├── branding/               # Icons, logos, product.json overrides
├── scripts/                # Development and release scripts
└── docs/
    └── sprints/
        └── sprint-XX-name/
            ├── research/       # Context & research docs
            ├── sprint-plan.md  # Checklist of deliverables
            └── ...             # Other sprint docs
```

---

## Development Environment (Jarmo's Mac)

| Component | Version |
|-----------|---------|
| macOS | 15.5 (Sequoia) |
| Architecture | arm64 (Apple Silicon) |
| Node | v23.0.0 |
| npm | 10.9.0 |
| Python | 3.11.3 |
| Xcode CLI | Installed |

**Build target:** `darwin-arm64`

---

## Sprint Development Routine

**Every sprint follows these phases. NO PHASE CAN BE SKIPPED.**

### Phase 1: RESEARCH (Context)

- Read existing documentation
- Explore codebase / dependencies
- Identify unknowns and risks
- Document findings in `docs/sprints/sprint-XX/research/`

### Phase 2: PLAN

- Create `sprint-plan.md` with clear checklist
- Define exit criteria
- **⚠️ STOP: Wait for Jarmo's approval before proceeding**

### Phase 3: DEVELOP

- Implement checklist items
- Commit frequently with clear messages
- Update sprint-plan.md checkboxes as you go

### Phase 4: TEST & VALIDATE

- Verify all checklist items work
- Jarmo tests on Mac (`darwin-arm64`)
- Document any issues found

### Phase 5: CLEANUP

- Remove debug code / commented code
- Ensure code quality
- Update documentation
- Address any tech debt created

### Phase 6: CI/CD DEPLOY

- Final commit with all changes
- Push to GitHub
- Tag release if applicable
- Notify Jarmo: "Sprint XX complete, ready for review"

---

## Sprint Folder Structure

Each sprint gets a dedicated folder:

```
docs/sprints/sprint-01-poc/
├── research/
│   ├── context.md          # Project context
│   └── findings.md         # Research findings
├── sprint-plan.md          # THE checklist (source of truth)
└── notes.md                # Optional: implementation notes
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

## Commit Style

```
feat: add VS Code submodule (Sprint 1, Task 1)
fix: resolve extension loading issue
docs: update sprint plan with progress
chore: clean up build scripts
```

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

---

## Troubleshooting

For build issues, see `.claude/skills/vscode-development/TROUBLESHOOTING.md`
