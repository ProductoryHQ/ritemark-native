# PR 3 proof: the handout page

The page was built by `buildDeckPage` from the demo deck (`docs/development/sprints/sprint-157-decks/demo-project/Harbour Logistics/AI assistants and agents.deck.md`, a copy outside the repo), written beside it by `writeDeckPage`, and opened from disk in a headless Chromium (agent-browser, its own profile). Nothing was published. The deck's 13 slides give 12 on the page: slide 12 (a Picture slide) is skipped.

## The fault first: each privacy rule taken out

Each of `publicDeck`'s rules was taken out in turn and `publicDeck.test.ts` run; each time the test failed and named the word that leaked, and passed again with the rule back.

| Rule taken out | The test's failure |
| --- | --- |
| Skipped slides kept | `skippedTitle: "SKIPTITLEQXN" must not go public` |
| Notes fences kept | `strayNotes: "STRAYNOTESQXF" must not go public` |
| Comments kept | `standaloneComment: "STANDALONEQXI" must not go public` |
| `<mark>` tags kept | `anchoredComment: "ANCHOREDQXG" must not go public` |
| Every word of a slide kept | `id: "idqxc" must not go public` |

The same 21 test words are checked in the page's bytes (`pageHtml.test.ts`) and in every file 2.2's gather sends (`pageFile.test.ts`, a real project on disk: the page and the one picture a shown part uses; no `.md`, no picture only a skipped slide uses, no key-shaped hit with the fonts inlined, `scriptBuilt` false).

## The fault first: the page's stored XSS (security review, round 1)

Handout text after an inline `<code>`, `<pre>`, `<kbd>` or `<script>` reached the page unescaped: marked 4.3 goes into its raw mode there, so a tag marked doesn't read as one went onto the page live. The fix has two layers, a tokenizer that never enters raw mode and a `text()` that escapes any bare `<`, with a Content Security Policy on top that allows only the page's one script, by its hash. Each layer was taken out in turn and the handout `See <code> <svg/onload=alert(1)>` rendered:

| Taken out | The handout's HTML | `pageHtml.test.ts` |
| --- | --- | --- |
| Both layers (the code before the fix) | `<p>See &lt;code&gt; <svg/onload=alert(1)></p>`: a live tag | fails: `"See <code> <svg/onload=alert(1)>" gave …<svg/onload=alert(1)>…` |
| The tokenizer reset only | `<p>See &lt;code&gt; &lt;svg/onload=alert(1)></p>`: no tag | fails on the exact words |
| The `text()` escape only | `<p>See &lt;code&gt; &lt;svg/onload=alert(1)&gt;</p>`: no tag | passes |
| Nothing (the fix) | `<p>See &lt;code&gt; &lt;svg/onload=alert(1)&gt;</p>` | passes |

The regression test runs each of the four tags, with `<svg/onload>` and two `<img/…/onerror>` forms, in a paragraph, a later paragraph, a heading, a list, numbered steps, a table cell, link text and a quote. In the shots below the page runs under its policy with no page error and no refusal in the console.

## The page, at 1440 × 900 and 390 × 844

| Shot | Shows |
| --- | --- |
| `pr3-page-top-*.png` | The top: client and session, 1 / 12, Contents; on a computer the slide on the left, centred, arrows under it; on a phone the slide at the top, the text under it. |
| `pr3-section-band-*.png` | Section 1 as the grey band with "Section 1" over its title, the current part (4 / 12), reached from Contents. A section that isn't current keeps its band and dims its words as the other parts do (the top shots, and Section 2 in the ticks shots). |
| `pr3-copy-copied-*.png` | Copy on a prompt says Copied. |
| `pr3-copy-fallback-*.png` | With no clipboard and a refused copy command: the prompt's words selected, and "Selected. Press Ctrl+C or ⌘C to copy." |
| `pr3-copy-fallback-touch-390.png` | The same on a touch screen (`pointer: coarse`, a touch context in headless Chromium): "Selected. Tap Copy in your phone's menu." |
| `pr3-ticks-after-reload-*.png` | The exercise's four steps ticked, then the page read again: still ticked (`[true,true,true,true]`). |
| `pr3-contents-*.png` | Contents, every part by number and title, sections bold, the finished exercise with a tick. |
| `pr3-borderless-*.png` | The same deck with `look: borderless`: the slide's words on white. |

## The scroll rule

One 400 px wheel turn at a time at 1440 × 900, the slide shown after each turn. Down: `2 3 4 5 6 7 8 9 10 11 12 12 12 12`; up: `11 10 9 8 7 6 5 4 3 2 1 1 1 1`. One part at a time, both ways, none skipped. `pageScript.test.ts` runs the page's copy of the rule and `scrollRule.ts` over 10,000 generated states and they agree on every answer.

## The text before the first slide

`pr3-preamble-in-the-deck-view-1440.png`: a dev window (PR 4's run, isolated) shows a deck's handout with the text before the first slide at its top, above the first part ("Words before the first slide: PREAMBLE-VISIBLE."). So the page shows it too, without its private parts, as `publicDeck.test.ts` says.

## Not verified here

- That the deck view's fit steps give the same fit on the page. They reach the page in PR 4, where every thumbnail of the demo deck measured 0.
- Safari and Firefox; a real phone.
