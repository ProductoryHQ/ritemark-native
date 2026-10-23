# Ritemark 2.0.0 Release Notes

Ritemark turns a folder on your computer into a workspace where ChatGPT or Claude work with you. Ritemark 2.0 is a new Ritemark. The window has a calm new frame, in light and dark, on the Mac and on Windows. The first start is a welcome that asks which AI you use and opens your project with it ready. And your project is at the centre: each project has its own Home and its own tasks, and you switch between projects in the same window. Underneath, Ritemark runs on a newer VS Code. Everything Ritemark 1.14 did is still here, though some of it has moved. [Updating from 1.14](#updating-from-114) says where.

## A calmer window

- **No title row.** Each column starts with a strip that holds its controls on one line: the traffic lights or Windows' buttons, a toggle for each side column, your tabs, and **You**.
- **Three levels, no lines.** A flat ground, the AI on a sheet of its own, and your documents on a raised desk, in a redrawn Ritemark Light and Ritemark Dark. Dark uses deep indigo instead of slate, and muted text in Light is easier to read.
- **Your places in one row.** Home, Documents, Tasks, Browser, Agents and Transcribe sit at the top of the left column. Drag one to move it. **More** (⋯) holds File changes, Extensions, Search and any other place.
- **Tabs as wide as their names.** When the row is full, the tabs you used longest ago fold into **N ⌄**. The **+** at the end makes a new Text, Table, Web page or Terminal tab, as does **File ▸ New tab** (⌘T, Ctrl+T on Windows).
- **The terminal is a tab.** Each terminal opens on the desk, with **Stop**, **Split**, **Clear** and **Close** on its bar. ⌃` (Ctrl+` on Windows) opens a new one. Closing a terminal whose command is still running asks first.
- **You.** **You**, at the top right, holds **Settings** and **Help**. ⌘, (Ctrl+, on Windows) opens Ritemark Settings, and **Advanced settings** at its foot opens every other setting.
- **Ritemark's own menus and dialogs.** Menus, dialogs, the command palette and notifications share one look. All commands no longer lists VS Code's developer and debugging commands.
- **Room for your document.** As the window narrows, the AI's column narrows, then the left column hides, then the AI. Widening the window brings them back.
- **A calmer file tree.** No carets, taller rows, file icons you can tell apart, and file extensions in a lighter ink.

## On Windows

- **The same frame.** Windows has no title row either. The menu sits behind a button at the start of the left column's strip, and Alt opens it from the keyboard. Minimise, maximise and close sit at the right end of the AI's strip, or of the desk's strip when the AI is hidden. Snap layouts work, and every tooltip says Ctrl.
- **Labels as written.** Labels with an ellipsis, such as **Open a folder…**, no longer turn into stray characters.

## The welcome

- **Which AI do you use?** For ChatGPT and Claude, sign in with the account you already use. OpenCode runs open models with an API key of your own. You can use more than one, use Claude with an Anthropic API key, or choose **Skip for now**.
- **Where is your work?** **Open a folder…**, **Start a new project** (in Documents/Ritemark, or **Change…**), or **Try the sample project**, a small leadership programme with documents and tasks to work on. Ritemark never writes over a folder you already have.
- **Ready to ask.** Your project opens on its Home, with the AI's sheet on a new chat: "Ask Claude about this project", or the AI you signed in to.
- **Later windows.** A new window with no folder asks "Where do you want to start?", with your recent projects.
- **Help.** **Welcome** opens Ritemark's welcome, and **Getting started** sits beside **Support**.

## Your project at the centre

- **Home is your project's own page.** A cover picture, the project's mark and name, and a line about it that you can edit. **Waiting for you** lists the tasks and chats that need you. **Start something** makes a Text, Table or Web page, and **Last changed** lists the documents changed last.
- **Home and Tasks come first.** Every project window has Home and the Task board as its first two tabs, pinned as icons, and **Close all** leaves just these two. The Task board's tab shows how many tasks wait for you.
- **All your projects, on Home.** With Home chosen, the left column lists your projects, each with what waits in it. On the first start it is filled from the folders you opened recently, the projects you have chats in and the projects with a task board. The list stays on your computer.
- **Switch in the same window.** Click a project to switch to it. Each project keeps its own tabs, so coming back finds them as you left them, and Home offers **Go back**. ⌥-click (Alt-click on Windows) opens a project in a new window.
- **Ritemark asks before stopping the AI.** If a chat is still working when you switch, Ritemark asks first. **Open in a new window** lets the AI finish.
- **A folder that has moved** stays in the list, marked Not found, until you **Find it…** or remove it from the list.
- **About this project.** One page about your project that both Claude and ChatGPT read, opened from the project's menu at the top of each place. Ritemark keeps it in `AGENTS.md`, and never changes a `CLAUDE.md` of your own unless you click **Add the line**.
- **Tasks in the order work moves.** Ideas, To do, Doing and Done, with what waits for you first.

## Documents

- **Saved.** The document's bar says **Saved** once your document is on disk.
- **Share, not Export.** **Share** sends a copy as a PDF or a Word document, publishes to Google Docs, or copies the document as Markdown. The document stays on your computer.
- **PDF and Word files.** **Save as Markdown** is now **Make an editable copy**, and their bars end in **Share** too.
- **New documents land in your project.** Text and Table make "Untitled.md" or "Untitled.csv" in the folder you chose in the tree, or in the project's top folder. Before, they went to Documents/Ritemark.

## The AI, Agents and Flows

