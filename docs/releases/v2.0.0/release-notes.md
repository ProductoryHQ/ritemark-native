# Ritemark 2.0.0 Release Notes (draft: steps 1 and 2)

**Status:** draft. These notes grow with each step of Ritemark 2.0; this draft covers steps 1 and 2, Surfaces and frame and The welcome.

Ritemark is a free writing app where the AI you choose works directly in your files, and you stay the author. Ritemark 2.0 starts with a welcome. On the first start, one sheet asks which AI you use and where your work is, then opens your project with the AI ready. Usage data is off until you turn it on. The window has a new frame too. The title row is gone. Your places sit in one row at the top of the left column, your documents lie on a raised desk, and the AI has a sheet of its own. A terminal is now a tab like any other. Ritemark Light and Ritemark Dark are redrawn, and Ritemark draws its own menus and dialogs on the Mac and on Windows. The flow editor and the Agent Library are redrawn too, and a narrow window makes room for your document by itself.

## The welcome

- **One sheet on the first start.** When you start Ritemark for the first time with no folder open, the welcome sits alone in the middle of the window, with no strips, tabs or side columns. It takes two steps.
- **Which AI do you use?** For ChatGPT and Claude, sign in with the account you already use: **Sign in**, or **Continue** if you are already signed in. OpenCode runs open models with an API key of your own: **Set up**. You can use more than one.
- **Your own API key, or none yet.** **API keys** lets you use Claude with an Anthropic API key of your own. **Skip for now** goes on without an AI.
- **Checking takes a moment.** Each AI shows **Checking…** until its check answers. If a check doesn't answer within 20 seconds, choose **Try again**.
- **Where is your work?** Choose **Open a folder…**, **Start a new project** or **Try the sample project**. Ritemark makes a new project's folder in Documents/Ritemark, and **Change…** picks another place.
- **A sample project to try.** "Leadership programme" is a small leadership programme with documents to work on: a brief, modules, kickoff notes, and tasks on its task board. A second copy goes to "Leadership programme 2". Ritemark never writes over a folder you already have.
- **Ready to ask.** The window opens on your project with Documents open. The AI's sheet starts a new chat that reads "Ask Claude about this project" (or the AI you signed in to), and the empty desk offers Text, Table and Web page.
- **A later window.** A new window with no folder asks "Where do you want to start?", with your recent projects, **Open another folder…** and **Start a new project**.
- **Help's Welcome is Ritemark's.** Help's **Welcome** and the walkthrough commands open Ritemark's welcome. VS Code's Getting Started page is gone.

## The window

- **No title row.** On the Mac and on Windows, each column starts with a strip that holds its controls on one line: the traffic lights or Windows' buttons, a toggle for each side column, your tabs, and **You**.
- **Three levels, no lines.** The window has a flat ground, the AI on its own sheet, and your documents on a raised desk. No lines divide the parts.
- **Ritemark Light and Ritemark Dark, redrawn.** Ritemark Dark uses deep indigo surfaces instead of slate, and its buttons are light indigo with dark text.
- **Easier to read.** Muted text in Ritemark Light is darker.
- **You.** **You**, at the top right, holds **Settings** and **Help**. ⌘, (Ctrl+, on Windows) opens Ritemark Settings.
- **Git and Node.js in Settings.** When you use this computer's own Claude or Codex, Ritemark Settings shows Git and Node.js under the runtime choice.

## Places and the left column

- **The places row.** Ritemark's places sit in one row at the top of the left column: Home, Documents, Tasks, Browser, Agents and Transcribe. Drag a place to move it, and the row keeps your order.
- **More.** **More** (⋯) at the end of the row holds Copilot Chat, File changes, Extensions, Search and any other place. Copilot Chat opens as a tab, so the AI's column stays the AI's.
- **The project at the top.** The left column starts with your project's mark and name, with a menu. Below them, **New** makes a document, folder, agent, skill, command or flow, and **Search** searches the project's files.
- **A calmer file tree.** The tree has no carets, and its rows are taller.
- **File icons you can tell apart.** PDF, Word, Excel, CSV, PowerPoint, image and audio files each have their own icon.
- **Extensions in a lighter ink.** In the file tree and on tabs, a file's extension is in a lighter ink. The chosen row and tab stay in full ink, and high contrast themes keep full ink.

## Tabs

