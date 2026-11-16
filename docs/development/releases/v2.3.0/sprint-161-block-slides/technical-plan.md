# Sprint 161: technical plan (block slides)

The read-only study of 16 November 2026, by a Plan agent for the Development manager, kept close to its text. Line numbers are for `origin/main` at `a1dc0c79`. #752 (the `tag:` pill) merged while it ran, so it's part of today's model.

Two things changed it since:
- **Jarmo, 17 November: no private notes field.** Anything private is a Ritemark comment in the handout (sprint plan, decision 8; design at ritemark-dev dfa390d). The changes are marked **Comments, 17 November** below.
- **The spike, 17 November** ([research/spike.md](research/spike.md)). Its answers are marked **Spike** below.

## Summary
- **Format, option (a).** The slide stays a ```` ```slide ```` fence. Its body becomes a short front matter of its own (`---` id / from / skip / kept `---`), then Markdown.
- **Blocks** are Pandoc/Quarto fenced divs: `:::: columns` / `::: column`, `:::: boxes` / `::: {.box icon="…"}`, `::: {.steps tag="…"}`.
- **Versions.** The deck says `deck: 2`. A bare `slide` info string is a block slide. `slide <kind>` stays the old YAML slide, always read, and converted in memory.
- **Editing.** The slide node stays an atom in the handout's editor. The stage hosts a second, lean TipTap editor built on the same Markdown pipeline (the Sprint 137 round trip), which writes back the slide's body string.
- **Fit.** One font-scale factor for the whole slide, measured and stepped down.
- **Private words are comments** in the handout part (Comments, 17 November). The slide's `notes` attribute is read only to convert an old deck.
- **Five PRs, all extension-tier.** Nothing touches `patches/`.

## 1. Today's model and what depends on it
**The file**
- A slide is a fence ```` ```slide <kind> ```` (`deckFormat.ts:469` `writeSlideBlock`, `:583` `slideKindOfInfo`, `:589` `parseDeck`).
- Its body is a strict YAML subset: flat scalars (`SCALAR_KEYS` `:95`, now with `tag`), `items:` (heading, text, icon) and `rows:`. There are nine kinds (`SLIDE_KINDS` `:34`).
- The writer changes only the lines that changed (`writeSlideBody` `:394`).
- Only `deck:` ≤ 1 is writable (`isReadableDeckVersion` `:663`; the library enforces it at `DeckLibrary.ts:111`).

**The editor**
- The handout is one document editor holding the whole file.
- Each slide is an atom node `deckSlide` with the attributes kind, body and notes (`deckSchema.ts:66`). It's parsed from the fence by a `pre` rule (`:101`) and written by a Turndown rule (`:142`).

**Drawing**
- `layoutSlide(kind, data)` (`layoutSlide.ts:119`) places absolute boxes on 960×540.
- `SlideCanvas` draws them, with stage boxes as `contentEditable="plaintext-only"` (`SlideCanvas.tsx:111`).
- The measuring pass steps the type down, up to `MAX_STEP` = 3 (`:268-276`), and stores the result as `data-step` (`:282`).
- `slideMarkup` gives the page the same boxes as static HTML.

**Editing on the stage**
- Edits address a path into the slide's data (`slideEdits.ts` `setPath` and related functions).
- `Stage.write` (`Stage.tsx:88`) applies each change as a `setNodeMarkup` on the outer editor.
- Undo is the outer editor's (`:104`).

