# Sprint 161, slide comments (#766): proof shots

One dev run on 17 November, 08:25–08:45 EET. Jarmo allowed a daytime run for that day in the Development manager session.

**How it ran**
- One launch with `scripts/qa/dev-launch-isolated.sh`: a fresh profile, throwaway AI homes and the mock keychain, on a copy of the demo project (`docs/development/sprints/sprint-157-decks/demo-project`), with `ritemark.features.decks` on.
- It started on `e3ddfe58`. The fixes the run found were built and reloaded into the same instance (Reload Window). The instance was stopped with `LEFT=0`.
- Nothing was signed in to, and no comment was sent to an AI.
- The workbench was held at 1440 × 900 CSS px with a CDP device-metrics override. The files are 2880 × 1800 (2×).
- "AI open" means the AI column is shown, "AI folded" that it is hidden.
- The deck is `Harbour Logistics/AI assistants and agents, as blocks.deck.md`, a `deck: 2` block deck.

| Shot | What it shows |
| --- | --- |
| `right-click-menu-ai-open-1440x900.png`, `…-ai-folded-…` | Ritemark's own menu on the slide (frame 27): Cut and Copy greyed with no selection, Paste, a line, Comment ⌘/. Esc closes it, and so does a press outside it (checked: no `[role=menu]` left after either). |
| `card-on-the-four-boxes-ai-open-1440x900.png`, `…-ai-folded-…` | Comment on a right-click in a box: the comment is on the Boxes block whole, as frame 28 draws it. The ring goes round the four boxes, the head says "On the four boxes, slide 6", the box has the caret and the Claude pill. |
| `card-on-words-ai-open-1440x900.png`, `…-ai-folded-…` | Words selected ("What it may open"), right-click, Comment: "On “What it may open”, slide 6", with the ring round the words. |
| `card-on-the-whole-slide-ai-open-1440x900.png`, `…-ai-folded-…` | Right-click on the slide's background, Comment: "On slide 6", with the ring inside the slide's edge. |
| `saved-markers-strip-dot-bar-ai-open-1440x900.png`, `…-ai-folded-…` | Three saved comments on slide 6, each an amber marker at the top right of what it is on: the slide's corner, the boxes' corner, and past the end of the words. The strip shows 3 on slide 6 and 1 on slide 8. The bar shows the comments button with 4, then Previous and Next. |
| `bar-next-opens-slide-8-comment-ai-open-1440x900.png` | Next from slide 6's last comment goes to slide 8 and opens its card ("On the title, slide 8", a comment made with ⌘/). Next is then greyed out. |
| `bar-previous-back-to-slide-6-ai-open-1440x900.png` | Previous back across slides to the boxes' comment. Its card has Send to Claude and "→ New conversation" (it mentions @claude). Nothing was sent. |
| `bar-next-opens-the-words-comment-ai-folded-1440x900.png` | Next on the same slide, AI folded. |
| `published-page-no-comment-words-1440x900.png`, `published-page-no-comment-words-390x844.png` | The page Publish writes for the deck with its four comments (`publicDeck` and `pageHtml`, the same code), on slide 6, in a headless Chromium shell. |

**Checks in the run**
- **The file.** Each comment added exactly its own lines and nothing else (`diff` against the demo project):
  - the boxes' note before `:::: boxes`;
  - the `<mark …>` round "What it may open";
  - the whole-slide note at the slide's end;
  - the title's note before `# Build an assistant…`.
- **Cancel.** A new comment cancelled gave the file back byte for byte (`shasum` the same).
- **Paste from the menu.** Copy from the menu on a selected word, then Paste from the menu at the caret, wrote ` (Skills` into the box, and the file has it. ⌘Z twice then gave the file back byte for byte.
- **Opening writes nothing.**
  1. The tab of the commented deck was closed and the deck opened again.
  2. Then I clicked a thumbnail, the title, a box, the handout and another thumbnail, and waited 6 s, past autosave.
  3. `shasum` was the same before and after: `4a965d33…`.
- **Spacing and fit.** Measured on the stage, with the same layout:

  | Deck | Slide 6: title, Boxes | Slide 8: title, Steps |
  | --- | --- | --- |
  | With its comments | top 0, height 54; top 78, height 242 | top 0, height 54; top 78, height 221 |
  | Plain copy, no comments | the same | the same |

  Step 0 (fit 100 %) in every case: comments change nothing in how the slide is drawn. Slide 8's note sits before its title, and the title still starts at 0.
- **⌘/.** On the caret in slide 8's title it opened "On the title, slide 8" with the caret in the box. Enter saved it.
- **The page.** No comment word (the four notes, `data-comment`, `<!--`, `@claude`) is in its HTML or its text, at either size. The words a comment was on stay ("What it may open").

**Found in the run and fixed (build `e3ddfe58` plus the fix commit)**
1. **After Cut, Copy or Paste from the menu, the caret was gone** (the focus was left on the webview's body), so ⌘Z and typing did nothing until a click. The menu's close now gives the focus back to the slide's words.
2. **Comment from the menu opened its box without the caret** (the menu's close took the focus back). Comment now starts once the menu has closed, and the box keeps the caret.
3. **Comment's icon touched its word in the menu.** It now has the menu's gap.
4. **Markers covered words.** A words marker hid the last letters of what it was on, and a title's marker hid the title's last letter. Markers for words, a title or a line now sit just past their end. The three card shots were taken before this fix, so the words marker there still overlaps "open". `saved-markers-…` and `bar-…` are after it.

After the run, the review of these fixes made them firmer, with tests:
- one start path for Comment (the menu's close);
- no refocus after a press outside the menu;
- markers that step upwards, never back onto words, and sit above the words' end when there is no room past it.

The shots don't change: none of them has two markers on one line or words at the frame's edge.

**Not a product fault, noted.**
- A synthetic ⌘/ sent over CDP while the webview's body had the focus zoomed the window out. It was reset with View: Reset Zoom; a real key in the editor (the caret in the slide) opened the comment.
- The dev build shows "Activating extension 'GitHub.copilot-chat' failed" at start. It is the dev tree's own extension, not Ritemark's, and was cleared before the shots.

**Not in this run**
- Sending to an AI (no sign-in, as the brief says). That path is proved by tests up to the queued message and its slide chip.
- See what changed and Undo on an answer: not built. The coordinator's call keeps today's card.
