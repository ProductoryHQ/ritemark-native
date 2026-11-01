# Sprint 152 QA evidence

E1: each requirement's check, failing on `main` first and passing on its branch. PR 1's rows are below; PR 2 adds its
own. Every run here is the Mac, a hidden dev instance of the PR's tree (VS Code `d956e8a6` with the 19 patches), with
scratch profiles and AI homes, signed in to nothing.

## PR 1 (`sprint-152-startup-contract`)

| Req | Check | On `main` (`f84f4513`) | On the branch |
| --- | --- | --- | --- |
| R8 | `project-check.mjs --first-frame`, five runs of each start with the extension host held 10 s | Fails in every start, the runs agreeing (A1, *The failing set*) | The check itself is this PR; the same starts on the branch (two sets) give the same moves except R6's (below), all of them the shell's, for PR 2 |
| R5 | `startLook.test.ts`: the messages in A4's orders, at each step what the view draws | The gate alone (main's view) draws the empty chat, then the AI's sign-in screen, then "Almost there!" (the test's last block asserts it) | The mark until the look is certain, then one look: "Almost there!" not signed in, the chat signed in or with a conversation, never a sign-in screen before the chat; a lost onboarding status settles after 2 s; a failed start is its own look |
| R5 | The AI column traced in the running app (A4's tracer), not signed in, Claude chosen | First window: ground, the view's empty frame, "Preparing Agent Chat…", the empty chat, "Sign in with Claude.ai…", "Almost there!" at 2.5 s. Held start: the shell's mark, then 0.33 s of bare ground, then the card | First window: ground, the view's ground while its mark waits for its second, its mark at 1.13 s, "Almost there!" at 2.66 s. Reload: the same, "Almost there!" at 2.25 s. Held start: the shell's mark from 1.25 s, the view's mark at 11.15 s with the shell's still under it (no bare ground), "Almost there!" at 12.97 s |
| R5 | The two marks' places | — | Both centred at (1244, 456) in workbench pixels: the shell's in its pane `[1048, 44, 392, 824]`, the view's at (196, 412) in its window, whose frame is that same box |
| R5 | `aiStartingMark.test.ts`: the column's first frame, the mark's wait and turn, the ring's values | No such mark in the view | The view's mark waits the rest of the second, or shows at once turned to where the shell's is; the same ring and words as patch 018's |
| R6 | `project-check.mjs --first-frame relaunch --ai-closed` | 5 of 5: the AI column the person closed opens at Ritemark's start (+11.0–11.2 s), the desk 400 narrower | The AI column stays closed (no AI column move); the start still fails on the shell's moves (a stored place at +0.24 s, the terminal tab's name at +2.36 s), which PR 2 removes |

Screenshots of the AI column's start on the branch, not signed in, Light and Dark: `qa/r5-light-*.png`, `qa/r5-dark-*.png`
(the view's mark; the 10 s line before and after the view has read which AI, held there by pausing the extension host
over its inspector; "Almost there!"; the failure, from an `agent:bootstrap-error` delivered to the view as the host
sends it). Signed in: not run (no signed-in AI in a scratch home).

Tests: the extension's `npm test` (with the two new files), the webview's `tsc --noEmit`, the extension's `tsc --noEmit`.
