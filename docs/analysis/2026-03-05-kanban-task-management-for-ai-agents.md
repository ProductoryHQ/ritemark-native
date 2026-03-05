# Kanban Task Management for AI Agents in Ritemark

**Date:** 2026-03-05
**Status:** Research & Analysis
**Goal:** Evaluate approaches for kanban-style task management that works with Claude Code, Codex, and other AI agents in Ritemark Native.

---

## Executive Summary

The rise of "vibe coding" with AI agents has created a new bottleneck: **planning and reviewing work**, not writing code. Several tools have emerged to solve this with kanban-style task boards that orchestrate AI agents. This analysis evaluates the landscape and recommends an approach for Ritemark Native.

**Key finding:** The most promising path for Ritemark is a **built-in kanban board as a custom editor** (`.tasks.json` files) with **MCP server exposure**, letting any AI agent (Claude Code, Codex, etc.) read and update tasks. This leverages Ritemark's existing architecture (custom editors, XYFlow, Zustand) while being uniquely integrated into the markdown editing workflow.

---

## Landscape Analysis

### 1. Vibe Kanban (BloopAI)

**What:** Full orchestration platform for AI coding agents. Rust backend + TypeScript frontend. 22.4k GitHub stars.

**How it works:**
- Standalone web app launched via `npx vibe-kanban`
- Kanban board for creating/prioritizing issues
- Each task gets an isolated workspace (Git worktree, terminal, dev server)
- Supports 10+ agents: Claude Code, Codex, Gemini CLI, Copilot, Cursor, Amp, etc.
- Inline code review with comments, browser preview with DevTools
- PR creation with AI-generated descriptions
- GitHub integration for merge workflow

**Architecture:** Rust (50%) + TypeScript (46%), PostgreSQL, Docker-deployable

**Strengths:**
- Multi-agent parallel execution (each agent gets own worktree)
- Visual code review with inline commenting
- Agent-agnostic (10+ supported agents)
- Local-first, open source (Apache-2.0)

**Weaknesses:**
- Heavyweight (Rust + PostgreSQL stack)
- Standalone app — doesn't integrate into an editor
- Overkill for single-developer workflows
- No markdown/document integration

**Relevance to Ritemark:** Conceptual inspiration. The kanban → agent → review loop is the right UX pattern, but Ritemark should integrate this natively rather than being a separate app.

---

### 2. TaskMaster AI (claude-task-master)

**What:** MCP server for AI-powered task management. File-based. Works with Cursor, Claude Code, Windsurf, VS Code.

**How it works:**
- Initializes `.taskmaster/` directory in project
- Tasks stored as **markdown files** organized in tag-based directories (`backlog/`, `in-progress/`, `done/`)
- PRD (Product Requirements Document) → AI generates tasks
- 36 MCP tools with selective loading modes (core/standard/all)
- Dependency tracking between tasks
- Natural language interaction: "Can you help implement task 3?"

**Task format:** Markdown files with metadata (ID, status, priority, dependencies, subtasks)

**MCP tool modes:**
| Mode | Tools | Token Cost |
|------|-------|------------|
| Core | 7 | ~5,000 |
| Standard | 15 | ~10,000 |
| All | 36 | ~21,000 |

**Strengths:**
- File-based (git-friendly, portable)
- MCP native — works with any MCP-compatible editor
- PRD → task decomposition is powerful
- Dependency management
- No UI needed (CLI + MCP)

**Weaknesses:**
- No visual kanban board
- Heavy on token usage (up to 21k tokens for tool definitions)
- Tasks in home directory (`~/.taskmaster/`), not project-local
- No visual review workflow

**Relevance to Ritemark:** The MCP tool approach is excellent. TaskMaster proves that file-based tasks + MCP = agent-accessible task management. Ritemark could provide the visual layer that TaskMaster lacks.

---

### 3. Kanban-MCP (eyalzh)

**What:** MCP server providing kanban-based task management with WIP limits, SQLite DB, and web UI.

**How it works:**
- Creates kanban boards with columns and WIP limits
- Tasks stored in embedded SQLite database
- Web UI on localhost:8221 for visual board management
- MCP tools for board/task CRUD
- Designed for multi-session AI workflows

**MCP tools provided:**
- Board: `create-kanban-board`, `list-boards`, `get-board-info`
- Tasks: `add-task-to-board`, `move-task`, `delete-task`, `get-task-info`
- Prompts: `create-kanban-based-project`, `make-progress-on-a-project`

**Strengths:**
- True kanban semantics (WIP limits, columns)
- Visual web UI for human oversight
- Lightweight (SQLite, no external deps)
- Good MCP prompt design for agent workflows

