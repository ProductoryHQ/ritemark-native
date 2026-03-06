# Ritemark v1.4.1 — Release Notes (DRAFT)

**Target Version:** 1.4.1
**Drafted:** 2026-03-03
**Status:** DRAFT — pending review, testing, and Jarmo approval

---

## Summary

Ritemark v1.4.1 adds **Codex CLI integration** (OpenAI's coding agent with ChatGPT login), **AI agent plan mode** with approve/reject workflow, **interactive agent questions**, **file context for AI chat** (right-click "Send to AI Chat" + active file chip), and **context window protection** to prevent silent failures in long conversations. Internal housekeeping consolidates 21 VS Code patches down to 4.

---

## What's New

### Codex CLI Integration (Sprint 36)

A second coding agent joins Claude Code in the AI sidebar: **OpenAI Codex**, authenticated via your ChatGPT account.

- **ChatGPT OAuth login:** Sign in with your ChatGPT credentials directly from Ritemark Settings. Uses browser-based OAuth flow with token stored in OS keyring.
- **Agent selector:** Choose between Ritemark Agent, Claude Code, or Codex in the AI sidebar dropdown.
- **Codex chat view:** Dedicated chat UI for Codex conversations with real-time activity feed, collapsible activity sections, and shared chat history.
- **Image and file support:** Paste screenshots (Cmd+V) and attach files to Codex prompts — same attachment infrastructure as Claude Code.
- **Shared UI components:** Codex and Claude Code share the same ChatBubbles, RunningIndicator, and ChatHistoryPanel components for a consistent experience.
- **Feature flag:** Enabled by default. Can be toggled off in Settings > Ritemark Features.

**Requirements:** Codex CLI binary must be installed (`npm install -g @openai/codex`). ChatGPT Plus, Pro, Team, or Business account for authentication.

### Plan Mode for AI Agent (Sprint 39)

Ask the AI agent to plan before executing. The agent proposes a plan, and you approve or reject it before any files are changed.

- **Natural language trigger:** Type "enter plan mode", "plan first", or "show me the plan" in your message to activate plan mode for that session.
- **Formatted plan display:** Plans are rendered as structured markdown (numbered lists, headings) in a visually distinct container with a left-border accent.
- **Approve / Reject buttons:** After the agent presents its plan, click Approve to execute or Reject to provide feedback and request a revised plan.
- **Plan mode indicator:** A subtle "Planning..." indicator shows in the activity feed when the agent is in plan mode.

### Interactive Agent Questions (Sprint 39)

When the AI agent needs clarification, it now asks structured questions inline instead of silently blocking the session.

- **Inline question UI:** Questions appear directly in the conversation with selectable options (single-select or multi-select).
- **Free-text fallback:** An "Other" option lets you type a custom answer.
- **Non-blocking:** Chat input is disabled while a question is pending, with a clear visual indicator. The session resumes as soon as you submit answers.
- **Dedicated component:** New `AgentQuestion.tsx` renders questions using VS Code's native styling.

### File Context for AI Chat (Sprint 39)

Give the AI agent more context about your project without manually copying file paths.

- **"Send to AI Chat" context menu:** Right-click any file or folder in the Explorer sidebar and select "Send to AI Chat" to add its path as a removable chip in the chat input. Supports multi-select.
- **Active file chip:** The currently focused file automatically appears as a context chip above the chat input. The chip updates when you switch tabs and can be dismissed per-message.
- **Smart deduplication:** If you manually add a file that is also the active file, the automatic context injection is skipped to avoid wasting tokens.
- **Drag-and-drop for all agents:** File path drops now work for Ritemark Agent and Codex, not just Claude Code.

### Context Window Protection (Sprint 40) — IN PROGRESS

Prevents the frustrating "Prompt too long" silent failure in long AI conversations.

- **Context overflow detection:** When the AI returns a "prompt too long" error, Ritemark now shows a friendly error message explaining what happened, with a "Start fresh conversation" button.
- **Context usage bar:** A thin color-coded progress bar at the top of the conversation shows estimated context usage (blue < 60%, yellow 60-80%, red > 80%).
- **Context warning banner:** When estimated usage exceeds 70%, a warning banner suggests using `/compact` or starting a fresh conversation.

> **Note:** This feature has uncommitted changes and may need further work before release.

---

## Bug Fixes

- **Fixed feature flag key mismatch:** Codex integration feature flag key (`ritemark.features.codex-integration`) was mismatched with the code that checked it. Now consistent across settings and runtime.
- **Fixed RitemarkSettingsProvider memory leak:** Added proper `dispose()` method and registered in `context.subscriptions` to prevent resource leaks.
- **Fixed JSON-RPC timeout:** Added 30-second timeout to Codex JSON-RPC calls to prevent permanent Map entry leaks from unanswered requests.
- **Fixed cross-platform binary detection:** Uses `where` on Windows instead of `which` for finding the Codex binary.
- **Fixed OAuth spinner stuck state:** Added 60-second timeout to the ChatGPT OAuth spinner to prevent stuck UI when login fails silently.
- **Fixed ChatInput dependency array:** `handleSend` was missing `isCodex`/`sendCodexMessage` in its dependency array.

---

## Improvements

- **VS Code patches consolidated:** 21 individual patches reduced to 4 domain-grouped patches (branding, UI layout, menu cleanup, build system). No functional change, but easier to maintain and apply.
- **Hidden VS Code submodule from Source Control:** The VS Code submodule no longer clutters the Source Control panel.
- **Codex chat history with migration:** Chat history storage supports Codex conversations with automatic migration from legacy data format.
- **Agent badge in history:** Chat history panel shows agent type badge (Claude / Codex / Agent) for each conversation.

---

## Technical Details

- Base: VS Code OSS 1.94.0 (unchanged from v1.4.0)
- Patches: 4 consolidated patches (was 21 in v1.4.0)
- New source files: 6 files in `src/codex/` (Codex protocol, manager, auth, app server)
- New component: `AgentQuestion.tsx` (agent question UI)
- New component: `CodexView.tsx` (Codex chat view)
- New component: `ChatBubbles.tsx` (shared chat bubble components)
- Feature flags: `codex-integration` added (stable, enabled by default)
- New context menu: "Send to AI Chat" in Explorer

### Sprints Included

| Sprint | Focus | Status |
|--------|-------|--------|
| Sprint 36 | Codex CLI + ChatGPT Integration | Complete |
| Sprint 38 | Patch Consolidation (21 to 4) | Complete |
| Sprint 39 | Agent UX Fixes (Plan Mode, AskUserQuestion, File Context) | Complete |
| Sprint 40 | Context Window Protection | In progress (uncommitted) |

---

## Commits Since v1.4.0

| Hash | Date | Description |
|------|------|-------------|
| `a549066` | 2026-02-14 | Add Codex CLI + ChatGPT integration research analysis |
| `fc00f5c` | 2026-02-14 | Add Sprint 36 plan: Codex CLI + ChatGPT integration |
| `f6a5472` | 2026-02-14 | Implement Codex CLI integration with ChatGPT OAuth (Sprint 36) |
| `07d0124` | 2026-03-03 | fix: codex QA — lifecycle leak, RPC timeout, cross-platform binary check |
| `4ce02df` | 2026-03-03 | fix: rewrite Codex protocol from generated types, unify chat UI components |
| `08715f0` | 2026-03-03 | docs: document file context & "Send to AI Chat" feature in sprint-39 |
| `000dcad` | 2026-03-03 | feat: enable Codex integration by default (stable flag) |
| `ab6cec1` | 2026-03-03 | docs: add sprint docs, patch backup, gitignore marketing binaries |
| `5e6a726` | 2026-03-03 | chore: hide vscode submodule from Source Control panel |
| `cd6e569` | 2026-03-03 | feat: add screenshot paste and file attach support for Codex |

**Uncommitted changes (sprint 40):** Context overflow detection in `AgentRunner.ts`, context usage bar and warning banner in `AgentView.tsx`, friendly overflow error UI in `AgentResponse.tsx`.

---

## File Change Summary

- **70 files changed** across committed work
- **~10,400 lines added**, ~420 lines removed
- Major areas: `src/codex/` (new), `webview/src/components/ai-sidebar/` (extended), `patches/vscode-backup-21/` (backup), sprint documentation

---

## Known Limitations

- **Codex requires manual binary install:** Users must install `codex` CLI separately (`npm install -g @openai/codex`).
- **Codex requires ChatGPT paid plan:** Free ChatGPT accounts may not have API access.
- **Plan mode requires new session:** Activating plan mode on an existing bypass-mode session creates a new session (cannot retrofit).
- **Context token estimation is heuristic:** The usage bar uses a rough 4-chars-per-token estimate; actual usage may vary by ~50%.
- **Sprint 40 work is uncommitted:** Context window protection changes need to be committed and tested before release.

---

## Requirements

- macOS 11+ (Apple Silicon or Intel) or Windows 10+
- OpenAI API key (for Ritemark Agent, Image nodes)
- Claude Code CLI (optional, for Claude Code agent)
- Codex CLI + ChatGPT account (optional, for Codex agent)

---

## Open Questions for Jarmo

1. **Sprint 40 (Context Window Protection):** The implementation is in progress with uncommitted changes. Should it be included in v1.4.1, or deferred to a later release?
2. **Codex flag default:** Currently set to "stable" and enabled by default via feature flag. Should it remain enabled by default, or should it stay experimental/disabled until more testing?
3. **UI language:** The context warning banner text in `AgentView.tsx` and the overflow error in `AgentResponse.tsx` appear to be in Estonian ("Vestlus hakkab pikaks minema", "Alusta uut vestlust"). Should these be in English for release?
4. **Release scope:** Is there any additional work planned before cutting v1.4.1, or is this the intended scope?
