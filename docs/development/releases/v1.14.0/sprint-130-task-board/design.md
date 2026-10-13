# Sprint 130 Design — Task board in your project folder (#119)

**Status:** Approved with the plan by Jarmo, 2026-10-12. Settled with the `ux-expert` agent and the `ritemark-design` skill on 2026-10-11, before the technical plan.<br>
**Prototype:** [prototype/task-board-prototype.html](./prototype/task-board-prototype.html), a clickable HTML prototype (2026-10-12) built from the installed Ritemark 1.13.0: its webview CSS and fonts, VS Code theme variables, measured window chrome, Phosphor icons and a real document view, in light and dark. The card page (§5) was added on 2026-10-12. Where the prototype and this text differ, the prototype is newer, except on the card page, where the build (W3b) settled two details: History opens under the card's files, and a Give to choice appears where Give to was pressed.<br>
**System:** Ritemark Indigo-Editorial<br>
**Scope:** activity-bar entry, side-bar view, editor-area board, the card page, Give to agent and the result coming back, Your calls, Ideas, Log, narrow width, state words. Storage, tools and runtime plumbing are in [technical-plan.md](./technical-plan.md).

## 0. The design in ten lines

- **One object.** A task (card) has a stage: Idea, To do, Doing, Done. Who moves next is derived, never stored.
- **Your calls is a view, not a store.** It lists every card whose next move is yours. Each call belongs to a card.
- **Three panels at once.** Tasks side bar on the left (the daily glance), the document or the Task board in the middle (planning), the AI sidebar on the right (the agent's work).
- **Side bar:** a one-line add field, then Your calls, Doing, To do, Ideas, Done as a vertical list. A card shows once.
- **Board:** four columns in the editor area. Your calls, Board, Ideas and Log are tabs.
- **A card opens as a page.** Clicking a card opens its Markdown file in the editor area: a normal Ritemark document, with a slim strip on top (stage, state, Give to agent, history). When it is Ready to review, the result sits at the top with Mark done and Ask for changes (revised 2026-10-12, §5).
- **Give to {Agent} starts a new conversation named after the card.** Later handoffs of that card continue it. Focus never moves.
- **Every agent action lets the user pick the agent** (Jarmo, 2026-10-12): Give to, Review with, Review again with, Retry with and Send to are one split button. The label names the agent; the caret lists Claude Code, Codex and OpenCode; the last choice becomes the board's default.
- **The agent never finishes a card.** A finished card stays in Doing as "Ready to review" until the user presses Mark done.
- **Replies are a small note box on the card** (Ask for changes…, Something else…). Approvals and questions inside a running turn are answered in the conversation, never on the board.
- **The card uses the AI sidebar's own words and glyphs** for agent state (§10).

Glyph key (wireframes only; the real UI uses Phosphor through `Icon`):

```text
o circle (To do; click = Mark done)   ~ circle-notch (working)      ? question
! shield-check (approval)             = clipboard-text (plan)       @ eye (Ready to review)
x x-circle / x (failed / stopped)     v check-circle / check (done) w warning (interrupted)
k kanban   p pencil-simple   + plus   > caret-right (collapsed)   [...] dots-three (More actions)
```

## 0b. Why the board exists in the long-horizon era (Jarmo and Claude, 2026-10-12)

Agents can run many tasks at once; the user cannot decide and review many at once. So the board's job is not "what do I have to do" but **delegation**: what we want and when it is done (Done when), what agents may do, who has what, and what waits on the user's judgment. Running more agents than the user can review makes every result slower: results go stale, assumptions turn out wrong ten tasks later, two agents overwrite the same file, and quota goes to rework. The right amount of work in flight is the user's review pace.

What this sprint takes from that:

- **Your calls is the most visible thing** on both surfaces, with how long each call has waited and whether an agent is blocked.
- **Done when** on every card, so an agent knows when to stop and the user knows what to check.
- **Check these** in the agent's report: up to three things to look at, so a review takes a minute, not a re-read.
- **Conflict guard**: two agents never start on the same file without the user saying so; **Wait for it** queues the second one.
- **Next up**: the order of To do is the priority.
- Agents are told to ask the decisions that would change the result **before** a long run, not in the middle.

- **Doing limit** (2026-10-12): Doing holds at most 3 cards by default, the classic Kanban rule "stop starting, start finishing". Doing counts both kinds of work in flight: agents working and results waiting on the user. Give to past the limit says "Doing is full: 3 of 3" with **Queue it** (starts by itself when a card leaves Doing), **Start anyway** and ×. The limit is set from the Doing header ("3/3 full ▾": 1–6 or No limit).

Later, in its own sprint: **autopilot**, agents taking the next card by themselves; it fills free Doing slots up to the same limit, in To do order, respecting the conflict guard.

## 1. Behaviour model (estimates)

| Action | How often (estimate) | Thought just before | First wish just after |
|---|---|---|---|
| Jot a task while writing | several times a day | "Don't forget this" | One line in, back to the sentence I was writing |
| Tick off my own task | several times a day | "That's done" | It leaves my attention in one click |
| Check what waits on me | many times a day (about 25 % of window switches are this check, user research 2026-09-23) | "Did it finish? Is it stuck on me?" | See which tasks need me from where I am, open the right one |
| Hand a task to an agent | a few times a day | "An agent can do this part" | Stay where I am, know it arrived, see when it is done |
| Answer an agent | several times a day while agents run | "It is waiting on me" | Answer in one click without losing my place |
| Review a result | after every agent run | "Is this right?" | See what changed; accept in one click, or say what to change |
| Plan the board | about weekly | "What is on my plate, what first?" | See everything side by side, reorder, drop |
| Weigh an idea | about weekly | "Is this worth doing?" | A plain verdict and one click to make it a task or drop it |
| Look back (Log) | weekly, or when reporting to a client | "What did we decide and deliver?" | Day-by-day plain text I can read and copy |

What follows from it: capture must not leave the document (a quick-add command, §3); the side bar answers "what waits on me" before anything else (Your calls first, the badge); handing off must not move focus (§6); planning gets the wide surface (§4).

## 2. Decisions taken in the design

| # | Decision | Why |
|---|---|---|
| 1 | Activity-bar entry **Tasks**, Phosphor `kanban`, badge = number of Your calls | `kanban` reads as "board" and differs from the four neighbours; the badge answers "is it done?" without switching |
| 2 | **Place it first among Ritemark's own tools, just above Transcribe** (revised 2026-10-12) | Measured in the real app: VS Code's built-in entries (File Browser, Search, Source Control, Extensions) always come between Home and the extension containers, and only patch 002 can move a container next to Home. Above Transcribe needs no patch |
| 3 | Side bar = daily glance; editor area = planning | Four columns cannot fit 280–480 px; a glance cannot wait for a tab. Same split as Transcribe |
| 4 | Side bar as vertical sections; **a card shows once**, under the first section that applies (Your calls, else its stage) | Counts add up to what the user sees |
| 5 | "Open board" is an icon button (`kanban`) beside the add field | Transcribe's one-row pattern; a title-bar icon is easy to miss for non-technical users |
| 6 | A card opens as a **page in the editor area**: its own Markdown file in the Ritemark editor, in card mode (revised 2026-10-12; was a dialog) | Opening a card should show the work, not a form (Jarmo). The body is what the agent reads; the editor brings comments, dictation and undo; the side bar stays a list |
| 7 | No "Open as document" (revised 2026-10-12) | The card page is the document. A card file that won't read opens as a plain document |
| 8 | **Every action that starts agent work is the same split button** (Jarmo, 2026-10-12, "igalpool"): **Give to {Agent} ▾**, **Review with {Agent} ▾**, **Review again with {Agent} ▾**, **Retry with {Agent} ▾** and **Send to {Agent} ▾** in the note box. The label names the agent; the caret lists Claude Code, Codex and OpenCode with the reason when one is unavailable. In row menus the same choice is "Give to…", "Review with…", "Retry with…", expanding the three agents in place | The label says where the work goes, so no caption is needed (Sprint 117 picker rule); one primitive, so no surface forgets the choice |
| 9 | Default agent: the last used on this board, else the one the AI sidebar is set to | No new setting |
| 10 | **A new conversation per card**, continued by later handoffs of that card | A card is its own piece of work and often runs beside others. Comments keep Sprint 117's rule (the open conversation) because a comment is a quick ask inside the work you are doing |
| 11 | **Focus stays where it was.** The AI sidebar does not switch: the card's conversation appears in its rail as Working. Only Open conversation opens and focuses it | The wish after handing off is to get on with other work. The card's status line is the proof of receipt |
| 12 | Sending… → Queued → Working, Queued only after the sidebar accepted the task | Honesty (Sprint 117) |
| 13 | A finished card stays in Doing as **Ready to review** | No fifth column: Your calls is the review queue. "Waiting for your review" already means a plan in the AI sidebar |
| 14 | Review buttons **Mark done** and **Ask for changes…**; one shared note box also serves "Something else…" | The Dev Dashboard's own pattern |
| 15 | An agent's decision (`ask_user`) reads **Decision for you**, accent, not amber | The agent is not blocked, so it is not "Needs you" |
| 16 | Approvals and in-turn questions: **Open conversation** only | One approval surface (the unified approval gate) |
| 17 | Ideas are cards in the Idea stage; the Ideas tab shows the same cards with a composer and reviews | A card keeps its id and history when it becomes a task |
| 18 | The side bar's field adds tasks; ideas are added in the Ideas tab and with `+` on the Idea headers | Task capture is daily, idea capture weekly (estimates) |
| 19 | Idea review **on request**: "Review with {Agent} ▾" | It spends the user's agent and quota and needs a signed-in agent; capture must stay free |
| 20 | **Drop** hides an idea into Dropped (Bring back); **Delete…** is the real delete (to the system trash) | Non-technical users cannot find the system trash |
| 21 | Log derived from card history | One history, two views |
| 22 | **Fixed columns** Idea · To do · Doing · Done | Side bar sections, badge and state words read from fixed stages. The first likely request, "Waiting on someone else", is one more stage later, not custom columns |
| 23 | Comment tasks stay separate this sprint | The comment is their source of truth; syncing creates a "which one is real" problem |
| 24 | `- [ ]` in documents stay separate; a card's own description shows "2/5" | A sync would rewrite the user's prose |
| 25 | Quick-add command **Tasks: Add a Task…** (VS Code input box, no default shortcut) | One line in, focus returns to the document |
| 26 | Moving: drag on the board only; **Move to…** in More actions everywhere; the stage menu on the card page | Keyboard and screen-reader path; no drag between side-bar sections |
| 27 | **A new task lands at the top of To do** | The user sees it arrive; reordering is a weekly board activity |
| 28 | **Reopen** on a Done card moves it back to To do | A reopened task is something to do again; Give to agent is one click from there |

## 3. The side bar (daily surface)

Matched to the neighbours (Transcribe, Agent Library, Home): 13 px titles clamped to two lines, 11 px status line, section headers like Transcribe's `Section`, rows with a stretched hit area and a More actions button that shows on hover, focus and while open.

- The add field is `Input`; **Enter adds** to the top of To do and keeps focus; Esc clears.
- **Your calls is a panel**: surface background with hairlines above and below, so it stands out from the side bar; the header is strong ink with "oldest 2h" on the right; an amber line "1 agent can’t continue until you answer" when an agent is blocked. Each call's status line ends with how long it has waited ("Needs you · approval · 12 min", "Ready to review · 2h · 2 to check").
- The top card of To do that can start reads **Next up**.
- Sections: Your calls (hidden when empty, never collapsible), Doing, To do, Ideas (collapsed), Done (collapsed, latest 5, then "Show all N" opens the board). Each section's collapsed state is remembered (`vscode.setState`).
- A plain To do row has no status line. Its leading circle is a ghost icon `Button` that marks it done.

**280 px**

```text
┌────────────────────────────────────┐
│ TASKS                              │
├────────────────────────────────────┤
│ [Add a task…               ]  [k]  │
│                                    │
│ YOUR CALLS · 3                     │
│ @ Tighten the proposal             │
│   summary                          │
│   Ready to review · 2h             │
│   Reworked the evidence and        │
│   cut the intro to 3 lines.        │
│   [Mark done]  [p]                 │
│                                    │
│ ? Pick the audience for the        │
│   workshop                         │
│   Decision for you                 │
│   Which audience is this for?      │
│   [ Executives              ]      │
│   [ Practitioners           ]      │
│   [ Something else…         ]      │
│                                    │
│ ! Clean up the client list         │
│   Needs you · approval             │
│   [Open conversation]              │
│                                    │
│ DOING · 1                          │
│ ~ Draft the Q3 agenda              │
│   Working · Claude                 │
│                                    │
│ TO DO · 4                          │
│ o Send the invoice to Maria        │
│ o Read the new template            │
│ o Book the room for 12 Nov         │
│ o Update the pricing page          │
│                                    │
│ IDEAS · 3                  [+] [>] │
│ DONE · 12                      [>] │
└────────────────────────────────────┘
```

At 280 px "Ask for changes…" is the icon button `[p]` with its tooltip; at 360 px and wider it shows its label.

**420 px** (labels appear; rows are otherwise identical)

```text
┌──────────────────────────────────────────────────────┐
│ TASKS                                                │
├──────────────────────────────────────────────────────┤
│ [Add a task…                                 ]  [k]  │
│                                                      │
│ YOUR CALLS · 3                                       │
│ @ Tighten the proposal summary                       │
│   Ready to review · 2h                               │
│   Reworked the evidence; intro now 3 lines.          │
│   [Mark done]  [Ask for changes…]                    │
│                                                      │
│ ? Pick the audience for the workshop                 │
│   Decision for you                                   │
│   Which audience is this for?                        │
│   [ Executives                         ]             │
│   [ Practitioners                      ]             │
│   [ Something else…                    ]             │
│                                                      │
│ ! Clean up the client list                           │
│   Needs you · approval                               │
│   [Open conversation]                                │
│                                                      │
│ DOING · 1                                            │
│ ~ Draft the Q3 agenda                                │
│   Working · Claude                                   │
│                                                      │
│ TO DO · 4                                            │
│ o Send the invoice to Maria                          │
│ o Read the new template                              │
│ o Book the room for 12 Nov                           │
│                                                      │
│ IDEAS · 3                                    [+] [>] │
│ DONE · 12                                        [>] │
└──────────────────────────────────────────────────────┘
```

**Row menus.** The same list in More actions and the right-click menu, built from one action list (`RowMenus`, exported from `ConversationsPanel.tsx` rather than copied a third time). "Move to…" expands its four stages in place inside the menu (a side-by-side submenu covers the menu at 280–420 px); a disabled item says why in its label. Near the bottom of the side bar the menu opens upward. 

| Card is | Menu |
|---|---|
| To do | Give to… · Move to… · Archive · Delete… |
| Working or queued | Open conversation · Stop · Archive · Delete… (stop the agent first) |
| Needs you, Decision, Ready to review | Open conversation · Mark done · Move to… · Archive · Delete… |
| Failed, Interrupted | Retry with… · Open conversation · Move to… · Archive · Delete… |
| Stopped | Give to… · Open conversation · Move to… · Archive · Delete… |
| Done | Reopen · Open conversation · Archive · Delete… |
| Idea | Review with… · Make it a task · Drop · Archive · Delete… |
| Archived | Restore · Open conversation · Delete… |

"Give to…", "Review with…" and "Retry with…" expand Claude Code, Codex and OpenCode in place, like Move to…; the default agent is checked, an unavailable one says why.

While an agent is working or waiting, the card cannot leave Doing or be marked done; the disabled item says "(the agent is still working)".

## 4. The board (editor area)

One "Task board" tab per window, with the folder name in muted text after the title (it helps the 3–4-window user). It reopens on the last used tab and survives a restart. The editor area is often about 700 px wide with both side bars open, so columns have a 220 px minimum and the board scrolls sideways below about 940 px. Done shows the 10 newest, then "Show all N".

```text
 Task board · client-workshop

 Your calls 3     Board     Ideas 3     Log
                  ─────

 IDEA · 3 [+]                TO DO · 4 [+]               DOING · 3                   DONE · 12
 ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
 │ Offer a half-day       │  │ o Send the invoice     │  │ @ Tighten the proposal │  │ v Book the room        │
 │ version                │  │   to Maria             │  │   summary              │  │   for 12 Nov           │
 │ Not reviewed           │  │                        │  │   Ready to review      │  │   Done Tue             │
 └────────────────────────┘  └────────────────────────┘  └────────────────────────┘  └────────────────────────┘

 ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
 │ Add a client glossary  │  │ o Read the new         │  │ ? Pick the audience    │  │ v Send the agenda      │
 │ page                   │  │   template             │  │   for the workshop     │  │   to the client        │
 │ v Good to go           │  │                        │  │   Decision for you     │  │   Done Mon             │
 └────────────────────────┘  └────────────────────────┘  └────────────────────────┘  └────────────────────────┘

                             ┌────────────────────────┐  ┌────────────────────────┐   Show all 12
                             │ o Update the pricing   │  │ ~ Draft the Q3 agenda  │
                             │   page                 │  │                        │
                             │   2/5                  │  │   Working · Claude     │
                             └────────────────────────┘  └────────────────────────┘

 Tasks are saved in this folder, so they travel with it.
```

- **Header pill** on the right of the title: "3 wait on you · oldest 2h" (accent; amber with "· 1 agent blocked" when an agent is blocked). It opens Your calls.
- **A card that waits on the user** has a 3 px accent bar on its left edge and a "Your move" tag; amber when the agent is blocked. Nothing else on the board uses the left bar.
- No board toolbar. Adding happens where the stage is: `+` on Idea and To do opens a one-line field at the top of that column. Doing and Done cards arrive by moving.
- Column headers: strong ink, uppercase, count. No colour per column. Cards use the Card pattern (hairline, 10 px radius).
- Drag moves a card; the keyboard path is Move to… and the card page's stage menu. A working or waiting card refuses to leave Doing and says why in a polite message.
- The tabs are `ui/tabs.tsx`, shadcn's standard Radix Tabs (§12). The Your calls tab holds the same call rows as the side bar, in one column at most 720 px wide.

## 4b. Archive and the Done column

**Approved by Jarmo, 2026-10-13 (D15).** Delete stays the real delete; Archive is the tidy-up that loses nothing.

- **Archive** is in every card's `…` menu, just above Delete…. It is disabled while an agent works on the card ("Archive (stop the agent first)"); a card waiting to start stops waiting.
- **Archive all done** is an icon button (`archive`) in the Done column's header. One click archives every card in Done; a notice says how many and where they went.
- An archived card leaves the board, the side bar and Your calls, and does not count in Doing. Its file stays, marked `archived: <time>`, and its history gets "Archived". The Log keeps it.
- **The Archive tab** (fifth, after Log) lists archived cards, the most recently archived first: title (opens the card's page), "Archived · Today · was in Done", **Restore** and **Delete…**. Empty: "Nothing archived. Archive a card from its … menu, or all done cards from the Done column."
- An archived card's page shows "Archived" in its strip with **Restore** as the one action; the stage menu is disabled ("The card is archived. Restore it to move it").
- **The Done column shows the last four weeks** (28 days, by when a card was marked done). Below it: "12 finished more than 4 weeks ago · See the Log". The side bar's Done section counts and lists the same four weeks.
- **Delete…** asks once; Enter confirms and Escape cancels.
- Agents cannot archive, restore or delete. `list_cards` leaves archived cards out; `read_card` still reads one and says it is archived.

## 5. The card page

**Revised 2026-10-12** (Jarmo, through the Development manager): opening a card shows the work, not a form. This replaces the card dialog. The rest of the design is unchanged.

**What opens.** Click a card anywhere: a side-bar row, a board tile, a title in Your calls, Ideas or the Log. Its Markdown file opens in the editor area as a normal Ritemark document, in **card mode**.

- The page reuses one tab. The next card you open replaces a page you only looked at; a page you edited stays open. (Ritemark turns VS Code's preview tabs off, so the host does this itself.)
- While its page is the active tab, the card stays highlighted in the side bar.
- Buttons on a row still act in place (Mark done, the options, Give to). Only a click on the card itself opens the page.

**Why a page, not a dialog.**

- The card already is a file, and its body is what the agent reads as the task.
- A dialog covers the document and turns the body into a form field.
- The editor already brings comments, dictation, undo, find, and the AI sidebar's "Active file" context.
- The side bar stays a list, so the next card is one click away.

**Layout, top to bottom**

```text
 tab: tighten-the-executive-summary.md
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Doing v]  @ Ready to review                 [Give to Claude|v] [H] | [C] [M] [...] │  strip, 40 px
├──────────────────────────────────────────────────────────────────────────────┤
│    Tighten the executive summary                                  title (H1)  │
│    DONE WHEN  Five sentences or fewer, with the three recommendations first.  │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │ @ Ready to review · Claude finished in 4m 12s · Open conversation    │   │
│   │ Cut the summary from nine sentences to five and led with the three   │   │
│   │ recommendations. Nothing else changed.                               │   │
│   │ Changed [findings-draft.md]                                          │   │
│   │ Check these                                                          │   │
│   │ • The second recommendation still says “two hubs” without naming… │   │
│   │ [Mark done]  [Ask for changes…]                                      │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│    FILES [findings-draft.md]  + Add files…                                    │
│    ──────────────────────────────────────────────────────────────────────    │
│    Make the summary shorter and lead with the three recommendations.          │
│    Keep the survey numbers.                                    the body       │
└──────────────────────────────────────────────────────────────────────────────┘
 [H] History   [C] Comments   [M] Dictate   [...] More actions
```

1. **Strip.** It takes DocumentHeader's place, with the same height, surface and hairline. Left to right:
   - **Show board** (Jarmo, 2026-10-12): opens the Task board on its Board tab. In a narrow editor it keeps only its icon.
   - the **stage menu** ("Doing ▾": Idea, To do, Doing, Done). It is disabled while an agent works, and its tooltip says why.
   - the **state word** with its glyph (§10). The top To do card reads "Next up".
   - the **one action** that moves the card (table below).
   - **History**: shows the whole history under the card's files, and hides it again.
   - the editor's own **Comments** and **Dictate**.
   - **More actions**: the row menu of §3.
2. **Title.** The page's heading, edited in place. Enter, or leaving the line, saves it to the card. The file keeps its name.
3. **Done when.** One quiet line under the title, edited in place. Placeholder: "What does done look like? One line. Agents finish better with it."
4. **The state's block.** What the card needs from you now, or what the agent is doing. At most one block (table below).
5. **Files.** Chips open each file in its editor in one click. **Add files…** sits at the end. A missing file shows "Missing" and stays.
6. **Body.** The card's Markdown below a hairline: a normal Ritemark document with headings, lists, `- [ ]` checkboxes, links and comments. This is the task description the agent reads.

The front matter belongs to the board and never shows: id, stage, rank, history, the handoff and the result. Properties is hidden in card mode.

| Card state | Block under the title | Strip action |
|---|---|---|
| To do, Doing by hand | none | Give to {Agent} ▾ |
| Stopped | one line: "Stopped by you · Open conversation" | Give to {Agent} ▾ |
| Sending, Queued, Working | one line: glyph, "Working · Claude · Open conversation" | Stop |
| Needs you (approval, question, plan review) | amber: "Waiting for approval · Codex", the sentence, **Open conversation** | — |
| Decision for you | accent: who asked and while doing what, the question, the options in one wrapping row, **Something else…** | — |
| Ready to review | accent: the summary, Changed {files}, Check these, **Mark done**, **Ask for changes…** | — |
| Failed, Interrupted | "Failed · {reason}" and "Earlier work stays in the conversation", with **Retry with {Agent} ▾** | — |
| Waits for another card | why it waits, **Start now**, **Don't wait** | — |
| Queued for room in Doing | "Doing is full (3 of 3)…", **Start anyway**, **Take out of the queue** | — |
| Give to hit a conflict or a full Doing | the warning block of §6b with its three buttons | — |
| Done | quiet: "Done · Tue 14:05 · Claude's result", the summary | Reopen |
| Idea | the review: verdict, why, suggested task, **Make it a task**, **Drop** | Review with {Agent} ▾ |

**Ask for changes…** and **Something else…** open the note box (§3) inside the block. A Give to that hits a conflict or a full Doing shows its choice where Give to was pressed: under the side-bar row, on the board tile, or on the page.

**Saving.**

- Body edits save like any document, with autosave.
- Title, Done when, stage and files go through the board, so the history records them.
- The board never rewrites the body, and the page never rewrites the board's part. In card mode the host keeps the front-matter text exactly as it is and puts the edited body under it. Edits from the page carry no properties.
- While the card is open, a board write goes through the open document. Only the front-matter lines change, so autosave and the board never overwrite each other.

**Tab name.** VS Code names a custom-editor tab after the file (`CustomEditorInput.getName()`). So the tab shows the file name, and new card files are named after the title alone: `tighten-the-executive-summary.md`, with `-2` if that name is taken. There is no id prefix; the id stays in the front matter. Renaming a card later keeps its file name, as with any document.

**Narrow width and zoom.** The page follows the editor. When the strip runs out of room, the state word gives way first, then Comments and Dictate (below about 470 px of editor). The stage menu, the action, History, a save problem and More actions always stay.

**What goes away.**

- The card dialog, and its full-width form in the side bar.
- **Open as document** in More actions: the card is the document now.
- The Stage field and the History list: the strip's stage menu and its History button replace them.

A card file that won't read opens as a plain document, without card mode, so it can be repaired.

## 6. Give to agent and the result coming back

```text
 [Give to Claude | v]
                   ┌──────────────────────────────┐
                   │ v Claude                     │
                   │   Codex                      │
                   │   OpenCode · Sign in required│
                   └──────────────────────────────┘
```

An unavailable agent is disabled in the menu with the reason in its label. After a failed attempt the recovery action (Sign in, Open settings) shows under the button with the existing `messageForRuntimeAvailability` sentence. If no agent is ready, the button reads "Give to agent", disabled, tooltip "Set up Claude, Codex or OpenCode in the AI sidebar first".

1. The user presses **Give to Claude**. The button disables and the card reads "Sending to Claude…".
2. The host accepts the task. The card moves to Doing and reads "Queued for Claude", then "Working · Claude".
3. A new conversation titled with the card's title appears in the AI sidebar's rail as Working. The conversation the user had open stays open; nothing takes focus. If the AI sidebar is hidden it is shown, without focus, because the agent runs there.
4. The conversation's first message reads like the user's own request: the title, the description and the paths of the card's files. No machine instructions are shown: how to report back is in the agent's standing Ritemark context, and the runtime prompt adds only one line naming the card.
5. While running, the card mirrors the conversation: an approval, question or plan review shows "Needs you · …" with Open conversation; once answered it reads Working again.
6. When the turn ends, the card shows a short result (at most 3 lines in rows, in full on the card page), the files the agent changed and how long it took. It stays in Doing as "Ready to review"; Your calls and the badge go up by one.
7. **Mark done** moves it to Done. **Ask for changes…** sends the note to the same conversation; the card reads Working again.
8. On failure the card reads "Failed · {safe reason}" with Retry. Raw provider errors never appear.
9. Give to agent again (after a result, on a Stopped card, or from a reopened card) starts another turn in the same conversation. If that conversation was deleted, the card says "Conversation no longer available" and Retry starts a new one.
10. A card whose conversation is on another computer (a synced folder) shows its result and history; Open conversation is disabled with the reason.

The result is a projection of the conversation's last turn; the conversation owns the detail, as in Sprint 117.

## 6b. Conflict guard and Wait for it

When Give to would start an agent on a file that another card's agent is working on right now, the card shows, in place of its buttons:

```text
┌──────────────────────────────────────────────────────┐
│ ⚠ “Draft the steering committee deck outline” is     │
│   working on findings-draft.md right now. Two agents │
│   changing the same file can overwrite each other’s  │
│   work.                                              │
│   [Wait for it]  [Start now]  [×]                    │
└──────────────────────────────────────────────────────┘
```

**Wait for it** keeps the card in To do with a clock and "Starts after “Draft the steering…”", then starts it with the chosen agent by itself when that turn ends; the history says why. The card page offers **Start now** and **Don’t wait**. A file counts when both cards name it; that is the only signal, so naming files on cards also protects them.

## 7. Your calls

Four kinds. Order: blocked agents (Needs you) first, then decisions, then results and failures, longest-waiting first inside each (D11; the spec R7 is the contract). The badge counts all of them; its tooltip reads "3 tasks need you". Stopped is not a call.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ @ Tighten the proposal summary                    Ready to review · 2h │
│   Claude finished in 4m 12s. Modified 1 file: proposal.md             │
│   Reworked the evidence; intro now 3 lines.                            │
│   [Mark done]  [Ask for changes…]                                      │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ ? Pick the audience for the workshop                  Decision for you │
│   Claude asks: Which audience is this for?                             │
│   [Executives]  [Practitioners]  [Both]  [Something else…]             │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ ! Clean up the client list                       Needs you · approval │
│   The agent is waiting for your approval.                              │
│   [Open conversation]                                                  │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ x Draft the Q3 agenda                    Failed · usage limit reached  │
│   [Retry]  [Open conversation]                                         │
└────────────────────────────────────────────────────────────────────────┘
```

In the side bar the option buttons stack (§3). Clicking a call outside its buttons opens the card. Answering a decision records "You chose: …" on the card and sends it to the card's conversation as a new turn.

## 8. Ideas

A one-line composer ("Write an idea…"), then the ideas. Chips: To decide · Dropped. A review is a one-shot call with no tools, so it creates no conversation.

```text
 [Write an idea…                                                  ]
 To decide 3   Dropped 1

┌────────────────────────────────────────────────────────────────────────┐
│ Offer a half-day version of the workshop                        [...]  │
│ v Good to go · reviewed by Claude 2 min ago                            │
│                                                                        │
│ It reuses material you already have and fits teams that cannot spare   │
│ two days. Risk: it may undercut the full-day price.                    │
│                                                                        │
│ SUGGESTED TASK                                                         │
│ Draft a half-day agenda                                                │
│ First step: decide which modules to cut. How big: small.               │
│                                                                        │
│ [Make it a task]  [Drop]  [Review again]                               │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ Add a client glossary page                                      [...]  │
│ Not reviewed                                                           │
│ [Review with Claude]                                                   │
└────────────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────┐
│ Run a pilot with two clients                                    [...]  │
│ ~ Reviewing · Claude                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

| Stored verdict | Shown as | Glyph |
|---|---|---|
| `ready` | Good to go | `check` |
| `unclear` | Needs detail | `pencil-simple` |
| `already-on-board` | Already on the board | `copy` |
| `not-a-task` | Not a task | `note-pencil` |

- **Make it a task** moves the idea to the top of To do with the suggested title and description; it is the primary button only when the verdict is Good to go.
- **Drop** hides the idea into Dropped, with **Bring back**. **Delete…** is the real delete.
- A failed review says "The review didn't come back. Try again." with Review again.
- In the side bar, the Ideas section expands to idea rows; clicking one opens its card page.

## 9. Log, empty and error states

**Log.** A day rail derived from card history: Added, Moved, Given to {Agent}, {Agent} finished (with the summary), You chose, Marked done, Reopened, Dropped. Working and waiting churn is left out. The card title opens the card. Selectable text; no export in this sprint.

```text
 Today
 |
 o  14:05  Marked done by you
 |         Tighten the proposal summary
 |
 o  13:58  Claude finished (4m 12s)
 |         Tighten the proposal summary
 |         "Reworked the evidence; intro now 3 lines."
 |
 o  09:41  Given to Claude
 |         Draft the Q3 agenda

 Yesterday
 |
 o  17:20  You chose: Executives
 |         Pick the audience for the workshop
```

**Empty states**

```text
┌────────────────────────────────────┐   ┌────────────────────────────────────┐
│ TASKS                              │   │ TASKS                              │
│                                    │   ├────────────────────────────────────┤
│   Open a folder to keep a task     │   │ [Add a task…               ]  [k]  │
│   board                            │   │                                    │
│   Tasks stay in the folder, so     │   │   Nothing here yet.                │
│   they travel with your project.   │   │   Add a task above. If an agent    │
│                                    │   │   could do it, use Give to Claude. │
│   [Open folder…]                   │   └────────────────────────────────────┘
└────────────────────────────────────┘
```

- **No folder open:** as above; nothing is written.
- **First look in a folder:** "Tasks for this project live here. Give any of them to an agent." then the field.
- **Empty Your calls:** "Nothing waits on you." with `check-circle`.
- **Empty columns:** Idea "Ideas an agent can weigh up."; To do "Add a task."; Doing "Tasks you give to an agent show up here."; Done "Finished tasks collect here."
- **Empty Ideas:** "Write one line. An agent can say whether it is worth doing."
- **Empty Log:** "Nothing yet."
- **Flag off:** "The task board is turned off."
- **No agent ready:** Give to agent disabled with its reason (§6).
- **Offline:** everything works except the agent, which shows the runtime's own message.
- **A card file that won't read:** listed under **Couldn't read** at the end of the side bar and below the board's columns, with the parse error. Clicking it opens the file as plain text to repair. Nothing else is affected.

## 10. State vocabulary

Words come from the AI sidebar: rows use the conversation-list words, the card page uses the activity-line sentences. A card's state follows its conversation, so the two always read alike. One pure module (`taskCopy.ts`) holds this table.

| Host state | Row / board card | Card page | Glyph (tone) | Whose move | Primary |
|---|---|---|---|---|---|
| To do, or Doing by hand | — | — | `circle` (neutral; click = Mark done) | You | Give to {Agent} |
| accepting | Sending to {Agent}… | same | `circle-notch` (accent, spins) | Agent | — |
| queued | Queued for {Agent} | same | `clock` (neutral) | Agent | — |
| running | Working · {Agent} | Working · {Agent} | `circle-notch` (accent, spins) | Agent | Stop |
| needs-user: approval | Needs you · approval | Waiting for approval | `shield-check` (amber) | You | Open conversation |
| needs-user: question | Needs you · question | Needs your answer | `question` (amber) | You | Open conversation |
| needs-user: plan review | Needs you · plan review | Waiting for your review | `clipboard-text` (amber) | You | Open conversation |
| decision (`ask_user`) | Decision for you | the question | `question` (accent) | You | option buttons |
| result waiting | Ready to review | Ready to review; "{Agent} finished in 4m 12s" | `eye` (accent) | You | Mark done |
| failed | Failed · {safe reason} | Failed · {first line} | `x-circle` (error) | You | Retry |
| cancelled | Stopped | Stopped | `x` (faint) | You | Give to {Agent} |
| interrupted | Interrupted | Interrupted when Ritemark closed | `warning` (neutral) | You | Retry |
| conversation deleted | Conversation no longer available | same | `warning` (neutral) | You | Retry (starts a new one) |
| Done | Done · Tue | Done · Tue 14:05 | `check-circle` (neutral) | — | Reopen |
| idea, reviewing | Reviewing · {Agent} | same | `circle-notch` (accent, spins) | Agent | — |
| idea, reviewed | Good to go / Needs detail / Already on the board / Not a task | verdict + one sentence | `check` / `pencil-simple` / `copy` / `note-pencil` | You | Make it a task |

Sources: `ai-sidebar/conversationActionsModel.ts` (`conversationStatusLabel`: Working, Needs you, Interrupted), `ai-sidebar/ThreadRail.tsx` (`statusLabel`), `ai-sidebar/activityState.ts` (`presentActivityState`: icons, sentences, "Done in …"), `comment/commentTaskCopy.ts` (Sending…, Queued for X, interrupted lines), `src/runtime/availability.ts` (agent names, sign-in sentences).

Amber stays reserved for "the agent is blocked and waiting for you", as in the sidebar. A result or a decision is accent. Colour is never the only signal: every state has a glyph and a word.

## 11. Buttons and tooltips

Only shadcn `Button` (the leading circle is a ghost icon Button); every button has a Radix tooltip. The whole-row hit area is an invisible button with an aria-label, as in `RecordingRow`.

| Button | Tooltip | If disabled: why |
|---|---|---|
| Open the board (`kanban`) | Open the task board | — |
| Leading circle | Mark “{title}” done | The agent is still working |
| Give to {Agent} | Start a new conversation about this task in the AI sidebar, with {Agent} (later: "Continue this task's conversation with {Agent}") | No agent set up: "Set up Claude, Codex or OpenCode in the AI sidebar first"; while sending: "Sending…" |
| Caret on any agent button | Choose which agent | — |
| Mark done | Move this task to Done | — |
| Ask for changes… | Say what to change. It goes to the same conversation | — |
| Open conversation | Open this task's conversation in the AI sidebar | The conversation is on another computer, or was deleted |
| Stop | Stop the agent. You can give the task again | — |
| Retry with {Agent} | Try this task again with {Agent}, in the same conversation | — |
| Option buttons | Answer “{option}”. {Agent} continues right away | — |
| Something else… | Answer in your own words | — |
| Send to {Agent} (note box) | Send this to {Agent} in the same conversation | Write something first |
| Review with {Agent} / Review again with {Agent} | {Agent} reads this idea and says whether it is worth doing | No agent set up, or "{Agent} is already reviewing this" |
| Make it a task | Move this idea to To do | — |
| Drop | Hide this idea. You can bring it back from Dropped | — |
| Bring back | Show this idea again | — |
| Add files… | Choose files in this folder for the agent to work on | — |
| `+` (Idea / To do headers) | Add an idea / Add a task | — |
| Section header | Show / hide the {N} finished tasks | — |
| More actions | More actions | — |
| Reopen | Move this task back to To do | — |
| Show board (card page) | Show the task board | — |
| Stage menu (card page) | Move this task to another stage | The agent is still working, so the stage can't change |
| History (card page) | Show the history / Hide the history | — |

## 12. What each new element costs

| New element or surface | Why an existing one cannot carry it | Reuses |
|---|---|---|
| Activity-bar container **Tasks** + `kanban` icon + badge | Jarmo's decision (own button). Home is a launcher; the AI sidebar lists conversations, not tasks (many tasks never get an agent; a task outlives its conversation) | Transcribe's registration; the badge sits on a hidden companion tree view so it shows before Tasks is opened (P6) |
| Side-bar view (`tasks-panel`) | A live list with menus is too stateful for Home's static HTML | Transcribe's route and `Section`; `RowMenus` |
| Editor-area **Task board** tab | Columns cannot fit 280–480 px | Settings' panel pattern |
| Add field ×1 + `+` on Idea / To do headers + **Tasks: Add a Task…** | The one daily action, without leaving the document | `ui/input.tsx`, Agent Library's section `+`, VS Code input box |
| Task row, call row | Nothing shows state + who is next + buttons | Transcribe `RecordingRow`, ConversationsPanel `RowMenus` (exported, not copied) |
| Board columns, cards, drag | Nothing like it exists in the webview | Card pattern; native HTML5 drag (as `flows/NodePalette.tsx`); Move to… as the keyboard path |
| `ui/tabs.tsx` | Four peer views with counts; `FilterChip` is a toggle, not a tablist | shadcn's Radix Tabs: **one new webview dependency, `@radix-ui/react-tabs`** (free, MIT, the family the other `ui/` primitives use) |
| Card page (card mode of the Ritemark editor) | Opening a card should show the work (Jarmo, 2026-10-12) | The Ritemark editor and its agent-file mode precedent (`.claude/agents/*.md`); `CardParts`, `AgentSplitButton`, `CardMenu` |
| Agent split button (Give to, Review with, Retry with, Send to) | One primitive so every agent action offers the same choice | `Button` + `DropdownMenu`; Sprint 117 picker rule |
| `taskCopy.ts` | One source of words and glyphs | `presentActivityState`, `commentTaskCopy` pattern |
| Note box | Reply without leaving the card | `Textarea`, `Button` |
| Result block, file chips | — | `FilesSummary` wording ("Modified N files") |
| Idea review block | — | `Pill` for the verdict |
| Log rail | A read view of one history | The Dev Dashboard's Log layout, in Ritemark tokens |
| `kanban` in `iconMap` + `iconography.md` | Name missing today (it exists in `@phosphor-icons/react`) | One change updates both |

Not added: no board toolbar, no filters or search, no score meters, no toast or undo bar, no "Open as document", no card dialog, no second composer, no detail pane, no add on Doing/Done, no new setting, no link back from the AI sidebar to the board, no live activity mirror.

If the sprint must shrink, cut in this order: agent decision rows, drag (Move to… remains), Log, idea review.

## 13. Accessibility and narrow width

- **Keyboard.** Tab order: add field → board button → Your calls rows (row, then its buttons) → section headers → rows. Enter adds a task and keeps focus; Esc clears. Card page: Enter or Space on a row opens it with focus in the page (on the block's first button when the card needs you, else on the title); closing the tab returns focus to the editor group, as for any document. After Give, focus stays on the same button, which changes its label in place. Tabs: arrow keys. Section headers: `aria-expanded`. Every drag has a menu path (Move to…, the Stage field).
- **Screen reader.** A row's name is "{title}, {state line}". Glyphs are `aria-hidden`; the state is always text. One polite live region per surface announces Needs you, Decision for you, Ready to review and Failed once per change; it does not announce Sending, Queued or Working, never moves focus, and coalesces within 2 seconds.
- **Reduced motion.** The spinner is static (glyph plus "Working"). No card-move animation.
- **200 % zoom.** The side bar reflows with no horizontal scroll. The state word never wraps; detail wraps beneath. The card page reflows like any document.
- **Width.** Options stack in the side bar; secondary buttons collapse as in §5; Done shows the last four weeks: 5 in the side bar and 10 on the board, then Show all.
- **Long content.** Titles clamp to 2 lines in rows and cards and show in full on the card page. File names show the base name plus parent folder with a middle ellipsis and the full path in a tooltip. Results: 3 lines in rows, about 1,200 characters on the card page, then "Open conversation for the rest". Option labels are one line with a tooltip.
- **Three working cards.** Each has its own spinner; there is no live activity text, so no ticker. Only Your calls moves the badge.
- **Contrast and high contrast.** The sidebar's tokens (`--r-warning`, `--r-accent`, `--r-error`); glyph plus word carry every state.
- **Pointer.** Every clickable row, card, tab and header gets `cursor: pointer` through the existing global rule in `index.css`.
- **One window per folder.** VS Code opens a folder in one window (a second open focuses the first), so a board is live in one window.

## 14. Decisions for Jarmo

The ones the plan asks him to confirm, with the design's recommendation:

1. A new conversation per task, continued by later handoffs; comments keep going to the open conversation. **Yes.**
2. A finished task waits in Doing as "Ready to review" until you press Mark done; agents never finish or delete a task. **Yes.**
3. Four fixed columns: Idea, To do, Doing, Done. **Yes.**
4. Ideas are reviewed only when you press Review; Drop hides an idea, Delete deletes it. **Yes.**
5. The Tasks button sits first among Ritemark's own tools, just above Transcribe. **Yes** (right after Home would need a VS Code patch, which makes the sprint shell-tier).
6. Comment tasks and document checkboxes stay separate this sprint. **Yes.**
7. Home's "New AI task" becomes "New AI conversation", so "task" means a board card. **Yes** (one string).
8. **A card opens as a page in the editor, not a dialog** (2026-10-12, Jarmo's direction through the Development manager; §5). Card files are named after the title alone, so the tab reads well. **Approved by Jarmo, 2026-10-12** ("card page approved, go ahead").
