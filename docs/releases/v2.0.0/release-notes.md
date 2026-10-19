# Ritemark 2.0.0 Release Notes (draft: steps 1, 2 and 3)

**Status:** draft. These notes grow with each step of Ritemark 2.0; this draft covers steps 1, 2 and 3: Surfaces and frame, The welcome, and The project at the centre.

Ritemark is a free writing app where the AI you choose works directly in your files, and you stay the author. Ritemark 2.0 starts with a welcome. On the first start, one sheet asks which AI you use and where your work is, then opens your project with the AI ready. Usage data is off until you turn it on. Each project now has its own Home, which says what waits for you and what changed, and you switch between projects in the same window, each with its own tabs. The window has a new frame too. The title row is gone. Your places sit in one row at the top of the left column, your documents lie on a raised desk, and the AI has a sheet of its own. A terminal is now a tab like any other. Ritemark Light and Ritemark Dark are redrawn, and Ritemark draws its own menus and dialogs on the Mac and on Windows. The flow editor and the Agent Library are redrawn too, and a narrow window makes room for your document by itself.

## The welcome

- **One sheet on the first start.** When you start Ritemark for the first time with no folder open, the welcome sits alone in the middle of the window, with no strips, tabs or side columns. It takes two steps.
- **Which AI do you use?** For ChatGPT and Claude, sign in with the account you already use: **Sign in**, or **Continue** if you are already signed in. OpenCode runs open models with an API key of your own: **Set up**. You can use more than one.
- **Your own API key, or none yet.** **API keys** lets you use Claude with an Anthropic API key of your own. **Skip for now** goes on without an AI.
- **Checking takes a moment.** Each AI shows **Checking…** until its check answers. If a check doesn't answer within 20 seconds, choose **Try again**.
- **Where is your work?** Choose **Open a folder…**, **Start a new project** or **Try the sample project**. Ritemark makes a new project's folder in Documents/Ritemark, and **Change…** picks another place.
- **A sample project to try.** "Leadership programme" is a small leadership programme with documents to work on: a brief, modules, kickoff notes, and tasks on its task board. A second copy goes to "Leadership programme 2". Ritemark never writes over a folder you already have.
- **Ready to ask.** The window opens on your project's Home, with your projects listed on the left. The AI's sheet starts a new chat that reads "Ask Claude about this project" (or the AI you signed in to).
- **A later window.** A new window with no folder asks "Where do you want to start?", with your recent projects, **Open another folder…** and **Start a new project**.
- **Help's Welcome is Ritemark's.** Help's **Welcome** and the walkthrough commands open Ritemark's welcome. VS Code's Getting Started page is gone.

## Home and your projects

- **Home is your project's own page.** It shows the project's cover picture, its mark and name, the folder it works in, and a line about the project that you can edit in place. **Change image** picks another cover. Your line and cover travel with the project's folder.
- **Waiting for you.** Home lists what needs you in this project: a task that waits for you, and a chat where the AI asks you something, waits for your OK, or has a reply you haven't read. One line counts what waits in your other projects.
- **Start something.** Home makes a new Text, Table or Web page tab in the project.
- **Last changed.** Home lists the documents changed last, with their folder and when. Click one to open it.
- **An empty project says so.** Home offers Text, Table and Web page, and a place to drop files. Dropped files are copied into the project, and the originals stay where they are.
- **All your projects, on Home.** With Home chosen, the left column lists your projects, each with what waits in it. **Search all projects** finds one by its name, and **Add a project…** opens a folder or starts a new project.
- **Every project from day one.** On the first start of 2.0, the list is filled from the folders you opened recently, the projects you have chats in and the projects with a task board. It stays on your computer.
- **Switch in the same window.** Click a project to switch to it. Each project opens on its Home and keeps its own tabs, so coming back finds them as you left them. ⌥-click (Alt-click on Windows) opens a project in a new window.
- **Go back.** After a switch, Home says which project you left, for example "Switched to Sales proposal Q4. Leadership programme is kept as you left it.", with **Go back**.
- **A question while the AI works.** If a chat is still working when you switch, Ritemark asks first, for example "Claude is still working in Leadership programme". **Open in a new window**, the default, lets the AI finish. **Switch and stop** stops it and switches, and **Cancel** keeps you where you are. File ▸ Open Recent asks the same. When Ritemark can't know which folder you are opening, as with File ▸ Open Folder… or File ▸ Close Folder, it asks with **Cancel** and **Switch and stop**, and Cancel is the default. With nothing working, switching never asks.
- **A folder that has moved.** A project whose folder isn't where it was keeps its place in the list, marked Not found. Click it, and Home offers **Find it…** to pick where the folder is now, or **Remove from the list**. Removing it leaves the folder, its chats and its task board as they are.
- **About this project.** One page about your project that both Claude and ChatGPT read. Choose **About this project** from the project's menu to open it, or to create it. Ritemark keeps it in the project's `AGENTS.md` file and shows it as About this project. If your folder already has a `CLAUDE.md` of your own, Ritemark never changes it unless you click **Add the line**.

