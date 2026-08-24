# Sprint 113 Phase 0 — Insights Output Contract Audit

**Status:** Approved — implementation may proceed<br>
**Date:** 2026-08-24<br>
**Decision gate:** Jarmo approved the language, filename, collision, persistence, and focus contract on 2026-08-24.

## What Was Inspected

- `webview/src/components/transcribe/workbench/InsightsRail.tsx`
- `webview/src/components/transcribe/workbench/Workbench.tsx`
- `src/transcriptWorkbenchProvider.ts`
- `src/speech/insights.ts`
- `src/speech/insightsParsing.ts`
- `src/speech/autoExport.ts`
- `src/speech/types.ts`
- Sprint 108 spec and current Transcribe user documentation

## Observations

1. **Add to document is not a distinct Insights action.** `InsightsRail` posts `workbench:save`, which the provider routes to `_save()` and `saveTranscriptTo()`.
2. **The save path owns the primary transcript.** It renders the complete transcript, writes/chooses the transcript target, and stores the result as `session.exportPath`. An existing target can be replaced after confirmation.
3. **Insights generation has no language input.** `workbench:generateInsights`, `GenerateInsightsOptions`, and `buildInsightsPrompt(session)` carry no output-language value. Prompt instructions and JSON examples are English.
4. **Language is not stored with Insights.** `TranscriptInsights` records generation time, model, summary, and items only.
5. **The existing trust contract is valuable.** Citation timestamps are resolved to real segments and uncitable items are discarded; quotes are required to be verbatim. Sprint 113 must preserve both.
6. **The webview cannot safely write files.** The locked sandbox boundary requires the extension host to validate and write the new document.
7. **Speaker-name spaces are a webview event-bubbling defect, not a data limitation.** The workbench root handles Space/Left/Right from every descendant; Space from the rename input is prevented and toggles playback. The host trims only outer whitespace, while session JSON, Markdown export, and Insights prompt already support internal spaces.
8. **Long names are unconstrained in two visible surfaces.** The transcript uses a fixed `w-20` speaker gutter but the label has no one-line overflow treatment; speaker chips likewise have no maximum width or truncated label span.

## Initial Decision

**Ship as a separate Full SDD sprint.** A dedicated Insights save handler/renderer and explicit normalized language input are required. Reusing the primary transcript save path is rejected.

## Approved Contract

- Language choices are Auto, Estonian (`et`), and English (`en`). Auto resolves detected Estonian/English and otherwise falls back to English.
- Successful new generations persist selected and resolved language. Pre-Sprint-113 Insights without metadata retain English provenance because the previous prompt was implicitly English; a new regeneration draft defaults to Auto.
- The suggested filename uses the linked transcript basename when available, otherwise the recording basename, and ends in `-insights.md`.
- The host rejects the primary transcript path and aliases, existing targets, Windows-invalid/reserved names, and races. The final write uses exclusive creation and removes a partial file after a failed write.
- Success keeps focus in the rail and uses a notification with an optional **Open** action. Cancel and failure create nothing and do not mutate session/export state.

## Phase 0 Questions to Freeze

- Shared language catalog and Auto fallback when transcript language is unknown.
- Suggested filename basis: recording name or linked transcript name.
- Exact `TranscriptInsights` selected/resolved language fields and legacy fallback.
- Native save-dialog behavior plus host validation for existing/primary targets, Windows-invalid names, case-folded aliases, symlinks, and exclusive creation.
- Whether success opens the new file automatically or offers an **Open** action without stealing focus.

## Required Proof Before Ship

- Primary transcript contents, modification time, workbench link, and `session.exportPath` are unchanged for success, cancel, collision, invalid target, and write failure.
- Estonian and English selected values appear explicitly in prompt-builder tests and survive reload.
- Verbatim quotes remain unchanged when generated prose uses another language.
- Legacy sessions load without schema or UI failure.
- `Jarmo Tuisk` can be typed with Space/arrow editing intact, persists through reload/export/Insights, and long labels stay ellipsized without moving timestamps or transcript text.
