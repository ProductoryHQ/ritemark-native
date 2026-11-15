# Sprint 157: Decks, first cut — technical plan

Written on 15 November 2026 from a read-only study of the code. No repo file was changed and nothing was launched. Line numbers are as of `main` at `cb99ddca`. "Not verified" marks what no one has run yet. The sprint plan ([sprint-plan.md](sprint-plan.md)) records which open questions are decided and who answers the rest.

Three findings set the shape:

1. **The deck opens in Ritemark's own Markdown editor (`ritemark.editor`), as a mode, not as a new editor.** VS Code's save-conflict and reload-merge hand-off (patch 014) covers only `ritemark.editor`. A second editor would lose it, or need a patch change.
2. **A Slide library place in the row needs a `branding/product.json` change** (shell-tier by path), but no patch change on the branch.
3. **The deck view shares `media/webview.js`.** A third bundle would carry a second copy of the editor and touch shell-tier build scripts.

## 1. Architecture placement

### 1.1 The deck is a mode of `ritemark.editor`

The deck is a path-based mode of `RitemarkEditorProvider`, like card mode and agent mode. `taskBoard/cardPages.ts:16-17` states the rule: "a path-based mode in the one Markdown editor, not a second editor".

- **Save safety.** `patches/vscode/014-ritemark-save-receipts.patch:146,158,167` hands save conflicts and the reload merge to Ritemark only when `editorIds.includes('ritemark.editor')`. A new viewType such as `ritemark.deckEditor` would lose both protections unless patch 014 changed.
- **Editor selection.** `package.json`'s `customEditors` already claims `*.md` for `ritemark.editor` at `default` priority. A second `*.deck.md` editor would compete for the same files, and a static contribution can't be gated by a flag.
- **The switch.** `deckModeFor(document)` is true only when the flag `decks` is on, the scheme is `file`, the name ends `.deck.md`, and the front matter has `deck` absent or at most 1.
- **Without the flag** nothing changes: the file opens as a document. A slide fence is a code block. `markdownAsWritten.ts:292-303` keeps `data-md-info="slide boxes"`, and `:988-1009` writes it back.
- **What comes for free:** sync, save receipts, conflicts and the writer's-copy merge. That merge (`architecture.md:124`) keeps a fenced block whole, so one slide block is one merge unit.

### 1.2 The whole deck is one editor document

The handout column is the existing `<Editor>` holding the whole deck file. Each slide block is an atom node, in the equation block's pattern: data in attributes, with its own reader and writer (`extensions/math/mathNodes.ts:153-247`, `mathTurndownRules.ts:195-203`).

- **Load.** No `marked` change is needed (`editorMarkdown.ts:64-85` stays). A fence already arrives as `<pre data-md-info="slide <kind>">`. The `deckSlide` node's parse rule (`pre[data-md-info^="slide "]`, at a priority above the code block) takes the kind from the info string and the raw body from the code text.
- **Notes.** A `notes` fence directly after a slide fence is folded into that slide node's `notes` attribute. A parse rule with `ignore` should do it (not verified); a hidden `deckNotes` atom is the fallback. A `notes` fence anywhere else stays an ordinary code block in the handout.
- **Save.** A Turndown rule writes the slide fence (and its notes fence) from the attributes, not from text, as `mathElementSource` does (`mathTurndownRules.ts:46-49`: Turndown collapses whitespace in text). The fence is sized past any backticks in the body (`markdownAsWritten.ts:1005-1007`).
- **What this gives.** Stage edits, reorder, insert and delete are transactions in the same editor, so there is one undo history and one `document:edit` path. Find, comments, dictation and `@`-links work in the handout as they do today.
- **The strip and the stage** are drawn from `editor.state.doc`, the slide nodes in order. A part is a slide node plus the blocks up to the next slide node. Content before the first slide is a preamble at the top of the handout, kept as written.

### 1.3 One format module for the host and the webview

