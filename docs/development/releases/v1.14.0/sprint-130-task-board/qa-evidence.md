# Sprint 130 QA evidence

**Run:** 2026-10-13, on `sprint-130-task-board` (W6 at `57b593bb`, then the QA fixes listed below).
**Where:** a dev instance of this worktree (macOS, Apple silicon), its own profile and two test folders (`rm130-w6ws` with seeded cards, `rm130-empty` with none), driven over CDP. The VS Code tree was recompiled with main's current patch 009 (#414) first, so the run covers the browser bridge as it ships.
**Runtimes:** Claude Code live. Codex is signed in on this Mac but is kept out of dev tests (re-signed dev binaries can trigger keychain prompts). OpenCode has no key in this profile ("Not set up"). The Codex and OpenCode rows are on the Gate 2 list below.

## Automated

| Check | Result |
|---|---|
| `npm test` (extension and webview tests in one chain, incl. `taskBoard/*`, `ideaReview`, `ritemarkTools`, `commentTaskBridge`, `taskCopy`) | Pass |
| `npm run test:conversations` (title generation on the shared one-shot runner) | Pass |
| `npm run test:editor-sync` (card mode) | Pass |
| `npm run compile` (`tsc --noEmit` + esbuild), webview `tsc --noEmit` and `npm run build` | Pass |
| Pre-commit validator by hand, `CLAUDE_PROJECT_DIR="$PWD"` | Pass |

## Scenarios

"Claude" = run with Claude Code. "Earlier" = checked live during the build and not repeated.

