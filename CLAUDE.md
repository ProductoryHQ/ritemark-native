# CLAUDE.md - RiteMark Native

## Project Identity

RiteMark Native is a VS Code OSS fork with RiteMark built-in as the native markdown editor. This is a standalone branded app, **not an extension**.

**Target:** Local-first markdown editing with offline support.

---

## Architecture (Locked Decisions)

| Component | Choice | Non-Negotiable |
|-----------|--------|----------------|
| VS Code OSS | Git submodule | NOT a fork - easy upstream sync |
| Integration | Custom Editor Provider | .md files open in RiteMark webview |
| Build target | darwin-arm64 | Apple Silicon |
| Marketplace | Hidden | Prevent extension conflicts |
| Telemetry | Minimal, opt-out | Privacy first |

---

## Repository Structure

```
ritemark-native/
├── vscode/                      # VS Code OSS submodule (patches applied here)
│   └── extensions/ritemark/     # SYMLINK → ../../extensions/ritemark
├── extensions/ritemark/         # RiteMark extension SOURCE (edit here!)
│   ├── src/                     # TypeScript source
│   ├── out/                     # Compiled JS
│   ├── webview/                 # React webview (TipTap editor)
│   └── media/                   # webview.js bundle (~900KB)
├── patches/                     # RiteMark customizations to VS Code
│   └── vscode/                  # Patch files (numbered, e.g., 001-*.patch)
├── branding/                    # Icons, logos, product.json overrides
├── scripts/                     # Development and release scripts
├── VSCode-darwin-arm64/         # Production build output
└── docs/
    ├── analysis/                # Technical analysis documents
    └── sprints/                 # Sprint documentation
```

---

## VS Code Patch System

We customize VS Code via **patch files** (not direct submodule edits). This allows easy upstream updates.

### Patch Workflow

| Task | Command |
|------|---------|
| Apply all patches | `./scripts/apply-patches.sh` |
| Check patch status | `./scripts/apply-patches.sh --dry-run` |
| Create new patch | `./scripts/create-patch.sh "name"` |
| Update VS Code | `./scripts/update-vscode.sh` |
| Remove patches | `./scripts/apply-patches.sh --reverse` |

### Rules

1. **Never edit vscode/ directly** without creating a patch
2. **All VS Code customizations** must be saved as patch files in `patches/vscode/`
3. **After fresh clone**: Run `./scripts/apply-patches.sh`
4. **Before updating VS Code**: Run `./scripts/update-vscode.sh --check` to test

### Current Patches

| Patch | Purpose |
|-------|---------|
| `001-terminal-default-to-right-sidebar.patch` | Terminal opens in right sidebar by default |

---

## Critical Invariants

These MUST always be true. If broken, the project won't work:

| Invariant | Check | If Broken |
|-----------|-------|-----------|
| Extension symlink | `ls -la vscode/extensions/ritemark` shows `→ ../../extensions/ritemark` | Invoke `vscode-expert` |
| Webview bundle | `media/webview.js` is ~900KB (not 64KB) | Invoke `webview-expert` |
| Node architecture | `node -p "process.arch"` shows `arm64` | Invoke `vscode-expert` |
| Patches applied | `./scripts/apply-patches.sh --dry-run` shows all "Already applied" | Run `./scripts/apply-patches.sh` |

---

## Team

- **Jarmo** = Product Owner (decisions, testing, approval)
- **Claude** = Engineering (via expert agents below)

**When uncertain → Ask Jarmo**

---

## Expert Agents (MANDATORY Invocation)

I do NOT contain detailed technical knowledge in this file.
I MUST delegate to the appropriate expert agent.

| Domain | Agent | Trigger Keywords |
|--------|-------|------------------|
| Builds, Extensions, Errors, Patches | `vscode-expert` | build, compile, error, fail, not working, extension, patch, update vscode, **prod, production, gulp, run dev, start dev, launch, npm run, yarn** |
| Sprint Workflow | `sprint-manager` | sprint, phase, plan, implement, feature |
| Quality Gates | `qa-validator` | commit, push, done, merge, PR |
| Releases & Distribution | `release-manager` | release, publish, ship, deploy, dmg, notarization, github release |
| Webview/Editor | `webview-expert` | webview, tiptap, react, vite, bundle, editor blank, editor not loading |
| Marketing & Content | `product-marketer` | changelog, release notes, blog post, landing page, marketing |

### Invocation Rule

When user input contains trigger keywords → **INVOKE agent BEFORE responding.**

Responding without invoking the required agent is a **VIOLATION** of project governance.

### ⚠️ CRITICAL: Production Build Rule

**BEFORE any production build command**, I MUST invoke `vscode-expert` to:
1. Validate source files are not corrupted (no 0-byte .ts files)
2. Verify correct Node version (arm64 v20, NOT v23, NOT Rosetta)
3. Ensure extension compiles successfully
4. Check webview bundle exists and has correct size

**NEVER run `gulp vscode-darwin-arm64` or production builds directly.** Always delegate to vscode-expert first.

---

## Approval Gates (HARD Enforcement)

| Gate | Condition | Release Phrase |
|------|-----------|----------------|
| Sprint Phase 2→3 | Cannot write implementation code | "approved", "Jarmo approved", "proceed" |
| Any commit | qa-validator must pass all checks | All checks green |
| Production release | release-manager Gate 1 (technical) + Gate 2 (Jarmo tested) | "tested locally", "approved for release" |

**These gates cannot be bypassed.** If blocked, wait for approval or fix issues.

---

## Self-Check Protocol

Before EVERY response, I ask myself:

1. **Domain check:** Does this touch a domain in the expert table?
   - Yes → Have I invoked the required agent?
   - No agent invoked → **STOP. Invoke agent first.**

2. **Gate check:** Am I in a sprint? What phase?
   - Phase 2 without approval → **Cannot write code. Request approval.**
   - Ready to commit → **Invoke qa-validator first.**

3. **Uncertainty check:** Am I unsure about the right approach?
   - Yes → **Ask Jarmo before proceeding.**

---

## Quick Reference (High-Level Only)

For detailed commands and troubleshooting, invoke the appropriate agent.

| Task | Agent to Invoke |
|------|-----------------|
| Run dev mode | `vscode-expert` |
| Build production | `vscode-expert` |
| Fix blank editor | `webview-expert` |
| Start new sprint | `sprint-manager` |
| Commit changes | `qa-validator` |
| Fix build error | `vscode-expert` |
| Apply/create patches | `vscode-expert` |
| Update VS Code upstream | `vscode-expert` |
| Release to GitHub | `release-manager` |
| Check notarization | `release-manager` |
| Create DMG | `release-manager` |
| Update changelog | `product-marketer` |
| Write release notes | `product-marketer` |
| Update landing page | `product-marketer` |

---

## Agent Locations

```
.claude/
├── agents/
│   ├── vscode-expert.md      # Builds, extensions, debugging
│   ├── sprint-manager.md     # Sprint workflow, approval gates
│   ├── qa-validator.md       # Quality checks, commit validation
│   ├── release-manager.md    # Release process, notarization, DMG
│   ├── webview-expert.md     # TipTap, Vite, React, webview
│   ├── product-marketer.md   # Changelog, release notes, landing page
│   └── knowledge-builder.md  # Meta: creating new agents
└── skills/
    └── vscode-development/   # Knowledge base for vscode-expert
        ├── SKILL.md
        └── TROUBLESHOOTING.md
```
