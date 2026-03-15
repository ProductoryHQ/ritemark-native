# AI Agents

> Three built-in AI agents for different workflows: Ritemark Agent, Claude, and Codex.

Ritemark includes three AI agents in the sidebar, each with different capabilities and authentication methods. Switch between them using the dropdown at the top of the AI sidebar.

---

## Overview

| Agent | Best for | Authentication | Status |
|-------|----------|---------------|--------|
| **Ritemark Agent** | Quick edits, document search, rephrasing | OpenAI or Google API key | Stable |
| **Claude** | Autonomous file work, multi-turn sessions | Claude.ai account or Anthropic API key | Stable |
| **Codex** | Coding tasks, autonomous coding agent | ChatGPT account (OAuth) | Experimental |

---

## Ritemark Agent

The built-in agent for everyday writing tasks. It uses whichever AI provider you have configured (OpenAI or Google).

**Capabilities:**
- Rephrase selected text (shorter, longer, formal, casual)
- Find and replace across documents
- Insert new content at specific positions
- Document search with RAG (retrieves relevant context from your workspace)
- Chat naturally about your documents

**Setup:** Configure an OpenAI or Google API key in Ritemark Settings (gear icon in titlebar).

**No external installation required** - works immediately after API key configuration.

---

## Claude

Anthropic's autonomous coding and writing agent. Claude can read, write, and organize files in your workspace. It runs multi-turn sessions, meaning you can have a back-and-forth conversation while Claude works on your files.

**Capabilities:**
- Read and edit files across your workspace
- Create new files and folders
- Run shell commands (with your approval)
- Multi-turn conversations with context retention
- Sub-agent orchestration for complex tasks

**Models available:**
| Model | Description |
|-------|-------------|
| Claude Sonnet | Fast and capable (default) |
| Claude Opus | Most powerful |
| Claude Haiku | Quick and light |

### Prerequisites

| Requirement | Required on | Notes |
|-------------|-------------|-------|
| Claude Code CLI | All platforms | Installed automatically via "Install Claude" button |
| Git | Windows | Required by the Claude Code installer |
| PowerShell | Windows | Required for Claude installation and sign-in |

### How Ritemark Detects Claude

Ritemark searches for the Claude binary in these locations:

**Windows:**
1. System PATH (via `where claude`) - filters for `.cmd` / `.exe` files
2. `%LOCALAPPDATA%\Programs\Claude\claude.exe` (native installer)
3. `%APPDATA%\npm\claude.cmd` (npm global install)
4. `%USERPROFILE%\.claude\local\claude.exe`

**macOS:**
1. System PATH (via `which claude`)
2. `~/.claude/local/bin/claude` (native installer)
3. `~/.local/bin/claude`
4. `~/.npm-global/bin/claude`
5. `/opt/homebrew/bin/claude`
6. `/usr/local/bin/claude`

After finding the binary, Ritemark runs `claude --version` to verify it works. If the binary exists but cannot start, Ritemark reports "Claude needs repair".

### Authentication

Claude supports two authentication methods:

1. **Claude.ai sign-in** (recommended) - Click "Sign in with Claude.ai" to open a login terminal and browser. Uses your Claude.ai subscription.
2. **Anthropic API key** - Click "Use API key instead" to enter a key from [console.anthropic.com](https://console.anthropic.com). Stored securely on your machine.

### Setup States

| State | What you see | What to do |
|-------|-------------|------------|
| Not installed | "Install Claude" button | Click to install automatically |
| Needs repair | "Repair Claude" button | Click to reinstall |
| Needs reload | "Reload Window" button | Reload after installation |
| Needs auth | "Sign in with Claude.ai" button | Sign in or use API key |
| Ready | Chat input field | Start chatting |

### Troubleshooting Claude

| Problem | Solution |
|---------|----------|
| "Claude binary was detected but could not be started" | Click "Repair Claude" to reinstall |
| "Git for Windows is required" | Install [Git for Windows](https://git-scm.com/download/win), then retry |
| "PowerShell not detected" | Restore `powershell.exe` on your system, then reload |
| Install fails with file lock error | Close the Claude desktop app, then retry |
| "spawn EINVAL" when chatting | Update Ritemark - this was a known bug with Windows `.cmd` path resolution |
| Sign-in not detected | Complete sign-in in the browser, then wait 5-10 seconds for Ritemark to detect it |

---

## Codex

OpenAI's autonomous coding agent, powered by ChatGPT. Codex uses ChatGPT OAuth authentication (no API key needed).

**Capabilities:**
- Autonomous file reading and editing
- Shell command execution (with approval)
- Code generation and refactoring
- Works with ChatGPT subscription (Plus, Pro, Team, or Business)

**Status:** Experimental - enable in Settings > Features > Codex Integration.

### Prerequisites

| Requirement | Required on | Notes |
|-------------|-------------|-------|
| Codex CLI | All platforms | Install via `npm install -g @openai/codex` |
| Node.js | All platforms | Required for npm installation |
| ChatGPT account | All platforms | Plus, Pro, Team, or Business subscription |

### How Ritemark Detects Codex

Ritemark searches for the Codex binary via system PATH:

**Windows:**
- Runs `where codex` and selects the first `.exe` or `.cmd` result
- Extensionless Unix shim files are filtered out (they cause spawn errors)

**macOS:**
- Runs `which codex` and uses the first result

After finding the binary, Ritemark runs `codex --version` to verify. It also checks:
- Node.js version used during installation vs. Ritemark's runtime version
- Architecture match (detects Rosetta/x64 installs on Apple Silicon)

### Authentication

Codex uses **ChatGPT OAuth** - click "Sign in with ChatGPT" to open a browser for authentication. Your email and plan are shown after sign-in.

### Troubleshooting Codex

| Problem | Solution |
|---------|----------|
| "Codex CLI not found" | Run `npm install -g @openai/codex@latest` in a terminal |
| "spawn codex ENOENT" | Update Ritemark - this was a known bug with Windows path resolution |
| Binary broken after Node update | Click "Repair Codex" to open a repair terminal |
| Node version mismatch warning | Reinstall Codex using the same Node version as Ritemark |

---

## Switching Between Agents

Use the dropdown at the top of the AI sidebar to switch agents:

1. Click the agent name (e.g., "Claude - Opus")
2. Select a different agent from the dropdown
3. Each agent maintains its own conversation

The dropdown shows all available agents and their models. Agents that require setup show a setup wizard instead of the chat interface.

---

## Environment Checks

On Windows, Ritemark performs additional environment checks before allowing setup:

| Check | Why | Recovery |
|-------|-----|----------|
| Git installed | Required by Claude installer | Install [Git for Windows](https://git-scm.com/download/win) |
| PowerShell available | Required for Claude install/login scripts | Restore PowerShell on your system |
| Node.js installed | Required for Codex npm install | Install [Node.js](https://nodejs.org) |

These checks appear as an "Environment checks" notice in the setup wizard. Fix the listed issues before proceeding with agent installation.

After installing a prerequisite, you may need to **reload the window** for Ritemark to detect the change (PATH updates require a restart).

---

## Privacy

- **Ritemark Agent**: Text is sent to OpenAI or Google's API
- **Claude**: Text is sent to Anthropic's API via Claude Code
- **Codex**: Text is sent to OpenAI's API via ChatGPT

All API keys and credentials are stored locally on your machine. Ritemark has no servers - all communication goes directly between your machine and the AI provider.

---

## Related

- [AI Assistant](ai-assistant.md) - Ritemark Agent tools (rephrase, replace, insert)
- [Flows](flows.md) - Visual AI workflows using agents
