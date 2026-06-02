# How to Configure and Use AI Agents in Ritemark

> **v1.7.3 feature guide** — covers the unified Agent Library and the new Agent Configurator panel
> (sprint-77). Written as source material for release notes, marketing, and the user docs refresh.
> Audience: Ritemark users; no YAML or programming knowledge assumed.

---

## What is an agent?

An **agent** is a reusable AI assistant with its own personality, instructions, and permissions.
In Ritemark, every agent is just a markdown file that lives in your workspace under
`.claude/agents/` (project agents, shared with your team via git) or in your home folder under
`~/.claude/agents/` (personal agents, available in every project).

An agent file has two parts:

1. **Settings** (the structured part at the top) — name, description, which AI model it uses,
   which tools it may touch. You edit these visually with the **Agent Configurator** — no need to
   write the settings syntax by hand.
2. **Instructions** (the rest of the file) — plain markdown text that tells the agent who it is
   and how to behave. This is the agent's "job description." You edit it like any other document
   in Ritemark.

> **Agents vs. Instructions files:** `CLAUDE.md` and `AGENTS.md` are **not** agents. They are
> project-wide instruction files that get loaded into *every* AI session — think of them as house
> rules, not team members. That's why they appear in their own **Instructions** section in the
> library and don't have a configurator panel.

---

## The Agent Library (left sidebar)

Click the **robot icon** in the left activity bar to open the Agent Library. It shows everything
AI-related in your workspace, organized into collapsible sections:

| Section | What it contains |
|---|---|
| **Instructions** | `CLAUDE.md` / `AGENTS.md` — project-wide rules loaded into every session |
| **Agents** | Your custom agents from `.claude/agents/` |
| **Skills** | Reusable workflows (`.claude/skills/`, plus Codex skills from `.agents/skills/`) |
| **Commands** | Slash commands (`.claude/commands/`) |
| **Flows** | Visual AI workflows (`.ritemark/flows/`) |

### Working in the library

- **Collapse what you don't need.** Click any section header to collapse or expand it — the state
  is remembered, so you can keep only Agents and Skills open if that's what you work with.
- **Project vs User tabs.** Switch between agents that belong to this workspace (Project) and
  agents that follow you everywhere (User).
- **Search and sort.** Filter by name, description, or file path; sort alphabetically or by most
  recently modified.
- **Create.** Click **+** in a section header to scaffold a new agent or skill. Ritemark creates a
  valid starter file and opens it for editing.
- **Row actions.** Right-click (or click ⋯) for Open, Duplicate, Launch Chat, Reveal in Finder,
  Move to User/Project scope, and Delete.

---

## The Agent Configurator (right panel)

Open any agent file from the library and Ritemark switches to **agent editing mode**: the
document area shows the agent's instructions, and the right side shows the **Agent Configurator**.

The top toolbar now has **three panel toggles** — click them to switch:

| Icon | Panel | What it's for |
|---|---|---|
| ☰ (list) | Table of contents | Navigate long instruction documents |
| ⓘ (info) | Properties | Raw view of all settings fields |
| 🤖 (robot) | **Agent Configurator** | Visual editor for the agent's settings |

### Configurator fields, top to bottom

**Description** *(required)*
This is the most important field. It tells the AI **when to hand work to this agent**. Write it
like a job posting: *"PR review and merge agent. Invoke when user mentions: review PR, merge PR,
check PR."* If the description is empty, the agent never gets invoked automatically — the
configurator warns you about this.

**Model**
Which AI model the agent runs on:

- **Inherit (default)** — uses whatever model your session is using. Best choice for most agents.
- **Sonnet** — fast and capable; good for routine tasks.
- **Opus** — most capable; good for complex reasoning.
- **Haiku** — fastest and lightest; good for simple, high-volume tasks.
- **Custom model ID** — pin an exact model version if you need to.

**Tools**
Controls what the agent is allowed to do. This works as an allow-list:

- **Nothing checked** = the agent **inherits all tools** — it can do anything your session can do.
  The panel shows this state explicitly.
- **Some tools checked** = the agent can use **only** those tools. An unchecked tool simply does
  not exist for that agent — it can't read the web, run commands, or edit files unless you grant it.

| Tool | Allows the agent to… |
|---|---|
| Read | Read file contents |
| Write | Create and overwrite files |
| Edit | Make targeted edits to files |
| Bash | Run shell commands |
| Glob | Find files by pattern |
| Grep | Search file contents |
| WebFetch | Fetch and read web pages |
| WebSearch | Search the web |
| NotebookEdit | Edit Jupyter notebooks |
| Skill | Invoke skills |

*Example:* a "Product Marketer" agent with only Read, Write, Edit, Glob, Grep can work with your
repo's files but can never browse the web or run shell commands — least privilege by design.

**Skills**
Preload skills into the agent's context so it starts every run already knowing those workflows.
Type to search your workspace and user skills, click to add, click a tag to remove.

**Advanced** *(collapsed by default)*

- **Effort** — how much reasoning effort the agent uses (low → max).
- **Memory** — give the agent persistent memory across sessions (user / project / local scope).
- **Color** — the agent's display color in lists and UI.

**Linked flow** *(Ritemark extension)*
Attach a Ritemark Flow to this agent. This is a Ritemark-specific addition, marked as such in the
panel — it is not part of the standard agent format.

### How saving works

Every change in the configurator is written **directly into the agent's file** immediately — there
is no separate Save button. Because agents are plain files, all changes are visible in git diff and
can be reviewed/reverted like any other change.

---

## Writing the agent's instructions

The document body (everything below the settings) is the agent's **system prompt** — the
instructions it follows every time it runs. Edit it in the normal Ritemark editor. Good
instructions typically include:

1. **Who the agent is** — "You are a UX/UI design specialist for…"
2. **What it must always do** — core principles, output format
3. **What it must never do** — guardrails
4. **Examples** — the fastest way to teach an agent your standards

---

## Using an agent

- **Automatic delegation** — when your request matches an agent's description, the AI hands the
  task to that agent automatically.
- **Launch Chat** — right-click an agent in the library → **Launch Chat** to start a conversation
  with that agent pinned.
- **@ mention** — mention an agent in the AI sidebar composer to route work to it explicitly.

---

## Quick recipes

**A research agent that can't touch your files:**
Tools: check only Read, Glob, Grep, WebFetch, WebSearch. It can investigate but never modify.

**A writing agent locked to your repo:**
Tools: Read, Write, Edit, Glob, Grep (no Bash, no web). It edits documents but can't run anything
or leak attention to the internet.

**A heavyweight reviewer:**
Model: Opus, Effort: high, Tools: Read, Bash, Glob, Grep. Maximum scrutiny, no write access.

---

## Where things live (reference)

| Thing | Location | Shared via git? |
|---|---|---|
| Project agents | `.claude/agents/*.md` | Yes |
| Personal agents | `~/.claude/agents/*.md` | No |
| Project skills | `.claude/skills/<name>/SKILL.md` | Yes |
| Codex skills | `.agents/skills/<name>/SKILL.md` | Yes |
| Slash commands | `.claude/commands/*.md` | Yes |
| Project instructions | `CLAUDE.md`, `AGENTS.md` (repo root) | Yes |
| Flows | `.ritemark/flows/*.flow.json` | Yes |