`src/decks/deckFormat.ts` is pure, with no imports, like `taskBoard/cardTypes.ts`. The webview imports it through `../../src/...`, as it already does for `editorSync/protocol.ts` (`App.tsx:53`). Tools, the library, the editor's node and the tests all use the same parser and writer.

### 1.4 The host side, in the task board's pattern

`src/decks/` holds:

- `DeckLibrary`, with no `vscode` import and an injected file system: list decks and topics, read decks, insert copies, update the library, add to the library, and report source states.
- `deckDocuments`, which reads and writes a deck through its open `TextDocument`, as `BoardStore`'s `CardDocuments` does (`architecture.md:488,518`).
- `deckPages`, the editor's host side.
- `SlideLibraryViewProvider`, the left-column view.
- `decksHost`, which composes them.

The UI and the tools call the same `DeckLibrary` operations (decision 9, dual use, as the board does).

### 1.5 The deck file (to confirm with the Experience lead)

````
---
deck: 1
theme: Slide library/Themes/Ritemark.theme.md
---

```slide boxes
id: b7k2
title: Assistant or agent?
look: steps
picture: right
image: images/agent.png
from: Slide library/AI assistants.deck.md#a7c2 @k3f9z1
items:
- heading: Ask
  text: One question, one answer
  icon: chat
```

```notes
Ask who has used an agent.
```

Handout Markdown up to the next slide block…
````

- **The slide block's body is a strict YAML subset, so any AI reads it.**
  - One `key: value` per line; `items:` is a list of mappings; `rows:` is a list of flow lists.
  - Values stay on one line, double-quoted with YAML escapes when needed.
  - The reader keeps unknown keys and lines as written. The writer rewrites only the lines whose value changed, so an untouched slide saves byte for byte.
  - A test checks that every body the writer emits parses with the host's `js-yaml` 3.15.1 to the same data.
- `skip: true` skips the slide. `kept: true` is written by Keep it here.
- **The `from:` line** is `<project-relative path>#<source id> @<stamp>`. The stamp is a short FNV-1a hash of the slide's words, kind, look and picture, with `image` resolved to a project-relative path. It is the same in the host and the webview, and stays right when an AI or the person edits a library deck by hand. The states, as the prototype's `underLines` (`prototype.html:1097-1112`):
  - the copy's hash differs from the stamp: "Changed in this deck";
  - the source's hash differs from the stamp and the copy is unchanged: "The library has a newer version", with Use it;
  - the source is not found: a quiet "missing" line;
  - a `from:` pointing at a deck outside the library reads "From <deck>", with no update actions.
- **Ids** are 4 characters, base36, unique within the deck. A duplicate id from a paste gets a new one (the guard, section 5).
- **As built in PR 4 (two changes from this plan, accepted by the Development manager on 15 November):**
  1. **The host reads the copy; the view doesn't write it out part by part.** One part's Markdown, serialised on its own in the webview, can differ from what the file holds, and a fresh copy would then read as changed. So the host reads a copy's state from the deck's document. Update the library, Use it and Add to library send the slide's id and the deck's whole text as the view holds it, written by the same writer that writes the file. The host reads the slide from that text by id, so the newest words count even before they reach the document.
  2. **The stamp leaves out formatting-only differences in the handout:** list markers, emphasis marks at a word's edge, escapes, heading marks and ordered-list numbers. A `_` or `*` inside a word still counts (`foldMarkdown` in `deckLibraryFormat.ts`).
  - Also as built: a `from:` that names no `.deck.md` inside the project is no source, so nothing reads or writes it. The AI's tools change an open deck only through its view, and count a change done only once the document holds it.

### 1.6 The theme: one, not editable

- `src/decks/deckTheme.ts` reads `.theme.md` front matter in the README's Themes format, and holds the built-in theme's text as a constant. A constant ships in `out/extension.js` and `webview.js`; a file under `media/` would ship only with a shell release (CLAUDE.md, release tiers).
- A deck whose `theme:` file is missing draws the built-in theme. Reading a deck never writes a file. New → Deck, or the first Add to library, writes `Slide library/Themes/<name>.theme.md` by exclusive create.
- `themeVars` is ported from `prototype.html:771-792`, with both the card and the borderless branch.
- Fonts: Sofia Sans, already shipped in `media/fonts/`. No new font.
- A `.theme.md` opens as a document. There is no theme tab in this cut.

