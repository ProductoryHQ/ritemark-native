# Sprint 123 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** passed — plan approved 2026-09-23.

## Phase 0: Audit (done)

- [x] Record what the transcript, Follow playback and tab labels do today, and whether tabs need a VS Code patch, in `research/current-state-audit.md`. *(2026-09-23 — no patch needed)*

## Phase 1: Transcript search logic

- [x] `workbench/transcriptSearch.ts`: `segmentRuns` (kept in step with `SegmentText`), `findTranscriptMatches` (case folded per character so offsets stay aligned), `stepMatch`, `matchCountLabel`.
- [x] `splitRunsAtMatches`: cuts the shown runs at match boundaries, marking plain / match / current pieces; a word the engine was unsure about stays one run.
- [x] `transcriptSearch.test.ts`: reading order across segments, case, matches across words, non-overlap, wrap, count, õ ä ö ü, the dotted İ, empty and no-match queries, splitting without losing a character.

## Phase 2: Search bar and navigation

- [x] `TranscriptSearchBar.tsx`: field, polite live count, Previous / Next / Clear (shadcn buttons with tooltips), Enter / Shift+Enter, Escape clears then leaves.
- [x] `HighlightedSegmentText` in `Workbench.tsx` renders matches in both segment shapes and keeps the unsure-word marking; segments without matches render exactly as before.
- [x] A new query starts at the first match at or after the playing line; going to a match scrolls it into view and pauses Follow playback; a transcript update (a speaker renamed) keeps the current match. Cmd/Ctrl+F focuses the field.
- [x] "Back to playing line" appears whenever following is paused during playback — after a search or a wheel scroll — and resumes following.
- [x] Layout (Jarmo, on the first build): the bar moved out of the scroller into its own row — `transcriptColumn` / `transcriptSearch` in `layout.ts`, the Insights rail's shape.

## Phase 3: Tab row

- [x] `workbench.editor.tabSizing: "shrink"` in the extension's `configurationDefaults`.
- [x] Fresh profile: seven tabs fit an 800 px row; hover shows the full path. Two details differ from the plan's wording, both VS Code's own shrink-mode rules: names are clipped with a fade rather than an ellipsis, and the close button shows on hover (also on the active tab). Recorded for Jarmo's call.

## Phase 4: RunDev validation

- [x] A 600-segment, one-hour transcript: search, navigate, wrap, pause and resume following, wheel pause — rename a speaker mid-search — see [qa-evidence.md](./qa-evidence.md).
- [x] Keyboard: Cmd+F, Enter, Shift+Enter, Escape twice.
- [x] The tab-row checks from Phase 3 in the running app.

## Phase 5: QA and closeout

- [x] `npm test` and `./scripts/validate-qa.sh`, results recorded.
- [x] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, and the v1.12.0 test checklist (including a Windows tab-row line for the Windows gate).
- [x] `docs/development/architecture.md` if the workbench's structure changed. *(Transcript search section and history row.)*
- [x] Release-plan tracker row. PR [#342](https://github.com/ProductoryHQ/ritemark-native/pull/342) opened; close [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283).
