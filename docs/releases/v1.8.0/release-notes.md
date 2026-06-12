---
date: 'TBD'
title: 'Ritemark v1.8.0 — Your AI Agents, On a Schedule'
author: Jarmo Tuisk
status: DRAFT
sprints:
  - sprint-79
  - sprint-80
  - sprint-81
  - sprint-82
tags:
  - sprint-79
  - sprint-80
  - sprint-81
  - sprint-82
  - runtime-unification
  - scheduled-tasks
  - daemon
  - file-attachments
  - codex
  - acp
  - opencode
  - browser
  - excel
  - spreadsheets
  - drawio
  - diagrams
---

<!-- DRAFT — v1.8.0 release notes. Sprints 79, 80, 81, 82 scope locked; more sprints may still land. -->
<!-- Version number TBD — bump to v1.8.0 if upcoming sprint adds user-facing features, keep v1.7.4 if purely internal. -->

# Ritemark v1.8.0 — Your AI Agents, On a Schedule

**Status:** Draft
**Type:** [TBD — patch or minor]
**Focus:** Ritemark can now run AI agents **on a schedule** while the app is open — daily briefings, weekly summaries, recurring reports — with a no-cron-required Schedule picker and a safe-by-default approval model. That headline feature (Sprint 80) is built on the runtime unification from Sprint 79, which put all three AI runtimes (Claude Code, Codex, OpenCode) behind one internal architecture with a single **approval policy** (Auto · Ask · Plan) and brought **file attachments** to Codex and OpenCode. Alongside it, your documents do more: **.xlsx files are now editable** (Sprint 81) rather than read-only previews, and you can **embed and edit draw.io diagrams** directly in markdown with a fully offline vendored editor (Sprint 82).

* * *

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | TBD |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | TBD |
| Ritemark-Setup.exe | Windows x64 | TBD |

* * *

## Why This Release

v1.7.3 was an AI-surface release — Agent Library, Agent Configurator, OpenCode runtime. v1.8.0 is the follow-through. Scheduled AI agents are the headline; around them, a supporting pair makes your documents do more — editable spreadsheets and embeddable diagrams.

**The foundation (Sprint 79): one runtime architecture.** Until now, the three runtimes had three different ideas about when to ask permission. Claude Code applied every edit automatically with no way to gate it. Codex followed VS Code settings. OpenCode prompted on everything. There was no single control that meant the same thing across all of them. v1.8.0 replaces that with one per-conversation mode picker — Auto, Ask, Plan — in the composer. File attachments (images, PDFs, documents) used to work only with Claude Code; Codex and OpenCode accepted the attachment UI but silently ignored the files — that gap is now closed too. The rest of Sprint 79 is invisible unless you're building on Ritemark: a shared `AgentRuntime` interface that all three runtimes implement, and a single approval gate and dispatch path instead of three parallel code paths. That shared interface is what makes the headline feature possible.

**The headline (Sprint 80): scheduled AI agents.** Because every runtime now sits behind one interface, Ritemark can construct a fresh, isolated agent on demand and run it headlessly — which is exactly what scheduling needs. Add a `schedule:` block to an agent `.md` file (or use the new Schedule picker in the Agent editor) and the agent runs at the time you set: a 9 a.m. daily brief, a Friday-afternoon weekly summary, a recurring report. No cron syntax required — pick an interval or weekday chips and a time, and read a plain-English "Runs daily at 09:00" summary. Scheduled runs are safe by default: they can read your files but cannot write files or run shell commands without an explicit, one-time approval, and they run as isolated sessions that never touch your live conversations. The Agent Library gets a SCHEDULED section with per-task run history, and the status bar shows what's scheduled, running, or waiting for review. It runs only while Ritemark is open — there is no background OS daemon yet.