- **The share question waits beside your work.** When Ritemark asks whether to share the open web page with the AI, it asks on the AI's sheet instead of in a dialog, and once per page. Your tabs keep working, and nothing about the page reaches the AI until you share it.
- **A reply you haven't read** wears an amber dot on the chat rail until you open it.
- **ChatGPT, by its name.** Ritemark says ChatGPT, not Codex, wherever it names the AI. In comments you still assign ChatGPT with @codex.
- **Any ChatGPT account works.** Settings now says so: Free included, with higher limits on paid plans.
- **Agents and flows.** The Agent Library is now Agents, in the places row, and **New → Command** is new. The flow editor is redrawn, and a Claude Code or ChatGPT step that isn't signed in says where in Ritemark Settings to sign in.
- **Updated built-in agents.** Ritemark 2.0 ships Claude Code 2.1.304, Codex 0.163.0 and OpenCode 1.19.3.

## Usage data

- **On by default, and yours to turn off.** A switch on the welcome and in Ritemark Settings reads "Share anonymous usage data to improve Ritemark". Usage data never carries your documents, chats or names.
- **Nothing before you leave the welcome.** On a first start, nothing is sent until you leave the welcome for a project with the switch on. Turning it off, there or later, stops all sending.
- **No location.** No event carries where you are.
- **Four new counts.** With usage data on, Ritemark also counts the welcome shown, an AI signed in, a project opened and the first message sent. Never a path, a name, a file, a message or an account.
- **Feedback is your own choice.** Send Feedback sends what you typed when you press Send, even with usage data off.

## Updating from 1.14

- **Welcome to Ritemark 2.0.** The first start after the update shows your AIs, already signed in, and up to three recent projects. **Open when you left** brings your window back as it was. Once you pick a project, it doesn't show again.
- **What moved.** Your first Home shows a card that says where things went, until you choose **Got it**:
  - The terminal is a tab. Open one from the **+**, or with ⌃` (Ctrl+` on Windows).
  - If you use Copilot Chat, it is in **More** and opens as a tab.
  - **Settings** and **Help** are behind **You**, at the top right.
  - **Home** replaces 1.14's launcher. New document and New table are **Start something** and the **+**, Recent work is **Last changed**, and Open folder is **Add a project…**.
  - **Export** is now **Share**, on the document's bar.
- **Your usage-data answer carries over.** If you chose **Opt Out** in Ritemark 1, usage data stays off. If you pressed **OK**, or closed the notice without Opt Out, it stays on. If you never answered, the welcome's switch is on, as it is for anyone new, and nothing is sent until you leave the welcome with it on.
- **Your choices are kept.** A theme you picked yourself stays. Before, every update reset it. Your projects are in the projects list, and chats from before 2.0 count as read.
- **The places row gets Ritemark's order once.** After that, a place you drag stays where you put it.
- **A newer VS Code underneath.** Ritemark 2.0 runs on VS Code 1.142 (1.14 was on 1.117), with Electron 43 and Chromium 150, which still get security fixes. In the browser, Developer tools is now in the bar's ⋯ menu.

## Fixes

- **A task's tab shows its title.** A task opened from Tasks shows its title and the task mark on its tab, not its file name, and follows when you rename it. The AI's chip, and the line above a message you sent about it, name it the same way.
- **Documents keeps up with changes made outside Ritemark.** A file you add or delete in Finder or another app shows in Documents right away. Ritemark no longer watches your whole home folder to notice new agents and commands, which could leave Documents behind.
- **The AI's Active chip follows the document in front.** A closed or deleted file no longer stays in it, and switching desks updates it.
- **Dictation starts in your language.** On a new profile, dictation starts in your computer's language when Whisper knows it, and in English otherwise. Choosing a language beside the microphone (**EN ⌄**) only sets it; the microphone starts dictation.
- **An AI turn leaves the left column alone.** A turn opened Documents, even when you had closed the column or were on Home. It now stays as you left it.
- **A restored chat keeps its time.** A finished turn keeps its "Done in …" after a project switch or a restart, instead of "Done in 0.0s".
- **One unreadable task no longer empties the board.** A task file that can't be read, such as a cloud file that hasn't downloaded yet, is listed under Couldn't read, and the rest of the board loads. A task you gave to an agent keeps its link to the agent's chat.
- **Tables delete the row you chose.** In a sorted CSV, deleting a row removed another one. Numbers now sort as numbers, too.
- **Saving after a conflict.** After **Use disk version**, saving works again.
- **Smaller things.** Settings' Appearance follows the theme, a table's handles stay on their rows when you scroll, and new agents, commands and skills appear under @ and / without a reload.
- **A Markdown file opens once** on the very first launch, not twice.
- **A deleted project folder stays deleted.** Ritemark no longer makes it again, empty. The project shows as Not found.

## Known issues

- **Going back to 1.14.** Installing 1.14 again after 2.0 works and keeps your work, but some things look different. Its **File ▸ Open Recent** is empty, because 2.0 moved that list, and folders you open in 1.14 don't reach 2.0's list.
- **A chat's model after a restart.** A model you pick in a conversation is not kept across a restart yet ([#417](https://github.com/ProductoryHQ/ritemark-native/issues/417)).
- **Two prompts for one change.** When a document changes on disk while you have unsaved edits, two prompts ask what to do: VS Code's notification and Ritemark's Review changes ([#454](https://github.com/ProductoryHQ/ritemark-native/issues/454)).
- **Windows may warn about a new version.** SmartScreen or Smart App Control can warn about, or block, a newly signed installer while its reputation builds. Installing from the Microsoft Store is the recommended way. See [Installing Ritemark safely on Windows](../../user/windows-smart-app-control.md).
