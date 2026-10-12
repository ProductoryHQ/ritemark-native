# Sprint 130 Spec — Task board in your project folder

## Purpose

A writer, trainer or consultant keeps the work of one project in one place: what to do, what an agent is doing, what waits on them, and what was done. The board lives in the project folder, works offline and needs no account. Any card can be handed to Claude Code, Codex or OpenCode with its context and files, and the result comes back to the card.

## Principles

- **The folder owns the board.** Cards are ordinary files in `.ritemark/tasks/`; they travel with the folder, read without Ritemark, and sync like any other file.
- **The user decides.** Agents propose, work and report; only the user marks a card done or deletes it.
- **One handoff path.** A card reaches an agent the same way a comment does (Sprint 117): host-owned task record, shared availability check, the AI sidebar's queue, results by turn identity. No second agent pipeline.
- **One tool definition per tool.** Board tools reach all three runtimes from one definition, as browser tools will after this sprint.
- **The user picks the agent, everywhere** (Jarmo, 2026-10-12). Every action that starts agent work names the agent and has a dropdown with Claude Code, Codex and OpenCode.
- **The user's attention is the scarce resource** (Jarmo, 2026-10-12). Agents can do many things at once; what limits a project is how fast its owner decides and reviews. The board shows what waits on the user before anything else, makes each call cheap, and keeps agents from producing more than the user can review or from working against each other.
- **Glanceable first.** The side bar answers "what waits on me, what is running" at 280 px; planning happens in the editor-area board.
- **Nothing silent.** Every state has words and a glyph; no colour-only signals; no success before the agent's queue accepted the task.

## Requirements

### R1: Tasks in the activity bar

As a user, I want a Tasks button next to Home, Transcribe, Agent Library and Browser, so the board is one click away like the other Ritemark tools.