**Alongside (Sprint 81): editable spreadsheets.** `.xlsx` files were a read-only preview; now they're editable. Click a cell, type, Cmd+S to save, with dirty tracking, hot-exit backup, and revert. The editor gained an fx formula bar (so you can see a cell's formula Excel-style) and reliable multi-sheet tabs at the bottom of the viewport — which also fixes #110, where the sheet selector could fail to appear. Editing is cell-value scope: formulas and styles are preserved on save but not edited in-app, since Ritemark has no formula engine.

**Alongside (Sprint 82): diagrams in markdown.** Type `/diagram` in any markdown file and Ritemark drops a draw.io diagram next to your document, embeds it at the cursor, and opens a full editor. Double-click an embedded diagram to edit it; diagrams autosave like markdown, and the embedded picture live-refreshes the moment you save. The editor is a complete draw.io (v30.0.4) vendored into the app and running fully offline — no CDN, no account. And the files are clever: a `.drawio.svg` is a normal SVG that renders anywhere (GitHub, other editors) while carrying its own editable source inside, for a lossless round-trip. This closes #111.

Sprint docs: `docs/development/sprints/sprint-79-runtime-unification/`, `docs/development/sprints/sprint-80-scheduled-tasks-daemon/`, `docs/development/sprints/sprint-81-excel-editing/`, `docs/development/sprints/sprint-82-drawio-diagrams/`

* * *

## What's New

### Scheduled AI agents — run an agent on a timer (sprint-80)

You can now have an AI agent run on a schedule, in the background, while Ritemark is open. The classic use cases: a daily briefing every morning, a weekly summary every Friday, a recurring report. You set it up once and the agent runs headlessly at the time you choose.

There are two ways to schedule an agent:

- **The Schedule picker in the Agent editor.** Open an agent and choose **Interval** mode (every N minutes or hours, from presets) or **Days** mode (weekday chips Mon–Sun, with Every day / Weekdays / Weekends presets, plus a time of day). A live summary reads back what you picked — "Runs daily at 09:00" — so there's no guessing. Everything is in **local time**, no timezone confusion. If you actually want raw cron, there's an **Advanced** escape hatch with a copy button — but you never need it.
- **Frontmatter.** Add a `schedule:` block to the agent's `.md` file directly. Agent files are picked up from both `.claude/agents/` and `.agents/`, and edits take effect live — no restart.

**Safe by default.** A scheduled run happens without you watching, so Ritemark is conservative: scheduled runs **auto-approve file reads** but **block file writes and shell commands**. If a run tries to write a file or run a command, it stops, raises a warning toast, and adds an amber **"needs review"** row in the Agent Library's SCHEDULED section. Click **Review & approve** and you see a confirmation dialog with the exact blocked action; approve it and the agent re-runs with that single action allowed — once. Future runs stay restricted.

**You can always see what's happening.** The status bar shows live scheduling state: "N scheduled" when idle, a spinner with the task label while a run is in progress, and amber "N needs review" when something is waiting on you. When a run finishes, a completion toast shows the first line of the agent's output with **Open result** and **Show runs** buttons that jump straight to the run history.

**It stays out of your way.** Scheduled runs are isolated, fresh sessions — they never touch your interactive conversations, and their run history (the last 10 runs per task) lives in its own SCHEDULED section in the Agent Library, fully separate from chat history, and persists across restarts.

The feature is **on by default**. One limitation to know: scheduled tasks run only while Ritemark is open — there is no background OS daemon yet.

### Editable Excel spreadsheets (sprint-81)

`.xlsx` files were previously a read-only preview. They're now **editable**:

- **Click a cell to edit it.** Type a value, press **Cmd+S / Ctrl+S** to save. Ritemark tracks unsaved changes (dirty state), keeps a hot-exit backup, and supports revert. `.xls` files stay a read-only preview.
- **fx formula bar.** Select a cell and its contents appear in the formula bar at the top, Excel-style. If the cell holds a formula, you'll see the formula itself (`=B2*C2`). Formula cells are read-only in the fx bar — Ritemark has no formula engine, so the grid shows the last value Excel calculated. (Editing a formula cell in the grid replaces the formula with a plain value.)
- **Add rows and columns.** An empty sheet shows an **"Add a row to start editing"** button; rows and columns can be added as you go. The grid is anchored at A1, so row numbers line up with real cell addresses.
- **Reliable multi-sheet workbooks.** Sheet tabs sit at the bottom of the viewport, Excel-style, with the active tab merging seamlessly into the grid. This also fixes [#110](https://github.com/ProductoryHQ/ritemark-native/issues/110), where the multi-sheet selector could fail to appear.

The custom editor was renamed from "Excel Preview" to **"Excel Editor"** to reflect that it now edits.

Editing scope is cell values. Formulas, styles, and merged cells are preserved on save but not editable in-app; clearing cells doesn't shrink the used range; and if the file changes on disk while you have unsaved edits, your edits stay in memory and a refresh asks for confirmation.

### Draw.io diagrams embedded in markdown (sprint-82)

You can now draw diagrams without leaving Ritemark, and keep them living inside your documents:

- **Type `/diagram` to embed one.** In any markdown file, type `/diagram` and Ritemark creates `images/diagram.drawio.svg` next to the file, embeds it at the cursor, and opens the diagram editor — all in one step.
- **A full draw.io editor.** Any `*.drawio.svg` file opens in a complete draw.io editor (v30.0.4). It's **vendored into the app and runs fully offline** — no CDN call, no account, no sign-in. To edit an embedded diagram, **double-click** it in markdown (a single click selects it, and a hover tooltip explains how).
- **Diagrams autosave.** Just like markdown files, there's no Ctrl+S to remember — the tab's dirty-dot briefly flashes as the save indicator and your changes are written.
- **The embed live-refreshes.** Edit in the diagram tab, switch back to the markdown, and the picture is already updated — the embed refreshes the moment the diagram is saved. This works for **all** embedded images, not just diagrams: if any image file under the document's folder changes on disk, the embed updates in place.
- **Files that render anywhere.** A `.drawio.svg` is dual-format: a normal SVG that displays correctly in GitHub, other editors, and any SVG viewer, while carrying its own editable diagram source inside. The round-trip is lossless — open it in Ritemark, edit, save, and it's still a clean SVG.

This closes [#111](https://github.com/ProductoryHQ/ritemark-native/issues/111). The feature is **on by default**.

One limitation to know: choosing a **Google Font** for diagram text requires a network connection to fetch the font. Everything else — drawing, editing, saving, embedding — works fully offline.

### One approval policy for every AI runtime: Auto, Ask, Plan (sprint-79)

The AI composer now has a single mode picker — **Auto · Ask · Plan** — that applies identically to all three runtimes (Claude Code, Codex, OpenCode). You choose it per conversation, right where you type. The default is **Auto**. This replaces the old Codex-only Edit/Plan toggle.

What each mode does:

- **Auto** (default) — the agent acts without asking. It edits files and runs commands directly, no approval prompts. This is the behavior Claude Code already had.
- **Ask** — before the agent writes a file or runs a shell command, an approval card appears with **Approve** / **Reject**. You review every change before it happens. Works the same for all three runtimes.
- **Plan** — the agent proposes a plan first and waits for your approval before doing anything. Once you approve the plan, it executes. (OpenCode has no native plan mode, so Plan there behaves like Ask.)

Why it matters: the three runtimes used to behave inconsistently — Claude Code auto-applied everything with no gate, Codex deferred to VS Code settings, OpenCode always prompted. Now there's one control that means the same thing everywhere, chosen in the composer.

The approval card itself is one shared component across all runtimes, so an Ask prompt from Codex looks and works exactly like one from OpenCode or Claude Code. We also removed the old "Always allow" option from the card — it was OpenCode-only and never actually persisted — so cards now offer just Approve and Reject.

### File attachments now work for Codex and OpenCode (sprint-79)

You could already attach images, PDFs, and text files to Claude Code prompts. As of this release, the same attachment picker works for **Codex** and **OpenCode** too.

How each runtime handles attachments:

- **Claude Code** — unchanged. Native multimodal support; files passed as-is.
- **Codex** — images as data URLs (existing behavior). PDFs and text files are inlined as a fenced code block in the prompt preamble so Codex can read the content even without native file support.
- **OpenCode** — images sent as base64 prompt attachments when the selected provider supports multimodal (GPT-4o, Gemini 1.5 Pro, Claude via Anthropic key, etc.); PDFs and text files inlined like Codex. When OpenCode downgrades an attachment type, a notice appears in the progress stream.

The attachment picker UI does not change — it already worked; now it delivers.

### AI agents now prefer the integrated browser over external Chrome (sprint-79)

Every agent session now includes a one-line system prompt hint telling the AI that Ritemark has an integrated browser and that `mcp__ritemark_browser__*` tools should be used instead of Bash `open` or `xdg-open` for URLs. In practice this means agents will navigate, click, and fill forms inside the integrated browser panel rather than launching an external Chrome window on your desktop.

This is always active — not flag-gated.

* * *

## Polish

- **Status bar scheduling feedback.** Scheduling state is always visible in the status bar — idle ("N scheduled"), running (a spinner with the task label), and waiting ("N needs review") — and completion toasts surface the first line of agent output with Open result / Show runs jumps.
- **Excel grid alignment.** The grid is anchored at A1 so row numbers match real cell addresses, and the active sheet tab merges seamlessly with the grid for an Excel-native feel.

* * *

## Coming Next

- **Background scheduling.** Scheduled tasks currently run only while Ritemark is open. A background OS daemon that runs tasks when the app is closed is a candidate for a future sprint.
- **Richer Excel editing.** Today's editing is cell-value scope. Formula editing, styles, and merged-cell editing are preserved-but-not-editable for now.

* * *

## Under the Hood

### Unified `AgentRuntime` interface + registry (sprint-79)

All three runtimes (Claude Code, Codex, OpenCode) now implement a single `AgentRuntime` interface in `src/runtime/`. A `RuntimeRegistry` holds one instance per agent ID and handles disposal. The practical result: adding a fourth runtime is a new adapter class + one registry entry — no changes to `UnifiedViewProvider`.

### Single dispatch path (sprint-79)

`UnifiedViewProvider` previously had nine runtime-specific message cases (`ai-execute-agent`, `codex-execute`, `acp-execute`, and so on). All three are now unified into `agent-execute`, `agent-cancel`, and `agent-approve` — one case each, with an `agentId` field routing to the right runtime adapter. The view provider dropped from ~2480 LOC to ~1100.

### Unified approval gate + policy (sprint-79)

File-write approvals, shell-command approvals, and plan approvals from any runtime now flow through a single `UnifiedApprovalGate` that maps each runtime's native approval type to one webview message shape. The webview's `ApprovalCard` handles all four `kind` values from one component file.

On top of that message contract sits the approval **policy**. The composer's Auto/Ask/Plan choice is sent as `approvalMode` on `agent-execute` and mapped per runtime:

- **Claude Code** — via the SDK permission mode plus the `canUseTool` callback.
- **Codex** — via `approvalPolicy` / `sandbox` (Ask maps to `untrusted` + `read-only`).
- **OpenCode** — via the native ACP `session/request_permission` flow.

Switching modes mid-conversation may start a fresh agent session for the affected runtime, so the new policy applies cleanly from that point.

### Per-turn context preserved across runtimes (sprint-79)

The unified dispatch path carries per-turn context — the active file, browser context, and `@mentions` — through to all three runtimes consistently, so each turn reaches the agent with the same surrounding context regardless of which runtime is selected.

### Browser tool injection via `BrowserToolsInjector` (sprint-79)

Browser tool availability (the `mcp__ritemark_browser__*` toolset) was previously wired differently for each runtime. It is now injected uniformly via `BrowserToolsInjector.get()`. Codex receives browser tools as MCP, consistent with how Claude Code and OpenCode receive them. The per-thread `_codexBrowserToolsEnabledForThread` state in `UnifiedViewProvider` is gone.

### Model config consolidation (sprint-79)

`CLAUDE_MODELS` and `DEFAULT_MODEL` moved from `src/agent/types.ts` into `src/ai/modelConfig.ts`. The deprecated `CODEX_MODELS` constant is deleted. `modelConfig.ts` is now literally the single source for all model identifiers.

### Scheduled-tasks daemon subsystem (sprint-80)

Scheduling lives in a new `src/daemon/` subsystem, deliberately built handler-agnostic. A `Scheduler` drives a generic `ScheduledTask` interface; `AgentTaskHandler` is the concrete handler that runs an agent, while `GitSyncHandler` and `ScriptHandler` ship as stubs that prove the interface is extensible to non-agent task types. Under the hood: a pure, unit-tested cron engine (`cron.ts`), `DaemonResultStore` (backed by `workspaceState`) for persisted run history, and `DaemonStatusEvents` driving the status bar and toasts. The feature is gated by the `scheduled-tasks-daemon` flag, which ships `stable` (on by default).

### `createRuntime()` runtime factory (sprint-80)

A new `createRuntime()` factory in `src/runtime/runtimeFactory.ts` is now the single construction source for all agent runtimes. The interactive UI builds its shared registry through it, and — crucially — the scheduler mints its own **fresh, isolated** runtime instance per headless run through the same factory. Because scheduled execution programs against the `AgentRuntime` interface (not a concrete class), pointing a scheduled task at Codex or OpenCode instead of Claude Code is a one-line change. Isolation is what keeps a background run from clobbering the user's live conversation or its approval mode.

### Editable Excel custom editor (sprint-81)

The Excel custom editor moved from preview-only to a read/write `CustomEditorProvider`: edit operations mutate an in-memory workbook model, dirty state and hot-exit backup flow through VS Code's custom-document lifecycle, and save writes cell values back while preserving formulas, styles, and merged cells that aren't part of the basic-editing scope. The multi-sheet selector reliability fix (#110) and the A1-anchored grid land here.

### Draw.io diagram custom editor + live embed refresh (sprint-82)

A new `drawioEditorProvider.ts` custom editor hosts the vendored draw.io webapp directly inside the webview document, bridged through a clean-room implementation of draw.io's embed JSON protocol — with a hidden same-origin relay iframe acting as the protocol partner. The full draw.io bundle (v30.0.4, Apache 2.0, ~36 MB) is committed under `media/drawio/` with its LICENSE and NOTICE; `scripts/vendor-drawio.sh` re-vendors it. Critically, that bundle is **not** part of the React webview bundle, so it has zero impact on the bundle-size budget tracked in #107.

On the markdown side, a per-document image watcher plus an `imageRefreshed` surgical node refresh (with cache-busted URIs) updates an embed in place the moment its underlying file changes — for any embedded image, not just diagrams. The `/diagram` insert uses an `imageInserted` ack handshake to close a focus-steal race that could otherwise wipe the insert. The whole feature is gated by the new `drawio-diagrams` flag, which ships `stable` (on by default, kill-switch only).

### Architectural debt closed (sprint-79)

- **ARCH-3 (zombie flag):** `document-search` feature flag set to `status: 'disabled'` — the RAG code it gated was removed in Sprint 74.
- **ARCH-4 (deprecated constant):** `CODEX_MODELS` deleted.
- **Daemon foundation (R8):** the foundation modules (`DaemonResultStore`, `DaemonStatusEvents`) are now connected to live UI by the Sprint 80 `Scheduler` — scheduling is wired end to end.

* * *

## Tests and Validation

[TODO: fill before release — Gate 1/2 sign-off, platform artifacts]
