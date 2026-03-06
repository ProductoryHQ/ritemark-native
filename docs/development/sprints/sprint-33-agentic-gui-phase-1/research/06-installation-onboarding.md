# Research: Claude Code Installation & Onboarding UX

## Problem Statement

Ritemark targets non-technical writers. For Claude Code agent to work, the user needs:
1. Claude Code CLI installed
2. Authenticated with Anthropic

Previously this was assumed to require Node.js + npm + environment variables — a 6-step dependency chain completely unreasonable for non-developers. Research revealed that Anthropic now provides native installers, reducing this to 2 steps.

## Key Finding: Native Installers (No Node.js Required)

As of 2025, Anthropic provides standalone native installers for Claude Code that bundle their own runtime. Node.js is NOT a prerequisite.

**Sources:**
- [Official setup docs](https://code.claude.com/docs/en/setup)
- [Native installer guide](https://claudefa.st/blog/guide/native-installer)
- [Installation comparison](https://community.latenode.com/t/npm-installation-vs-binary-setup-for-claude-code-which-do-you-prefer/33517)

### Install Commands

| Platform | Command | Notes |
|----------|---------|-------|
| macOS | `curl -fsSL https://claude.ai/install.sh \| bash` | curl pre-installed, no sudo needed |
| Linux | `curl -fsSL https://claude.ai/install.sh \| bash` | same as macOS |
| Windows | `irm https://claude.ai/install.ps1 \| iex` | PowerShell built-in, no admin needed |

The installer:
- Downloads the correct binary for the platform/architecture
- Sets up PATH automatically
- Enables auto-updates in the background

### Authentication

Two methods available:

1. **OAuth login (recommended):** `claude login` opens the user's browser to sign in with their Claude.ai account. Same account they use for claude.ai web. No keys, no env vars.

2. **API key (power users):** Set `ANTHROPIC_API_KEY` environment variable. For enterprise/CI use cases.

## Original Dependency Chain (REJECTED)

```
Node.js → npm → npm install -g @anthropic-ai/claude-code → ANTHROPIC_API_KEY in env → SDK resolvable
```

Problems:
- Writers don't have Node.js
- Windows users especially don't have Node.js
- npm permission issues on Windows
- Environment variables are buried in System Properties on Windows
- `~/.zshrc` editing required on macOS for env vars
- 6 steps, all requiring terminal knowledge

## New Dependency Chain (ADOPTED)

```
1. Claude Code CLI (one-command native installer)
2. Authentication (browser-based OAuth login)
```

No Node.js. No npm. No environment variables. No terminal knowledge beyond clicking a button.

## Architecture Decision: Extension-Managed Installation

Rather than asking users to open a terminal, Ritemark manages the installation itself:

1. **Detection** — Extension runs `which claude` / `where claude` via `child_process.exec`
2. **Setup wizard** — Webview component shows checklist, explains what will happen
3. **Automated install** — Extension runs the native installer command
4. **Automated login** — Extension runs `claude login`, browser opens for OAuth
5. **Verification** — Extension re-checks prerequisites, transitions to normal chat

The user's experience:
1. Select "Claude Code" in agent dropdown
2. See: "Claude Code needs to be installed. We'll set it up for you."
3. Click "Set up Claude Code"
4. Watch progress bar → browser opens for login → done
5. Start chatting

## SDK vs CLI Distinction

Important: there are two separate things:

- **`@anthropic-ai/claude-agent-sdk`** — npm package imported by our extension code. This is the JavaScript API for communicating with Claude Code. It's a dependency in our extension's `node_modules`.

- **Claude Code CLI (`claude`)** — The actual binary process that the SDK spawns. This is what the user needs installed on their system. The native installer provides this.

Our extension bundles the SDK. The user provides the CLI.

## Platform-Specific Concerns

### macOS
- `curl` always available
- Installer works without admin/sudo
- PATH update via shell config (~/.zshrc) — may need new terminal, but our extension uses `child_process` which should pick up the new PATH if we specify the full path

### Windows
- PowerShell available on all modern Windows
- `irm` (Invoke-RestMethod) is built-in
- Potential blocker: execution policy may prevent running remote scripts
  - Fix: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
  - We may need to run this first or detect the policy
- PATH propagation: may need to read from registry or known install location after install

### Linux
- Same as macOS (curl-based installer)
- Various distros, but curl is nearly universal
- Some minimal containers may lack curl — fallback to wget

## Open Questions

1. **PATH propagation after install** — After running the installer, can our extension immediately find `claude` in PATH, or do we need to know the install location and use the full path?
2. **Execution policy on Windows** — Do we need to handle this, or does the installer script deal with it?
3. **Verification of auth** — What's the best way to check if `claude login` succeeded? Parse `claude auth status` output?
4. **Offline detection** — Should we check internet connectivity before attempting install?
5. **Corporate environments** — Proxy settings, firewall rules blocking claude.ai?
