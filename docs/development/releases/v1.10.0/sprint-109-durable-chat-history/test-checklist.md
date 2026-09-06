# Sprint 109 Manual Test Checklist

Executed 2026-08-23 in run-dev with the `ritemark-demo` project and Claude Sonnet 5.

- [x] Start a new conversation: the first prompt appeared immediately as `Write one sentence about clear project handovers.` while the conversation was Working.
- [x] Wait for the first successful response: the fallback became the four-word title `Clear Project Handover Guidance`.
- [x] Open **All conversations**: all saved project conversations were selectable while the rail remained visible.
- [x] Rename the conversation: `Durable History Across Documents` became `Durable Project Context` in the list and rail without being overwritten.
- [x] Pin and Unpin it: the pin indicator, divider, tooltip, and **Pinned** / **Active & recent** grouping updated correctly in both directions.
- [x] Open several recent conversations: selecting the oldest item left the rail order unchanged.
- [x] Restart run-dev: titles, transcripts, the manually renamed title, and Pinned state returned under `ritemark-demo`.
- [x] Delete a conversation and use Undo: `Project Brief Writing Tips` disappeared, then returned to the rail with the same title and transcript.
- [x] Verify color identity in code/tests: the first 24 project conversations use distinct persisted slots in base → deep → soft rounds; Delete + Undo preserves the original slot and a 25th conversation reuses the least-recently-active slot.
- [x] Verify color identity in run-dev: four visible `ritemark-demo` conversations used four different base hues and retained the same hue in rail, panel, after selection, and after reload.
- [x] Verify lifecycle/recovery in code/tests: running Delete + Undo returns as Interrupted; Project unknown supports explicit Move, Delete and Undo without cross-project access.
- [x] Verify runtime capacity in code/tests: Current/Working/Needs-you sessions are protected, non-current idle sessions release LRU, `parallelChats=false` reduces only live capacity to one, and New remains unlimited.
- [x] Verify 200% zoom: the webview retained all rail actions without horizontal overflow; All conversations remained scrollable and the permanent rail stayed available.
- [x] Verify reduced motion and high contrast: Working pulse and conversation transitions stop under reduced motion; every rail action has a visible forced-colors focus outline.
- [x] Verify keyboard focus: selecting the already-current row closes All conversations and restores focus to the composer textarea with the accessible name `Message`.

Release screenshot evidence: [`docs/releases/v1.10.0/screenshots/`](../../../../releases/v1.10.0/screenshots/).