- **Tabs as wide as their names.** Each tab takes the room its name needs.
- **Tabs fold instead of scrolling.** When the row is full, the tabs you used longest ago fold into **N ⌄**. Click it to see them and bring one back.
- **The + makes a new tab.** The **+** at the end of the tab row makes a new Text, Table, Web page or Terminal tab.
- **The Task board stays first.** Once you pin the Task board tab, it stays first in the row, and you can't close it or move it by mistake.
- **An empty desk offers new tabs.** Every empty desk offers Text, Table and Web page as tiles.

## The terminal is a tab

- **A terminal opens on the desk.** Each terminal is a tab, named "Terminal", "Terminal 2" and so on. Its bar shows **Running** while a command runs, with **Stop**, **Split**, **Clear** and **Close**.
- **Ctrl+` opens a new one.** Ctrl+` (⌃` on the Mac) opens a new terminal tab. The terminal panel is gone.
- **A running command isn't stopped by accident.** Closing a terminal whose command is still running asks first. Choose **Don't ask again** if you don't want the question.

## Menus and dialogs

- **Menus and dialogs look like Ritemark.** On the Mac and on Windows, Ritemark draws its own menus and dialogs, with roomy rows and the chosen row in indigo. A menu closes when you click anywhere outside it.
- **The command palette and notifications match.** They use the same sheet, the same rows and the same buttons as Ritemark's menus.

## Narrow windows

- **The window makes room for your document.** Below 1400 points wide, the AI's column narrows. Below 1200 the left column hides, and below 960 the AI hides too.
- **Widening brings back what was hidden.** Widening the window brings back only what narrowing hid. A column you open yourself stays open until the window narrows past that width again.

## Flows

- **A redrawn flow editor.** The bar at the top holds the flow's name, description and schedule, with **Auto-arrange** and **Run flow**. The steps you can add are listed by kind. Each step's card shows its settings, and a step's settings open in a column beside the flow.
- **Agent steps say how they run.** Claude Code and Codex steps say plainly that they run without asking you, because their actions are approved for the run.
- **Sign-in help.** If Claude Code or Codex isn't signed in, the run tells you to sign in under **Settings > Agent Runtime**.
- **Room for the prompt.** The prompt field grows with its text.

## Agents

- **The Agent Library is now Agents.** You find it in the places row.
- **One line per item.** Each agent, skill, command and flow is one line: its file name with its extension.
- **Details where you need them.** An item's description and who it is for (Claude, ChatGPT or shared) are in its tooltip and in the agent's settings.
- **New makes commands too.** **New** makes agents, skills, commands and flows. **New → Command** is new.
- **Settings beside the instructions.** An agent's settings sit in a panel beside its instructions, and its schedule is one field.

## Documents

- **Pages on a soft canvas.** PDF, Word and PowerPoint pages sit on a soft canvas below the viewer's bar.
- **CSV rows stay on one line.** Read a long value in the formula bar.

## Usage data

- **Off until you turn it on.** A switch on the welcome and in Ritemark Settings reads "Share anonymous usage data to improve Ritemark. Never your documents, chats or names.", with links to the Privacy Policy and Terms of Use. Nothing is sent before you say yes.
- **Four new steps, counted anonymously.** With usage data on, Ritemark also counts the welcome shown, an AI signed in, a project opened and the first message sent, beside the app starts and features used it already counted. Never a path, a name, a file, a message or an account.
- **Off means off.** Turning it off stops sending at once.
- **Feedback reactions too.** Feedback reactions are sent only with usage data on. When it is off, Ritemark says so and offers Settings.

## Updating from 1.14

- **Welcome to Ritemark 2.0.** The first start after the update shows it once: your AIs and whether each is signed in (**Add another** for more), up to three recent projects with the one you left first, **Open another folder…**, **Start a new project** and the usage-data switch.
- **Back where you left off.** **Open when you left** brings the window back as it was.
- **Your usage-data answer carries over.** Ritemark 1's usage-data notice is gone. If you pressed **OK** on it, or closed it without **Opt Out**, usage data stays on after the update. If you chose **Opt Out** or never answered, it is off.
- **Your choices are kept.** A theme you picked yourself stays after the update. Before, every update reset it.
- **The places row gets Ritemark's order once.** On the first start of 2.0, the places row takes Ritemark's order. After that, a place you drag stays where you put it.

## Fixes

- **Settings follows the theme.** When you changed the theme elsewhere, Appearance in Settings kept showing the old one. It now follows.
- **A Markdown file opens once.** On the very first launch, opening a Markdown file sometimes opened it twice. It now opens once, in the Ritemark editor.
