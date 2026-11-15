# Sprint 157: the rundev checklist (technical plan §8)

Run on Sunday 15 November 2026 on `sprint-157-decks` at 4ba08c88 plus a193a4b5 (docs), in this worktree's own dev build (VS Code pin d956e8a6, the 19 patches). There were two hidden launches through `scripts/qa/dev-launch-isolated.sh`:
- the PR 4 host check, before #717 merged;
- this checklist.

Both used isolated AI homes, `--use-mock-keychain`, a fresh `--extensions-dir`, `RITEMARK_BUILD_CHANNEL=test` and a dead PostHog address (`127.0.0.1:9`). I drove them over CDP, ran them on a copy of [the demo project](../demo-project/README.md), and stopped each at the end (`LEFT=0`). Jarmo said the 18:00 wait doesn't apply on Sundays ("ei pea ootama pühapäeval").

Keys: the test vault holds only the Gemini key, which came in through `scripts/qa/with-test-keys.sh --only gemini`. Jarmo signed in to ChatGPT himself, in the test window itself (his answer, 15 November), so the sign-in landed in the run's isolated Codex home and not in his own. Nothing was copied from `~/.codex`.

| # | Item | Result |
| --- | --- | --- |
| 1 | Flag off: a deck opens as a document, one edit saves only that line, no place, no tools | **Pass.** The deck opened in the Markdown editor with its fences as code. One added sentence saved as exactly one changed line (line 18). The places row had no Slide library, and "Slide library" appeared nowhere. |
| 2 | Open, scroll, thumbnails; type in the handout; undo | **Pass.** Thumbnail 7 made slide 7 current and marked its part. Scrolling the handout moved to slide 11. Words typed in the handout and then ⌘Z: the words were gone. |
| 3 | Widths, both side columns, Card and Borderless | **Partly.** At 1900 the strip shows. At 1440 and 1200 with both side columns open, the deck gets 784 and 608 px: the strip folds and the slide and handout split 60:40, as the Experience lead's answer 4 says. The nine kinds in Card and Borderless were checked in the harness in PR 2, not one by one in this window. |
| 4 | Settings: kinds, looks, Picture, Skip | **Pass, partly.** On slide 2: Boxes, Picture Right and Skip were written to the file (`slide boxes`, `picture: right`, `skip: true`). The thumbnail shows the skip mark and the stage shows the picture place on the right. Picture Left and Behind, and the box looks, were checked in the harness (PR 3), not here. |
| 5 | The strip: +, drag, Duplicate, Delete, undo | **Pass except drag.** Duplicate (14 slides), Delete with the bar's Undo (back to 14), + between thumbnails adding a Points slide (15), and the file holding 15 slides. Drag was checked in the harness (PR 3). |
| 6 | A picture pasted and dropped | **Pasted: pass.** A PNG pasted on a Statement slide was saved as `Harbour Logistics/images/board.png`, and the slide became `slide picture` with `image: images/board.png`. Dropping was not tried in this window. |
| 7 | The library | **Pass (the PR 4 run, real files).** Insert from a topic, with its `from:`. Keep it here. Update the library: the topic's diff is that one slide. The other copy then shows the amber dot. Use it. Add to library through the topic quick pick. A copy from a subfolder with pictures: the demo has no pictured library slide, so not tried. |
| 8 | A writer's change while the deck is open, as one undo step | **Not proven.** A plain write to the file on disk reached the open deck after a few seconds, but one ⌘Z didn't take it back. That isn't this item's case, which is an AI's edit through the writer's-copy merge, and no AI edited the file's text in this run. |
| 9 | Two views of one deck stay in step | **Not run.** I didn't open a second view over CDP, because "Open to the Side" lives in the workbench, not in Home. |
| 10 | Each runtime lists, reads and inserts | **ChatGPT: pass.** "Find our slide in the Slide library about a scheduled prompt, step by step, and insert it after slide 4 of this deck." ChatGPT (GPT-6.1 Sol) called the deck tools and inserted "A scheduled prompt, step by step" as slide 5, with `from: Slide library/Agents.deck.md#g2 @3flaj0`, through the open deck. One ⌘Z took the whole insert back in the view and the file (the Experience lead's point 4). **OpenCode: not proven.** On the Gemini test key, Gemini never answered: OpenCode logged "Provider response headers timed out after 300000ms" twice, and nothing was inserted. **Claude: not run.** There is no Anthropic test key ("Not made" in the test-keys registry), and test windows aren't signed in. Jarmo tries Claude in his own rundev. |
| 11 | The frame with the flag on; the first frame on a fresh profile with the flag off | **Flag on: pass.** The place sits after Tasks with the books icon. **Flag off:** after a reload with the flag off, no Slide library place shows. The very first frame of a new profile wasn't captured. Codex flagged that gap on #717: the frame manifest seeds the place before the extension can hide it. Patch 002 fixes it before any merge to main. |
| 12 | New → Deck | **Not built.** PR 6 is skipped in this cut (see below). |

Screenshots: `qa/rundev/` (this run) and `qa/pr4/rundev-*.png` (the library run).

## What the run found besides the checklist

- **Search shown twice in the Slide library place (fixed in #717).** The frame's head-row Search and the panel's own search field were shown one above the other. The panel's field now shows when Search is pressed, as in Tasks.
- **The Copilot Chat activation error** (a toast in the dev window). The exact line, from the window's `exthost.log`: `Activating extension GitHub.copilot-chat failed due to an error: Error: The default value for setting chat.cli.planExitMode.enabled is different in packageJson and in code`. It is thrown at `extensions/copilot/src/platform/configuration/common/configurationService.ts:545`.
  - The cause is a stale build in the dev tree. This worktree's `vscode/extensions/copilot/dist/extension.js` is dated 1 September and defaults the setting to `false`, while `package.json` at the pin says `true`.
  - So it comes from neither the pin's sources nor our patches. The `vscode/` tree was cloned from the main checkout's, which carries the same stale `dist/`.
  - Patch 004 says release builds delete the built-in Copilot, and the installed Ritemark.app has no Copilot extension. So shipped 2.2.0 users shouldn't see it. A fresh `compile-extensions` of `copilot` in a dev tree would clear it there.
- **OpenCode reads the person's own `~/.claude/skills` in a test window.** Its log shows `duplicate skill name ... existing=/Users/jarmotuisk/.claude/skills/...`. HOME isn't changed, so the isolated AI homes don't cover it. It reads only and writes nothing, but a test run can carry the person's skills into the model's context.
- **The worktree had no bundled agent binaries.** `binaries/agents/` is gitignored, so OpenCode first said "OpenCode runtime not found". The `darwin-arm64` folder was then cloned in copy-on-write from the main checkout, after checking that the manifests are equal.
- **Home came to the front once on its own** during the Settings and picture steps. The deck kept working in its retained view, but the screenshots of those steps show Home. I didn't find why; it is noted, not explained.
- **A code block "Näidisprompt"** appeared in the duplicated "Shared prompt board" part. Jarmo typed it himself in the test window (his answer, 15 November). It isn't a defect.

## PR 6 (New → Deck): skipped

This cut leaves out PR 6, which the plan marks optional. A deck is made by copying an earlier `.deck.md` or with the AI's help. New → Deck, empty or as a copy, goes into the next cut.
