# AI Agents

> Three built-in AI agents for different workflows: Claude, Codex, and OpenCode.

Ritemark includes three AI agents in the sidebar, each with different capabilities and authentication methods. Switch between them using the dropdown at the top of the AI sidebar.

If you want to manage custom helpers, see [Agent Library](agent-library.md) for creating, launching, and organizing your own agents and skills.

> **New in v1.11.0:** A **Report AI issue** item in the status bar lets you report AI output you object to — see [Reporting AI output](#reporting-ai-output). The built-in model list now includes **Claude Fable 5.1** and **GPT-6 Astra**.

> **New in v1.8.6:** Ritemark now identifies AI before the first sidebar interaction and keeps an **[AI information](#ai-information-and-context-sharing)** button beside the composer. It shows the selected runtime, provider/service, and model; explains what context may leave the device; and reminds you to review AI output.

> **New in v1.10.0:** Agent conversations are saved locally per project in one durable **Conversations** list. A permanent right rail keeps Pinned, working, needs-you, recent, and otherwise-absent current conversations close without making the rail the owner of history.

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

## Parallel agent chats

> New in v1.8.5.

The AI sidebar is no longer a single conversation. You can run **several independent chats at once**, each with its own session — so you can keep one long-running task going while you start another, or ask a second runtime for a comparison without losing the first thread.

- **The conversation rail.** New conversation is the strong `+` button. Under it, calm speech-bubble icons provide shortcuts to Pinned conversations, active work, and three recent idle conversations. The final speech-bubble button opens the full Conversations list. Hover or focus a shortcut to see its complete title and Pin/Unpin action.
- **One list per project.** Conversations contains current, background, and earlier saved chats together. The list is host-owned and crash-safe; it is not derived from whichever shortcuts happen to be visible on the rail.
- **Pinning is optional.** Working, needs-you, and recent chats appear automatically; an older current chat is appended while you view it. Selecting a conversation never promotes or reorders Recents. Pin up to five conversations when you want them to remain on the rail; unpinning does not delete or close anything.
- **Delete is explicit.** Delete is available directly on a conversation row, asks for confirmation, and offers Undo. Running work uses Stop and delete.
- **Titles improve after the first response.** Ritemark first shows a shortened version of your prompt, then asks the selected runtime for a short title without adding that request to the conversation. Use Rename on any row to choose your own title; Ritemark never overwrites a manual name.
- **Restored transcript, honest context.** Opening a saved transcript does not start an agent. On your next Send, Ritemark first tries that runtime's compatible saved session. If it cannot use it—or you change agent—it starts a fresh session with a bounded text transcript and says so before the turn. Tool state, approvals, partial replies, and attachment contents are never replayed.
- **Agents keep working in the background.** Start a run in one thread, switch to another, and the first agent keeps going. Responses always land in the thread that asked — threads never cross-talk.
- **A thread cap.** To keep resource use in check there's a limit on how many threads can be open at once. Open past it and Ritemark tells you instead of silently spawning more sessions.
- **Runtime is per thread.** Switching Claude ↔ Codex ↔ OpenCode applies immediately and keeps your draft in the composer. A failed or running previous agent is stopped; nothing new starts until you Send. If transcript fallback is needed, one quiet line between turns says that earlier messages were included as context. An unanswered request is labelled context rather than silently resent as a second command.

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
| Claude Sonnet 5 | Fast and capable (default) |
| Claude Opus 5 | Most powerful Opus model (added in v1.8.5) |
| Claude Fable 5.1 | Current long-horizon model |
| Claude Opus 4.8 | Previous flagship |
| Claude Haiku 4.5 | Quick and light |
| Claude Fable 5 | Previous Fable generation |

The model list is served from a live catalog feed, so newly released Claude models appear automatically without a reinstall.

### Prerequisites

| Requirement | Required on | Notes |
|-------------|-------------|-------|
| Claude Code | All platforms | Included with Ritemark; nothing to install |
| Git for Windows | Windows | Optional. With Git, Claude runs commands in Git Bash; without it, in PowerShell |
| PowerShell | Windows | Built into Windows. Used for Claude installation and sign-in, and for Claude's commands when Git is not installed |

### How Ritemark Detects Claude

Ritemark uses the copy of Claude Code that ships with the app. If you set **Settings → Agent Runtime → Runtime preference** to **Use system install**, Ritemark looks for your own install first, in these locations, and falls back to the bundled copy if it finds none:

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
| "Git for Windows not detected" | Appears only with **Use system install**: a Claude you installed yourself may need Git Bash. Install [Git for Windows](https://git-scm.com/download/win), or set **Runtime preference** back to **Bundled** |
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

**Status:** Experimental. It is on by default; there is nothing to enable.

### Prerequisites

| Requirement | Required on | Notes |
|-------------|-------------|-------|
| Codex | All platforms | Included with Ritemark; nothing to install |
| ChatGPT account | All platforms | Plus, Pro, Team, or Business subscription |

### How Ritemark Detects Codex

Ritemark uses the copy of Codex that ships with the app. If you set **Settings → Agent Runtime → Runtime preference** to **Use system install**, Ritemark looks for your own Codex on the system PATH first, and falls back to the bundled copy if it finds none:

**Windows:**
- Runs `where codex` and selects the first `.exe` or `.cmd` result
- Extensionless Unix shim files are filtered out (they cause spawn errors)

**macOS:**
- Runs `which codex` and uses the first result

For your own install, Ritemark runs `codex --version` to verify it. It also checks:
- Node.js version used during installation vs. Ritemark's runtime version
- Architecture match (detects Rosetta/x64 installs on Apple Silicon)

The Claude and Codex cards in Settings show which copy is in use: **Bundled with app** or **System installation**.

### Authentication

Codex uses **ChatGPT OAuth** - click "Sign in with ChatGPT" to open a browser for authentication. Your email and plan are shown after sign-in.

### Troubleshooting Codex

| Problem | Solution |
|---------|----------|
| "Codex runtime not found" | The copy of Codex that ships with Ritemark is missing. Reinstall Ritemark. With **Use system install**, also check your own install (`npm install -g @openai/codex`) |
| "The bundled Codex runtime could not start" | Reinstall Ritemark. "Repair Codex" repairs only your own install; for the bundled copy it tells you to reinstall Ritemark |
| "spawn codex ENOENT" | Update Ritemark - this was a known bug with Windows path resolution |
| Your own Codex install broke after a Node update | Click "Repair Codex" to open a repair terminal |
| Node version mismatch warning | Applies to your own install only. Reinstall Codex using the same Node version as Ritemark, or set **Runtime preference** back to **Bundled** |

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

### Keep typing while an agent runs — your prompts queue

> Redesigned in v1.8.6 (Sprint 104).

The composer never locks while an agent is working. Each Enter adds your follow-up to a visible
**Queued · n/10** list above the input (up to 10 per chat). When the current run finishes — and no
plan review, question, or approval is waiting for you — the next item sends automatically, in order.

- **Edit, reorder, or remove** any queued item before it runs (hover a row for its actions).
- **Comments queue too:** a comment sent from the document goes to the conversation you have open,
  and waits in its queue if that conversation is busy. Removing it from the queue tells the comment
  it was cancelled. See [Comments](comments.md#sending-a-comment-to-an-agent).
- A **failed or stopped** turn pauses the queue; press **Resume** to continue.
- Background threads drain on their own — a queued follow-up in another thread runs when that
  thread's agent finishes, even if you're looking elsewhere.
- The queue is session-local: it does not survive closing the app.

### Modes: Manual / Auto + Plan

> Redesigned in v1.8.6 (Sprint 103).

The composer footer has two independent controls instead of the old three-button `Auto / Ask / Plan` strip:

- **Autonomy select — Manual or Auto.**
  - **Manual** — the agent asks you before each file change and shell command.
  - **Auto** — the agent works without asking; you review the result.
  Switching between them mid-thread keeps the conversation memory — the agent does not forget what you discussed.
- **Plan chip.** Turn it on and the next message runs **plan-first**: the agent works in an enforced read-only phase, then presents a reviewable plan. Nothing in your workspace changes until you approve. The chip stays on until a plan is **approved** (then it turns itself off); cancelling a plan leaves it on.

The Plan chip only appears for runtimes that can genuinely enforce it (Claude and Codex). OpenCode has no plan contract yet, so it shows no Plan control — by design, not omission.

### Thinking effort

> New in v1.10.0.

For models that support it, **Effort** in the Composer opens a compact Faster → More thorough scale. Drag the handle, click a point, or use the arrow keys to choose the effort for the next message. **Auto** is the default and lets the selected model decide.

- Available points follow the selected model's real capability; Ritemark does not show unsupported levels.
- The choice is saved per conversation and agent, while every queued message keeps the effort it had when you accepted it.
- Returning to Auto restores the model's default, including after a manual choice in a warm session.
- OpenCode shows the control only after its live ACP session advertises compatible thought levels. Merely opening or selecting a conversation never starts OpenCode to discover them.
- Higher effort can take longer and use more provider quota. It is a compute preference, not a promise of a better answer.

### Plan review

When a plan is ready, a review card appears in the sidebar:

- It shows **who asked for the plan** ("Requested by you · Plan" — or "Claude chose to plan first" when the agent decided to plan on its own), the **full plan as rendered markdown**, and a verified **"No files changed yet."** line.
- **Approve & continue** — the agent executes the plan in the same conversation, under your chosen autonomy mode.
- **Keep planning** — type feedback and the agent revises the plan without executing anything.
- Cancelling the run at the review leaves your workspace untouched.

### Truthful status

Under the conversation there is one status line that always tells you what is actually happening: **Working** (with the live step), **Waiting for your review / Needs your answer / Waiting for approval** (amber — blocked on you), **Done in Xs** (agent working time; waiting-for-you time is excluded and shown on hover), **Failed**, or **Stopped**. "Modified N files" counts only files inside your workspace.

---

## Agents know their Ritemark surroundings

> New in v1.8.5.

Every agent run now starts with a short **capability context** — a system description of the environment it's running in. It tells the agent that it's inside Ritemark: a Markdown editor with an integrated browser and a specific set of tools, rather than a bare command line. The practical effect is that agents reach for Ritemark's own capabilities (the editor, the browser tools) instead of guessing at a generic terminal environment.

This does not change safety behavior: agents still refuse instructions embedded inside documents you open, so opening an untrusted file can't hijack an agent.

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

On Windows, Ritemark checks for what the agents actually need. The Claude and Codex that ship with Ritemark need neither Git nor Node.js, so those two checks run only when **Settings → Agent Runtime → Runtime preference** is **Use system install**:

| Check | When | Why | Recovery |
|-------|------|-----|----------|
| PowerShell available | Always | Built into Windows. Claude installation and sign-in use it, and Claude runs its commands in PowerShell when Git is not installed | Restore PowerShell on your system |
| Git installed | Use system install only | A Claude you installed yourself may need Git Bash | Install [Git for Windows](https://git-scm.com/download/win), or set **Runtime preference** back to **Bundled** |
| Node.js installed | Use system install only | A Claude or Codex installed with npm runs on Node.js | Install [Node.js](https://nodejs.org), or set **Runtime preference** back to **Bundled** |

These checks appear as an "Environment checks" notice in the setup wizard, and Git and Node.js appear in the first-run checklist only with **Use system install**. Only a missing PowerShell stops Claude installation; Git and Node.js never block it.

After installing a prerequisite, you may need to **reload the window** for Ritemark to detect the change (PATH updates require a restart).

---

## AI information and context sharing

Before the first AI sidebar interaction, the composer states that you are interacting with AI. Choose **Don’t show again** to record the one-time acknowledgement. The information remains available afterward from the **ⓘ AI information** button beside the attachment and Send controls and from the link at the end of Ritemark Settings.

The detail view uses the active conversation's shared runtime/model state. It shows:

- **Runtime:** Claude Code, Codex, or OpenCode
- **Provider/service:** Anthropic for Claude Code, OpenAI for Codex, or the selected Google/OpenAI/Anthropic/OpenRouter route for OpenCode
- **Model:** the model currently selected in the composer
- **Context categories:** prompt, active file, selected text, attachments, shared browser context, recent cross-runtime context, and tool results

A check beside a context category means that category is present in the current composer state. It is not a guarantee that the agent can read only those items. Depending on the selected permission mode and approvals, an agent can read other workspace files or use tools while completing the task.

The active-file chip can be removed before sending. Browser context is shown and sent only for Claude Code and Codex; OpenCode does not currently receive the integrated-browser context. Sprint 102 also ensures that active-file removal reaches Codex and OpenCode and that OpenCode attachment payloads reach its runtime instead of being dropped at the composer boundary.

AI output can be inaccurate or incomplete. Review facts, sources, calculations, commands, and file changes before relying on, publishing, or acting on the result. Approval controls reduce unintended actions; they do not verify correctness.

For the longer data-flow explanation and current provider links, open **AI information** in the app or visit [Ritemark AI Information](https://ritemark.app/en/support/guides/ai-information).

---

## Reporting AI output

> New in v1.11.0.

If an agent gives you output that is inappropriate or harmful, you can report it to the Ritemark team.

There are two ways in, and both open the same window:

- **Report AI issue** in the status bar at the bottom of the window, beside the **AI Ready** indicator. It is always there, whether or not the AI sidebar is open. Clicking it opens the AI sidebar with the report window.
- **AI information** (the ⓘ button beside the composer) has a **Report AI output** section with a link of the same name.

The **Report AI output** window shows exactly what the report will contain:

- **Included with your report**: two lines Ritemark adds. One is the Ritemark version and your platform (for example `Ritemark 1.11.0 (darwin)` on a Mac, or `(win32)` on Windows). The other is the time you opened the window, in UTC.
- **What went wrong?**: an empty box for you to paste the AI output and say what is wrong with it. It holds up to 8,000 characters.

Nothing else goes into the report. Ritemark takes nothing from your conversations, your documents or your account. Nothing is filtered out; the report window never has access to them in the first place. The window starts empty every time you open it.

Click **Open email** to hand the report to your email app as a new message to **info@productory.eu**, the address the Ritemark team monitors. You can read and change the whole message there, including the two lines Ritemark added, and nothing is sent until you press Send in your email app. Ritemark never tells you the report was sent, because it only knows that it passed the report to your email app, not what happened next. The window says **Your email app is opening** and reminds you that the report hasn't been sent yet.

Your report stays in the window whatever happens, and **Copy report** (under the text box) copies all of it:

- **No email app is set up on this computer**: copy the report and email it to info@productory.eu yourself. This is a normal outcome, not an error.
- **This report is too long to open in an email app**: email links can only carry a limited amount of text, so Ritemark won't open your email app and risk cutting the report short. Copy it and email it yourself.

The address is always on screen under the text box as **Write to us: info@productory.eu**.

If no email appears, see [Troubleshooting](../troubleshooting.md#report-ai-issue-doesnt-open-an-email).

---

## Privacy and analytics

- **Claude**: Text is sent to Anthropic's API via Claude Code
- **Codex**: Text is sent to OpenAI's API via ChatGPT
- **OpenCode**: Text is sent to whichever provider's API key you configured (OpenAI, Google AI, Anthropic, or OpenRouter)

Credentials are stored locally using the operating system's secure storage and the installed runtime. AI sidebar requests are not proxied through a Productory server; the selected runtime connects to its provider using your account or key. Files stay on your computer as files, but prompts and relevant file, selection, attachment, browser, conversation, and tool context can be transmitted when you invoke cloud-connected AI.

Separately, Ritemark sends anonymous product-usage events to PostHog when analytics is enabled (the default). Those events cover app sessions, feature/agent use, and reactions; they do not include prompt or file contents. If you explicitly submit written feedback, the feedback text you enter is sent with that event. To turn analytics off, choose **Opt Out** in the notice Ritemark shows on first launch, or turn off `ritemark.analytics.enabled` in Settings (Cmd+, on macOS, Ctrl+, on Windows).

---

## Related

- [Flows](flows.md) - Visual AI workflows using agents