Acceptance criteria:
- The activity bar shows **Tasks** with the Phosphor `kanban` icon as the first of Ritemark's own tools, just above Transcribe (D7), in a fresh profile.
- Its side-bar view has an "Add a task…" field with an **Open board** icon button beside it, then Your calls (when any), Doing, To do, Ideas (collapsed) and Done (collapsed, latest 5), as in [design.md §3](./design.md#3-the-side-bar-daily-surface). A card shows once, under the first section that applies.
- The activity-bar icon carries a badge with the number of Your calls ("3 tasks need you"); no badge when there are none.
- **Your calls stands out**: in the side bar it is a panel of its own on the surface colour, its header says how long the oldest call has waited ("oldest 2h"), and when an agent is blocked mid-turn a line says so ("1 agent can’t continue until you answer"). Every call shows how long it has waited.
- The command **Tasks: Add a Task…** asks for one line in VS Code's input box and returns focus to where it was.
- With no folder open the view says so and offers **Open folder**; nothing is written anywhere.
- With the `task-board` flag off the view shows a one-line notice and nothing else.

### R2: The board in the editor area

As a user, I want the whole board in the editor area when I plan, so I can see every stage side by side.

Acceptance criteria:
- **Open board** (side bar, command palette "Tasks: Open Board") opens one "Task board" tab; a second call reveals the same tab.
- The tab has four views: **Your calls**, **Board**, **Ideas**, **Log**. The last view used is restored.
- The tab survives a window reload and an app restart (serializer).
- Both surfaces show the same state within one second of any change, from any source (UI, agent tool, file edited outside Ritemark).

### R3: Cards

As a user, I want to add, edit, move and remove cards, so the board says what is true.

Acceptance criteria:
- A card has a title (one line), **Done when** (one line: what done looks like), a description (Markdown), the files it names, a stage, a short history and, when an agent worked on it, a result.
- A card without Done when can still be given to an agent; its detail says "Add what done looks like below. Agents finish better with it."
- **Stages are fixed:** Idea, To do, Doing, Done (D2).
- Adding takes one line (Enter to add): the side bar's field and the command add to To do; `+` on the board's Idea and To do columns adds there. **A new card goes to the top of its stage.**
- A card is moved by drag and drop on the board, by **Move to…** in its More actions menu (side bar and board, the keyboard path) and by the Stage field in its detail.
- **The order of To do is the priority.** The top card that can start reads "Next up" on both surfaces.
- The leading circle of a To do row marks it done in one click. **Reopen** on a Done card moves it back to To do.
- While an agent is working on a card or waiting for the user in its conversation, the card cannot leave Doing or be marked done; the disabled action says why.
- Clicking a card opens its detail as designed in [design.md §5](./design.md#5-card-detail): a dialog on the board, the same content filling the side bar; every field is editable there.
- **Files:** **Add files…** opens a picker rooted in the project; only files inside the project can be added; a file that no longer exists is shown as missing, not removed; clicking a file opens it in its usual editor.
- **Open as document** (More actions only) opens the card's Markdown file in the Ritemark editor.
- **Delete…** asks once, then moves the card file to the system trash.
- A card's own `- [ ]` checkboxes show as progress on the card ("2 of 5").

### R4: The board's data lives in the project folder

As a user, I want the board to be plain files in my project folder, so it travels with the folder, works offline and never locks me in.

Acceptance criteria:
- Each card is one Markdown file `.ritemark/tasks/<id>-<slug>.md` with the front matter in [research/storage-decision.md](./research/storage-decision.md). The folder is created on the first card, not before.
- Moving a card rewrites that card's file only.
- Every write is atomic (temporary file, then rename). A crash mid-write leaves the previous version.
- A card file that does not parse is **never overwritten**: it shows as "Couldn't read this card" with **Open as document**, and the rest of the board works.
- Editing, adding or deleting a card file outside Ritemark (another editor, git, a sync tool, an agent's own file tools) shows on the board within one second.
- Unknown front-matter keys and the body's exact bytes survive a write that does not change them.
- Which conversation a card's work runs in, and its live state, are stored on this computer only, not in the card file.

### R5: Give to agent

As a user, I want to hand a card to an agent with one click, so it works on it while I do something else.

Acceptance criteria:
- Every card that is not Done has **Give to {agent}**: a split button whose menu offers Claude Code, Codex and OpenCode with their availability ("Sign in required", "Not set up"). The default is the agent last used on this board, otherwise the agent of the conversation open in the AI sidebar.
- The availability check is the same as the AI sidebar's and comment tasks' (`deriveRuntimeAvailabilities`); an unavailable agent shows its recovery action (Sign in, Settings) and starts nothing.
- **The first handoff of a card starts a new conversation** in the AI sidebar for the chosen agent, titled with the card's title (D3). Later handoffs of that card (Give to agent again, Ask for changes, answering its question) continue that conversation.
- The conversation's first message reads as the user's own request: the card's title, Done when, description and the paths of its files. No machine instructions appear in it; how to report back is in the agent's standing Ritemark context (R8), and the prompt sent to the runtime adds only one line naming the card.
- The card moves to Doing. Its state reads Sending to {agent}… → Queued for {agent} → Working · {agent} on both surfaces; Queued appears only after the sidebar accepted the task.
- **Focus stays where it was.** The AI sidebar keeps the conversation the user had open; the card's conversation appears in its rail as Working. If the AI sidebar is hidden it is shown without taking focus, because the agent runs there.
- **Open conversation** on the card opens and focuses that conversation in the AI sidebar.
- **Stop** on a working card stops that turn; the card says "Stopped" and offers **Give to {agent}** again.
- If Ritemark quits while a card is working, the card says "Interrupted when Ritemark closed" on the next start and offers **Retry**.
- If the card's conversation was deleted, the card says "Conversation no longer available" and **Retry** starts a new one.
- **Doing limit** (Kanban WIP limit, proposed 2026-10-12, shown in the prototype). Doing holds at most N cards (default 3; 1–6 or no limit, set from the Doing header; remembered for this project on this computer). Doing's header shows "3/3" (accent when full, amber when over). When Doing is full, Give to does not start: the card says "Doing is full: 3 of 3" with a link to Your calls and offers **Queue it** (the card stays in To do as "Starts when Doing has room" and starts by itself, in To do order, when a card leaves Doing), **Start anyway** and Cancel. Moving a card into a full Doing by hand is allowed and says it is over the limit. Agents cannot move a card into a full Doing.
- **Conflict guard.** When another card that names the same file is with an agent (sending, queued, working or waiting for the user), Give to does not start. The card says which task works on which file and offers **Wait for it**, **Start now** and Cancel. **Wait for it** shows "Starts after “…”" on the card and starts it with the chosen agent by itself when that other task's turn ends; **Start now** starts at once.

### R6: The result comes back to the card

As a user, I want to see what the agent did on the card itself, so I can review without reading the whole conversation.

Acceptance criteria:
- When the turn ends, the card shows the result: the agent's own report if it called `report_result` in that turn, otherwise a summary of its last message (at most 280 characters, Sprint 117's bound and fallback), plus the project files the turn changed and how long it took.
- **Check these.** The agent's report can name up to three things the user should check (an assumption it made, a gap it left). They show under the result as "Check these", their count shows on the call ("2 to check"), and they are written into the card file.
- The result is written into the card file (it travels with the folder) with a history line "Finished: …".
- A finished card stays in Doing as **Ready to review**: **Mark done** moves it to Done; **Ask for changes…** opens a note box on the card and **Send to {agent} ▾** sends the user's words to the card's conversation, with the agent the user picks.
- **Retry with {agent} ▾** on a failed or interrupted card lets the user pick the agent too.
- A failed turn shows "Failed · {safe reason}" with **Retry**; raw provider errors never appear.
- While the agent waits in the conversation for an approval, an answer or a plan review, the card says "Needs you · approval / question / plan review" with **Open conversation**; when that is answered it says Working again (fix G3). Approvals are never given on the board.

### R7: Your calls

As a user, I want one list of what waits on me, each answered with a button, so a glance tells me whether I am the bottleneck.

Acceptance criteria:
- Your calls lists, in this order and longest-waiting first within each: agents waiting in a conversation (**Open conversation**), decisions an agent left on a card ("Decision for you": one button per option and **Something else…**), results to review (**Mark done**, **Ask for changes…**) and failed handoffs (**Retry**, **Open conversation**). A stopped card is not a call.
- Answering a decision (a button or the user's own words) records "You chose: …" on the card and sends it to the card's conversation as a new turn; the call disappears at once.
- The same calls appear at the top of the side bar and in the Your calls tab, and their count is the activity-bar badge.
- On the Board tab, a card that waits on the user has an accent bar on its left edge and a "Your move" tag (amber when an agent is blocked), and the header shows "3 wait on you · oldest 2h" (with "1 agent blocked" when one is), which opens Your calls.

### R8: Agents read and change the board through tools, the same in all three runtimes

As a user, I want any of my agents to work with the board, so I can say "turn these notes into cards" or "what's next on the board?" in any conversation.

Acceptance criteria:
- With the flag on and a folder open, Claude Code, Codex and OpenCode each get the seven `ritemark_board` tools in [technical-plan.md](./technical-plan.md#w5--agent-tools-in-all-three-runtimes), from one definition.
- Agents cannot mark a card Done, delete a card or edit its history; trying to move a card to Done returns "Only the user marks a card done."
- Board tools need no approval in any autonomy mode; every change they make is a history line on the card.
- Every runtime is told about the board and its tools through the capability context, once (Sprint 101). It also asks agents to put the decisions that would change the result to the user **before** starting long work, and to name in their report what the user should check.
- Browser tools keep their names and behaviour; their three hand-written copies are replaced by the same single definition.

### R9: Ideas

As a user, I want to jot an idea in one line and have an agent tell me whether it is worth doing, so ideas don't clutter my to-do list.

Acceptance criteria:
- Ideas are cards in the Idea stage; the Ideas view is a one-line composer and the list of ideas, with the chips To decide and Dropped. Ideas are also added with `+` on the side bar's and the board's Idea headers.
- **Review with {agent} ▾** (and **Review again with {agent} ▾**) lets the user pick the agent from a dropdown and runs a short, tool-free check with it and shows: a verdict (Good to go / Needs detail / Already on the board / Not a task), one sentence why, a size, and a suggested title and description. It never changes the idea by itself and starts no conversation.
- **Make it a task** moves the idea to the top of To do with the suggested title and description; the original line stays in the card's history.
- **Drop** hides the idea into Dropped; **Bring back** returns it. **Delete…** is the real delete (to the system trash).
- The review is stored on the card and travels with the folder.

### R10: Log

As a user, I want to see what was done and decided, day by day, so I can report on the project.

Acceptance criteria:
- The Log view groups every card's history by day, newest day first: added, moved, given to an agent, finished (with the summary), chosen, marked done, reopened, dropped. Working and waiting changes are left out.
- Each entry links to its card. A deleted card's entries leave the log with it.

### R11: Narrow width and accessibility

Acceptance criteria:
- At 280 px every row's text wraps to two lines before it is cut, and every button row fits on one line (Jarmo's rule).
- Everything is reachable by keyboard; drag and drop has the **Move to…** equivalent; every button has a tooltip; state changes are announced politely without taking focus; reduced motion removes the working pulse.
- Validated at 280 and 420 px side bar, 200 % zoom, high contrast, long titles, three cards working at once.

### R12: Comment tasks and checkboxes stay what they are

Acceptance criteria:
- Comment tasks (Sprint 117) and `- [ ]` checkboxes in documents are unchanged and do not appear on the board (D4).
- The Sprint 117 path gets the fixes it shares with cards: answered approvals return to Working (G3), Codex/OpenCode summaries come from the last message (G4), queued tasks keep their prompt (G5), a failed dispatch is reported (G6).
- Outline and secondary buttons follow the dark theme (F1, found while building the prototype: today they are white and light grey in dark mode).

### R13: Flag and release

Acceptance criteria:
- `task-board` is an experimental, default-on flag; off hides the board as R1 says, injects no tools and adds no capability text.
- No VS Code patch, no `product.json` change, no agent binary change. One new webview package, `@radix-ui/react-tabs` (free, MIT), for the board's tabs. The feature reaches users with the v1.14.0 app release, because the new activity-bar icon file is not part of an extension-only update.

### R14: One meaning for "task"

Acceptance criteria:
- Home's quick action "New AI task" reads "New AI conversation", so "task" in Ritemark means a card on the board (D8). The command it runs is unchanged.

## Non-requirements

- Sync with GitHub Issues, Asana, ClickUp, Monday or any cloud service.
- User-defined columns, labels, priorities, due dates, assignees, WIP limits, dependencies.
- Several boards per folder; boards for the second and later folders of a multi-root workspace (the board belongs to the first folder, as the AI sidebar does).
- Showing comment tasks or document checkboxes on the board; creating cards from a comment or a checkbox.
- Running a card in the background without the AI sidebar (the scheduled-agents daemon), or several agents on one card at once.
- **Autopilot**: agents picking the next card by themselves within a limit the user sets (Jarmo, 2026-10-12: later, its own sprint).
- Notifications outside Ritemark when a card finishes (the multi-window toast idea stays its own item).
- Telling apart several people who share a folder: every person's change reads as "You".

## Resolved questions (proposed; approved with the plan)

- **D1 Storage:** one Markdown file per card in `.ritemark/tasks/`; machine-local handoff records in global storage. Rejected: one JSON file (every change conflicts in Dropbox/git, one damaged write loses the board), SQLite (native dependency, binary in a sync folder).
- **D2 Columns:** fixed Idea / To do / Doing / Done. The stored `stage` is a string, so user columns can come later without migrating files.
- **D3 Destination:** a new conversation per card, not the conversation open in the sidebar. Comments keep Sprint 117's rule (D5 of that sprint), because a comment is a quick ask inside the work you are doing; a card is a separate piece of work that often runs beside others.
- **D4 Comment tasks and checkboxes:** separate in this sprint; candidates for later: "Add to board" from a comment, and comment tasks that need you listed under Your calls.
- **D5 Tool approvals:** board tools run without approval, as browser tools do; agents cannot finish or delete cards.
- **D6 Idea review:** on request, never automatic (it uses the user's agent and its quota). Drop hides an idea; Delete deletes it.
- **D7 Position:** the Tasks button first among Ritemark's own tools, just above Transcribe. (Revised 2026-10-12: the real app lists VS Code's built-in entries between Home and every extension container; right after Home would need a patch 002 change and make the sprint shell-tier.) Declaration order in `package.json`, no patch.
- **D8 Words:** Home's "New AI task" becomes "New AI conversation".
- **D10 Agent choice:** every action that starts agent work names the agent and has a dropdown with Claude Code, Codex and OpenCode (Jarmo, 2026-10-12).
- **D13 Doing limit (proposed 2026-10-12):** Doing holds at most 3 cards by default, set from its header; Give to past the limit offers Queue it or Start anyway; autopilot will later fill free slots up to the same limit.
- **D11 Attention first:** Your calls is the most visible part of both surfaces, with wait times and blocked agents; To do order is priority; Done when, Check these and the conflict guard are in this sprint; autopilot is later (Jarmo, 2026-10-12).
- **D9 Review step:** a finished card waits in Doing as "Ready to review" until the user marks it done; there is no Review column.

## Open questions

None blocking. Phase 0 probes P1–P7 ([technical-plan.md](./technical-plan.md#w0--phase-0-probes-before-any-product-code)) can change how, not what.
