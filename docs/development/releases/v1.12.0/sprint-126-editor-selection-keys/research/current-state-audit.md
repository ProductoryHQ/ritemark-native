# Sprint 126 Phase 0 — where Shift+End's over-selection comes from

**Status:** desk audit 2026-09-22 against `main` at `e9094517`. The hand reproduction below is **Jarmo's**, from a dev build (VS Code OSS shell, Ritemark custom editor, macOS); it was not re-run during this audit — see *Automation limit* for why it could not be.
**Issue:** [#332](https://github.com/ProductoryHQ/ritemark-native/issues/332) (label: bug). The report: `Shift+End` in the TipTap webview editor selects from the caret to the end of the document instead of the end of the current text block. A follow-up Delete then wipes every block below the caret — a data-loss bug. Jarmo hit it by accident and it destroyed an ordered list two blocks away.

## Answer

It is **the browser's native fallback, and nothing above it**. Neither TipTap nor ProseMirror binds `Home`, `End`, `Shift-Home`, or `Shift-End` at all, and Ritemark's own webview adds no handling of its own, so all four keystrokes reach Chrome's default contenteditable behaviour untouched. The observed result is that Chrome extends the selection to the end of the document. That Chrome's macOS editing-command map is the mechanism is an inference from the observed behaviour plus the absence of any binding above it; it was not confirmed against Blink source.

| Layer | What it does today | Verdict |
| --- | --- | --- |
| TipTap core `Keymap` extension | Binds `Mod-a`, and on macOS `Ctrl-a`/`Ctrl-e` → `selectTextblockStart`/`selectTextblockEnd` (`node_modules/@tiptap/core/dist/index.js`, ~lines 4020, 4033–4034). Does not bind `Home`, `End`, `Shift-Home`, or `Shift-End`. | Incomplete — no coverage for the keys that matter |
| ProseMirror `baseKeymap` | `pcBaseKeymap`/`macBaseKeymap` in `prosemirror-commands` bind Enter/Backspace/Delete/`Mod-a` variants only (`dist/index.js`, ~lines 812–848). No `Home`/`End` binding of any kind. | Incomplete — same gap |
| Ritemark webview | A grep for `End`/`Home`/`selectTextblock`/`Shift-` across `extensions/ritemark/webview/src` and `extensions/ritemark/src` returns nothing relevant. The only custom keymap extensions registered are `HeadingLevelShortcuts` (`Mod-Alt-1..6`) and `comment/CommentNode`. | Nothing exists here — this is where the fix belongs |
| Browser (Chrome contenteditable) | All four keystrokes fall through unhandled to Chrome's built-in editing commands. Observed result for `Shift+End`: the selection extends to the end of the document. | **The defect's actual source, and outside our control** — must be intercepted with a ProseMirror keymap binding before it reaches here |

Verified against the installed dependency tree: `@tiptap/core` 2.27.2, `@tiptap/pm` 2.27.2.

## Live reproduction (Jarmo's, 2026-09-22)

Repro document: `# Reopen check` / `Start here.` / a paragraph / an ordered list.

1. Click into the paragraph "Start here.", press `Home` (caret moves to the start of the line), then press `Shift+End`.
   Result: `window.getSelection().toString()` returns the current paragraph plus every following block — the rest of the document, not just "Start here."
2. Control: plain `End` from the same starting position is correct — the caret lands at the paragraph's last character, collapsed (`anchorOffset === 11` for "Start here.").
3. Consequence: pressing Delete right after the over-selecting `Shift+End` wipes every block below the caret. This is how Jarmo destroyed an ordered list two blocks away by accident.

## Where the fix goes

`extensions/ritemark/webview/src/components/Editor.tsx` — the `useEditor({ extensions: [...] })` array, line 337. `HeadingLevelShortcuts` (`extensions/ritemark/webview/src/extensions/HeadingLevelShortcuts.ts`) is the existing precedent for a custom `Extension.create({ addKeyboardShortcuts() {...} })`; it is registered right after `StarterKit`, with a comment explaining that ordering gives it the first chance to dispatch. The new selection-boundary extension should follow the same registration pattern.

## Testing precedent

`webview/src/extensions/orderedListTyping.test.ts` (on branch `sprint-120-editor-input-intent`) builds real ProseMirror state from the editor's own schema via `getSchema(extensions)` — no DOM — and runs with `npx tsx`. `extensions/ritemark/src/editorUndoKeybindings.test.ts` is a second precedent, for a keybinding-manifest-style test. Any new test must be appended to the `test` script in `extensions/ritemark/package.json`.

## Automation limit (record for QA)

CDP/automated key synthesis **cannot reproduce this bug**: a dispatched `Shift+End` arrives at the page with `code: ""` and `which: 0`, so Blink's editing-command mapping never fires and the caret does not move at all. Verified 2026-09-22 in a standalone contenteditable page served over http, in a Chromium 152 / macOS browser pane.

Consequence: the **bug** must be confirmed by hand in a dev build. The **fix** is automatable regardless — a ProseMirror keymap binding matches on `event.key`, which IS present in a synthesized event, so once the binding exists the fixed path can be driven and pinned from automation (as the unit test above will do).

Also record: the webview dev server (`.claude/launch.json` → `webview-vite-dev`, port 5173) renders only "Loading..." standalone — it waits for the VS Code host bridge — so hand validation needs a real dev build (`/rundev`), not the bare Vite server.

## Decision for Jarmo

On a paragraph that wraps onto several visual lines, what should `Shift+End` extend to? This matters because Ritemark's prose column is narrow enough that long paragraphs wrap often — it is not an edge case.

| Option | Behaviour | Cost |
| --- | --- | --- |
| **A. Clamp to the text block (ProseMirror-native)** | Bind `Shift-Home`/`Shift-End` to a command that sets a `TextSelection` from the existing anchor to `$from.start()`/`$from.end()` of the current text block. Pure ProseMirror, no DOM, fully unit-testable in the `orderedListTyping.test.ts` style. | On a wrapped paragraph, `Shift+End` selects to the end of the *whole* paragraph while plain `End` only moves to the end of the visual line — the pair diverges, and on a long paragraph `Shift+End` still over-selects several lines: a smaller version of the same surprise. |
| **B. Mirror the visual line, clamped to the text block (recommended)** | Bind the same keys; let the browser compute the visual-line boundary (`Selection.modify('extend', 'forward'\|'backward', 'lineboundary')`), then clamp the resulting ProseMirror selection so its head can never leave the current text block. Matches every native editor and matches plain `End` exactly. The clamp is a pure function and stays unit-testable; the binding itself needs a dev-build check because it touches the DOM. | DOM-dependent, so one part of it is validated by hand rather than by unit test. Fall back to Option A if `Selection.modify` proves unreliable inside the VS Code webview. |
| C. Also rebind plain `Home`/`End` to the text block | Makes the pair consistent by changing plain `End` too. | Rejected — plain `End` works today and matches the platform; changing it is a regression for wrapped paragraphs and widens the blast radius of a data-loss fix. |

Recommendation: **Option B.** The clamp is what actually kills the data loss and is common to A and B; the visual-line part is what makes `Shift+End` mean "what `End` does, but extending" — which is what a person pressing it intends.

**Flagged, not assumed broken:** `Shift-Mod-Home`/`Shift-Mod-End`. Select-to-document-start/end is the *correct* behaviour for those keys, so they should be left alone unless implementation turns up a break in the other direction. Phase 0 did not exercise these by hand — this is an item to re-check once the fix lands, not a confirmed-working finding, and it is carried into the Definition of Done rather than claimed here.

## What must not regress

- Plain `Home`/`End` — already correct, unaffected by this fix.
- `Shift-Mod-Home`/`Shift-Mod-End` — select to document start/end, which is correct; re-check after the fix (see above).
- `HeadingLevelShortcuts` (`Mod-Alt-1..6`) and `comment/CommentNode`'s custom keymaps — bind unrelated keys, unaffected.
