# Changelog

All notable changes to Ritemark Native are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — Unreleased

Ritemark 2.0.0 is built on main in three steps and released as one version. This section covers steps 1 and 2: Surfaces and frame (Sprint 132) and The welcome (Sprint 133). Step 3 adds to it.

### Added
- **The places row (Sprint 132).** Ritemark's places sit in one row at the top of the left column: Home, Documents, Tasks, Browser, Agents, Transcribe, then **More** (⋯). More holds Copilot Chat, File changes, Extensions, Search and any other place. A place can be dragged to another spot in the row, and the order is kept.
- **The left column's head (Sprint 132).** The column starts with the project's mark and name, with a menu, then **New** and **Search**. New makes a document, folder, agent, skill, command or flow.
- **A + on the tab row (Sprint 132).** The **+** at the end of the tab row makes a new Text, Table, Web page or Terminal tab.
- **You (Sprint 132).** A menu at the top right with **Settings** and **Help**.
- **Narrow windows make room for the document (Sprint 132).** Below 1400 points wide the AI's column narrows. Below 1200 the left column hides, and below 960 the AI hides too. Widening the window brings back only what narrowing hid. A column you open yourself stays open until the window narrows past that width again.
- **File icons (Sprint 132).** PDF, Word, Excel, CSV, PowerPoint, image and audio files have their own icons in the file tree.
- **New → Command in Agents (Sprint 132).** New in Agents makes agents, skills, commands and flows. Commands are new: New → Command makes a command in `.claude/commands/` and opens it.
- **Closing a running terminal asks first (Sprint 132).** When a terminal's command is still running, closing it asks before stopping the command, with **Don't ask again**.
- **A welcome on the first start (Sprint 133).** On the first start with no folder open, one sheet sits in the middle of an otherwise empty window, with no strips, tabs or side columns. It has two steps.
- **Which AI do you use? (Sprint 133).** ChatGPT and Claude each read "Sign in with the account you already use." with **Sign in**, or **Continue** when already signed in. OpenCode reads "Open models, with an API key of your own." with **Set up**, and the step says you can use more than one. **API keys** lets you use Claude with an Anthropic API key of your own, and **Skip for now** goes on without an AI. Each AI shows **Checking…** until its check answers, and a check that does not answer within 20 seconds offers **Try again**.
- **Where is your work? (Sprint 133).** **Open a folder…**, **Start a new project** or **Try the sample project**. Ritemark makes a new project's folder in Documents/Ritemark, and **Change…** picks another place. The sample project, "A small leadership programme, with documents to work on.", is a folder named "Leadership programme" with a brief, modules, kickoff notes and tasks on its task board. A second copy goes to "Leadership programme 2", and an existing folder is never written over.
- **The window after the welcome (Sprint 133).** The window opens on the project with Documents open, the AI's sheet on a new chat that reads "Ask Claude about this project" (or the AI you signed in to), and an empty desk.
- **Tiles on an empty desk (Sprint 133).** Every empty desk offers Text, Table and Web page as tiles.
- **Welcome to Ritemark 2.0 (Sprint 133).** Updating from Ritemark 1 shows it once. It lists your AIs and whether each is signed in, with **Add another** for more, and up to three recent projects with the one you left first. **Open when you left** brings the window back as it was. **Open another folder…**, **Start a new project** and the usage-data switch are there too.
- **Where do you want to start? (Sprint 133).** A later window with no folder asks this, with your recent projects, **Open another folder…** and **Start a new project**.
- **A usage-data switch (Sprint 133).** On the welcome and in Ritemark Settings: "Share anonymous usage data to improve Ritemark. Never your documents, chats or names.", with links to the Privacy Policy and Terms of Use. Usage data is off until you turn it on, and nothing is sent before you say yes. Turning it off stops sending at once.
- **Four new anonymous counts (Sprint 133).** With usage data on, Ritemark also counts four steps, beside the app starts and features used it already counted: the welcome shown, an AI signed in, a project opened and the first message sent. Never a path, a name, a file, a message or an account.
- **Git and Node.js in Ritemark Settings (Sprint 133).** When you use this computer's own Claude or Codex, Settings shows Git and Node.js under the runtime choice, the rows from the old launch check.

### Changed
- **No title row (Sprint 132).** On the Mac and on Windows, each column starts with a strip that holds its controls on one line: the traffic lights or Windows' buttons, a toggle for each side column, the tabs and **You**.
- **Three levels, no lines (Sprint 132).** The window has a flat ground, the AI on its own sheet, and the documents on a raised desk. There are no lines between the parts.
- **Ritemark Light and Ritemark Dark redrawn (Sprint 132).** Ritemark Dark uses deep indigo surfaces instead of slate, and its buttons are the light indigo with dark text. Muted text in Ritemark Light is darker (#617187), so it is easier to read.
- **Copilot Chat moves behind More (Sprint 132).** It no longer takes the AI's column. Choosing it in More opens it as a tab on the desk.
- **The terminal is a tab (Sprint 132).** A terminal opens as a tab on the desk, named "Terminal", "Terminal 2" and so on. Its bar shows **Running** while a command runs, with **Stop**, **Split**, **Clear** and **Close**. Ctrl+` (⌃` on the Mac) opens a new terminal tab. The terminal panel is gone.
- **Tabs as wide as their names (Sprint 132).** Each tab takes the room its name needs. When the row is full, the tabs used longest ago fold into "N ⌄" instead of scrolling. "N ⌄" lists them and brings one back.
- **The pinned Task board tab stays first (Sprint 132).** Once pinned, the Task board tab stays first in the row and can't be closed or moved by mistake.
- **⌘, opens Ritemark Settings (Sprint 132).** Ctrl+, on Windows. **Settings** in You opens the same page.
- **Ritemark's own menus and dialogs (Sprint 132).** On the Mac and on Windows, Ritemark draws its menus and dialogs itself, with 32-high rows and the chosen row in indigo. Menus close on any click outside them. The command palette and notifications share the look: the same sheet, 32-high rows and 32-high buttons.
- **The file tree (Sprint 132).** No carets, and rows are 32 high.
- **The flow editor redrawn (Sprint 132).** A bar with the flow's name, description, schedule, **Auto-arrange** and **Run flow**. The steps you can add are listed by kind. Each step's card shows its settings, and a step's settings open in a column beside the flow. Claude Code and Codex steps say plainly that they run without asking, because their actions are approved for the run. If Claude Code or Codex isn't signed in, the run says to sign in under **Settings > Agent Runtime**. The prompt field grows with its text.
- **The Agent Library is Agents (Sprint 132).** Each item is one line: its file name with its extension. Its description and who it is for (Claude, ChatGPT or shared) are in the tooltip and in the agent's settings. The agent's settings sit in a panel beside its instructions, and its schedule is one field.
- **PDF, Word and PowerPoint pages on a canvas (Sprint 132).** The pages sit on a soft canvas below the viewer's bar.
- **CSV rows stay one line (Sprint 132).** Long values are read in the formula bar.
- **The places row gets Ritemark's order once (Sprint 132).** On the first start of 2.0, a 1.14 profile's places row takes Ritemark's order. Places moved after that stay where they are put.
- **Ritemark 1's usage-data notice is gone (Sprint 133).** If you pressed **OK** on it, or closed it without **Opt Out**, usage data stays on after the update. If you chose **Opt Out** or never answered, it is off.
- **Send Feedback says what it sends (Sprint 133).** Under the text box: "What you write here is sent with your feedback." Pressing Send sends your feedback even with usage data off. Then it sends only your reaction and what you typed, under a one-off id that isn't kept, and usage data stays off. Escape sends nothing.
- **Help's Welcome opens Ritemark's welcome (Sprint 133).** VS Code's Getting Started page is gone. Help's **Welcome** and the walkthrough commands open Ritemark's welcome instead.
- **File extensions in a lighter ink (Sprint 133).** In the file tree and on tabs, a file's extension is in a lighter ink. The chosen tab and row stay in full ink, and high contrast themes keep full ink.

