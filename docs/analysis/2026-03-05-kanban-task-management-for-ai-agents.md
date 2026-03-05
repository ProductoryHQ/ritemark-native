# Kanban Task Management for AI Agents in Ritemark

**Date:** 2026-03-05
**Status:** Research & Analysis
**Goal:** Evaluate approaches for kanban-style task management that works with Claude Code, Codex, and other AI agents in Ritemark Native.

---

## Executive Summary

The rise of "vibe coding" with AI agents has created a new bottleneck: **planning and reviewing work**, not writing code. Several tools have emerged to solve this with kanban-style task boards that orchestrate AI agents. This analysis evaluates the landscape and recommends an approach for Ritemark Native.

**Key finding:** The most promising path for Ritemark is a **built-in kanban board as a custom editor** (`.tasks.json` files) with **MCP server exposure**, letting AI agents read and update tasks. This leverages Ritemark's existing custom editor architecture (React + Zustand + Tailwind webviews) while being integrated into the markdown editing workflow.

**Important caveat:** This analysis recommends an architecture, but the core product question — *how does a task on a board become work an agent is actually doing?* — has multiple possible answers. The "Agent Activation" section below explores these honestly, including what's proven vs. speculative.

**Who is this for?** Primarily developers using Ritemark alongside AI coding agents (Claude Code, Cursor, Codex). Secondarily, any Ritemark user who wants a visual task board inside their editor. The feature should be useful *without* AI agents — the board stands alone as a project management tool; MCP integration is a power-user layer on top.

---

## Landscape Analysis

### The Three Tools That Matter Most

#### 1. Vibe Kanban (BloopAI) — The Orchestrator

Full orchestration platform. Rust + TypeScript, 22.4k stars. User clicks "Start" on a card → Vibe spawns a terminal with the agent CLI + an isolated git worktree. Supports 10+ agents. Inline code review. PR creation.

**What Ritemark should steal:** The activation UX — clicking a card launches an agent. The worktree-per-task isolation model for parallel agents.

**Why not just use it:** Standalone web app (not editor-integrated), heavyweight stack (Rust + PostgreSQL), no markdown/document integration. Wrong architecture for an editor-native feature.

#### 2. TaskMaster AI — The MCP Pioneer

File-based task management via MCP server. `.taskmaster/` directory with markdown task files. 36 MCP tools (selective loading: 7 core at ~5k tokens, all 36 at ~21k tokens). PRD-to-task decomposition. Two VS Code extensions already exist for visual kanban.

**What Ritemark should steal:** MCP tool design patterns. The `get_next_task` pattern. Selective tool loading to manage token overhead.

**Why not just integrate it:** Tasks stored in home directory (not project-local). Heavy token cost. Two separate extensions needed for visual board. Ritemark can offer a tighter, lighter experience by owning both sides.

**Honest admission:** TaskMaster + its VS Code extensions is the closest competitor. The differentiation case depends on integration depth, not feature count.

#### 3. Claude Code Native Tasks — The Baseline

