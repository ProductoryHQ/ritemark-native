# Agents

> Create, browse, configure, and launch custom agents and skills from inside Ritemark.

**Agents**, in the places row at the top left, is where you manage AI helpers that live in your project or in your home folder. It scans your agent and skill folders, lists them in the left column under the project's name, and gives you actions to create, configure, duplicate, move, reveal, delete, and launch them.

> **Updated in v1.7.3:** the list separates **Instructions files** from **Agents**, and agent files open with a visual **Agent Configurator** panel — no YAML editing required. See the [v1.7.3 agent guide](../../releases/v1.7.3/agent-configurator-guide.md) for the full walkthrough.

---

## What Agents shows

Ritemark discovers helpers from these locations and groups them into sections:

| Section | Source | What it is |
|---|---|---|
| **Instructions** | `CLAUDE.md`, `AGENTS.md` (project root) | Project-wide rules loaded into **every** AI session. Not agents — they have no settings to configure, only text to edit. |
| **Agents** | `.claude/agents/*.md` | Your custom agents — each one a specialized AI assistant with its own instructions, model, and tool permissions |
| **Skills** | `.claude/skills/`, `.agents/skills/` | Reusable workflows. A skill's tooltip says **For Claude** (`.claude/skills/`) or **For ChatGPT** (`.agents/skills/`) |
| **Commands** | `.claude/commands/` | Slash commands |
| **Scheduled** | Scheduled agents' runs | Whether scheduled agents may run in this folder, and their runs |
| **Flows** | `.ritemark/flows/` | Visual AI workflows |

If the same skill appears in both `.claude/` and `.agents/`, it is shown once, and its tooltip says **Shared**.

Hover a row to see its file, its description and who it is for; a flow's tooltip says which agents use it. An agent you gave a colour (the **Color** field in its settings) shows its icon in that colour.

### This project and All projects

The switch at the top of the list chooses what it shows:

- **This project** — helpers that live in this project and are shared with your team via git
- **All projects** — personal helpers in your home folder (`~/.claude/`), available in every project

---

## Creating helpers

Click **New**, under the project's name, and choose **Agent**, **Skill**, **Command** or **Flow**. An empty list says so in one line; New is always there.

![New-agent modal — name and scope fields](../releases/v1.6.3/screenshots/1-6-3-agent-library-new-agent.png)

For an agent, skill or command, give it a name and choose **This project** or **All projects**. Ritemark creates a valid starter file for you, opens it in the editor, and leaves you ready to configure it.

---

## Configuring an agent

Open any agent from Agents and Ritemark switches to **agent editing mode**:

- The document area shows the agent's **instructions** — plain markdown that tells the agent who it is and how to behave. Edit it like any document.
- The right panel shows the **Agent Configurator** — a visual editor for the agent's settings.

The document's bar has three panel toggles on the left: **Contents** (☰), **Properties** (ⓘ), and **Agent settings** (the robot). Click to switch between them.

![An agent file open with the Agent Configurator panel on the right](../../releases/v1.7.3/screenshots/1-7-3-agent-library-agent-editor-open.png)

### Configurator fields

| Field | What it does |
|---|---|
| **Description** *(required)* | Tells the AI **when to delegate work to this agent**. Without it, the agent is never invoked automatically. |
| **Model** | Inherit (default) / Sonnet / Opus / Haiku / custom model ID |
| **Tools** | Allow-list of what the agent may do. **Nothing checked = the agent inherits all tools.** Checked = the agent gets *only* those tools — an unchecked tool simply doesn't exist for it. |
| **Skills** | Skills preloaded into the agent's context on every run |
| **Advanced** | Effort level, persistent memory scope, display color |
| **Linked flow** | Attach a Ritemark Flow (Ritemark extension — not part of the standard agent format) |

Changes are written into the agent's file immediately — agents are plain files, so everything shows up in git diff and can be reverted like any other change.

*Example:* a writing agent with only **Read, Write, Edit, Glob, Grep** checked can work with your repo's files but can never browse the web or run shell commands.

---

## Row actions

Right-click a helper row, or click its **…** button, for actions such as:

- **Open** — open the source file
- **Launch Chat** — start a conversation with this agent pinned (agents only)
- **Duplicate** — fork the helper into a new file
- **Reveal in Finder** (**Reveal in File Explorer** on Windows) — show the file in its folder
- **Move to All projects** / **Move to This project** — move the helper between your project and your home folder
- **Delete…** — move the file to the OS trash

Helpers in This project may show an impact note before deletion so you know whether you are affecting a helper your team shares.

---

## Launch Chat

Right-click an agent row and choose **Launch Chat** to start a conversation with that agent already pinned.

![Launch Chat with a pinned agent — indigo chip in the composer marks the active role](../releases/v1.6.3/screenshots/1-6-3-launch-chat-with-agent.png)

What that means:

- the AI sidebar opens focused on chat
- the selected agent is loaded as hidden context
- your prompt stays clean; the agent instructions are sent behind the scenes
- switching to a different agent later updates the hidden context for the next turn

![Handover between agents inside one chat — pinning a new agent retires the previous role in the same hidden block](../releases/v1.6.3/screenshots/1-6-3-agents-handover-in-chat.png)

This is useful when you want to talk to a specific helper without manually copying its instructions.

---

## Search and sorting

Each kind of helper has its own icon, so the list is easy to scan at a glance.

Click **Search**, under the project's name, to open the search field. It filters by name, description, and file path. **Sort**, beside the field, orders the list by:

- **Name (A → Z)**
- **Recently modified**

Recently modified is the quickest way to find the helper you just edited.

---

## Live updates

Agents refreshes when files change on disk. That includes edits from:

- Ritemark itself
- your terminal
- another editor
- another machine syncing the same project

If you add or edit a helper under `.claude/` or `.agents/`, the list should update automatically.

---

## Starter pack

On a fresh machine, Ritemark can seed a small starter pack the first time it sees an empty `~/.claude/`.

The starter pack gives you a few working examples you can read, edit, duplicate, or delete like any other file.

---

## Related

- [How to Configure and Use AI Agents (v1.7.3 guide)](../../releases/v1.7.3/agent-configurator-guide.md) - Full configurator walkthrough with recipes
- [AI Agents](ai-agents.md) - Built-in Claude, ChatGPT, and OpenCode runtimes, sign-in and setup
- [Set Up AI](../setup-ai.md) - Sign in and configure the built-in runtimes
- [Getting Started](../getting-started.md) - First-run walkthrough