### 1.7 Fitting

`webview/src/components/decks/slide/layoutSlide.ts` is a pure layout function. It ports the prototype's tier tables: `fitSize` and `linesOf` (`prototype.html:880-882`), `BOTTOM = 504`, each kind's branch in `slideHTML` (`:884-956`), and `convert` and `hiddenNote` (`:1489-1503`). It returns boxes on a fixed 960×540 canvas that `SlideCanvas.tsx` draws, scaled. A measuring pass after drawing steps one tier smaller if any box still overflows, which covers real font metrics. The same pure layout is what a later Publish writes as static HTML.

### 1.8 The scroll rule

`scrollRule.ts` is pure. Its inputs are the part tops, `scrollTop`, `clientHeight`, `scrollHeight` and the part being written in. Its output is the current part:

- the part being written in wins;
- else the part starting at the top (within 26 px);
- else the part crossing the line a quarter down (the prototype uses .28, `onHandScroll` at `:1263-1273`);
- the first part when scrolled to the top, the last at the end.

After a thumbnail click scrolls the handout, a 500 ms lock holds the slide, like the prototype's `syncLock`.

### 1.9 The bundle

Share `media/webview.js` (8,875,941 bytes today). The deck view adds no large dependency: React, the existing TipTap, and about 24 Phosphor icons, which the webview already uses (`webview/package.json:16`). A third bundle would touch `build-prod.sh` (shell-tier), the extension release's file list (`webview.js` and `office-preview.js` only) and the pre-commit checks (`pre-commit-validator.sh:35-60,76-78`), and the deck view needs `App.tsx`'s sync state anyway. The committed `webview.js` conflicts on every main merge either way; section 7 gives the recipe.

## 2. Files

### New

Host, `extensions/ritemark/src/decks/`:

- `deckFormat.ts` (pure): `parseDeck`, `writeSlideBlock`, `parseSlideBody` / `writeSlideBody` (line-preserving), `parseFrom`, `slideStamp`, `replaceSlideBlock(text, id, block)` (splices one block and keeps every other byte), `newId`, `rebaseRelativePaths(md, fromDir, toDir)`.
- `deckTheme.ts` (pure): the theme reader and the built-in theme's text.
- `deckProtocol.ts`: the exact-field `deck/*` request union and its decoder.
- `DeckLibrary.ts` (no `vscode`): `listDecks`, `listTopics`, `readDeck`, `insertSlides`, `updateLibrarySlide`, `addToLibrary`, `sourceStates`.
- `deckDocuments.ts`: the `vscode` adapter, through the open `TextDocument` (a `WorkspaceEdit`, saved if it was clean) or an atomic file write.
- `deckPages.ts`: `deckModeFor`, `connect(document, webview)`, the `deck/*` routing (theme, asset URIs, source states, insert, update the library, Use it, Keep it here, picture save) and the active deck for the library's "Insert after slide N". The picture save reuses `parseImageDataUrl` / `writeImageRelativeTo` (`utils/imageWriter.ts:35,54`) and `ensureProjectSubfolder` (`projects/projectFolderGuard.ts:74`), so `ritemarkEditor.ts`'s `saveImage` (`:1369`) stays untouched.
- `SlideLibraryViewProvider.ts`: the view `ritemark.slideLibraryView` in the shared bundle (`data-editor-type="slide-library"`), with a head row like `TasksViewProvider.ts`.
- `newDeck.ts` (PR 6), `decksHost.ts` (`registerDecks(context)`), `media/slide-library-icon.svg`.

Webview, `webview/src/components/decks/`:

