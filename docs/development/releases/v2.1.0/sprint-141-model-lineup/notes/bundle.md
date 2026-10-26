# Sprint 141 — bundle sizes (E4)

Measured in the sprint worktree, with node_modules cloned from a worktree whose lockfiles are identical to `main`'s.

| File | `main` (84ea15db) | Merge 1 | Change |
|---|---|---|---|
| `media/webview.js` | 8,712,915 | 8,712,931 | +16 bytes (the Flow editor's two model selects, R4) |
| `media/office-preview.js` | 2,610,157 | 2,610,157 | none; rebuilt byte for byte, so the build environment is faithful |

No dependency was added. The Claude Agent SDK moved from 0.3.304 to 0.3.310. It is an esbuild external, so it doesn't count in these bundles.
