# Sprint 140 QA evidence

26 October 2026, on the Mac (Apple silicon), the sprint branch's dev build. Each check launched hidden with its own short profile under `$TMPDIR`, `--use-mock-keychain`, `RITEMARK_BUILD_CHANNEL=test`, CDP on 9232, and usage data pointed at a local stand-in on 127.0.0.1:9241 (nothing left the Mac). Driven over CDP; screenshots in `qa/` (halved to 1440 × 900). The only AI signed in was ChatGPT (Jarmo's existing sign-in; nobody signed in or out). Claude had no readable sign-in, OpenCode no test key; Windows was not run.

Fixtures: Training work (the spike's 37 files, plus `Notes/Long draft.md` of 903 words and `Notes/Sessions.csv` for S36–S37), Board report 2027 (empty), Leadership programme (the sample).

Unit tests: `npm test` in `extensions/ritemark` (all pass, with the new `guidance.test.ts`, `startingPointWords.test.ts`, `feedback.test.ts`, and the changed `home.test.ts`, `consent.test.ts`, `analytics.test.ts`, `capabilityContext.test.ts`, `chatLinks.test.ts`); VS Code's `ritemarkFeedbackSheet.test.ts` (4) and `menubarControl.test.ts`; `typecheck-client` clean; patches applied from the pin, a second run clean, the stacking check and the pre-commit validator passing.

## Scenarios

| | Result | Evidence |
|---|---|---|
| S1 | ChatGPT passes on the Mac; Claude, OpenCode, Windows not run | `research/word-spike.md` |
| S2, S3 | Not applicable: R1a is not built | — |
| S4 | The honesty line is built (capability context v3); not run with it | `capabilityContext.test.ts` |
| S5 | ChatGPT passes on the Mac | `research/word-spike.md` |
| S6 | Pass: Waiting for you, the one card, Start something | `qa/light-f1-home-card.png` |
| S7, S8, S9 | Unit tests only (`guidanceCard`'s order) | `guidance.test.ts` |
| S10 | Pass: the card, its counts line and note, as frame 1 | `qa/light-f1-home-card.png` |
| S11 | Unit tests; 10,400 names in 34 ms, "More than 10,000 files." | `guidance.test.ts`; `research/confirmations.md` |
| S12 | Not run (no synced folder) | — |
| S13 | Pass, Light and Dark | `qa/light-s13-empty-project-card.png`, `qa/dark-s13-empty-project-card.png` |
| S14 | Pass, Light and Dark | `qa/light-s14-sample-card.png`, `qa/dark-s14-sample-card.png` |
| S15 | Dark passes; keyboard and screen readers not run | the dark shots |
| S16 | Partly: Ask with's menu, its states (Claude "Sign in", ChatGPT ✓, OpenCode "Set up") and its place under the button; choosing another ready AI not run (one AI ready) | `qa/light-f1-ask-with.png`, `qa/dark-f1-ask-with.png` |
| S17, S18, S19 | Not run: no sign-in, no OpenCode key, and no way to have no AI ready without signing out | — |
| S20 | Pass with ChatGPT (sent at once, the chat in front, answered) | earlier run in profile b |
| S21 | Pass: "This project is for " in the box, caret at 20, focused, nothing sent | `qa/light-s21-empty-filled.png` |
| S22 | Pass with ChatGPT: Give of `m4d7r2`, Doing, then Ready to review, Module 4 written, the chat on the rail. About 15 s before the board showed it: the button now waits (`7e857e0f`) | `qa/light-s22-after-give.png` |
| S23 | Not checked | — |
| S24 | Pass: gone once answered (folder and empty kinds); a gone card stayed gone after a restart (profile c). Reload Window after "answered" not checked on its own | CDP log |
| S25 | Not run (no free plan, network not cut) | — |
| S26 | Pass: a chat of one's own took the card away | `qa/light-s26-home-after-own-chat.png` |
| S27–S30 | Unit tests only | `guidance.test.ts` |
| S31, S32 | Not applicable: R7 is not built | — |
| S33 | Pass | `qa/light-f1-home-card.png` |
| S34 | Pass: This project is for… · Plan a first document with me | `qa/light-s13-empty-project-card.png` |
| S35 | Pass with the spike's gate closed: a Word file and a PDF in front show the project's points | CDP log |
| S36 | Pass: 17 words → Fill in the outline · Write a first draft from my notes; 903 words → Tighten this for a client · What is missing? · Add a summary at the top | `qa/light-s36-short-text.png` |
| S37 | Pass: a CSV and an Excel file → What stands out here? · Write a short summary of this table | `qa/light-s36-csv.png` |
| S38 | Pass | `qa/light-s14-sample-card.png` |
| S39 | Pass: "Find what I wrote about " with the caret at the end, focused, nothing sent; the "…?" fill by unit test (its points are behind the gate) | `qa/light-s39-filled.png`; `startingPointWords.test.ts` |
| S40 | Pass: the points step aside while typing and come back when emptied | `qa/light-s40-typing.png` |
| S41–S43 | Unit tests only | `startingPointWords.test.ts`, `guidance.test.ts` |
| S44 | Pass, Light and Dark (J4's ways: write a task, keep an idea) | `qa/light-s44-tasks-empty.png`, `qa/dark-s44-tasks-empty.png` |
| S45 | Pass: the two lines, the starting points, the message box below | `qa/light-s45-chats-empty.png` |
| S46 | Pass: the words, Record and Transcribe a file…, the accepted kinds | `qa/light-s46-transcribe-empty.png` |
| S47 | Pass on the Mac: AI Ready, Send feedback, the bell; no Report AI issue; the tooltip | CDP log |
| S48 | Pass on the Mac: Help ▸ Getting started, Support, Send feedback; opens the sheet | menubar data; CDP log |
| S49 | Pass: "Report an AI issue", the box ticked | `qa/light-s49-ai-issue.png` |
| S50 | Pass: one "Send Feedback" in All commands opens the sheet | `qa/light-s50-palette.png` |
| S51 | Pass, usage data on and off: `feedback_sent {message}` only; off, from a one-off id | `qa/light-fb2-sheet.png`, `qa/light-fb4-sent-toast.png`; `research/feedback-delivery-audit.md` |
| S52 | Partly: the note, Open in e-mail and the foot as drawn; pressing it with a real mail app not run (it would open Jarmo's Mail) | `qa/light-fb2-sheet-email-route.png` |
| S53 | Pass on the Mac: Enter adds a line, ⌘Enter sends, Escape closes and nothing goes | CDP log |
| S54 | Pass: Send and Open in e-mail disabled with nothing typed | CDP log; unit test |
| S55 | Partly: the box, the quote from ChatGPT's answer; the e-mail's content by unit test | `qa/light-s55-last-answer.png`; `feedback.test.ts` |
| S56 | Unit tests (`shortenAnswer`, `[shortened]`, Copy's whole answer) | `feedback.test.ts` |
| S57 | Pass: no last-answer box without a chat | `qa/light-s49-ai-issue.png` |
| S58 | Pass in its too-long state (no mail app opened), Light and Dark; the opening state by unit test | `qa/light-s58-handoff-too-long.png` |
| S59 | Not run (Windows) | — |
| S60 | Pass: the stand-in answering 503 | `qa/light-fb-d5-did-not-go.png` |
| S61 | Pass: two seeded saved days, a save today, the card | `qa/light-s61-feedback-card.png`, `qa/dark-s61-feedback-card.png` |
| S62 | Unit tests only | `guidance.test.ts` |
| S63 | Pass: Send with a line, `asked: made_this_week`, the card gone; within a release by unit test | CDP log |
| S64 | Partly: the sheet's send with usage data off goes; the card's send offline not run | `research/feedback-delivery-audit.md` |
| S65 | Partly: `what_for` only when sent, `module_4` at the press; `what_is_here` was sent before the stand-in ran | CDP log |
| S66 | Pass: `{place: project, edited: false}`, then `edited: true` | CDP log |
| S67 | Partly: a new document's first save once, and the sample's Module 4, both `after_ready_request: true`; export, publish and the sync-client negative not run | CDP log |
| S68 | Pass: `from` for status_bar, help, command, ai_info; with usage data off none of the new events left. Before the welcome is left: unit test | CDP log; `consent.test.ts` |
| S69 | Pass: the new events carry only `kind`, `provider`, `place`, `edited`, `how`, `after_ready_request`, `from` (and `feedback_sent`'s own message, by design) | CDP log |
| S70 | Partly: every door and both routes; not the whole R16 table, and not Windows | — |
| S71, S72 | Not run (Windows) | — |

## Found and fixed during QA

- The thank-you never showed: the sheet resolves a plain outcome and the extension read `.outcome` (`a4f9084d`).
- The straight route showed the e-mail note and Open in e-mail: `[hidden]` lost to the sheet's own display rules (`a4f9084d`).
- Ask with opened under the caret, not under the whole button (`a4f9084d`).
- After a send that did not go, Try again wrapped under the other buttons (`fcd669b3`).
- The empty board drew in one row: its class collided with the Calls, Ideas and Log empty line (`2b188ac1`).
- The empty chats panel said "Start one below" over the message box; it now ends above it (`2b188ac1`).
- The sample's press showed nothing for about 15 s and could be pressed twice (`7e857e0f`).
- "Didn't open?" under a hand-off where nothing was asked to open (`28fa9f89`).

## Found, not fixed (outside this sprint's files)

- A ChatGPT turn stopped with Stop reads "Failed" after a restart: the record's boundary is `cancelled`, `conversationProjection.ts` turns it into `status: 'cancelled'`, and `activityState.ts:84` treats only `interrupted` as a cancel. A one-line fix there.
- The empty project's card promises "ChatGPT writes About this project from it, and a first outline as a document", but the filled request carries only the person's sentence, and in one run ChatGPT answered in the chat and wrote nothing. Either the card's words change, or the request gains an instruction: a product call.