| Consumer | Where | Assumes |
|---|---|---|
| Stage editing | `Stage.tsx:88-160`, `slideEdits.ts`, `SlideCanvas.tsx` | Path addressing; Enter and Backspace per kind |
| Settings layout grid | `SlideSettings.tsx:30`, Label row `:105`, Skip `:140`; `convertKind.ts`; `DeckView.tsx:1128` | Nine kinds, look, picture place |
| Strip | `SlideStrip.tsx:145`, inserts `:55-65`; `deckDocument.ts:260` `insertSlide(kind)`, `:274` `updateSlide(kind)` | A kind at insert |
| Pictures | `DeckView.tsx:750-768` (save, then `convertKind` to Picture); `Stage.tsx:191,219`; host `deckPages.ts:534` `savePicture` into `images/` | One `image:` per slide |
| Handout (#750) | `partHeadingLevel(kind)` `deckFormat.ts:677`; `derivedHeading(title)` `:732`; `withPartHeading` `:787`; `LINE_SLIDE_KIND` `deckLines.ts:30` | Section is H1; title from `title:` |
| Speaker notes (Comments, 17 November: they go) | the `notes` attribute (`deckSchema.ts:66`), the ```` ```notes ```` fence after a slide (`writeSlideBlock` `deckFormat.ts:469`), the Stage's notes fold (`Stage.tsx`), `PresenterState.notes` (`presentProtocol.ts:59`), "Your notes" (`DeckPresenterView.tsx:176`) | A private field per slide |
| Present | `wallDataOf` copies fields (`presentProtocol.ts:127`); `DeckWall.tsx:196,314`; `DeckPresenterView.tsx:138`; the key with no id is kind+body (`presentSession.ts:64`) | Field copy |
| Learner page | `drawnData` (`publicDeck.ts:93`); `publicDeck` `:321`, title from the `kind === 'title'` slide `:343`; `pageHtml.ts:484` `slideMarkup(kind)`; section band `:441`; exercise ticks and pill `:430,439,446,453`; pictures `pageFile.ts:175` | Kind and fields |
| Publish fit | `deckPublish.ts:185` | Steps 0–3 |
| Library | stamp hash (`deckLibraryFormat.ts:146-171`); `rebaseSlide` `image:` (`:97`); search words (`DeckLibrary.ts:101`); "same as source" `:239`; `SlideLibraryPanel.tsx:193` | Fields |
| AI tools | `slideWords` (`ritemarkTools.ts:461`), `read_deck` `:503`, `insert_slides` `:529`; DECKS instructions (`capabilityContext.ts:169`) | YAML |
| New → Deck | `newDeck.ts:26` | A `title` YAML slide |
| Fidelity corpus | `webview/src/utils/fidelity-corpus/kept/deck.md` | The fence stays opaque |
| Demo project | `docs/development/sprints/sprint-157-decks/demo-project/**.deck.md` | Fixtures to convert |

## 2. The target format
| | (a) Markdown in the fence | (b) YAML `blocks:` | (c) Top-level Markdown slides |
|---|---|---|---|
| Round trip | Reuses the Sprint 137 marked → TipTap → Turndown pipeline. Containers follow the math pattern (`mathMarkedExtension.ts`, Turndown rules, round-trip tests). | Nested YAML that the hand-written subset can't read, plus a new writer. Rich text ends up as Markdown in quoted strings. | Slide and handout text mix in one document. |
| Person / other AIs | Plain Markdown; the Pandoc/Quarto syntax is widely known | Noisy, fragile indentation | The most readable, but breaks the handout model |
| Page and wall | One static Markdown → slide HTML renderer | Field copy | Hard |
| Privacy | `publicMarkdown` (`publicDeck.ts:216`) already drops notes, fences, comments and `<mark>`; raw HTML is escaped; header keys never go out | Easy | Hard |

**Recommendation: (a).**
- **The header** is optional, with front-matter delimiters, so a first paragraph like `Goal: …` is never read as a key. It's written with today's line-preserving scalar writer.
- **Containers** support a small Pandoc subset (`:::+ word` or `:::+ {.word key="value"}`), nested by colon count. The colon counts and the attribute form are recorded, so untouched containers write back byte for byte.
- **The Steps pill** follows #752's rule: no `tag` shows "Exercise", and `tag=""` shows none.
- **Versions.** `deck: 2` is written with the first v2 write, and `isReadableDeckVersion` moves to ≤ 2.
- **Outer fence.** `fenceFor` (`deckFormat.ts:454`) already sizes the outer fence past an inner code block.
- **Caveat: there are two marked versions.** The webview uses v9 with `breaks: true` (`editorMarkdown.ts:65`); the host's page uses v4 with `breaks: false` (`publicDeck.ts:140`). The slide Markdown needs one shared renderer.
- **Spike:** the `:::` tokenizer round-trips 22 AI-written variants byte for byte, once three things are in place: the containers' children get the as-written pass, a fence line counts as "tight" with its neighbour, and the tokenizer and its Turndown rules live in the slide editor's own scoped instances (registered on the document editor's `editorMarked`, every Text document's `:::` lines would change). A typed paragraph that starts with `:::` must be escaped (`\:::`) in the slide's Turndown, or it becomes a fence on the next open.
- **Spike:** the host's `marked` moves to v9.1.6. Four type errors (`marked.Tokenizer`, `marked.TokenizerThis` and `marked.Token` as types in `publicDeck.ts`), the page tests pass unchanged, and `out/extension.js` shrinks by 4 KB. The renderer lives in `src/decks/`; the webview's Vite config should dedupe `marked` so the bundle keeps one copy (not tried yet: PR 1 checks it).

## 3. Editing on the slide
- **Keep `deckSlide` an atom with a string body.** The strip, the guard, `deckLines`, the drawn headings, the library and Publish keep working.
- **The stage mounts a lean `SlideEditor`:**
  - `createEditorSchemaExtensions`, plus the slide's slot nodes Columns, Boxes and Steps;
  - `SlashCommands` with a slide item list, and the bubble menu;
  - not the `Editor` component, which is `prose`-styled (`Editor.tsx:202`) and carries the handout's drag handle.
- **Writing back.** Each inner change serializes the slide, puts the header back in front, and dispatches `setNodeMarkup`.
- **Undo** stays in the outer editor, and the inner editor reloads after an undo.
- **Untouched slides.** Keep the parsed starting document and its source; when the inner document `.eq()`s the start again, write the original string.
- **The alternative** is ProseMirror's footnote pattern, which gives better undo and caret but changes every `attrs.body` consumer. The spike decides.
- **Spike: atom plus string body.** Measured headless with both models: undo, redo, the caret after undo, and an AI edit arriving while typing behave the same, provided the stage's editor takes every outer change as a minimal diff (`findDiffStart`/`findDiffEnd`, as `documentReplacement` does) rather than reloading. The cost is serializing the slide per keystroke: about 0.5 ms in the app's Chromium on a full slide. Outer changes wait while the stage's editor is composing (IME).
- **Spike: scaling.** `transform: scale` keeps ProseMirror's coordinates, the / menu and IME right; CSS `zoom` does not (coordinates off by the zoom factor in Chromium 142). The bubble menu must be appended to `document.body`: TipTap's default appends it inside the scaled frame.

**Free from the Text editor:**
- headings, marks, links;
- bullet, numbered and task lists;
- tables, code blocks and Mermaid;
- math;
- the image node;
- the / menu machinery (`blockItems.ts`, `SlashCommands`, `CommandsList`).

**New:**
- Columns, Boxes and Steps, each with its tokenizer, node, Turndown rule and round-trip test;
- the box icon picker (`IconPicker`);
- the Steps pill;
- a picture inserted into the slide (`deck/save-image` with the slide id);
- the slide's / items: New slide below, and Split slide through an outer `DECK_OPERATION`;
- the slide frame CSS under `.deck-sl` with the `--s-*` variables;
- the static renderer replacing `slideMarkup`, with a parity test.

**Fit.**
- All sizes are `em` of one `--fit` variable. After layout, measure against the frame and step down: 100 / 92 / 84 / 76 / 68 / 60 %, with hysteresis.
- Pictures take the remaining height.
- Below the floor, the slide shows an overflow cue and Split slide.
- `data-step` is sent at Publish, as now.
- `:has()` centres a slide that's only a heading plus a line (the old title, section and statement looks).

## 4. Migrating today's decks
- **Opening writes nothing.** A pure `legacyToBlocks(kind, body)` draws every v1 slide, on the host and in the webview.
- **The first real edit** converts every known-kind slide and writes `deck: 2` in one transaction, with one Undo. The precedents are `withWrittenHandout` (`deckFormat.ts:771`) and DeckView's front-matter `onChange` (`DeckView.tsx:136`).
- **Unknown kinds** stay as written.
- **Host writes** convert only the parts they write. Mixed decks are legal.

| v1 kind | v2 Markdown |
|---|---|
| title, statement | `# title` plus the subtitle as a paragraph (cover look) |
| section | `# title`; its number as a short first line (look decision) |
| points | `# title` plus an ordered list; an item's `text` becomes a second line |
| boxes | `:::: {.boxes look="…"}`, each `::: {.box icon="…"}` holding a `### heading` and its text |
| columns | `:::: columns` / `::: column`, with `### heading` and hard breaks |
| exercise | `::: {.steps tag="…"}` (only when `tag:` is written) plus an ordered list |
| a ```` ```notes ```` block (Comments, 17 November) | a standalone comment `<!-- … -->` at the end of the slide's handout part, with any `-->` in the text neutralised |
| words a layout keeps hidden (Comments, 17 November) | the same comment, one line each ("Hidden by the old layout: …") |
| picture | `![](images/x.png)` plus the caption |
| table | GFM table, first row as header, `\|` escaped |
| picture beside or behind | the header's `picture:` / `image:` |

**Traps**
- **"1. 1." headings.** Strip `N. ` when it matches the position, and escape it otherwise.
- **Hidden words.** `drawnData` (`publicDeck.ts:93-136`) keeps some words private: a third column, a title slide's items, a step's `text`, icons under some looks. The conversion must not make them public. ~~Default: move them into the slide's speaker notes, and say so (Jarmo decides).~~ **Comments, 17 November:** they go into a comment at the end of the slide's part, with the old notes, and the notice says so. The page already drops comments (`publicMarkdown`).

**Library stamps**
- The new stamp is a hash of the folded converted Markdown plus the handout, minus its heading. For a v1 slide it's computed on the in-memory conversion. `slideStamps` keeps the old algorithms.
- At conversion, a copy still matching its `from:` stamp gets the new stamp. A changed copy keeps the old one.
- One false "newer" remains: a copy changed before the conversion whose source converts later. Either accept it, or offer a one-time "convert this project's decks".

## 5. Pasting from Gamma
- **The clipboard content is unknown here; the spike captures it.** Expected: ProseMirror clipboard HTML (`data-pm-slice`), Gamma layout wrappers, and `<img src="https://cdn.gamma.app/…">`, possibly signed or expiring.
- **Spike:** a two-column card puts only HTML on the clipboard (`«class HTML»`, about 3 KB) and an almost empty plain text; no RTF and no Gamma type. It is ProseMirror clipboard HTML: `div.card-layout-item[data-pm-slice]` > `h1`, then `div.columns[data-colwidths]` > `div.column` > `h2` (wrapped in `<b>`) and `p.paragraph`. The webview's `text/html` paste is enough. That copy had no picture, so the picture download is still unchecked.
- **Mapping.** A `transformPastedHTML` in the slide editor maps by structure, not by class names.
  - A container whose two or more children each open with a heading becomes Columns.
  - Boxes and smart layouts become Boxes; numbered layouts become Steps.
  - Styles, colours and fonts are dropped.
- **Pictures.** Nothing downloads remote pictures today: `Stage.tsx:191`, `Editor.tsx:220`, and `savePicture` (`deckPages.ts:534`) takes a data URL. Add `deck/fetch-image {slideId, url}`:
  - https only, no cookies;
  - a size cap, a content-type check and a timeout;
  - private and loopback hosts refused;
  - written with `writeImageRelativeTo` into `images/`.
- **A failure** leaves an empty place with a notice. A remote address is never kept. The page's CSP already blocks remote images (`pageHtml.ts:474`).

## 6. What it replaces or makes moot
| Item | Verdict |
|---|---|
| #752 `tag:` pill | Merged. The rule carries over as the Steps `tag` attribute. Its Settings Label row and stage pill box go in PR 5. |
| Picture removal on the slide | Moot: a picture is a block, and Delete removes it. |
| Deleting a slide from the handout | Independent of the format. Build it only if Jarmo still wants it. |
| v20 handout (#750) | Stays. In PR 2 the part heading comes from the slide's first `#`, and `LINE_SLIDE_KIND` becomes a bare slide. |
| "1. 1." bug | Fixed by the conversion. A separate display fix is only for until PR 2 lands. |

## 7. PRs
1. **Format v2 reader and renderer, no writes. High.**
   - Header, bare `slide`, `deck: 2`, `legacyToBlocks`.
   - Container tokenizer and the shared renderer.
   - The strip, wall, presenter, library and page render v2.
   - One `publicSlide`; new stamp plus old ones.
   - Fixtures.
2. **Slide editor on the stage, first-edit conversion. High.**
   - `SlideEditor` with its nodes and Turndown rules; restoring the original string; undo through the outer editor; fit.
   - The conversion transaction; `insert_slides` and library writes convert.
   - The #750 adjustments; the DECKS instructions and `read_deck`.
   - The layout grid hidden for v2.
3. **Blocks UX. Standard** (High if it changes the tokenizer).
   - The / items, the icon picker, the pill, New slide below, Split slide, the overflow cue.
   - The strip's + becomes "New slide".
4. **Gamma paste. High.** `transformPastedHTML`, `deck/fetch-image`, security review.
5. **Remove the old model. Standard.** Delete `layoutSlide`, `convertKind`, `slideEdits`, the layout and Label rows, and the v1 writer. Keep the v1 reader and `legacyToBlocks`.

**Shell-tier: none,** unless Gamma's content is readable only under a MIME type that needs an Electron clipboard read.

## 8. Risks and the spike

**Spike:** the answers are in [research/spike.md](research/spike.md).

1. **Gamma clipboard.** All MIME types for a two-column card, boxes, images and a whole card. Do the images download without cookies?
2. **TipTap inside a scaled frame.** The caret, the selection, the slash menu, the bubble menu and IME, under `transform: scale` and under CSS `zoom`.
3. **Atom plus string, or the footnote pattern.** Undo, the caret after undo, a concurrent AI edit, and the cost of Turndown per keystroke.
4. **The `:::` round trip.** Does it come back byte for byte on AI-written variants?
5. **One renderer for the host and the webview.** Use marked v9 in both, and add a parity test.
6. **Fit stability** on the stage, thumbnails, wall and page.
7. **A read-only scan of Jarmo's decks.**

**Decisions for Jarmo:**
- the section number and the title and statement looks;
- the accent picture as a setting or a block (the lead's frame 26: a setting);
- hidden words going into the notes (**decided:** yes, then into a comment, 17 November);
- the handout's H1 rule;
- the pill's default word in the deck's language (later).
