# CLAUDE.md - Ritemark Native

## Project Identity

Ritemark Native is a VS Code OSS fork with Ritemark built-in as the native markdown editor. Standalone branded app, **not an extension**.

**Target:** Local-first markdown editing with offline support.

* * *

## Architecture (Locked Decisions)

| Component | Choice | Non-Negotiable |
| --- | --- | --- |
| VS Code OSS | Git submodule | NOT a fork — easy upstream sync |
| Integration | Custom Editor Provider | .md files open in Ritemark webview |
| Build targets | darwin-arm64 (primary), win32-x64 (supported) | macOS Apple Silicon is primary; Windows is fully supported |
| Marketplace | Hidden | Prevent extension conflicts |
| Telemetry | Minimal, opt-out | Privacy first |
| Agent runtimes | Claude Code (SDK), Codex (stdio), ACP/OpenCode (stdio) + `AgentRuntime` interface | All runtimes implement the same interface — see `docs/development/architecture.md` |
| Agent approval | Unified approval gate — one webview message type for all runtimes | No runtime-specific approval message types after Sprint 79 |
| Browser tools | `BrowserMcpServer` injected into all runtimes via `BrowserToolsInjector` | No runtime-specific browser tool implementations |
| Model IDs | `src/ai/modelConfig.ts` is the authoritative registry | Never hardcode model IDs elsewhere; never split into runtime-specific files |

**Full extension architecture (subsystems, TO BE items, open debt):** `docs/development/architecture.md`
This document is updated at the end of every sprint that changes extension structure. Read it before planning any sprint that touches `extensions/ritemark/src/`.

* * *

## Critical Invariants

Runtime invariants (extension symlink, webview bundle freshness + size + `ai-sidebar` sentinel, postcss config, no raw `@tailwind`, extension TS compiles, VS Code patches applied, Settings page integrity) are enforced by `.claude/hooks/pre-commit-validator.sh` — the single source of truth. To inspect or modify checks, read or edit the hook directly. A failing check blocks the commit.

Build-environment prerequisites that the hook can't enforce at commit time (Node v20.x arm64 for prod, Node v22.21.1 arm64 for dev mode, `arch -arm64` shell wrapper) live in `.claude/skills/vscode-development/SKILL.md`.

Layout invariants (right sidebar AI panel + terminal placement, titlebar toolbar, etc.) are owned by patch 002. Detailed contract: `.claude/skills/vscode-development/references/layout-invariants.md`.

* * *

## NEVER Remove, Stub, or Disable Existing Features

**HARD RULE #1:** NEVER replace working code with a stub, placeholder, or "coming soon" message. This includes:
- Replacing a full implementation with a skeleton
- Commenting out or deleting functional code "temporarily"
- Removing imports, components, or features during unrelated sprint work

**HARD RULE #2:** ALL features are ON by default. Only disable when **Jarmo explicitly tells you to**. To disable, use the feature flag system (`extensions/ritemark/src/features/flags.ts`) — never delete code.

**Violation in v1.3.0** broke Settings → users could not configure API keys → ALL AI features (Flows, Chat) became unusable.

* * *

## Approval Gates (HARD Enforcement)

| Gate | Condition | Release Phrase |
| --- | --- | --- |
| Sprint Phase 2→3 | Cannot write implementation code | "approved", "Jarmo approved", "proceed" |
| Sprint Phase 3 entry | Cannot edit code on `main` — must be on `sprint-NN-short-name` branch | `git checkout -b sprint-NN-short-name` |
| Any commit | pre-commit hook must pass; for sprint-end, also `qa-validator` review | All checks green |
| Production release | release-manager Gate 1 (technical) + Gate 2 (Jarmo tested) | "tested locally", "approved for release" |

These gates cannot be bypassed. If blocked, wait for approval or fix the underlying issue.

### Sprint branch rule (HARD)

After Jarmo approves a sprint plan, the IMMEDIATE next action — before any code edit — is creating the sprint branch:

```bash
git checkout -b sprint-NN-short-name
```

Branch name matches the sprint directory under `docs/development/sprints/`. Verify with `git branch --show-current` before touching code. Applies to both lightweight and full-track sprints. **Sprint code never lands on `main` directly.**

* * *

## Expert Agents (MANDATORY Routing)

