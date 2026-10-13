# Task Board

> Keep a list of what you want done in each project folder, and hand any task to an agent.

Every project folder gets its own task board. Write down what you want done, give a task to Claude, Codex or OpenCode, and come back when it is ready for you to look at. The board shows what waits on you, so you don't have to remember which agent was doing what.

---

## What You Can Do

- **Write tasks down** in the Tasks side bar or on the board, each with an optional "Done when" line
- **Give a task to an agent** with one button; it runs in its own conversation in the AI sidebar
- **See what waits on you** under **Your calls**: results to review, decisions an agent left you, agents waiting for an approval, and failures
- **Review a result** and either **Mark done** or **Ask for changes…**
- **Jot down ideas** and let an agent say whether one is worth doing
- **Keep the board tidy**: Done shows the last four weeks, and you can archive what you no longer need to see

---

## Opening the board

Click the **Tasks** icon in the activity bar on the left. The side bar lists your tasks:

| Section | What it holds |
|---|---|
| **Your calls** | Tasks that wait on you, the longest-waiting first. Shown only when something waits |
| **Doing** | Tasks being worked on, by you or an agent |
| **To do** | Tasks waiting to start. The top one is marked **Next up** |
| **Ideas** | One-line ideas that are not tasks yet |
| **Done** | Tasks finished in the last four weeks |
| **Archived** | Tasks you put away. Collapsed, at the bottom |

The number on the Tasks icon counts the tasks that wait on you.

For the full board, click **Open the task board** at the top of the side bar. The board has four tabs: **Your calls**, **Board** (the columns), **Ideas** and **Log** (what was done, day by day).

The board needs a project folder. With no folder open, the side bar offers to open one.

---

## Adding a task

- Type the title in **Add a task…** at the top of the side bar and press Enter, or click **+** on a column header on the board
- Or run **Tasks: Add a Task…** from the Command Palette; the task goes to the top of To do and you stay in your document

Click a task to open it as a page. The page is an ordinary Ritemark document: write what you want in the body, add a **Done when** line ("one page, names the three audiences"), and list the files the task is about under **Files**. Agents work better when they know what done looks like.

The strip at the top of the page shows the stage, the state, the main action for that state, **History**, and **More** (…). **Show board** takes you back to the board.

---

## Giving a task to an agent

Press **Give to Claude** (the button names the agent; the arrow next to it lets you pick Claude Code, Codex or OpenCode). The task moves to **Doing** and the agent works on it in a new conversation in the AI sidebar. Your document keeps the focus.

While the agent works, the task says so: **Sending…**, **Queued**, **Working · Claude**. If the agent needs an approval or asks a question in its conversation, the task shows **Needs you** and appears under Your calls. **Open conversation** takes you there.

When the agent finishes, the task stays in Doing as **Ready to review**, with:

- the agent's short account of what it did,
- up to three things it asks you to check,
- the files it changed (Claude only) and how long it took.

Press **Mark done** when you are happy, or **Ask for changes…** to tell the agent what to change. Your words go to the same conversation. Agents never mark a task done and never delete one: those are your calls.

### When a task waits instead of starting

- **Doing is full.** Doing holds at most three tasks at once (change it with the number on the Doing column). When you give a task to an agent while Doing is full, choose **Queue it** (it waits in To do and starts by itself when Doing has room) or **Start anyway**.
- **Two tasks name the same file.** Ritemark won't start a second agent on a file another agent is changing. Choose **Wait for it** (the task starts by itself when the other one finishes) or **Start now**.
- **The AI sidebar is busy.** A task waits until a conversation slot frees up.

If an agent isn't signed in, its button says so and the arrow offers the others.

### Decisions

An agent can leave a decision on a task instead of guessing: a question with two to four options. It appears under Your calls. Pick an option, or choose **Something else…** and write your own answer; it goes back to the agent as a new turn.

---

## Ideas

Ideas are one-line notes that are not tasks yet. Write one in the **Ideas** tab ("Write an idea…") or with **+** on the Ideas header.

Press **Review with Claude** (or pick another agent) and the agent says whether the idea is worth doing:

| Verdict | Meaning |
|---|---|
| **Good to go** | Clear and worth doing |
| **Needs detail** | Needs more detail before anyone can do it |
| **Already on the board** | Another open task already covers it |
| **Not a task** | A note or a wish, not work someone can do |

With the verdict come one sentence why, a size, and a suggested task title and description. A review is a short check: it starts no conversation and never changes the idea by itself.

- **Make it a task** moves the idea to the top of To do with the suggested title. The suggested description goes above your own notes; your notes are kept. The original line stays in the task's history.
- **Drop** hides an idea under **Dropped**; **Bring back** returns it.

---

## Archive and delete

- **Archive** (in a task's … menu) takes a task off the board without deleting it. Archived tasks are listed under **Archived** at the bottom of the side bar; open one and press **Restore** to put it back where it was.
- **Archive all done** on the Done column archives every finished task at once.
- **Delete…** moves the task's file to the system trash. Press Enter or click **Delete** to confirm.

Done shows the last four weeks. Older finished tasks stay in their files and in the **Log**.

---

## Where tasks are kept

Each task is a Markdown file in your project folder, in `.ritemark/tasks/`. The board travels with the folder: commit it to git, sync it, or copy it to another computer.

Which conversation a task runs in is kept on this computer only. On another computer the same tasks show up, but without their running agents.

You can edit a task file in any editor; the board picks up the change. A file the board cannot read is listed under the board with its problem, and is never overwritten.

---

## What agents can do with the board

Agents get tools for the board in every conversation: they can list and read tasks, add tasks to Ideas or To do, move tasks between Ideas, To do and Doing, report a result, and leave you a decision. They cannot mark a task done, archive it or delete it. Ask an agent, for example, to "turn these meeting notes into tasks".

---

## Turning the board off

The board is on by default. To turn it off, set `ritemark.features.task-board` to `false` in Settings (JSON). The task files stay in your folder.
