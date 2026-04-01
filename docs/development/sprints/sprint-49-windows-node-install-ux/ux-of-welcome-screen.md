# Welcome Screen & First-Run Setup UX

## Context

When a new Windows user downloads and opens Ritemark for the first time, they see:

1. **Welcome page** in the editor area (VS Code's welcome page, Ritemark-branded)
2. **AI sidebar** opens in the right panel (auxiliary bar)

Currently, the sidebar shows fragmented setup flows per agent:
- Ritemark Agent → "OpenAI API Key Required" (dead end)
- Claude Code → SetupWizard (detects Git, Node, but only installs Claude CLI)
- Codex → CodexSetupView (detects Codex CLI, handles auth)

**Problem (from real user feedback):** Kaja opened Ritemark, saw "OpenAI API Key Required", and was stuck. She didn't realize she could pick a different agent from the dropdown. She also needed to install Claude Code CLI manually from the terminal — Ritemark didn't help with that. `irm` didn't work because she was in CMD, not PowerShell.

---

## New Design: Unified Onboarding Wizard

When the sidebar opens for the first time on a system with missing dependencies, it shows a **single, unified setup flow** — not per-agent fragments.

### Principle

> The sidebar IS the onboarding. It detects everything, installs everything, one click at a time.

---

## What can Ritemark install automatically?

We already have the terminal infrastructure (`vscode.window.createTerminal` + `sendText`, and `spawn` for background installs). Here's the full install matrix:

| Dependency | Install method | Automation level | Notes |
|------------|---------------|-----------------|-------|
| **Git** | `winget install Git.Git` | 1-click via terminal | `winget` ships with Windows 11. Falls back to browser link if winget missing |
| **Node.js** | `winget install OpenJS.NodeJS.LTS` | 1-click via terminal | Same winget approach. Falls back to browser link |
| **Claude CLI** | `irm https://claude.ai/install.ps1 \| iex` | 1-click, silent background | Already implemented in `installer.ts` via `spawn`. Progress shown in wizard |
| **Codex CLI** | `npm install -g @openai/codex` | 1-click via terminal | Requires Node.js first. Already have `createTerminal` pattern from Codex repair |
| **Claude auth** | `claude` (opens browser for OAuth) | 1-click via terminal | Already implemented in `installer.ts` |
| **Codex auth** | Codex login flow | 1-click | Already implemented in `codexManager.ts` |

### winget availability

- Windows 11: pre-installed
- Windows 10 1709+: available via Microsoft Store
- Fallback: if `where winget` fails, show browser download link instead

### Install dependency chain

```
Git ──→ Claude CLI install (uses git internally)
         │
Node.js ──→ Codex CLI install (npm install)
         │
         └→ Claude CLI install (alternative npm path)
```

Git and Node.js are independent of each other and can be installed in any order. But both are prerequisites for the CLI agents.

---

## Detection Layer (extension-side)

On first load, detect all dependencies at once:

| Dependency | Detection | Required for |
|------------|-----------|-------------|
| winget | `where winget` | Automated Git/Node install |
| Git | `where git` | Claude CLI |
| Node.js | `where node` | Codex CLI (npm) |
| Claude CLI | `where claude` + binary inspection | Claude agent |
| Codex CLI | `where codex` + binary inspection | Codex agent |
| Claude auth | Keychain/credential check | Claude ready |
| Codex auth | Codex status check | Codex ready |

Result sent to webview as unified `OnboardingStatus`:

```typescript
interface OnboardingStatus {
  platform: 'win32' | 'darwin';
  // Package manager
  wingetAvailable: boolean;       // can we automate Git/Node install?
  // System-level dependencies
  gitInstalled: boolean;
  nodeInstalled: boolean;
  // CLI agents
  claudeCliInstalled: boolean;
  claudeCliAuthenticated: boolean;
  codexCliInstalled: boolean;
  codexCliAuthenticated: boolean;
  // API keys (for Ritemark Agent)
  hasOpenAiKey: boolean;
  hasAnthropicKey: boolean;
  // Computed
  anyAgentReady: boolean;         // at least one agent is fully usable
}
```

---

## User Flow

### Step 1: Welcome + Dependency Checklist

When sidebar opens and `!anyAgentReady`:

```
┌─────────────────────────────────┐
│                                 │
│   Welcome to Ritemark           │
│                                 │
│   Let's set up your AI          │
│   assistant.                    │
│                                 │
│   ┌───────────────────────────┐ │
│   │                           │ │
│   │  Requirements             │ │
│   │                           │ │
│   │  ✓  Git           Ready  │ │
│   │  ✕  Node.js    [Install]  │ │
│   │                           │ │
│   │  AI Assistants            │ │
│   │                           │ │
│   │  ✕  Claude     [Install]  │ │
│   │  ✕  Codex      [Install]  │ │
│   │                           │ │
│   └───────────────────────────┘ │
│                                 │
│   Install at least one AI       │
│   assistant to continue.        │
│                                 │
└─────────────────────────────────┘
```

**How each [Install] button works:**

| Item | winget available | winget NOT available |
|------|-----------------|---------------------|
| Git | Opens terminal, runs `winget install Git.Git` | Opens `git-scm.com/download/win` in browser |
| Node.js | Opens terminal, runs `winget install OpenJS.NodeJS.LTS` | Opens `nodejs.org/en/download` in browser |
| Claude | Runs `irm ... \| iex` silently in background (existing `installClaude()`) | Same — uses PowerShell spawn |
| Codex | Opens terminal, runs `npm install -g @openai/codex` | Same — npm is the only path |

**Button states during install:**
- Idle: `[Install]`
- Running: `[Installing...]` (spinner, disabled)
- Done: `✓ Ready` (green check, no button)
- Failed: `✕ Failed` + error message + `[Retry]`

**Key UX decisions:**
- No agent selector dropdown during onboarding — the checklist IS the first view
- System requirements (Git, Node) shown ABOVE CLIs — install order matters
- Codex [Install] is disabled while Node.js is missing (shows tooltip: "Install Node.js first")
- Items turn green live as installs complete
- After Git/Node install via winget: show "Reload Ritemark to detect new installations" with [Reload] button (winget installs update PATH but the running process won't see it)

### Step 2: CLI installed — Authenticate

Once at least one CLI is detected, the checklist updates and an auth section appears:

```
┌─────────────────────────────────┐
│                                 │
│   Almost there!                 │
│                                 │
│   ┌───────────────────────────┐ │
│   │                           │ │
│   │  Requirements             │ │
│   │                           │ │
│   │  ✓  Git           Ready  │ │
│   │  ✓  Node.js       Ready  │ │
│   │                           │ │
│   │  AI Assistants            │ │
│   │                           │ │
│   │  ✓  Claude     Installed  │ │
│   │  —  Codex       Optional  │ │
│   │                           │ │
│   └───────────────────────────┘ │
│                                 │
│   ┌───────────────────────────┐ │
│   │  Sign in to Claude        │ │
│   │                           │ │
│   │  [Sign in with Claude.ai] │ │
│   │                           │ │
│   │  or Use API key instead   │ │
│   └───────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Key UX decisions:**
- Auth section appears for the FIRST ready CLI
- Uninstalled agents show as dashes (—) with "Optional" — not blockers
- Once one agent authenticates → setup is DONE

### Step 3: Ready — Transition to Chat

Once `anyAgentReady`:

```
┌─────────────────────────────────┐
│                                 │
│   ✓  You're all set!            │
│                                 │
│   Claude is ready to help you   │
│   with your documents.          │
│                                 │
│   [Get Started]                 │
│                                 │
└─────────────────────────────────┘
```

"Get Started" → dismisses wizard, auto-selects the ready agent, shows normal chat.

---

## State Transitions

```
                    ┌──────────────┐
         ┌─────────│  First Open  │
         │         └──────┬───────┘
         │                │
         │         detect all deps
         │                │
         ▼                ▼
   ┌──────────┐    ┌──────────────┐
   │ All Ready │    │ Missing Deps │
   │ (skip)    │    │ (Step 1)     │
   └──────────┘    └──────┬───────┘
         │                │
         │         user clicks [Install]
         │         → terminal/background install
         │         → re-detect on completion
         │                │
         │                ▼
         │         ┌──────────────┐
         │         │  CLI Found   │
         │         │  (Step 2)    │
         │         └──────┬───────┘
         │                │
         │         user authenticates
         │                │
         ▼                ▼
   ┌─────────────────────────────┐
   │        Ready (Step 3)       │
   │   auto-select best agent    │
   │   → dismiss → normal chat   │
   └─────────────────────────────┘
```

**Auto-select priority** when transitioning to chat:
1. Claude ready → select Claude
2. Codex ready → select Codex
3. OpenAI key configured → select Ritemark Agent (lowest priority — requires external API key)

---

## Returning Users

The unified wizard only shows when `!anyAgentReady`. Returning users go straight to chat.

If a returning user switches to an agent that isn't set up yet, the existing per-agent views (`SetupWizard.tsx`, `CodexSetupView.tsx`) handle that — they're kept, just bypassed during first-run.

---

## macOS

Same wizard, fewer missing items. Git is usually pre-installed. If everything is green, Steps 1-2 are instant and user goes straight to Step 3 → chat.

macOS install methods:
- Git: pre-installed (Xcode CLT) or `brew install git`
- Node.js: `brew install node` or browser link
- Claude CLI: `curl -fsSL https://claude.ai/install.sh | bash` (existing `installClaude()`)
- Codex CLI: `npm install -g @openai/codex` or `brew install --cask codex`

---

## Impact on Current Code

| Current Component | What Happens |
|-------------------|-------------|
| `NoApiKey.tsx` | Replaced by wizard during first-run; kept for post-onboarding (user switches to Ritemark Agent without key) |
| `SetupWizard.tsx` | Kept for post-onboarding per-agent setup; not shown during first-run |
| `CodexSetupView.tsx` | Kept for post-onboarding per-agent setup; not shown during first-run |
| `EnvironmentStatusNotice.tsx` | Checklist replaces this during first-run; kept for technical details |
| `AgentSelector.tsx` | Hidden during onboarding wizard; shown after setup complete |
| `installer.ts` | `installClaude()` reused by wizard; add `installGitViaWinget()`, `installNodeViaWinget()`, `installCodex()` |
| `setup.ts` | Add `getOnboardingStatus()` returning unified `OnboardingStatus`; add winget detection |
| `AISidebar.tsx` | New top-level branch: if `!anyAgentReady && !onboardingDismissed` → show `OnboardingWizard` |

### New Components

| Component | Purpose |
|-----------|---------|
| `OnboardingWizard.tsx` | Unified setup wizard (Steps 1-3) |
| `DependencyChecklist.tsx` | Reusable checklist with live status + [Install] buttons |

### Extension-side New Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `checkWingetAvailable()` | `setup.ts` | Detect if winget is available for automated installs |
| `installGitViaWinget()` | `installer.ts` | `createTerminal` + `winget install Git.Git` |
| `installNodeViaWinget()` | `installer.ts` | `createTerminal` + `winget install OpenJS.NodeJS.LTS` |
| `installCodexCli()` | `installer.ts` | `createTerminal` + `npm install -g @openai/codex` |
| `getOnboardingStatus()` | `setup.ts` | Unified detection of all deps + auth states |
