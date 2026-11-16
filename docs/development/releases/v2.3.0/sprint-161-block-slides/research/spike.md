# Sprint 161 spike: block slides (17 November 2026)

What could only be learned by trying, before the five PRs. Everything here is throwaway code: the prototypes are in [prototypes/](prototypes/), and none of it is product code.

**How it was run**
- **Headless tests** (`npx tsx`) drive the editor's own Markdown pipeline (`utils/editorMarkdown.ts`, `utils/markdownFidelity.ts`) with domino as the DOM, as the corpus and deck round-trip tests do.
- **The browser harness** ([prototypes/harness/main.tsx](prototypes/harness/main.tsx)) mounts a lean TipTap editor in a 960 × 540 slide frame: the editor's schema (`createEditorSchemaExtensions`), the `:::` prototype, `SlashCommands` and TipTap's `BubbleMenu`. It was bundled with esbuild and injected over CDP into the Markdown editor webview of one hidden-profile dev instance (`scripts/qa/dev-launch-isolated.sh`, isolated profile and AI homes, mock keychain; Electron 39.8.7, Chromium 142). [prototypes/harness/drive2.mjs](prototypes/harness/drive2.mjs) drove it. One launch, quit when done (`LEFT=0`).
  - This worktree has no `vscode/` tree, so the launch used the main checkout's dev build with `RITEMARK_LAUNCH_ANY_BUILD=1`. Its VS Code commit is not the pin, which doesn't matter here: the harness tests the webview's Chromium, not Ritemark's code.
- **To rerun a prototype:** copy `prototypes/*.ts` to `extensions/ritemark/webview/src/spike161/` (their imports are relative to that folder), apply `prototypes/markdownAsWritten-fdiv.diff`, and run `npx tsx webview/src/spike161/<file>` from `extensions/ritemark`.
- Nothing was signed in to, no key was used, nothing was sent anywhere, and no clipboard was read by this spike. No deck or folder of Jarmo's was opened.

## Answers in short
| # | Question | Answer |
| --- | --- | --- |
| 1 | TipTap in the scaled slide frame | Works with `transform: scale`. **Don't use CSS `zoom`.** Append the bubble menu to `document.body`. |
| 2 | Editing model | **Atom plus string body**, with outer changes applied to the stage's editor as a minimal diff. |
| 3 | `:::` round trip | 22 of 22 variants byte for byte, with three pipeline changes. Escape a typed `:::` line. Keep it out of the Text document's pipeline. |
| 4 | One renderer | **Move the host's `marked` to v9.1.6**, and put the one renderer in `src/decks/`. The parity test compares block outlines; it found a real gap on its first run. |
| 5 | Fit | Stepping with hysteresis is stable, and gives the same step at stage and thumbnail size. Re-fit when the fonts finish loading. |
| 6 | Gamma's clipboard | Only HTML, ProseMirror's clipboard form with explicit columns. Mapping by structure works on a synthetic fixture. Pictures are still unchecked. |
| + | Comments instead of notes | A comment in a handout part round-trips byte for byte, the page drops it, and the presenter view can read it from the deck text. |

## 1. TipTap inside the scaled slide frame
The stage scales today with `transform: scale(width / 960)` (`SlideCanvas.tsx`). The harness compared it with CSS `zoom` at the stage's width (698 px) and a thumbnail's (160 px). Results are in [proof/harness-results.json](proof/harness-results.json).

**With `transform: scale`, everything lines up.**
- **The caret:** ProseMirror's `coordsAtPos` matches the drawn character's edge to 0.0 px at three places (a heading, a list item in each column) at the stage's width. At the thumbnail's width the heading's caret matched too; the other two weren't re-measured there. Clicking a character puts the caret back on it (`posAtCoords`).
- **Visual check:** a red marker drawn at `coordsAtPos` sits on the caret ([proof/caret-markers-transform-slash.png](proof/caret-markers-transform-slash.png)).
- **The / menu** opens 8 px under the caret and starts at the caret's left edge. `SlashCommands` appends its popup to `document.body`, outside the scaled frame, so it keeps its real size.
- **IME:** a composition (`Input.imeSetComposition`) shows at the caret while composing, and commits into the right place (`ありがとう`, caret moved by 6).