Built-in to Claude Code 2.1+. Tasks in `~/.claude/tasks/`. Multi-session coordination via `CLAUDE_CODE_TASK_LIST_ID`. File-based locks for parallel agents. Proven at scale (Anthropic's C compiler: 16 agents, 2,000 sessions, 100k LOC).

**What Ritemark should steal:** File-based locking for concurrency. The proven coordination model.

**Why not just visualize it:** Claude Code-only. No visual board. No kanban semantics. Ritemark could provide a visual layer on top AND extend the pattern to other agents.

### Other Tools Surveyed (Brief)

| Tool | What | Key Takeaway |
|------|------|-------------|
| **Kanban-MCP** (eyalzh) | MCP server with WIP limits, SQLite, web UI | WIP limits are valuable kanban semantics worth adopting |
| **Flux** | CLI-first kanban, git-native sync, P0/P1/P2 priorities | `flux ready` (show next unblocked task) = good agent pattern |
| **ai-todo / Backlog.md** | Plain markdown task files in repo | Proves file-based, git-native storage works. Simplest possible approach. |
| **Linear/Jira MCP** | Cloud PM tools with MCP servers | Enterprise play; not relevant for local-first MVP |
| **AGENTS.md** | Open standard for AI agent instructions (Linux Foundation) | Ritemark uses CLAUDE.md; task board + instruction file = complete orchestration |

### Existing VS Code Kanban Extensions

| Extension | What | Install Count Signal |
|-----------|------|---------------------|
| TaskMaster AI (VS Code) | Visual kanban for TaskMaster projects | Validates demand but TaskMaster-specific |
| taskr | Drag-and-drop kanban for TaskMaster | Same ecosystem |
| Taskboard | Renders kanban from todo.md | File-based approach works |
| Kanbn | Full kanban board | General-purpose; modest adoption |

**Demand signal is weak but present.** These extensions exist, which means some developers want kanban in their editor. But none have breakout adoption.

---

## Comparison Matrix (Key Competitors Only)

| | Vibe Kanban | TaskMaster + ext | Ritemark (proposed) |
|---|---|---|---|
| **Visual board** | Web app | VS Code extension | Built-in custom editor |
| **Storage** | PostgreSQL | `.taskmaster/` (markdown) | `.tasks.json` (project-local) |
| **Git-friendly** | No | Yes | Yes |
| **Agent activation** | Board spawns agent | Human-initiated | Human-initiated (Phase 1) |
| **MCP tools** | Yes (bidirectional) | 36 tools (~21k tokens) | 7 tools (~3k tokens est.) |
| **Agent support** | 10+ (subprocess) | MCP clients only | MCP clients only |
| **Dependencies** | No | Yes | Yes (planned) |
| **WIP limits** | No | No | Yes |
| **Editor integration** | None (standalone) | Extension (third-party) | Native (first-party) |
| **Maturity** | High (22k stars) | High (established) | Does not exist yet |

---

## Recommended Approach for Ritemark

### Vision: "Tasks" — A Native Kanban Editor for AI-Orchestrated Work

Ritemark should provide a **built-in kanban task board** that:
1. Opens `.tasks.json` files as visual kanban boards (like `.flow.json` → flow editor)
2. Exposes tasks via MCP server so any AI agent can read/update them
3. Integrates with Ritemark AI sidebar for task-driven conversations
4. Stores everything as JSON files in the project (git-friendly, local-first)

### Architecture

```
┌─────────────────────────────────────────────────┐
│                  Ritemark Native                 │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Markdown  │  │  Flows   │  │    Tasks      │  │
│  │  Editor   │  │  Editor  │  │    Editor     │  │
│  │ (.md)     │  │(.flow.json)│ │(.tasks.json) │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│                                   │              │
│                        ┌──────────┴──────────┐   │
│                        │   MCP Server        │   │
│                        │  (task tools)        │   │
│                        └──────────┬──────────┘   │
│                                   │              │
│  ┌──────────┐  ┌──────────┐  ┌───┴───────────┐  │
│  │ Claude   │  │  Cursor  │  │  Any MCP      │  │
│  │  Code    │  │ Windsurf │  │  Client       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
```

### How Agent-Task Activation Actually Works

This is the hardest design question. A kanban board is just a picture until something connects it to an agent doing work. Here's how existing tools solve this, and what Ritemark could do:

#### How Existing Tools Solve Activation

| Tool | Who launches the agent? | How does the agent know about tasks? | Concurrency model |
|------|------------------------|--------------------------------------|-------------------|
| **Vibe Kanban** | User clicks "Start" on a card → Vibe spawns a terminal subprocess with the agent CLI | Vibe injects task context into the agent's system prompt + gives it a git worktree | One worktree per task, parallel agents |
| **TaskMaster** | User manually runs agent (Claude Code, Cursor) and says "work on next task" | Agent has TaskMaster MCP tools; it calls `get_next_task` because MCP tools are in its tool list | No locking — relies on single-agent workflow |
| **Claude Code Tasks** | User runs `claude code` with `CLAUDE_CODE_TASK_LIST_ID` env var | Built-in: Claude Code reads its own task list natively | File-based locks in `current_tasks/` directory |
| **Flux** | User runs agent manually, tells it to use `flux ready` | CLI command or MCP tool returns next unblocked P0 task | `flux ready` filters already-claimed tasks |

**Key insight:** There are two fundamentally different models:

1. **Human-initiated** (TaskMaster, Flux): Human opens terminal, runs agent, tells it to check the board. The agent is a tool the human wields. Simple, proven, works today.
2. **Board-initiated** (Vibe Kanban): Human clicks a button on the board, the board spawns the agent. The board is an orchestrator. More powerful, but requires process management.

#### Ritemark's Activation Options

**Option A: Human-initiated (low effort, works now)**
- User opens terminal in Ritemark, runs `claude code` (or any agent)
- Agent discovers `.tasks.json` via MCP tools (Ritemark's MCP server is in its config)
- User tells agent: "Work on the next task" → agent calls `task_get_next`
- Agent implements, calls `task_move` when done
- Board updates in real-time via VS Code file watcher

**This is how TaskMaster works today. It's proven and requires no process management.**

**Option B: Board-initiated (higher effort, better UX)**
- User clicks "Assign to Agent" on a kanban card
- Ritemark opens a terminal panel and runs `claude code --task "Implement dark mode toggle" --context ./sprint.tasks.json`
- The terminal shows the agent working; user can watch or switch tabs
- Agent calls MCP tools to update task status as it works
- When agent finishes, task auto-moves to "Review"

**This is how Vibe Kanban works. Better UX but requires Ritemark to manage subprocesses, handle agent crashes, pipe context correctly.**

**Option C: Hybrid (recommended)**
- Phase 1: Human-initiated only. Board is passive — just a visual + MCP layer.
- Phase 2: Add "Launch Agent" button that opens an integrated terminal with pre-filled command. Not full orchestration — just convenience.
- Phase 3 (if validated): Full board-initiated orchestration with process management.

#### Assignment Model

The `assignee` field in `.tasks.json` serves different purposes depending on activation model:

| Model | What "assignee" means | Set by |
|-------|----------------------|--------|
| Human-initiated | Informational label ("claude", "jarmo", "codex") | Human or agent (via MCP) |
| Board-initiated | Determines which agent CLI to launch | Human (via UI dropdown) |
| Multi-agent | Lock indicator — "this task is claimed by agent X" | Agent (via `task_claim` tool) |

For Phase 1, `assignee` is just a label. It becomes functional only if/when board-initiated activation is built.

#### Concurrency and Locking

**Problem:** Two agents (or one agent + one human) edit `.tasks.json` simultaneously → data corruption or merge conflicts.

**Solution — file-level locking via MCP:**
- All MCP task tools read → modify → write the JSON file atomically
- The MCP server holds an in-memory lock per `.tasks.json` file (mutex)
- VS Code's `onDidChangeDocument` API notifies the webview when the file changes on disk
- For git merge conflicts: JSON is inherently conflict-prone. Mitigation options:
  - **Accept it:** Single `.tasks.json` per board means conflicts are rare in practice (tasks change frequently, but usually one person/agent at a time)
  - **One-file-per-task** (TaskMaster approach): Better git merges, but loses the "open one file, see whole board" simplicity
  - **Hybrid:** Store board config (columns, settings) in `.tasks.json`, individual tasks as separate files in `.tasks/` directory. Best merge behavior but more complex.

**Recommendation:** Start with single `.tasks.json` (simplest). Move to hybrid if merge conflicts become a real problem in practice — don't pre-optimize.

### Implementation Layers

#### Layer 1: Task File Format (`.tasks.json`)

```json
{
  "version": 1,
  "name": "Sprint 12 - Settings Redesign",
  "columns": [
    { "id": "backlog", "name": "Backlog", "wipLimit": null },
    { "id": "todo", "name": "To Do", "wipLimit": 5 },
    { "id": "in-progress", "name": "In Progress", "wipLimit": 3 },
    { "id": "review", "name": "Review", "wipLimit": 2 },
    { "id": "done", "name": "Done", "wipLimit": null }
  ],
  "tasks": [
    {
      "id": "task-001",
      "title": "Implement dark mode toggle",
      "description": "Add a toggle in Settings to switch between light and dark themes.",
      "column": "todo",
      "priority": "p1",
      "labels": ["ui", "settings"],
      "dependencies": [],
      "subtasks": [
        { "id": "sub-001", "title": "Add theme context provider", "done": false },
        { "id": "sub-002", "title": "Create toggle component", "done": false }
      ],
      "assignee": null,
      "created": "2026-03-05T10:00:00Z",
      "updated": "2026-03-05T10:00:00Z",
      "notes": ""
    }
  ]
}
```

**Why JSON over markdown?** Ritemark already uses this pattern for `.flow.json`. JSON is parseable by agents without ambiguity, supports structured metadata, and integrates with the existing custom editor infrastructure.

#### Layer 2: Custom Editor (Kanban Board UI)

Reuse existing Ritemark webview architecture:
- **TaskEditorProvider** (like `FlowEditorProvider`) — registers for `.tasks.json`
- **React kanban board** in webview using existing tech stack (React + Zustand + Tailwind)
- **Drag-and-drop** via `@dnd-kit/core` + `@dnd-kit/sortable` (purpose-built for kanban/list DnD; XYFlow is not appropriate here — it's a node-graph library)
- **Card detail view** with markdown description editing (could reuse TipTap for the description field)

**Note:** The Flows editor uses XYFlow for its node-graph canvas. The Tasks editor needs a completely different UI — CSS grid columns with vertically sortable cards. These share the webview infrastructure (React, Zustand, Tailwind, message passing) but not the canvas library.

UI components needed:
- `KanbanBoard.tsx` — column layout with drag-and-drop
- `KanbanColumn.tsx` — column with WIP limit indicator
- `KanbanCard.tsx` — task card with priority badge, labels, subtask progress
- `TaskDetail.tsx` — expanded view for editing task details

#### Layer 3: MCP Server (Agent Integration)

Expose tasks via MCP tools so any agent can interact:

```
Tools:
  task_list_boards     — List all .tasks.json files in workspace
  task_get_board       — Get full board state
  task_add             — Create a new task
  task_update          — Update task fields
  task_move            — Move task between columns (respects WIP limits)
  task_delete          — Remove a task
  task_get_next        — Get highest-priority unblocked task (agent workflow)

Prompts:
  plan_project         — "Break down this goal into kanban tasks"
  work_on_next         — "Pick the next task and implement it"
```

The `task_get_next` tool is critical — it enables the agent loop:
1. Agent calls `task_get_next` → gets highest-priority unblocked task
2. Agent implements the task
3. Agent calls `task_move(task, "review")`
4. Human reviews, moves to "done" or back to "in-progress" with feedback
5. Loop

#### Layer 4: AI Sidebar Integration

- "Create tasks from document" — analyze current markdown doc and generate task board
- Task status shown in AI sidebar (current sprint progress)
- Agent can reference tasks in conversation: "Working on task-003: Add export menu"
- Quick actions: "Move to done", "Create subtask", "Block this task"

### Integration Points with Existing Ritemark

| Existing Feature | Integration |
|-----------------|-------------|
| Flows (`.flow.json`) | Flow nodes can reference tasks; task completion triggers flow steps |
| AI Sidebar | Task context in agent conversations; task creation from chat |
| Document Editor | "Create tasks from this document" action; link tasks to markdown files |
| Claude Code agent | Task-aware agent that checks board before starting work |
| Feature flags | `ritemark-tasks` flag for rollout |

### Development Phases

**Phase 1: Visual Board (standalone value, no AI required)**
- `.tasks.json` schema definition and validation
- `TaskEditorProvider` custom editor (pattern: same as `FlowEditorProvider`)
- Kanban board webview: columns, cards, drag-and-drop via `@dnd-kit`
- Create/edit/move/delete tasks via UI
- Card detail panel with title, description, priority, labels
- File watcher: external changes to `.tasks.json` update the board live
- **Exit criteria:** A user can create a `.tasks.json` file, see a kanban board, and manage tasks visually — no terminal, no AI, no MCP needed.

**Phase 2: MCP Server (agent integration)**
- 7 MCP tools: `task_list_boards`, `task_get_board`, `task_add`, `task_update`, `task_move`, `task_delete`, `task_get_next`
- Estimated token cost: ~3,000 tokens for tool definitions (vs TaskMaster's 21k)
- Atomic file operations with in-memory mutex (concurrency safety)
- WIP limit enforcement on `task_move`
- `task_get_next` returns highest-priority unblocked+unclaimed task
- **Exit criteria:** An agent (Claude Code, Cursor) can call MCP tools to read the board, pick up a task, and move it through columns. Board updates live.

**Phase 3: AI Sidebar Integration**
- Task context injected into AI sidebar conversations
- "Create tasks from document" — analyze markdown and generate board
- Quick actions from sidebar: "Move to done", "Create subtask"
- **Exit criteria:** The AI sidebar knows about the task board and can discuss/modify tasks conversationally.

**Phase 4: Advanced (only if Phases 1-3 validated)**
- Board-initiated agent launch ("Assign to Agent" button)
- Dependency tracking and blocked-task visualization
- Flow integration (task completion triggers Flows)
- Task templates, multi-board views
- **Note:** This phase is speculative. Build only if Phase 1-3 adoption justifies it.

### User Journeys

**Journey 1: Solo developer with Claude Code (primary persona)**
1. Opens Ritemark, right-clicks in explorer → "New Task Board"
2. A `sprint.tasks.json` file is created with default columns (Backlog, To Do, In Progress, Review, Done)
3. Adds 5 tasks via the kanban board UI (drag, drop, type)
4. Opens integrated terminal, runs `claude code`
5. Tells Claude: "Check the task board and work on the highest priority item"
6. Claude calls `task_get_next` via MCP → gets task-001
7. Claude calls `task_move(task-001, "in-progress")` → board updates live
8. Claude implements the feature, commits code
9. Claude calls `task_move(task-001, "review")` → card slides to Review column
10. Developer reviews code, drags card to Done

**Journey 2: Non-developer using just the board (no AI agents)**
1. Opens Ritemark, creates `project.tasks.json`
2. Uses the kanban board to organize writing tasks, research items, etc.
3. Drags cards between columns manually
4. Board is saved as JSON — syncs via git, Dropbox, or whatever the user uses for files
5. No MCP, no agents, no terminal — just a visual task board inside the editor

**Journey 3: Multiple agents working in parallel (future/aspirational)**
1. Developer has 10 tasks on the board
2. Opens two terminal tabs, runs Claude Code in each
3. Agent A calls `task_get_next` → gets task-001, claims it (assignee set)
4. Agent B calls `task_get_next` → gets task-002 (task-001 is claimed, skipped)
5. Both work in parallel, each in their own git branch
6. As agents finish, cards move to Review automatically
7. Developer reviews PRs, drags approved cards to Done

---

## Alternative Approaches Considered

### A. Embed Vibe Kanban
**Verdict: Rejected.** Too heavyweight (Rust + Postgres), not editor-integrated, architectural mismatch.

### B. Use TaskMaster MCP as-is
**Verdict: Partial adoption.** Good MCP tool design to reference, but no visual board. Ritemark should provide its own UI + MCP server.

### C. Kanban-MCP as backend
**Verdict: Rejected.** SQLite not git-friendly. Ritemark should use JSON files.

### D. Extend Flows system for tasks
**Verdict: Rejected.** Flows are DAGs (directed acyclic graphs) for automation. Kanban is a different paradigm — columns with cards, not connected nodes. Separate editor is cleaner.

### E. Markdown-based tasks (`.tasks.md`)
**Verdict: Considered but not primary.** Markdown task lists (`- [ ]`) are good for simple todos inside documents, but lack the structure needed for kanban (columns, WIP limits, priorities, dependencies). Could support import/export between formats.

### F. Integrate with Claude Code's native Tasks system
**Verdict: Complementary.** Ritemark's kanban board can read/write Claude Code's task files as an additional integration, but should have its own format as the primary store since Claude Code's format is agent-specific.

---

## Competitive Positioning

### What Ritemark would offer:

1. **Editor-native** — Board lives inside the editor, not a separate app/browser tab
2. **File-based** — `.tasks.json` in project root, version-controlled, portable
3. **MCP-accessible** — AI agents with MCP support can read/update tasks programmatically
4. **Document-linked** (Phase 3) — Tasks can reference and be created from markdown documents
5. **Visual + programmatic** — Humans use the board; agents use MCP tools

### Honest comparison with closest competitor:

**TaskMaster + VS Code extension** already provides: file-based tasks, MCP tools, VS Code kanban board, dependency tracking, AI-generated task decomposition. It's a mature, well-adopted tool.

**Where Ritemark would differ:**
- Ritemark owns both the editor and the task system (no third-party extension dependency)
- `.tasks.json` lives in the project (TaskMaster uses `.taskmaster/` in home directory)
- Tighter integration with Ritemark-specific features (Flows, AI sidebar, document linking)
- Simpler MCP tool surface (7 tools vs TaskMaster's 36 — lower token overhead)

**Where TaskMaster is stronger:**
- PRD → task decomposition (AI-generated tasks from requirements)
- Mature MCP tool design (36 tools, battle-tested)
- Multi-provider LLM support for task generation
- Already has community adoption

**The honest case:** Ritemark's advantage is integration depth, not feature breadth. A built-in task board that shares state with the AI sidebar, updates in real-time, and connects to Flows is a better experience than installing a third-party extension — but only if execution quality is high.

### MCP Compatibility Reality Check

"Agent-agnostic via MCP" is aspirational, not current reality:

| Agent | MCP Client Support | Would work with Ritemark MCP? |
|-------|-------------------|-------------------------------|
| Claude Code | Yes (native) | Yes |
| Cursor | Yes (native) | Yes |
| Windsurf | Yes (native) | Yes |
| Codex CLI (OpenAI) | Not yet confirmed | Unknown |
| Copilot | Extensions, not MCP | No |
| Gemini CLI | Partial | Uncertain |

MCP adoption is growing but not universal. The feature should work well without MCP (the board is useful standalone) and MCP adds power-user agent integration on top.

---

## Decision Required

This analysis is research, not a green light. Before committing engineering time, Jarmo should decide:

### Decision 1: Build, integrate, or wait?

| Option | Effort | Risk | Signal gained |
|--------|--------|------|--------------|
| **A. Build Phase 1** (kanban board, no MCP yet) | ~2 sprints | Medium — may build something nobody uses | High — see if users actually use the board |
| **B. Ship TaskMaster integration** (render their tasks in a Ritemark sidebar) | ~3 days | Low — minimal code, easy to remove | Medium — tests demand for task visibility, not our own board |
| **C. Wait** — add to wishlist, revisit when users ask | Zero | Zero | None — but avoids premature building |

**Recommendation:** Option B first (cheap demand validation), then Option A if signal is positive.

### Decision 2: If building, who is the primary user?

- **Developers using AI agents** → prioritize MCP integration, `task_get_next`, terminal workflow
- **General Ritemark users** → prioritize standalone board UX, simplicity, no AI jargon
- **Both** → Phase 1 serves general users (standalone board), Phase 2 adds developer/agent layer

### Decision 3: File format

- **Single `.tasks.json`** — simpler, merge-conflict-prone, good for solo use
- **One-file-per-task** — git-merge-friendly, more complex, better for multi-agent
- **Recommendation:** Start with single file. Migrate only if conflicts become a real problem.

---

## Unvalidated Assumptions

These are things this analysis assumes but has not proven:

1. **"Developers want a kanban board inside their editor"** — No user research or feature request data supports this. The existence of VS Code kanban extensions (with modest install counts) is weak signal, not proof.
2. **"MCP tools will be reliably discovered and used by agents"** — MCP tool discovery varies by client. An agent may not call `task_get_next` unless explicitly prompted. This needs testing.
3. **"A single `.tasks.json` file won't cause merge conflicts in practice"** — Plausible for solo developers, untested for multi-agent scenarios.
4. **"The kanban metaphor fits Ritemark's user base"** — Ritemark targets markdown writers. Kanban is a developer/PM tool. These audiences may not overlap.

## Remaining Open Questions

(Decisions 1-3 above are the blockers. These are secondary design questions for if/when we build.)

1. **Real-time sync UX:** Agent updates `.tasks.json` via MCP while board is open. `onDidChangeDocument` triggers webview reload — but does the UX feel smooth or jarring? Needs prototyping.
2. **Claude Code interop:** Read/write `~/.claude/tasks/` directly, or maintain own format? Own format is cleaner, but loses Claude Code's built-in multi-session coordination.
3. **Board templates:** Ship defaults (Sprint Board, Bug Tracker) or start with blank boards only?
4. **MCP tool discovery:** Will agents reliably find and use Ritemark's MCP tools, or will users need to explicitly prompt "use the task board"? Needs testing with Claude Code and Cursor.

---

## Sources

**Primary tools analyzed:**
- [Vibe Kanban (BloopAI)](https://github.com/BloopAI/vibe-kanban) — [vibekanban.com](https://www.vibekanban.com/)
- [TaskMaster AI](https://github.com/eyaltoledano/claude-task-master) — [task-master.dev](https://www.task-master.dev/)
- [Kanban-MCP (eyalzh)](https://github.com/eyalzh/kanban-mcp)
- [Flux Kanban](https://paddo.dev/blog/flux-kanban-for-ai-agents/)
- [Kanban MCP for Planka (bradrisse)](https://github.com/bradrisse/kanban-mcp)

**File-based systems:**
- [ai-todo](https://github.com/fxstein/ai-todo)
- [Backlog.md](https://github.com/MrLesk/Backlog.md)
- [ai-dev-tasks](https://github.com/snarktank/ai-dev-tasks)

**Claude Code / AI agent coordination:**
- [Claude Code Tasks (VentureBeat)](https://venturebeat.com/orchestration/claude-codes-tasks-update-lets-agents-work-longer-and-coordinate-across)
- [Claude Code Docs](https://code.claude.com/docs/en/how-claude-code-works)
- [Anthropic C Compiler Case Study](https://www.anthropic.com/engineering/building-c-compiler)
- [Claude Code Task Guide (dplooy)](https://www.dplooy.com/blog/claude-code-tasks-complete-guide-to-ai-agent-workflow)

**Standards and integrations:**
- [AGENTS.md (Agentic AI Foundation)](https://agents.md/)
- [Linear MCP Setup](https://composio.dev/blog/how-to-set-up-linear-mcp-in-claude-code-to-automate-issue-tracking)
- [Jira MCP Server](https://composio.dev/blog/jira-mcp-server)

**VS Code extensions:**
- [Taskmaster AI VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Hamster.task-master-hamster)
- [Taskboard (todo.md kanban)](https://github.com/ashleydavis/taskboard-vscode-extension)
