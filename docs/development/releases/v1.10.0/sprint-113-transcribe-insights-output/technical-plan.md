# Sprint 113 Technical Plan

## Architecture Overview

The existing Transcript Workbench remains the owning subsystem. The webview collects a normalized language choice and requests generation or document creation; the extension host validates messages, invokes the prompt builder, and exclusively owns filesystem access. The primary transcript exporter remains separate and unchanged.

This adds webview↔host message types, so `docs/development/architecture.md` must be updated before close. No new dependency, runtime, feature flag, or top-level subsystem is planned.

## Workstream 0: Contract Audit (R1–R5)

- Record current `InsightsRail` → `workbench:save` → `_save()` behavior and the prompt's implicit English output.
- Freeze language catalog/Auto fallback, save-dialog default name, stored metadata shape, and collision behavior before code edits.
- Audit Windows-invalid names, path equality/case behavior, symlink/TOCTOU collision considerations, and cleanup after write failure.
- Write findings to `research/insights-output-contract-audit.md`; Jarmo approves ship contract.

## Workstream 1: Language Contract (R1, R2)

### Webview
- `InsightsRail.tsx`: accessible compact language selector using existing Ritemark/shadcn primitives and role tokens.
- `Workbench.tsx`: derive draft selection from session metadata/Auto and send a normalized code with Generate/Regenerate.

### Extension Host
- `transcriptWorkbenchProvider.ts`: validate selected code against one shared catalog before calling generation.
- `speech/insights.ts`: extend `GenerateInsightsOptions` with normalized selected/resolved language.
- `speech/insightsParsing.ts`: make `buildInsightsPrompt` require the resolved language and distinguish generated prose from verbatim quotes.
- `speech/types.ts`: add backward-compatible optional Insights language metadata.

### Tests
- Prompt tests for Estonian, English, Auto resolution, invalid wire value, quote fidelity instructions, reload, and legacy sessions.

## Workstream 2: Insights-Only Markdown (R3)

### Extension Host
- Add focused `speech/insightsMarkdown.ts` for deterministic Insights-only serialization and safe suggested filename generation.
- Add a dedicated host message/handler such as `workbench:createInsightsDocument`; it must not call `_save()` or `saveTranscriptTo()`.
- Use host-side exclusive/new-file semantics after validating `.md`, path inequality with `exportPath`, collision, and filename rules.
- Do not store the new file as `session.exportPath`; remember at most a non-authoritative last directory.
- Open or reveal the newly created file only according to the approved Phase 0 UX; never steal/replace the primary transcript link.

### Tests
- Serializer fixtures, `.md` normalization, invalid names, existing target, primary-path rejection, write failure cleanup, and assertions that transcript bytes/mtime plus `exportPath` are unchanged.

## Workstream 3: UI and Documentation (R3, R4)

- Replace **Add to document** with **Create insights document**.
- Keep the rail calm and dense: Sofia Sans, Ritemark role tokens, existing 10px cards/buttons, one consistent focus ring, no new color vocabulary.
- Verify narrow rail, light/dark/high-contrast, 200% zoom, keyboard, and screen-reader labels.
- Update architecture, `docs/user/features/transcribe.md`, `docs/CHANGELOG.md`, v1.10.0 release notes/checklist, issue #208, and sprint tracker.

## Workstream 4: Speaker Name Editing and Overflow (R5, added 2026-08-22)

### Webview
- `Workbench.tsx`: make the root playback keyboard handler return early for interactive/editable event targets so Space remains text input.
- Keep rename as a normal controlled text input; commit a trimmed, internally whitespace-normalized label and preserve Enter/Escape behavior.
- In `SegmentRow`, keep the speaker gutter fixed and apply a one-line ellipsis (`min-w-0`, `overflow-hidden`, `text-ellipsis`, `whitespace-nowrap`) to the label rather than the whole timestamp column.
- In `SpeakerBar`, bound the chip width, put the label in its own shrinkable/truncated span, keep the color dot/action affordance visible, and expose the full name through `title`/accessible naming.
- Rename popover input and explanatory copy keep the full name; no ellipsis is applied to the editable value.

### Extension Host and Data
- `transcriptWorkbenchProvider.ts`: normalize leading/trailing and repeated internal whitespace while retaining valid spaces and Unicode letters; reject an empty normalized result without overwriting the prior label.
- No schema change is required: `Speaker.label` is already a string and speaker IDs remain stable.

### Tests
- Add focused tests for input-target shortcut suppression, `Jarmo Tuisk`, repeated whitespace, empty rejection, Unicode full names, reload, transcript Markdown, and Insights prompt attribution.
- Add component/manual visual coverage for gutter/chip ellipsis, full-name tooltip/accessibility, narrow width, 200% zoom, and transcript/timestamp alignment.

## Validation

- Focused speech/prompt/Markdown/message plus speaker-name keyboard/normalization tests.
- Webview typecheck and bundle freshness checks.
- Manual scenarios from `scenarios.md` on macOS plus filename/path tests that cover Windows rules.
- `./scripts/validate-qa.sh` before readiness handoff.
