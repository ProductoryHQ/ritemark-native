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

---

## Critical Invariants

These MUST always be true. If broken, the project won't work:

| Invariant | Check | If Broken |
|-----------|-------|-----------|
| Extension symlink | `ls -la vscode/extensions/ritemark` shows `→ ../../extensions/ritemark` | Invoke `vscode-expert` |
| Webview bundle | `media/webview.js` is ~900KB (not 64KB) | Invoke `webview-expert` |
| Node architecture | `node -p "process.arch"` shows `arm64` | Invoke `vscode-expert` |

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
| Builds, Extensions, Errors | `vscode-expert` | build, compile, error, fail, not working, extension |
| Sprint Workflow | `sprint-manager` | sprint, phase, plan, implement, feature |
| Quality Gates | `qa-validator` | commit, push, done, ship, merge, PR, ready |
| Webview/Editor | `webview-expert` | webview, tiptap, react, vite, bundle, editor |

### Invocation Rule

When user input contains trigger keywords → **INVOKE agent BEFORE responding.**

Responding without invoking the required agent is a **VIOLATION** of project governance.

---

## Approval Gates (HARD Enforcement)

| Gate | Condition | Release Phrase |
|------|-----------|----------------|
| Sprint Phase 2→3 | Cannot write implementation code | "approved", "Jarmo approved", "proceed" |
| Any commit | qa-validator must pass all checks | All checks green |
| Production release | Full QA + explicit sign-off | "ship it", "release approved" |

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

---

## Agent Locations

```
.claude/
├── agents/
│   ├── vscode-expert.md      # Builds, extensions, debugging
│   ├── sprint-manager.md     # Sprint workflow, approval gates
│   ├── qa-validator.md       # Quality checks, commit validation
│   ├── webview-expert.md     # TipTap, Vite, React, webview
│   └── knowledge-builder.md  # Meta: creating new agents
└── skills/
    └── vscode-development/   # Knowledge base for vscode-expert
        ├── SKILL.md
        └── TROUBLESHOOTING.md
```
