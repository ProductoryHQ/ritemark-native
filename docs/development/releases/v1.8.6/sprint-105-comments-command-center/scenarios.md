# Sprint 105 Scenarios (★ = live-validated 2026-08-04)

## Index & badge (R1/R2)
- ★ Badge equals unique comments: 1 anchored (id) + 3 standalone → "Comments (4)"; multi-block same-id counts once (unit)
- ★ Overview: "4 total · 2 assigned · 2 unassigned", per-agent groups Claude·1 / Codex·1 with first-lines
- Adjacent id-less legacy fragments merge; distant same-text comments stay distinct (unit)
- @unknown does not assign (unit)

## Dispatch (R3)
- ★ Confirmation shows "Starts 2 tasks (2 comments) — one per agent"; groups excludable via checkboxes
- ★ Dispatch → ONE ordered task per agent through the Sprint 104 queue: Claude task in a ready Claude thread (ran immediately), Codex task routed to its own thread — active thread never retargeted
- ★ Source comments untouched after dispatch (document text unchanged; markers remain)
- Unassigned comments never sent (bulk collects assigned groups only)

## Status (R4, #165)
- ★ Marker dot lifecycle: (queued→) running → done, pushed from sidebar queue/turn facts via comment:task-status broadcast
- Failed turn → red dot + "Task failed" (unit-covered via finalizeCommentTasks; dot styling verified)
- Removing a queued comment item → 'cleared' → marker returns to neutral (store unit)

## Negative
- Busy runtime: comment task queues in that agent's thread (Sprint 104 store test — never dropped)
- Comment without stable id: sends fine, simply shows no status (rail guards on commentId)
