# Bundle (E4, S55)

"Before" is the branch's base, `origin/main` at `39b4e37f` (31 October 2026, #602), measured on the committed files on 31 October 2026 before any edit. "After" is filled in at closeout, from each PR's head.

| File | Before | After | Change |
|---|---|---|---|
| `media/webview.js` | 8,727,898 bytes (SHA-256 `3bcb83dd776273b61ac38a22964e20a5b0b64f5b57554fdd376c60d72aa384b6`) | PR 1: 8,728,620 bytes | **+722 bytes** (the review's words for a held import, and the reason through the reducer) |
| `media/office-preview.js` | 2,614,295 bytes | PR 1: 2,614,295 bytes | none (rebuilt byte for byte, so the build environment reproduces `main`'s bundles) |
| `out/extension.js` (built, not committed) | 5,831,588 bytes (a build of the base) | PR 1: 5,841,418 bytes | +9,830 bytes (the guard in `src/editorSync/`) |

PR 1 (#588) changes `src/editorSync/` (the extension host), `webview/src/` for the review's words, and their tests.
