# Ritemark 1.14.0 Release Notes

Ritemark is a free writing app where the AI you choose works directly in your files, and you stay the author. Ritemark 1.14.0 gives every project folder a task board: write down what you want done, hand a task to Claude Code, Codex or OpenCode, and review the result when it is ready. Voice dictation and on-device transcription now work on Windows and Intel Macs, the browser's Recent list shows the pages you actually visited, and new Codex conversations start on GPT-6.1 Sol. Claude Haiku 5.5 joins the model menu, and the three built-in agents are updated.

## A task board in every project folder

- **Tasks in the activity bar.** Every project folder now has its own task board. Click **Tasks**, right below the File browser: the whole board opens with its columns, and the side bar lists what waits on you, what is being worked on, what is next, and your ideas. **Task board** on the Home tab opens it too.
- **Add a task in a moment.** Type it in **Add a task…** and press Enter or the send button. The field grows with a long title, so you can read it whole while you write.
- **Give a task to an agent.** Press **Give to Claude**; the arrow next to it lets you pick Codex or OpenCode instead. The agent works on the task in its own conversation in the AI sidebar while you keep writing. When it finishes, the task shows what the agent did, what it asks you to check, and the files it changed. Then it is your call: **Mark done**, or **Ask for changes…**. Agents never mark a task done and never delete one.
- **What waits on you comes first.** **Your calls** lists results to review, agents waiting for your answer or approval, decisions an agent left you, and anything that failed, the longest-waiting first. The number on the Tasks icon counts them.
- **Agents don't get in each other's way.** Doing holds three tasks at a time unless you change it. Ritemark won't start a second agent on a file another agent is changing. A task that has to wait starts by itself when there is room.
- **Each task is a page.** Click a task to open it as an ordinary Ritemark document. Add a **Done when** line, because agents finish better when they know what done looks like, and list the files the task is about.
- **Ideas.** Jot down one-line ideas, and let an agent say whether one is worth doing. **Make it a task** turns it into a task with a suggested title and Done when.
- **Your tasks are files in your folder.** Each task is a Markdown file in `.ritemark/tasks/`, so the board travels with the folder: commit it, sync it, or edit a task in any editor. Done shows the last four weeks, and **Archive** puts away what you no longer need to see.
- **Agents can use the board too.** Ask an agent to "turn these meeting notes into tasks". Agents can add and move tasks and report their results; marking done, archiving and deleting stay yours.
- **Agent Library moves to the end of Ritemark's tools.** On the first start of 1.14.0, Tasks goes right below the File browser, and Agent Library goes below Transcribe and Browser. After that, anything you drag stays where you put it.

New: a guide to the [task board](../../user/features/task-board.md).

## Voice dictation and on-device transcription on Windows

- **Dictate on Windows and Intel Macs.** The microphone in the document header now works on Windows PCs and Intel Macs, as it does on Apple silicon Macs. Your voice is turned into text on your own computer: nothing is uploaded, and after a one-time download it works offline.
- **Speak, then text.** Windows PCs and Intel Macs do this work on the processor alone, so Ritemark doesn't type along while you speak. You talk, press Stop, and the text arrives about 20 seconds later on a typical laptop, even after a long dictation, because Ritemark works through the recording while you speak. A note at the cursor says it is recording, then that it is processing and how long that usually takes.
- **A smaller download.** Windows and Intel Macs download an 834 MB speech model instead of 1.5 GB, with the same accuracy.
- **Transcribe on-device.** Transcribe's On-device · Whisper engine now works on Windows and Intel Macs for MP3, WAV, FLAC, OGG and Record files. A typical Windows laptop takes about as long as the recording. On Windows, `.m4a` and `.aac` files still need ElevenLabs.
- **Older Macs.** Apple silicon Macs with macOS 12, 13 or 14 can now dictate and transcribe on-device. Before, the on-device engine needed macOS 15.

## Dictation, everywhere