| # | Result | Evidence and notes |
|---|---|---|
| S1 | Pass | Tasks sits just above Transcribe; empty text, "Add a task…" and the board button. No `.ritemark/tasks/` until the first card (`.ritemark/flows/` appears on open: Flows' storage, not this sprint). |
| S2 | Pass | No-folder window: "Open a folder to keep a task board" with Open folder…; nothing written. |
| S3 | Pass (Claude) | Flag off: "The task board is turned off.", no badge. Claude, asked without tools: no `ritemark_board` tool, no TASK BOARD section, browser tools present under their v1.13.0 names. |
| S4 | Pass | Badge 3 with the tooltip "3 tasks need you"; it follows the calls as they come and go (count also unit-tested). |
| S4a | Pass (Claude) | Side bar: Your calls panel, "oldest …", "1 agent can’t continue until you answer". Board: "3 wait on you · oldest just now · 1 agent blocked", amber/accent left bars, "Your move" tags; the header opens Your calls. |
| S5 | Pass | Card at the top of To do on both surfaces, field keeps focus; file `draft-the-workshop-agenda.md` (`<slug>.md` since D14) with `ritemark: task/1`, `stage: todo`, "Created". |
| S6 | Pass | Board button, then "Tasks: Open Board": one Task board tab. |
| S6a | Pass | "Tasks: Add a Task…" from a document: card on top of To do, and the next keystroke lands at the document's cursor. |
| S6b | Pass | Tick circle → Done, "Marked done"; Reopen on the page → top of To do, "Reopened". |
| S6c | Pass (Claude) | Next up on both surfaces. The hint is the Done when field's placeholder on the card page (D14): "What does done look like? One line. Agents finish better with it." `done_when` written; the first message reads title, "Done when: …", body, "Files: …", with no instructions. |
| S7 | Pass | Drag To do → Doing changes only that card's file ("Moved to Doing"); More actions → Move to → Done; the page's stage menu. |
| S7a | Pass (Claude) | Working card's menu: Open conversation, Stop, Archive and Delete disabled "(stop the agent first)" (design §row menus). Dragging it out of Doing keeps it there: "The agent is still working on this card. Stop it first, or wait until it finishes." |
| S8 | Pass | Title, Done when and body edited on the page; a key added by hand (`owner`) survives. Limit: a YAML comment beside it is not kept. Files are added through the system file picker, which this run cannot drive. |
| S8a | Pass | Earlier (2026-10-12, all surfaces, reused tab); the side bar highlight re-checked today. |
| S8b | Pass (Claude) | Result under the title with Check these, Mark done, Ask for changes…; Mark done → Done with Reopen. |
| S8c | Pass | Earlier (2026-10-12): typing kept while the board writes, no conflict. |
| S9 | Pass after fix | Deleting a file a card names now shows it missing within 1.5 s, and recreating it clears that (fix 1). The outside-project refusal needs the system picker: Gate 2. |
| S10 | Pass | Card gone from the folder, both surfaces and the Log. The file goes through `workspace.fs.delete(…, { useTrash: true })`; macOS privacy keeps `~/.Trash` unreadable to this run: Gate 2 (look in Finder's Trash). |
| S10a, S10b | Pass | Earlier (2026-10-13). Today also: Archive disabled with its reason on a working card. |
| S10c | Pass | Enter deletes. |
| S11 | Pass | Board on Ideas, window closed and the folder reopened: back on Ideas. |
| S12 | Pass | A title changed in another editor showed on both surfaces in 0.37 s; `git checkout` between branches with and without a card adds and removes it. |
| S13 | Pass (with fix 5) | "Couldn’t read this card. The front matter is not valid YAML (…)." listed on both surfaces; clicking opens the plain text editor; other cards keep working; the broken file was byte-for-byte unchanged after more than 30 minutes of board use. |
| S14 | Pass | A copy shows as a second card; its first change gives it a new id and "Copied from bv1234". |
| S15 | Pass | Half-written `*.md.tmp-*` and `.tmp-*` files are ignored. Killing the extension host in the middle of a write was not timed; tmp-then-rename is unit-tested (`BoardStore.test.ts`). |
| S16 | Pass (Claude) | Card to Doing, Working · Claude; a new rail conversation "Draft the workshop agenda — Working"; the open chat stays open. Sending… and Queued were seen earlier (2026-10-12); today they passed faster than a 100 ms sample. Focus could not be observed (the app was not the frontmost application); the no-focus path is probe P7. |
| S16a | Pass (Claude) | AI sidebar hidden → Give shows it again; the Tasks side bar stays. |
| S16b | Pass (Claude) | The Tasks side bar stayed through every card turn. |
| S17 | Pass (Claude) | Report as the result, "Claude finished in 20s", Changed `agenda.md`, in Your calls; file has `result` with `files`, `seconds`, `check` and "Finished: …". Codex/OpenCode last-message summary: Gate 2 (G4 unit-tested). |
| S17a | Pass (Claude) | "2 to check" on the call; both items on the page and in `result.check`. |
| S18 | Pass (Claude) | Ask for changes… "Shorter, please" → same conversation, Working, new result; Mark done leaves Your calls. |
| S19 | Pass (Claude) | AskUserQuestion mid-turn → "Needs you · question", no answer box on the board, Open conversation; answered in the sidebar → Working · Claude before the turn ended. |
| S20 | Partial | Codex is signed in here, so "Sign in required" cannot be shown; OpenCode's "not ready" is shown and disabled in every agent menu. Gate 2 with Codex signed out. |
| S20a | Pass, choice not run | Give to…, Review with…, Retry with… list Claude Code, Codex, OpenCode; the note box's Send to Claude ▾ and Retry with Claude ▾ have the agent menu. Choosing Codex runs Codex: Gate 2. |
| S21 | Pass after fix | Stop → "Stopped", Give to… again. Give again or Retry after the stop used to sit at "Queued" (fix 3); now Retry goes straight to Working · Claude. Failed with the network off: not run (unit-tested); Gate 2. |
| S22 | Pass (Claude) | Window closed mid-turn and reopened: "Interrupted when Ritemark closed" with Retry with Claude. |
| S23 | Pass (Claude) | Three cards, three conversations, each followed its own turn. |
| S23a | Pass (Claude) | "“Write the glossary” is working on glossary.md right now…" with Wait for it, Start now, ×; Wait for it → "Starts after “Write the glossary”" → started by itself, history "Started after “Write the glossary” finished". |
| S23b | Pass (Claude) | "3/3 full", side bar "Doing · 3/3"; "Doing is full: 3 of 3…" with Queue it, Start anyway; Queue it → started when a card was marked done ("Started when Doing had room"); No limit → a queued card started at once. |
| S23c | Pass after fix | Six long cards, no Doing limit: the sixth read "Starts when the AI sidebar has room" and now starts 89 ms after the first of the five finishes (fix 4); before the fix it waited for the next unrelated turn end. |
| S24 | Pass (Claude) | A card with a result copied to the other folder: result and history, no Open conversation; Ask for changes started a new conversation there. |
| S25 | Pass after fix | A card answer queued behind a running turn offers Remove only (no Edit); removing it leaves the card "Stopped" with Give to Claude (fix 2; it read Ready to review before). |
| S26 | Pass (Claude) | Decision for you with both options and Something else…; "Trainers first" → "You chose: Trainers first", the call goes, a new turn runs. |
| S26a | Pass (Claude) | Needs you → decision → review order seen live; failed and the stopped-card exclusion are unit-tested. |
| S27 | Pass (Claude) | Three cards in To do from `notes/meeting.md`, each "Created" by claude. Codex, OpenCode: Gate 2. |
| S28 | Pass (Claude) | Claude declined from its instructions ("Only you can mark a card done") without calling `move_card`; the card stayed in To do. The tool's own refusal is unit-tested. |
| S29 | Pass (Claude) | Manual mode: listing cards and editing Done when asked nothing; the file write waited for approval. |
| S30 | Pass (Claude) | Card turn: `browser_navigate`, `browser_snapshot`, `browser_click`, then `report_result`. Browser Recent listed both pages the agent opened, with titles (also #414's agent-navigation case). Codex, OpenCode: Gate 2. |
| S31, S31a | Pass (Claude) | W6 live run: two reviews at once, Good to go and Already on the board, no conversation created, Make it a task from the Ideas tab and the card page, Drop and Bring back. |
| S32 | Not run | Taking the agent offline was not safe here; the failure words and states are unit-tested (`ideaReview.test.ts`, `BoardController.test.ts`, `taskCopy.test.ts`). Gate 2. |
| S33 | Pass | Log shows Today, then Yesterday, local times, every entry a link to its card. |
| S34 | Pass | Side bar at 280 and 420 px: no horizontal scroll, no wrapped button row, no two-line button, no title cut before two lines; option buttons truncate to one line and their tooltip has the full text; icon tooltips on hover. Keyboard-focus tooltips: with S35. |
| S35 | Not run | Needs keyboard focus in the app, which this run cannot take while the Mac is in use. Gate 2. |
| S36 | Pass (Claude) | A comment sent to the open conversation: "Needs your input" for its question, answered → "Claude is working" again (G3), then "Claude completed this task". Codex/OpenCode conclusion summary (G4): Gate 2. |
| S37 | Pass | Home reads "New AI conversation" and opens a new conversation. |

## Defects found in QA and fixed on the branch

1. **S9.** A file a card names was re-checked only when a card changed, so a deleted file looked present. `taskBoardHost.ts` now watches the project for created and deleted files and refreshes the board, at most every 400 ms.
2. **S21, S25.** A stopped follow-up on a card with an earlier result read "Ready to review" and counted as a call; the spec says Stopped, and not a call. `deriveWho` checks a stopped handoff before the waiting result (`BoardController.test.ts`).
3. **S21, S22 (and comment tasks).** Stopping a turn pauses that conversation's queue, so Give again, Retry, a follow-up or an answer sat at "Queued" until the user found Resume in the sidebar. The sidebar now runs a host task that heads a paused queue, as Resume would; prompts the user queued earlier still wait (`commentTaskBridge.test.ts`, which fails without the fix).
4. **S23c.** Task listeners hear that a turn ended before its conversation record is checkpointed, so the capacity check still counted the finished conversation and a waiting card waited for the next unrelated turn end. `UnifiedViewProvider` remembers each conversation's last ended turn and counts a record still showing it as idle.
5. **S13.** The YAML parser's message ended in "…column 1:)." The trailing colon is dropped (`cardFile.test.ts`).
6. **House rules.** The task UI's hand-rolled controls became shadcn `Button` (toast dismiss, Add files…, both Show all links, the waits pill, the Doing limit, the tick circle, the file chip, the section toggles; their look was measured unchanged), and the buttons without a tooltip got one (both Show all links, the title links in Your calls, Ideas and the Log). Whole-row click targets and title links stay plain buttons, as in the conversation list.
7. **W6.** "reviewed by Claude just now ago" (in the W6 commit).
8. **Windows file names (found by reading, for the Windows test).** A card titled "Con", "Nul", "Com1"… would be named `con.md`, which Windows reserves even with an extension. Such names get `-task` (`cardFile.test.ts`).

9. **The board's tick circle (Windows test W2, not Windows-specific).** On a board tile the circle sat in the layer that lets clicks fall through to the tile's open-the-card button, so clicking it opened the card instead of marking it done; the side bar's circle sits outside that layer and worked. The circle now takes pointer events. `boardClicks.test.ts` renders the board, Your calls and Ideas and fails on any button, link or field inside a pass-through layer (it caught exactly the two To do circles before the fix). Checked on the Mac dev instance with a real mouse click: the card went to Done and no page opened; the title and the count chips still open the card. S6b had been checked in the side bar only.

The `qa-validator` review (T8.4) of `bb3c5005` returned FAIL on one item, fixed: `scripts/validate-qa.sh` still ran the deleted `BrowserToolsInjector.test.ts` for agent changes; it now runs `ritemarkTools.test.ts` and matches the new runtime files. Its minor findings are fixed too (stale old-name comments, `AGENTS.md`'s locked decision, three more hand-rolled buttons, `tasks.md` T3.9).

`scripts/qa/make-windows-test-overlay.sh` now carries `media/*.svg`, so the Windows overlay shows the Tasks activity-bar and board-tab icons.

## Windows test list (overlay, before the admin merge)

**Setup.** On the Windows PC, the PR's "Windows test overlay" artifact for the head commit, laid over the installed Ritemark with `scripts/qa/windows-branch-test.ps1 -Overlay <zip>` (fresh profile). A test folder, e.g. `C:\Users\<you>\Documents\RM130 Test`, with `docs\notes.md`, `docs\plan.md` and `notes\meeting.md` holding three "- " action items. The overlay is extension-only: the browser tools are macOS-only, and Browser Recent needs the v1.14.0 app, so neither is part of this test.

| # | Covers | Steps | Expected |
|---|---|---|---|
| W1 | S1, S5, file names | Open the folder, click **Tasks**. Add "Draft the workshop agenda", the same title again, "Õppekava ülevaade", "Con", and `Plan: Q3 / "draft" <v2>?` | Tasks sits above Transcribe. Each card lands on top of To do. In Explorer: `.ritemark\tasks\draft-the-workshop-agenda.md`, `draft-the-workshop-agenda-2.md`, `oppekava-ulevaade.md`, `con-task.md`, `plan-q3-draft-v2.md`; no error |
| W2 | S6, S7, S6b | Open the board with the side bar's board button, then "Tasks: Open Board". Drag a card To do → Doing; on another card choose … → Move to… → Done; click a To do card's circle | One Task board tab. Each move changes only that card's file, with "Moved to Doing" / "Marked done" in its history |
| W3 | S8, S8a, S8c | Click a card. Edit its title, Done when and body. Click another card without editing; then type in a page and, while typing, move that card on the board | The card opens as a page with the strip and no front matter; an unedited page is replaced in the same tab; typing is kept and no "file is newer" conflict appears |
| W4 | S12, S14 | Change a card's `title:` in Notepad and save. Copy a card file in Explorer (Ctrl+C, Ctrl+V), then move the copy to Doing. Delete a card file in Explorer | The new title on both surfaces within a second; the copy shows as a second card and gets a new id and "Copied from …" on its first change; the deleted card disappears |
| W5 | S9, Windows paths | On a card page, **Add files…** → `docs\plan.md`; then pick a file on another drive or outside the folder; then delete `docs\plan.md` in Explorer | The chip reads plan.md and the file lists `docs/plan.md` (forward slash) and opens on click; the outside file is refused with a sentence why; the chip turns "missing" within about two seconds |
| W6 | S10, S10c | … → Delete… on a card, press Enter. Then restore it from the Recycle Bin | The card is gone from both surfaces and the Log, its file is in the Recycle Bin, and it comes back on the board when restored |
| W7 | S10a | … → Archive on a card; open Archived at the bottom of the side bar; Restore | It leaves the board and Your calls, is listed under Archived, and returns to its stage with "Restored" |
| W8 | S16–S18, S21 | **Give to Claude** on a card with a Done when line and `docs\notes.md` in Files. When it is Ready to review, press Ask for changes… "Shorter, please"; on another card press Stop, then Give to Claude again | Sending… → Working · Claude in a new conversation (the open chat stays open); Ready to review with the report, Check these, the changed files as project paths and the time; Ask for changes runs in the same conversation; after Stop the card reads Stopped and Give again starts at once (not stuck at Queued) |
| W9 | S16–S18 with Codex (**needs Jarmo to sign in to Codex**) | After signing in, Give a card to Codex; then Review an idea with Codex | The card's conversation runs on GPT-6.1 Sol (the default from #418); the result is Codex's conclusion, not its first sentence; the review comes back with a verdict |
| W10 | S16–S18 with OpenCode (only if a key is set in Settings) | Give a card to OpenCode | As W8; OpenCode's board tools work on Windows (they reach Ritemark through a named pipe) |
| W11 | S27–S29, each runtime | In a new chat (Claude, then Codex and OpenCode where signed in): "Turn the action items in notes\meeting.md into cards in To do". Then "Mark one of them done". Switch the chat to Manual and ask it to set one card's Done when | Three cards appear, "Created" by that agent; marking done is refused ("Only the user marks a card done") and the card stays; no approval is asked for the board change |
| W12 | S31, S32 | Ideas tab: write an idea, **Review with Claude**, then Make it a task | "Reviewing · Claude", then a verdict, one sentence why, a size and a suggested task; Make it a task moves it to the top of To do with the suggested title |
| W13 | S22 | Quit Ritemark while a card works; start it again with the script | The card reads "Interrupted when Ritemark closed" with Retry; Retry starts it |
| W14 | Dark mode | Switch to the dark theme; look at the side bar, the board (all tabs), a card page and a Delete dialog | Everything readable; outline buttons are dark, not white; no white panels |
| W15 | S34 | Drag the side bar to its narrowest (about 280 px) with some decisions in Your calls | No horizontal scroll, no button row wraps, long options cut to one line and show their full text on hover |
| W16 | S35 | Keyboard only: add a card, open it, move it to Doing, give it to Claude, open its conversation, mark it done | All reachable by Tab, Enter and the arrow keys, with visible focus |

## Gate 2 list (v1.14.0)

- Give to agent, follow-ups and results with **Codex** and **OpenCode** (S16–S19, S21–S23, S27, S30, S36's last-message summary), and Review with either (S20a's choice).
- S20 with Codex signed out; S21 failed with the network off; S32 a review while offline.
- S35 keyboard only, and S34's tooltips on keyboard focus.
- S9's outside-project refusal and adding files through the picker (system dialog).
- S10: the deleted card file is in the Trash.
- From #414, now seen with Claude on Mac in a dev build: agent navigation in Browser Recent. Windows remains on #414's list.

## Seen during QA, outside this sprint (not changed)

- `ritemark.ai.selectedModel` defaults to `claude-sonnet-4-5` in `package.json` (also on main), so a fresh profile's first chat says "claude-sonnet-4-5 isn't available right now — using Sonnet 5.5". It is also a model ID outside `modelConfig.ts`.
- One conversation got an Estonian title from an English message (title-language issue of 2026-09-23); title generation is unchanged apart from moving onto `runOneShotTurn`.
- The dev build's activity bar shows "Chat" and "Chat Debug", and a fresh profile opened on an empty Chat panel; not checked in the installed app.
- In a window with no folder, the AI sidebar's Claude session runs in the app's working directory (`workspacePath` is empty).
