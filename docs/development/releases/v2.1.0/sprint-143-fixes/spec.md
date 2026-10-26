# Sprint 143 Spec — 2.1 fixes

## Purpose

Nine behaviour bugs found around 2.0 and in 2.1's own testing, each a small stumble on the first week: Home leaking on every project switch, the first chat sometimes on the wrong AI, ChatGPT silent for minutes, a title in the wrong language, a comment that loses its assignment, a task's message run together, a shortcut that does nothing on Home, and two Windows dead ends in Transcribe and Open a folder. Each is fixed with a check that fails before the fix and passes after.

## Principles

- **Reproduce first.** Each requirement names what was shown and how ([research/reproductions.md](research/reproductions.md)). Where a cause isn't shown, the fix is called hardening, not the cause, and its issue closes only when its own check passes (memory: no unproven diagnoses).
- **The person's own setup is theirs.** Nothing here writes `~/.codex`, `~/.claude` or the person's settings beyond what Ritemark already writes.
- **The smallest change in the existing pattern.** One helper where one exists (idea review's one-shot options, the Codex turn's progress line, `RuntimeNotice`'s card, shadcn `Button` with a tooltip); no new subsystem.
- **The same for all three AIs** wherever a requirement touches the AI's sheet.
- **What this Mac can prove.** ChatGPT, unit tests and code. A Claude-only or Windows-only proof is named in its requirement and runs at Gate 2.

## Requirements

### R1: Home lets go of everything on a project switch (#556)

As someone switching projects, I want the old project's Home to close cleanly, so nothing keeps running for a project I left.

Acceptance criteria:
- `HomeHost` subscribes to the project list as a disposable (`{ dispose: unsubscribe }`), as it already does for the board.
- Disposing `HomeHost` disposes every subscription it made and its panel, even if one of them throws.
- A project switch and a window reload log no `disposable.dispose is not a function` in `exthost.log`.
- A unit test disposes a `HomeHost` and sees every subscription, the project list's included, and the panel disposed.

### R2: The first chat is with the AI the welcome was finished with (#551)

As a newcomer who chose ChatGPT on the welcome, I want the project's first chat to be with ChatGPT, not with Claude, which I may not even have.

What is known: not reproduced in 21 scripted runs on a fresh profile, with and without the update notice ([research](research/reproductions.md#551-after-the-welcome-is-finished-with-chatgpt-the-chat-sometimes-opens-on-claude)). The code has three ways for the first chat to stay on Ritemark's default AI (Claude), so this requirement closes all three.

Acceptance criteria:
- Finishing the welcome with an AI the person chose on it (Continue, a sign-in, or a saved key) makes that AI the one new chats start with (`ritemark.ai.selectedAgent`), saved before the window reloads into the project. A chat that opens without the landing is then on that AI anyway. The landing chat already does this today, once it applies (`ai-select-agent`); this only stops depending on it. An AI the welcome merely found ready (the update welcome's fallback) changes nothing.
- The landing's chat never gives up waiting on ChatGPT's or Claude's model: their lists are local and known at the sheet's first bootstrap. The 20-second limit stays for OpenCode, whose models wait on the providers' keys.
- A landing that is dropped says why in the extension host's log: the welcome finished in the last 10 minutes but left no record, an unreadable record, another folder, older than 10 minutes, or the sheet's wait ran out. An ordinary window with no welcome behind it logs nothing.
- The scripted check runs the welcome with ChatGPT N times on fresh profiles (N = 20, half with the update notice) and fails on any run whose chat isn't on ChatGPT with "Ask ChatGPT about this project". The three-runtime check (`scripts/qa/three-runtimes-check.mjs`) fails the step instead of picking the AI itself when the landing is wrong.
- The update welcome (someone updating from 1.x) is unchanged: it lands on the AI it already chooses.

### R3: A wait on ChatGPT is shown, never silent (#544)

As someone whose first ChatGPT message is answered "too many requests", I want to see that Ritemark is waiting for ChatGPT, and why, instead of a chat that seems frozen for minutes.

What is known: the stall is ChatGPT's 429 and Codex waiting as long as ChatGPT says (up to 9 minutes seen); the person's MCP servers don't cause it ([research](research/reproductions.md#544-chatgpts-first-turn-can-stall-about-6-minutes)).

Acceptance criteria:
- **What Ritemark's Codex starts with is unchanged:** the person's own Codex configuration, MCP servers included. Ritemark adds no `-c` overrides and writes nothing to `~/.codex`.
- When Codex reports that it will retry (the app-server's `error` notification with `willRetry: true`), the running turn shows one line in place of the working line: "ChatGPT is busy. Ritemark will keep trying (1 of 5)." (proposed; the count from Codex's own message). Stop stays where it is and stops the turn as today.
- The line goes as soon as ChatGPT continues (text, an activity, a question or an approval), and changes with each retry.
- When the retries run out on a 429 (`responseTooManyFailedAttempts` or `responseStreamDisconnected` with `httpStatusCode` 429), the turn ends as Sprint 139's limit card for ChatGPT: "ChatGPT is busy right now" / "Too many requests reached ChatGPT. Wait a few minutes, then send your message again." (proposed), never "exceeded retry limit, last status: 429". Its `errorKind` is `limit`, its count's outcome `limit`.
- The provider's raw words stay in the turn's activity details and Report AI issue, as Sprint 139 keeps them.
- A retry that isn't a 429 (a dropped connection) shows the same line, which says only that Ritemark is trying again. *Not built: see the Addendum (27 October).*

### R3a: The wait counted down, and the busy card (revised 2026-10-26)

The Experience lead's words for R3 (experience 13, `experiences/states/README.md`, ritemark-dev `0e6911f`), approved by the Development manager the day the plan was. They replace R3's proposed words; R3's other criteria stand.

Acceptance criteria:
- **The status line** while ChatGPT waits to retry after a 429: "ChatGPT is busy. Trying again in 7 minutes." The minutes count down, rounded up; from one minute left it reads "ChatGPT is busy. Trying again in a minute." No seconds and no "…". The AI's name is the AI's, never "Codex".
- **How the wait is known.** Codex's notification doesn't carry it (research, the local 429 endpoint); Codex writes it to its log ("retrying sampling request (1/5 in 418.99s)"). Ritemark's own app-server process is started with `RUST_LOG=error,codex_core::responses_retry=warn` when the environment has no `RUST_LOG`, so that one line reaches Ritemark on the process's stderr; Ritemark pairs it with the notification. This is a log filter for Ritemark's own process: the person's configuration, MCP servers and `~/.codex` are untouched (R3's decision stands), and a `RUST_LOG` the person set is left as it is.
- **When the wait isn't known** (a person's own `RUST_LOG`, or a Codex that logs it differently): "ChatGPT is busy. Trying again soon." (proposed; words for the Experience lead).
- **Continue with <AI>** ends the line when the wait is over a minute and another AI is ready: a shadcn `Button` with a tooltip ("Stop waiting and continue this chat with Claude"; the busy card's own words are in the Addendum). It stops this turn, switches this chat to that AI, and puts the message back in the box, as the busy card's button does.
- When ChatGPT tries again, the line goes back to "Working…".
- **The busy card**, when the retries end in a 429 that isn't a plan limit (Codex's `rateLimitExceeded`; or `responseTooManyFailedAttempts` / `responseStreamDisconnected` with status 429, as the local endpoint showed):
  - heading "ChatGPT is busy right now";
  - body "It turned this request away several times. Send your message again in a few minutes.", or "Send your message again after 3:12 PM" when the service gave a time ("try again in …" or "at …" in its words), written in the person's own time format;
  - Continue with <AI> only when another AI is ready (the line's behaviour above);
  - the status line under it says "Failed".
- `usageLimitExceeded` keeps Sprint 139's plan-limit card.
- Tests cover both: the line's countdown, its fallback, its Continue; the card with and without a time, with and without another AI.

### R4: Automatic titles are in the chat's own language (#514)

As someone who writes to the AI in English on a computer with Estonian around it, I want my chat's automatic title in English.

What is known: the title was Claude's; Claude's title session loads the person's own settings and skills, which on this Mac are partly in Estonian; ChatGPT's 36 titles here were all in their chat's language ([research](research/reproductions.md#514-an-english-chats-automatic-title-came-out-in-estonian)).

Acceptance criteria:
- The title's one-shot session loads none of the person's own Claude settings, skills, `CLAUDE.md` or plugins, and has no tools (`settingSources: []`, `availableTools: []`), as Sprint 130's idea review and the transcript insights do. Its prompt is unchanged (the 23 September wording).
- A title that can't be made still leaves the prompt's fallback title, as today (for example a Claude that works only through settings the session no longer loads).
- A unit test pins both options for the title session.
- ChatGPT: a scripted run of 10 English and 10 Estonian first messages on this Mac (region Estonia) gives every title in its chat's language.
- Claude: at Gate 2, an English chat on Jarmo's Mac (his own skills) gets an English title, five times out of five.

### R5: Choosing an agent from the mention list assigns the comment (#513)

As someone writing a comment, I want choosing @claude from the list to assign it exactly as typing "@claude " does.

What is known: reproduced 3 of 3. The formatting toolbar stays up over the comment while the word is still selected, and covers the list's first option, @claude; the click lands on the toolbar ([research](research/reproductions.md#513-choosing-claude-from-a-comments-mention-list-doesnt-assign-the-comment)).

Acceptance criteria:
- The formatting toolbar shows only while the editor (or the toolbar itself) has the keyboard focus, as TipTap's own rule has it. When the comment's box, or anything else outside the editor, takes the focus, the toolbar goes; it comes back when the person selects text in the editor again.
- With the comment's box open, nothing of the editor's covers its mention list.
- For @claude, @codex and @opencode, a comment whose agent was chosen from the list by click, by Enter or by Tab is saved with its address, shows the agent's name, and can be sent, as a typed one does.
- The toolbar still works as today while the person formats text, and the link dialog (a separate dialog) still opens from it.
- A check in the real editor that fails before the fix: S18–S22 save the address in the file.

### R6: A message keeps its line breaks (#511)

As someone giving a task card to an AI, I want its message in the conversation to read as the card does: the title, Done when and Files on their own lines.

Acceptance criteria:
- Every message of the person's in the AI's sheet is drawn with its line breaks: typed with Shift+Enter, a task card's, a comment task's; for Claude, ChatGPT and OpenCode; live and after a restart.
- Long words and paths still wrap inside the bubble; nothing scrolls sideways.
- What is sent to the agent and saved in the record is unchanged.

### R7: ⌘⇧P opens All commands on Home, every time (#507)

As someone on Home, I want ⌘⇧P (Ctrl+Shift+P on Windows) to open All commands wherever the keyboard focus is on Home.

What is known: not reproduced in 24 tries with synthetic keys, including the tool the films were made with; Home's page stops no key and no patch touches the webview's key path ([research](research/reproductions.md#507-p-sometimes-does-nothing-while-home-has-the-keyboard-focus)). Whether a person at a keyboard meets it is not known.

Acceptance criteria:
- **First, a person's reproduction (audit A3):** the steps of S27–S32 typed on a real keyboard, on the Mac and on Windows, by whoever the Development manager asks (*Open Questions* 6), with the dev instance's trace on. If one fails, the cause is found in A3 and the fix lands in this sprint; this requirement then gains its own acceptance criteria under the scope-change protocol.
- If no one reproduces it before the sprint's QA, nothing is changed in code: the scripted check (S27–S32) joins `scripts/qa/`, the evidence goes on #507, and #507 moves to 2.2 with the label it needs to be picked up when seen again.
- In either case the scripted check runs on the branch: with the focus anywhere on Home (its page, a button, the line's input, after Home redraws, after coming back to Home's tab), ⌘⇧P opens All commands, and so do ⌘P and ⌘, on Home and ⌘⇧P on the Task board, Transcribe's panel and a Ritemark document.
- Windows: Ctrl+Shift+P on Home at Gate 2 (S33).

### R8: Transcribe says what this computer can't do before it starts, and a failed card can go (#509)

As someone on Windows, I want to know before I start that an .m4a can't be transcribed on this device, and to clear a failed card without restarting.

Acceptance criteria:
- On a computer that can't convert (no `afconvert`: Windows today), the pending card says for On-device, before anything starts: ".m4a files need converting before they can be transcribed on this device. Use .mp3 or .wav, or transcribe with ElevenLabs." (the sentence the job fails with today), and On-device can't be started for that file. ElevenLabs stays choosable when it is set up. The same for .aac.
- On the Mac nothing changes: .m4a and .aac are converted as today.
- Every card under Needs attention, failed or interrupted, on every platform, has Dismiss (a shadcn `Button` with a tooltip: "Remove this from the list. The recording stays where it is."). Dismissed cards don't come back in this window; the audio file isn't touched.
- Converting an .m4a on Windows with what Windows already has (Media Foundation) is not in this sprint (*Open Questions* 3).
- Windows: the kit's `Call with the HR lead.m4a` at Gate 2.

### R9: With no Desktop folder, the pickers open and quitting ends Ritemark (#510)

As someone whose PC has no Desktop folder (moved by OneDrive or by the PC's owner), I want Transcribe a file… and Open a folder… to open a picker every time, and quitting to end every Ritemark process.

What is known: nothing yet beyond the code; the lead is the main process's dialog lock ([research](research/reproductions.md#510-windows-with-no-desktop-folder-two-pickers-stop-opening-and-quitting-leaves-processes)).

Acceptance criteria:
- Audit A4 runs first, on Windows, with a home that has no Desktop (`USERPROFILE=C:\Ritemark`) and a trace log: which default folder each picker passes, whether the main process logs the dialog lock, and which processes are left after quitting.
- Each of Ritemark's own pickers (`showOpenDialog`, `showSaveDialog`) starts in a folder that exists: the project's folder, else the person's home. Not a missing folder, not none.
- If A4 shows the lock held by a dialog that never returned, the fix that releases it is a VS Code patch (shell-tier), decided in A4's file before it is built.
- With a home that has no Desktop folder, Transcribe a file… and Add a project ▸ Open a folder… each open a picker five times in a row, and quitting leaves no Ritemark process after 10 s. Checked on Windows at Gate 2 with A4's reproducer.

## Engineering requirements

### E1: Each fix has its check

Each requirement's check fails on `main` at `1e91466c` and passes on the branch: a unit test where the cause is in code, a scripted run where it is in the running app. R2 and R7, which did not reproduce, say so in the evidence instead, and their checks are kept to catch the next sighting. The evidence goes in `qa-evidence.md`.

### E2: Records and older versions

No conversation record, card file, comment format or setting changes shape. R3's `limit: 'busy'` is a new value of Sprint 139's optional `errorDetail.limit`, which a build that doesn't know it drops (the card then says "ChatGPT stopped this request" with its sentence). A chat or document written by this build opens unchanged in 2.0.1.

### E3: Tier

Extension-tier, unless audit A3 (R7) or A4 (R9) puts a fix in a patch. Either changes `sprint-plan.md`'s tier line before it is built. 2.1.0 is a shell release in any case.

### E4: Bundle

`media/webview.js` measured before and after (`notes/bundle.md`).

### E5: Docs

`docs/development/architecture.md` where behaviour changes: the welcome's chosen AI (*The welcome and usage data*), Codex's retry line (*Recoverable runtime failures*), the title session's options. `docs/CHANGELOG.md`, and the release notes draft through the Development manager.

## Non-Requirements

- Turning off, or starting later, the person's own Codex MCP servers (R3's decision).
- Converting .m4a on Windows (*Open Questions* 3).
- A Claude reproduction of #514 on this Mac (no sign-in, "Mitte praegu").
- Other polish issues in the milestone (#503–#505, #508, #516, #517, #535): not in this sprint.

## Open Questions

Each with a recommendation; the sprint plan carries the same list.

1. **#544: what Ritemark's Codex starts with.** Recommendation: unchanged, the person's own configuration. Measured with and without them, the servers cost under two seconds and don't hold a turn; the wait was ChatGPT's 429.
2. **#514: the title session without the person's own Claude settings.** Recommendation: yes, as idea review. A person whose Claude works only through `~/.claude/settings.json` gets the prompt's fallback title instead of an AI one.
3. **#509: refuse, or convert on Windows?** Recommendation: refuse before it starts in 2.1, and file converting with Media Foundation for 2.2. Converting needs a PowerShell and WinRT path nobody here can test, and the issue allows either.
4. **#551: harden without a reproduction.** Recommendation: yes, the three changes in R2, and keep #551 open until the check has passed 20 of 20 on the branch, then close it with the evidence.
5. **#510: if A4 shows the fix is a VS Code patch.** Recommendation: build it in this sprint as one hunk in patch 005 (Windows and OSS fixes), since 2.1 is a shell release anyway; if A4 can't run before the release's feature freeze, ship R9's Ritemark half and move the rest to 2.2.
6. **#507: who types it.** Synthetic keys can't reproduce it, and this plan didn't use System Events or anyone's hands. Recommendation: the Development manager asks the Social manager how the films sent ⌘⇧P (which tool, which target), and Jarmo tries S27–S32 with his own keyboard at Gate 2 on the Mac and on Windows, ten presses each. If neither shows it, #507 moves to 2.2 with the evidence, and no code changes for it.

## Resolved Questions

**26 October 2026, the Development manager (Jarmo's delegation):** questions 1–6 decided as recommended; the details are in [sprint-plan.md](sprint-plan.md#approval). The same day:
- #544's words came from the Experience lead and became R3a;
- #507's films sent ⌘⇧P with Playwright's keyboard over CDP to the top-level page, never a real keyboard (the Social manager): R7 stays without code, and a person tries it at Gate 2.

## Addendum, 27 October 2026: what was built differs here

Recorded after QA on PR #564; the code stays as built.

- **R3's last bullet is not built.** A retry that isn't a 429 (a dropped connection, Codex's quick reconnect) shows no line: the turn keeps "Working…". The technical plan chose this (W3a), because those retries take seconds, and R3a's words are for a busy ChatGPT. The scenarios change with it:
  - S11's line is not shown;
  - S10 reads R3a's line ("ChatGPT is busy. Trying again in 7 minutes."), not "(1 of 5)";
  - S12 is R3a's busy card, with "Failed" under it, not an empty status line;
  - S9 holds for the app-server's arguments (none, as on `main`) and `~/.codex`. Its environment gains R3a's `RUST_LOG`; S9 was not run on the branch.
- **R9: Ritemark's 7 save dialogs are unchanged.** `showSaveDialog` in `ritemarkEditor.ts` (a diagram's image), `transcriptWorkbenchProvider.ts`, `saveAsMarkdown.ts`, `wordExporter.ts`, `pdfExporter.ts`, `v2/wordHtmlExporter.ts` and `v2/pdfHtmlExporter.ts`. Each passes a file path beside the open document, or a remembered folder checked to exist, never the Desktop. R9's "each picker starts in a folder that exists" is built for the 15 open dialogs (`pickerFolder`). Whether a save dialog can still meet the main process's lock is A4's question on Windows, at Gate 2.
- **R3a: the Continue with <AI> tooltips** (the Development manager's words, 27 October):
  - on the waiting line, where the turn is still waiting: "Stop waiting and continue this chat with Claude.";
  - on the busy card, where nothing is waiting: "Send your message to Claude instead."
- **R3a: the service's time** is read from "try again in …" and from "try again at …" (a time of day in the person's own zone unless the service names one, or a full date and time). "Send your message again after 3:12 PM" is written in the webview's locale, which follows the app's display language.
