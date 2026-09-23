# Sprint 122 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** passed — plan approved 2026-09-23, Finder choice included.

## Phase 0: Audit (done)

- [x] Read the sidebar, the composer and the link path, and record what each does today in `research/current-state-audit.md`. *(2026-09-23)*

## Phase 1: Active-conversation header

- [x] `ConversationHeader.tsx`, mounted above the transcript in `AISidebar.tsx` (the column that holds the transcript, not `UnifiedConversationView.tsx`, so it also shows on an empty conversation). Title from the host summary; before the host has saved one, the provisional title, "New conversation" when empty.
- [x] One copy of the action rules: `conversationActionsModel.ts` (five-pin limit, labels, "Stop and delete") and `ConversationDialogs.tsx` (History's rename and delete dialogs, moved unchanged, with a hook that owns their state). History, the thread rail and the header all use them; the store uses the same limit constant.
- [x] Actions behind a ⋮ menu (Jarmo, 2026-09-23): Rename, Pin/Unpin, Delete — History's words and icons. New `ui/dropdown-menu.tsx`; `ui/button.tsx` now forwards its ref so a Button can be a Radix trigger.
- [x] Long titles truncate on screen, the heading keeps the whole string, and a tooltip shows it.
- [x] Every History row button now has a tooltip (rename, delete, move had none).
- [x] `conversationActionsModel.test.ts`: pin state and labels at 0, 4 and 5 pinned, unpin at the limit, running vs idle delete wording, status labels.
- [x] Checked in a dev build: Pin from the menu shows in the rail and the menu then says Unpin; Rename opens History's dialog with focus in the field and the header updates; Delete opens History's dialog and Escape cancels; Enter opens the menu on Rename, ↓ moves, Escape returns focus to ⋮; History still lists, renames and unpins.

## Phase 2: Resizable composer

- [x] `ChatInput.tsx`: the 120 px cap is gone. The field grows with the prompt up to `min(8 lines, 40vh)` and has a vertical resize handle, using `composerBounds` from Sprint 117's `ResizableComposer.tsx` (see Product Decisions for why the bounds, not the component).
- [x] A dragged height is kept for the session per surface (`rememberComposerHeight('agent-chat', …)`); the field never shrinks below it and only grows past it with the text. The comment box's bounds are byte-identical to Sprint 117's, pinned by `composerBounds.test.ts`.
- [x] Send / Stop / model controls stay in their own row below the field, outside the scrolling area.
- [x] Checked in a dev build: a long prompt reaches the 189 px ceiling (8 lines at 13 px) and scrolls, with the controls row visible; after send it returns to the 62 px floor; a real drag took it to 102 px and neither typing nor clearing the text shrank it back.
- [ ] Minimum supported sidebar width and 200 % zoom — Phase 4.

## Phase 3: One link policy

- [ ] Extend `chatLinks.ts` to the four classes: project file, other local target, web URL, unsupported.
- [ ] Add the host outcomes it needs — reveal a folder in the project tree, locate an out-of-project target in Finder, and an explicit message for an unsupported scheme and for a directory (today both are silent).
- [ ] Add the context menu with the destination-specific actions from the plan's table.
- [ ] Unit-test the classifier per class, and test each host outcome through the bridge.
- [ ] Confirm no unsupported scheme reaches `openExternal` and the workspace confinement is unchanged.

## Phase 4: RunDev validation

- [ ] Walk every row of the plan's link table in a running dev build and record what happened.
- [ ] Exercise the header with two or three open conversations, including rename, pin and delete of a running one.
- [ ] Resize the composer at the narrowest sidebar width and at 200 % zoom.

## Phase 5: QA and closeout

- [ ] `npm test` and `./scripts/validate-qa.sh`, results recorded.
- [ ] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, and the v1.12.0 test checklist.
- [ ] Update `docs/development/architecture.md` if the sidebar's structure changed.
- [ ] Release-plan tracker row, PR, and close [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282).