- `DeckView.tsx` (bar, strip, stage, handout, divider), `DeckBar.tsx`, `SlideStrip.tsx`, `Stage.tsx` (the slide, the lines under it, the notes fold), `SlideSettings.tsx`.
- `slide/layoutSlide.ts`, `slide/SlideCanvas.tsx`, `slide/convertKind.ts`, `slide/iconSet.ts`, `theme/themeVars.ts`.
- `handout/deckSchema.ts` (the `deckSlide` node, the notes fold-in, the Turndown rules) and `handout/SlidePartHead.tsx` (the node view: number, title, thin line).
- `handout/deckGuard.ts`: typing can't delete a slide node (host updates carry `ritemarkDocumentRevision`, `Editor.tsx:628`; undo is let through); duplicate ids get new ones; the handout refuses `slide` and `notes` as code-block languages.
- `deckDocument.ts` (part ranges; move, duplicate, delete and insert transactions), `scrollRule.ts`, `deckBridge.ts`, `decks.css`, `library/SlideLibraryPanel.tsx`.
- Tests next to each pure module, plus `deckRoundTrip.test.ts` with `utils/markdownFidelity`'s `openAndSave`, as `mathRoundTrip.test.ts` does, and `webview/src/utils/fidelity-corpus/kept/deck.md` pinning the flag-off round trip.

### Touched shared files

| File | Touch | Why it can't be avoided |
| --- | --- | --- |
| `src/features/flags.ts` (`:24-69`) | `'decks'`, `experimental`, default off | The flag registry. Off by default is Jarmo's word (decision 10), which HARD RULE #2 allows; the comment cites it. |
| `package.json` | the setting `ritemark.features.decks` (default `false`); the container `ritemark-slide-library` and its view (`when: config.ritemark.features.decks`); the commands `ritemark.slideLibrary.search` and `ritemark.projectHead.newDeck`; the New menu entry with `when`; `onView:` activation; a `test:decks` script | VS Code contributions are static. |
| `src/views/projectHeadCommands.ts:39-44` | one `NEW_MENU_COMMANDS` row (PR 6) | `projectHeadCommands.test.ts:78` requires the menu to equal the list. |
| `branding/product.json`, `ritemarkFrame.places` | the Slide library place: `workbench.view.extension.ritemark-slide-library`, title "Slide library", order 0.55, its icon, and the head row `ritemark.slideLibrary.search` | Shell-tier by path. Section 3. |
| `src/extension.ts` | `export let decks` and one `registerDecks(...)` call | The board's pattern (`:97`, `:495`). |
| `src/ritemarkEditor.ts` | `deckMode` in `buildLoadMessage` (next to `cardMode`, `:332,384`); a `deck/` route before the `switch` (next to `google-docs/`, `:870`); `deckPages.connect` and its dispose next to `cardPages.connect` (`:761-764`); a lazy `deckPages()` accessor like `:270` | The one-editor decision. Nowhere near the xlsx code (`:303-313`). |
| `src/editorSync/protocol.ts:10-33,382,413` | an optional `deckMode?: true`, in `exactKeys` | Exact-field validation rejects unknown keys. |
| `webview/src/App.tsx` | one early return beside the PDF and CSV routes (`:806-849`): `if (deckMode) return <DeckView …>` with the same content, onChange, sync target, external-applied and editor-ready props, and the conflict and paragraph dialogs; `deckMode` set in `applyRenderPayload` | App owns the document-sync state (`:220-280`). The hunk goes after the CSV block, away from the xlsx route that the Excel work changes. |
| `webview/src/components/Editor.tsx:133-148,229-243` | an `extensions?: AnyExtension[]` prop added to the extensions list | The handout is this editor. |
| `webview/src/utils/editorMarkdown.ts:301-320,327-408,454-458` | a `deck?: AnyExtension[]` slot after math; `addDeckTurndownRules(service)` in `createEditorTurndownService` | Harmless without deck nodes, like the comment rules. |
| `webview/src/main.tsx:123-186` | a lazy `slide-library` route | Every left-column view routes here. |
| `src/runtime/ritemarkTools.ts:62,436-459` | `ToolGroupId` gains `'deck'`; `createDeckToolGroup` (as `createBoardToolGroup`, `:281`); `toolGroupsFor` and `toolGroupById` | The single tool registry. |
| `src/ai/capabilityContext.ts:33-73,145-156` | `hasDeckTools` and a DECKS section | The guidance appears exactly when the tools do. |
| `src/views/UnifiedViewProvider.ts:1331` | pass `deck: deckToolsAvailable()` | The one place the descriptor is built. Claude's and Codex's groups already flow through `toolGroupsFor` (`:1019`), OpenCode's at `AcpRuntime.ts:624`. |
| `docs/development/architecture.md` | a "Decks (Sprint 157)" section | The Sprint Architecture Gate (a new subsystem). |
| `media/webview.js` | rebuilt | Committed artifact. |

