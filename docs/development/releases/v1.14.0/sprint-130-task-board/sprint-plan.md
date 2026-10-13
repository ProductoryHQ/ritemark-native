# Sprint 130 — Task board in your project folder

Track: SDD (auto-detected: fourteen user-facing requirements; multi-component flow board webview ↔ host ↔ project files ↔ AI sidebar ↔ three agent runtimes; concurrent writers on the same files)<br>
Override with: "use plain full track"<br>
Release tier: **extension** by path: everything is under `extensions/ritemark/` plus docs. No VS Code patch, no `product.json`, no `binaries/agents/`, no shell-tier script (the OpenCode tool adapter keeps its output path, so the build checks that name it are untouched). The new activity-bar icon (`media/tasks-icon.svg`) is not part of an extension-only update, so **the feature ships inside the v1.14.0 app release**, as Sprint 128 did inside v1.13.0.<br>
Status: **Phase 3 (DEVELOP) — plan approved by Jarmo 2026-10-12. Phase 0 probes done the same day (none failed, [research/phase-0-probes.md](./research/phase-0-probes.md)); W1–W4 built. The card page (D14, W3b) approved by Jarmo the same day; W3b next, then W5.**<br>
Branch: `sprint-130-task-board`, created from `main` (37c4973f) after the approval and before any code; the plan docs moved here from `docs/sprint-130-task-board-plan`.<br>
Release: v1.14.0 (milestone 13; the release plan file does not exist on `main` yet)<br>
Issue: [#119](https://github.com/ProductoryHQ/ritemark-native/issues/119), decided by Jarmo 2026-10-11 on the Dev Dashboard

## SDD Artifacts

- [design.md](./design.md) — **the UX design, first**: behaviour model, side bar, editor-area board, card, Give to agent, narrow width, state words.
- [prototype/task-board-prototype.html](./prototype/task-board-prototype.html) — clickable prototype built from the real 1.13.0 styles, light and dark (Jarmo asked for it before approving, 2026-10-12).
- [spec.md](./spec.md) — behaviour contract R1–R14 and the decisions D1–D13.
- [scenarios.md](./scenarios.md) — S1–S37 (50 scenarios), the dev-instance QA matrix.
- [technical-plan.md](./technical-plan.md) — workstreams W0–W8, message shapes, files, tests, architecture-gate note.
- [tasks.md](./tasks.md) — implementation checklist.
- [research/current-state-audit.md](./research/current-state-audit.md) — the patterns reused and the gaps (Transcribe, Agent Library, comment tasks, tool injection).
- [research/storage-decision.md](./research/storage-decision.md) — one Markdown file per card, and why not JSON or SQLite.
- [research/phase-0-probes.md](./research/phase-0-probes.md) — P1–P7 results (2026-10-12): none failed; five changes folded into the technical plan.

## Goal

A simple task board in each project folder: capture work in one line, see what waits on you, hand any card to Claude Code, Codex or OpenCode, and get the result back on the card. Local files, no account, no third-party sync.

## Linked issues

- [#119](https://github.com/ProductoryHQ/ritemark-native/issues/119) Task board in your project folder: a simple local board with Give to agent (this sprint)

## Scope

In scope:

- **Tasks** in the activity bar (first of Ritemark's own tools, above Transcribe), its side-bar view, a quick-add command, and a **Task board** tab in the editor area with Your calls, Board, Ideas and Log, modelled on the Dev Dashboard.
- Cards with title, description, the files they name, a fixed stage (Idea, To do, Doing, Done), a short history and the latest agent result; drag and drop plus a keyboard Move to….
- Storage as one Markdown file per card in `.ritemark/tasks/`, written atomically, refreshed from outside edits, a broken file never overwritten.
- **Give to agent**: a new AI-sidebar conversation per card with the chosen runtime, the card's context and file paths; live state on the card; the result written back to the card; review with Mark done or Ask for changes; agent decisions answered with buttons under Your calls.
- Seven `ritemark_board` agent tools in all three runtimes from one definition, by generalising the browser-only tool injection (browser tools keep their names).
- Ideas reviewed on request by a one-shot, tool-free agent call; Make it a task.
- Fixes in the shared Sprint 117 handoff path that cards depend on (G3–G6).
- Home's "New AI task" reads "New AI conversation", so "task" means a board card.
- Flag `task-board` (experimental, default on), architecture.md and the CLAUDE.md locked-decision row. One new webview package, `@radix-ui/react-tabs`, for the board's tabs.

Out of scope: cloud sync of any kind, user-set columns, labels/priorities/dates, several boards per folder, comment tasks or document checkboxes on the board, background runs outside the sidebar, OS notifications. Full list: [spec.md](./spec.md#non-requirements).

## Product decisions (approved by Jarmo 2026-10-12)

- **2026-10-11, D0 — UX shape:** the side bar is the daily glance (an add field, Your calls first, then Doing, To do, Ideas, Done as a list); the editor-area Task board is for planning (columns side by side, tabs Your calls · Board · Ideas · Log); a card opens as a dialog. Settled with the `ux-expert` agent: [design.md](./design.md).
- **2026-10-11, D1 — Storage:** one Markdown file per card in `.ritemark/tasks/`. Readable anywhere, no conflict when two cards change at once in Dropbox or git, one damaged file loses one card. Which conversation a card runs in stays on this computer.
- **2026-10-11, D2 — Columns:** fixed Idea / To do / Doing / Done for now; the file format leaves room for more stages later.
- **2026-10-11, D3 — Where a card's work runs:** a new conversation per card, named after it, continued by every later handoff of that card; handing off never moves focus or switches the conversation you have open. Comment tasks keep going to the open conversation (Sprint 117).
- **2026-10-11, D4 — Comment tasks and checkboxes:** stay separate; a card shows the progress of its own checkboxes. Linking them is a later issue.
- **2026-10-11, D5 — Agent rights:** board tools need no approval; agents cannot mark a card done or delete one.
- **2026-10-11, D6 — Ideas:** reviewed only when the user presses Review; Drop hides an idea, Delete deletes it.
- **2026-10-11, D7 — Position:** the Tasks button right after Home. **Revised 2026-10-12:** first of Ritemark's own tools, just above Transcribe. The real app lists VS Code's built-in entries between Home and every extension container, so right after Home would need a VS Code patch (shell-tier).
- **2026-10-11, D8 — Words:** Home's "New AI task" becomes "New AI conversation", so "task" means a board card.
- **2026-10-12, D10 — Agent choice everywhere:** every action that starts agent work has a dropdown with Claude Code, Codex and OpenCode (Jarmo, on the prototype).
- **2026-10-12, D11 — Attention first:** Your calls is the most visible part of both surfaces, with wait times and blocked agents; To do order is priority (Next up); **Done when**, **Check these** and the **conflict guard** (with Wait for it) are in this sprint (Jarmo: "võta need kolm sprinti 130").
- **2026-10-12, D13 — Doing limit:** Doing holds at most 3 cards by default, set from its header; past the limit Give to offers Queue it or Start anyway. The later autopilot fills free slots up to the same limit. In this sprint (Jarmo: "limit is in").
- **2026-10-12, D14 — A card opens as a page (approved by Jarmo in this session: "card page approved, go ahead"):** Jarmo's direction through the Development manager, "opening a card shows the work, not a form". Clicking a card opens its Markdown file in the editor as a Ritemark document with a slim strip (stage, state, Give to, history); a result to review sits at the top with Mark done and Ask for changes. Replaces the card dialog. Card files are named after the title alone so the tab reads well. Design: [design.md §5](./design.md#5-the-card-page); code: [technical-plan.md W3b](./technical-plan.md).
- **2026-10-13, D15 — Archive, and Done shows four weeks (approved by Jarmo in this session: "yes, build archive like that and keep 28days Done limit also"):** Archive takes a card off the board without deleting it (each card's `…` menu, and Archive all done on the Done column); archived cards are in a collapsed Archived section at the bottom of the Tasks side bar, with Restore and Delete… in each row's `…` menu (revised the same day: a board tab was too prominent). The Done column (and the side bar's Done) shows cards finished in the last 28 days; older ones are in the Log. Agents cannot archive or delete. Delete… asks once, and Enter confirms it. Design: [design.md §4b](./design.md#4b-archive-and-the-done-column).
- **2026-10-12, D12 — Autopilot later:** agents taking the next card by themselves within a user-set limit is its own later sprint (Jarmo: "autopilot hiljem").
- **2026-10-11, D9 — Review step:** a finished card waits in Doing as "Ready to review" until the user presses Mark done; no Review column.

## Success criteria

- [ ] Tasks sits in the activity bar above Transcribe with a badge for Your calls; the side bar works at 280 px; Tasks: Add a Task… captures without leaving the document (R1, R11).
- [ ] One Task board tab with Your calls, Board, Ideas and Log, restored after restart (R2).
- [ ] Cards can be added, edited, moved (drag, Move to…, the stage menu), ticked off, reopened, opened as a page in the editor and deleted to the trash (R3; card page revised 2026-10-12, design.md §5).
- [ ] Each card is one Markdown file in `.ritemark/tasks/`; outside edits show within a second; a broken file is never overwritten (R4).
- [ ] Give to agent works with Claude Code, Codex and OpenCode: a new conversation per card, focus unchanged, honest live state, the result with changed files back on the card, review and follow-ups in the same conversation (R5, R6).
- [ ] Your calls lists every card that waits on the user, in the designed order, each answered with a button, with wait times and blocked agents visible on both surfaces (R1, R7).
- [ ] Cards have Done when; agent reports carry Check these; two agents never start on the same file without the user's say, and Wait for it starts the second one by itself (R3, R5, R6).
- [ ] All three runtimes get the same seven board tools from one definition; browser tools are unchanged for the model (R8).
- [ ] Ideas: one-line capture, review on request, Make it a task, Drop and Bring back (R9); Log by day (R10).
- [ ] Comment tasks behave as before, plus the shared fixes (R12); Home says "New AI conversation" (R14).
- [ ] architecture.md and CLAUDE.md updated; `npm test` green; scenarios S1–S37 run on a dev instance with evidence.

## Size and risk

This is a large sprint: a new subsystem, two new surfaces and a refactor of how agent tools reach the runtimes. No time estimate (house rule). The riskiest parts get a probe before code (W0): enqueueing into a conversation that is not open (P1), Codex tools after a resumed thread (P2), OpenCode permission prompts for tools (P3), one schema for all three runtimes (P4), a final-message summary for Codex/OpenCode (P5), the activity-bar position (P6) and showing a hidden AI sidebar without taking focus (P7). The tool refactor (W5) touches the browser tools that ship today; their names stay the same and S30 checks them in all three runtimes.

If Jarmo prefers smaller merges, W5–W6 (agent tools, idea review) can be split into a Sprint 131 without changing the design: Give to agent still works without board tools, with the result taken from the agent's last message.

## Approval

- [x] Jarmo approved this sprint plan (in this session, in his own words), 2026-10-12: "plan approved. limit is in. and tasks above transcribe is fine!" (D13 Doing limit in; D7 revised position confirmed)
