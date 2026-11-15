# Sprint 159: Decks, ready for a training (technical plan)

This is a read-only study from the night of 15 November 2026, made for the Development manager. Nothing was changed, built, launched or fetched. "Not verified" marks anything nobody has run. Paths are relative to the repo root.

The branch was read at `d5a726ea` (`sprint-157-decks-strip-polish`). Since then the polish has merged into `sprint-157-decks` (#727, f16be476). The study read main at `ee34c930`. Main has since gained all of Sprint 158 (… c493d143, 303dda8d), so the conflict list in §4 grows with Sprint 158's later PRs.

## Three findings set the shape
1. **2.2's Publish publishes a file.**
   - `gatherPage` reads the page from disk (`src/publish/gather.ts:165`).
   - `readVerifiedUpload` reads it again and checks every hash (`src/publish/host.ts:148`).
   - The records are keyed by the page's real path (`publishRecords.ts`).

   So the handout page is a real `.html` file that Ritemark writes beside the deck. The deck's Publish runs 2.2's own `ritemark.page.publish` on it.
2. **VS Code can already put a webview in a window of its own, compact and full screen.**
   - It has the commands `workbench.action.moveEditorToNewWindow`, `workbench.action.enableCompactAuxiliaryWindow` and `workbench.action.toggleFullScreen`.
   - Patch 010's browser opens compact auxiliary windows already (`browserViewWorkbenchService.ts:567`).
   - What an extension cannot do is find the second display. That one piece needs the shell.
3. **The flag on a place needs no upstream hunk.**
   - VS Code's first frame already hides a cached extension place when every view's `when` is false (`paneCompositeBar.ts:461-491` in the dev tree).
   - Only Ritemark's seed for a new profile, `ritemarkSeedPlaces`, writes a placeholder that always shows.

## 1. Present
**The wall: a VS Code auxiliary window.**
- The extension makes a webview panel, `ritemark.deckWall`. It draws with the same `SlideCanvas` from the shared `webview.js`.
- The panel moves into its own window, which is made compact (no title row or tab row) and then full screen.
- The deck's look holds: a Card deck shows its card on bands of #0E0C24, a Borderless deck its words on white.
- The wall and presenter pages must post `ritemark/pageDrawing` and `ritemark/pageDrawn` (`webview/src/lib/pageDrawn.ts`). Otherwise patch 002's loading look covers them for up to 10 s.

**The right display (shell, PR 6).**
- One new Ritemark file in patch 018's electron-browser layer adds two commands:
  - `_ritemark.present.displays` gives the display count and names, from `window.getScreenDetails()`;
  - `_ritemark.present.place` opens a compact auxiliary editor part on the chosen display, moves the active editor into it and makes it full screen.
- Swap displays: `nativeHostService.positionWindow`, then full screen again.
- Upstream hunks:
  - one import line in patch 018's existing `desktop.contribution.ts` block;
  - `'window-management'` added to `allowedPermissionsInCore` in `src/vs/code/electron-main/app.ts`, in patch 004's existing hunk.
- Without the command (an older shell, or if the window check fails), the three existing commands are used. The wall then goes full screen on the laptop's own display. The extension checks for the command, as Publish checks for `_ritemark.webviewSheet.open`.

**Presenter view (PR 6).**
- A second panel, `ritemark.deckPresenter`, in its own compact full-screen window on the laptop. It uses Ritemark Dark's tokens whatever the app's theme.
- It shows:
  - the slide now and the next one;
  - the notes in large type, with A− and A+;
  - the shown slides in a row;
  - the clock;
  - Next as the one bright button;
  - Swap displays;
  - "Claude and notices wait until you stop."
- It comes on by itself when `_ritemark.present.displays` reports two displays.
- The host is the only source of state. The presenter view's state carries the notes; the wall's never does.
- The clock shows time elapsed, and with `ritemark-length` in the front matter, elapsed against that length. A click on the clock asks for the length once and writes it through the deck's open document.

**Keys, the same in both windows.**
- → ↓, PageDown, space, Return and a click go on. ← ↑ and PageUp go back. Home and End go to the first and last slide shown. Esc stops.
- A typed number opens "4 · Go to <title> ↵". Return goes there; Esc or a 3 s pause closes it. The numbers are the thumbnails' numbers, so a skipped slide can be reached by its number too.
- The bar shows when the pointer moves and fades after 2 s: back, n of N, next, all slides (a grid on the wall), presenter view, "esc to stop".
- In the deck, ⌘↩ presents from this slide (as the Present button does) and ⇧⌘↩ from the start, as in PowerPoint for Mac and Google Slides. The deck view catches both before the handout's editor does; ⇧↩ stays a line break in the handout.

**Skipped slides.**
- The session's order is the deck's slides without `skip: true`, read again at every move.
- n of N counts the slides shown.

**An edit reaching the wall.**
- The host holds the current slide by its `id`, not its number.
- At every move it parses the deck's open `TextDocument` again (`parseDeck(document.getText())`). So an insert, a skip, a change or a deletion arrives at the next move.
- The wall changes only on a move. The presenter view's next slide and row follow edits as they come.
- If the current slide is deleted, the wall keeps it until the move, then goes on to the slide that came after it.

**Stopping and interruptions.**
- Esc closes both windows, and the deck view goes to the slide the presenter ended on.
- The main window stays behind the full-screen windows.
- Transitions: a 0.3 s fade, and none with reduced motion. Rehearse stays out.

**What the first cut already has:** `layoutSlide` and `SlideCanvas`, speaker notes, skip, the theme, and Card and Borderless.

## 2. The handout page
The host builds it from the `.deck.md`. It is one HTML file carrying its CSS, fonts, icons and a small script; pictures stay separate files. Every module is pure and tested under Node, except the file writer, which takes its file system as a parameter.

1. **`src/decks/page/publicDeck.ts`: the one place that decides what is public.**
   - **What goes:**
     - the title slide's title, and the client line (the deck's folder name);
     - for each slide that isn't skipped: its kind, its words, its picture path and its handout Markdown;
     - the text before the first slide, only if the deck view shows it in the handout (the page shows what the handout shows, minus what's private).
   - **What never goes:**
     - speaker notes, and every ```` ```notes ```` fence anywhere, including a stray one that the deck view keeps in a handout as a code block;
     - skipped slides, with their handout and pictures;
     - comments: standalone `<!-- -->` blocks, and anchored `<mark data-comment>` marks, which are unwrapped to their text;
     - the front matter, and the `id`, `from`, `kept` and `skip` lines;
     - words a layout hides (`hiddenNote`), and the "From the library" line.
2. **`webview/src/components/decks/slide/slideMarkup.ts`:** each slide as static HTML, from the same pure `layoutSlide`, mirroring `SlideCanvas`'s non-editing drawing. For the fit, the open deck view sends each slide's measured `step` at Publish: numbers only, clamped to 0–3.
3. **`src/decks/page/pageHtml.ts`:** the learner page as drawn, without its look toggle.
   - **Styles:**
     - the slide rules move out of `decks.css` into `slide/slide.css`;
     - the deck view imports that file, and the host inlines the same file through an esbuild `text` loader for `.css`;
     - the theme comes through `themeStyle(theme, borderless)`.
   - **Fonts and icons:**
     - Sofia Sans is inlined as data URLs, read at run time from `media/fonts/` through `extensionUri`, which is bundle-safe;
     - the icons are inline SVG from a small generated module: the slide icons plus copy, check, list, the chevrons and folder.
   - **Markdown, through `marked`:**
     - raw HTML is escaped;
     - web links stay links;
     - links to project files become plain names;
     - pictures stay relative paths.
   - **Prompts, ticks and sections:**
     - every code block becomes a prompt with Copy;
     - an Exercise slide's numbered steps and task lists get ticks;
     - Section slides become the grey band, "Section N" over the title.
4. **`src/decks/page/pageScript.ts`:** the page's one inline script.
   - **Scrolling and layout:**
     - the editor's scroll rule, as a copy of `scrollRule.ts` that a test keeps the same;
     - the desktop layout, and the phone layout below 860 px;
     - j and k, the arrows under the slide, and the fade.
   - **The page's controls:**
     - the progress bar;
     - Contents, with a finished exercise ticked;
     - Copy, which says Copied, or selects the words where a browser won't copy;
     - ticks kept in localStorage.
   - It sets no `src` or `href` and writes no HTML, so 2.2's `scriptBuildsReferences` stays false.
5. **`src/decks/page/pageFile.ts`:** the page is written beside the deck as `<deck name>.html`.
   - It carries `<meta name="generator" content="Ritemark">` and `<meta name="ritemark-deck" content="<digest>">`. The digest is a sha256 of what `publicDeck` returns.
   - It never overwrites a file Ritemark didn't write for this deck. Instead it stops and says why in one line.
   - A page written for a first Publish that is then cancelled is removed again.

**The phone and the wide screen.**
- **Phone:** the header and a band holding the slide stay at the top, and the text scrolls under them. The read line is measured from the band's bottom.
- **Wide screen:** the slide stays on the left, centred, with arrows under it, and the text scrolls on the right.

**Pictures** stay files at the deck's relative paths, and 2.2's gather sends them under its rules: inside the project, not hidden, not ignored by Git, at most 25 MB. A picture used only by a skipped slide is never named in the page, so it never goes.

**Plugging into 2.2's Publish.**
- **Publish** on the deck's bar does three things:
  1. asks the open view for the fit steps;
  2. writes the page file;
  3. runs `ritemark.page.publish` on its URI.
- **Update the page** is the same path. With the same pictures and nothing that looks like a key, `sheetNeeded` sends it straight up.
- **The other commands:**
  - Copy link and Unpublish run `ritemark.page.copyLink` and `ritemark.page.unpublish`;
  - See online uses `openInIntegratedBrowser`.
- **The chip** reads `_ritemark.publish.pageState` for the page file. It says "Published · changed" when 2.2 finds a change, or when the deck's digest differs from the page's.

**What changes in Publish** (all of it High tier, in `src/publish/`):
- **`vscodePublish.ts`** gains:
  - a page-state change event, beside the existing refresh for patch 010's bar;
  - `isReady()`: the flag on and the whole-window sheet there.
- **The sheet** gains What goes and What stays rows for a deck's page:
  - The deck host gives the summary for its page path through a small registry that `prepare()` reads.
  - It reaches the sheet as an optional `deck` field in `SheetOptions` and `PublishSheetModel`, drawn by `PublishSheet.tsx`.
  - The file list stays.
- **What does not change:** the gather, the scan, the upload and the records.

## 3. The flag on places (patch 002)
All of it is in 002's own new files, `src/vs/workbench/browser/ritemarkFrame.ts` and its test.
- `IRitemarkFramePlace` gains `setting?: string`, read the same way a tab's setting is read.
- `ritemarkSeedPlaces` seeds a place that has a setting the way VS Code caches an extension's place: `isBuiltin: false`, `views: [{ when: 'config.<setting>' }]`. Today's seed (`isBuiltin: true`, `views: [{}]`) always shows. Places without a setting are seeded as now.
- `branding/product.json` (PR 2): the Slide library place gains `"setting": "ritemark.features.decks"`.
- `scripts/check-frame-manifest.mjs` checks two things:
  - the setting is a boolean in `package.json`;
  - every view in that place has `when: config.<setting>`.

  It also accepts a place that is off by default and missing from an older shell's manifest (decision 2).
- A place's rule is the opposite of a tab's on purpose. A tab's setting turns it off when false; a place's setting shows it only when true. At roadmap step 5, when the flag comes off, the place loses its setting.

**Live:** the view's `when` follows the setting at once (`hideIfEmpty`); the seed matters only for a new profile's first frame. A deck already open keeps its mode until it is opened again. The tools appear or go at the next turn, and a Codex thread starts fresh once, because `toolSetKey` changes.

**Upstream hunks: none.** One edge to check in the dev window: a window closed on the Slide library, the flag then turned off, then a restart. If `layout.ts` tries to restore that place, the setting check goes into 002's existing `layout.ts` hunk, beside `isRitemarkPlace`.

## 4. Merging the Decks branch to main
**Size:** 99 files, about +10,200 and −1,100 lines. A third of it is evidence pictures and the demo project. The one shell-tier file is `branding/product.json` (one line). No patch is touched.

**With the flag off, nothing changes that a person can see:**
- **`.deck.md`** already opens in `ritemark.editor` as a document and saves byte for byte (`fidelity-corpus/kept/deck.md`).
- **The look baseline:** `look-baseline.json` only gained `kept/deck.md`.
- **The tools:** `deckToolsAvailable()` is false, so there is no deck group, no DECKS section in the instructions, and no change to `toolSetKey`.
- **The place** is hidden by its view's `when`, and with PR 1 at a new profile's first frame too.
- **The bundle:** `media/webview.js` grows from 8,752,835 to 9,010,964 bytes, because `App.tsx` imports `DeckView`. `office-preview.js` changes when rebuilt, since `Icon.tsx` gained icons.
- **Shared code:** the paste helpers moved from `Editor.tsx` to `lib/pastedImage.ts`, unchanged. `addDeckTurndownRules` sits in every save path but matches only `div[data-deck-slide]`.
- **A new setting,** `ritemark.features.decks`, default `false`.
- **Two inert hooks for any `.deck.md`:** `deckPages.connect` and the `deck/` route (`ritemarkEditor.ts:777-783` and `891-896`). PR 2 guards both with `deckModeFor(document)`.

**Conflicts to expect:**
- `media/webview.js` and `media/office-preview.js`: always rebuild them, never merge by hand.
- `package.json`: the `test:*` scripts.
- `webview/src/App.tsx`: `xlsxLoad` in `case 'load'`, beside `setDeckMode`.
- `components/ui/Icon.tsx`.
- Possibly small ones in `flags.ts` (Sprint 158 added `excel-editing`), `extension.ts` and `CHANGELOG`.
- Patch 010: the branch already contains #720.

**One merge PR (PR 2) after one small shell PR (PR 1).** Each Sprint 157 PR was reviewed on the branch. PR 2's review reads the conflict resolutions, the flag-off paths, the product.json line and the two guards.

## 5. PRs
See [sprint-plan.md](sprint-plan.md). The proof for each:
- **PR 1:** a place with a setting is seeded hidden while the setting is off and shown while it is on. Other places are unchanged. The stacking check and `apply-patches --dry-run` pass.
- **PR 2:** shows the fault first: on the branch before PR 1, the flag-off first frame shows a Slide library placeholder. Then with the flag off, a fresh profile's first frame matches main, a deck saves byte for byte, and the tool list, instructions and `toolSetKey` match main. With the flag on, the first cut's checklist passes again.
- **PR 3:** nothing private is in the bytes. The page passes 2.2's gather with only the expected files and no key hits, and works at 390 and 1440 px.
- **PR 4:** Publish, Update and Unpublish of a deck's page go through 2.2's path, against the fake Cloudflare host and the sheet harness. "Changed" appears only after a public change.
- **PR 5:** the session's rules in unit tests. On one display, the wall has no tabs, a slide added mid-session arrives at the next move, and Esc returns to the deck.
- **PR 6:** first a short check in a dev window: that `getScreenDetails` answers once the permission line is in, and that a webview moved to a new window can be made compact and full screen in Ritemark's frame. Then, on a real second display (Jarmo): the wall on the projector, the presenter view naming the display, Swap displays, and the fallback.
- **PR 7:** the new deck lands in the folder New was opened from, and opens as a deck.

## 6. Tests
**Unit tests** (`npx tsx`, added to `test:decks`, `test:publish` and `test:publish-cloudflare`):
- **`publicDeck.test.ts`:** a distinct test word in each private place, none of them in the output. The places:
  - folded notes, and a stray `notes` fence;
  - a skipped slide's words, handout and picture;
  - a standalone comment and an anchored comment;
  - the `from:` and `id` lines, the front matter and hidden items.

  Raw `<script>` comes out escaped.
- **`pageHtml.test.ts`:**
  - the output is the same for the same input;
  - every shown slide and section is there;
  - every prompt has Copy, and an exercise's steps have ticks;
  - there is no remote URL;
  - `pageReferences` finds only the expected pictures;
  - `scriptBuildsReferences` is false.
- **`pageScript.test.ts`:** the page's scroll rule and `scrollRule.ts` agree over generated states, and the script compiles.
- **`pageFile.test.ts`:**
  - the file name;
  - a foreign file is never overwritten;
  - a cancelled first Publish removes the page;
  - the digest changes with a public edit, but not with an edit to notes or to a skipped slide.
- **The gather, end to end:** gives the page plus its pictures, no `.md` file, no picture that only a skipped slide uses, no key hits with the fonts inlined, and `scriptBuilt` false.
- **Parity:** `slideMarkup` against `SlideCanvas` rendered with `react-dom/server`, for all nine kinds in Card and Borderless; the icon module against `@phosphor-icons/core`.
- **Publish:** `sheetModel` with a deck summary; `PublishController` with the fake host (a first publish, an update without the sheet, the changed state); the state event fires.
- **`presentSession.test.ts`:**
  - next and back pass skipped slides;
  - a number goes to its slide, a skipped one too;
  - an insert, a skip or a delete arrives at the next move;
  - the current slide is held by id;
  - From the start and From this slide;
  - n of N.
- **`presentProtocol.test.ts`:** exact fields, and the wall's state never carries the notes (the test words).
- **Shell:** `ritemarkFrame.test.ts`, `check-frame-manifest.test.mjs`.
- **Flag off:** the fidelity corpus; the instructions and `toolSetKey` match main.

**A hidden dev window** (`scripts/qa/dev-launch-isolated.sh`, driven over CDP) proves:
- **With the flag off:** no place at a fresh first frame (`project-check.mjs --first-frame`); a deck opens as a document and saves byte for byte; no deck tools.
- **With the flag on:** the place sits after Tasks, and the setting switches it on and off live.
- **The page,** opened with agent-browser at 390×844 and 1440×900: the scroll rule, Copy and its fallback, ticks after a reload, Contents.
- **The sheet,** through the sheet harness (nothing is sent), and the chip's states against the fake host.
- **Present,** in a dev-only windowed mode (`RITEMARK_PRESENT_WINDOWED=1`, honoured only with `VSCODE_DEV`): the keys, skipped slides, live edits, go-to and Esc. The wall's received state holds none of the test words.
- **The frame checks** for PRs 1, 2 and 6.

**Only Jarmo can prove:**
- the projector, the presenter view, Swap displays and a clicker;
- a real publish, the page on his phone, then Update and Unpublish;
- a run-through in his installed app.

Windows' display handling is its own short task.

## Not verified
- **The seed and the first frame:**
  - that a seeded place with `isBuiltin: false` and a `when` behaves at the first frame as the code reads;
  - that `config.*` context keys are evaluated from user settings at the first frame.
- **The window piece:**
  - that `getScreenDetails` answers in Electron 43 with `'window-management'` allowed;
  - that a compact auxiliary window hides the tab row in Ritemark's frame (patch 018 says floating windows keep a title row);
  - that a webview moved to a new window keeps working;
  - that an auxiliary window closes with its last editor.
- **The page:**
  - that the deck view's fit steps give the same fit on the page;
  - that `@phosphor-icons/core`'s SVGs match the React icons.
- **Interruptions:** whether Ritemark sends any operating-system notification that would show over a presentation.

## Critical files
- `patches/vscode/002-ritemark-ui-layout.patch` (`ritemarkFrame.ts`: `IRitemarkFramePlace`, `ritemarkSeedPlaces`)
- `extensions/ritemark/src/publish/vscodePublish.ts`
- `extensions/ritemark/src/decks/deckPages.ts`
- `extensions/ritemark/webview/src/components/decks/slide/layoutSlide.ts`
- `extensions/ritemark/webview/src/components/decks/DeckView.tsx`