Untouched: `excelEditorProvider.ts`, `SpreadsheetViewer.tsx`, `office-preview.js`, every patch, the AI sidebar's components.

## 3. Extension-tier and shell-tier

Everything above is extension-tier except `branding/product.json`.

**Why the row needs the manifest.** Patch 002 lets only the manifest's places take a spot in the row; every other place lives in More (⋯): `RITEMARK_OWN_PLACES = ritemarkFrame.places.map(...)` (`002-ritemark-ui-layout.patch:790`), the row filter (`:871`), `ritemarkTakesSpot` (`:850`). The head rows come from the manifest too (`layout-invariants.md:47`). Any `activitybar` container missing from the manifest fails `scripts/check-frame-manifest.mjs:100-104`, so `frameIdentifiers.test.ts:21` and `release-extension-preflight.sh` fail.

**Option A, chosen: `product.json` only.** No patch and no VS Code recompile. The Slide library sits in the row with a Search head row. Rundev needs the dev tree's `vscode/product.json` refreshed from `branding/product.json` (`apply-patches.sh:336-339` copies it).

The known gap: manifest places carry no flag `setting`; only permanent tabs do (`002:1505,1787`). So on a fresh profile with the flag off, `ritemarkSeedPlaces` (`002:1749-1763`) seeds a Slide library placeholder in the first frame. It should hide once its only view's `when` is false (not verified), and `project-check --first-frame` would report the move. Before any merge to main, either patch 002 gives places a `setting`, as permanent tabs have (a High-tier shell change), or the flag goes stable.

**Option B, not chosen: extension only.** The container in `package.json`, with an allowance in `check-frame-manifest.mjs`. The place then sits in More, arrives after the first frame and has no head row. That is less than Jarmo approved ("a place in the left column, like Documents and Tasks").

**Row width (not verified).** With the flag on the row holds one more place. If the places don't fit the 256 px column, the composite bar folds the last place into More by itself. Which place goes to More is Jarmo's call when the flag comes off (README decision 4). No sizing change to patch 018 in this cut.

## 4. PRs

Every PR targets the integration branch `sprint-157-decks`, which is not merged to main. Each gets its own REVIEW.md round at the tier its paths set.

**PR 1, High tier (`ritemarkEditor.ts`, `editorSync/protocol.ts`, `App.tsx`): the deck file and the deck view's frame.** The flag; `deckFormat.ts` and its tests; the deck mode; the `deck/` route skeleton (theme, asset URIs); the protocol field; the schema slot, the Turndown rule, the notes fold-in, `deckGuard`; the `Editor` prop; the `App` branch. `DeckView` v0: the strip of numbered thumbnails (titles only), the current slide with a plain renderer, the handout column (the real editor, titles read-only in the part heads) and the scroll rule. The fidelity corpus deck file. All the High-tier touches land here once, so later PRs don't reopen those files.

- Flag off: a `.deck.md` opens as a document with code blocks, and an edit and save changes nothing else.
- Flag on: it opens as a deck. Scrolling the handout changes the slide, a thumbnail click scrolls the handout, typing in a part makes it the current one, undo works, and Saved shows.

