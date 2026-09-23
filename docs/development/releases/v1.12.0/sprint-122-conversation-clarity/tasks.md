# Sprint 122 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** Phase 0 is done. No code until Jarmo approves the plan.

## Phase 0: Audit (done)

- [x] Read the sidebar, the composer and the link path, and record what each does today in `research/current-state-audit.md`. *(2026-09-23)*

## Phase 1: Active-conversation header

- [ ] Add the header component above the transcript in `UnifiedConversationView.tsx`, showing the active conversation's title.
- [ ] Wire pin/unpin, rename and delete to the existing store actions (`pinConversation`, `unpinConversation`, `renameHostConversation`, `deleteHostConversation`) — same icons, labels, one-pin rule and confirm dialog as `ConversationsPanel.tsx`.
- [ ] Truncate a long title visually while keeping the full string as the accessible name.
- [ ] Unit-test the header's action wiring and the disabled-pin rule against the same expectations as History's tests.

## Phase 2: Resizable composer

- [ ] Replace the `Math.min(el.scrollHeight, 120)` auto-resize in `ChatInput.tsx` with `ResizableComposer` from Sprint 117.
- [ ] Keep Send / Stop / model controls in the composer's footer, outside the scrolling area.
- [ ] Check the minimum supported sidebar width and 200 % zoom in a dev build.

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
