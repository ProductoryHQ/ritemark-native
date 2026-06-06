# AI Agents

> Three built-in AI agents for different workflows: Claude, Codex, and OpenCode.

Ritemark includes three AI agents in the sidebar, each with different capabilities and authentication methods. Switch between them using the dropdown at the top of the AI sidebar.

If you want to manage custom helpers, see [Agent Library](agent-library.md) for creating, launching, and organizing your own agents and skills.

> **New in v1.7.3:** **OpenCode** joins Claude and Codex as a third, bring-your-own-key runtime over the Agent Client Protocol. See [OpenCode](#opencode) below and [Set Up AI → OpenCode](../setup-ai.md#opencode-bring-your-own-key) for setup. The sidebar composer also gained a [prompt queue](#running-agents-the-composer-and-plan-approval) and a fixed plan-approval flow this release.

> **Changed in v1.7.2:** The earlier "Ritemark Agent" runtime (a direct OpenAI/Gemini chat runtime, also known as the Legacy Agent) has been removed, along with the document-search (RAG) subsystem. Conversations you previously had with the Ritemark Agent still open **read-only** so your history is preserved.

---

## Overview

| Agent | Best for | Authentication | Status |
|-------|----------|---------------|--------|
| **Claude** | Autonomous file work, multi-turn sessions | Claude.ai account or Anthropic API key | Stable |
| **Codex** | Coding tasks, autonomous coding agent | ChatGPT account (OAuth) | Experimental |
| **OpenCode** | Using any provider you have a key for | Bring-your-own provider API key | Experimental |

Agent selection is per turn inside a conversation. You can keep one thread open and switch runtimes without starting over.

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

1. **Claude.ai sign-in** (recommended) - Click "Sign in with Claude.ai" to open your system browser. No terminal needed — sign-in runs as a background subprocess, with a Cancel button and a 5-minute timeout. Uses your Claude.ai subscription.
2. **Anthropic API key** - Click "Use API key instead" to enter a key from [console.anthropic.com](https://console.anthropic.com). Stored securely on your machine.

Settings reflects the truthful auth state by querying the Claude CLI directly. After `claude logout`, Settings will show Disconnected (it no longer falsely reports "Connected" based on a stale env var).

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

## OpenCode

> Added in v1.7.3.

OpenCode is a third chat runtime integrated over the **Agent Client Protocol (ACP)**. Unlike Claude
and Codex, it has no sign-in of its own — it is **bring-your-own-key**. Configure a provider API key
in Settings and OpenCode runs against that provider's models.

**Capabilities:**
- Chat against any provider you have an API key for (OpenAI, Google AI, Anthropic, OpenRouter)
- Streaming responses, with reasoning summarized as a few "Thinking" entries and tool calls shown as activities
- File edits gated behind a per-edit File Change Approval card (out-of-workspace writes are always blocked)

**Choosing a model:** the model picker shows an **OpenCode** group after Codex. Only providers whose
key you've configured appear there — add a Google AI key and Gemini models show up, add OpenAI and you
get GPT models. With no keys configured, the group prompts you to open Settings. The group refreshes
the moment a key is saved or removed.

**File-edit approval:** when OpenCode wants to edit an open file, you get a single **File Change
Approval** card showing the target path. The file on disk is untouched until you Approve. For
hands-free runs, Settings → OpenCode has an **Auto-approve edits & tool calls** toggle — out-of-workspace
writes stay blocked even then.

For full setup, see [Set Up AI → OpenCode (bring your own key)](../setup-ai.md#opencode-bring-your-own-key).

---

## Running agents: the composer and plan approval

> Updated in v1.7.3.

These behaviors apply to agent runs in the AI sidebar (Claude and Codex).

### Keep typing while an agent runs — your prompt queues

The composer no longer locks while an agent is working. Type a follow-up while Claude or Codex is
still running and press Enter: instead of being blocked, the prompt parks in a **"Queued"** notch
above the input. When the current run finishes, the queued prompt **auto-sends**.

- One queued prompt at a time — you can park exactly one follow-up.
- Discard it before it sends by clicking the **×** on the Queued notch.

### Plan approval

When an agent proposes a plan and waits for your go-ahead, an approval card appears in the sidebar:

- The card renders **only while the agent is genuinely blocked** waiting on plan approval.
- It shows the **full plan text**, with **Approve** as a clear primary action and **Reject** beside it.
- Approving lets the agent proceed; rejecting sends it back to revise.

> Before v1.7.3, the Approve/Reject buttons could render after the approval window had already closed,
> where clicking them did nothing. That is fixed — the buttons are only present when they actually work.

---

## Switching Between Agents

Use the dropdown at the top of the AI sidebar to switch agents:

1. Click the agent name (e.g., "Claude - Opus")
2. Select a different agent from the dropdown
3. The selected runtime is used for the next turn, while the conversation stays continuous

The dropdown shows all available agents and their models. Agents that require setup show a setup wizard instead of the chat interface.

You can also pin a custom agent from the [Agent Library](agent-library.md) for the next turn — the previous role is automatically retired so the AI gets a clean handoff.

![Handover between two pinned agents inside one chat](../releases/v1.6.3/screenshots/1-6-3-agents-handover-in-chat.png)

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

- **Claude**: Text is sent to Anthropic's API via Claude Code
- **Codex**: Text is sent to OpenAI's API via ChatGPT
- **OpenCode**: Text is sent to whichever provider's API key you configured (OpenAI, Google AI, Anthropic, or OpenRouter)

All API keys and credentials are stored locally on your machine. Ritemark has no servers - all communication goes directly between your machine and the AI provider.

---

## Related

- [Flows](flows.md) - Visual AI workflows using agents
