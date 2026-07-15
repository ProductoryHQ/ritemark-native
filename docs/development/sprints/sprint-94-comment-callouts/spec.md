# Sprint 94 Spec

## Purpose

Let writers leave private, editor-only notes in a Markdown document — as a styled callout, not raw `<!-- -->` syntax — that survive save/copy round-trips and never leak into exported output. Extend the same callout so a note can be directly assigned to an AI agent, turning "I should ask Claude to fix this paragraph" into a one-click action instead of a context switch.

This spec is the source of truth for Sprint 94 implementation. If implementation reveals the spec is wrong, update the spec before changing code.

**Provenance note:** this spec was drafted from GitHub issue #81's text as summarized in the sprint-kickoff task brief; the planning session did not have live `gh` CLI access to fetch the issue directly. Re-verify against `gh issue view 81 --repo ProductoryHQ/ritemark-native` before Phase 2 approval closes.

**UI contract (authoritative):** the user experience is defined by [`ui-mock.html`](ui-mock.html) — a **margin-anchored** comment model (select → toolbar "Comment" → right-margin bubble → soft-yellow highlight + gutter marker; plus a `///` line-start quick note), NOT the inline-callout rendering the first draft assumed. "Take UI as requirements" (Jarmo, 2026-07-14). The R-numbered behaviour below still holds; where wording implies an inline callout, the mock's margin rendering governs. See `technical-plan.md` Revision 2 for how storage maps to this UI.

## Principles

- Preserve Markdown portability: comments stay standard `<!-- -->` HTML comments in the saved file, editable in any other Markdown tool — no proprietary syntax survives to disk.
- No silent data loss: every editor-visible comment must round-trip through save and copy-as-Markdown. This is the exact failure Sprint 72's audit found and is the reason #81 was deferred — see `research/` in this sprint folder and `docs/development/sprints/sprint-72-markdown-navigation-annotations/research/comment-callout-audit.md`.
- Comments are always private: never appear in PDF, Word, or any rendered/exported HTML output, including export paths added after this sprint.
- Reuse existing plumbing for the AI-assign action — no new webview↔host message type, no `AgentRuntime` interface change, no fourth runtime.
- Follow existing UI patterns: shadcn/ui components (`ui/button`, dialog primitives if any modal is needed), no custom HTML/CSS.
- Ship behind a kill-switch flag given the round-trip risk this exact feature already caused one deferred sprint.

## Requirements

### R1: Comment Load Parsing

As a writer opening a document that contains `<!-- note -->`, I want it to appear as a callout, not raw syntax or missing text, so my existing notes aren't silently lost when I open a file Sprint 94 didn't exist for.

Acceptance criteria:

- A custom `marked` extension recognizes HTML comment syntax (`<!-- ... -->`) as its own token — not left to `marked`'s default HTML pass-through, and not confused with comment-like text inside a fenced code block (a code block containing the literal text `<!-- not a comment -->` renders as code, unchanged).
- The custom token renders to HTML markup that TipTap's schema parses into a comment-callout node (ProseMirror cannot select raw DOM comment nodes — see `research/`).
- A comment at the very start of a document, the very end, and immediately adjacent to another comment all load correctly.
- Loading a document with the `comment-callouts` flag disabled falls back to prior (Sprint 72 audit) behavior — comments are dropped, matching what shipped before this sprint. No crash, no partial content corruption.

### R2: Comment Save Serialization

As a writer, I want my comment callout to save back to disk as a standard `<!-- -->` comment, so the file stays plain Markdown outside Ritemark too.

Acceptance criteria:

- A Turndown rule in `turndownService.ts` serializes the comment-callout node back to `<!-- <content> -->`.
- Round-trip is content-stable: load → save → load produces the same comment content (whitespace normalization is acceptable and must be documented; content mutation is not).
- A comment body containing the literal sequence `-->` is escaped or rejected in a way that cannot produce a malformed, prematurely-terminated HTML comment on save. (Flagged as a required audit fixture — Sprint 72's audit did not test this case.)
- Copy-as-Markdown (not just Save) goes through the same Turndown path and therefore round-trips identically.

### R3: Styled Callout Rendering

As a writer, I want a comment to look visually distinct from body text, so I can tell at a glance what's a private note versus published content.

Acceptance criteria:

- A comment renders as a block-level callout: dimmed text color, a colored left border, and a comment icon.
- The callout is visually distinct from existing callout-like UI (blockquotes, admonitions) already in the editor, if any exist.
- The callout does not visually resemble an error/warning state (color choice avoids red/amber already used for other UI).

### R4: `///` Line-Start Shorthand

As a writer, I want to type `/// quick note` without reaching for a menu, so leaving a comment is as fast as writing text.

Acceptance criteria:

- Typing `///` followed by a space at the start of a line (paragraph start) converts the line into a comment-callout node, live, as an input rule.
- The shorthand does not fire mid-line, only at a genuine line/paragraph start.
- The shorthand does not collide with the existing single-`/` `SlashCommands` popup — typing `/` alone still opens the command menu; typing `///` does not also trigger it.
- On save, a shorthand-created comment serializes as a standard `<!-- -->` comment (per R2) — `///` never appears in the saved Markdown file. The shorthand is input-only sugar.

### R5: `Cmd+/` Selection Toggle

As a writer with text already written, I want to select it and press `Cmd+/` to turn it into a comment (and back), so I don't have to retype it.

Acceptance criteria:

- With a non-empty selection, `Cmd+/` (macOS) / the platform-appropriate equivalent wraps the selection in a comment-callout node.
- Pressing `Cmd+/` again with the cursor inside/selecting an existing comment-callout unwraps it back to plain text.
- The operation is undoable in one step.
- Windows/Linux keybinding behavior is documented during implementation; if a platform conflict blocks reliable capture, the limitation is documented and the callout's manual actions (if any UI affordance exists) remain the fallback.

### R6: Multi-Line Comments

As a writer, I want a comment that spans several lines or a full paragraph, so I'm not limited to one-line notes.

Acceptance criteria:

- A comment-callout node can contain multiple lines/paragraphs of plain text.
- Multi-line comments round-trip through load/save identically to single-line ones (R1/R2).
- The `Cmd+/` toggle (R5) works on a multi-paragraph selection.

### R7: Export Filtering

As a writer, I want my private comments to never appear in a PDF, a Word doc, or any rendered output I share, so a comment callout is safe to write freely.

Acceptance criteria:

- Comment-callout nodes are stripped before PDF export.
- Comment-callout nodes are stripped before Word export.
- Comment-callout nodes are stripped from any other rendered/exported HTML path that consumes editor content (e.g. "copy as rendered HTML" if it exists).
- Filtering happens at a single chokepoint reused by all export paths (matching the Sprint 90 `imageSource.ts` pattern — one place, not per-exporter duplication) so a future export path inherits the filter by construction, not by remembering to add it.
- A document containing a comment, exported to PDF and Word, is manually verified to contain zero trace of the comment content.

### R8: AI Mention Syntax + Assigned Callout

As a writer, I want to write `<!-- @claude: fix the tone of this paragraph -->` and see it rendered as a distinct "assigned" callout, so I can flag work for an agent without leaving the document.

Acceptance criteria:

- A comment whose content matches `@<agent-alias>: <text>` at the start of the comment body renders as an "assigned" callout variant — same base styling as R3 plus an agent badge.
- Recognized aliases map to the existing `AgentId` union (`claude-code` | `codex` | `opencode`): `@claude` → `claude-code`, `@codex` → `codex`, `@opencode` → `opencode`. (Exact alias strings are a Product Decision to confirm — see Open Questions.)
- An unrecognized alias (e.g. `@gpt: ...`) renders as a **plain** comment callout (R3), not an assigned one, and does not error.
- The mention syntax round-trips through save (R2) — `<!-- @claude: ... -->` is preserved exactly, including the alias.
- Typing `@` while the cursor is inside a comment-callout node does not open the existing `FileLinkSuggestions` file-search popup (Sprint 72 R1) — the two `@`-triggers must not collide.

### R9: Send to AI Action

As a writer with an assigned comment, I want a "Send to AI" action that hands the note to the AI sidebar with the surrounding document as context, so the agent has what it needs without me re-explaining.

Acceptance criteria:

- The assigned callout (R8) exposes a "Send to AI" action (shadcn `Button`).
- Activating it sends the comment's instruction text plus surrounding document context to the AI sidebar for the mapped agent, via the **existing** `agent-execute` webview message and the existing selection-context-block pattern (`buildSelectionContextBlock` in `webview/src/components/ai-sidebar/store.ts`) — no new message type, no new `AgentRuntime` method.
- If the AI sidebar panel is not currently visible, activating "Send to AI" opens/focuses it.
- The action targets the specific agent named in the mention (R8), not whichever agent is currently selected in the sidebar, if those can differ. (Confirm exact behavior during Phase 3 against the current sidebar's agent-selection model.)

### R10: Resolve Action

As a writer, I want to dismiss a comment once it's handled, so my document doesn't accumulate stale notes.

Acceptance criteria:

- The callout (both plain and assigned variants) exposes a "Resolve" action (shadcn `Button`).
- Activating it removes the comment-callout node from the document entirely.
- The removal is undoable in one step.
- Resolve does not require the comment to have been sent to AI first — works on any comment.

### R11: Feature Flag Kill-Switch

As Jarmo, I want to be able to turn this feature off instantly if the round-trip logic proves fragile in the field, so a parser bug doesn't corrupt users' files.

Acceptance criteria:

- A new flag `comment-callouts` is added to `extensions/ritemark/src/features/flags.ts`, status `stable` (default ON — see feature-flags skill "Default ON, gate OFF for kill-switch"; the flag exists as an emergency disable, not an opt-in, since there is currently no Settings UI for toggling experimental flags per project memory).
- All platforms (`darwin`, `win32`, `linux`).
- With the flag off, the editor behaves exactly as it did before Sprint 94 (R1's fallback behavior).
- Turning the flag off does not corrupt already-saved comment syntax in files — it only affects rendering/parsing in the editor session.

## Non-Requirements

- No threaded comments, replies, or multi-user collaboration metadata.
- No rich nested formatting (bold/italic/links/lists) inside a comment body in this sprint — comment content is plain text. This is a scope-reduction decision from the Sprint 72 audit fixture (which included `**markdown-ish** text` in a comment) — flagged as an Open Question below for explicit confirmation before Phase 3, since choosing rich content instead is a materially larger TipTap schema (nested content node vs. a plain-text/attribute-based node).
- No automatic Resolve when the assigned agent finishes its turn — Resolve stays a manual action.
- No change to the `AgentRuntime` interface, no new webview↔host message type, no new runtime.
- No backlinks, graph view, or AI-generated comment suggestions.

## Resolved Questions

- **Comment storage format:** standard HTML comments (`<!-- -->`), per the existing GitHub issue #81 title and the Sprint 72 audit's recommendation — not a custom fenced-block syntax.
- **`///` shorthand fate on save:** canonicalized to `<!-- -->`. `///` is input-only sugar and never appears in a saved file.
- **Agent ID source of truth for mentions:** the existing `AgentId` union in `extensions/ritemark/src/agent/types.ts` (`'claude-code' | 'codex' | 'opencode'`), not a new enum.
- **Send to AI transport:** the existing `agent-execute` webview message and `buildSelectionContextBlock`-style context assembly. No new message type — confirmed against `docs/development/architecture.md`'s Webview ↔ Extension Protocol and the Sprint Architecture Gate (a new message type would trigger the gate; reuse avoids it).

## Open Questions

Product decisions Jarmo should confirm before or during Phase 2 approval — implementation should not proceed past these without an answer:

1. **Rich content inside comments?** MVP proposes plain-text only (see Non-Requirements). If Jarmo wants the Sprint 72 audit's `**bold**`-inside-a-comment case to actually render as formatted text, the TipTap node needs to be a content-bearing node (nested inline marks) rather than a plain-text/atom node — larger scope, larger Turndown-serialization surface. Confirm before Phase 3.
2. **Mention alias strings.** Is `@claude` / `@codex` / `@opencode` the right set, or should aliases match something more visible to users (e.g. `@claude-code`)? Does the mention need to be case-insensitive?
3. **"Send to AI" targeting when sidebar's selected agent differs from the mention.** Does the action force-switch the sidebar's active agent to the mentioned one, or refuse/warn if they differ?
4. **Does Resolve need an undo toast/confirmation**, or is TipTap's standard undo (`Cmd+Z`) sufficient? (Proposed: standard undo is sufficient, no new UI.)
5. **Flag status: `stable` (default ON) vs `experimental`.** Given there's no Settings UI to toggle experimental flags (project memory: "Feature flag UI removed from Settings"), an `experimental` flag would ship permanently off with no user path to enable it. R11 proposes `stable` (default ON, kill-switch by code edit only). Confirm this matches Jarmo's risk tolerance for a first-ship parser feature.
6. **Live issue #81 re-verification.** This spec was drafted from a task-brief summary of issue #81, not a live fetch (no `gh` CLI access in this planning session). Confirm the spec matches the actual issue text, especially the "Extension — assign comments to an AI agent" section added 2026-07-14.