| Domain | Agent | Trigger keywords |
| --- | --- | --- |
| Builds, Extensions, Errors, Patches | `vscode-expert` | build, compile, error, fail, not working, extension, patch, update vscode, prod, production, gulp, run dev, start dev, launch, open, start, scripts/code.sh, npm run, yarn |
| PR Reviews & Merging | `pr-reviewer` | review PR, merge PR, check PR, approve PR |
| Sprint Workflow | `sprint-manager` | sprint, phase, plan, implement, feature |
| Quality Gates | `qa-validator` | commit, push, done, merge, PR |
| Releases & Distribution | `release-manager` | release, publish, ship, deploy, dmg, notarization, github release |
| Webview/Editor | `webview-expert` | webview, tiptap, react, vite, bundle, editor blank, editor not loading |
| Marketing & Content | `product-marketer` | changelog, release notes, blog post, landing page, marketing |
| UX/UI Design | `ux-expert` | dialog, modal, button, UI, UX, component, design, user experience |

Skills (knowledge injection, not agents):

| Skill | Use when |
| --- | --- |
| `vscode-development` | Production build commands, Node versions, patch rules, build gotchas |
| `release` | Release procedural commands (sign, DMG, notarize, GH release, update feed) |
| `feature-flags` | Adding flag-gated features |
| `flow-testing` | Testing Ritemark Flows |
| `ritemark-flows` | Building / editing flow JSON |
| `ritemark-design` | Visual design decisions |
| `architectural-design` | Deciding if a change is architectural, evaluating proposals against locked decisions, choosing between structural approaches |

**Routing rule:** when user input contains a trigger keyword, invoke the agent BEFORE responding. Subagents cannot invoke other subagents — when one needs another's domain, it surfaces a routing recommendation to the user.

* * *

## Production Builds

DO IT YOURSELF, do NOT delegate to `vscode-expert` (the agent has output-buffering issues that hang background mode). For exact commands, gotchas, and the arm64 wrapper, see `.claude/skills/vscode-development/SKILL.md` ## Production Build.

Hard rule: **NEVER** pipe build output through `| tail` / `| head` (causes background-mode hang). For release-step commands (sign, DMG, notarize), see the `release` skill.

* * *

## VS Code Patch System

Customizations to VS Code go through patch files in `patches/vscode/`, NEVER direct submodule edits.

| Task | Command |
| --- | --- |
| Apply all patches | `./scripts/apply-patches.sh` |
| Check patch status | `./scripts/apply-patches.sh --dry-run` |
| Create new patch | `./scripts/create-patch.sh "name"` |
| Update VS Code upstream | `./scripts/update-vscode.sh` |
| Remove patches | `./scripts/apply-patches.sh --reverse` |

After fresh clone: run `./scripts/apply-patches.sh`. Before VS Code upstream bump: run `./scripts/update-vscode.sh --check`.

### Current patches (10)

| Patch | Purpose |
| --- | --- |
| `001-ritemark-branding.patch` | Theme, fonts, icons, welcome page, about dialog, breadcrumbs |
| `002-ritemark-ui-layout.patch` | Sidebar, titlebar, tabs, explorer, panels |
| `003-ritemark-menu-cleanup.patch` | Hide VS Code dev features (chat, debug, go menu) |
| `004-ritemark-build-system.patch` | jschardet, microphone permission, integrity check skip |
| `005-ritemark-windows-and-oss-fixes.patch` | Windows builds, OSS compatibility, account service |
| `006-ritemark-dev-launch-fallback.patch` | Dev mode scripts, product.json dev launch fallback |
| `007-ritemark-vscode-1117-compat.patch` | VS Code 1.117 API compatibility fixes |
| `008-ritemark-windows-binary-strip.patch` | Strip debug symbols from Windows agent binaries |
| `009-ritemark-browser-context-bridge.patch` | Bridges VS Code webview context to the integrated browser panel |
| `010-ritemark-browser-action-bridge.patch` | Enables AI agent actions (click, navigate, fill) in the integrated browser |

Patch rules and unused-imports gotcha: `.claude/skills/vscode-development/PATCH-RULES.md`.

* * *

## Repository Structure