**Weaknesses:**
- Small project (34 stars), early stage
- Separate web UI (not editor-integrated)
- SQLite not git-friendly (binary file)

**Relevance to Ritemark:** The MCP tool design is a good reference. WIP limits and column semantics are valuable kanban features. But Ritemark should embed the board natively rather than as a separate web server.

---

### 4. Flux

**What:** CLI-first kanban board with MCP server, web dashboard, and git-native sync.

**How it works:**
- CLI commands: `flux ready` shows unblocked tasks sorted by priority
- Local SQLite or JSON storage
- Git-native sync via pull/push
- MCP server for Claude Code integration
- Web dashboard for visual board management
- Task dependencies and priority levels (P0/P1/P2)

**Strengths:**
- CLI-first design (fast, scriptable)
- Git sync is unique and valuable
- Priority system (P0 first) guides agent behavior
- Offline-capable

**Weaknesses:**
- Early project
- No editor integration
- Limited documentation

**Relevance to Ritemark:** The priority-based "what should I work on next?" pattern is valuable. JSON storage with git sync aligns with Ritemark's local-first philosophy.

---

### 5. Claude Code Native Tasks System

**What:** Built-in to Claude Code 2.1+ (January 2026). Replaces the old Todos system.

**How it works:**
- Tasks persist in `~/.claude/tasks/` (file-based)
- Broadcast updates across sessions via `CLAUDE_CODE_TASK_LIST_ID`
- Dependency management (blocked/unblocked)
- Multi-session coordination — Session A completes task, Session B sees it immediately
- File-based synchronization for parallel agents

**Key insight from Anthropic's C Compiler project:**
- 16 agents, ~2,000 sessions, 100k lines of code
- File-based lock system (`current_tasks/`) for coordination
- Each agent clones to `/workspace`, takes lock on task

**Strengths:**
- Native to Claude Code (zero setup)
- Multi-session coordination built-in
- Dependency tracking
- File-based (inspectable, portable)

**Weaknesses:**
- Claude Code only (not agent-agnostic)
- No visual UI
- No kanban board metaphor
- Session-scoped by default (requires explicit coordination setup)

**Relevance to Ritemark:** This is what Claude Code already does. Ritemark's value-add would be providing a **visual layer** on top of this system, plus extending it to work with other agents.

### 6. File-Based Markdown Task Systems

Several lightweight tools take a markdown-first approach to task management:

