# The webview bundle (E4, #107)

| | `media/webview.js` |
|---|---|
| Before (main at `b1ac84a7`, rebuilt in this worktree; byte for byte the committed bundle) | 8,611,995 bytes |
| After (this branch) | 8,624,481 bytes |
| Change | +12,486 bytes (+0.14%) |

No dependency was added. The growth is `TurnFailureCard.tsx`, the shared `src/runtime/turnFailureCopy.ts` (sentences and cards for all three AIs), the plan lines, the restored-model logic, and (26 October) the Experience lead's words for every kind with the shared `useReadyAlternative`. `media/office-preview.js` is unchanged.