**With CSS `zoom`, the coordinates are wrong.**
- ProseMirror's coordinates come back in the frame's unzoomed space: off by the zoom factor (0.727 at 698 px). The markers land far from the caret ([proof/caret-markers-zoom-slash.png](proof/caret-markers-zoom-slash.png)).
- So the / menu, the bubble menu and anything else placed from `coordsAtPos` would open in the wrong place. One of three hit tests missed too.
- The ground-truth numbers agree with ProseMirror under zoom only because both are read in the same wrong space. The screenshot is the proof.

**One fix the stage needs: the bubble menu's tippy.**
- TipTap's `BubbleMenu` makes an interactive tippy, and tippy appends an interactive popup to its reference's parent: inside the scaled frame. There it's drawn small and offset by the scale ([proof/bubble-menu-inside-scaled-frame.png](proof/bubble-menu-inside-scaled-frame.png): above "Copilot" while "weekly" is selected).
- With `tippyOptions.appendTo: () => document.body`, it centres on the selection (offset 0.0 px) and sits 10 px above it.
- `FormattingBubbleMenu.tsx` sets no `appendTo` today, so PR 2 passes it on the stage.

**Not measured:** a real person's typing and an OS input method (CDP's composition was used); the selection's drawn highlight under scale (the window had no focus for the DOM selection; it was then emulated); right-to-left text.

## 2. The editing model
Both models were built headless in [prototypes/editingModel.test.ts](prototypes/editingModel.test.ts), on a full slide: a title, a line, two columns of four points, a Steps block and a table.
- **A. Atom plus string body:** the slide stays an atom with its Markdown in `body`. The stage's editor serializes the slide on each change and writes it with `setNodeMarkup`; the outer (handout) editor's history is the undo.
- **B. ProseMirror's footnote pattern:** the slide's blocks are real content of the outer node. The stage's steps are forwarded into the outer document by offset.

| | A | B |
| --- | --- | --- |
| Typing " and short", then one undo | 1 undo step, slide restored, redo restores | same |
| Caret after undo / after redo | where the typing started / after the redone words | same |
| An AI edit (host revision) in the other column while typing | both kept | both kept |
| An AI edit in the same paragraph, before the caret | both kept, caret mapped | both kept, caret mapped |
| Cost per keystroke, full slide | 1.0 ms headless (domino), **0.45–0.52 ms in Chromium 142** (serializing the slide) | ~0.01 ms |
| Re-parse of the slide on an outer change (undo, AI edit) | ~1 ms | none |
| Consumers of `attrs.body` to change | none | all of them (strip, guard, `deckLines`, library, Publish, AI tools) |

**What makes A as good as B:** the stage's editor never reloads its content. Every outer change, an undo or a host revision, is re-parsed and applied as the smallest replacement (`findDiffStart`/`findDiffEnd`, as `lib/documentUpdate.ts` does), so ProseMirror maps the caret. That diff is the same step B's outer→inner update takes.

**Two rules for PR 2:**
- An outer change waits while the stage's editor is composing (`view.composing`), as it would in B.
- The stage's editor ignores the outer change its own write caused.

**An AI edit to the slide the person is typing in** is the host's merge, not the model: `editorSync/merge.ts` treats a fenced block as one block. If both the AI and the person changed the same slide, the person's slide is kept and the AI's goes to Review changes. That holds in both models. Splitting a slide fence into its own blocks for the merge would be a later change.

**Recommendation: A.** B gives no measurable gain here and changes every consumer. A's cost (half a millisecond a key) can be cut later by writing back once per animation frame.

## 3. The `:::` round trip
[prototypes/fencedDiv.ts](prototypes/fencedDiv.ts) is a `marked` v9 block tokenizer, a TipTap node and a Turndown rule. [prototypes/fencedDiv.roundtrip.test.ts](prototypes/fencedDiv.roundtrip.test.ts) runs them through the editor's own pipeline.
- **The tokenizer** scans lines itself. The innermost open closes first, as in Pandoc, so `::: columns` / `::: column` / `:::` / `:::` nests with equal colons. It skips code fences inside and lexes the inside with `blockTokens`.
- **The node** keeps its open and close lines as written, and whether a blank line followed the open line or came before the close line.

