# Sprint 140 Spec — The first day ends with something made, and a door to tell us

## Purpose

Most people who install Ritemark leave on the first day. 2.0's welcome gets them to a project with their AI beside it, but nothing there helps them make something. This sprint adds that light guidance: one card on Home in a project's first days, with a ready request that fits the project, at most three starting points on the AI's empty sheet, and one plain sentence in each empty place. It also opens a door back to us: Send feedback in the status bar and in Help, one sheet for feedback and AI issues, and one question on Home once per release. Three counts tell whether people who use the ready request make something and come back.

This is the 2.1 shape's items 2 and 5 (`ritemark-dev`: `releases/v2.1.0/shape.md`, approved by Jarmo on 21 October 2026 with all eight recommendations).

## Principles

- **The drawings are the contract.** Experience 35 (`ritemark-dev`: `product/design/experience/experiences/firstday/`, commit 02b9d50) for the Home card, Home's order and the starting points; experience 29 (`experiences/empty/`) for the empty places; experience 34 (`experiences/feedback/`, commit 2a60b62) for the feedback door. Where a drawing and this spec disagree, the drawing wins and this spec changes first (Jarmo, 17 October). Where two drawings disagree, the newer one wins: experience 35 over 34 on Home's order, experience 35 over 29 on the starting points.
- **2.0 as shipped, where the drawings show something this sprint does not change.** The drawing kit still shows the composer as designed, not as 2.0 shipped it. Everything this sprint does not name stays as 2.0 shipped it (the table at the end of this file).
- **The same for every AI.** Claude, ChatGPT and OpenCode get the same card, the same words with only the AI's name changed, and the same starting points. Nothing is offered that one AI cannot do (the shape's no-gos).
- **Guidance teaches by being plain.** No tours, coach marks, tips, pop-ups or videos; no new place, panel or section (the shape's no-gos).
- **Say what it reads before it reads.** The first look costs the person's AI plan, so the card and the sent message say it is the names and five documents, never the whole folder (experience 24, decision 3).
- **The request is a message the person can read.** What was asked stays in the chat (experience 35, decision 3).
- **Nothing in the person's folder changes.** Guidance keeps its state on this computer. "Nothing in this folder was moved or changed" stays true (E2).
- **Ritemark says sent only when it sent** (experience 34, decision 6; the Sprint 126 honesty rule).
- **Nothing is lost** (HARD RULE #1). What the guidance and the feedback door replace keeps a home (R16).

## Requirements

### R1: What each AI can read (#497)

As someone whose folder is years of Word and PDF files, I want whichever AI I chose to actually read the newest of them, or to tell me plainly what it could not open.

Acceptance criteria:
- Before R5's "What is here?" request and R8's Word-or-PDF starting points are built, the Word spike (technical plan, *Phase 1*) has been run on all three AIs, on the Mac and on Windows, and its decision is recorded in `research/word-spike.md` and here, as R1a or R1b.
- **R1a, if the decision is "Ritemark's Markdown":** each AI can read a Word document in the project as the Markdown Ritemark already makes from it for Make an editable copy, through one Ritemark tool defined once and given to all three AIs. The tool reads only files inside the project, refuses what the Office preview refuses (size, zip-bomb), changes nothing on disk and never asks for approval. The standing instructions tell every AI that the tool exists for Word files. A Word document open on the desk is named to the AI as one it can read with that tool.
- **R1b, if the decision is "read what you can, say what you skipped":** the ready request's sent message tells the AI to read only what it can open and to say what it skipped, in words the Experience lead gives (experience 35: the steps say "Couldn't open 2 Word files"). The card's note never promises more than the AI does.
- PDFs are decided the same way, separately (technical plan, *The decision rule*).
- The Word-or-PDF starting points (R8) are offered only for a kind every AI can read after the decision; otherwise a Word file or PDF on the desk gets the project's starting points.
- Whatever the decision, every AI's standing instructions gain one line: when it cannot open a file it was asked to read, it says which.

### R2: Home's order

As someone opening a project, I want my own work first, and at most one suggestion under it.

Acceptance criteria:
- Home draws, in this order: the cover and the project's head; the empty project's line and Home's notice, as in 2.0; **Waiting for you**; then **at most one guidance card**; then Start something; then Last changed, or Drop files in an empty project (experience 35, *For the build*).
- The guidance cards, in this order, one at a time:
  1. **What moved**, on a profile updated from 1.x, until Got it (2.0's rule and look, `homeState.showWhatMoved`). In 2.0 it sits above Waiting for you; it moves under it.
  2. **The ready request** (R3–R6).
  3. **The feedback card** (R14).
- A card lower in the order shows only when no card above it is due, except for the feedback card's one day (R14).
- Waiting for you is always first, whatever it holds.

### R3: The ready request card

As someone in a project's first days, I want one card that says what is safe and offers one useful first request.

Acceptance criteria:
- The card has experience 34's card shape on Home's page: 640 wide, 14 by 16 padding, radius 10, the strong hairline. A heading at 15/22 with a 16 icon in the accent colour, a body at 13/20 indented 24, then the button and a muted 12/16 note beside it. The × is 24 square at the top right, with the tooltip "Hide this in <project>" (experience 35).
- Three kinds, with these words, the AI's name following R4's choice:

  | Kind | Icon | Heading | Body | Button | Note |
  |---|---|---|---|---|---|
  | **A folder with files**: not empty and not the sample | folder | Nothing in this folder was moved or changed | Claude works only inside it. <the counts> | Ask Claude what is here | Reads the names, then the five newest documents. |
  | **An empty project** | pencil | Start with what this project is for | A sentence is enough. Claude writes About this project from it, and a first outline as a document. | Tell Claude what this project is for | Nothing goes until you press Send. |
  | **The sample** | check-square | Claude can draft Module 4 | It reads the brief and the interviews with shift leaders, then writes Module 4 like Modules 1 to 3. It's the task on the board for Claude. | Ask Claude to draft Module 4 | Reads two documents, writes a new one. |

- **The counts** read "<total> files: <n> <kind>, <n> <kind> and <n> others", for example "144 files: 61 Word documents, 38 PDFs, 22 spreadsheets, 9 text documents and 14 others" (experience 35). The kinds are Word documents, PDFs, spreadsheets, presentations, text documents and pictures; at most four are named, the most numerous first; the rest are "others", last. Singulars read "1 PDF", "1 other". Counting reads names only: it never opens a file, never reads its contents and never makes a synced folder download an online-only file. Ritemark's own `.ritemark/` folder, hidden files and folders, and the pointer `CLAUDE.md` are not counted. Past 10,000 files the line reads "More than 10,000 files."
- **The sample** is the project whose `.ritemark/tasks/` holds the sample's card `m4d7r2` (true for every copy of the sample since 2.0).
- The card follows the theme in Ritemark Light and Ritemark Dark, its text meets 4.5:1, and it works with the keyboard and a screen reader (the split button's two parts are two buttons; the × is named "Hide this in <project>").

### R4: Ask with: the AI on the card

As someone who uses more than one AI, I want to choose which one makes the first request, and to sign in from there if I need to.

Acceptance criteria:
- The button is a split button. Its main part names the AI ("Ask Claude what is here"). Its caret part, 28 wide, opens **Ask with**, which lists Claude, ChatGPT and OpenCode with experience 19's icons (experience 35, frame 1).
- In the menu, an AI that is ready shows a check when chosen; choosing it renames the button and the body's AI name at once. An AI that is not signed in shows "Sign in", and OpenCode with no key shows "Set up". These go through the welcome's own flows first (the same host entry points and the same small OpenCode sheet as the welcome), and the AI is chosen once it is ready.
- The AI first named is the one the AI's sheet uses for new chats, when it is ready; otherwise the first ready AI in the order Claude, ChatGPT, OpenCode.
- When no AI is ready, the card still shows; its main part names Claude and opens Ask with instead of sending (*Open Questions*, D3).

### R5: What the ready request does

As someone pressing the card's button, I want the request to go where I can see it, with the AI I chose.

Acceptance criteria:
- **A folder with files:** a new chat opens in front on the AI's sheet with the chosen AI, and the message "What is here? Look at the names first, and read only the five newest documents." is sent at once, as a normal first message the person can read (experience 35, frame 2). Under R1b the message gains R1b's words.
- **An empty project:** a new chat opens in front with the chosen AI, "This project is for " is put in the message box with the cursor after it, and the box has focus. Nothing is sent (experience 35, frame 3). There is no microphone: 2.0's message box has no dictation (#498's comment).
- **The sample:** the sample's card `m4d7r2` runs as the board's Give to Claude runs it (`BoardController.give`), with the chosen AI (experience 35, frame 4).
- An existing blank chat is reused rather than a second blank one made, as the + does today.
- Each works the same with Claude, ChatGPT and OpenCode (E1).

### R6: When the ready request shows, and when it goes

As someone new to a project, I want the card in its first days and gone once it has done its job, with no timer.

Acceptance criteria:
- It shows on the Home of a project Ritemark meets for the first time: a project added to Ritemark's list by opening it (`foundBy: 'opened'`) or the sample, in which no chat has been started yet. Never on a project the list's first fill found from 1.x (`foundBy: 'recent'` or `'chats'`) (experience 35: "never on a project from 1.x").
- It goes, for that project, when:
  - its request is answered: the AI's reply in the request's chat completes (for the sample, the card's hand-off finishes with a result);
  - the person starts any other chat in that project on their own;
  - the person presses its ×.
- A request the AI refused, or that failed, leaves the card in place (#498's comment; experience 35, frame 6). Pressing the button again makes a new request.
- An empty project that gains files shows the "folder with files" kind the next time Home draws, unless the card has gone.
- Whether it has gone is kept on this computer, per project, never in the project's folder (E2).

### R7: The answer's two offers (experience 35, frame 2)

As someone who has just had the first look, I want two concrete next steps I can take with one click.

Acceptance criteria:
- The ready request's answer ends with two offers, drawn as two cards under the answer: write About this project, and one piece of real work from what the AI found (notes or a brief become an offer, meeting notes a client summary with next steps, materials a handout; the Business lead, 21 October).
- Each offer card has a title and a muted line, as drawn ("Write About this project" / "The page every AI here reads first"). A click puts the offer's request in the message box; the person presses Send, as with the starting points.
- The offers come from the AI, the same way for all three AIs. **This requirement is conditional on the spike's part B** (technical plan): if all three AIs offer next steps through Ritemark's offer tool reliably, R7 is built as written. If not, the offers stay in the answer's own words, frame 2 is redrawn by the Experience lead to match, and R7 is recorded here as not built (*Open Questions*, J3).

### R8: The AI's empty sheet: at most three starting points

As someone looking at an empty chat, I want a few things I could ask about what is in front of me, in words that work with any AI.

Acceptance criteria:
- A chat with no messages shows "What shall we work on?" above the message box, the sentence "<AI> can work across your open documents and the whole project." (*Open Questions*, D2), and at most three starting points, as cards stacked full width (experience 35, frames 1, 3, 4, 5).
- The starting points follow what is open, with these words for every AI:

  | What is open | Starting points |
  |---|---|
  | A project with files, nothing open on the desk but Home or the Task board | What is here? · Find what I wrote about… · Write About this project |
  | An empty project | This project is for… · Plan a first document with me |
  | A Word file or PDF | Summarise this in five points · Turn this into a one-page brief · What does this say about…? |
  | A text document, empty or short | Fill in the outline · Write a first draft from my notes |
  | A text document, long | Tighten this for a client · What is missing? · Add a summary at the top |
  | A table | What stands out here? · Write a short summary of this table |
  | The sample, nothing open but Home or the Task board | Draft Module 4 from the brief · Summarise the call with the HR lead · What is here? |

  A text document is short below 300 words. A spreadsheet open in the table editor is a table. Anything else open (a web page, a picture, a presentation, a flow, a transcript) gets the project's starting points. "Write About this project" is left out when the project already has About this project.
- A click puts the starting point's words in the message box and focuses it; the person presses Send. A starting point with "…" leaves the cursor where the "…" was, and the "…" itself is not put in the box ("Find what I wrote about " with the cursor at its end; "What does this say about ?" with the cursor before the "?").
- While the box holds words the person typed, the starting points step aside, and come back when the box is empty again (*Open Questions*, D4).
- The same component draws in Claude's, OpenCode's and ChatGPT's empty chat. It replaces 2.0's three examples, which sent at once ("Reorganize my research notes", …), and gives ChatGPT's empty chat, which had none, the same starting points. ChatGPT's compatibility notice stays above them.
- None asks the AI to make tasks in a chat (Jarmo, 15 October).
- The starting points stay while the chat is empty; they are not guidance and never "go".

### R9: Empty places say what they are for

As someone meeting Tasks, the chats and Transcribe for the first time, I want each to say in a plain sentence what it is for and how to fill it.

Acceptance criteria:
- **Tasks** (experience 29, frame 2): the board's Board view with no cards shows a 40 icon tile, "Nothing waits for you", then "Tasks are work in progress, yours or Claude's. Whatever needs your answer or your check shows here first, and the count on Tasks says how many.", then the ways to fill it as icon rows. New task stays on the bar. The Tasks side bar shows each stage's empty line as drawn: To do "No tasks yet.", Doing "Nothing in progress. When Claude needs you, its task waits here, marked." Which ways are listed waits on *Open Questions* J4.
- **The chats** (experience 29, frame 3): the conversations panel with no chats says "No chats yet." and "A chat you start belongs to this project and is kept private, on this computer, never in the project's folder. Start one below, or from one of these." (the word "chat" or 2.0's "conversation": *Open Questions*, D8).
- **Transcribe:** its empty library says what Transcribe is for and offers Record and Transcribe a file…, in words the Experience lead gives; experience 29 says this and does not draw it.
- Every sentence is true of 2.0 as built (checked in Phase 1). The AI's name follows the person's AI.
- These are not guidance cards: they show while the place is empty.
- This requirement is the first cut after #408 if the release's appetite runs out (the shape, §2); R3–R8 stay.

### R10: Send feedback: the doors

As someone with something to say, I want a door that is always in sight, in words.

Acceptance criteria:
- **The status bar:** "Send feedback" with the chat-text icon, in body ink, in the right group immediately before the bell, with the tooltip "Send feedback or report an AI issue". Hover and pressed fills as the bar's other items. It replaces the status bar's "Report AI issue" (experience 34).
- **Help ▸ Send feedback** opens the same sheet (patch 015), on the Mac's menu bar and in Windows' menu.
- **AI information's link** reads "Report an AI issue" and opens the same sheet ready for an AI issue (R12). Store policy 11.16's two always-present entry points stay: the status bar's door, whose tooltip names AI issues, and AI information's labelled link.
- **All commands' "Send Feedback"** (`ritemark.reactions`) opens the same sheet (*Open Questions*, J2).
- With usage data on, opening the sheet counts once (R15).

### R11: The sheet

As someone writing to the people who make Ritemark, I want one short form that says exactly what goes and how.

Acceptance criteria:
- One sheet over the whole window, in experience 31's dialog style: 440 wide, the window dimmed behind it, as drawn (experience 34, frames 2 and 3).
- **Send feedback:** the title "Send feedback", the lede "What worked, what got in the way, what you wish Ritemark did. It goes to the people who make Ritemark.", a message field 112 high that grows, and two boxes, both visible without scrolling:
  - "This is about something the AI said or did";
  - "I'd like an answer", with "This opens your e-mail app instead, so we can write back to you. Ritemark never asks for your address." in muted ink.
- **Neither box ticked: the straight route.** The button reads Send; the foot reads "Your documents and chats are never included." Send sends the message from Ritemark through 2.0's feedback path (`ConsentGate.sendFeedback`), with usage data on or off. It carries the message and nothing else: no address, no document, no chat, no path.
- **Either box ticked: the e-mail route.** A note above the buttons reads "This opens your e-mail app with a message to info@productory.eu, so you see exactly what goes and send it yourself."; the button reads Open in e-mail; the foot reads "Only what you see here goes." It opens the person's own e-mail app with the message, as Report AI issue does today (Sprint 126's transport: `mailto:`, the length bound, Copy).
- Send and Open in e-mail are disabled until something is typed. Escape and Cancel close the sheet and send nothing. Enter makes a new line; ⌘Enter (Ctrl+Enter on Windows) presses the sheet's button.
- There is no address field, anywhere. Nothing personal rides on a count.
- The sheet works with the keyboard and a screen reader, in Light and Dark, on the Mac and on Windows.

### R12: Report an AI issue

As someone whose AI said or did something wrong, I want to report it with the answer in question, seeing exactly what goes.

Acceptance criteria:
- From AI information's "Report an AI issue", the sheet opens titled "Report an AI issue", with the lede "Tell us what the AI said or did that was wrong, unsafe or not what you asked for.", the field's placeholder "What happened?", and "This is about something the AI said or did" ticked (experience 34, frame 3).
- When ticked, in any of the sheet's ways in, and the AI's sheet has a chat open with an answer in it, one more box shows: "Add the AI's last answer in this chat", with 'Only that answer, from "<chat title>". You see it here before it's sent.' in muted ink. It is off by default. Ticked, the answer shows in the sheet as a quoted block, and goes into the e-mail as shown (#466; Jarmo, 15 September: a report may carry the output the person reviewed).
- An answer too long for an e-mail link is shortened to fit, and the quote in the sheet shows exactly the shortened text, marked as shortened (*Open Questions*, D10).
- The e-mail goes to info@productory.eu (the shape's decision 7). It carries the app's version, the platform, the time, what the person typed and, only when ticked, the quoted answer. Nothing else from the conversation, documents or account.

### R13: After pressing: sent, handed to e-mail, or not gone

As someone who pressed the button, I want to be told truthfully what happened.

Acceptance criteria:
- **The straight route, when it went:** the sheet closes and a toast says "Thank you. It's with the people who make Ritemark." (experience 34, frame 4). It says so only when the send was accepted; when Ritemark cannot know that, the words claim no more than it knows (*Open Questions*, D6).
- **The straight route, when it did not go** (offline, the service unreachable, usage data's kill switch): the sheet stays open with the message, one sentence saying it didn't go, and the e-mail route offered (words from the Experience lead; *Open Questions*, D5).
- **The e-mail route** shows frame 5's sheet: "Your e-mail app is opening", "Your report is in a new e-mail to info@productory.eu. It isn't on its way until you press Send there.", what went into the e-mail in a quoted block, "Didn't open? Copy it and send it to info@productory.eu.", Copy and Done. Never "sent" when only an e-mail app opened. When no e-mail app answers, or the message is too long for a link, the same sheet says so and Copy stays (Sprint 126's three outcomes).

### R14: The feedback card on Home

As someone who has used Ritemark for a few days, I want to be asked once what I made, where I already am.

Acceptance criteria:
- On Home, as the guidance card (R2): the chat-text icon, "What did you make with Ritemark this week?", "One line is plenty. It goes to the people who make Ritemark, and we read every one.", a one-line field with the placeholder "A proposal, notes, a module…", Send and Not now (experience 34, frame 1). No ×.
- It is due from the third day on which the person saved a document in Ritemark during this release (local calendar days, counted on this computer from the release's first start). It is never shown during work, as a dialog or as a toast.
- On a day when the ready request showed on Home, the feedback card waits for the next day Home opens; on that day it takes the guidance place even where the ready request is still due, and the ready request returns after it (*Open Questions*, D1).
- Send goes by the straight route (R11), from Home, with what was typed; Send is disabled while the field is empty. Not now closes it. Either ends it until the next release (a release is a major.minor version: an extension update within 2.1 is not a new release).
- If the send does not go, the card stays with what was typed and says so in one line (R13's words).

### R15: Day-one counts and the door's count

As the people building Ritemark, we want to see whether the ready request leads to something made and to people coming back, without learning anything about them.

Acceptance criteria:
- Four events, through 2.0's one consent gate (`analytics/consent.ts`), so only with usage data on, never before the welcome is left, with `build_channel`, no location:

  | Event | When | Properties |
  |---|---|---|
  | `ready_request_used` | A ready request's request goes to the AI (on press for the folder and the sample; for the empty project, when its filled message is sent) | `kind`: `what_is_here`, `what_for` or `module_4`; `provider` |
  | `starting_point_used` | A message filled from a starting point is sent | `place`: `project`, `empty_project`, `word_or_pdf`, `short_text`, `long_text`, `table` or `sample`; `edited`: true or false; `provider` |
  | `made_something` | The first time in this window's session that a new document is saved in the project, a document is exported, or one is published | `how`: `new_document`, `export` or `publish`; `after_ready_request`: true or false |
  | `feedback_opened` | The feedback sheet opens | `from`: `status_bar`, `help`, `ai_info` or `command` |

- No event carries a starting point's words, a message, a file or project name, a path, a count of files, an account or an address.
- The 7-day return is read in PostHog from these events and `app_session_start`: of a week's new people, those who used a ready request against those who did not, aiming at least at twice the rate (the shape, §6). The insight is defined and linked from the release's measures.
- The feedback card's send and the sheet's straight send are `feedback_sent`, 2.0's event, sent as the person's own send (G3): with usage data off too, from a one-off client.
- Each new event and property is listed for the privacy page on ritemark.app, through the Development manager (the shape's privacy lines in `ritemark-web`).

### R16: Nothing is lost (HARD RULE #1)

As someone who used 2.0, I want everything this sprint replaces to still do its job.

Acceptance criteria:
- Every row below works from its 2.1 home:

  | 2.0 | 2.1 |
  |---|---|
  | The status bar's "Report AI issue" (right, priority 99) | The status bar's "Send feedback", whose tooltip names AI issues, opening the sheet with its AI-issue box (R10, R11) |
  | AI information's "Report AI output", opening the report window on the AI's sheet | AI information's "Report an AI issue", opening the sheet ready for an AI issue (R12) |
  | The report window: the visible address, Copy, the three outcomes (opened, no e-mail app, too long), no claim of delivery | The hand-off sheet (R13), with the same transport, bound and honesty test |
  | All commands' "Send Feedback": a reaction, then optional words, sent even with usage data off | The sheet's straight route, sent the same way (R11; J2 for the reactions) |
  | The editor title's feedback button, contributed and hidden since Sprint 53 | Left as it is, running the same command |
  | The AI's empty chat: three examples that send at once (Claude, OpenCode); ChatGPT's "Type a message to start." and its compatibility notice | The starting points, which fill the box (R8); the compatibility notice stays |
  | What moved, above Waiting for you | The same card and rule, under it (R2) |
  | Tasks' side bar when empty: "Nothing waits for you", a sentence and New task | R9's words; New task stays on the bar |
  | The conversations panel when empty: "No conversations yet" | R9's words |
  | Transcribe's empty library: Record, Transcribe a file, the accepted kinds; the engine's first run | R9's words; the accepted kinds and the first run stay |

## Engineering requirements

### E1: The same for every AI

- The ready request, the Ask with menu, the starting points, the offers (if built), the Word reading (whichever is decided), the empty places and the AI-issue report each work with Claude, ChatGPT and OpenCode, and each is tried with all three (scenarios).
- No runtime-specific code path for any of them, beyond the one place each runtime already sends a turn. The Word tool, if built, is defined once in `src/runtime/ritemarkTools.ts` (locked decision, Sprint 130).

### E2: Guidance writes nothing into the person's folder

- What the guidance remembers (which cards have gone in which project, the chosen AI on the card, the saved days, the feedback card's answer per release) lives in this computer's global state, never in `.ritemark/` or anywhere in the project.
- Counting files reads names only (R3).

### E3: Pure rules, tested

- Home's guidance order, the ready request's kind and lifetime, the counts line, the saved days, the starting points' choice, the "…" fill and the sheet's route are pure modules with no `vscode` import, each with unit tests.
- The sheet's words are in one copy table, and the honesty test of Sprint 126 (`DELIVERY_CLAIM_WORDS`) covers every e-mail-route string.
- New webview ↔ host messages are typed in their protocol files with exact-field decoders, as Home's and the board's are.

### E4: Bundles (#107)

- `media/webview.js` and `out/extension.js` are measured before and after. If R1a is built, the Word converter lives in the extension host's bundle (`out/extension.js`), not in `webview.js`.

### E5: Shell parts, builds and Windows

- The shell parts are named and small: patch 015 (Help ▸ Send feedback) and patch 018 (the sheet over the window). All patches apply on the pin, a second `apply-patches.sh` run is clean, and the stacking check passes.
- After the shell merge, a production build from a clean-room worktree at the merged commit (a build check) and a Windows build from main.

### E6: Docs and the Store

- `architecture.md`: Home's guidance, the feedback door (replacing *AI output reporting*'s entry points), the starting points, and, if built, the documents tool group; the version-history row.
- `CLAUDE.md`'s patch table for 015 and 018.
- The Microsoft Store certification notes for 2.1 describe the new feedback path exactly (policy 11.16; the shape's risks).
- User docs that name Report AI issue (`docs/user/features/ai-agents.md`, `docs/user/troubleshooting.md`).
- The privacy lines for R15's events, sent to the Development manager for `ritemark-web`.

## Non-Requirements

- **Which plans work, and Claude's refusal card** (#496, experience 35 frame 6): the 2.1 sprint for item 4. This sprint only keeps the ready request's card when a request is refused.
- **Counting AI chat turns and the first reply's outcome** (#479, #473): item 4's sprint. This sprint's events stand on their own.
- **A microphone in the message box.** 2.0 has none; voice there goes with #411.
- **Renaming 2.0's surfaces** ("All conversations" to "All chats", the AI status item's words, plain-word command names): the post-2.0 redraws are out of 2.1 (the shape, §2).
- **Reading PDFs through Ritemark** unless the spike's rule takes it in (technical plan).
- **A Ritemark e-mail address** (the shape's decision 7: info@productory.eu for 2.1).
- **Ratings, stars, NPS, a history of what was sent** (experience 34, *Not on it*).
- **Reading the whole folder at the start**, a starting point only one AI can do, tasks made from a chat (experience 35, *Not on it*; Jarmo, 15 October).

## What the drawings show that 2.0 draws differently, kept as shipped

| Drawn | 2.0 as shipped | This sprint |
|---|---|---|
| The composer: + · Auto · signal · "Claude ⌄" · context ring · send, "Claude works only in this folder. AI info" under it | One runtime and model menu ("Claude · <model>"), Manual/Auto/Plan, thinking effort, attach, AI information, Send; the placeholder "Ask Claude... (type @ to mention an agent, / for commands)", or "Ask Claude about this project" after the landing | Unchanged. The starting points sit above 2.0's composer and fill its box |
| Status bar: "● Claude ready" | "AI Ready" with a cloud | Unchanged here (item 4's sprint owns the AI item) |
| Status bar, left: "Getting search ready · 112 of 144" | Nothing | Not built |
| Waiting for you, empty: "Nothing yet. When Claude needs your answer or your check, it shows here first." | "Nothing waits for you." | Unchanged (*Open Questions*, D9) |
| Project rows tagged "new" and "sample" | Mark, name and count | Unchanged (D9) |
| The answer's steps: "Looked at the names of 144 files", "Read the 5 newest documents" | Each runtime's own activity rows | Unchanged; the steps are the AI's |
| Experience 34 frame 1: the feedback card directly under the project's head | — | Experience 35's order (R2) |
| Experience 29 frame 3's starting points ("Suggest three numbers for the year", …) | — | Experience 35's list (R8) |
| Experience 29 frame 2's left column with To do and Doing headings | 2.0's Tasks side bar | R9 |

## Resolved Questions

- **2026-10-21 (Jarmo, the shape):** all eight recommendations approved, among them one shell release (decision 1), feedback and AI reports to info@productory.eu (decision 7), and offering ChatGPT in Claude's refusal card (decision 6, built by item 4's sprint).
- **2026-10-21 (the Experience lead, experience 35 and #498's comment):** the empty project's start is typed, with no microphone; What moved moves under Waiting for you; a refused or failed request leaves the card on Home.
- **2026-10-19 (Jarmo):** "Send feedback in status bar in very bottom" (experience 34's placement).
- **2026-09-15 (Jarmo):** reports go to info@; a report may carry the output the person reviewed.
- **2026-10-15 (Jarmo):** nothing asks the AI to make tasks in a chat.

## Open Questions

**For Jarmo** (product calls; the sprint plan carries the recommendations):

- **J1.** The sheet over the whole window, and Help ▸ Send feedback, are shell changes (patches 018 and 015). Recommended: yes, in 2.1's shell release.
- **J2.** All commands' "Send Feedback" today asks for one of four reactions, then optional words. Recommended: it opens the new sheet, and the four reactions retire (experience 34, decision 2: only a message). HARD RULE #1 makes this Jarmo's word.
- **J3.** Frame 2's offer cards are new work the shape did not name: a Ritemark tool all three AIs call, drawn as cards. Recommended: try it in the spike, and build it only if all three AIs pass; otherwise the offers stay in the answer's words and the Experience lead redraws frame 2.
- **J4.** Experience 29's Tasks frame lists "Ask Claude for something that changes documents: it becomes a task." first, which neither 2.0 does nor the 15 October rule allows, and experience 29's README leaves it out. The shape also says "a sentence" where the drawings have more. Recommended: build experience 29's frames without that line, and ask the Experience lead to confirm and to word Transcribe.

**For the Experience lead, through the Development manager** (small asks; the manager may answer):

- **D1.** The feedback card and the ready request on the same day: read as in R14 (the feedback card waits one day, then takes the place once). Recommended as written.
- **D2.** The sentence under "What shall we work on?" is in frame 5 and experience 34, not in frames 1, 3 and 4. Recommended: always, as the README's "the sentence above them" says.
- **D3.** No AI ready: the card's main part opens Ask with. Recommended as written.
- **D4.** Starting points step aside while the box holds the person's own words. Recommended as written.
- **D5.** The straight route's failure words. Recommended: "It didn't go. You may be offline. Try again, or open it in e-mail.", with Try again and Open in e-mail.
- **D6.** If PostHog's answer cannot prove the message arrived, frame 4's "It's with the people who make Ritemark" claims too much. Decided by the Phase 1 audit; the words follow it.
- **D7.** Help menu's order. Recommended: Getting started, Support, Send feedback, then 2.0's rest.
- **D8.** "No chats yet" in a panel 2.0 calls Conversations. Recommended: 2.0's word, "No conversations yet. A conversation you start…", until the post-2.0 renames.
- **D9.** The drawn-but-not-changed table above. Recommended: confirm as kept.
- **D10.** The last answer shortened to fit an e-mail link, marked "(shortened)" in the quote. Experience 34 leaves this to the Development manager. Recommended as written.
- **D11.** The feedback card's send carries `asked: 'made_this_week'`, so the Friday reader knows which question it answers. Recommended; listed for the privacy page.
