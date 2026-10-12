# Sprint 130 Design — Task board in your project folder (#119)

**Status:** Approved with the plan by Jarmo, 2026-10-12. Settled with the `ux-expert` agent and the `ritemark-design` skill on 2026-10-11, before the technical plan.<br>
**Prototype:** [prototype/task-board-prototype.html](./prototype/task-board-prototype.html), a clickable HTML prototype (2026-10-12) built from the installed Ritemark 1.13.0: its webview CSS and fonts, VS Code theme variables, measured window chrome, Phosphor icons and a real document view, in light and dark. Where the prototype and this text differ, the prototype is newer.<br>
**System:** Ritemark Indigo-Editorial<br>
**Scope:** activity-bar entry, side-bar view, editor-area board, card detail, Give to agent and the result coming back, Your calls, Ideas, Log, narrow width, state words. Storage, tools and runtime plumbing are in [technical-plan.md](./technical-plan.md).

## 0. The design in ten lines

- **One object.** A task (card) has a stage: Idea, To do, Doing, Done. Who moves next is derived, never stored.
- **Your calls is a view, not a store.** It lists every card whose next move is yours. Each call belongs to a card.
- **Three panels at once.** Tasks side bar on the left (the daily glance), the document or the Task board in the middle (planning), the AI sidebar on the right (the agent's work).
- **Side bar:** a one-line add field, then Your calls, Doing, To do, Ideas, Done as a vertical list. A card shows once.
- **Board:** four columns in the editor area. Your calls, Board, Ideas and Log are tabs.
- **A card opens as a dialog on the board.** In the side bar the same content fills the side bar (the existing narrow-width Dialog rule), so the document stays visible.
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
| 6 | A card opens as a **Dialog** on the board; in the side bar the same content fills it | With both side bars open the editor area is about 650–700 px (estimate): no room for a pane. `Dialog` already goes full-bleed under 640 px |
| 7 | "Open as document" is a More actions item only | An escape hatch (repairing a card that won't read), not a flow |
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
| 26 | Moving: drag on the board only; **Move to…** in More actions everywhere; a Stage field in the dialog | Keyboard and screen-reader path; no drag between side-bar sections |
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

**Row menus.** The same list in More actions and the right-click menu, built from one action list (`RowMenus`, exported from `ConversationsPanel.tsx` rather than copied a third time). "Move to…" expands its four stages in place inside the menu (a side-by-side submenu covers the menu at 280–420 px); a disabled item says why in its label. Near the bottom of the side bar the menu opens upward. A menu opened inside the card dialog uses the z-90 popover layer, so it shows above the dialog (Sprint 126 modal layering).

| Card is | Menu |
|---|---|
| To do | Give to… · Move to… · Open as document · Delete… |
| Working or queued | Open conversation · Stop · Open as document · Delete… (stop the agent first) |
| Needs you, Decision, Ready to review | Open conversation · Mark done · Move to… · Open as document · Delete… |
| Failed, Interrupted | Retry with… · Open conversation · Move to… · Delete… |
| Stopped | Give to… · Open conversation · Move to… · Delete… |
| Done | Reopen · Open conversation · Open as document · Delete… |
| Idea | Review with… · Make it a task · Drop · Open as document · Delete… |

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
- Drag moves a card; the keyboard path is Move to… and the dialog's Stage field. A working or waiting card refuses to leave Doing and says why in a polite message.
- The tabs are `ui/tabs.tsx`, shadcn's standard Radix Tabs (§12). The Your calls tab holds the same call rows as the side bar, in one column at most 720 px wide.

## 5. Card detail

- **On the board:** a `Dialog`, about 560 px wide. Focus returns to the card on close.
- **In the side bar:** the same component, full-bleed.
- The top bar stays in view at 480 px and wider; below that it scrolls with the content, so it cannot eat the side bar at 200 % zoom.

Order, top to bottom:

1. Title (click to edit), More actions, close.
2. State bar: "Your move" or "{Agent}'s move", the status line, then the state's buttons on **one line, primary first**.
3. The state's block: Result, Decision, or nothing. A Result sits above the description.
4. Description: Markdown, rendered to read and a `Textarea` to edit; saves on blur; its `- [ ]` are real checkboxes.
5. Files: **Add files…**; each file opens in its editor; a missing file shows "Missing" and stays.

(Revised 2026-10-12: a **Done when** field, one line, sits above the description. When it is empty, the state bar of a To do card says "Add what done looks like below. Agents finish better with it." The Result block ends with **Check these**, up to three bullets from the agent's report.)
6. Stage field (Idea, To do, Doing, Done).
7. History: the last 5 events, then "Show all N".

Button rows collapse by container width: at 360 px and wider secondary buttons keep their labels; below that they become icon buttons with a tooltip and an accessible name; below 240 px only the primary stays and the rest move to More actions.

**To do**

```text
┌──────────────────────────────────────────────────┐
│ Update the pricing page                [...] [x] │
│ Your move                                        │
│ [Give to Claude | v]                             │
├──────────────────────────────────────────────────┤
│ DESCRIPTION                                      │
│ Refresh the three price tiers and the FAQ.       │
│ [ ] Check the new rate card                      │
│ [x] Update the three tiers                       │
│ FILES                                            │
│ pricing.md · Offers                [Add files…]  │
│ HISTORY                                          │
│ Mon 09:12  Added                                 │
└──────────────────────────────────────────────────┘
```

**Working**

```text
┌──────────────────────────────────────────────────┐
│ Draft the Q3 agenda                    [...] [x] │
│ Claude's move                                    │
│ ~ Working · Claude                               │
│ In “Draft the Q3 agenda” · Open conversation     │
│ [Stop]                                           │
├──────────────────────────────────────────────────┤
│ HISTORY                                          │
│ 09:41  Given to Claude                           │
│ Mon 09:12  Added                                 │
└──────────────────────────────────────────────────┘
```

The board does not mirror the agent's live activity ("Editing agenda.md"); the conversation shows that. This keeps the board's state small and its updates rare.

**Needs you** (the agent is blocked in the conversation)

```text
┌──────────────────────────────────────────────────┐
│ Clean up the client list               [...] [x] │
│ Your move                                        │
│ ! Waiting for approval                           │
│ The agent is waiting for your approval.          │
│ [Open conversation]                              │
└──────────────────────────────────────────────────┘
```

**Decision for you** (the agent left a decision and is not waiting)

```text
┌──────────────────────────────────────────────────┐
│ Pick the audience for the workshop     [...] [x] │
│ Your move                                        │
│ ? Decision for you                               │
│ Claude asks: Which audience is this for?         │
│ [ Executives                                   ] │
│ [ Practitioners                                ] │
│ [ Something else…                              ] │
└──────────────────────────────────────────────────┘
```

Options stack because they are choices, not an action row. Each is one line (2–4 options, at most 80 characters; longer ones truncate with a tooltip). "Something else…" opens the note box in place.

**Ready to review**

```text
┌──────────────────────────────────────────────────┐
│ Tighten the proposal summary           [...] [x] │
│ Your move                                        │
│ @ Ready to review                                │
│ Claude finished in 4m 12s · Open conversation    │
│ [Mark done]  [Ask for changes…]                  │
├──────────────────────────────────────────────────┤
│ RESULT                                           │
│ Reworked the evidence section and cut the        │
│ intro to three lines. Nothing else changed.      │
│ Modified 1 file  [proposal.md]                   │
└──────────────────────────────────────────────────┘
```

**Ask for changes…** and **Something else…** open the same note box in place: a label ("What should change?" or "Your answer"), a three-row `Textarea`, and `[Send] [Cancel]` on one row. Cmd/Ctrl+Enter sends, Esc cancels. Send's tooltip: "Send this to Claude in the same conversation". The card returns to Working. Plain text, no attachments; Open conversation is the way to more.

**Failed** (Stopped is the same with `x`, "Stopped" and **Give to Claude** as primary; Interrupted uses `w` and **Retry**)

```text
┌──────────────────────────────────────────────────┐
│ Draft the Q3 agenda                    [...] [x] │
│ Your move                                        │
│ x Failed · usage limit reached                   │
│ [Retry]                                          │
│ Earlier work stays in the conversation.          │
└──────────────────────────────────────────────────┘
```

**Done**

```text
┌──────────────────────────────────────────────────┐
│ Draft the Q3 agenda                    [...] [x] │
│ v Done · Tue 14:05                               │
│ [Reopen]                                         │
├──────────────────────────────────────────────────┤
│ RESULT                                           │
│ Drafted a 3-hour agenda in agenda.md.            │
│ Modified 1 file  [agenda.md]                     │
└──────────────────────────────────────────────────┘
```

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
6. When the turn ends, the card shows a short result (at most 3 lines in rows, more in the dialog), the files the agent changed and how long it took. It stays in Doing as "Ready to review"; Your calls and the badge go up by one.
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

**Wait for it** keeps the card in To do with a clock and "Starts after “Draft the steering…”", then starts it with the chosen agent by itself when that turn ends; the history says why. The card's detail offers **Start now** and **Don’t wait**. A file counts when both cards name it; that is the only signal, so naming files on cards also protects them.

## 7. Your calls

Four kinds. Order: blocked agents (Needs you) first, then decisions, then results and failures, newest first inside each. The badge counts all of them; its tooltip reads "3 tasks need you". Stopped is not a call.

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
- In the side bar, the Ideas section expands to idea rows; clicking one opens the same content full-bleed.

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
- **A card file that won't read:** "Couldn't read this card" with Open as document. Nothing else is affected.

## 10. State vocabulary

Words come from the AI sidebar: rows use the conversation-list words, the card dialog uses the activity-line sentences. A card's state follows its conversation, so the two always read alike. One pure module (`taskCopy.ts`) holds this table.

| Host state | Row / board card | Dialog | Glyph (tone) | Whose move | Primary |
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

## 12. What each new element costs

| New element or surface | Why an existing one cannot carry it | Reuses |
|---|---|---|
| Activity-bar container **Tasks** + `kanban` icon + badge | Jarmo's decision (own button). Home is a launcher; the AI sidebar lists conversations, not tasks (many tasks never get an agent; a task outlives its conversation) | Transcribe's registration, `view.badge` |
| Side-bar view (`tasks-panel`) | A live list with menus is too stateful for Home's static HTML | Transcribe's route and `Section`; `RowMenus` |
| Editor-area **Task board** tab | Columns cannot fit 280–480 px | Settings' panel pattern |
| Add field ×1 + `+` on Idea / To do headers + **Tasks: Add a Task…** | The one daily action, without leaving the document | `ui/input.tsx`, Agent Library's section `+`, VS Code input box |
| Task row, call row | Nothing shows state + who is next + buttons | Transcribe `RecordingRow`, ConversationsPanel `RowMenus` (exported, not copied) |
| Board columns, cards, drag | Nothing like it exists in the webview | Card pattern; native HTML5 drag (as `flows/NodePalette.tsx`); Move to… as the keyboard path |
| `ui/tabs.tsx` | Four peer views with counts; `FilterChip` is a toggle, not a tablist | shadcn's Radix Tabs: **one new webview dependency, `@radix-ui/react-tabs`** (free, MIT, the family the other `ui/` primitives use) |
| Card dialog | — | `Dialog*`, full-bleed under 640 px |
| Agent split button (Give to, Review with, Retry with, Send to) | One primitive so every agent action offers the same choice | `Button` + `DropdownMenu`; Sprint 117 picker rule |
| `taskCopy.ts` | One source of words and glyphs | `presentActivityState`, `commentTaskCopy` pattern |
| Note box | Reply without leaving the card | `Textarea`, `Button` |
| Result block, file chips | — | `FilesSummary` wording ("Modified N files") |
| Idea review block | — | `Pill` for the verdict |
| Log rail | A read view of one history | The Dev Dashboard's Log layout, in Ritemark tokens |
| `kanban` in `iconMap` + `iconography.md` | Name missing today (it exists in `@phosphor-icons/react`) | One change updates both |

Not added: no board toolbar, no filters or search, no score meters, no toast or undo bar, no "Open as document" button, no second composer, no detail pane, no add on Doing/Done, no new setting, no link back from the AI sidebar to the board, no live activity mirror.

If the sprint must shrink, cut in this order: agent decision rows, drag (Move to… remains), Log, idea review.

## 13. Accessibility and narrow width

- **Keyboard.** Tab order: add field → board button → Your calls rows (row, then its buttons) → section headers → rows. Enter adds a task and keeps focus; Esc clears. Dialog: focus trap; first focus is the primary action when the state needs the user, else the title; Esc closes and returns focus to the row. After Give, focus stays on the same button, which changes its label in place. Tabs: arrow keys. Section headers: `aria-expanded`. Every drag has a menu path (Move to…, the Stage field).
- **Screen reader.** A row's name is "{title}, {state line}". Glyphs are `aria-hidden`; the state is always text. One polite live region per surface announces Needs you, Decision for you, Ready to review and Failed once per change; it does not announce Sending, Queued or Working, never moves focus, and coalesces within 2 seconds.
- **Reduced motion.** The spinner is static (glyph plus "Working"). No card-move animation.
- **200 % zoom.** The side bar reflows with no horizontal scroll. The state word never wraps; detail wraps beneath. The dialog is full-bleed.
- **Width.** Options stack in the side bar; secondary buttons collapse as in §5; Done shows 5 in the side bar and 10 on the board.
- **Long content.** Titles clamp to 2 lines in rows and cards and show in full in the dialog. File names show the base name plus parent folder with a middle ellipsis and the full path in a tooltip. Results: 3 lines in rows, about 1,200 characters in the dialog, then "Open conversation for the rest". Option labels are one line with a tooltip.
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
