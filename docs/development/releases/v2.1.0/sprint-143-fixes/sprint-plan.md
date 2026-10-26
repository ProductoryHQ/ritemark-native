# Sprint 143: 2.1 fixes

Track: SDD (auto-detected: nine linked issues, nine user-facing requirements across Home, the welcome, the AI's sheet, Codex's runtime, the editor's comments, Transcribe and Windows' dialogs; three of them wait on an audit)
Override with: "use plain full track"
Branch: `sprint-143-fixes`, made from `origin/main` at Phase 3, after approval. This plan was written on `plan/sprint-143-fixes`.
Release tier: extension. Every change planned is under `extensions/ritemark/` (and `scripts/qa/`), and it ships in 2.1.0's shell release. Two audits can add a shell-tier line: A3 (#507) if its cause is in VS Code's webview host, A4 (#510) if the main process's dialog lock needs a patch. Either changes this line before it is built.
Status: **Approved (Phase 2 → 3), 26 October 2026,** by the Development manager under Jarmo's delegation (*Approval* below). **Built** on `sprint-143-fixes` (from the plan commit rebased on `origin/main` at `84ea15db`, Sprint 138 merged), 27 October: R1–R6, R3a, R8, R9's Ritemark half; R7 without code (A3). Evidence in [qa-evidence.md](qa-evidence.md). Waiting: A4 on Windows (R9's possible patch), and the Gate 2 rows. The tier line stays extension: no patch changed.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R9 and E1–E5, and the open questions.
- [scenarios.md](scenarios.md): S1–S43, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the four audits still missing, workstreams W1–W9, one merge, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- [research/reproductions.md](research/reproductions.md): what was reproduced for each issue before this plan, and how; the scripts in [research/repro/](research/repro/).
- This file: intent, decisions, status.

The release is 2.1.0 ([release-plan.md](../release-plan.md)). These are the milestone's bugs that no feature sprint took, and #544 and #551, which 2.1's own testing found.

## Goal

The first week's small stumbles go: Home closes cleanly on a switch, the first chat is with the AI the person chose, a wait on ChatGPT says so, titles come in the chat's language, a comment assigned from the list stays assigned, a task's message reads as its card, Transcribe on Windows says before it starts what it can't do and lets a failed card go, and the pickers open on a PC without a Desktop. Each with a check that fails before the fix.

## Linked Issues

| Issue | What | Requirement | Reproduced | Tier |
|---|---|---|---|---|
| [#556](https://github.com/ProductoryHQ/ritemark-native/issues/556) | Home's dispose throws on every project switch | R1 | Yes: the installed app's log, the code | extension |
| [#551](https://github.com/ProductoryHQ/ritemark-native/issues/551) | After the welcome with ChatGPT, the chat sometimes opens on Claude | R2 | No: 21 of 21 landed on ChatGPT, with and without the update notice | extension |
| [#544](https://github.com/ProductoryHQ/ritemark-native/issues/544) | ChatGPT's first turn can stall ~6 minutes | R3 | Yes: ChatGPT's 429 and Codex's silent wait, from Codex's own logs and a local endpoint; not the MCP servers | extension |
| [#514](https://github.com/ProductoryHQ/ritemark-native/issues/514) | An English chat's title came out in Estonian | R4 | The title was Claude's (the site run's notes); ChatGPT's 36 titles here were all right; Claude not run | extension |
| [#513](https://github.com/ProductoryHQ/ritemark-native/issues/513) | @claude chosen from the mention list doesn't assign | R5 | Yes, 3 of 3: the formatting toolbar covers the list's first option | extension |
| [#511](https://github.com/ProductoryHQ/ritemark-native/issues/511) | A task's message loses its line breaks | R6 | Yes, in code: no `white-space` rule on the person's message, for every AI | extension |
| [#507](https://github.com/ProductoryHQ/ritemark-native/issues/507) | ⌘⇧P sometimes does nothing on Home | R7 | No: 24 of 24 opened, raw CDP and agent-browser keys | extension, or shell if A3 says so |
| [#509](https://github.com/ProductoryHQ/ritemark-native/issues/509) | Windows: an .m4a fails on-device after the picker; its card stays | R8 | In code (Windows not here); the card that can't go is on every platform | extension |
| [#510](https://github.com/ProductoryHQ/ritemark-native/issues/510) | Windows: no Desktop folder, two pickers stop opening, processes left | R9 | No: Windows not here; a lead in the main process's dialog lock | extension, or shell if A4 says so |

## MVP Scope

| Area | Requirement | Proven by |
|---|---|---|
| Home's subscriptions let go, each in its own `try` | R1 | A unit test; the log after a switch |
| The welcome's chosen AI saved before the reload; no give-up for local model lists; a dropped landing logged | R2 | Unit tests; `landing-check.mjs` 20 of 20 on the branch |
| Codex unchanged at start; Codex's retry shown on the status line; a 429 at the end as a limit card | R3 | Unit tests on the recorded notifications; the app-server against a local 429 endpoint |
| The title session loads nothing of the person's Claude setup | R4 | A unit test; ChatGPT 10 + 10 on this Mac; Claude at Gate 2 |
| The formatting toolbar follows the editor's focus | R5 | A unit test; `comment-mention-check.mjs` |
| The person's message keeps its line breaks | R6 | A unit test; a screenshot |
| ⌘⇧P on Home: a person's reproduction first, code only after | R7 | A3; `home-keys-check.mjs` either way |
| Transcribe: refused before it starts where it can't convert; Dismiss on every failed card | R8 | Unit tests; a failed card dismissed on the Mac; Windows at Gate 2 |
| Every Ritemark picker starts in a folder that exists; A4 on Windows first | R9 | A unit test; A4 and Windows at Gate 2 |
| Each check fails on `main` first; no record changes; tier; bundle; docs | E1–E5 | `qa-evidence.md` |

**Not in this sprint:** turning off the person's Codex MCP servers; converting .m4a on Windows; Claude runs on this Mac; the milestone's polish issues (#503–#505, #508, #516, #517, #535).

## What the reproductions changed

- **#544 is not the MCP servers.** Codex's logs for the spike's stalled turn say "retrying sampling request (1/5 in 418.99s)… last status: 429 Too Many Requests"; the session was ready in 3.3 s. The spike sent 13 ChatGPT turns in 22 minutes and met five such waits (54–539 s). Timed here with and without them, the person's nine MCP servers cost under two seconds, and one that never starts doesn't hold the turn. Codex tells its client before each wait (`error`, `willRetry: true`); Ritemark doesn't listen. So the fix is to show the wait, and Codex keeps starting as the person set it up.
- **#513 is the formatting toolbar.** It stays up over the comment while the word is selected and covers @claude, the list's first and highlighted option. Choosing with Enter, or typing "@claude ", works, which is why it looked like a picker bug.
- **#551 and #507 didn't reproduce.** Both were seen once, by an agent driving the app over CDP on a day its harness was still being fixed. R2 closes the three ways the code can leave the first chat on Claude, and keeps #551 open until 20 runs pass on the branch. R7 changes no code until a person reproduces it.

## Product Decisions

- **2026-10-26 (Jarmo, `decisions/log.md`):** the Development manager approves 2.1's sprint plans until Gate 1 RC. No test keys or accounts now ("Mitte praegu"): Claude isn't signed in on the test Mac, so this plan proves only what ChatGPT, unit tests and code can.
- **2026-10-26 (engineering, in this plan):**
  - Codex starts with the person's own configuration, unchanged (R3).
  - A wait on the AI is shown on the status line, where the turn's one state already is, not as a new element (memory: behaviour first, no new elements).
  - The title session loads nothing of the person's, as idea review (R4).
  - The formatting toolbar follows TipTap's own focus rule (R5).
  - No code for #507 without a reproduction (memory: no unproven diagnoses).
  - .m4a on Windows is refused before it starts, not converted, in 2.1 (R8).
  - Each fix's check goes into `scripts/qa/` beside the existing ones, so the next sighting has a reproducer.

## Decisions for the Development manager

Six, each with a recommendation. [spec.md](spec.md#open-questions) carries the same list.

1. **#544: what Ritemark's Codex starts with.** I recommend unchanged: the person's own configuration, MCP servers included. Measured with and without them, they cost under two seconds and don't hold a turn; the minutes were ChatGPT's 429. Leaving them out would need a second Codex home (losing the sign-in) or reading the person's file, and would take away tools they set up on purpose.
2. **#514: the title session without the person's own Claude settings.** I recommend yes, as idea review and the insights already run. The cost: someone whose Claude works only through `~/.claude/settings.json` (a custom endpoint) gets the first words of their message as the title instead of an AI title.
3. **#509: refuse or convert on Windows.** I recommend refusing before it starts in 2.1, and filing conversion with Windows' own Media Foundation for 2.2. Conversion needs a PowerShell and WinRT path nobody here can test; the issue allows either.
4. **#551: harden without a reproduction.** I recommend yes: R2's three changes are small, each is right on its own (the chosen AI saved before the reload is what the landing already does later), and #551 stays open until 20 of 20 on the branch.
5. **#510: a VS Code patch if A4 shows the lock.** I recommend building it in this sprint as one hunk in patch 005 (Windows and OSS fixes), since 2.1 is a shell release anyway; if A4 can't run before the feature freeze, R9's Ritemark half ships and the rest moves to 2.2.
6. **#507: who types it.** I recommend that the manager asks the Social manager how the films sent ⌘⇧P, and that a person (Jarmo when back, at Gate 2 at the latest) types S27–S32 on the Mac and on Windows, ten presses each. If nobody sees it, #507 moves to 2.2 with the evidence and no code changes for it.

## Feature Flag Check

No feature flag. Each change fixes what 2.0 and 2.1 already do, on for everyone. HARD RULE #1 holds:
- the landing and its words stay;
- the person's MCP servers stay;
- the title generator, the formatting toolbar, Transcribe's engines and every picker keep everything they do today.

## Testing

- **The Mac, here:** ChatGPT through Jarmo's own sign-in, unit tests, and scripted dev instances (hidden, one launch per check, `--use-mock-keychain`). Nothing writes `~/.codex/config.toml`; Codex's session records are written as any client's.
- **Not here:** Claude (R4's half, S17), real keyboards (R7, A3), Windows (R8's and R9's halves, A4). Each is named in its scenario and in the Gate 2 list.
- **429s:** a real one can't be made on demand without spending the account's limit; R3 is proven on the app-server's own recorded messages.

## Windows

- **Before the merge:** A4 and whatever of S33, S36 and S39–S41 the "Ritemark on Windows" session can run through the test overlay on the branch's extension.
- **At Gate 2:** S33, S36, S41 on 2.1's Windows build, with the kit's `Call with the HR lead.m4a`.

## Success Criteria

- [ ] A project switch leaves no `disposable.dispose is not a function` in the log, and Home's subscriptions and panel are all disposed (R1).
- [ ] 20 of 20 welcomes finished with ChatGPT land on ChatGPT, with and without the update notice (R2).
- [ ] A ChatGPT wait shows "ChatGPT is busy…" on the status line, and a 429 at the end is one limit card; Codex starts as the person set it up (R3).
- [ ] Titles come back in their chat's language: ChatGPT here, Claude at Gate 2 (R4).
- [ ] A comment's agent chosen from the list by click is saved and assigned, for all three agents (R5).
- [ ] A task card's message shows its title, Done when and Files on their own lines, for every AI (R6).
- [ ] #507 reproduced and fixed, or moved to 2.2 with the evidence; the check passes on the branch either way (R7).
- [ ] On Windows an .m4a with On-device is refused before it starts, and every failed card can be dismissed (R8).
- [ ] On Windows with no Desktop folder, both pickers open every time and quitting ends every process (R9).
- [ ] Each check failed on `main` first, or the plan says why it couldn't (E1); 2.0.1 opens what this build writes (E2).

## Risks

| Risk | Retirement |
|---|---|
| #551 has a fourth way the plan doesn't close | A1 forces each way by hand; #551 stays open until 20 of 20 |
| #507 is real and nobody reproduces it in time | R7 moves it to 2.2 with the evidence rather than guess a fix |
| The toolbar following the focus hides it where it's needed | Its buttons keep the editor's focus; a formatting pass in QA |
| Titles without the person's settings lose a custom endpoint's titles | The fallback title stays; *Decisions* 2 |
| Windows isn't reachable before the freeze | R8 and W9a are proven by unit tests; A4 and Gate 2 say what wasn't run |
| A shell-tier change appears late | The tier line changes first; 2.1 is a shell release already |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Sprints 137, 139 and 140 merged** (W3 extends 139's classifier and copy; W1 sits beside 140's Home guidance). If one is still open, this sprint rebases after it.
- **The "Ritemark on Windows" session** for A4 and the overlay round.
- **The Social manager** for A3's question; **a person at a keyboard** for A3's try.
- **The Experience lead** for R3's line and card, R8's disabled engine and Dismiss.

## Pre-Implementation Gate

- This plan is reviewed and approved. A message from the Development manager approving it counts under Jarmo's delegation of 26 October; nothing else does.
- Phase 1's audits come before their workstreams' code (A1 before W2's last task, A3 before any W7 code, A4 before W9b). When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" (ritemark-dev `decisions/log.md`). Release approval (Gate 1, Gate 2, publish) stays Jarmo's.

**The plan's questions, decided:**
1. **#544:** Codex starts as it does today, with the person's own configuration and MCP servers. The wait is shown instead: a status-line line while Codex waits to retry, and a 429 at the end becomes a limit card through Sprint 139's classifier and cards. The Experience lead's words followed the same day (below).
2. **#514:** yes. The title session loads none of the person's own Claude settings and has no tools.
3. **#509:** .m4a is refused on Windows in 2.1, and every failed card can be dismissed. The Development manager files the Media Foundation conversion for 2.2.
4. **#551:** yes, R2's three changes; the issue stays open until 20 of 20 runs pass on the branch.
5. **#510:** as recommended. If A4 can't run before the feature freeze, the Ritemark half ships and the rest moves to 2.2.
6. **#507:** no code. A person tries S27–S32 on a real keyboard at Gate 2; without a reproduction it moves to 2.2 with the evidence.

**After the approval, the same day:**
- **A3's answer (#507), from the Social manager:** the films' ⌘⇧P was synthetic, never a real keyboard: Playwright's `connectOverCDP` on RC1's port, then `page.keyboard.press('Meta+Shift+p')` on the main workbench page, which is CDP `Input.dispatchKeyEvent` to the top-level window target. It happened on Home, usually just after a click inside Home's webview; Go to File (⌘P) failed the same way; a click on the window chrome first made it work every time (ritemark-web `docs/programs/social-video/capture/take.cjs`, around lines 470–481). So it is very likely a capture artifact. Recorded in `research/home-keys-audit.md`, with one more try of that exact method on this branch's dev build.
- **The Experience lead's words for #544** (experience 13's table, `experiences/states/README.md`, ritemark-dev `0e6911f`). They need the wait's length, which Codex's notification doesn't carry, so R3 is revised as R3a under the scope-change protocol ([spec.md](spec.md#r3a-the-wait-counted-down-and-the-busy-card-revised-2026-10-26)):
  - the status line: "ChatGPT is busy. Trying again in 7 minutes.", counting down in whole minutes, rounded up, "Trying again in a minute" from one minute left, no seconds and no "…"; with a wait over a minute and another AI ready, it ends with "Continue with Claude" (or the ready AI's name), which stops the turn and carries the message over, as the card's button does; when the AI tries again, the line goes back to its working words;
  - the card when the retries end in a 429 that isn't a plan limit (Codex's `rateLimitExceeded`): "ChatGPT is busy right now" / "It turned this request away several times. Send your message again in a few minutes.", or "Send your message again after 3:12 PM" with a time from the service, in the person's own time format; Continue with <AI> only when another AI is ready; the status line says "Failed". `usageLimitExceeded` keeps the plan-limit card.
