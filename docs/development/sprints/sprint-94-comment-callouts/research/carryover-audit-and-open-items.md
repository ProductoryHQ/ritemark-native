# Sprint 94 Carryover Audit + New Open Items

Date: 2026-07-14

This is a code-grounding review (reading the current codebase), not a hands-on runtime audit — that empirical work is Phase 0 in `tasks.md` and must happen before Phase 1 implementation, following the same audit-first discipline the Sprint 72 audit set (`docs/development/sprints/sprint-72-markdown-navigation-annotations/research/comment-callout-audit.md`).

## What Sprint 72's Audit Already Established (still true, re-confirmed by code reading)

- Load/save pipeline: `marked()` (called in `extensions/ritemark/webview/src/components/Editor.tsx`, at least two call sites) → TipTap `setContent` → Turndown (`extensions/ritemark/webview/src/utils/turndownService.ts`) for save/copy.
- `marked` preserves `<!-- -->` as literal text in its HTML output; the DOM `Comment` node this becomes when parsed is invisible to ProseMirror's schema (no tag-selector for a raw DOM comment).
- Turndown drops HTML comments by default — confirmed no override rule currently exists in `turndownService.ts` (only `tableCellWithPipeEscape` and `imageWithRelativePath` rules are registered today).
- Recommended fix shape (parser/load step + input rule + Turndown rule + export filtering) — adopted verbatim in `technical-plan.md`, refined into a `marked` tokenizer extension (see below) rather than a generic "parser/load step."

## Refinement Made During Sprint 94 Planning

Sprint 72's audit left the load-step mechanism unspecified ("parser/load step that converts `<!-- -->` comments into a custom TipTap comment node"). Sprint 94 planning narrows this to a **`marked` custom tokenizer/renderer extension** rather than a regex pre-pass on the raw Markdown string, specifically because:

- A regex pre-pass operating on the raw string can't reliably distinguish a real top-level comment from `<!-- -->`-looking text inside a fenced code block without re-implementing `marked`'s own fence-tracking logic.
- A `marked.use({ extensions: [...] })` tokenizer runs *inside* `marked`'s own tokenization order, so fenced code blocks are already consumed as opaque tokens before the comment tokenizer would see their contents — this is what naturally protects the "comment-like text inside a code block" case (see `scenarios.md`) without extra bookkeeping.

This needs a Phase 0 spike to confirm empirically (see `tasks.md` Phase 0) — `marked` extension APIs vary in exactly how much control a custom block-level tokenizer has over ordering relative to the built-in fence tokenizer; this has not been runtime-tested yet in this planning pass.

## New Fixtures Sprint 94 Must Test (not covered by Sprint 72's audit)

```markdown
<!-- note with a literal end sequence --> inside it -->
```
(Does the literal `-->` inside content prematurely end the HTML comment on save? Sprint 72's audit fixtures did not include this case.)

```markdown
<!-- @claude: fix the tone of this paragraph -->
```
(New in Sprint 94 — the AI-mention variant. Needs its own load/save/render fixture set.)

```markdown
Some text /// not a comment because not at line start
```
(Negative fixture for the `///` shorthand — must NOT convert.)

```markdown
/
```
(Single slash at line start — must still open `SlashCommands`, unaffected by the new `///` rule.)

```markdown
<!-- first -->
<!-- second -->
```
(Two comments with no separating content — do they merge into one callout or stay distinct? Not decided yet; propose "stay distinct," to confirm during Phase 0.)

## Items Requiring a Real Dev-Mode Session (cannot be resolved by reading code)

- `Cmd+/` keybinding capture — whether VS Code's webview shell or the OS intercepts it before the TipTap editor sees it.
- Whether the `marked` tokenizer approach's ordering relative to the fence tokenizer actually behaves as predicted above.
- The exact visual weight of "dimmed" text + left border that doesn't collide with existing blockquote/admonition styling, if any already exists in the editor (needs a screenshot pass, `ux-expert` territory).

## Decision

Not yet made — this is a planning-phase carryover document, not a ship/defer/partial decision. The Phase 0 checklist in `tasks.md` is the gate: if the `marked`-extension spike fails to cleanly solve the load-gap, `technical-plan.md`'s Workstream 1 approach must be revisited (fallback candidate: a raw-string preprocessing pass with a hand-rolled fence-tracker, which Sprint 72's audit implicitly avoided recommending due to complexity) before Phase 1 implementation begins.
