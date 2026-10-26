# The webview bundle (E4, #107)

| | `media/webview.js` |
|---|---|
| Before (main at `b1ac84a7`, rebuilt in this worktree; byte for byte the committed bundle) | 8,611,995 bytes |
| After (this branch) | 8,622,913 bytes |
| Change | +10,918 bytes (+0.13%) |

No dependency was added. The growth is `TurnFailureCard.tsx`, the shared `src/runtime/turnFailureCopy.ts` (sentences and cards for all three AIs), the plan lines and the restored-model logic. `media/office-preview.js` is unchanged.
