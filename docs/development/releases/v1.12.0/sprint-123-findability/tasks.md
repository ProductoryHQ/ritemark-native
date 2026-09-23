# Sprint 123 Tasks

Checklist for [sprint-plan.md](./sprint-plan.md). Tick `[x]` only with a commit
on this branch behind it.

> **Gate:** Phase 0 is done. No code until Jarmo approves the plan.

## Phase 0: Audit (done)

- [x] Record what the transcript, Follow playback and tab labels do today, and whether tabs need a VS Code patch, in `research/current-state-audit.md`. *(2026-09-23 — no patch needed)*

## Phase 1: Transcript search logic

- [ ] A pure module (e.g. `workbench/transcriptSearch.ts`) that finds case-insensitive matches in each segment's *shown* text — plain text, or the word-by-word text when a segment has unsure words.
- [ ] A pure function that splits a segment's text runs (whole text, or per word) at match boundaries, marking which pieces are a match and which is the current one.
- [ ] Tests: counts, order across segments, matches spanning several words, the current-match wrap at the ends, no match, empty query, and letters like õ ä ö ü.

## Phase 2: Search bar and navigation

- [ ] Search field above the transcript with count, Previous / Next (shadcn buttons with tooltips), Enter / Shift+Enter, Escape, "No matches".
- [ ] Highlight in `SegmentText` for both renderings, keeping the unsure-word marking.
- [ ] Going to a match scrolls it into view and pauses Follow playback; Cmd/Ctrl+F focuses the field.
- [ ] "Back to playing line" appears while following is paused during playback and resumes following.

## Phase 3: Tab row

- [ ] Add `workbench.editor.tabSizing: "shrink"` to `contributes.configurationDefaults` in `extensions/ritemark/package.json`.
- [ ] Check on a fresh profile: long names shrink only when the row is full; hover shows the full name; active tab, close buttons and Ctrl+Tab unchanged; browser tabs still show the page title only.

## Phase 4: RunDev validation

- [ ] A long transcript: search, navigate, pause/resume following, play and rename speakers while searching.
- [ ] Keyboard only: Cmd/Ctrl+F, Enter, Shift+Enter, Escape, Tab to the buttons.
- [ ] The tab-row checks from Phase 3 in the running app.

## Phase 5: QA and closeout

- [ ] `npm test` and `./scripts/validate-qa.sh`, results recorded.
- [ ] `docs/CHANGELOG.md`, `docs/releases/v1.12.0/release-notes.md`, and the v1.12.0 test checklist (including a Windows tab-row line for the Windows gate).
- [ ] `docs/development/architecture.md` if the workbench's structure changed.
- [ ] Release-plan tracker row, PR, and close [#283](https://github.com/ProductoryHQ/ritemark-native/issues/283).
