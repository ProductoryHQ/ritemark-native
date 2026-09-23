# Sprint 123 QA evidence

Dev build from this worktree (`sprint-123-findability`, CoW-cloned VS Code shell,
clean profile), 2026-09-23. Readings come from the running workbench's DOM.

Fixture: a Transcribe session built to the `SessionStore` format — 600 segments over
the hour-long Sprint 118 recording (1:00:32), three speakers, every seventh segment
with word timings and a word the engine was unsure about.

## Transcript search

| Check | Result |
| --- | --- |
| Cmd+F anywhere in the workbench | focus moves to "Search transcript" |
| Type "carrier" | "1 of 160", 160 highlights, the current one scrolled into view |
| Enter | "2 of 160" — and this match is **inside a word the engine was unsure about**; its dotted marking stays |
| Shift+Enter | back to "1 of 160" |
| Shift+Enter again | wraps to "160 of 160"; the smooth scroll reaches it (≈35 000 px) within a second |
| "zebra" | "No matches", no highlights |
| Escape | clears the field and every highlight; a second Escape leaves the field |
| Search while the audio plays (muted for the test) | the first match at or after the playing line ("21 of 120"); following pauses; **Back to playing line** appears |
| Back to playing line | the playing line scrolls into view, following resumes, the button goes |
| Wheel scroll while playing | following pauses and **Back to playing line** appears again |
| Rename a speaker (Karl → Karl Kask) while at "32 of 160" | the name changes everywhere and the search stays at "32 of 160" |
| Layout | the search bar sits above the scrolling lines, flush with the column (bar and column both 0–512 px, same top), opaque; the scroller starts at the bar's bottom |

A first build put the search bar inside the scrolling pane as a sticky header; Jarmo
spotted a top and a right gap and text showing through it. The bar now sits in its
own row above the scroller, the same shape as the Insights rail. Jarmo re-checked:
"nüüd on korras".

## Tab row

| Check | Result |
| --- | --- |
| Default applied on a fresh profile | every tab carries `sizing-shrink` |
| Seven tabs, six with long names | the row fits exactly (800 px wide, no horizontal scroll); each tab 114 px |
| Label | clipped with VS Code's 5 px fade — `text-overflow: clip`, not an ellipsis |
| Hover | shows the file's full path |
| Close button | appears on hover (28 px, visible); **on the active tab too, it appears only on hover** — VS Code's own shrink-mode rule, not a Ritemark change. Cmd+W still closes the active tab |
| Browser tabs | label is the page title (checked earlier today on the same VS Code build: "Example Domain"); they shrink like the others |

## Automated

| Suite | Result |
| --- | --- |
| `transcriptSearch.test.ts` | pass — reading order, case folding (incl. õ ä ö ü and the dotted İ), matches across words, wrap, count, splitting at match boundaries with the unsure-word marking kept |
| `workbenchLayout.test.ts`, `playback.test.ts` | pass |
| webview `tsc --noEmit` | clean |
| `npm test` (full) | pass (exit 0) |
| `./scripts/validate-qa.sh` | pass (exit 0) |

## Not checked here

- Windows: the tab row is VS Code's own behaviour and identical there; it joins the v1.12.0 Windows gate as a checklist line.
- A real multi-speaker recording: the search reads what the session holds, and the fixture has the same shape a transcription produces.
