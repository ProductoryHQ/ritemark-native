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
- [x] ~207 % zoom (Phase 4) found a defect: a long prompt pushed the controls row off the bottom. Fixed — the field is also capped by the room the sidebar column has left after the header, banners, disclosure, chips and controls, so Send stays on screen.
- [x] A drag is recorded only when the press starts on the resize grip; a height that changes because the ceiling moved (zoom, a banner) is never kept. Verified: zoom in, fill, clear, zoom out — the dragged height survives.

## Phase 3: One link policy

- [x] `chatLinks.ts`: web, local path, or `unsupported` (named scheme) by syntax alone; `chatLinkMenu()` is the plan's table in one pure function. The webview has no filesystem access.
- [x] `src/views/chatLinkTargets.ts` (no `vscode` import): resolves a local path with `realpath` into project file / project folder / outside file / outside folder / missing / inaccessible / needs a folder; `isChatLinkActionAllowed` is the only gate, and the host re-resolves before every action.
- [x] `UnifiedViewProvider`: click → open (project file), reveal in the project tree (project folder — was silent), Locate in Finder (outside), or a message (missing, unreadable, no folder); `chat:link/resolve` for the menu; `chat:link-action` for the menu items; `chat:link-unsupported` shows why with **Copy link** (was silent). `openExternal` still takes http/https only.
- [x] `ChatLinkMenu.tsx`: right-click on a link, or Shift+F10 / the Menu key on a focused link, opens the destination's menu; focus returns to the link on close.
- [x] Tests: `chatLinks.test.ts` (classes, named schemes, every menu) and `src/views/chatLinkTargets.test.ts` (confinement, `..`, symlink escape, prefix-sharing sibling, permission error, the action gate, message wording).

## Phase 4: RunDev validation

Readings in [qa-evidence.md](./qa-evidence.md).

- [x] Every row of the link table, in a running dev build, with a real conversation reply. The web link's click was not exercised (it would open a browser on this machine; that path is unchanged), and Finder's window for the outside file could not be observed from the session.
- [x] Header: pin, rename and delete (cancelled) from the menu, keyboard, and History after the refactor. Delete of a *running* conversation ("Stop and delete") is covered by the shared model's test, not exercised live.
- [x] Composer at ~207 % zoom with a long prompt — controls stay on screen (after the fix above). At ~207 % zoom the sidebar is 263 CSS px wide and 340 CSS px tall; the narrowest width the sidebar can be dragged to at 100 % was not set separately.

## Phase 5: QA and closeout

- [x] `npm test` (exit 0; the four new test files ran inside it) and `./scripts/validate-qa.sh` (passed).
- [x] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md` ("Clearer Agent Chat"), and a Sprint 122 block in the v1.12.0 test checklist.
- [x] `docs/development/architecture.md`: new "Agent Chat links and conversation actions (Sprint 122)" section and history row — the link trust boundary and the new sidebar messages are structural.
- [x] Release-plan tracker row and decision rows.
- [ ] PR [#339](https://github.com/ProductoryHQ/ritemark-native/pull/339) opened; merge and close [#282](https://github.com/ProductoryHQ/ritemark-native/issues/282) *(admin merge needs Jarmo's authorization)*.
