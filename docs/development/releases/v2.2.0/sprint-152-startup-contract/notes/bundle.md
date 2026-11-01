# Sprint 152: hunk counts and the webview bundle (E2, E4)

## Before (`origin/main`, `f84f4513`)

- Patch hunks (`grep -c '^@@'`): 002 88, 018 123, 019 55. PR 1 touches no patch.
- `extensions/ritemark/media/webview.js`: 8,749,976 bytes (2,525,831 gzipped), rebuilt byte for byte from `main`'s source.

## After PR 1 (R5)

- `media/webview.js`: 8,754,194 bytes, 4,218 more (after the review round's fixes and the Experience lead's check): the start look's decision (`startLook.ts`), its line and failure
  (`StartingLook.tsx`), and the gate's derivation moved into `sidebarGate.ts`. The turning mark itself is plain HTML and
  CSS in the view's page (`src/views/aiStartingMark.ts`), not in the bundle.
