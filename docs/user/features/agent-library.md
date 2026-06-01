# Agent Library

> Create, browse, and launch custom agents and skills from inside Ritemark.

The Agent Library is the place to manage helpers that live in your workspace or user profile. It scans your agent and skill folders, shows them in the sidebar, and gives you actions to create, duplicate, move, reveal, delete, and launch them.

---

## What the library shows

Ritemark discovers helpers from these locations:

- `.claude/agents/`
- `.claude/skills/`
- `.claude/commands/`
- `.agents/agents/`
- `.agents/skills/`
- `.agents/commands/`
- workspace-root `AGENTS.md` for the main agent configuration

If the same helper name appears in both `.claude/` and `.agents/`, the `.claude/` version wins.

---

## Creating helpers

When the library is empty, you can start with:

- **New skill**
- **New agent**

![Agent Library empty state with New skill and New agent buttons](../releases/v1.6.3/screenshots/1-6-3-agent-library-empty.png)

You can also click the **+** button in the Agents or Skills section header once helpers already exist.

![New-agent modal — name and scope fields](../releases/v1.6.3/screenshots/1-6-3-agent-library-new-agent.png)

Ritemark creates a valid starter file for you, opens it in the editor, and leaves you ready to edit the frontmatter and instructions.

![A scaffolded agent file (CLAUDE.md / AGENTS.md) opened from the library](../releases/v1.6.3/screenshots/1-6-3-agent-library-claudemd-open.png)

---

## Row actions

Each helper row supports a context menu with actions such as:

- **Open** — open the source file
- **Duplicate** — fork the helper into a new file
- **Reveal in Finder** — show the file in Finder
- **Move scope** — move between project and user scope
- **Delete…** — move the file to the OS trash

Project-scope helpers may show an impact note before deletion so you know whether you are affecting a shared workspace helper.

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

## Visuals and sorting

The library uses compact icon chips so helpers are easier to scan at a glance.

You can also sort the list by:

- **Alphabetical**
- **Recently modified**

Recently modified is the quickest way to find the helper you just edited.

---

## Live updates

The library refreshes when files change on disk. That includes edits from:

- Ritemark itself
- your terminal
- another editor
- another machine syncing the same workspace

If you add or edit a helper under `.claude/` or `.agents/`, the sidebar should update automatically.

---

## Starter pack

On a fresh machine, Ritemark can seed a small starter pack the first time it sees an empty `~/.claude/`.

The starter pack gives you a few working examples you can read, edit, duplicate, or delete like any other file.

---

## Related

- [AI Agents](ai-agents.md) - Built-in Claude and Codex agents
- [Set Up AI](../setup-ai.md) - Sign in and configure the built-in runtimes
- [Getting Started](../getting-started.md) - First-run walkthrough
