# Ritemark 2.0.0 Release Notes (draft: step 1)

**Status:** draft. These notes grow with each step of Ritemark 2.0; this draft covers step 1, Surfaces and frame.

Ritemark is a free writing app where the AI you choose works directly in your files, and you stay the author. Ritemark 2.0 starts with a new frame for the window. The title row is gone. Your places sit in one row at the top of the left column, your documents lie on a raised desk, and the AI has a sheet of its own. A terminal is now a tab like any other. Ritemark Light and Ritemark Dark are redrawn, and Ritemark draws its own menus and dialogs on the Mac and on Windows. The flow editor and the Agent Library are redrawn too, and a narrow window makes room for your document by itself.

## The window

- **No title row.** On the Mac and on Windows, each column starts with a strip that holds its controls on one line: the traffic lights or Windows' buttons, a toggle for each side column, your tabs, and **You**.
- **Three levels, no lines.** The window has a flat ground, the AI on its own sheet, and your documents on a raised desk. No lines divide the parts.
- **Ritemark Light and Ritemark Dark, redrawn.** Ritemark Dark uses deep indigo surfaces instead of slate, and its buttons are light indigo with dark text.
- **Easier to read.** Muted text in Ritemark Light is darker.
- **You.** **You**, at the top right, holds **Settings** and **Help**. ⌘, (Ctrl+, on Windows) opens Ritemark Settings.

## Places and the left column

- **The places row.** Ritemark's places sit in one row at the top of the left column: Home, Documents, Tasks, Browser, Agents and Transcribe. Drag a place to move it, and the row keeps your order.
- **More.** **More** (⋯) at the end of the row holds Copilot Chat, File changes, Extensions, Search and any other place. Copilot Chat opens as a tab, so the AI's column stays the AI's.
- **The project at the top.** The left column starts with your project's mark and name, with a menu. Below them, **New** makes a document, folder, agent, skill, command or flow, and **Search** searches the project's files.
- **A calmer file tree.** The tree has no carets, and its rows are taller.
- **File icons you can tell apart.** PDF, Word, Excel, CSV, PowerPoint, image and audio files each have their own icon.

## Tabs

- **Tabs as wide as their names.** Each tab takes the room its name needs.
- **Tabs fold instead of scrolling.** When the row is full, the tabs you used longest ago fold into **N ⌄**. Click it to see them and bring one back.
- **The + makes a new tab.** The **+** at the end of the tab row makes a new Text, Table, Web page or Terminal tab.
- **The Task board stays first.** Once you pin the Task board tab, it stays first in the row, and you can't close it or move it by mistake.

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

## Updating from 1.14

- **Your choices are kept.** A theme you picked yourself stays after the update. Before, every update reset it.
- **The places row gets Ritemark's order once.** On the first start of 2.0, the places row takes Ritemark's order. After that, a place you drag stays where you put it.

## Fixes

- **Settings follows the theme.** When you changed the theme elsewhere, Appearance in Settings kept showing the old one. It now follows.