**Byte for byte: 22 of 22, and 22 of 22 stable on a second open.**
- **Forms:** Quarto's form with blank lines; tight (no blank lines); the same colon count outside and in; `:::{.columns}` with no space; `{.column width="40%"}`; `{.box icon="…"}`; `{.steps tag="Harjutus"}` and `tag=""`; trailing colons on the open line; single quotes and unquoted values.
- **Content:** a code fence holding `:::` inside a div; a blank line after the open; a paragraph straight before the close; text tight after the close and before the open; three levels of nesting; a list, a picture or a table inside.
- **Text that isn't a div:** an unclosed div and a stray `:::` stay text, and `3:::4` is untouched.
- **Editing:** an edit inside one column changes only those bytes. A column added in the editor writes `::: column` / `:::`.

**It needs three changes to the shared pipeline** ([prototypes/markdownAsWritten-fdiv.diff](prototypes/markdownAsWritten-fdiv.diff) has the second):
1. **The as-written pass must reach a container's children.** `annotateAsWritten` walks only the top level, lists and quotes; without it, a heading and its text inside a column get a blank line between them. The prototype calls it from the tokenizer; PR 1 makes `walkBlocks` recurse.
2. **A fence line is "tight" with its neighbour.** `writtenTight` returns false for an unknown block; a container (`fdiv`) has to count as one that never merges with the block beside it. Without it, a blank line appears before `:::: columns` under a heading, and between two `::: column`s.
3. **Scope.** The tokenizer and rules must live in the slide editor's own `marked` and Turndown instances. Registered on the document editor's `editorMarked`, every Text document with a `:::` line would change; `ensureCommentMarkedPipeline` is the precedent for scoping.

**What isn't safe yet:**
- **A typed line that looks like a fence.** Typed paragraphs `::: columns` … `:::` saved as written reopen as a fence. A typed `:::` paragraph inside a column closes the column on the next open. The slide's Turndown must escape a line that starts with `:::` as `\:::`, which CommonMark reads as `:::`. This escape belongs to the slide's Turndown only; in the Text document it would change files.
- **A div opening right under a paragraph line** (`Text\n::: column`). Pandoc requires a blank line there. The prototype's `start()` lets a fence line interrupt a paragraph, and it round-trips. PR 1 decides whether to keep it or follow Pandoc.
- **Attributes beyond the subset** (`{#id .a key=v}`) are read but not edited. Changing a box's icon rewrites the open line in canonical form (`::: {.box icon="x"}`) with its colon count kept.

## 4. One renderer
**Host on v9.** The host's `marked` was swapped to 9.1.6 in this worktree (`npm i --no-save`, then restored):
- `tsc --noEmit` shows four errors, all in `publicDeck.ts`: `marked.Tokenizer`, `marked.TokenizerThis` and `marked.Token` used as types. v9 exports them as top-level types (`Tokenizer`, `Tokens`, `Token`).
- `pageHtml.test.ts`, `publicDeck.test.ts` and `pageFile.test.ts` pass unchanged on v9, with no deprecation warnings: the options already turn `headerIds` and `mangle` off.
- `out/extension.js` goes from 6,651,006 to 6,646,879 bytes. `marked` is inlined, so an extension release carries it.
- The page's CSP allows `style-src 'unsafe-inline'`, so a `--fit` style on a slide is fine there. The editor webview's CSP allows it too. The renderer runs no script, so `script-src` doesn't matter to it.

**Recommendation:** move the host's `marked` to v9.1.6 in PR 1, and put the one slide renderer in `src/decks/` (a scoped `new Marked({ gfm: true, breaks: true })` with the `:::` tokenizer).
- The webview already imports `src/decks/` modules.
- A bare `marked` import there resolves to the extension's `node_modules`, so the webview bundle would get a second copy. Vite's `resolve.dedupe: ['marked']` should keep one (not tried; PR 1 checks the bundle).
- Importing the webview's module from the host also resolves (esbuild resolves from the file's folder), but it ties the host build to `webview/node_modules` and is the worse choice.
- `breaks` must be the same for the slide on both sides: today the page uses `breaks: false` for the handout. The slide renderer's options are its own.

