# Sprint 159: Decks, ready for a training

Track: Full. It merges Decks to main, changes patch 002 and adds a small patch 018/004 piece.<br>
Release tier: **shell** (`patches/`, `branding/product.json`). Decks reaches Jarmo's installed app with the next shell release, behind `ritemark.features.decks`, which is off by default.<br>
**Status:** **Done**, 16 November 2026. All seven PRs are on main, 9672cc23 … 19119f52 (#733, #735, #738, #731, #736, #729, #737). Decks stays behind `ritemark.features.decks`, off by default, until the shell release. What was not run, and two Codex findings still to answer, are under [Close-out](#close-out) at the end. Approved on the night of 15 November 2026 on Jarmo's delegation. His words, 15 November: "tore! ja võid alustada sprints ise kui olete Experienciga yhel meelel". The Experience lead agreed on looks and feel, provided five changes went in, and they are in this plan. The Development manager approved the technical part.<br>
**Roadmap:** step 2 of `ritemark-dev/product/design/experience/experiences/decks/roadmap.md`.<br>
**Spec:** experience 46 (`decks/README.md`: frames 6 and 8, and Presenting), experience 17 (`present/`), the learner page, and the Experience lead's list `decks/step-2-look-and-feel.md` (ritemark-dev bc9cdd7). This plan is written against that list.<br>
**Technical plan:** [technical-plan.md](technical-plan.md), a read-only study of the Decks branch and main.<br>
**Branch:** `sprint-159-decks-training`. Each PR has its own branch: PRs 1 and 2 from main, the rest from main once PR 2 is in.

## What Jarmo can do after it
Run a real training from Ritemark:
- **Present** from the deck's bar. It shows the slide on the wall with nothing of Ritemark, and a presenter view on the laptop with now, next, notes, the row of slides and the clock.
- **Publish the handout page** with 2.2's Publish. Participants open it on their phones: the slide stays at the top, the text scrolls under it, every prompt has Copy, and an exercise's steps can be ticked. Speaker notes and skipped slides never go out.
- **Use Decks in his installed Ritemark** after the next shell release, by turning on `ritemark.features.decks`.

## Against the Experience lead's list
**Present** (PRs 5 and 6)
- **The menu.** Present starts from the current slide (⌘↩, the same as the button). Its menu has From the start (⇧⌘↩) and Presenter view. This is the order PowerPoint for Mac and Google Slides use; the Experience lead corrected experience 17 to match (ritemark-dev b1ce966). Presenter view comes on by itself when a second display is connected, and names the display ("Presenter view · Projector").
- **The wall.** Only the slide, at 16:9, with bands in #0E0C24 on other screen shapes. It shows in a compact full-screen window with no title row, tabs or mark. A Card deck shows its card, a Borderless deck its words on white. The wall uses the same slide renderer as the stage, so a slide looks the same in both.
- **Moving.**
  - → ↓, PageDown, space, Return and a click go on; ← ↑ and PageUp go back; Home and End go to the ends; Esc stops.
  - The bar shows when the pointer moves and fades after 2 s: back, n of N, next, all slides, presenter view, "esc to stop".
  - Typing a number opens "4 · Go to <title> ↵".
- **Skipped slides** are passed, left out of the presenter view's row, and not counted in n of N. The session reads the deck's open document again at every move, so a slide added or skipped in the editor reaches the wall when the presenter moves on.
- **The presenter view,** on the laptop in Ritemark Dark whatever the app's theme:
  - the slide now and the next one;
  - the notes in large type, with A− and A+;
  - the row of slides;
  - time elapsed against the session's length, asked once and kept in the deck's front matter;
  - Next as the one bright button, and Swap displays.
- **Nothing interrupts.** The main window sits behind both full-screen windows, so its AI column, notices and toasts stay out of sight. The presenter view says "Claude and notices wait until you stop." Whether the operating system shows a notification over the wall is checked in PR 5's dev run.
- **Stopping** returns the deck view to the slide the presenter ended on.
- **Transitions:** one 0.3 s fade, none with reduced motion, and no choice in the menu.

**The handout page, published** (PRs 3 and 4)
- **Publish** on the deck's bar is 2.2's Publish, through 2.2's own command on a page file that Ritemark writes beside the deck, `<deck name>.html`. The gather, the key scan, the upload and the records are 2.2's, unchanged.
  - The sheet gains What goes: "14 slides and their handout, 6 prompts with Copy, and the pictures they use. Nothing else from the project."
  - It also gains What stays: "On your computer: speaker notes on 9 slides, and 2 skipped slides."
  - Counts of one are singular ("1 slide", "1 prompt"), and a part that is 0 is left out. With no notes and no skipped slides, What stays reads "Nothing: this deck has no speaker notes or skipped slides."
  - After a public change, the chip shows Published · changed with Update the page. Editing notes or a skipped slide doesn't count as a change.
- **The learner page as drawn, with nothing of Ritemark.**
  - The client and the session sit at the top, with how far along it is and Contents.
  - On a computer the slide stays on the left, centred, with arrows under it, and the text scrolls on the right.
  - On a phone (below 860 px), the slide stays at the top and the text scrolls under it.
- **The slide follows the text** by the editor's own rule, the same code kept the same by a test: one part at a time, both ways.
- **Sections** are the grey band with "Section N" over the title.
- **Copy** on every prompt says Copied, or selects the words where a browser won't copy.
- **Ticks** on an exercise's steps stay on that person's device only, and Contents ticks a finished exercise.
- **The deck's look holds,** Card or Borderless.
- **Never on the page:**
  - speaker notes, including a stray `notes` block;
  - skipped slides, their handout and the pictures only they use;
  - comments, the "From the library" line, the `id` and `from` lines, and the front matter.

  One module decides what is public, and tests put a test word in each private place and check that none reaches the page, the files sent or the wall.

**Decks in the installed app, behind the flag** (PRs 1, 2 and 7)
- **Flag on:** Decks works as in the dev build. That means the Slide library place after Tasks and a deck opening as a deck, plus **New → Deck** (PR 7, which the dev build doesn't have yet). New → Deck has no start page:
  - It is one quick pick. "Empty deck" comes first, then the project's earlier decks, newest first, each with its folder and date.
  - A copy is named "<deck name> (copy)", lands in the folder New was opened from, and opens as a deck with the title slide's title selected, ready to type over.
  - An empty deck opens with a title slide reading "The deck's title", selected.
- **Flag off: nothing of Decks shows.** No place, from a fresh profile's first frame on, no deck tools and no DECKS section in the AI's instructions. **What a deck file looks like with the flag off:** it opens as an ordinary document, each slide shown as a code block of `key: value` lines, its speaker notes as a code block named `notes` under it, and the handout as the text between them; saving changes only what was typed.

## Decided in this plan
The Development manager decided the technical points. The Experience lead's agreement covers how they look and feel.
1. **The handout page is a real file beside the deck** (`<deck name>.html`, next to `<deck name>.deck.md`). It appears only after the first Publish. That keeps 2.2's Publish, the most sensitive code, unchanged, and matches 2.2, where Publish publishes a file in the folder. The file shows in Documents, opens as a local preview, and works as a fallback in the room without a network. The Experience lead agreed: Ritemark is the person's folder, so a page they can see, open offline and keep is right. Ritemark never overwrites a file it didn't write for this deck, and a cancelled first Publish removes the file again.
2. **The frame check accepts a place that is off by default and missing from an older shell's manifest,** so extension releases from main to the 2.2.0 shell keep working once Decks is on main. Decks itself waits for the shell release. No extension release brings it earlier.
3. **The address can end with the deck's folder** when a picture lives outside it, as 2.2 does for any page. Fixing that for every page is later Publish work.
4. **The presenter view needs a small shell piece** (PR 6): `_ritemark.present.displays` and `.place`, one new file in patch 018 with its import, and the `window-management` permission in patch 004's existing hunk. A short check runs first in a dev window. If the check fails, Present ships full screen on one display or a mirrored projector, without the presenter view, and the second display follows.
5. **⌘↩ presents from this slide and ⇧⌘↩ from the start, inside a deck.** The deck view catches both before the handout's editor does. In a deck's handout, ⇧↩ still makes a line break.
6. **Small defaults:**
   - Comments never go out.
   - The page's top line is the deck's folder name and the title slide's title.
   - **The page shows what the handout shows, minus what's private.** The text before the first slide goes out only if the deck view shows it in the handout. If the deck view hides it, the page leaves it out too, and PR 3's test says so.

## PRs
| # | What | Release tier | Review | Built by |
| --- | --- | --- | --- | --- |
| 1 | Patch 002: a place can carry a `setting` (in 002's own `ritemarkFrame.ts`, with no upstream hunk), plus `check-frame-manifest.mjs` (decision 2) | Shell | High | builder A |
| 2 | Decks on main behind the flag: merge `sprint-157-decks`, the product.json `setting` line, the flag-off guards for `deckPages.connect` and the `deck/` route, and architecture.md's Decks section | Shell | High | builder A |
| 3 | The handout page: `publicDeck`, `slideMarkup`, `pageHtml`, `pageScript`, `pageFile`, `slide.css` | Extension | High by choice, with `/security-review` | builder B |
| 4 | Publish from the deck's bar: the chip, Update, Copy link, See online and Unpublish; the sheet's What goes and What stays | Extension | High (`src/publish/`) | builder B |
| 5 | Present, the wall: the menu, the compact full-screen window, the keys, skipped slides, live edits, the bar, go-to, all slides, the fade, Esc | Extension | Standard, plus shots to the Experience lead | builder C |
| 6 | The presenter view and the second display (decision 4) | Shell | High | builder C |
| 7 | New → Deck: empty, or a copy of an earlier deck | Extension | Standard | builder A, after PR 2 |

**Order:** PR 1, then PR 2. After that, two lines run in parallel: 3 then 4, and 5 then 6. PR 7 comes any time after PR 2. Each builder rebuilds `media/webview.js` after every merge and never merges it by hand. The Development manager merges on each PR's Review record.

**After all of it:** one shell release with Gate 1 and Gate 2, which stay Jarmo's. Then Jarmo turns Decks on in his own settings. The public release notes say nothing about Decks while it is behind the flag.

## Tests
The full list is in [technical-plan.md](technical-plan.md) §6. The main points:
- **Privacy.** Test words go into the notes, a stray notes block, a skipped slide (its words, handout and a picture only it uses), both kinds of comment, the `id` and `from` lines and the front matter. None may appear in the page's bytes, the gather's file list or the wall's state.
- **Flag off.** A fresh profile's first frame matches main. A deck saves byte for byte. The tool list, the instructions and `toolSetKey` match main.
- **The page** at 390 × 844 and 1440 × 900: the scroll rule, Copy and its fallback, ticks surviving a reload, Contents.
- **Publish** against the fake Cloudflare host and the sheet harness. Nothing goes out in tests.
- **Present** in a dev-only windowed mode (`RITEMARK_PRESENT_WINDOWED=1`, honoured only with `VSCODE_DEV`), so a hidden test run never takes over the screen.
- **Dev launches** stay hidden, with isolated AI homes and `--use-mock-keychain`, one launch reused and quit at once. Jarmo is away, so test launches are allowed.

**Only Jarmo can prove:**
- the wall on a real projector and the presenter view on the laptop, Swap displays and a clicker;
- a real publish to his Cloudflare account, the page on his phone, then Update and Unpublish;
- a run-through in his installed app after the shell release.

## Not in it
- Choosing a transition, and Push transitions.
- Rehearse.
- Black screen and a laser pointer.
- Participants following the presenter live.
- The phone button on the browser's bar (frames 6 and 8); it needs patch 010.
- The look toggle on the page.
- Themes and theme editing (step 3).
- Maths on the page, which shows as text.
- The start page on the desk (frame 1).
- A clean address when pictures live outside the deck's folder.
- Windows' second-display check, which gets its own short task after PR 6.

## Risks
- **The merge is large** (99 files, about 10,000 lines). Each Sprint 157 PR was already reviewed on the branch. PR 2's review reads the conflict resolutions, the flag-off paths, the product.json line and the two guards, and proves flag off against main.
- **Not verified yet:**
  - that the first-frame seed with `isBuiltin: false` and a `when` behaves as the code reads;
  - that `getScreenDetails` answers in Electron 43;
  - that a compact auxiliary window hides the tab row in Ritemark's frame.

  PR 1's and PR 6's first steps check these.
- **The bundle grows by 258 KB (2.9%)** for everyone, because `App.tsx` imports the deck view. It is accepted for now. A lazy split is later work, if load time shows it.

## Close-out

All seven PRs are merged to main, in the order below, on the night of 15 to 16 November. Decks is on main behind `ritemark.features.decks`, off by default, and with it off nothing of Decks shows. The public CHANGELOG and release notes say nothing about Decks while it is behind the flag. 2.2's Publish sheet, which Decks shares, is unchanged on every page that isn't a deck's.

| PR | What | Tier and review | Merged |
| --- | --- | --- | --- |
| 1 | A place in the frame's manifest can carry a `setting` (patch 002); `check-frame-manifest.mjs` accepts a place an older shell doesn't name (decision 2) | Shell, High: one round and the security review | #733 |
| 2 | Decks on main behind the flag: `sprint-157-decks` merged with a merge commit, the `product.json` setting, the flag-off guards | Shell, High: two rounds and the security review | #735 |
| 7 | New → Deck: an empty deck, or a copy of an earlier one | Extension, Standard: one round | #738 |
| 5 | Present, the wall | Extension, Standard: one round | #731 |
| 6 | The presenter view and the second display (patches 004, 018 and 019) | Shell, High: two rounds, the second run again after main, and the security review | #736 |
| 3 | The handout page, with a stored-XSS fix and a Content Security Policy | Extension, High by choice: three rounds and two security reviews | #729 |
| 4 | Publish from the deck's bar | Extension, High (`src/publish/`): three rounds and two security reviews | #737 |

**Changed during the sprint:**
- **The presenter view's shell piece is larger than decision 4's one file.** PR 6's window check passed: `getScreenDetails` answers in Electron 43 with patch 004's `window-management` line, so the one-display fallback wasn't needed. A compact window still drew an auxiliary window's title row and the desk's edge in Ritemark's frame, though, so patch 018's own `layoutService.ts`, `editorPart.ts` and `ritemarkSurfaces.css` hunks and 019's `editorGroupView.ts` gap changed too. Each change applies only to a window that `_ritemark.present.place` opens (`data-ritemark-presenting`). The Development manager accepted the scope on 16 November. Every other window's frame is unchanged: 0 of 34 frame scenes differ.
- **On a shell without the placement commands, Present answers with a notice** (the Experience lead, 16 November). Present stays enabled, and pressing it, ⌘↩ or ⇧⌘↩ says in the deck's bar "Presenting needs a newer Ritemark. Update it, then present again." Nothing opens. VS Code's own window commands place the wall only in a dev build, because their window shows "<deck> — <project>" and the desk's edge. There is no Check for updates button: Ritemark has no update command to call (the Development manager).
- **The presentation's windows are named by the deck alone,** never by the project. The wall goes to a display that isn't built in before one that isn't the primary, so a projector set as the primary still gets the slides and not the notes.
- **Nothing interrupts, with no shell change for it.** Ritemark's extension posts no OS notifications. VS Code's own come only from its chat sessions and from long task runs, and Ritemark starts neither.
- **The deck's bar follows frame 2** (the Experience lead, on PR 4): Card | Borderless, Saved, Publish, Present. Present is last, the filled split button and the bar's one primary, with the tooltip "Present from this slide (⌘↩)". Every control is 30 px, through a new shared Button size, `bar`.
- **The Publish sheet has its own line for a deck's page:** "People open it in their browser, on a computer or a phone." Every other page keeps 2.2's line and 2.2's rows.
- **PR 3 ran at High with `/security-review`, by choice.** Its first security review found a stored XSS through marked's raw mode. The page now has a tokenizer that never enters raw mode, an escape for any bare `<`, and a Content Security Policy that allows only its own script, by its hash.
- **More stays off the page than the plan listed.** A notes block inside a quote or a list item takes the whole quote or list with it. A front matter that the editor and `parseDeck` read differently never reaches the page: the document as saved is used instead.
- **The page file is written more carefully.** It goes in only where nothing is, so a file that arrived meanwhile is refused. Two windows writing the same deck replace each other's page. A cancelled first Publish takes the page back only while the file is exactly the page written.
- **On the page** (the Experience lead, on PR 3), a section that isn't the current part dims its words and keeps its band, and on a touch screen Copy's fallback says "Tap Copy in your phone's menu".
- **Each deck panel keeps the flag it opened with** (PR 2's review). A deck opened with the flag on keeps working after the flag is turned off, but the Slide library's requests need the flag on. A document view never turns into a deck view because the flag changed. A deck that another program rewrote to a later `deck:` version shows as a document and is never rewritten, by the view, the library or the AI's tools.
- **New → Deck leaves the Slide library's topics out of its list,** and a copy keeps its speaker notes, since it is the person's own deck.
- **Decision 2 settles the frame check only.** Check 5b now passes Decks against the 2.2.0 shell. But Check 2 of `release-extension-preflight.sh` has refused an extension release from main against v2.2.0 since #720 changed patch 010, and this sprint changes patches 002, 004, 018 and 019 too. Decks reaches people with the shell release, as planned.

**Not run:**
- **A real projector and a second display.** Not seen: the wall full screen on a projector with nothing but the slide, and the presenter view on the laptop coming on by itself and naming the display. A hidden run on one display can't show full screen, because macOS refuses it to a window of an app in the background.
- **Swap displays and a clicker.** Swap needs two displays, so it never ran. A clicker's PageDown and PageUp are tested as keys (`wallKeys.test.ts`), not with a device.
- **A real Cloudflare publish, Update and Unpublish.** Every Publish ran against the fake Cloudflare host and the sheet harness, and nothing was sent. Copy link and See online weren't pressed in a window either.
- **The page on a real phone, in Safari and in Firefox.** The page was checked only in the proof runs, at 1440 × 900 and 390 × 844.
- **Windows.** Nothing of Decks ran on Windows. Windows' second-display check is its own short task after PR 6.
- **Sprint 157's full checklist with the flag on** (`docs/development/sprints/sprint-157-decks/qa/rundev-checklist.md`) wasn't run again on main. The place, turning the flag on and off live, and a deck opening as a deck were.
- **The bundle's effect on load time.** `media/webview.js` grew by about 258 KB (2.9%) for everyone, and no one measured whether an ordinary document now opens more slowly.
- **Smaller ones:** a brand-new profile with the flag on before its first start (PR 1's unit test only); that a slide's fit measured in the deck view gives the same fit on the page (every slide of the demo deck measured 0); words typed a moment before Publish is pressed, and a press while the page's sheet is open from the browser's bar (both unit-tested only).

These are rows in `docs/releases/v2.3.0/TEST-CHECKLIST.md`, under Decks, for Jarmo to test on the release candidate.

**Codex.** It reviewed #733 (no findings), #735 (one, fixed) and #729 (three, fixed; it didn't see the later commits). Then the account hit its Codex usage limit overnight, and the later PRs went in without a Codex review: it failed on #731 and #738, and the Review records of #736 and #737 say it wasn't available. Codex's reviews of #736 and #737 did come in later all the same, each with one P2 finding that has no answer yet:
- **#736**, `src/decks/present/DeckPresenter.ts` (`showPresenter`): an edit made during the talk redraws the presenter view's Now slide at once, while the wall keeps its slide until the next move, so the laptop can show a different Now from the room's. Codex reviewed `55e91331` three minutes after the merge.
- **#737**, `src/decks/deckPublish.ts` (`publish`): a Card | Borderless change still on its way to the document when Publish is pressed publishes the old look, and the chip then reads Published · changed. Round 2's finding 6 judged the same case as not mattering, because Update the page corrects it. Codex reviewed `b9996080`, before the Review record was posted.