### Fixed
- **Updating keeps the theme you chose (Sprint 132).** Ritemark re-applied its theme set-up whenever the version changed, so every update reset a theme picked by hand. The set-up now runs once per profile.
- **Settings' Appearance follows the theme (Sprint 132).** When the theme changed elsewhere, Appearance kept showing the theme it opened with. It now follows.
- **New Text and Table go in your project (Sprint 132).** Text and Table, from the + and from New, made their file in Documents/Ritemark, outside the project. With a project open, they now make "Untitled.md" or "Untitled.csv" in the folder chosen in the tree, or the project's top folder, and never over another file.
- **Saving after Use disk version (Sprint 132).** After choosing **Use disk version** in a conflict, every save failed until **Overwrite**. It saves again.
- **Table handles follow the page (Sprint 132).** A table's + and delete handles sat off their rows after the document scrolled.
- **New agents and commands without a reload (Sprint 132).** @ and / now list agents, commands and skills added while the window is open.
- **Document properties (Sprint 132).** The Add menu fits its panel, and a property you add takes the cursor.
- **Menus in the AI's sheet (Sprint 132).** The thinking-effort menu stays inside the AI's sheet, and the dictation language menu closes with Escape.
- **Transcribe's settings (Sprint 132).** Transcribe's gear opens Settings at transcription's own settings, not at the top of the page.
- **A Markdown file opens once on the first launch (Sprint 133, #429).** Opening a Markdown file on the very first launch sometimes opened it twice. It now opens once, in the Ritemark editor.

## [1.14.0] — Unreleased

### Added
- **A task board in every project folder (Sprint 130, #119).** **Tasks** in the activity bar opens a side bar with Your calls, Doing, To do, Ideas, Done (the last four weeks) and Archived; the **Task board** tab has Your calls, Board, Ideas and Log. Each task is a Markdown file in `.ritemark/tasks/`, so the board travels with the folder, and clicking a task opens it as a page in the Ritemark editor with its title, **Done when**, files and body. **Give to Claude** (or Codex or OpenCode, from the arrow) runs the task in its own conversation in the AI sidebar; the result comes back onto the task with the agent's report, up to three things to check, the changed files and the time it took, and the user chooses **Mark done** or **Ask for changes…**. Your calls lists what waits on the user: results to review, agents waiting for an answer or approval, decisions an agent left, failures. Doing holds three tasks by default, a second agent never starts on a file another agent is changing, and a waiting task starts by itself when there is room. Ideas can be reviewed by an agent (a verdict, why, a size and a suggested task) and turned into tasks with **Make it a task**. Agents get board tools in every conversation and every runtime: they can list, add and move tasks, report a result and leave a decision, but never mark a task done, archive or delete it. On by default; `ritemark.features.task-board` turns it off.
- **Haiku 5.5 (#424).** Anthropic's newest Haiku is in the Claude Code model menu as the quick and light model. The bundled Claude Code 2.1.296 resolves `haiku` to it.
- **Task board on Home (#421).** A **Task board** button right after "New AI conversation", shown when a folder is open.
- **A guide to the task board** in the user docs.
- **Voice dictation on Windows and Intel Macs (Sprint 129, #133, #203).** The microphone in the document header now works on Windows and Intel Macs, with the speech turned into text on the computer itself. Because these computers do it on the processor alone, dictation works as "speak, then text": you talk, press Stop, and the text arrives about 20 seconds later on a typical laptop, even after a long dictation, because Ritemark works through the recording while you speak. A note at the cursor says it is recording, then processing and how long that usually takes; nothing is typed along while you speak.
- **On-device Transcribe on Windows and Intel Macs (Sprint 129).** On-device · Whisper now works there for MP3, WAV, FLAC, OGG and Record files; on Windows, `.m4a` and `.aac` say to use ElevenLabs. A typical Windows laptop takes about as long as the recording.
- **A smaller speech model on Windows and Intel Macs (Sprint 129).** They download 834 MB instead of 1.5 GB, with the same accuracy.
- **A guide to voice dictation** in the user docs.

### Changed
- **Browser Recent lists every page you visit (Sprint 131, #195).** Recent recorded only pages opened by a command, so typed addresses, clicked links, back and forward, pages the AI agent opened and opened `.html` files never appeared. Every page the browser shows is now recorded once, at the address it ended on, with its title shown above the address. Failed loads, in-page `#anchor` jumps and client redirects that leave within a second are not recorded; a link opened in a background tab is recorded when you switch to it; a local file that no longer exists drops out of the list.
- **GPT-6.1 Sol is the default Codex model (#418, #398).** New Codex conversations start on GPT-6.1 Sol; GPT-5.6 Sol stays in the menu as the previous Sol. A Codex conversation that ran on GPT-5.6 Sol continues on GPT-6.1 Sol after the update, with its earlier messages as context. A conversation's model pick is not kept across a restart yet (#417).
- **Model menus offer Claude 5 and newer (#424).** Older Claude models (Opus 4.8, Haiku 4.5 and any other 4.x, from the catalog, Claude Code's own list, an API key's model list or OpenCode) are no longer offered. A conversation or setting that already uses one keeps running on it, with no substitution notice, and the model button shows its name. A subscription's saved `haiku` choice follows Claude Code to Haiku 5.5.
- **Updated built-in agents (#424).** Claude Code 2.1.289 → 2.1.296, Codex 0.160.0 → 0.162.1, OpenCode 1.18.34 → 1.19.0.
- **Activity Bar order (#421).** Home, File browser, Tasks, then VS Code's own items, then Transcribe, Browser and Agent Library. A profile from v1.13 gets this order once, on the first start of 1.14.0, which moves Agent Library to the end of Ritemark's tools; later moves by the user are kept.
- **Apple silicon Macs with macOS 12–14 can dictate and transcribe on-device (Sprint 129).** The on-device engine shipped since 1.0.3 needed macOS 15; it is rebuilt for macOS 12 and later.
- **Dictation tells you why it can't start (Sprint 129).** A blocked microphone, a missing microphone, security software stopping the engine, a processor that is too old, or a missing speech model each get a plain dialog with the right button: **Open Microphone Settings** names the exact Windows or macOS switches. The model is never offered for download on a computer where dictation can't run.

### Fixed
- **Dictation never drops what you say (Sprint 129).** When transcription ran behind, speech that arrived meanwhile was thrown away. It now waits and is transcribed next, in order.
- **The last words after Stop (Sprint 129).** The microphone button looked finished while the last sentence was still being turned into text, and a new dictation could start in the middle of it. It now shows **Adding your last words...** until they are in.
- **The dictation note is never saved into your file (Sprint 129).** The grey **Listening...** note was document text, so autosave wrote it into the file while you dictated. It is now drawn on top of the document.
- **Dictation's start can be cancelled (Sprint 129).** Clicking the microphone again while it got ready did nothing, and the microphone then started anyway. It now cancels.
- **Dictation on Intel Macs no longer fails silently (Sprint 129, #203).** It downloaded the 1.5 GB model and then never inserted any text.
- **Dictated sentences containing "processing" are kept (Sprint 129).** A filter for status lines dropped them.
- **Silence no longer turns into invented text (Sprint 129).** With the microphone muted, or during a long pause, Whisper made up words such as "Kõige!" or "you". Silent audio is now skipped. A dictation that heard nothing at all says so ("Ritemark Heard Nothing") and names the mute key and the microphone setting, and a muted or blocked microphone is noticed within a few seconds.
- **The download prompt can't get lost (Sprint 129).** The voice-model download and resume prompts are dialogs now. As a notification, the prompt could slide out of sight, and the microphone then seemed to do nothing.
- **The microphone button says what a click does (Sprint 129).** While you dictate it reads **Transcribe now** on Windows and Intel Macs (**Stop** on Apple silicon), and **Transcribing…** / **Finishing…** while the text is on its way.
- **Browser tools work in every Claude conversation (Sprint 130).** With several Claude conversations open, only the first one reached Ritemark's browser tools. Each Claude session now gets its own tool server, and the browser tools come from one registry shared by all three runtimes, with their names unchanged.
- **No model notice on the first Claude conversation (#419).** The `ritemark.ai.selectedModel` setting shipped with the retired `claude-sonnet-4-5` as its default, so a profile where no Claude model had been picked said "claude-sonnet-4-5 isn't available right now — using Sonnet 5.5" on its first Claude turn. The default is now empty, and such a profile starts on the catalog default, Sonnet 5.5, without a notice. A model the user picked still wins.
- **Audio files open without the "multiple default editors" question (#412, #406).** `.wav`, `.mp3` and `.ogg` files opened in Transcribe but also showed "There are multiple default editors available for the resource.", because the built-in Audio Preview claims them too. Transcribe is now the default for all six audio types it opens; Audio Preview is still under **Reopen Editor With…**, and a choice the user already made is kept.
- **Comment tasks are cleaned up (#404).** Finished comment tasks were never removed, and every update read all of them. At startup, finished tasks older than 30 days are now removed and at most 500 are kept, as documented since 1.11.0.
- **The Agent Library's More actions button (#396, #391)** uses the same Phosphor three-dot icon as the rest of Ritemark, with the same hover and open look.

## [1.13.0] — 2026-10-11

### Added
- **Sonnet 5.5 (#386).** Anthropic's newest Sonnet is the recommended model in the Claude Code model menu. Sonnet 5 stays in the menu as the previous Sonnet.
- **GPT-6.1 Sol, GPT-6 Sol and GPT-6 Luna in Codex (#386).** Ritemark's built-in Codex can now run them, and they appear in the Codex model menu once Codex has listed them for your account. New Codex conversations still start on GPT-5.6 Sol.

### Changed
- **Transcribe library rows and renaming recordings (#389, #371).** A recording's title uses the whole row and wraps to two lines, with its date and length below. Each recording's actions sit in one **…** menu, also on right-click: open the saved document, **Rename…** and remove. **Rename…**, in the library or the transcript's header, renames the audio file on disk; its transcript, speaker names and corrections move with it, and another file is never overwritten. The conversation list and the conversation header use the same **…** menu.
- **Updated built-in agents (#386).** Claude Code 2.1.281 → 2.1.289, Codex 0.154.0 → 0.160.0, OpenCode 1.18.30 → 1.18.34.

### Fixed
- **Claude's background work shows its real state (Sprint 128, #393).** Claude now runs many subagents in the background. Ritemark used to say "Done" while they still ran, kept their spinners going forever, and dropped Claude's own follow-up when they finished — its answer and any files it wrote. Now the status line says "Done — 1 task still running in the background", each card follows its task to the end ("Running in the background", "Stopped", "Ended when the session closed"), each running task has its own stop button, and Claude's follow-up appears in the conversation as a new turn ("A background task finished — Claude is continuing"). Switching model or agent while work runs asks first. In Ask mode, changes a background subagent or a follow-up turn wants to make now ask for approval; before, they went through without asking.
- **Send uses the Claude model you picked (#385).** After switching from Claude to Codex and then to a different Claude model, the model button and its check mark stayed on the old Claude model, and Send ran the prompt on that old model. The button and Send now follow your pick.
- **The message box fits a narrow AI side bar (#387).** Below the default width, AI information and attach move into a **…** menu so Send stays in view, and at the narrowest widths the controls take a second row. Context chips keep their ×, and the `/` and `@` pop-ups fit the room above the message box.
- **A new Codex conversation no longer fails on its first prompt (#379, #375).** Ritemark read its list of Codex models from a file that every Codex app on your computer shares. When another Codex app, such as the Codex desktop app, had written that list for a different Codex version, Ritemark could offer and pick a model its own Codex can't run, and the first prompt failed. A list written by another Codex version is now ignored, and a new Codex conversation starts on Ritemark's default Codex model, GPT-5.6 Sol.
- **Word count, Contents and comment markers follow every change to the document (#380, #378).** When an agent edited the file, or it changed on disk, the word count, the Contents list and the comment markers kept showing the old text until you typed. They now update with every change, wherever it comes from.
- **The word count counts every word (#380).** The count dropped one word for each paragraph, heading or list item. It now matches the text.
- **The status bar shows the count for the tab you are in (#380).** With several documents open, the word count could belong to another tab. It now follows the active tab, and it is hidden when the active tab is not a Markdown document.
- **Conversation titles in the list are readable (#381).** In the **Conversations** list, every title was cut after about ten characters at the default side bar width, because the row's hidden buttons still kept their space. A title now uses the whole row and wraps to two lines, and the row's actions sit in one **…** menu (#389), so they never cover the title.
- **Message box menus are no longer hidden (#382).** At the default side bar width, the permission mode and model menus opened partly under the strip of conversation buttons beside the message box, and the `/` and `@` pop-ups were cut off at its edge. They now open within the conversation column and fit beside the strip.
- **Word tables have space inside their cells (#370, #369).** In a Word document whose tables use no table style, the text sat right against the cell borders. The preview now leaves the same space inside cells as Word does, including in tables in headers, footers and notes.

## [1.12.0] — 2026-09-29

### Added
- **Claude Opus 5.5 (Sprint 127, #343).** Ritemark now bundles Claude Code 2.1.281, the version Anthropic requires for Opus 5.5, so Opus 5.5 appears in the Claude Code model menu for subscription and API-key users alike. If you had chosen Opus, you move to Opus 5.5 automatically. Sonnet 5 stays the recommended default.
- **Model list corrections without an app update (Sprint 127).** Ritemark checks its public model list every 10 minutes and applies a change without a restart. A list that is older than the app can no longer hide a model the app knows, and a model marked retired in it is hidden everywhere.
- **Publish to Google Docs (Sprint 119).** Connect a Google account once in the new **Google Docs** card in Settings, then choose **Export → Create Google Doc** and the document appears in your Google Drive as a real Google Doc. Headings, lists, tables, links, code, quotes, images and diagrams all come through, and Ritemark remembers which Doc belongs to which file. Ritemark asks Google for one permission, which covers only the Docs it creates and the template you pick; sign-in tokens are stored encrypted on your computer, and Disconnect revokes the access without deleting any Google Doc. Two things Google's API can't do: a ticked checkbox arrives unticked, and bullets nested under a numbered item show as a., b.
- **Sync Google Doc updates the same Doc (Sprint 119).** After you edit, **Export → Sync Google Doc** updates that Doc: same link, same sharing, no copies piling up in Drive. Sync is one-way — your markdown file is the original, and nothing is read back from Google Docs. Ritemark asks before the first overwrite, warns again whenever someone has edited the Doc in Google Docs since your last Sync (with **Open Google Doc**), and when nothing has changed says so and writes nothing. When a Doc can't be synced, Ritemark says why: a Doc in the Drive trash can be restored or unlinked, a Doc published from another Google account asks you to reconnect that account, and a missing or unsupported image is named rather than silently dropped.
- **Google Docs templates (Sprint 119).** Pick any Google Doc as a template and new Docs start as a copy of it, with your fonts, colours, header and footer. Sync replaces only the text, so the template's look stays.
- **Record in Transcribe (Sprint 118).** A **Record** button, marked with a dot, sits beside **Add recording**. The first press brings up the operating system's microphone permission prompt; while it waits, the panel shows "Waiting for microphone permission…" with **Cancel**. While recording, the panel shows the elapsed time and the approximate size of the audio actually saved so far, with **Stop and use** and **Cancel**. Stop puts the recording into the same engine-choice card as Add recording: nothing is transcribed and nothing is uploaded until you choose an engine, and clearing the card keeps the file. Available on macOS and Windows and on by default; the setting `ritemark.features.transcribe-direct-recording` switches it off and hides Record, and a recording already in progress still finishes.
- **Recordings are ordinary files in a predictable place (Sprint 118).** With a folder open they go into a `recordings` folder inside the project; with several folders open, into the folder of the file you are editing, otherwise Ritemark asks which. With no folder open, Ritemark asks where to save before the first recording, remembers the choice, and shows it under the buttons with **Change**. Files are 16 kHz mono WAV (about 115 MB per hour) named by date and time, such as `Recording 2026-09-22 14.05.wav`. An existing file is never overwritten: a second recording in the same minute gets " (2)".
- **A recording survives a reload, quit, or crash (Sprint 118).** Audio is written to disk as it happens, as a `.wav.part` file next to where it will land. If the panel reloads or Ritemark quits or crashes mid-recording, the panel shows "Recording interrupted" with **Save recording** and **Discard**; Discard moves it to the Trash. If the system pauses audio input, the microphone disconnects, or Ritemark cannot keep up with saving, the recording stops and what was recorded is saved, with a note saying why. A warning appears after 2 hours, and at 4 hours the recording stops and saves automatically.
- **Cancel asks before discarding a recording (Sprint 118).** Once there are more than 5 seconds of audio, Cancel asks first, and it moves the recording to the Trash rather than deleting it.
- **Denied microphone access is explained (Sprint 118).** The panel says so and offers **Microphone Settings**, which opens the system privacy settings on macOS and Windows.
- **The microphone is recorded as it is (Sprint 118).** No echo cancellation or noise suppression, so the other side of a call played through the speakers is kept.
- **PowerPoint presentations open as slides (Sprint 125).** A `.pptx` opens read-only in its own tab, drawn locally: the slides stack and scroll, each with its speaker notes under it. Text, tables, pictures, shapes, layouts, backgrounds and design themes come close to PowerPoint; charts are drawn approximately, and a multi-series chart is coloured by series as in PowerPoint. The Word preview's toolbar and find bar work here too — *Slide 3 of 24*, zoom with **Fit slide**, and search over every slide and its notes — with **Open in PowerPoint** (or Keynote, or the default app). Audio, video and embedded objects are announced rather than played; a link on a slide opens in the browser after the usual prompt. A kill switch, `ritemark.features.powerpoint-preview`, turns the preview off.

### Changed
- **The model list follows how you sign in (Sprint 127).** With a Claude subscription, the Claude model menu shows what the subscription can run, even when an API key is also saved. With an API key, it shows what the key can use, from Anthropic's model list. A saved model that is no longer available is replaced with a visible line in the chat that names both models, instead of a silent switch. A model your account cannot use is reported by name, with a pointer to the model menu.
- **In-app legal links point to Ritemark's own privacy policy and terms (Sprint 119).** Ritemark now has its own privacy policy and terms of use on ritemark.app, in English and Estonian, and the links in the app (analytics consent and AI information) point there. Productory Services OÜ remains the provider. The privacy policy has a section on exactly what Google Docs publishing does with your Google data. The old productory.ai addresses still work for earlier versions.
- **The conversation you are in is named at the top of Agent Chat (Sprint 122).** A header above the transcript shows the current conversation's title, and its **⋮** menu offers **Rename**, **Pin** or **Unpin**, and **Delete** — the same actions, words and confirmations as the conversation history. A new conversation reads "New conversation" until it has a title.
- **Long prompts have room (Sprint 122).** The Agent Chat composer grows with what you write up to eight lines (it used to stop at about five). Drag the handle on its top edge to set the height yourself — up for taller, down for shorter, as tall as the sidebar allows — or use the arrow keys on it; double-click it to go back to fitting the text. The height you choose is kept while Ritemark is open, and the send button and model control always stay visible, including at large zoom levels.
- **Every link in an agent's reply does something, or says why not (Sprint 122).** A file in your project opens, a folder is shown in the project tree, and a file outside your project is shown in Finder rather than opened. A missing file names the path, and a link Ritemark does not open from chat — such as `mailto:` — says so and offers **Copy link**. Right-click a link (or press Shift+F10) for more: **Reveal in project**, **Locate in Finder**, **Copy path**, **Open in browser**, **Copy link**, depending on where it points.
- **Search a transcript (Sprint 123).** A search field above the transcript finds a word or phrase as you type — case doesn't matter, and words the engine was unsure about are included. It shows how many matches there are ("3 of 12"), moves between them with the arrows or Enter / Shift+Enter, and highlights the current one. Cmd/Ctrl+F puts you in the field; Escape clears it. Going to a match stops the transcript from following the audio, and **Back to playing line** takes you back — also after you scroll away with the mouse wheel.
- **Word documents open as pages (Sprint 124).** A document Word saved shows Word's own page breaks instead of one long sheet, with the right page number on every page, its images placed behind the text (covers, page bands) and its embedded fonts. Office fonts your Mac doesn't have (Calibri, Cambria, Aptos) are drawn in a close system font instead of Times, and there are no blank pages after page breaks. A Word tab no longer loads the whole editor.
- **Every Word document opens as pages, laid out like Word (v1.12.0 RC fix).** The first release candidate showed a document made by another program — a Google Docs export, a generated report — as one long sheet, because only the page breaks Word saves were used. The preview now lays out the pages itself: text that runs past the bottom of a page moves on, a paragraph splits between lines and keeps at least two on each side (as Word does unless a document turns that off), a heading stays with what follows it, and a table breaks between rows and repeats its header row. Line spacing, empty paragraphs and the weight of an embedded font follow Word, so pages end close to where Word ends them. A document with no page setup gets A4 (Letter in the US and Canada). Symbol and Wingdings bullets show as bullets, pictures placed against the page (covers, page bands) are placed there, the bar beside a bordered quote keeps Word's gap from the text and runs on through the whole quote, and footers written by other programs show their page numbers.
- **One toolbar for Word and PDF previews (Sprint 124).** The page you are on, − / + zoom, and a zoom menu with fit width, fit page and sizes from 50 % to 200 %. In Word previews **Open in Word** is the main button — or Pages, or the default app, when Word isn't installed — with **Save as Markdown** behind its arrow; the magnifier or Cmd/Ctrl+F opens the Markdown editor's find bar (a count, Enter / Shift+Enter, Escape), and the preview follows edits made in another app. In a narrow window the labels become icons instead of wrapping.
- **Search a PDF (#344).** The magnifier or Cmd/Ctrl+F in a PDF opens the same find bar as in Word and Markdown. The count covers every page, including pages not yet shown. Enter and Shift+Enter move to each match, loading its page if needed, and every match is highlighted. You can scroll and read on with the find bar open; the view only moves when you step to a match. A scanned PDF with no text says "This PDF has no searchable text" instead of "No matches".
- **A plain reason when a Word file can't be previewed (Sprint 124).** Too large, password-protected, an old `.doc`, not really a Word file, damaged, or built to unpack to hundreds of megabytes — each says so, with **Try again** and **Open in Word**. Charts, SmartArt, embedded objects and equations, which the preview can't draw exactly, are announced above the document.
- **A crowded tab row fits (Sprint 123).** When many files are open, their tabs shrink to fit the row instead of running off the edge; hover a tab for its full name.
- **Every Transcribe button says what it does (Sprint 118).** Each button in the panel has a tooltip that says what it does, or why it is unavailable. **Add recording** now shares one line with the new **Record** button.

### Fixed
- **Agent Chat's "still checking" notice is readable.** When checking Claude, Codex or OpenCode took longer than 15 seconds, Agent Chat showed a loud yellow box whose **Try again** button was white on a light card — the colour it asked for did not exist. It is now the same quiet card as the other Agent Chat notices, says plainly that the check is still running, and its button is visible. The same missing colours and a few backgrounds Tailwind silently dropped are fixed across Agent Chat, and a test now fails when a colour token is used but never defined.
- **Images kept outside the document's own folder now render, and reach every export.** An image written as `![plan](../images/plan.jpg)`, or kept in one shared `images/` folder at the top of a project, was refused by the editor's resource loader and appeared blank. The same failure reached further than the page: PDF and Word export rasterize an SVG by fetching it through that loader, so those images were dropped, and publishing to Google Docs reported "the image file was not found, or is not a PNG or JPEG". The workspace folder holding the document is now a resource root, as it is everywhere else in VS Code, and the live image-refresh watcher reaches as far. Neither the filesystem root nor the home directory is ever widened to. Roots are fixed when an editor opens, so a folder added to the window afterwards is picked up when the document is reopened.
- **Images with a plain relative path now show in the editor (Sprint 119).** An image written as `![diagram](img/diagram.png)`, the form most Markdown tools produce, appeared as a broken image. Only `./` and `../` paths were displayed.
- **Images from a parent folder no longer break on save (Sprint 119).** Editing and saving a document with a `../images/…` image wrote an internal `vscode-resource` address into the file in place of the path, breaking the image in every other app. The original path is now kept.
- **A year at the start of a line stays a sentence (Sprint 120).** Typing `2026. ` at the start of a paragraph turned it into a numbered list starting at 2026, and the saved file kept the list instead of the sentence. Numbers up to 99 still start a list — every number anyone actually types to start one — and 100 and above stay prose. A list can still be started at any number from the toolbar or the slash menu, and a file that already starts a list at a higher number opens exactly as before.
- **The Export menu works from the keyboard (Sprint 119).** Opening it with Enter now moves focus into the menu. The arrow keys move between entries, and Escape or Tab closes the menu and returns focus to the Export button. Previously no entry could be reached without a mouse.
- **Shift+End no longer selects the rest of the document (Sprint 126).** Holding Shift and pressing End selected everything from the cursor to the end of the file instead of to the end of the line, so the next keystroke could wipe out paragraphs and lists further down without you noticing. Shift+End and Shift+Home now select to the end and start of the line you are on, and can never reach past the paragraph, list item or code block the cursor is in.
- **Strikethrough survives a save.** Text struck through in the editor lost its line the moment the file was saved: `~~done~~` came back as plain `done`. Reading the file was never the problem — the editor simply had no rule for writing the mark back out, so the words survived and the strike did not. This also covers the same Save as Markdown from a Word preview. Tildes inside struck text, as in `~5 min` or `a~b~c`, are kept too; before, a struck run starting with a tilde could turn the rest of the document into a code block on reopen.
- **Literal tildes stay put.** A paragraph typed as `a~b~c` was saved as written and reopened with the tildes gone and `b` struck through, and the next save made the loss permanent; a typed `~~word~~` had the same problem. Only tildes that would actually be read back as strikethrough are now escaped, so ordinary text such as `~/Downloads`, `~5 min` and `from ~5 to ~10` is still saved byte for byte, exactly as written.
- **Conversation titles are in the language you wrote in.** Agent Chat names a conversation after its first reply. When your own Claude setup contained text in another language — skills described in Estonian, for example — an English prompt was titled in that language about half the time. The title now follows the language of your prompt.
- **Menus are readable in the dark theme (Sprint 124).** Drop-down and right-click menus — the AI sidebar's menus and the table of contents' right-click menu among them — kept a white background in the dark theme, with near-white text on it. They now take the theme's background.
- **An Office file that misstates its size is refused before it is previewed (Sprint 125).** The check Ritemark runs before previewing a Word file trusted the sizes the file declared for its parts. A file declaring a few kilobytes for a part that unpacks to hundreds of megabytes passed it, and the preview then used about 650 MB of memory before showing a technical error. Every part is now unpacked in the extension first, capped at its declared size, and such a file gets the plain "looks damaged" message — for Word documents and presentations alike.
- **Ritemark no longer freezes while it checks Claude and Codex at launch (#366, #367).** The checks for Claude Code's version, sign-in and keychain entry, and for Codex's version and compatibility, ran one after another on the thread that also runs the AI sidebar, editors and commands. Every launch paused for about half a second, and with a Codex installed through npm for about three seconds. They now run in the background and decide exactly as before, and so do the Welcome page's Node and Git checks. A check that hangs, or writes without end, is stopped rather than left running.
- **No npm, Node.js or Git advice for the bundled agents (#359).** The Claude Code and Codex that come with Ritemark need neither Node.js nor Git. The setup notice, the first-run checklist and Install/Repair Claude no longer ask for them; those checks apply only on Windows when **Runtime preference** is **Use system install**. Only a missing PowerShell still blocks installing Claude.
- **The Welcome page no longer says "Ritemark needs Node." (#363).** Its launch check shows a Node line only when a runtime actually needs Node.js: on Windows, with **Use system install**.
- **The browser chip shows only a page the AI actually gets (#358).** The composer showed **Browser: <page>** for the active browser tab even when you hadn't shared it — after **Deny**, or while "Share with Agent?" was still open — and the AI information dialog listed it as shared. Nothing was sent, but the chip said otherwise. The chip and the dialog now appear only for a shared tab, and a message sends exactly what the chip shows. On Windows, a shared page is sent with your message again.
- **OpenCode is told about its browser tools (#357).** On macOS OpenCode has had Ritemark's browser tools, but the instructions it gets at the start of a conversation didn't mention them, as they do for Claude Code and Codex. Now they do.
- **The × on a composer chip says what it does (#355).** Each chip's × — active file, browser page, an added file, a pinned agent — shows "Remove from this message" and has a label for screen readers.
- **Report AI issue opens a report before an agent is set up (#317).** During onboarding or agent setup, **Report AI issue** in the status bar opened the sidebar but no report window.
- **A pinned comment's own buttons work (#318).** Clicking Edit, Delete, Mark as done or Send in a pinned comment also unpinned it, and the click was lost.
- **No stray "0" in the update box (#360).** Settings → Updates showed a "0" beside **Pause 7 Days** whenever an update was available.
- **No "Invalid font weight" error at every launch (#364).** The product icon theme's font weight was one VS Code rejects, so every launch logged an error. The icons look the same.

## [1.11.0] — 2026-09-18

### Added
- **Report inappropriate AI output (Sprint 126).** A **Report AI issue** item sits in the status bar beside the AI indicator, on screen whether or not the AI sidebar is open, and the AI Information dialog has the same entry. Both open one window: you paste or describe the output, edit it however you like, and see exactly what will be included — nothing from your conversation, documents, or account. It opens your email app addressed to info@productory.eu, and if no email app is set up it shows the address with the report ready to copy. Ritemark never tells you the report was sent, because it cannot see that happen.
- - **The agent's answer comes back to the comment (Sprint 117).** A finished comment task shows a short plain-language summary under your own note, with **Open conversation** for the full thread. Your note, the highlighted passage, and the Markdown file are never rewritten, and nothing is resolved or deleted for you.
- **A comment says where its work is going, and what it is doing (Sprint 117).** The line above **Send** names the conversation that will receive the task; afterwards the comment shows that conversation's title and its own state — queued, working, needs your input, completed, failed, cancelled, or interrupted. Each state is a symbol plus a sentence, not a colour, and it survives reload, reopen, and restart.
- **A comment box that resizes, and an `@` picker (Sprint 117).** Drag a comment taller — Cancel, Save, and Send stay reachable. Typing `@` opens the agent list immediately: keep typing to filter, arrow keys to move, Enter or Tab to insert, Escape to close, or click.
- **Current agent and model baseline (Sprint 116).** Ritemark now bundles Claude Code 2.1.270, Codex 0.154.0, and OpenCode 1.18.30 with exact matching SDKs and runtime-owned dependencies. The model catalog adds GPT-6 Astra, the current GPT-5.6 family, Claude Fable 5.1, Gemini 3.1 Pro, Gemini 3.8 Flash, and Gemini 3.5 Flash Lite.

### Changed
- **Ritemark no longer offers to download Git or Node (Sprint 126).** Source Control and the welcome page still tell you what is missing; they no longer link out to fetch it.
- **Dialogs use the full width of a narrow sidebar (Sprint 126).** A dialog opened in the AI sidebar now fills it edge to edge instead of clipping its own text inside a centred card, and no longer sits underneath the conversation rail.
- - **A comment task goes to the conversation you have open (Sprint 117).** A brand-new empty one counts, and if it is busy the task waits in its queue. Ritemark used to choose a conversation for you without saying which; now there is one rule, and the Send surface names the destination before you press it. There is still no confirmation step to click through.
- **Sending several comments at once answers per agent (Sprint 117).** The Comments menu reports each agent group as its answer arrives — "Claude · 2 queued", "Codex · Sign in required" with a **Sign in** button — instead of one blanket success.
- **A collapsed comment no longer covers the text it annotates (Sprint 117).** The margin marker drops its preview and shrinks as the window narrows, and at narrow widths an opened comment sits below its marker instead of over the line.
- **Image Flows start with supported current models.** New OpenAI image nodes default to GPT Image 2 and new Gemini image nodes default to Gemini 3.1 Flash Image. Older saved model IDs remain identifiable as deprecated and are not silently rewritten.
- **Runtime packages are complete and reproducible.** Codex ships its official package tree with code-mode-host, ripgrep, shell resources, and Windows sandbox helpers. OpenCode ships its own ripgrep, avoiding a first-use download.

### Fixed
- **A comment no longer says "Sent" before anything was sent (Sprint 117).** The margin flash and the "Queued N tasks" banner appeared the instant you clicked, whatever happened next. A comment now reports queued only once the work is really accepted — and when it is not, it says why: signed-out agent, full queue, unsaved document, each with the matching **Sign in**, **Open settings**, or **Retry** action.
- **One agent finishing no longer marks unrelated comments as done (Sprint 117).** Two comments sent to the same conversation now each follow their own task.
- **A stopped run is reported as cancelled (Sprint 117)** — not as completed, and not as a failure, in any of the three agents.
- **A queued comment keeps working on the document you assigned it (Sprint 117).** Switching tabs, closing the document, or opening another project before the task runs can no longer point the agent at a different file.
- **A comment task survives a restart honestly (Sprint 117).** Work cut short when Ritemark closed comes back marked interrupted with **Retry**, instead of sitting there looking busy forever, and comment status is no longer lost on reload.
- **Standalone `///` notes keep a stable identity (Sprint 117),** so a task still finds its note after you keep editing around it. Opening an existing document does not change or dirty the file; an identity is added the first time you send that comment, in one step a single Undo reverses.
- **Hovering the highlighted text opens its comment (Sprint 117).** You no longer have to find the marker in the margin to read a note about the sentence you are looking at. Any part of a comment that spans several paragraphs opens the same note.
- **A finished comment offers Mark as done instead of a trash can (Sprint 117).** The action is the same one it always was, clearing your own comment from the document; only once the agent has actually completed the task does it say what you mean by it.
- Codex Stop now handles the brief race where `turn/start` returns before the turn becomes interruptible, and a new message can be sent immediately after cancellation.
- Successful OpenCode turns no longer show a red **Failed** marker after already editing the document and returning an answer; ACP's successful `end_turn` now maps to Ritemark's completed state.
- Late Codex events carrying an explicit unknown thread ID no longer fall into another open conversation.
- Current Codex cache effort metadata is parsed correctly, and an older remote/cached catalog can no longer hide a newer bundled model floor.

## [1.10.1] — 2026-09-10

Maintenance release for all platforms: macOS (Apple Silicon and Intel) and Windows.

### Fixed
- **The Codex setup pane no longer loops.** With no Claude account signed in, choosing Use Codex brought up a setup pane that unmounted and remounted on a roughly two-second cycle, making the button hard to click. Codex sign-in polling ran every 2000 ms while the pane was open and each status push briefly re-derived runtime availability as `checking`, which withdrew the pane. Affected macOS and Windows equally
- **Codex file and exec tools work again on Windows.** In the default and recommended `workspace-write` sandbox mode, every Codex turn that read or wrote a file failed with `orchestrator_helper_launch_failed: ... program not found`. Codex's Windows sandbox path spawns two helper binaries — `codex-windows-sandbox-setup` and `codex-command-runner` — that the vendor publishes as separate artifacts and that the installer was not shipping. Chat worked throughout, so the runtime looked healthy until a file was touched. Setting the sandbox to full access appeared to fix it only because that path bypasses the sandbox and never spawns a helper

- **Typing is no longer overwritten a moment later.** After every accepted edit the app sent the document back to the editor, and because the saved form ends in a newline while the editor's own form does not, the editor mistook its own edit for an external change and re-applied it: a periodic "clean-up" while typing, Enter inside a list sometimes swallowed, freshly created checklist items turning into a bullet with literal `[ ]`. Documents with front matter had this since 1.10.0; the trailing-newline fix above extended it to every document. Both sides now compare the same canonical form
- **One Cmd+Z is one undo again.** The editor's own history and VS Code's document undo both answered the same keystroke and fought over the result: the first Cmd+Z appeared to do nothing, the second undid something else, redo duplicated list items. While a Ritemark document is active, undo and redo now stay with the editor. Choosing Undo from the Edit menu still goes through VS Code's document undo
- **Checklist items render on one line.** The checkbox no longer sits above its text: the whitespace left behind when the Markdown checkbox marker is removed was rendered as a line break
- **An empty checklist item survives a save.** `- [ ]` with nothing after it is read back as an empty task item instead of a bullet whose text is `[ ]`
- **Saving a document that ends in a list no longer drops the trailing newline** ([#254](https://github.com/ProductoryHQ/ritemark-native/issues/254)). Landed after 1.10.0 was cut, so it reaches Windows first and macOS in the next release that builds for it
- **Home lists the documents actually opened recently** ([#194](https://github.com/ProductoryHQ/ritemark-native/issues/194)). Same timing: Windows first, macOS next

### Changed
- The binary manifest now supports **platform-scoped components**, so a component can legitimately exist for a subset of targets instead of all three. The two Codex sandbox helpers are win32-x64 only: the vendor ships no darwin build, because on macOS the sandbox is the OS seatbelt rather than a spawned process
- Components that are IPC endpoints rather than CLIs are checked for **presence** instead of being smoke-tested. `codex-command-runner` expects a pipe handle and `codex-windows-sandbox-setup` expects a base64 payload, so both exit non-zero on `--version` and `--help`; the validator now rejects `validationArgs` on them rather than requiring it

---

## [1.10.0] — 2026-09-05

Durable Agent Conversations + Reliable Editing. Sprints 109-115.

### Added
- **Transcribe Insights in any language** — search common languages or enter any language or dialect; Auto follows a recognized transcript language and otherwise falls back to English, while quotes and speaker attribution remain verbatim.
- **Faster focused Insights generation** — transcript extraction no longer inherits coding-agent tools, project instructions, or an extra-high reasoning budget.
- **Separate Insights documents** — name and create a new Insights-only Markdown snapshot with provenance and timestamps; existing files and the primary transcript are never overwritten or relinked.
- **Durable Agent Conversations** — project-safe, crash-safe host storage with first-prompt-before-dispatch ordering, typed host/webview protocol, legacy migration, corrupt-record isolation, confirmed Delete and Undo.
- **Conversations UI** — a permanent 56px rail with calm shared chat-bubble icons, optional Pin/Unpin, automatic working/needs-you/recent shortcuts, and one host-backed Conversations list that stays open beside the rail. Selecting a conversation changes only Current state and does not reorder Recents.
- **Conversation titles that become useful automatically** — the first prompt appears immediately as a shortened title, the selected runtime replaces it with a 3–6-word title after the first response, and Rename in Conversations lets the user take permanent control.
- **Truthful conversation continuation** — reopened Claude, Codex, and OpenCode conversations now attempt an exact-compatible native session resume on the next Send, then use a bounded canonical transcript fallback when native context is unavailable.
- **Calm agent handoff** — choosing another runtime applies immediately and preserves the composer draft. On the next Send, one quiet line between turns explains transcript fallback; unanswered user intent crosses as labelled context without transferring tool state, approvals, partial output, attachments, or another provider's private session ID.
- **Crash-safe dispatch tracking** — accepted prompts are durably marked before transport and only treated as provider-accepted after runtime-specific evidence; ambiguous/no-final failures abandon unsafe native bindings so a retry cannot silently duplicate context.
- **Stable conversation colors** — each project uses all eight base rainbow colors before deeper and softer variants; the same translucent-fill chat bubble follows a conversation across the rail, All conversations, restart, Rename, and Delete + Undo.
- **Refreshed built-in agents** — Codex 0.153.0, Claude Code 2.1.239, and OpenCode 1.18.21 ship with exact matching SDK edges (Claude Agent SDK 0.3.239 and ACP SDK 1.4.0). A new hard gate rejects required-component/checksum/platform gaps, stale vendor metadata, or Claude binary/SDK drift before packaging.
- **Thinking effort in the Composer** — supported Claude and Codex models expose a compact Auto/Faster→More thorough control beside the message field; OpenCode participates only when its live ACP session advertises compatible thought levels. The selection is model-filtered, durable per conversation/runtime, and snapshotted for every accepted or queued turn.
- **Trusted Windows installer (pending Windows certification)** — every executable payload is checked and signed, Inno signs its setup and uninstaller components, and standard-user install/uninstall is tested before upload. Microsoft Store becomes the recommended channel after Partner Center and Smart App Control-On testing pass.

### Changed
- Production parsing dependencies are hardened for the release candidate: `fast-uri` and `@xmldom/xmldom` use fixed versions, while TipTap 2 carries the upstream-recommended `__proto__` rejection as a deterministic install-time patch with an exploit-shaped regression test. The full TipTap 3 migration is tracked separately in #243.
- A fresh development setup now links VS Code to the worktree's single canonical extension source and refuses to overwrite an unexpected physical extension directory. The setup path can no longer create the stale-copy state that its own QA gate rejects.
- Transcribe speaker rename now accepts real full names and Unicode spacing without playback shortcuts intercepting editing. Long speaker labels stay bounded and expose their complete accessible name.
- Agent transcripts are no longer owned by webview localStorage. Webview state retains only the selected canonical conversation, up to five Pin IDs, and harmless UI preferences.
- Reopened Sprint 109 transcripts explicitly disclose that the next message starts with a new agent working context; native provider continuation remains Sprint 110 scope.
- Live agent contexts are bounded in the host (five with parallel work, one otherwise). Ritemark releases only the least-recently-used non-current idle context; Working, Needs-you, and Current conversations are protected, while saved conversations remain unlimited.
- Runtime fetch and verification now use the same exact manifest contract in local development, QA, and release packaging; Codex optional input metadata and OpenCode ACP 1.x capability discovery remain contained inside their runtime adapters.

### Fixed
- **One signed-out AI provider no longer blocks the others.** Claude, Codex, and OpenCode now have one canonical availability state instead of treating a finished status check as proof that the account is usable. If the selected provider needs sign-in or repair while another is ready, Ritemark preserves the transcript, Composer, and model selector and offers an explicit **Use Codex / Use Claude / Use OpenCode** action beside the affected account action. Existing conversations never switch providers silently; runtime+model selection is atomic, selecting a known-ready fallback cannot launch a blocking readiness probe, and logout releases only the affected provider's sessions.
- **Task lists remain task lists after reopening a document.** Checked and unchecked GFM items now survive load, edit, save, close, and reopen even when valid Markdown uses blank lines between items. Nested task lists and mixed task/bullet runs keep their structure instead of silently degrading to ordinary bullets and losing `[x]` / `[ ]` markers on the next save. Opening a task list no longer creates a false unsaved change merely because the source bytes and TipTap's canonical Markdown formatting differ.
- **Help shows Ritemark help, not VS Code internals.** The desktop Help menu is now governed by one Ritemark-only allowlist shared by native and custom menubars: Support, View License, and Advanced → Toggle Developer Tools (plus About Ritemark where the platform normally shows About). Editor Playground, Ask @vscode, Process Explorer, walkthroughs, and future unreviewed upstream entries stay out of the product menu while their commands remain available from the Command Menu.
- **Agent Chat now opens with a real model selection in every window.** The selected model and non-empty local catalogs arrive through one atomic bootstrap before the composer can render; Claude, Codex, OpenCode, keychain, onboarding, workspace discovery, and conversation persistence hydrate independently and can no longer strand the footer at `Model` or abort startup. Stale aliases reconcile to one canonical row, late results from an old window are discarded, and a full/corrupt legacy conversation store degrades History only: workspace context no longer copies the archive inside bootstrap, host modes inventory it read-only, and original records remain intact. Agent Chat uses the same cache-versioned webview bundle policy as the editor.
- **Claude authentication failures now explain the problem and offer the right recovery in place.** Instead of showing a raw provider error, OAuth chat turns provide **Sign in to Claude** and API-key turns provide **Update API key** through AI Settings. Ritemark recognizes Claude's structured API-error event even when the SDK incorrectly closes it in a `success` envelope, so the turn can never show **Done** or store the diagnostic as Claude's answer; exact OAuth errors already written by affected release candidates are repaired when read. The OAuth card visibly waits for the browser, confirms a successful sign-in, and closes when the user acknowledges it with **OK**; a cancel or timeout stays actionable as **Try again**. Both the browser callback and Ritemark's background auth refresh complete the same card. The recovery survives reloads and conversation navigation; Ritemark also releases stale Claude sessions and avoids starting a model probe while auth is unavailable. The inline recovery uses Ritemark's card surface, radius, and standard actions without repeating the same failure below the card.
- **Codex file tools are included in every release package.** Codex 0.153.0's version-matched `code-mode-host` sidecar now ships beside the app-server on Apple Silicon, Intel macOS, and Windows; packaging fails if either component is absent. The refreshed runtime accepts the current GPT-5.6 model catalog instead of failing with a stale-client error.
- **Claude models no longer appear twice or report a false mismatch.** Runtime aliases such as `default` and `opus[1m]` now resolve to one canonical picker row; the provider default is marked with a restrained `*`, and diagnostics compare the actual resolved model instead of comparing it with an alias.
- **Compact AI sidebars prioritize the selected model.** At narrow widths the closed permission control keeps only its mode icon and thinking effort becomes a level-aware icon, leaving the model name the available footer space; full labels remain available in opened controls, tooltips, and wider layouts.
- **Conversation rail controls keep a compact rhythm.** New conversation, open conversation, and history buttons now use a consistent 4 px vertical gap; the pinned divider keeps the same 4 px clearance on each side.
- **Conversation deletion now fits and follows Ritemark's native notification system.** The confirmation dialog stays inside the narrow Conversations pane with wrapped copy and actions that stack at the smallest widths. After deletion, the custom in-panel Undo snackbar no longer stays pinned over the list; standard VS Code notifications own every displayed Undo action even after the Conversations panel closes.
- **Agent and external edits appear in the open document without a reopen.** Markdown and CSV now use one per-file revision coordinator, and the host advances visible state only after the matching editor view acknowledges the exact payload it applied.
- **The file-changed action now means a real unresolved problem.** Ordinary local typing/autosave lag stays quiet; a true local-versus-disk conflict preserves both versions and exposes explicit Compare, Keep my version, and Use disk version choices.
- **Fast save-and-continue no longer becomes a false disk conflict.** The coordinator matches a later disk snapshot to the exact content snapshot VS Code successfully wrote, so a user's own delayed save can advance the common base while newer visible typing remains local-only. An external write that lands immediately after Save is never inferred to be local from a racy path reread.
- **A blank document accepts `# ` as its first H1.** The editor no longer mistakes TipTap's structurally empty heading for an uninitialized document or replaces it with a paragraph before the title is typed.
- **No timer can replace unresolved local work.** The former ten-second forced reload, bounded self-hash heuristic, and competing webview booleans are removed; multi-view delivery is epoch-scoped, retry-bounded, and stale-message safe.

## [1.9.0] — 2026-08-20

Sprint 108 — Transcribe.

### Added
- **Transcribe: turn a recording into a document, without leaving Ritemark.** A new Activity Bar app takes an audio file (`.m4a`, `.mp3`, `.wav`, `.flac`, `.ogg`, `.aac`) and produces a speaker-attributed transcript you can read, correct, play back and save. It replaces the upload-to-cloud, transcribe-elsewhere, re-format-by-hand round trip
- **Two engines, and the trade is stated at the point of choice.** *On-device (Whisper)* keeps the audio on your machine and costs nothing, but cannot tell speakers apart — whisper.cpp has no real diarization. *ElevenLabs Scribe* separates speakers (up to 32) but uploads the file; before it does, the panel shows the duration and the estimated cost. Nothing runs until you pick
- **Transcript Workbench** — a dedicated editor for a recording: waveform player, speaker-separated transcript, **click any line to hear it**. That is the point: a quote can be checked against the audio in two seconds before it goes to a client
- **Speaker chips with one-click global rename.** Rename `Speaker 2` once and all its segments follow, in the workbench and in the saved document
- **Uncertainty is marked.** Words the engine was unsure about are highlighted, on **both** engines — tuned against real output so it flags names and jargon rather than every "and"
- **Insights rail** — summary, decisions, action items, open questions and key quotes, generated on the agent runtime you already use. Every item carries a timestamp that plays the moment it came from; anything the model cannot cite to a real line is discarded rather than shown
- **Save to document** — choose the folder, get Markdown with front matter, speaker headings and timestamps, opened in Ritemark's editor. The saved document stays linked in the workbench header, and the AI sidebar treats it as the active file, so "ask Claude about this recording" works
- **Windows is supported** with ElevenLabs. The on-device engine says plainly that it is not available on Windows yet ([#133](https://github.com/ProductoryHQ/ritemark-native/issues/133)) instead of the feature quietly disappearing
- Jobs survive closing the panel, show progress on the Activity Bar icon, can be cancelled, and are reported honestly as **Interrupted** if the app closes mid-transcription
- **The library is project-scoped, and says so.** Recordings belong to the folder that was open when they were transcribed. A project with none reports how many are filed elsewhere and offers **Show all projects**, each row labelled with where it was made — an empty list never means a lost transcript
- On-device transcription requires **Apple silicon**; on an Intel Mac the engine card says so and ElevenLabs is the route ([#203](https://github.com/ProductoryHQ/ritemark-native/issues/203))

---

## [1.8.6] — 2026-08-09

Sprint 102 — AI Transparency (#163); Sprint 103 — Truthful Agent Plans (#132, #161); Sprint 104 — Reliable Multi-Prompt Queue (#162); Sprint 105 — Comments Command Center (#164, #165); Sprint 106 — Home Launcher (#74); Sprint 107 — Clean Start (first-open fix, daemon consent, tab healer; R4 welcome-card removal shipped early), plus the connectivity fix below.

### Fixed (post-candidate)
- **The offline banner no longer flickers on a healthy connection (#193).** Connectivity was decided by a single `HEAD` to `api.openai.com` with a 5 s timeout, re-rolled every 30 s — one slow or dropped probe flipped the UI to "Offline". Measured on 2026-08-08: ~10% of probes to OpenAI's edge failed on a working connection, so the banner reappeared every few minutes. Each round now races three independent endpoints (Anthropic, OpenAI, Apple captive portal — any HTTP response counts as online) with an 8 s timeout, and the offline verdict requires **two consecutive** failed rounds with a 5 s confirm round after the first; one success recovers instantly. Decision logic is a pure, unit-tested module (`src/ai/connectivityPolicy.ts`)

### Changed
- **Mode control is ONE dropdown: Manual / Auto / Plan only.** The separate Plan chip is gone — "Plan only" lives in the same select, still auto-resets to the underlying autonomy when a plan is approved
- **One status line while the agent works.** The old per-turn spinner box (raw tool + full path) duplicated Sprint 103's human-readable ActivityStatusLine — removed; the running-subagent badge moved into the status line
- **Folder tree, writer-grade.** Expand chevrons removed (folders toggle on row click; left padding restored, deeper default indent), the selected file reads indigo — icon and label — even when focus is in the editor, and the highlight now follows the ACTIVE tab: switching to a tab whose file isn't in the tree clears it. Outline and Timeline sections removed from the Folder view. Preview tabs are off by default — every open is a real tab
- **Home view renders in Sofia Sans** (brand font) — it was falling back to the system font; the "New document" button vertical rhythm equalized. The composer no longer shows a redundant "N context" counter
- **One word: Folder.** The sidebar view is now "Folder" (was "Project"), matching the File menu and every empty state — the third competing term, "Workspace", no longer appears anywhere in the UI
- **The File menu speaks Ritemark.** "New Document" (⌘N) and "New Table" replace "New Text File"/"New File…"; the workspace machinery (Open Workspace from File, Add Folder to Workspace, Save Workspace As, Duplicate Workspace), "New Window with Profile", "Share", and "Revert File" are hidden from the menu (every command stays reachable via the command palette). The Selection menu (multi-cursor tooling) is hidden entirely. ⌘N now creates a Ritemark markdown document instead of a plain-text untitled file

### Fixed
- **Clean first open (Sprint 107 R1).** Opening a `.md` from Finder on a fresh profile now lands directly in the Ritemark editor with workspace trust OFF — no "do you trust the authors" modal, no plain-text flash, no Restricted Mode. Root cause: VS Code only reads product-level configuration defaults on the WEB workbench; patch 013 wires Ritemark's block into the desktop bootstrap (this also activates the deeper tree indent and preview-tabs-off defaults)
- **Already-stuck markdown tabs self-heal (Sprint 107 R3).** Profiles bitten by the old bug (a `.md` pinned open in the plain-text editor) get a one-shot healer on activation that reopens those tabs in Ritemark's editor. Named tradeoff: a deliberate per-tab "Reopen With → Text Editor" choice is lost once
- **Chat file links: root-level paths with line suffixes** ("README.md:12") now open instead of being mistaken for URL schemes; comment task prompts keep informational cross-agent mentions ("@claude compare with @codex notes"); flow/daemon one-shot runs now genuinely pin their model (the pin was silently not reaching the SDK); the editor's originally-loaded content is fingerprinted as self-known so long typing sessions with pending autosave can never trigger the foreign-change banner (all four from Codex PR review)

### Added
- **Scheduled agents ask before they run (Sprint 107 R2).** A workspace that defines scheduled agents gets a one-time, non-blocking prompt ("Allow" / "Not now") before anything is armed — schedule-triggered runs fire without a user gesture, so they need explicit per-workspace consent. Reversible any time from the Agent Library's Scheduled section (Allow/Pause). Workspaces already running scheduled agents before this shipped are grandfathered in
- **Comments toolbar counts mid-sentence assignments.** Writing `@claude` in the middle of a comment assigned it on the margin rail but the toolbar overview still said "0 assigned" — the overview used a stricter prefix-only parse. Both now share the rail's rule: the first `@agent` mention anywhere in the body assigns, and the mention is stripped from the dispatched task prompt
- **The model you pick is the model that runs.** Claude sessions could silently run a different model than the UI showed (Jarmo caught Fable 5 selected, `claude-opus-4-8` actually running): the webview never sent the model on Claude turns, and a modeless session let the bundled CLI fall back to the user's personal `~/.claude.json`. Now every path pins the model explicitly — chat turns, queued prompts, comment tasks, flows, and daemon runs — and if the runtime still resolves a different model than requested, the conversation shows a visible "Model mismatch" line instead of hiding it
- **Your own edits never trigger the file-changed banner.** The editor keeps fingerprints of content it wrote itself — an autosave landing mid-typing no longer reads as an "external change"; only genuinely foreign writes (agents, CLIs, other apps) can surface the refresh banner. The "Refreshed <file>" snackbar is gone — the updated content is the feedback
- **Folder tree geometry.** Level-1 rows align with the pane title; depth indentation preserved after chevron removal (the twistie box carries the tree's indent — collapsed to width 0 instead of display:none)
- **Agent file updates now always reach the editor.** External-change detection was edge-triggered and could wedge: if one push to the editor view was suppressed (echo-guard race with autosave), the editor stayed stale forever while everything looked "in sync". The three detection paths (TextDocument events, file watcher, 3s poll) now converge on ONE level-triggered reconcile that compares disk content against a hash of what the editor view actually last received — any divergence self-heals within a poll tick. Unsaved local edits still get the refresh banner + 10s auto-reload, never a silent overwrite
- **Home is the same launcher with or without a folder.** The no-folder Home now shows the full launcher — New document (works folderless via drafts), Open document, New table, Open folder, and your recent folders (one-click re-entry) — instead of a bare "open a folder" dead end. Only "New AI task" stays folder-gated (agent runs require a workspace)
- **Chat file links now open in Ritemark.** A chat reply linking to a workspace file ("[Koondfailis](koondfail.md)") opens that file in Ritemark's own editor on click — previously the click died silently (the webview's `open-source` message had no host handler). Web links route through the browser as before; paths are confined to the workspace folder (realpath-checked), and inline-code paths like `docs/plan.md:12` work too
- **Project view speaks Ritemark, not VS Code.** The no-folder empty state now says "Open a folder to start writing — your documents live in a folder Ritemark can see" with a single Open Folder action (patch 002); the git extension's "Clone Repository" block and the "how to use Git and source control in VS Code read our docs" link no longer appear there (patch 003)
- **Finder showed "Ritemark.app (1.117.0)".** The macOS bundle's `CFBundleShortVersionString` was left at the upstream VS Code version by the build; `build-prod.sh` now stamps `Info.plist` with the Ritemark version. Both v1.8.6 macOS builds ship stamped — note that the Apple Silicon stamp comes from `build-prod.sh` while the Intel build is produced by CI, which has no stamp step: the v1.8.6 Intel bundle was stamped manually at release time and the CI gap is tracked in #200

### Removed
- **"Claude is ready — Get Started" welcome card (Sprint 107 R4).** A ready Claude sidebar with no conversation now opens straight into the chat composer — the interstitial card and its extra click are gone. Its bookkeeping (`hasSeenClaudeWelcome`) still records automatically, and the real setup states (install, repair, sign-in, Codex/OpenCode setup, first-run onboarding) are unchanged

### Added
- **Home launcher (Sprint 106, #74).** A persistent Home view in the Activity Bar: one dominant **New document — Markdown (.md)** action plus New AI task, Open document, New table, and Open folder quick actions (all existing commands), and the workspace's recently modified documents. Flag-gated (`home-launcher`, default on) as a rollout kill-switch; pinned FIRST in the Activity Bar via patch 002 (shell-tier, Jarmo-ordered 2026-08-04)
- **Comments Command Center (Sprint 105, #164).** The editor toolbar shows a Comments button with the document's true unique-comment count (multi-block comments count once via the shared ID-deduplicated index); its overview breaks the workload into assigned/unassigned and per-agent groups, and **Send assigned comments to AI** dispatches one ordered task per agent — through the Sprint 104 queue, with a confirmation that shows task counts and lets you exclude agent groups. Source comments are never modified by dispatch
- **Honest comment-task status (Sprint 105, #165).** Margin markers show the live state of dispatched comment tasks — queued, running, done, or failed — correlated by stable comment id from the sidebar's queue and turn facts; removing a queued item returns the marker to neutral
- **Bounded multi-prompt queue (Sprint 104, #162).** Each chat now holds up to 10 ordered follow-ups instead of one invisible slot: a visible "Queued · n/10" panel with per-item edit, remove, reorder, and retry; the composer never locks while items wait. Draining is gated on Sprint 103's activity states — a pending plan review, question, or approval pauses the queue, and a failed/stopped turn requires an explicit Resume
- **Comment tasks share the queue.** A comment assigned to an agent routes to a stable conversation for that runtime (reusing an idle matching thread or creating a background one) through the same queue — the old path that retargeted the visible thread's runtime and silently dropped prompts on a busy runtime is gone
- **Background threads drain.** Queue dispatch moved from a render effect on the visible composer into the store, so a background thread's queued items send when its turn finishes
- **Enforced plan mode for Claude (Sprint 103, #132).** The Plan control now runs Claude in the SDK's native plan mode: the planning phase is technically read-only, the plan review card appears reliably on the first attempt (previously it depended on the model accidentally recovering from a harness error), and approval continues execution in the same conversation under the chosen autonomy mode
- **Two-axis mode control (Sprint 103, #132).** The three-button `Auto / Ask / Plan` strip is replaced by an autonomy select (**Manual** / **Auto**) plus a **Plan** chip that stays on until a plan is approved. The chip renders only for runtimes with an enforceable plan contract (Claude, Codex) — OpenCode shows no Plan control by design
- **Plan review card v2 (Sprint 103).** Provenance line ("Requested by you · Plan" / "Claude chose to plan first"), rendered-markdown plan body, verified "No files changed yet." claim, and **Approve & continue / Keep planning** (with feedback) actions for both Claude and Codex
- **Truthful activity status (Sprint 103, #161).** One status line per conversation derives running / waiting-for-you (plan review, question, approval) / done / failed / stopped from a single source shared with the thread rail; "Done" can no longer appear while a card is pending
- **Per-runtime capability registry.** `src/runtime/capabilities.ts` is the single source for which mode controls each runtime may render

### Changed
- **Claude sessions no longer use `bypassPermissions`** (Sprint 103). Auto maps to `acceptEdits` + auto-allow, Manual to `default`; the dangerous skip-permissions flag is gone from every Ritemark session (its mere availability disabled native plan enforcement)
- **Mode switches keep conversation memory.** Autonomy changes use the SDK's live `setPermissionMode` instead of rebuilding the session; a genuine rebuild (model change) is announced in the transcript instead of happening silently
- **Codex plan turns run in a read-only sandbox**, so "No files changed yet" is enforced rather than narrated; approval flips the thread back to the configured write sandbox
- **Prompt text no longer flips modes.** The hidden "plan mode" phrase detection is removed for both Claude and Codex — only the visible Plan chip selects plan-first, and model-initiated planning is surfaced with an attribution chip instead of happening silently
- **Turn metrics tell the truth.** Headline duration is agent working time (waiting-for-you time reported separately); "Modified N files" counts only workspace files, excluding runtime-internal writes such as `~/.claude/plans/*`

### Technical (Sprint 103)
- New `runtime/capabilities.ts`, `ai-sidebar/activityState.ts` (+ tests), `ActivityStatusLine.tsx`; `PendingRuntimeSelection` gains `planFirst` with lossless migration of stored `mode: 'plan'` threads
- Plan-truth evidence base (audit, traces, screenshots, SDK spike) under `docs/development/releases/v1.8.6/sprint-103-agent-truth/research/`; regression harness at `scripts/qa/plan-truth-matrix.sh`
- **First-interaction AI disclosure (Sprint 102, #163).** The AI composer now states that the user is interacting with AI before the first turn, names the active runtime/provider/model, remains non-blocking, and uses an explicit **Don’t show again** action for its one-time acknowledgement
- **Persistent AI information view.** An always-available composer button and a link at the end of Ritemark Settings explain which context categories may leave the device, distinguish provider processing from Ritemark analytics, link provider/policy information, and require human review of AI output
- **Runtime/provider mapping tests.** Automated coverage locks Claude Code → Anthropic, Codex → OpenAI, and OpenCode → the selected BYOK service/model, plus first-use persistence and context-state mapping

### Changed
- **Truthful context controls across runtimes.** Active-file removal now reaches Codex and OpenCode as well as Claude; browser context is no longer shown for OpenCode because the host injects it only for Claude/Codex
- **Runtime switches keep the disclosure identity coherent.** Pending model state is accepted only when it belongs to the selected runtime, preventing a freshly selected Codex session from briefly showing a stale Claude model in the information view
- **OpenCode attachments cross the composer boundary.** Attachment payloads are now forwarded to the ACP runtime and retained in turn metadata instead of being silently dropped
- **AI/privacy documentation.** User docs no longer make the absolute claim that AI content always remains local and now document default-on anonymous PostHog analytics separately from AI-provider processing

### Technical
- New `ai-sidebar/aiDisclosure.ts`, `AIInformation.tsx`, and `aiDisclosure.test.ts`; runtime-switching regression coverage extended for OpenCode attachment and active-file behavior
- Product evidence matrix and counsel decision memo live under `docs/development/releases/v1.8.6/sprint-102-ai-transparency/`
- Public EN/ET AI-information pages are live after `ritemark-web` PR #77; counsel-approved Productory Terms/Privacy corrections are live after `productory-2026` PR #20

---

## [Unreleased] — v1.8.3

> **Draft entry for v1.8.3.** Sprint 94 — Comment Callouts (#81). Bugfix sprint (#142/#103/#135) to follow.

### Added
- **Comments in the editor (Sprint 94, #81).** Leave editor-only notes on your document — never shown in exports. Select text and click **Comment** to anchor a soft-yellow highlight with a note in the right margin, or type `/// your note` on a line and press Enter for a standalone margin note. Multi-line notes are supported. Hover a margin marker to read, **edit** (pencil), or delete it
- **Assign a comment to an AI agent (Sprint 94, #81).** Write `@claude`, `@codex`, or `@opencode` anywhere in a comment — it shows an inline mention chip and a **Send to AI** button that hands the note (plus the anchored text) straight to the AI sidebar, routed to that agent
- Comments store as portable `<!-- -->` / `<mark data-comment>` in the `.md` file, round-trip losslessly through load/edit/save/copy, and are stripped from PDF and Word exports. Behind the `comment-callouts` flag (on by default)

### Fixed
- **Rebuilt webview bundles now actually load (Sprint 94).** The editor's `webview.js` had no cache-buster, so a window reload could serve a stale cached bundle. Now versioned with `?v=<mtime>`, matching image resources

### Technical
- New `webview/src/extensions/comment/` (marked tokenizer, Turndown rules, TipTap `CommentMark` + atom `CommentNode`, model helpers + `commentRoundTrip.test.ts` wired into `npm test`), `components/MarginCommentRail.tsx`; export strip in `export/v2/htmlPipeline.ts`; Send-to-AI relay across `ritemarkEditor.ts` ↔ `UnifiedViewProvider` ↔ sidebar store (`comment:send-to-ai` / `comment:submit`); `comment-callouts` experimental flag
- Two independent adversarial code audits; all high/medium findings fixed and verified. Soft-yellow is a documented functional exception to the indigo-only palette (`ritemark-design/references/components.md`)
- VS Code base: 1.117 (unchanged)
- Sprint 94 (comment callouts) — closes #81

---

## [Unreleased] — v1.7.3

> **Draft entry for v1.7.3.** Sprint 74 — AI Sidebar & Composer Polish + Sprint 76 — OpenCode BYOK runtime. Ships after v1.7.2.

### Added
- **OpenCode — a third AI runtime that uses your own provider keys (Sprint 76, #52).** Open-source ACP agent bundled with Ritemark; pick it in the model dropdown and run Gemini, GPT, Claude, or OpenRouter models with the API keys you already have in Settings. The picker groups providers (only those with a configured key); file edits are approval-gated with a single "File Change Approval" card per edit (workspace-bounded — writes outside the project are blocked); optional "Auto-approve edits & tool calls" toggle in Settings. Behind the `opencode-integration` flag (on by default). OpenAI/Google/Anthropic "Used for:" lines now mention OpenCode; new optional OpenRouter API-key card
- **Composer stays unlocked while the agent runs — queue your next prompt (Sprint 74, #82).** Type a follow-up during an agent run and press Enter: it parks in a "Queued" notch above the input (same visual pattern as "Working on selected text") and auto-sends the moment the run completes. Discard it with ×. One queued prompt at a time
- **Edit Link dialog has an optional "Display text" field (Sprint 74, #93).** Pre-populates from the selected text; when re-opening an existing link it pre-fills with the current link text, and Update replaces the whole link. Leave it as-is/empty to keep current behaviour. Hidden during `@file` search

### Fixed
- **Plan approval card now actually approves (Sprint 74, #86).** The Approve/Reject buttons used to render after the approval window had already closed — clicking them silently did nothing. Approval UI now renders only while Claude is genuinely blocked waiting on plan approval. The card is also redesigned: full plan text (no more last-section-only truncation), flat single-level layout, indigo primary Approve CTA
- **Spurious horizontal scrollbar on short code blocks (Sprint 74, #84).** The copy-button tooltip overflowed the code block container and triggered a scrollbar even when the code fit. The container no longer scrolls; the code element inside carries the scroll for genuinely long lines

### Technical
- New webview modules: `ai-sidebar/composerQueue.ts` (+ tests), `ai-sidebar/planText.test.ts` — regression coverage for #82 and #86 wired into `npm test`
- Sprint 76 ACP/OpenCode: new `src/acp/` client (`@agentclientprotocol/sdk` 0.22.1), `acpKeyEnv` (keys → spawn env only, never to the webview), OpenCode model registry in `modelConfig.ts`, bundled darwin/win binaries via `fetch-agent-runtimes.sh`; fixed a `new Function('return require')` antipattern that disabled all runtime tracing
- VS Code base: 1.117 (unchanged from v1.7.2)
- Sprint 74 (AI sidebar & composer polish) — closes issues #82, #84, #86, #93; defers richer queue remove/edit/promote to #95
- Sprint 76 (OpenCode BYOK runtime) — closes #52; cross-agent shared conversation history tracked in #97

---

## [Unreleased] — v1.7.2

> **Draft entry for v1.7.2.** Sprint 72 + Sprint 73 — Markdown navigation polish + bundled runtime/model selector clarity.

### Removed
- **Retired the deprecated "Legacy Agent" chat runtime and the unused document-search (RAG) subsystem (Sprint 74).** The AI sidebar now offers only Claude Code and Codex. The semantic-search/vector-index feature, its citation chips, and the index footer are gone, along with the legacy OpenAI chat client. Existing saved "Legacy Agent" conversations still open read-only. Flows (LLM/Image nodes), API-key configuration, Claude Code, and Codex are unaffected. Internally this deletes `src/rag/`, `src/ai/openAIClient.ts`, and the `@orama/orama` dependency.

### Added
- **AI model selector now warmups Claude model metadata on panel open.** The dropdown upgrades from fallback labels to SDK-reported model names/versions (for example Sonnet/Opus/Haiku version lines) without requiring a first user message.

### Changed
- **AI model selector readability and interaction polish.** Model rows now use a two-line layout (primary model/version + muted tagline), long lists are constrained with a thin vertical scrollbar, and option rows use a pointer cursor.
- **Settings runtime diagnostics now show real bundled runtime details.** Claude card combines CLI + SDK version when available, and Codex app-server version detection now prefers runtime `--version` output (with fallback for older binaries).

### Added
- **Type `@` to link any local file.** A keyboard-first file-search picker opens at the cursor; type to filter, Arrow keys to navigate, Enter to insert. The selected file lands as a Markdown link with the basename as visible text and a relative path as the target. Escape dismisses without inserting
- **All workspace files are searchable via `@`-picker.** Removed the hard-coded extension allowlist after dev verification showed `@test-utils.js` returned "No matching files." Markdown still ranks highest; docs/data/images rank next; code and configs are reachable. Heavy/generated folders (`node_modules`, `.git`, `dist`, `out`, `build`, `.next`, `.turbo`, `coverage`, `*.app`, `VSCode-*`) stay excluded
- **Add Link dialog speaks the same `@`-syntax.** Open the dialog with Cmd+K, type `@query` in the URL field, pick a result — the relative path fills the URL. External-open icon stays hidden for internal targets
- **Cmd-click follows internal links.** Markdown targets open in Ritemark; everything else (PDF, images, CSV, source files, configs) opens via VS Code's default opener. External URLs (http/https) keep their existing system-browser behaviour
- **Heading-level changes from the persistent Table of Contents.** Right-click a TOC row to pick H1–H6 from a context menu; current level is disabled. `⌥⌘1-6` on macOS / `Ctrl+Alt+1-6` elsewhere works globally inside the editor — at cursor inside a heading, at heading boundary (the TOC click landing position), or on a focused TOC row. One undo step reverts. Scroll position is preserved across the level change
- **Edit Link dialog has an `↗` Open icon next to the URL** that follows the link target (external → browser, internal → extension host). Works for both link types — internal targets used to have no way to be opened from the dialog

### Changed
- **`KNOWN_FILE_EXTENSIONS` in `linkTargets.ts`** expanded to cover common code and config extensions (`.js`, `.ts`, `.tsx`, `.py`, `.rs`, `.go`, `.yaml`, `.toml`, `.env`, `.lock`, …) so picking a `.js`/`.ts` file from `@`-search no longer reintroduces the "external-open icon shown for relative path" defect

### Fixed
- **External-open icon was wrongly shown for `*.md` (and other file-extension) relative paths** in the Add Link dialog. The `looksLikeExternalHost` heuristic matched both `example.com` and `spec.md`; now it short-circuits on a known-file-extension set. Ambiguous TLDs (`.io`, `.dev`, `.app`, `.ai`, `.co`) are intentionally left untouched
- **macOS missing-file under symlinked `/tmp` wrongly reported as "outside workspace"** instead of "File not found" by the new internal-link resolver. `fs.realpath` ENOENTs for non-existent files; the lexical path could not be compared against a `realpath`'d workspace root. The resolver now walks the parent chain to the deepest existing ancestor before realpath'ing
- **`vscode.openWith` called with `ritemark.markdownEditor`** (a descriptive name) silently fell back to VS Code's text editor. The registered viewType in `package.json` is `ritemark.editor`; the dispatched id now matches

### Removed
- **Dead `webview/src/components/header/TableOfContents.tsx`** — exported from `header/index.ts` but never imported anywhere. Cleaned up along with the wasted right-click context-menu wiring that was briefly added to it earlier in the sprint

### Technical
- VS Code base: 1.117 (unchanged from v1.7.1)
- New extension-host modules: `src/workspaceFileLinks.ts`, `src/internalLinkResolver.ts` (+ tests)
- New webview modules: `extensions/FileLinkSuggestions.tsx`, `extensions/FileLinkSuggestionList.tsx`, `extensions/HeadingLevelShortcuts.ts`, `components/ui/context-menu.tsx`, `lib/linkTargets.ts`, `lib/workspaceFileSearch.ts`
- New TipTap extension `HeadingLevelShortcuts` re-binds `Mod-Alt-1..6` so it works at heading boundaries (the StarterKit default silently failed there)
- Sprint rolled up: 72 (Markdown navigation and annotation polish)
- Closes issues #79, #80; defers #81 with audit findings

---

## [1.7.1] - 2026-05-25

> **macOS note:** the macOS DMGs in this release are signed with Developer ID + hardened runtime but **not notarized by Apple** (team-eligibility hold, Apple case 102892219755). On first launch macOS Gatekeeper will refuse the app — one-time Open Anyway via System Settings → Privacy & Security clears it. Full disclaimer and exact steps are on the [GitHub Release page](https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.7.1). Windows is unaffected.

### Added
- **GitHub Copilot Chat is first-class.** Marketplace-installed `GitHub.copilot-chat` can authenticate, the real Chat panel lives in the Secondary Sidebar (Auxiliary Bar) next to Ritemark AI, and a dedicated Activity Bar launcher icon opens it
- **Install/uninstall symmetry for Copilot Chat.** Install the Marketplace extension → launcher icon and Chat panel appear; uninstall → both disappear cleanly; reinstall → they come back. Stale hidden layout state from earlier Ritemark builds is repaired on first launch
- **AI Agent Browser Control (macOS, on by default).** Five tools — `navigate`, `click`, `fill`, `type`, `scroll` — wired into both Claude Code SDK and Codex App Server. The `browser-agent-control` flag ships as `stable`, `darwin`-only; non-darwin platforms receive no browser tools
- **"Allow AI to control this browser tab?" consent dialog.** Per-tab consent gate distinct from the v1.7.0 read-share prompt; revoking read consent cascades to control consent

### Changed
- **Copilot compatibility metadata** in `branding/product.json` now includes the GitHub trusted auth access, default chat agent, and proposed API allow-list required by the Marketplace Copilot Chat extension
- **Marketplace extension defaults** no longer disable Copilot inline completions, auto-completions, code actions, or chat-agent enablement
- **Auxiliary Bar order** is **Ritemark AI → GitHub Chat → Terminal** for new and existing profiles, so Copilot Chat coexists beside Ritemark AI rather than replacing it
- **`.html` files open in the integrated browser at the workbench level** — `.html`/`.htm` resolver registered at `default` priority; right-click "Open as Text" is preserved
- **Codex `thread/start` timeout** bumped from 60s to 120s to accommodate the dynamic-tools attach for browser control
- **Settings cleanup:** the misleading "Open HTML files in…" dropdown and the Features section (flag toggles) were removed. Stable feature flags are now baked into platform defaults; a leaner Features panel returns in a later release for experimental flags only

### Fixed
- **Chat History shows every saved conversation** instead of just the most recent — the list now reloads as soon as the workspace context is established
- **Clipboard works inside the sandboxed webview** — Copy on code blocks, Export → Copy as Markdown, and Cmd+C/Cmd+V in table cells now route through the extension host
- **HTML cold-start race is gone** — the `.html` flicker / blank-text-tab on app cold start is resolved by the workbench editor resolver
- **Copilot sign-in path:** Copilot's contained Sign In button has the narrow setup commands it needs without restoring the full upstream VS Code Chat setup UI
- **Copilot Chat disabled state:** VS Code's builtin chat enablement migration no longer disables Marketplace-installed Copilot Chat when Ritemark suppresses the upstream setup contribution

### Technical
- VS Code base: 1.117 (compat patches required for Marketplace Copilot Chat)
- New patch: `patches/vscode/010-ritemark-browser-action-bridge.patch`
- Sprints rolled up: 68 (v1.7.1 patch fixes), 69 (AI Agent Browser Control), 71 (GitHub Copilot Support)
- Closes issues #63, #65, #66, #67, #68

---

## [1.6.0] - 2026-04-28

### Added
- **Agent Library:** new activity-bar entry that auto-discovers `.claude/agents/`, `.claude/skills/`, and `.claude/commands/` from the workspace and the user-scope `~/.claude/` directory; click any entry to open the source `.md` file
- **Properties side panel:** frontmatter editing (status, tags, dates, custom fields) now opens as a dedicated right-side panel instead of a modal dialog
- **Inline Table of Contents:** sticky 220px outline rail in the editor on screens ≥960px wide, with active-heading tracking and click-to-jump
- **Dark mode:** Ritemark Dark theme as a first-class option, auto-switching with the system color scheme
- **Phosphor icon set:** primary navigation, document header, AI sidebar, and dialogs migrated from Codicons to Phosphor Icons
- **CSV → Excel conversion:** "Open in Excel" on a CSV file now converts to a temporary `.xlsx` first (fixes Mac Excel UTF-8 mojibake and EU semicolon-delimiter issues)

### Changed
- **Activity bar redesign:** 28×28 icons, rounded active-state indicator, dedicated Agent Library and Flows entries
- **Auxiliary bar tabs:** compact icon-only tabs when multiple panels are docked on the right side
- **AI panel default placement:** reliably docks on the right on first launch, ignoring cached VS Code view positions
- **Diagnostic noise suppressed:** markdown files no longer show red squiggles for missing link references; file tree no longer propagates editor decorations

### Fixed
- Activity bar 6px vertical spacing between icons (regression from Sprint 53)
- Frontmatter parser handles CRLF line endings (agents written on Windows)
- Frontmatter parser handles YAML block scalar indicators (`>`, `>-`, `|`, `|-`)
- Phosphor font loading hardened in production builds (no brief icon-box flash at startup)
- AI panel focus restoration timeout tightened so the chat input reliably focuses on open

### Technical
- VS Code base: 1.109.5 (no change from v1.5.3)
- No new extension-host runtime dependencies
- Sprints rolled up: 51 (inline ToC + CSV-to-xlsx), 52 (design foundations + Phosphor), 53 (chrome activity bar + titlebar polish, PR #29), 54 (Agent Library + Properties panel, PR #30)
- Internal v1.5.4 build (Sprint 51 only) was never tagged; its content ships here

---

## [1.3.0] - 2026-02-06

### Added
- **PDF Viewer:** Read-only preview for PDF files with page navigation, zoom (50%-200%), text selection, and continuous scroll
- **DOCX Viewer:** Read-only preview for Word documents with faithful visual rendering (fonts, colors, alignment preserved)
- **CSV Sort:** Click column headers to sort data ascending/descending/unsorted
- **CSV Add Row:** Toolbar button to append new rows to spreadsheets
- **Claude Code Node:** New Flows node type for executing Claude Code tasks via Agent SDK
- **Intel Mac Support:** Added darwin-x64 builds for older Intel-based Macs
- **GitHub Actions CI:** Automated Windows and macOS x64 builds on release

### Changed
- Webview bundle increased to ~5MB (includes react-pdf + docx-preview + PDF.js worker)

### Fixed
- Flows sidebar white background on VS Code light themes
- CSV editing preserves correct row indices during sort operations
- Package dependency conflicts with zod 4.x (upgraded openai to v6)

### Technical
- react-pdf@10.3.0 for PDF rendering with worker support
- docx-preview for faithful DOCX visual rendering
- PDF.js worker loaded separately (~1MB) via webview CSP
- Feature flags: All features enabled by default

---

## [1.2.0] - 2026-02-02

### Added
- **Ritemark Flows:** Visual workflow automation for AI content generation (Sprint 27)
  - New Activity Bar tab with Flows icon
  - Drag-and-drop node editor using React Flow
  - Trigger, LLM, Image, and Save File node types
  - Auto-layout with ELKjs
  - Undo/redo support
  - Flow storage in `.ritemark/flows/`
- New branded Ritemark Settings page

### Fixed
- Windows: Dictate button now hidden (macOS-only feature)
- Windows: PDF export images now properly embedded
- Windows: PDF export unicode checkboxes render correctly
- Windows: Word export line-ending compatibility

### Technical
- Bundle size increased by ~2.3MB (React Flow + ELKjs)
- Feature flagged as `ritemark-flows` (enabled by default)

---

## [1.1.1] - 2026-01-30

### Added
- Insert images from files with `/image` command
- Image resize handles with actual file resizing
- Stale file indicator with Refresh button
- Blockquote button in bubble menu

### Changed
- Removed table button from bubble menu (still available via `/table`)

### Fixed
- Image filenames with special characters
- Empty paragraphs around images

---

## [1.1.0] - 2026-01-26

### Added
- Document Search with RAG (Retrieval-Augmented Generation)
- Natural language queries about your documents
- Source citations in AI responses
- Local vector database using Orama

---

## [1.0.3] - 2026-01-15

### Added
- Estonian voice dictation with local Whisper model
- Voice Dictation button in editor toolbar
- Dictation Settings dialog for language/model selection

---

## [1.0.2] - 2026-01-13

### Added
- Excel file preview with multi-sheet support
- Spreadsheet toolbar with "Open in Excel/Numbers" integration
- Extension-only lightweight updates system

---

## [1.0.1] - 2026-01-11

### Added
- Document header with Properties and Export buttons
- PDF export functionality
- Word (.docx) export functionality
- CSV file viewing and inline editing
- Auto-update notification system
- Virtual scrolling for large CSV files (up to 10,000 rows)

### Changed
- Properties modal now properly shows dropdown menus

### Fixed
- Better handling of documents without YAML front-matter

---

## [1.0.0] - 2026-01-10

Initial release of Ritemark Native.

### Added
- TipTap-based WYSIWYG markdown editor
- Full markdown syntax support
- Auto-save with 1 second delay
- AI chat sidebar (Cmd+Shift+A)
- Text rephrasing and improvement tools
- OpenAI API integration
- YAML front-matter editing
- Visual property editor (text, date, tags, status)
- GFM-compatible task lists with checkboxes
- Slash command `/task` for quick task creation
- Drag handle for reordering blocks
- Delete button on hover for blocks
- Smart paste from web pages and Word/Google Docs
- Clean HTML-to-markdown conversion
- Custom Lucide-based file icon theme
- macOS DMG installer with drag-to-Applications

### Technical
- Base: VS Code OSS 1.94.0
- Platform: macOS (Apple Silicon)
- Sprints completed: 01-15

---

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 1.7.1 | 2026-05-25 | Minor | GitHub Copilot Chat first-class, AI Agent Browser Control (experimental), HTML resolver, clipboard + chat history fixes — macOS DMGs unnotarized this one time |
| 1.6.0 | 2026-04-28 | Minor | Agent Library, design refresh (Phosphor), inline ToC, dark mode, CSV→xlsx |
| 1.3.0 | 2026-02-06 | Major | PDF/DOCX preview, CSV enhancements, Claude Code node |
| 1.2.0 | 2026-02-02 | Major | Ritemark Flows - visual AI workflows |
| 1.1.1 | 2026-01-30 | Minor | Image handling improvements |
| 1.1.0 | 2026-01-26 | Minor | Document Search (RAG) |
| 1.0.3 | 2026-01-15 | Minor | Voice dictation |
| 1.0.2 | 2026-01-13 | Minor | Excel preview, lightweight updates |
| 1.0.1 | 2026-01-11 | Minor | Export, CSV preview, auto-update |
| 1.0.0 | 2026-01-10 | Major | Initial release |

---

## Links

- [Releases on GitHub](https://github.com/jarmo-productory/ritemark-public/releases)
- [Detailed release notes](./releases/)