**PR 2: the nine kinds, fitted, and words typed on the slide.** `layoutSlide`, `SlideCanvas`, `themeVars` and the built-in theme; real thumbnails. Click-to-type on every kind: Enter adds a box or item, Backspace on an empty one removes it, and Cmd+Z in a stage field runs the editor's undo. Table cells with Tab and Enter, Add a row and Add a column. The icon grid (24 Phosphor icons, stored by Ritemark name). The speaker notes fold. Card and Borderless as the deck's own choice on the deck's bar (Jarmo, 15 November: "proovi ka borderless slide disaini et mõlemad oleks valikus").

- A deck with all nine kinds; long titles and lists step down and nothing overflows; typing on the slide updates the thumbnail and saves; notes fold open and save into the `notes` block; Card and Borderless switch and hold.

**PR 3: Settings and the strip.** Settings beside the slide: Layout (nine pictures), the look, Picture (None, Left, Right, Behind) and Skip slide. A change of kind keeps the words, with the line "N more items are kept for other layouts". The strip: + between thumbnails, drag to reorder (one transaction per move), and the menu with Duplicate, Skip slide and Delete. A picture pasted or dropped on the stage goes through `deck/save-image` to `images/` beside the deck; the slide becomes a Picture slide unless it already places a picture.

- Boxes to Steps to Table and back with no words lost; reorder, duplicate, skip and delete with undo; a screenshot pasted onto a slide.

**PR 4, High tier (`branding/product.json`): the Slide library place.** `DeckLibrary`, `deckDocuments`, `SlideLibraryViewProvider`, the manifest entry and the Search head row. Topics (`Slide library/*.deck.md`) open to thumbnails and titles; Other decks are every other `*.deck.md`. "Insert after slide N" (a click) adds a copy with `from:`, its handout (and its notes, if the Experience lead says copies carry them), with relative picture paths and links rebased to the target deck's folder. The lines under the slide: Changed in this deck, with Keep it here and Update the library. Update the library writes by id with `replaceSlideBlock`, so every other byte stays. The library has a newer version, with Use it and an amber dot on the thumbnail. The strip menu's Add to library (pick a topic or make one) and Show in the library. Dragging into the strip is a stretch goal (not verified between webviews; the click is the guaranteed path).

- The place in the row; search; insert from a topic and from another deck; change a copy, then Keep it here or Update the library; another deck using that slide shows "newer" with Use it; a slide added to a new topic.

**PR 5, Standard tier (`ritemarkTools.ts` triggers the agent lifecycle tests, `validate-qa.sh:47-60`): Claude's deck tools.** The group `deck`, server `ritemark_decks`, Codex prefix `ritemark_decks_`, available when the flag is on and the window has a file-scheme folder.

- `list_decks`: optional `where` (`library`, `other`, `all`) and `query` over titles and words. Returns path, slide count, theme, modified time and whether it is a topic.
- `read_deck`: per slide its number, id, kind, words, `from:` state, skip, whether it has notes, and its handout text.
- `insert_slides`: `deck`, `source`, `slide_ids[]` and an optional `after`. Writes copies with the `from:` line and rebased paths, and answers with the new slides' numbers.
- `update_library_slide` and `add_to_library`: the same operations as the buttons (decision 9, dual use). The guidance says Claude changes the library only when the person asks.

Writes go through `deckDocuments`, so an open deck with unsaved changes is edited with a `WorkspaceEdit`. The DECKS section of the guidance: read and insert with these tools, always use `insert_slides` for library slides so the `from:` line is written, never change `Slide library/` unless asked, and a short summary of the file format for direct edits. Codex threads start fresh once, because `toolSetKey` changes. No chat cards in this cut; see the sprint plan.

- "Find our slide on checking what the AI wrote", then "insert it after slide 4"; the `from:` line is in the file; the same with ChatGPT and OpenCode.