```plaintext
ritemark-native/
├── vscode/                      # VS Code OSS submodule (patches applied here)
│   └── extensions/ritemark/     # SYMLINK → ../../extensions/ritemark
├── extensions/ritemark/         # Ritemark extension SOURCE (edit here!)
│   ├── src/
│   │   ├── agent/               # Claude Code runtime (SDK + bundled binary)
│   │   ├── codex/               # Codex runtime (stdio JSON-RPC)
│   │   ├── acp/                 # ACP/OpenCode runtime (@agentclientprotocol/sdk)
│   │   ├── runtime/             # Shared AgentRuntime interface + registry (Sprint 79+)
│   │   ├── browser/             # Integrated browser — CDP panel, MCP server, action tools
│   │   ├── flows/               # Flow engine — scheduler, executor, storage
│   │   ├── features/            # Feature flags (flags.ts registry)
│   │   ├── ai/                  # Shared AI — modelConfig.ts, connectivity, analytics
│   │   ├── views/               # UnifiedViewProvider (AI sidebar), AgentLibraryViewProvider
│   │   ├── settings/            # Settings page bridge
│   │   ├── utils/               # Binary resolution, platform utils, bundledAgentRuntime
│   │   ├── voiceDictation/      # Whisper STT (macOS only)
│   │   ├── export/              # PDF/DOCX export
│   │   └── [editors]            # ritemarkEditor, docxEditorProvider, pdfEditorProvider, excelEditorProvider, drawioEditorProvider
│   ├── out/                     # Compiled JS
│   ├── webview/                 # React webview (TipTap editor + AI sidebar)
│   ├── media/                   # webview.js bundle (~7.6 MB IIFE — see GH #107)
│   └── binaries/agents/         # Bundled agent binaries (gitignored) + manifest.json
├── patches/vscode/              # Numbered patch files (001-*.patch … 010-*.patch)
├── branding/                    # Icons, logos, product.json overrides
├── scripts/                     # Development and release scripts
├── VSCode-darwin-arm64/         # Production build output (macOS)
├── docs/
│   ├── WISHLIST.md              # DEPRECATED — historical reference only (see below)
│   ├── user/                    # User-facing docs
│   ├── releases/                # Release notes per version
│   └── development/
│       ├── architecture.md      # Extension architecture — AS IS + TO BE (update each sprint)
│       ├── analysis/            # Research docs (dated)
│       └── sprints/             # Sprint docs (spec, tech-plan, tasks, sprint-plan)
└── docs-internal/               # Gitignored: marketing, product strategy
```

Feature ideas/requests → **GitHub Issues** on `ProductoryHQ/ritemark-native` with the `enhancement` label. Sprint planning pulls from open `enhancement` issues.

`docs/WISHLIST.md` is **deprecated** — kept as historical reference only. Do not add new items there. `.claude/agents/` and `.claude/skills/` are git-tracked — discoverable with `ls`.

* * *

## AI Model Configuration

All AI model identifiers must live in `extensions/ritemark/src/ai/modelConfig.ts`. Never hardcode model IDs anywhere else.

**Current state (pre-Sprint 79):** Three locations exist — `modelConfig.ts` (OpenAI/BYOK models), `src/agent/types.ts` (`CLAUDE_MODELS`), `src/codex/codexModels.ts` (Codex dynamic list). Sprint 79 consolidates all into `modelConfig.ts`.

**After Sprint 79:** The single-source rule is strictly true. Import from:

```typescript
import { CLAUDE_MODELS, OPENAI_LLM_MODELS, BYOK_PROVIDER_MODELS } from '../ai/modelConfig';
```

For webview code, the extension sends model config via the `flow:modelConfig` message into `webview/src/config/modelConfig.ts`.

* * *

## UI Components

Webview uses **Tailwind CSS** + **shadcn/ui** (Radix primitives, copy-paste pattern). For new dialogs/modals, use `webview/src/components/ui/dialog.tsx` (`DialogContent`, `DialogHeader`, `DialogBody`, `DialogFooter`, `DialogButton`). Never roll custom HTML+CSS modals. Invoke `ux-expert` for new component design.

* * *

## Feature Flags

Project uses feature flags for platform-specific, experimental, and premium features. Implementation: `.claude/skills/feature-flags/SKILL.md`. Sprint-manager prompts when a sprint touches a feature that may need gating.

**Rule:** When a feature is deleted, its flag must also be deleted (or set to `status: 'disabled'`). Zombie flags that gate deleted code are tracked in `docs/development/architecture.md` under ARCH-3.

* * *

## Team

- **Jarmo** = Product Owner (decisions, testing, approval)
- **Claude** = Engineering (via expert agents above)

When uncertain → ask Jarmo.