**[ai-todo](https://github.com/fxstein/ai-todo)** — Tasks in plain `TODO.md`, zero config, no API calls. Human-readable, version-controlled. The simplest possible approach — any agent can read/write it.

**[Backlog.md](https://github.com/MrLesk/Backlog.md)** — Turns any git repo folder into a self-contained project board using plain markdown files. Built for spec-driven AI development.

**The `tasks/todo.md` pattern** — Community convention: maintain a checklist with explicit "Verify" tasks for lint/tests/build, plus a working notes section tracking constraints and decisions.

**Relevance to Ritemark:** These prove that file-based, git-native task storage works. Ritemark's `.tasks.json` approach is the structured evolution of this — same philosophy (local, git-friendly) but with enough structure for kanban semantics. Could also support import/export from markdown checklists.

### 7. VS Code Kanban Extensions (Reference)

| Extension | Key Feature | AI Integration |
|-----------|-------------|----------------|
| [Taskmaster AI VS Code](https://marketplace.visualstudio.com/items?itemName=Hamster.task-master-hamster) | Visual kanban for Task Master projects | Full (MCP, LLM-driven) |
| [taskr: Task Master Kanban](https://marketplace.visualstudio.com/items?itemName=DavidMaliglowka.taskr-kanban) | Drag-and-drop kanban for Task Master | Via Task Master |
| [Taskboard](https://github.com/ashleydavis/taskboard-vscode-extension) | Renders kanban from todo.md markdown | None (file-based) |
| [Kanbn](https://marketplace.visualstudio.com/items?itemName=gordonlarrigan.vscode-kanbn) | Full kanban board in VS Code | None |

**Key takeaway:** TaskMaster already has two VS Code extensions with kanban boards. These validate the demand for editor-integrated task boards but are TaskMaster-specific. Ritemark's approach should be standalone (works without TaskMaster) while being MCP-compatible.

### 8. AGENTS.md Standard

[AGENTS.md](https://agents.md/) is an open format (Linux Foundation / Agentic AI Foundation) for guiding coding agents. Originated at OpenAI for Codex, now supported by Copilot, Cursor, Gemini CLI, VS Code. 60,000+ open-source projects have adopted it.

Claude Code uses `CLAUDE.md` instead. Both serve the same purpose — project-level AI agent instructions. Ritemark already uses CLAUDE.md.

**Relevance:** A kanban task board combined with AGENTS.md/CLAUDE.md instructions creates a complete AI orchestration layer: the instructions tell agents *how* to work, the task board tells them *what* to work on.

### 9. External PM Integrations (Linear, Jira)

MCP servers exist for Linear and Jira, allowing AI agents to read/write issues directly:

- **[Linear MCP](https://composio.dev/blog/how-to-set-up-linear-mcp-in-claude-code-to-automate-issue-tracking)** — First-party MCP server. Linear also has a native Claude integration (Cyrus agent).
- **[Jira MCP](https://composio.dev/blog/jira-mcp-server)** — Official Atlassian MCP. Verbose ADF payloads waste context tokens.
- **[Unified Jira + Linear MCP](https://playbooks.com/mcp/dxheroes-jira-linear)** — Single server supporting both.

**Relevance to Ritemark:** These serve enterprise teams. Ritemark should focus on the local-first experience first, with optional export/sync to Linear/Jira/GitHub Issues as a future feature.

---

## Comparison Matrix

| Feature | Vibe Kanban | TaskMaster | Kanban-MCP | Flux | CC Tasks | ai-todo / md |
|---------|-------------|------------|------------|------|----------|--------------|
| Visual board | Yes (web) | VS Code ext | Yes (web) | Yes (web) | No | No |
| Editor-integrated | No | Yes (ext) | No | No | Yes | No |
| File-based storage | No (SQLite) | Yes (JSON) | No (SQLite) | Yes (JSON/SQLite) | Yes | Yes (markdown) |
| Git-friendly | No | Yes | No | Yes | Partial | Yes |
| Multi-agent support | 10+ agents | MCP-compatible | MCP-compatible | MCP + CLI | Claude only | Any (plain text) |
| Dependencies | No | Yes | No | Yes | Yes | No |
| WIP limits | No | No | Yes | No | No | No |
| Code review | Yes (inline) | No | No | No | No | No |
| MCP server | Yes (bidir) | Yes | Yes | Yes | No | No |
| Local-first | Yes | Yes | Yes | Yes | Yes | Yes |
| Complexity | High | Medium | Low | Medium | Low | Very Low |

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
│  │ Claude   │  │  Codex   │  │  Any MCP      │  │
│  │  Code    │  │  CLI     │  │  Client       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
```

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
- **Drag-and-drop** columns and cards (could use `@dnd-kit` or similar)
- **Card detail view** with markdown description editing (reuse TipTap)

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

**Phase 1: File Format & Basic Editor**
- Define `.tasks.json` schema
- TaskEditorProvider (custom editor registration)
- Basic kanban board UI (columns, cards, drag-and-drop)
- Create/edit/delete tasks
- CRUD via UI only

**Phase 2: MCP Server**
- MCP tool definitions for task CRUD
- `task_get_next` for agent workflow
- WIP limit enforcement
- Dependency tracking

**Phase 3: AI Integration**
- AI sidebar task context
- "Create tasks from document"
- Agent-aware task management (auto-move tasks based on agent activity)
- Task-driven agent loop

**Phase 4: Advanced Features**
- Flow integration (task → flow triggers)
- Multi-board views
- Task templates
- Sprint analytics/burndown
- Team assignment (future multi-user)

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

## Competitive Advantage

What makes Ritemark's approach unique:

1. **Editor-native** — Board lives inside the editor, not a separate app/browser tab
2. **File-based** — `.tasks.json` in project root, version-controlled, portable
3. **Agent-agnostic via MCP** — Works with Claude Code, Codex, and any future MCP client
4. **Document-linked** — Tasks can reference and be created from markdown documents
5. **Flow-connected** — Task completion can trigger Ritemark Flows (automation)
6. **Visual + programmatic** — Humans use the board; agents use MCP tools

No existing tool combines all of these. Vibe Kanban is closest but is a standalone app. TaskMaster has good MCP design but no visual board. Ritemark can be the first **editor-native kanban board for AI agent orchestration**.

---

## Open Questions

1. **Multi-board vs single board?** Should a project have one `.tasks.json` or multiple (e.g., per-sprint)?
2. **Real-time sync** — If an agent updates a task via MCP while the board is open, how to sync? (VS Code file watcher + reload?)
3. **Claude Code Tasks interop** — Should Ritemark read/write `~/.claude/tasks/` directly, or maintain its own format with optional sync?
4. **Board templates** — Should we ship default board templates (e.g., "Sprint Board", "Bug Tracker", "Feature Pipeline")?
5. **Offline-first** — File-based storage handles this naturally, but MCP server needs to handle agent disconnection gracefully.

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