**PR 6, optional: New → Deck.** A New menu entry opens a quick pick: Empty deck, or Copy of an earlier deck (newest first, with its folder and slide count). Then a name box ("Copy of …"), the file created in the chosen folder through `newDocumentFolder` / `nextUntitledPath` (`newDocumentLocation.ts:17,30`), and opened. Empty is the front matter plus one Title slide; a copy is a byte copy. Two new files (`newDeck.ts` and its test) and three small touches (`package.json`, `projectHeadCommands.ts`, the test's list). Frame 1's start page on the desk is out.

## 5. A line typed in the handout, in this cut

- `***` or `---` and Enter inside a part makes a horizontal rule in that part, as in any document. The input rule is unchanged, and the rule is saved inside that part's handout.
- It never starts, ends or joins a slide: `parseDeck` and the schema split parts only at `slide` fences. Pasted text with lines stays in the current part.
- **The file can't be broken this way:**
  1. Slide and notes fences are atoms, so typing can't open or close one.
  2. A rule as the body's first block is written `***`, never as false front matter (`architecture.md:146`).
  3. Code fences typed in the handout are sized past their contents (`markdownAsWritten.ts:1005-1007`).
  4. `deckGuard` refuses `slide` and `notes` as code-block languages in the handout. Without it, a typed "```slide" would become a slide on reopen.
  5. Backspace, Delete and select-delete can't remove a slide node from the handout. Delete is in the strip's menu.
- **Later:** the line-makes-a-slide feature adds an input rule and a paste transform in `handout/deckSchema.ts` that write a `slide statement` block waiting for its layout. Lines already saved stay lines.

## 6. Where the later cuts hook in

- **Claude adapts a deck, with See what changed and Undo:** per-reply records keyed by slide id, from `deckFormat`'s slide diff and written by `DeckLibrary`, and a reply card in the AI sidebar. Today an AI that edits the file arrives through the writer's-copy merge as one undo step (`reason: 'merge'`); a deck tool's `WorkspaceEdit` is not undoable in the view.
- **Theme editing:** a theme tab for `*.theme.md` (a mode, as in 1.1) on `deckTheme.ts` and `themeVars`; "Used by N decks" from `listDecks`. A saved change reaches the decks made earlier (Jarmo, 15 November).
- **A line makes a slide:** section 5. The new slide waits for its layout until the person asks Claude (Jarmo, 15 November: "nagu praegu - las ootab").
- **Publish:** `src/decks/publishPage.ts` writes one HTML page from `parseDeck` and the pure `layoutSlide`, without notes and skipped slides, and goes through 2.2's Publish (`src/publish/`).
- **Present:** a webview panel on the same renderer, passing over `skip: true` slides.
- **Gamma import:** a later `write_deck` or create tool, and a `gamma` kind that the parser already keeps as an unknown kind (drawn as a plain placeholder card, kept as written).
- **Chat cards (frame 2):** a fenced `slide-ref` block in replies, drawn as a card by the AI sidebar's Markdown renderer, with resolve and insert routed through `UnifiedViewProvider`.

## 7. Merging main into the branch

- `media/webview.js` always conflicts. Take either side, run `npm run build` in `webview/`, and commit; that writes both bundles, and `office-preview.js` should come out unchanged.
- Expect small conflicts in `package.json` (sprint `test:*` scripts), `flags.ts`'s union, `extension.ts`, and `branding/product.json` if main touches `ritemarkFrame`.
- After each merge run `frameIdentifiers.test.ts`, `test:editor-sync` and the deck tests.

## 8. Tests

**Unit tests (`npx tsx`, wired as `test:decks`):**

- `deckFormat.test.ts`: canonical files round-trip byte for byte, with unknown keys and lines kept; `replaceSlideBlock` keeps every other byte; fence sizing; `from:` parsing and the stamp; non-canonical input (a tilde fence, a trimmed info string, tight blank lines) is normalised once, predictably, on the first save; the writer's output parses with `js-yaml`.
- `deckTheme.test.ts`, `deckProtocol.test.ts`.
- `DeckLibrary.test.ts` (injected fs): list, read, insert with `from:` and rebased paths, Update the library compared byte for byte, Add to library, the three source states, a missing source, duplicate ids refused.
- `editorSync/protocol.test.ts`: `deckMode` accepted and wrong types rejected.
- `ritemarkTools.test.ts`: the deck group only with the flag and a folder; the schemas; `insert_slides` writes `from:`; `toolGroupById('deck')`. The `capabilityContext` section test.
- Webview: `deckRoundTrip.test.ts` (with and without the deck extensions every slide and notes block is unchanged, and a stage edit rewrites only its lines); `layoutSlide.test.ts` (each kind with long inputs keeps every box above 504; the grid fallbacks); `convertKind.test.ts` (words kept across all 81 kind pairs; `hiddenNote`); `scrollRule.test.ts`; `deckDocument.test.ts` (move, duplicate and delete ranges); `deckGuard.test.ts`; `themeVars.test.ts` (contrast, both looks).
- The fidelity corpus deck file; `frameIdentifiers.test.ts` with the manifest entry.

**Dev-instance checklist (rundev, flag on unless stated):**

1. Flag off: the deck opens as a document; one edit and save changes only that line; no place, no New entry, no tools.
2. Open, scroll, click thumbnails; type in the handout; undo across the stage and the handout.
3. All nine kinds at window widths of 1440 and 1200, and with both side columns open; Card and Borderless.
4. Settings: every kind and look, Picture Left, Right and Behind, Skip.
5. The strip: +, drag, Duplicate, Delete, undo.
6. A picture pasted and dropped.
7. The library: insert, change, Keep it here, Update the library (the topic file's diff is one block), "newer" in a second deck, Use it; a copy from a subfolder shows its pictures.
8. A writer's change: Claude edits the deck file while it is open, and the merge is one undo step.
9. Two views of one deck stay in step.
10. Each runtime lists, reads and inserts.
11. The frame with the flag on, and the first frame on a fresh profile with the flag off (the known gap).
12. New → Deck, both ways.

## 9. Risks

- **The frame:** the shell-tier manifest, the flag-off first-frame gap, the row overflow, and patch 002 work before main (section 3).
- **The dev tree.** The main checkout's `vscode/` is at an old commit (`10c8e557c8b`, April) rather than the recorded pin, so its `product.json` has no `ritemarkFrame`. The sprint worktree gets its own VS Code tree at the pin with the canonical patches, which has the frame (patches 002, 018, 019).
- **The round trip.** Only canonical files are byte for byte; a non-canonical fence line is normalised once. The notes fold-in needs the notes fence directly after its slide.
- **Atoms in the handout:** a paste duplicating ids, the drag handle moving slide nodes, IME losing the caret in stage fields. `deckGuard` and stage fields that keep their own text while focused cover them.
- **Performance:** the whole deck is serialised per keystroke (as documents are today) and thumbnails redraw per edit. Memoise by node identity; test with an 80-slide deck.
- **Fitting:** character estimates against real fonts, covered by the measuring pass.
- **Desk width:** at 1440 px with both columns open the desk is about 760 px for the strip, the slide and the handout.
- **Drag between webviews** (library or chat into the strip) is not verified. Click Insert is the guaranteed path.
- **Relative paths across folders** are rebased; links typed with `@` remain a risk.
- **Concurrent writes:** Update the library on a topic that is open with unsaved changes elsewhere goes through the `TextDocument`, as the board does.
- **OpenCode in Ask mode asks before deck tools.** Only board tools skip asking (`AcpRuntime.ts:80-91,668-672`), and changing that is High-tier permission code. Claude allows group tools (`RitemarkToolsInjector.ts:59-61`), and Codex dynamic tools don't ask.
- **The flag at runtime** affects decks opened afterwards.
- **Merge friction:** section 7; the `App.tsx` hunk sits away from the xlsx route.

## Not verified

- The first-frame behaviour of a manifest place whose view's `when` is false.
- ProseMirror `ignore` rules for folding the notes block into the slide node.
- Drag and drop between webviews.
- Whether the row fits one more place.
- The YAML subset against `js-yaml` (planned as a test, not run).
- The prototype's fit numbers against real font metrics.
