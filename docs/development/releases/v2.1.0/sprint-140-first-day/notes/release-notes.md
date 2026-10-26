# Sprint 140's part of the 2.1 notes (E6)

Drafts for the release's closeout to fold into `docs/CHANGELOG.md`, the 2.1 release notes and the Store's 2.1 certification notes. They are kept here so the parallel sprints do not edit the same lines.

## CHANGELOG, under 2.1.0

### Added
- **A first request on Home (Sprint 140, #498).** A new project's Home offers one ready request under Waiting for you: in a folder with files, "Ask <AI> what is here", sent at once in a new chat (the AI looks at the names, reads the five newest documents and ends with two things it could do next), with what the folder holds counted from the names alone ("37 files: 20 Word documents, 10 PDFs, 4 spreadsheets and 3 text documents."); in an empty folder, "Tell <AI> what this project is for", which puts "This project is for " in the message box, then "Then write About this project from it, and a first outline as a document.", and sends nothing until you do; in the sample, "Ask <AI> to draft Module 4", which gives the board's task to the AI. Ask with chooses the AI, with Sign in or Set up for one that is not ready. The card goes once answered, once you start a chat of your own there, or with ×.
- **Starting points in an empty chat (Sprint 140, #498).** "What shall we work on?" and up to three starting points chosen by what is in front: the project, an empty project, the sample, a short or long text, a table. A click puts the words in the message box, ready for Send; nothing is sent. They step aside while you type. These replace 2.0's three examples, which sent at once.
- **Send feedback (Sprint 140, #466).** In the status bar, in Help, in AI information (as Report an AI issue) and in All commands, one sheet over the window. With neither box ticked, Send sends your words straight from Ritemark, even with usage data off, and says thank you only when the service accepted them; if it didn't go, your message stays with Try again and Open in e-mail. Ticking "This is about something the AI said or did" or "I'd like an answer" goes through your own e-mail app to info@productory.eu; in a chat, the AI's last answer can be added as a quote you see first. Replaces Report AI issue's window and Send Feedback's four reactions.
- **A line on Home in your first week (Sprint 140, #466).** On the third day you save a document in this release, Home asks "What did you make with Ritemark this week?" once; Send or Not now ends it.
- **Empty places say what they are for (Sprint 140, #498).** The task board with no tasks, the conversations panel with no chats, and Transcribe with no recordings.

### Changed
- **Every AI says which files it could not open (Sprint 140, #497).** Claude, ChatGPT and OpenCode are told to name a file they could not open (a scanned PDF, a protected document) rather than leave it out.
- **ChatGPT's file citations are links (Sprint 140).** They were drawn as raw markup.
- **Every AI knows what About this project is (Sprint 140).** Asked to write About this project, Claude, ChatGPT and OpenCode write the project's `AGENTS.md`, which Home shows as About this project.

## The Store's 2.1 certification notes

Replace 2.0's line on Report AI issue with:

- "Send feedback" (status bar, Help menu, and "Report an AI issue" in the AI information window) opens one sheet. To report AI output, the person ticks "This is about something the AI said or did"; the report goes through their own e-mail app to `info@productory.eu`, is shown before the e-mail app opens, stays copyable without a mail handler, and Ritemark never says it was sent. A message with no box ticked is sent from Ritemark to the developer's analytics service, and the app says thank you only after the service accepted it.

## Privacy lines for `ritemark-web` (to the Development manager)

New usage events, sent only after the person said yes to usage data, with no words, file or project names, paths, file counts or addresses:

- `ready_request_used`: which of Home's first requests was used (`what_is_here`, `what_for` or `module_4`) and which AI provider.
- `starting_point_used`: which kind of starting point was used (`project`, `empty_project`, `sample`, `short_text`, `long_text`, `table`, `word_or_pdf`), whether it was edited before sending, and which AI provider.
- `made_something`: that a document was made, exported or published in a session (`new_document`, `export`, `publish`), and whether a first request came before it.
- `feedback_opened`: which door opened Send feedback (`status_bar`, `help`, `ai_info`, `command`).

Changed: `feedback_sent` (sent even with usage data off, as the person's own send, from a one-off id) can carry `asked: made_this_week` when it comes from Home's first-week card, and no longer carries a reaction.

Removed: `reaction_submitted` (Send feedback's four reactions retired).