## The window

- **No title row.** On the Mac and on Windows, each column starts with a strip that holds its controls on one line: the traffic lights or Windows' buttons, a toggle for each side column, your tabs, and **You**.
- **Three levels, no lines.** The window has a flat ground, the AI on its own sheet, and your documents on a raised desk. No lines divide the parts.
- **Ritemark Light and Ritemark Dark, redrawn.** Ritemark Dark uses deep indigo surfaces instead of slate, and its buttons are light indigo with dark text.
- **Easier to read.** Muted text in Ritemark Light is darker.
- **You.** **You**, at the top right, holds **Settings** and **Help**. ⌘, (Ctrl+, on Windows) opens Ritemark Settings.
- **Git and Node.js in Settings.** When you use this computer's own Claude or ChatGPT, Ritemark Settings shows Git and Node.js under the runtime choice.
- **Every setting is still there.** **Advanced settings**, at the foot of Ritemark Settings, opens all the other settings, such as the feature switches, updates, excluded folders and the transcription export folder.

## Places and the left column

- **The places row.** Ritemark's places sit in one row at the top of the left column: Home, Documents, Tasks, Browser, Agents and Transcribe. Drag a place to move it, and the row keeps your order.
- **More.** **More** (⋯) at the end of the row holds Copilot Chat, File changes, Extensions, Search and any other place. Copilot Chat opens as a tab, so the AI's column stays the AI's.
- **The project at the top.** Every place but Home starts with your project's mark and name, with its menu: **Switch project**, **Open a folder…**, **Reveal in Finder** (Reveal in File Explorer on Windows) and **About this project**. In Documents, **New** makes a document, folder, agent, skill, command or flow, and **Search** searches the project's files.
- **Tasks.** **New task** starts a task and **Search** finds one by its title. The list runs in the order work moves: Ideas, To do, Doing and Done. A task that waits for you comes first in its stage, marked "Waiting for you", and Archived is inside Done.
- **Browser.** **New page** opens a web page. Under **Recent**, each page you visited is one row with the site's icon, its title and its domain, and **Clear history** sits beside the label. An empty list says "No pages yet".
- **Transcribe.** **Record** and **Transcribe a file…** sit at the top. Your library is called Recordings, and the gear beside its label opens Transcribe's settings.
- **A calmer file tree.** The tree has no carets, and its rows are taller.
- **File icons you can tell apart.** PDF, Word, Excel, CSV, PowerPoint, image and audio files each have their own icon.
- **Extensions in a lighter ink.** In the file tree and on tabs, a file's extension is in a lighter ink. The chosen row and tab stay in full ink, and high contrast themes keep full ink.

## Tabs

- **Tabs as wide as their names.** Each tab takes the room its name needs.
- **Tabs fold instead of scrolling.** When the row is full, the tabs you used longest ago fold into **N ⌄**. Click it to see them and bring one back.
- **The + makes a new tab.** The **+** at the end of the tab row makes a new Text, Table, Web page or Terminal tab.
- **Home and Tasks come first.** Every project window has Home and the Task board as its first two tabs, pinned as icons. You can't close or move them by mistake, and **Close all** leaves just these two. With the task board turned off, Home is first alone.
- **The Task board tab shows what waits.** It shows the same count as the Tasks place, and its tooltip says it in words, such as "Task board, 2 wait for you".
- **New tab from the File menu.** **File ▸ New tab** (⌘T, Ctrl+T on Windows) opens the +'s menu.
- **An empty desk offers new tabs.** Every empty desk offers Text, Table and Web page as tiles.

