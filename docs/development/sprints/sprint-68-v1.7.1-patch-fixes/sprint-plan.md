# Sprint 68: v1.7.1 Patch Fixes

## Goal
Fix three open bugs (clipboard sandbox failure, browser HTML cold-start race, chat history showing only latest conversation) and land them on a proper sprint branch targeting v1.7.1.

## Feature Flag Check
No feature flags needed — all three items are bug fixes, not new user-visible features.

## Success Criteria
- [ ] All uncommitted clipboard changes land in a clean commit on `sprint-68-v1.7.1-patch-fixes`
- [ ] HTML files opened on cold-start route to the browser instead of getting stuck in the text editor
- [ ] Chat History panel shows all saved conversations from the correct workspace-scoped storage, never mixing conversations from different projects
- [ ] "New Chat" button removed from the history panel header (the + toolbar button is sufficient)
- [ ] History list items use the same visual pattern as the agent mention popup rows
- [ ] Pre-commit hook passes on all commits
- [ ] v1.7.1 patch release created from this branch

## Deliverables
| Deliverable | Description |
|-------------|-------------|
| Commit: clipboard fix | `webview/src/lib/clipboard.ts` + updated call sites (already implemented, needs commit on branch) |
| Fix: BrowserHtmlOpenRedirector cold-start race | Subscribe to `onDidChangeVisibleTextEditors` in addition to the existing `setTimeout` fallback |
| Fix: Chat History full list + UX cleanup | `store.ts` + `ChatHistoryPanel.tsx` — see Task 3 below |

## Technical Diagnosis: Issue #65

**Root cause:** The `agent:config` handler in `store.ts` calls `setWorkspaceContext(message.workspacePath)` but never follows it with `get().loadConversationList()`. The `savedConversations` array is initialised to `[]` and the only reload trigger is `toggleHistoryPanel()` — which fires once when the user first opens the panel. After that first open, subsequent auto-saves update localStorage but the store array never refreshes. So the panel always shows the snapshot from the last time it was opened, not the live list.

The "always 1 entry" symptom: on first open, `listConversations()` runs with `_workspacePath` set. If the user started their first conversation in this app session before opening the panel, that conversation is in the list. Older conversations are in localStorage under the scoped key and ARE correctly stored — they just never get loaded into the store.

**Workspace scoping code is correct.** The hash-based prefix (`ritemark-chat-<hash>-`) in `chatHistoryStorage.ts` correctly isolates per-project data. The migration path (global → scoped on first use) is also correct. No changes needed to `chatHistoryStorage.ts`.

**Fix:** One line in `store.ts`, `agent:config` case — call `get().loadConversationList()` after `setWorkspaceContext(message.workspacePath)`.

## Implementation Checklist

### Task 1: Branch setup
- [ ] Create `sprint-68-v1.7.1-patch-fixes` branch from current `main`
- [ ] Commit the already-done clipboard changes (Issue #66)

### Task 2: BrowserHtmlOpenRedirector cold-start race (Issue #63)
- [ ] In `BrowserHtmlOpenRedirector.register()`, subscribe to `vscode.window.onDidChangeVisibleTextEditors` and call `redirectIfNeeded` for each newly visible editor
- [ ] Keep the existing `setTimeout` fallback as belt-and-suspenders; the event subscription is the reliable fix
- [ ] Verify no double-redirect: existing `redirectedUntil` map already guards against this

### Task 3: Chat History full list + UX cleanup (Issue #65)

**Storage fix (store.ts):**
- [ ] In `handleExtensionMessage`, `agent:config` case: add `get().loadConversationList()` immediately after `setWorkspaceContext(message.workspacePath)` — this ensures the panel's backing state is populated right after workspace context is established

**Remove "New Chat" button (ChatHistoryPanel.tsx):**
- [ ] Remove the "New Chat" button block (the `<div className="px-2 py-2 border-b ...">` containing the `startNewConversation` button) from `ChatHistoryPanel`. The `+` button in the main toolbar already starts a new chat; the duplicate in the history panel is overkill.

**Apply agent-list design pattern (ChatHistoryPanel.tsx):**
- [ ] Replace the custom `ConversationItem` component with the same row pattern used in `AgentMentionPopup.tsx`: `<button>` with `flex items-start gap-2`, icon on the left (use `clock-counter-clockwise` or `chat` at 16px), title + subtitle text block on the right, active state via `bg-[var(--r-accent-soft)] text-[var(--r-accent-deep)]`, hover via `hover:bg-[var(--r-surface-soft)]`
- [ ] Keep the delete button on hover (existing trash icon behaviour) — just reshape the row layout to match the agent popup pattern
- [ ] Remove the `AgentBadge` sub-component — the agent type badge is visual noise in a conversation list; the title is sufficient

### Task 4: Validate and finalise
- [ ] Run `npm run compile` in `extensions/ritemark` to verify TS compiles
- [ ] Build webview bundle: `npm run build` in `extensions/ritemark/webview`
- [ ] Pre-commit hook passes on final commit
- [ ] Bump version to 1.7.1 in relevant manifests

## Branch / Commit Strategy
Work exclusively on `sprint-68-v1.7.1-patch-fixes`. Three commits minimum:
1. `fix(clipboard): route clipboard ops through extension host (closes #66)`
2. `fix(browser): subscribe onDidChangeVisibleTextEditors to fix cold-start race (closes #63)`
3. `fix(chat-history): reload list after workspace context set, remove New Chat button, simplify row design (closes #65)`

## Status
**Track:** Full 6-phase
**Current Phase:** 3 (DEVELOP)
**Approval Required:** Yes

## Approval
- [x] Jarmo approved this sprint plan
