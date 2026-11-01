# Bundle (E4, S55)

"Before" is the branch's base, `origin/main` at `39b4e37f` (31 October 2026, #602), measured on the committed files on 31 October 2026 before any edit. "After" is filled in at closeout, from each PR's head.

| File | Before | After | Change |
|---|---|---|---|
| `media/webview.js` | 8,727,898 bytes (SHA-256 `3bcb83dd776273b61ac38a22964e20a5b0b64f5b57554fdd376c60d72aa384b6`) | PR 1: 8,736,209 bytes | **+8,311 bytes** (R1 as revised: the paragraph review dialog and its words, the paragraphs through the reducer, the merge as one undo step, the `arrows-split` icon; was +722 for #605's first approach) |
| `media/office-preview.js` | 2,614,295 bytes | PR 1: 2,616,941 bytes | +2,646 bytes (the shared `Icon` map's `arrows-split` and the new Tailwind classes the build scans; the Office preview's code is unchanged) |
| `out/extension.js` (built, not committed) | 5,831,588 bytes (a build of the base) | PR 1: 5,879,121 bytes | +47,533 bytes (`src/editorSync/merge.ts`, the reload answer, the merge paths and paragraph conflicts) |

PR 1 (#588) changes `src/editorSync/` (the extension host), `webview/src/` (the paragraph review, the button, the undo step), patch 014 (the shell, not in these bundles) and their tests.
