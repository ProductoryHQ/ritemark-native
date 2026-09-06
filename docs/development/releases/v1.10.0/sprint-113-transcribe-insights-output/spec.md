# Sprint 113 Spec — Transcribe Insights & Speaker Names

## Purpose

Let users generate Transcribe Insights in the language they need and keep them as a separately named Markdown deliverable. The Insights flow must never modify or relink the primary transcript document.

## Principles

- User-owned files are never overwritten implicitly.
- Insights language is independent from transcript and interface language.
- Generated prose may be translated; source quotes remain verbatim.
- The sandboxed webview requests work; the extension host validates and writes files.
- Existing timestamp/citation trust rules remain intact.

## Requirements

### R1: Choose the Insights language

As a user, I want to choose the language of Insights, so the memo is useful to its intended readers.

Acceptance criteria:
- The Insights rail exposes an accessible language selector before Generate and Regenerate.
- Choices include Auto and, at minimum, Estonian and English.
- The choice affects Insights only; it never changes transcription-engine language or raw transcript text.
- Auto resolves from the detected transcript language when known and exposes its resolved value; unknown language has a documented fallback.
- The webview sends a normalized language code from an allowlisted catalog, not arbitrary prompt text.

### R2: Generate and persist language-aware Insights

As a user, I want the selected language to reach the model and survive reopening, so generation is predictable.

Acceptance criteria:
- `workbench:generateInsights` carries the selected language through a typed host contract into `GenerateInsightsOptions` and `buildInsightsPrompt`.
- The prompt explicitly names the output language for summary, decisions, actions, and questions.
- Key quotes remain verbatim from the transcript; owner names and timestamps are not translated.
- The selected and resolved language are stored with successful Insights and restored after workbench reload.
- Regeneration uses the current selection. Cancellation or failure preserves the last successful Insights and its language.
- Legacy sessions without language metadata load safely and use the documented Auto fallback.

### R3: Create a separate Insights document

As a user, I want to name a new Insights file, so my primary transcript remains untouched.

Acceptance criteria:
- The rail action is labelled **Create insights document**; it never sends `workbench:save`.
- A save dialog lets the user choose filename and location and normalizes/requires `.md`.
- The host writes an Insights-only Markdown document with provenance, selected language, summary, grouped items, timestamps, and model attribution.
- The new path must differ from the primary transcript `exportPath` and every existing path. Existing targets require another name or cancellation; replacement is not offered.
- Success, cancel, invalid-name, collision, and write-failure paths leave the primary transcript file contents, modification time, `session.exportPath`, and workbench link unchanged.
- A created Insights file is a user-owned snapshot. Later regeneration or session deletion does not update or delete it.

### R4: Preserve existing Transcribe behavior

As a Transcribe user, I want this correction without regressions to the transcript or trust features.

Acceptance criteria:
- Primary transcript Save/Save again behavior remains unchanged.
- Timestamp filtering and click-to-seek behavior remain unchanged.
- Insights generation remains cancellable and exposes generating/failed states.
- Runtime readiness, model attribution, speaker attribution, and session reload still work.
- Architecture, user documentation, changelog, v1.10.0 release notes, and test checklist describe the new contract.

### R5: Speaker names with spaces and bounded display (added 2026-08-22)

As a user, I want to use a person's real full name without breaking the transcript layout, so speaker attribution stays readable and accurate.

Acceptance criteria:
- Speaker rename accepts internal spaces, including `Jarmo Tuisk`; leading/trailing whitespace is trimmed and repeated internal whitespace is normalized without removing word boundaries.
- Pressing Space inside the rename input inserts a space and never toggles playback. Global workbench playback shortcuts ignore input, select, textarea, button, link, and contenteditable targets.
- Empty or whitespace-only names remain rejected; Enter commits and Escape cancels as before.
- A long speaker name stays on one line inside the fixed speaker gutter and speaker chip, uses `overflow: hidden`, `text-overflow: ellipsis`, and `white-space: nowrap`, and never pushes transcript text or timestamps out of alignment.
- The full untruncated name remains available through a native tooltip and accessible name; rename input/popover content exposes the full editable value.
- Full names, including spaces and non-ASCII letters, persist across reload and pass unchanged into transcript Markdown and Insights prompt speaker attribution.

### R6: Search or enter any Insights language (added 2026-08-24; revises R1)

As a user, I want to search for or enter the language my audience needs, so Insights are not limited to a small product-defined list.

This requirement supersedes R1's fixed allowlisted-code restriction while preserving its separation from transcription language and its explicit Auto behavior.

Acceptance criteria:
- The fixed dropdown becomes one accessible editable combobox. `Auto` remains available and is the initial default.
- Search matches a broad local language catalog by English name, native name, common alias, and ISO/BCP-47 code without case or diacritic sensitivity.
- A user may explicitly choose a normalized custom language or dialect when the catalog has no exact result; the suggestion catalog is not an eligibility gate.
- A custom value is committed only through the explicit **Use “…”** option or Enter. Escape and Tab discard an uncommitted query and preserve the prior selection.
- Custom values are Unicode-normalized, whitespace-normalized, limited to 60 characters, and reject empty values, line breaks, control characters, or strings without a letter.
- The typed wire contract distinguishes Auto, catalog languages, and custom language names. Raw search text is never sent to the host.
- The prompt receives the committed canonical language as a quoted data value and explicitly treats it only as an output-language parameter, never as an instruction.
- Keyboard behavior follows the ARIA editable-combobox pattern: DOM focus stays in the input; Arrow/Home/End navigate options; Enter commits; Escape closes; active options use `aria-activedescendant`.
- The popup stays inside the viewport, works at the existing `354×300` high-zoom gate, uses no flags, and preserves the Ritemark 1 px input border plus 4 px indigo focus ring.

### R7: Keep one-shot Insights generation practical (added 2026-08-24)

As a user, I want Insights to complete like a focused AI extraction rather than a long-running coding task, so a meeting memo does not take several minutes without a product reason.

- Insights keeps the existing authenticated Claude runtime, explicitly removes all built-in tools, and does not load user/project/local coding-agent settings.
- The extraction requests low thinking effort explicitly; provider-controlled adaptive effort must not spend a coding-agent-scale reasoning budget on deterministic transcript summarization.
- This correction adds no provider, API-key path, shared chat context, background queue, or runtime adapter.
- Cancellation, parsing, citation validation, persistence, and the last-successful-result behavior remain unchanged.

## Non-Requirements

- Re-transcribing or translating the raw transcript.
- Multiple output languages in one generation.
- Automatically updating or deleting created Insights documents.
- Expanding Insights to another runtime; current runtime debt stays separate.
- A new feature flag; `transcription-workbench` remains the owning flag.
- Changing speaker IDs, diarization, or automatically deriving names from audio.

## Resolved Questions

- Sprint 113 follows Sprint 112 for delivery hygiene but has no product dependency on Sprints 109–112.
- The save flow refuses collisions instead of offering overwrite.
- Verbatim quotes preserve source language even when surrounding prose uses another language.
- The Architecture Gate applies because new typed webview↔host messages cross the Transcribe subsystem boundary.
- Speaker names are stored as display labels, not identifiers; internal spaces are valid and every constrained display surface uses an ellipsis while preserving the full accessible value.
- The 2026-08-24 scope correction makes the language catalog an autocomplete aid rather than an allowlist. Explicitly committed custom language names are valid prompt parameters after host-side normalization.

## Open Questions

- Whether the save dialog initially suggests `<recording>-insights.md` or `<transcript>-insights.md` remains governed by the approved file contract.
