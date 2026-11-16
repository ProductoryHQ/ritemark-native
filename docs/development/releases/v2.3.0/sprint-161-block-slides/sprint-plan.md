# Sprint 161: block slides

Track: Full. It changes the deck file format, how a slide is edited and saved, and what reaches the participants' page.<br>
Release tier: **extension**, for every PR. Nothing touches `patches/`. Decks stays behind `ritemark.features.decks`.<br>
**Status:** **Approved** by Jarmo on 17 November 2026, in the Development manager session: "jah, alusta Sprint 161, peidetud sõnad märkmetesse sobib" (yes, start Sprint 161; hidden words into the notes is fine). On 17 November he then dropped private notes altogether: "ärme alguses üldse tee privaatseid märkmeid! Kasutame selleks meil juba tuttavat 'kommentaar' notationit" (let's not make private notes at all at first; we use the 'comment' notation we already know). The hidden words therefore go into a comment, not into notes (decision 8). The spike is done ([research/spike.md](research/spike.md)); the PRs come next.<br>
**Release:** v2.3.0 if it is done before the release candidate; otherwise it waits behind the flag.<br>
**Why:** Jarmo, 16 November: slides should be written like text, with blocks from the / menu as in Gamma, "praegu, sest hetkel on mul valu ja vaev slaide ette valmistada" ("now, because preparing slides is a pain for me at the moment"). His answers: he edits directly on the slide; the text part is only loosely tied to it; from Gamma he wants the content, with our theme giving the look.<br>
**Design:** experience 46 in ritemark-dev, at **e3f12e2** (prototype v24): the README section "The block slide (16 November)" and frames 21–26. At **dfa390d** (prototype v26): the section "Notes are comments (16 November)", which replaces the notes block of 404ef3b.<br>
**Technical plan:** [technical-plan.md](technical-plan.md), the read-only study of 16 November with the spike's corrections.<br>
**Branches:** `sprint-161-block-slides` holds this plan and the spike. Each PR gets its own branch from `origin/main`.

## What Jarmo can do after it
- Write on the slide as in a document: a title, a line under it, text and lists. There is no layout to choose first.
- Type / on the slide for columns, boxes, steps, a picture or a table, or for a new slide below or a split at the cursor.
- Paste a Gamma card. Its title, columns, lists and pictures arrive as blocks in our theme, and the pictures are saved in the deck's `images/` folder.
- Keep using every deck he already has. Each opens as block slides with nothing lost, and its file changes only when he edits it.
- Write anything only he should see as a Ritemark comment in the handout. The presenter view shows the current slide's comments; Publish never sends them.

## Decided (the Development manager, technical)
1. **The format stays Markdown.** A slide is still a ```` ```slide ```` fence. Inside it there's a short header (`---` id, from, skip, picture `---`) and then plain Markdown. Columns, Boxes and Steps use the `:::` blocks that Pandoc and Quarto slides already use, so other AIs can read and write them.
2. **A block deck says `deck: 2`.** An older Ritemark opens it as a plain document and never rewrites it.
3. **Opening writes nothing.** Today's slides are drawn as blocks through a converter. The first real edit converts the whole deck in one step, and one Undo takes it back.
4. **One renderer for the slide, the wall, the strip and the learner page,** so they never disagree. The privacy rules stay: comments and skipped slides never go out.
5. **The handout stays as built on 16 November** (v20, its own headings). It's tied to its slide by order only.
6. **#752's pill rule carries over** to the Steps block. A missing label shows "Exercise", and an empty one shows none. A `tag:` written today is kept.
7. **Pictures from a paste are downloaded once** into `images/`: https only, no cookies, a size cap and a timeout, and never a private address. A picture that fails stays as an empty place with a note. A remote address is never kept.
8. **No private notes field. Comments hold anything private** (Jarmo, 17 November). Ritemark's existing comment notation (`<!-- … -->` and anchored comments, experience 31's look) is the only private text in a deck.
   - The "Speaker notes" fold under the slide goes, and the word "Notes" goes from the UI.
   - The presenter view shows the current part's comments, read-only, in order, under "Your comments". With none: "No comments on this slide."
   - The start card's line: "This column is the handout: what participants read and do. Comments stay with you."
   - Publish's What stays: "On your computer: comments on 9 slides, and 2 skipped slides." The singular for 1, any count that's 0 left out, and with neither: "Nothing: this deck has no comments or skipped slides."
   - On conversion (the first real edit), an older `notes` block and the words a layout kept hidden become one comment at the end of that slide's part.

## Decided by the spike (17 November)
Details and numbers in [research/spike.md](research/spike.md).
- **The editing model is "atom plus string body".** The slide stays an atom in the handout's editor; the stage's editor writes the slide's Markdown back with `setNodeMarkup`. An outer change reaches the stage's editor as a minimal diff, never a reload, so the caret survives undo and an AI edit.
- **The stage scales with `transform: scale`, never CSS `zoom`.** Under `zoom`, ProseMirror's coordinates are off by the zoom factor, so the caret, the / menu and the bubble menu land in the wrong place.
- **The bubble menu is appended to `document.body`** on the stage; TipTap's default puts it inside the scaled frame.
- **The `:::` tokenizer and its Turndown rules live in the slide editor's own scoped `marked` and Turndown instances,** never the document editor's, so a Text document's `:::` lines are untouched.
- **The host's `marked` moves from v4 to v9.1.6** (PR 1), and the one renderer lives in `src/decks/` for both the host and the webview.

## PRs (each leaves Decks working)
| # | What | Tier |
| --- | --- | --- |
| 1 | Read and draw block slides everywhere: the strip, the wall, the presenter view, the library and the page. Today's decks are drawn through the converter, and nothing is written. The host's `marked` to v9; the one renderer with its parity test; the presenter view reads the part's comments. | High (format, privacy) |
| 2 | The editor on the slide, fit to the slide, and the first-edit conversion (notes and hidden words become a comment). The AI's deck tools and instructions move to blocks. The layout grid and the Speaker notes fold go for block slides. | High (saving) |
| 3 | The / menu's blocks, the box icon, the Steps label, New slide below, Split slide here, and the "This slide is full" line | Standard |
| 4 | Paste from Gamma and other HTML, with the picture download | High (paste, network, files) |
| 5 | Remove the old layout model and the `notes` attribute. The converter stays, for old decks. | Standard |

Each PR gets the Experience lead's look at frames 21–26 (and the presenter view's "Your comments") before it merges.

## Questions for Jarmo
1. **Words a layout keeps hidden today,** such as a third column or a step's extra text: when a deck converts, they go somewhere private and the notice says so. **Jarmo: yes** (17 November), and then: into a comment, not notes (decision 8).
2. **Converting:** deck by deck at its first edit (the default), or one "convert this project's decks" action that also keeps the library's "changed" marks exact? **Not answered; the default (deck by deck) stands until Jarmo says otherwise.**

## Already settled elsewhere
- **The "1. 1." numbers:** a small fix is being built now on Jarmo's word. The conversion makes them a real numbered list later.
- **Picture removal on today's slides:** not built. In block slides a picture is a block, and Delete removes it.
- **Deleting a slide from the text part:** independent of this plan. It still waits for Jarmo's yes.
- **The Web page block** in the / menu: the lead's frame lists it. This sprint gives it the same place as a Picture with a link. A live page inside the slide is later work.

## Not in it
- A live web page embedded in the slide.
- The default label word in the deck's own language.
- Themes and theme editing (Decks step 3).
- A private notes field of any kind (decision 8).
