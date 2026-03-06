# CLAUDE.md - Ritemark Native

## Project Identity

Ritemark Native is a VS Code OSS fork with Ritemark built-in as the native markdown editor. This is a standalone branded app, **not an extension**.

**Target:** Local-first markdown editing with offline support.

* * *

## Architecture (Locked Decisions)

| Component | Choice | Non-Negotiable |
| --- | --- | --- |
| VS Code OSS | Git submodule | NOT a fork - easy upstream sync |
| Integration | Custom Editor Provider | .md files open in Ritemark webview |
| Build target | darwin-arm64 | Apple Silicon |
| Marketplace | Hidden | Prevent extension conflicts |
| Telemetry | Minimal, opt-out | Privacy first |

* * *

## Repository Structure

```plaintext
ritemark-native/
├── vscode/                      # VS Code OSS submodule (patches applied here)
│   └── extensions/ritemark/     # SYMLINK → ../../extensions/ritemark
├── extensions/ritemark/         # Ritemark extension SOURCE (edit here!)
│   ├── src/                     # TypeScript source
│   ├── out/                     # Compiled JS
│   ├── webview/                 # React webview (TipTap editor)
│   └── media/                   # webview.js bundle (~900KB)
├── patches/                     # Ritemark customizations to VS Code
│   └── vscode/                  # Patch files (numbered, e.g., 001-*.patch)
├── branding/                    # Icons, logos, product.json overrides
├── scripts/                     # Development and release scripts
├── VSCode-darwin-arm64/         # Production build output
├── docs/
│   ├── WISHLIST.md              # Feature wishlist (add ideas here!)
│   ├── user/                    # User-facing docs (guides, features)
│   ├── releases/                # Release notes per version
│   └── development/             # Developer docs
│       ├── analysis/            # Technical analysis documents
│       ├── sprints/             # Sprint documentation
│       └── release-process/     # Release & notarization docs
└── docs-internal/               # Gitignored: marketing, product strategy
```

**WISHLIST location:** `docs/WISHLIST.md` — All feature ideas go here (linked to sprint planning).

* * *

## VS Code Patch System

We customize VS Code via **patch files** (not direct submodule edits). This allows easy upstream updates.

### Patch Workflow

| Task | Command |
| --- | --- |
| Apply all patches | `./scripts/apply-patches.sh` |
| Check patch status | `./scripts/apply-patches.sh --dry-run` |
| Create new patch | `./scripts/create-patch.sh "name"` |
| Update VS Code | `./scripts/update-vscode.sh` |
| Remove patches | `./scripts/apply-patches.sh --reverse` |

### Rules

1.  **Never edit vscode/ directly** without creating a patch
    
2.  **All VS Code customizations** must be saved as patch files in `patches/vscode/`
    
3.  **After fresh clone**: Run `./scripts/apply-patches.sh`
    
4.  **Before updating VS Code**: Run `./scripts/update-vscode.sh --check` to test
    

### Current Patches (4 consolidated)

| Patch | Purpose |
| --- | --- |
| `001-ritemark-branding.patch` | Theme, fonts, icons, welcome page, about dialog, breadcrumbs |
| `002-ritemark-ui-layout.patch` | Sidebar, titlebar, tabs, explorer, panels |
| `003-ritemark-menu-cleanup.patch` | Hide VS Code developer features (chat, debug, go menu, etc.) |
| `004-ritemark-build-system.patch` | jschardet, microphone permission, integrity check skip |

* * *

## Critical Invariants

These MUST always be true. If broken, the project won't work:

| Invariant | Check | If Broken |
| --- | --- | --- |
| Extension symlink | `ls -la vscode/extensions/ritemark` shows `→ ../../extensions/ritemark` | Invoke `vscode-expert` |
| Webview bundle | `media/webview.js` is ~900KB (not 64KB) | Invoke `webview-expert` |
| Node architecture | `node -p "process.arch"` shows `arm64` | Invoke `vscode-expert` |
| Patches applied | `./scripts/apply-patches.sh --dry-run` shows all "Already applied" | Run `./scripts/apply-patches.sh` |
| Settings page | `RitemarkSettings.tsx` has full implementation (400+ lines, NOT a stub) | Restore from git history |

### Layout Invariants (NEVER break these)

The following layout rules are enforced by patch 002 and must remain true:

| Element | Required Position | Enforced By |
| --- | --- | --- |
| Ritemark AI panel | Right sidebar (auxiliary bar) | `viewDescriptorService.ts`: deletes cached override for `workbench.view.extension.ritemark-ai` |
| Terminal | Right sidebar (auxiliary bar) | `terminal.contribution.ts`: `ViewContainerLocation.AuxiliaryBar` |
| Titlebar icons | Only: left sidebar toggle, right sidebar toggle, settings gear | `layoutActions.ts` (custom LayoutControlMenu), `titlebarPart.ts` (accounts/gear hidden), `panelActions.ts` (panel toggle hidden) |
| Accounts icon | Hidden from titlebar | `titlebarPart.ts`: activity actions block commented out |
| Panel toggle | Hidden from titlebar | `panelActions.ts`: LayoutControlMenu registration commented out |
| `auxiliarybar` in package.json | Supported by core | `viewsExtensionPoint.ts`: `case 'auxiliarybar'` added |

**Key technical facts for layout work:**
- Extension container IDs get prefixed: `ritemark-ai` → `workbench.view.extension.ritemark-ai`
- VS Code caches view positions in SQLite (`views.customizations`). Package.json is only the default.
- Titlebar icons come from TWO sources: `LayoutControlMenu` (layout toggles) AND `titlebarPart.ts` (accounts/settings gear). Both must be patched.
- When commenting out code in VS Code patches, **ALWAYS remove unused imports** — build fails after 22 min otherwise.

### NEVER Remove, Stub, or Disable Existing Features

**HARD RULE #1:** You MUST NEVER replace a working component with a stub, placeholder, or "coming soon" message. This includes:

- Replacing a full implementation with a skeleton/placeholder
- Commenting out or deleting functional code "temporarily"
- Removing imports, components, or features during unrelated sprint work

**HARD RULE #2:** ALL features are ON by default. You may ONLY disable a feature when **Jarmo explicitly tells you to**. No exceptions. Do not proactively disable, hide, or gate features without direct instruction from Jarmo.

**If Jarmo asks to disable a feature**, use the feature flag system (`extensions/ritemark/src/features/flags.ts`). Feature flags allow toggling without destroying code.

**Violation of this rule in v1.3.0** broke the Settings page, which meant users could not configure API keys and ALL AI features (Flows, Chat) were unusable.

* * *

## Feature Flags

Project uses feature flags for platform-specific, experimental, and premium features.

**Implementation details:** `.claude/skills/feature-flags/SKILL.md`

**When to consider flags:** New features that need gating, platform restrictions, or kill-switch capability. Sprint-manager will prompt when relevant.

* * *

## AI Model Configuration

**IMPORTANT:** All AI model information is in `extensions/ritemark/src/ai/modelConfig.ts`

This file is the **single source of truth** for:
- OpenAI LLM models (GPT-5.x, GPT-4o family)
- OpenAI Image models (GPT Image 1.5, etc.)
- Gemini LLM models (Gemini 3, 2.5 family)
- Gemini Image models (Imagen 4, Nano Banana)
- Default model selections for different use cases

**NEVER hardcode model names elsewhere.** Use imports from modelConfig.ts:
```typescript
import { DEFAULT_MODELS, OPENAI_LLM_MODELS } from '../ai/modelConfig';
```

For webview code, model config is sent from extension via `flow:modelConfig` message and stored in `webview/src/config/modelConfig.ts`.

* * *

## UI Components

Webview uses **Tailwind CSS** with custom components. Future migration to **shadcn/ui** is planned.

### Current Shared Components

| Component | Location | Usage |
| --- | --- | --- |
| Dialog | `webview/src/components/Dialog.tsx` | All modal dialogs (Dictation Settings, Resize confirm) |

### Future: shadcn/ui

When doing UI refactoring, use **shadcn/ui** components:
- Tailwind-based (already in use)
- Copy-paste pattern (code is ours, not dependency)
- Radix UI primitives (accessible)
- See `docs/WISHLIST.md` for full migration plan

**Invoke `ux-expert` when designing new UI components.**

* * *

## Team

-   **Jarmo** = Product Owner (decisions, testing, approval)

-   **Claude** = Engineering (via expert agents below)


**When uncertain → Ask Jarmo**

* * *

## Expert Agents (MANDATORY Invocation)

I do NOT contain detailed technical knowledge in this file.  
I MUST delegate to the appropriate expert agent.

| Domain | Agent | Trigger Keywords |
| --- | --- | --- |
| Builds, Extensions, Errors, Patches | `vscode-expert` | build, compile, error, fail, not working, extension, patch, update vscode, **prod, production, gulp, run dev, start dev, launch, npm run, yarn** |
| Sprint Workflow | `sprint-manager` | sprint, phase, plan, implement, feature |
| Quality Gates | `qa-validator` | commit, push, done, merge, PR |
| Releases & Distribution | `release-manager` | release, publish, ship, deploy, dmg, notarization, github release |
| Webview/Editor | `webview-expert` | webview, tiptap, react, vite, bundle, editor blank, editor not loading |
| Marketing & Content | `product-marketer` | changelog, release notes, blog post, landing page, marketing |
| UX/UI Design | `ux-expert` | dialog, modal, button, UI, UX, component, design, user experience |