- **It says why it can't start.** A blocked microphone, no microphone, security software stopping it, a processor that is too old, or a missing speech model each get a plain explanation with the right button. **Open Microphone Settings** names the exact switches on Windows and macOS. Ritemark never offers the download on a computer where dictation can't run.
- **Nothing you say is dropped.** When the computer fell behind, speech that came in meanwhile was thrown away. It now waits its turn and goes in, in order.
- **The last words after Stop.** The microphone now shows **Adding your last words...** until the last sentence is in, instead of looking finished.
- **The dictation note stays out of your file.** The grey **Listening...** note at the cursor used to be saved into the document while you dictated. It is now drawn on top of the document and never saved.
- **Cancel a start.** Clicking the microphone again while it gets ready now cancels.
- **Intel Macs.** Dictation used to download the speech model and then never insert any text there.
- **Silence stays silent.** A muted microphone or a long pause no longer turns into invented words. If Ritemark heard nothing at all, it says so and tells you what to check, and it notices a muted microphone within a few seconds.
- **A clear button.** While you dictate, the microphone button says what a click does: **Transcribe now**, or **Stop** on Apple silicon Macs.
- **The download prompt stays in view.** The voice-model download and resume prompts are dialogs, so they can't slide out of sight.

New: a guide to [voice dictation](../../user/features/dictation.md).

## The browser remembers where you've been

- **Every page you visit is in Recent.** The **Recent** list in the Browser side bar used to show only pages opened from a command, so the sites you typed or clicked your way to never appeared. It now lists the pages you reach by typing an address or clicking a link, links you open in a background tab once you switch to them, local `.html` files, and pages an AI agent opens for you.
- **Titles, not just addresses.** Each page shows its title above its address.
- **Only real visits.** Pages that fail to load, in-page jumps and redirects that pass in a moment are left out. A page you visit again moves to the top instead of appearing twice.
- **Deleted files drop out.** A local file you have deleted no longer shows in Recent.

## Claude and the built-in agents

- **Haiku 5.5 in the Claude model menu.** Anthropic's newest Haiku is now the quick and light choice for Claude Code conversations.
- **Only current Claude models in the menu.** The Claude model menu now offers Claude 5 models: Sonnet 5.5, Opus 5.5, Sonnet 5, Opus 5, Fable 5.1, Fable 5 and Haiku 5.5. Older models, such as Opus 4.8 and Haiku 4.5, are no longer offered. With a Claude subscription, a Haiku choice now runs Haiku 5.5. Any other older model you had chosen keeps working until you pick another.
- **Updated built-in agents.** Ritemark now ships Claude Code 2.1.296, Codex 0.162.1 and OpenCode 1.19.0.

## Codex

- **GPT-6.1 Sol is the default Codex model.** New Codex conversations start on GPT-6.1 Sol, the model Ritemark's built-in Codex recommends. GPT-5.6 Sol is still in the Codex model menu as the previous Sol.
- **Existing Codex conversations continue on GPT-6.1 Sol.** After the update, a conversation that ran on GPT-5.6 Sol carries on, with its earlier messages, on GPT-6.1 Sol. To go back, pick GPT-5.6 Sol in the model menu. Ritemark doesn't keep that pick across a restart yet.

## Fixes

- **Browser tools work in every Claude conversation.** With several Claude conversations open, only the first one could use Ritemark's browser. Each conversation now can.
- **No model notice on your first Claude conversation.** If you had never picked a Claude model, the first Claude conversation said "claude-sonnet-4-5 isn't available right now — using Sonnet 5.5". It now starts on Sonnet 5.5 without a notice. A model you picked yourself still wins.
- **Audio files open without a question.** Opening a `.wav`, `.mp3` or `.ogg` file opened it in Transcribe, but also asked which of two editors should be the default. It no longer asks. The built-in Audio Preview is still under **Reopen Editor With…**.
- **Handing comments to an agent stays quick.** Ritemark kept every finished comment task forever, and each update read all of them. Finished comment tasks older than 30 days are now cleared when Ritemark starts.
- **The Agent Library's … button** uses the same three-dot icon as the rest of Ritemark.
