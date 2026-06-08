---
date: 'TBD'
title: 'Ritemark v1.8.0 — TBD'
author: Jarmo Tuisk
status: DRAFT
sprints:
  - sprint-79
tags:
  - sprint-79
  - runtime-unification
  - file-attachments
  - codex
  - acp
  - opencode
  - browser
---

<!-- DRAFT — v1.8.0 release notes. Sprint 79 scope locked; remaining sprints TBD. -->
<!-- Version number TBD — bump to v1.8.0 if upcoming sprint adds user-facing features, keep v1.7.4 if purely internal. -->

# Ritemark v1.8.0 — [TBD title]

**Status:** Draft
**Type:** [TBD — patch or minor]
**Focus:** Sprint 79 unifies the three AI agent runtimes (Claude Code, Codex, OpenCode) under a single internal architecture. Two user-visible changes come out of it. First, a single **approval policy** — Auto, Ask, or Plan — picked right in the composer, that now means the same thing for all three runtimes. Second, you can now attach images, PDFs, and text files when chatting with Codex or OpenCode — file attachments were previously Claude Code-only. Everything else in this sprint is under-the-hood plumbing that makes the runtimes behave identically from your perspective, and that Sprint 80+ will build on.

[TODO: fill title + focus text once remaining sprint(s) land]

* * *

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | TBD |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | TBD |
| Ritemark-Setup.exe | Windows x64 | TBD |

* * *

## Why This Release

v1.7.3 was an AI-surface release — Agent Library, Agent Configurator, OpenCode runtime. v1.8.0 is the follow-through: we make the three runtimes actually equivalent.

Until now, the three runtimes had three different ideas about when to ask permission. Claude Code applied every edit automatically with no way to gate it. Codex followed VS Code settings. OpenCode prompted on everything. There was no single control that meant the same thing across all of them. v1.8.0 replaces that with one per-conversation mode picker — Auto, Ask, Plan — in the composer.

Until now, file attachments (images, PDFs, documents) also only worked with Claude Code. Codex and OpenCode accepted the attachment UI but silently ignored the files. That gap is closed.

The rest of Sprint 79 is invisible to you unless you're building on Ritemark: a shared `AgentRuntime` interface that all three runtimes now implement, a single approval gate and dispatch path (instead of three parallel code paths), and a daemon foundation that Sprint 80 will use to wire up scheduled agent tasks.

[TODO: add rationale for remaining sprint(s) once scope is known]

Sprint doc: `docs/development/sprints/sprint-79-runtime-unification/`

* * *

## What's New

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

[TODO: fill remaining sprint(s) What's New sections here]

* * *

## Polish

[TODO: fill once remaining sprint(s) land]

* * *

## Coming Next

[TODO: update based on what gets deferred]

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

### Architectural debt closed (sprint-79)

- **ARCH-3 (zombie flag):** `document-search` feature flag set to `status: 'disabled'` — the RAG code it gated was removed in Sprint 74.
- **ARCH-4 (deprecated constant):** `CODEX_MODELS` deleted.
- **Daemon foundation (R8):** `AgentDaemon`, `DaemonResultStore`, and `DaemonStatusEvents` modules land but are not yet connected to any UI. Sprint 80 wires scheduling.

[TODO: add Under the Hood entries for remaining sprint(s)]

* * *

## Tests and Validation

[TODO: fill before release — Gate 1/2 sign-off, platform artifacts]