### Invocation Rule

When user input contains trigger keywords → **INVOKE agent BEFORE responding.**

Responding without invoking the required agent is a **VIOLATION** of project governance.

### ⚠️ CRITICAL: Production Build Instructions

**DO NOT delegate builds to `vscode-expert` agent** — it has reliability issues with output buffering.

**Build it yourself with these exact steps:**

```bash
# 1. Switch to arm64 Node v20 (MANDATORY)
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use 20 && node -p "process.arch"'
# Must show: arm64 + v20.x

# 2. Verify patches
./scripts/apply-patches.sh --dry-run
# Must show: all "Already applied"

# 3. Compile extension
cd extensions/ritemark && npx tsc --noEmit && cd ../..

# 4. Run production build (~25 min) — NEVER pipe through tail!
arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use 20 && cd /Users/jarmotuisk/Projects/ritemark-native && ./scripts/build-prod.sh 2>&1'
```

**HARD RULES:**
- **NEVER** use `| tail` or `| head` with build commands — causes output buffering hang in background mode
- **NEVER** run `gulp vscode-darwin-arm64` directly — it skips extension copy, resulting in broken app
- **ALWAYS** use `arch -arm64 /bin/zsh -c 'source ~/.nvm/nvm.sh && nvm use 20 && ...'` wrapper — default shell has x64 Node v23
- **ALWAYS** run as background task with `run_in_background: true` and `timeout: 600000` (10 min max)
- **Extension-only changes** (no VS Code core edits) can be hot-copied without full rebuild:
  ```bash
  cp -R extensions/ritemark/out/* "VSCode-darwin-arm64/Ritemark Native.app/Contents/Resources/app/extensions/ritemark/out/"
  ```

* * *

## Approval Gates (HARD Enforcement)

| Gate | Condition | Release Phrase |
| --- | --- | --- |
| Sprint Phase 2→3 | Cannot write implementation code | "approved", "Jarmo approved", "proceed" |
| Any commit | qa-validator must pass all checks | All checks green |
| Production release | release-manager Gate 1 (technical) + Gate 2 (Jarmo tested) | "tested locally", "approved for release" |

**These gates cannot be bypassed.** If blocked, wait for approval or fix issues.

* * *

## Self-Check Protocol

Before EVERY response, I ask myself:

1.  **Domain check:** Does this touch a domain in the expert table?
    
    -   Yes → Have I invoked the required agent?
        
    -   No agent invoked → **STOP. Invoke agent first.**
        
2.  **Gate check:** Am I in a sprint? What phase?
    
    -   Phase 2 without approval → **Cannot write code. Request approval.**
        
    -   Ready to commit → **Invoke qa-validator first.**
        
3.  **Uncertainty check:** Am I unsure about the right approach?
    
    -   Yes → **Ask Jarmo before proceeding.**
        

* * *

## Quick Reference (High-Level Only)

For detailed commands and troubleshooting, invoke the appropriate agent.

| Task | Agent to Invoke |
| --- | --- |
| Run dev mode | `vscode-expert` |
| Build production | `vscode-expert` |
| Fix blank editor | `webview-expert` |
| Start new sprint | `sprint-manager` |
| Commit changes | `qa-validator` |
| Fix build error | `vscode-expert` |
| Apply/create patches | `vscode-expert` |
| Build prod | `vscode-expert` |
| Update VS Code upstream | `vscode-expert` |
| Release to GitHub | `release-manager` |
| Check notarization | `release-manager` |
| Create DMG | `release-manager` |
| Update changelog | `product-marketer` |
| Write release notes | `product-marketer` |
| Update landing page | `product-marketer` |
| Design new UI | `ux-expert` |
| Create dialog/modal | `ux-expert` |

* * *

## Agent Locations

```plaintext
.claude/
├── agents/
│   ├── vscode-expert.md      # Builds, extensions, debugging
│   ├── sprint-manager.md     # Sprint workflow, approval gates
│   ├── qa-validator.md       # Quality checks, commit validation
│   ├── release-manager.md    # Release process, notarization, DMG
│   ├── webview-expert.md     # TipTap, Vite, React, webview
│   ├── product-marketer.md   # Changelog, release notes, landing page
│   ├── ux-expert.md          # UX/UI design, shadcn/ui patterns
│   └── knowledge-builder.md  # Meta: creating new agents
└── skills/
    ├── feature-flags/        # When to use and how to implement feature flags
    │   └── SKILL.md
    └── vscode-development/   # Knowledge base for vscode-expert
        ├── SKILL.md
        └── TROUBLESHOOTING.md
```