**The parity test** ([prototypes/slideRenderer.parity.test.ts](prototypes/slideRenderer.parity.test.ts)):
- It compares a block outline (depth, kind, text) of the static renderer's HTML with the stage editor's document for the same Markdown.
- 6 of 7 slides matched on the first run. The one that didn't is a real gap: a picture alone in a paragraph is unwrapped by the editor (`preprocessImageHTML`) and not by the static renderer. PR 1's renderer unwraps it the same way.
- PR 1 runs it on the fixtures and the demo project's converted decks.

## 5. Fit
In the harness, the slide's type is `calc(var(--fit) * 26px)`, stepped through 100/92/84/76/68/60 %. A step down happens when the content overflows; a step up only when the bigger step leaves 3 % of the height free.
- **Stage and thumbnail agree.** With paragraphs added one at a time, the steps were `000013444` at 698 px and at 160 px, with `transform` and with `zoom`. Layout happens in the 960 × 540 space, so scale doesn't change the step.
- **No oscillation.** Typing four words at a time up to 60 and back, the step goes `0000001111222223` and back `3222221111000000`, never back and forth. Re-running the fit from its own answer never changed it.
- **Fonts matter.** The same nine paragraphs fit at `000013333` in Sofia Sans and `000013444` in the fallback font. Sofia Sans is `font-display: swap`, so a slide measured before the font loads can end a step too small. Re-fit on `document.fonts` `loadingdone` (and after `document.fonts.ready` on open); the strip and the wall need the same.

**Not measured:** the wall and the page's own fit (the page gets `data-step` at Publish, as today); pictures taking the remaining height.

## 6. Gamma's clipboard
**The capture.** Jarmo copied a two-column card on 17 November and the Development manager dumped the clipboard. This spike didn't read any clipboard; it used the manager's capture for its structure only.
- **Only HTML:** `«class HTML»` (about 3 KB) and a plain text of 3 bytes. No RTF and no Gamma type, so the webview's `text/html` paste is enough, and no Electron clipboard read is needed (no shell tier).
- **The structure:** ProseMirror clipboard HTML.
  - `div.card-layout-item[data-pm-slice]`, then `h1` (the card's title)
  - `div.columns[data-colwidths="[50,50]"]` > `div.column`, each holding an `h2` wrapped in `<b>` and `p.paragraph[data-font-size]` paragraphs
  - a `<br>` between two bold runs in one heading, and bold runs inside text
- **What's private in it:** `data-pm-slice` holds Gamma's document settings, its doc, card and interaction ids, and the locale. It never reaches the file.
- **No `<img>`** in that copy, though the card may have had a picture. A second copy with a picture selected is needed before PR 4 settles the download.

**The mapping, by structure** ([prototypes/gammaPaste.test.ts](prototypes/gammaPaste.test.ts), on a synthetic fixture: the same structure with made-up text and dummy ids):
- `div.columns` > `div.column`, or any container whose two or more children each open with a heading → Columns.
- The card's first heading → the slide's title (`#`). A heading inside a column → that column's `###`.
- `<b>` inside a heading is dropped, and `<br>` there is one space. `<b>`/`<i>` in text stay bold and italic. `p` → a paragraph; lists → lists.
- Classes, `data-font-size`, `data-colwidths` (beyond the count) and the pm-slice JSON are ignored.
- **The result** opens as two columns in the slide editor and saves byte for byte. The same HTML with every class removed maps to the same Markdown, so the rule doesn't depend on Gamma's class names.
- **A picture** becomes a placeholder for the host's download (`deck/fetch-image`); its remote address is never kept.

**[dump-clipboard.sh](dump-clipboard.sh)** saves every flavour on a macOS pasteboard into a folder: each type's raw bytes, a `types.txt` index, readable copies of `public.html`, `public.rtf` and plain text, and AppleScript's `«class HTML»` read. It was tested only on a named pasteboard holding synthetic text (`--pasteboard`). It's for the Development manager to run on the second copy, after Jarmo copies.

**Still open for PR 4:** whether Gamma's pictures download without cookies or a sign-in (likely `cdn.gamma.app`, possibly signed and expiring); what other card layouts (boxes, smart layouts, numbered steps) put on the clipboard.

## Comments instead of notes (Jarmo, 17 November)
[prototypes/comments.test.ts](prototypes/comments.test.ts) checks the decision on a v1 deck with comments in its parts.

**The notation is Ritemark's existing comment** (Sprint 94, #81; tasks in Sprint 117), behind the `comment-callouts` flag, on by default:
- a standalone note is `<!-- … -->` on its own lines (typed with `///`), with an optional `{id:<uuid>}`;
- an anchored comment is `<mark data-comment="…">words</mark>`.
- **The code:** load is `extensions/comment/commentMarkedExtension.ts`; save is `commentTurndownRules.ts`; the nodes are `CommentNode.ts` and `CommentMark.ts`; the margin is `MarginCommentRail.tsx`; the tasks are `src/commentTasks/`.
- The deck view already passes `commentCallouts` to the handout's editor (`DeckView.tsx:1150`), so comments work in a deck's handout today.

**What the test shows:**
- **Byte for byte.** A deck with a standalone comment, one with an id over two lines, an anchored comment and an `@claude` comment opens and saves byte for byte through the deck editor (`DeckSlide` and comment callouts).
- **The page drops them.** No comment body, `<!--` or `data-comment` reaches `publicDeck`'s output; the anchored words stay.
- **The presenter view can read them.** A small host reader takes a part's text (`parseDeck` gives each part's range), lexes it with `lexHandout`, skips code, and returns the comments in order. It gives one on slide 1, and three on slide 2 (a note, an anchored comment with its words, an `@claude` note). A comment inside a prompt (a code fence) is the prompt's text, not a comment. It replaces `PresenterState.notes` with a list.
- **The conversion's comment** (old notes plus hidden words, "Hidden by the old layout: …") round-trips and stays off the page. A `-->` inside old notes would end the comment early, so the converter neutralises it (`--›`); the comment model already refuses `-->` when one is typed.

