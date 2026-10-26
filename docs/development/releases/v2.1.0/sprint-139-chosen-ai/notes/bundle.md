# The webview bundle (E4, #107)

| | `media/webview.js` |
|---|---|
| Before (main at `53a0456a`, Sprint 140 merged, as committed) | 8,644,137 bytes |
| After (this branch, rebased onto `53a0456a`) | 8,656,665 bytes |
| Change | +12,528 bytes (+0.14%) |

No dependency was added. The growth is `TurnFailureCard.tsx`, the shared `src/runtime/turnFailureCopy.ts` (sentences and cards for all three AIs), the plan lines, the restored-model logic, and (26 October) the Experience lead's words for every kind with the shared `useReadyAlternative`. `media/office-preview.js` is unchanged.