## The terminal is a tab

- **A terminal opens on the desk.** Each terminal is a tab, named "Terminal", "Terminal 2" and so on. Its bar shows **Running** while a command runs, with **Stop**, **Split**, **Clear** and **Close**.
- **Ctrl+` opens a new one.** Ctrl+` (⌃` on the Mac) opens a new terminal tab. The terminal panel is gone.
- **A running command isn't stopped by accident.** Closing a terminal whose command is still running asks first. Choose **Don't ask again** if you don't want the question.

## Menus and dialogs

- **Menus and dialogs look like Ritemark.** On the Mac and on Windows, Ritemark draws its own menus and dialogs, with roomy rows and the chosen row in indigo. A menu closes when you click anywhere outside it.
- **The command palette and notifications match.** They use the same sheet, the same rows and the same buttons as Ritemark's menus.
- **All commands lists what you can use.** All commands (⇧⌘P, Ctrl+Shift+P on Windows) no longer lists VS Code's developer and debugging commands, such as "Add Function Breakpoint". Their menus and shortcuts still work.
- **The File menu.** **File** has **New tab**, **Switch project** and **Share**. Switch project shows Home with your projects, ready for you to type a name. Share opens the Share menu of the document in front.

## Narrow windows

- **The window makes room for your document.** Below 1400 points wide, the AI's column narrows. Below 1200 the left column hides, and below 960 the AI hides too.
- **Widening brings back what was hidden.** Widening the window brings back only what narrowing hid. A column you open yourself stays open until the window narrows past that width again.

## The AI

- **The share question waits beside your work.** When Ritemark asks whether to share the web page you have open with the AI, it asks on the AI's sheet, above the message box, instead of in a dialog: "Share this page with Claude?", with **Share this page**, **Not now** and a box, "Share pages I open in Ritemark without asking". Your tabs keep working while it waits, and nothing about the page reaches the AI until you share it.
- **A reply you haven't read is marked.** On the chat rail, a chat with a reply you haven't read wears the amber dot that a chat waiting for you wears, until you open it.
- **ChatGPT by its name.** Everywhere Ritemark names the AI, it says ChatGPT, not Codex: in Settings, notifications, the AI's sheet, the model picker, the task board, comments and flows. A model's own name, such as GPT-5.3 Codex Spark, stays as OpenAI writes it, and in comments you still assign ChatGPT with @codex.

## Flows

- **A redrawn flow editor.** The bar at the top holds the flow's name, description and schedule, with **Auto-arrange** and **Run flow**. The steps you can add are listed by kind. Each step's card shows its settings, and a step's settings open in a column beside the flow.
- **Agent steps say how they run.** Claude Code and ChatGPT steps say plainly that they run without asking you, because their actions are approved for the run.
- **Sign-in help.** If Claude Code or ChatGPT isn't signed in, the run tells you to sign in in Ritemark Settings.
- **Room for the prompt.** The prompt field grows with its text.

## Agents

- **The Agent Library is now Agents.** You find it in the places row.
- **One line per item.** Each agent, skill, command and flow is one line: its file name with its extension.
- **Details where you need them.** An item's description and who it is for (Claude, ChatGPT or shared) are in its tooltip and in the agent's settings.
- **New makes commands too.** **New** makes agents, skills, commands and flows. **New → Command** is new.
- **Settings beside the instructions.** An agent's settings sit in a panel beside its instructions, and its schedule is one field.
- **Your agent's colour.** An agent you gave a colour in its settings shows its icon in that colour, in Light and in Dark.
- **Agents live here, not in Documents.** Documents no longer shows the `.claude` folder; what is in it is what Agents shows.

## Documents

- **Saved.** The document's bar says **Saved** once your document is written to disk.
- **Share, not Export.** **Share** on the document's bar sends a copy as a PDF (for reading and printing) or a Word document (for people who edit in Word), publishes to Google Docs (one Google Doc you update from here), or copies the document as Markdown (for email and chat). The document stays on your computer; sharing sends a copy.
- **PDF and Word files.** **Save as Markdown** is now **Make an editable copy**. Each bar ends in **Share**: **Show in Finder** (Show in File Explorer on Windows), so you can attach the file to an email or a message, and **Open in Preview** for a PDF (Open in default app on Windows) or **Open in Word** for a Word file.
- **Pages on a soft canvas.** PDF, Word and PowerPoint pages sit on a soft canvas below the viewer's bar.
- **CSV rows stay on one line.** Read a long value in the formula bar.

## Usage data

- **Off until you turn it on.** A switch on the welcome and in Ritemark Settings reads "Share anonymous usage data to improve Ritemark. Never your documents, chats or names.", with links to the Privacy Policy and Terms of Use. Nothing is sent before you say yes.
- **Four new steps, counted anonymously.** With usage data on, Ritemark also counts the welcome shown, an AI signed in, a project opened and the first message sent, beside the app starts and features used it already counted. Never a path, a name, a file, a message or an account.
- **Off means off.** Turning it off stops sending at once.
- **Feedback is your own choice.** Send Feedback says under its text box that what you write is sent with your feedback. Pressing Send sends it even with usage data off: only your reaction and what you typed, under a one-off id that isn't kept. Usage data stays off, and Escape sends nothing.

## Updating from 1.14

- **Welcome to Ritemark 2.0.** The first start after the update shows it once: your AIs and whether each is signed in (**Add another** for more), up to three recent projects with the one you left first, **Open another folder…**, **Start a new project** and the usage-data switch.
- **Back where you left off.** **Open when you left** brings the window back as it was, with Home and Tasks first and the tab you had in front still in front.
- **What moved.** The first Home after the update shows a card once: the terminal is a tab (a new one comes from the +), Copilot Chat is in More and opens as a tab, and Settings and Help are under **You** at the top right, where ⌘, (Ctrl+, on Windows) opens Settings. **Got it** closes it for good.
- **Your projects are listed.** The projects list on Home is filled on the first start from the folders you opened, the projects you have chats in and the projects with a task board. Old chats count as read.
- **Everything the old Home did is still there.** New document and New table are Home's **Start something** and the **+**. New AI conversation is **New chat** on the AI's sheet. Recent work is **Last changed**. The Task board is the Tasks tab. Open folder is **Add a project…**, and **File ▸ Open…** opens a single document. Your recent folders are the projects list.
- **Export is Share.** Every way to export a document is in **Share** on the document's bar, and Save as Markdown on PDF and Word files is **Make an editable copy**.
- **VS Code's settings.** ⌘, opens Ritemark Settings, and **Advanced settings** at its foot opens all the other settings.
- **Your usage-data answer carries over.** Ritemark 1's usage-data notice is gone. If you pressed **OK** on it, or closed it without **Opt Out**, usage data stays on after the update. If you chose **Opt Out** or never answered, it is off.
- **Your choices are kept.** A theme you picked yourself stays after the update. Before, every update reset it.
- **The places row gets Ritemark's order once.** On the first start of 2.0, the places row takes Ritemark's order. After that, a place you drag stays where you put it.

## Fixes

- **Settings follows the theme.** When you changed the theme elsewhere, Appearance in Settings kept showing the old one. It now follows.
- **New documents land in your project.** **Text** and **Table** make "Untitled.md" or "Untitled.csv" in the folder you chose in the left column, or your project's top folder. Before, they went to Documents/Ritemark.
- **Saving after a conflict.** After **Use disk version**, saving works again.
- **Tables.** A table's + and delete handles stay on their rows when you scroll.
- **New agents show up at once.** Agents, commands and skills you add appear under @ and / without a reload.
- **Document properties.** The Add menu fits, and a property you add is ready to type in.
- **Small menus.** The thinking-effort menu stays inside the AI's sheet, and Escape closes the dictation language menu.
- **Transcribe's gear** opens its own settings.
- **A Markdown file opens once.** On the very first launch, opening a Markdown file sometimes opened it twice. It now opens once, in the Ritemark editor.
- **A deleted project folder stays deleted.** When you deleted an open project's folder outside Ritemark, Ritemark made it again, empty, within 30 seconds. Now the project shows as Not found until you find it or remove it from the list.
