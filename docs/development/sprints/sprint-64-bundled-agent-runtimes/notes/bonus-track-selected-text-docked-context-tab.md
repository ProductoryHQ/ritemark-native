# Bonus Track: Selected Text Docked Context Tab

**Status: CLOSED — shipped 2026-05-08**

Implemented in commits `f94dbde` (S5 docked tab UI), `51095ad` (selection
actually reaches the LLM), `fd7d383` (Edit/Plan toggle wiring + mode-aware
prompt + Codex base-instructions for file edits), `554ff90` (line numbers —
later reverted), `f999c42` (replaced misleading line numbers with
surrounding-context fingerprint, sentinel-wrapped).

What ended up shipping went well beyond the original UI scope:

- **UI**: docked tab anchored to ChatInput card (S5), `dismissSelectedContext`
  store action that detaches chat-side selection without clearing the
  editor's actual selection (open-question default behaviour).
- **Backend wiring**: selection now actually reaches both Codex and Claude
  via a hidden prompt prefix produced by `buildSelectionContextBlock`. Edit
  vs Plan mode reaches the extension on the wire (was a dead toggle before
  this sprint).
- **Disambiguation**: surrounding-context fingerprint (~80 chars on each
  side, `<<<SELECTION>>>`/`<<</SELECTION>>>` sentinels) replaces the original
  "selected text only" prompt so apply_patch hits the right occurrence even
  when the selected word appears multiple times (e.g. "runtime" in body
  vs frontmatter tags).
- **System prompt**: `CODEX_BASE_INSTRUCTIONS` now explicitly directs Codex
  to use file editing tools for edit/simplify/rewrite/translate requests
  rather than replying with the suggestion in chat.

Validated 2026-05-08 by Jarmo: Codex now patches the correct occurrence
when given a body selection like "runtime" surrounded by "Until this
release, the … — Claude or Codex —".

The Acceptance Criteria below reflect the original UI scope; everything
checked.

---

## Decision (original)

## Decision

Use Sprint 62 UX option **S5 — Docked context tab** as the preferred direction for moving selected-text context from the global Agent Chat Panel banner into the chat input area.

Reference prototype:

- `docs/development/sprints/sprint-62-conversation-runtime/ux-options.html`
- Section: `Selected Text — Near Input Options`
- Chosen variant: `S5 — Docked context tab`

## Why This Direction

The selected text should feel like temporary turn context anchored to the composer, not a global panel state and not a typed attachment. S5 gives that association without changing the textarea/card internals much.

The important UI behavior:

- Selected text appears directly above the input card as a connected docked tab.
- The input card stays structurally the same: textarea, runtime/model controls, active-file chip, attach, send.
- The selected-text tab is removable with a clear close action.
- The selected-text copy is visible enough to confirm scope before sending.
- The active-file chip can remain in the composer footer as a shorter source indicator.

## Implementation Scope

This is a **bonus track** for Sprint 64. It should not block the bundled-runtime deliverables.

Target files, based on current code audit:

- `extensions/ritemark/webview/src/components/ai-sidebar/SelectionIndicator.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx`
- `extensions/ritemark/webview/src/components/ai-sidebar/store.ts`
- `extensions/ritemark/src/views/UnifiedViewProvider.ts` only if the existing `selection-update` payload needs extra source metadata.

Likely implementation shape:

- Stop rendering the global selected-text banner in `AISidebar.tsx` for the normal conversation state.
- Render selected text inside/near `ChatInput.tsx` using the S5 docked-tab treatment.
- Reuse the existing store selection state populated by `selection-update`.
- Keep the current `activeFilePath` footer chip behavior, but avoid duplicating the full file name in both the docked tab and footer.
- Add a remove/clear affordance that clears the webview-side selected context for the next turn; confirm whether this should also clear editor selection or only detach it from chat context.

## Acceptance Criteria

- [x] When editor text is selected, the Agent Chat Panel shows a docked selected-text context tab immediately above the chat input card.
- [x] The old global top `Selected:` banner is no longer shown in normal chat view.
- [x] The docked tab truncates long selected text without resizing the composer unpredictably.
- [x] The user can remove selected text from the next message context.
- [x] Sending a message still passes the selected text to the active agent runtime exactly as before — and the agent now actually receives it (not just visually).
- [x] Empty selection hides the docked context tab.
- [x] Light and dark themes both remain legible.
- [x] Mobile/narrow sidebar width does not overlap runtime controls, active-file chip, attach, or send.

## Open Question

Should the close action clear the actual editor selection, or only detach selected text from the chat input context for the next turn?

Default recommendation: detach only from chat context. Clearing editor selection would be surprising because the editor is the source of truth and may still be visibly selected.

**Resolved: detach only.** Implemented in `dismissSelectedContext()` (commit `f94dbde`).