**What it costs:**
- **The presenter view:** the reader on the host (about 30 lines), the protocol field, and the "Your comments" panel with its empty line.
- **Publish's "What stays" line:** a count of the parts with comments.
- **The conversion:** writing the comment.
- **Removing the notes:** the Stage's fold, `notes` in `deckSchema.ts` and `writeSlideBlock`, and the presenter's "Your notes". The `notes` attribute is still read, to convert old decks.
- **Comment tasks** come for free. An `@claude` comment in a part can be sent as a task, as in any document. Nothing new is needed; it's worth a look from the Experience lead in the presenter view.

## What changes the five-PR cut or the tiers
- **The tiers stay:** everything is extension tier. Gamma's content is plain `text/html`, so no Electron clipboard read and no shell tier.
- **PR 1 grows.** It moves the host's `marked` to v9 (four type fixes), adds the as-written recursion and the `fdiv` tightness (scoped, so the Text document's fidelity corpus must stay byte for byte), reads the part's comments for the presenter view, and builds the parity test. It stays High.
- **PR 2 gains** the minimal-diff sync and the composing guard. It appends the bubble menu to `document.body`, escapes `:::` in the slide's Turndown, writes the conversion's comment, and removes the Speaker notes fold.
- **PR 5 also removes** the `notes` attribute's writer, keeping its reader for conversion.
- **PR 4 waits** for a second Gamma copy with a picture.

## Not verified
- **Jarmo's own decks were not scanned.** The plan's read-only scan of slides per kind, "1. " items, hidden words and changed library copies wasn't part of this brief; it's still to do with his yes.
- **Gamma pictures:** no copy with a picture yet, and no download tried (no network was used).
- **The harness ran in the Markdown editor's webview** with its own frame CSS, not in the deck view's real stage, and on a dev build whose VS Code commit isn't the pin.
- **IME** was CDP's synthetic composition, not a real input method. A real person typing wasn't tried.
- **The bubble menu's look on the stage:** only its numbers. The harness's overlay sat above tippy's layer in the screenshots.
- **Vite `dedupe` for `marked`**, and the webview bundle's size with the shared renderer.
- **The fit on the wall, the presenter view and the page,** and with pictures.
- **Windows.**
