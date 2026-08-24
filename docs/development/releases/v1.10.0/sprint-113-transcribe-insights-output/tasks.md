# Sprint 113 Tasks

## Phase 0: Audit and Approval

- [x] Create and complete `research/insights-output-contract-audit.md`.
- [x] Confirm current primary transcript save and implicit-English prompt behavior with code/test evidence.
- [x] Decide language catalog, Auto fallback, suggested filename, stored metadata, collision/race handling, and post-save focus.
- [x] Review `spec.md`, `scenarios.md`, `design.md`, and `technical-plan.md` with Jarmo.
- [x] Obtain explicit Phase 0 approval before implementation.

## Phase 1: Language Contract (R1, R2)

- [x] Add normalized Insights language types/catalog and legacy-safe session metadata.
- [x] Add the accessible language selector to `InsightsRail.tsx` and state wiring to `Workbench.tsx`.
- [x] Carry a validated language through `workbench:generateInsights` and `GenerateInsightsOptions`.
- [x] Require resolved output language in `buildInsightsPrompt` while preserving verbatim quotes.
- [x] Add prompt, invalid-value, Auto, persistence, cancellation/failure, and legacy-session tests.

## Phase 2: Separate Insights Document (R3)

- [x] Add deterministic `speech/insightsMarkdown.ts` serialization and tests.
- [x] Add a dedicated `workbench:createInsightsDocument` message and host handler.
- [x] Add user filename/location selection with `.md` normalization and new-file-only validation.
- [x] Reject collisions, primary transcript path, invalid Windows names, and unsafe/path-alias cases.
- [x] Use exclusive write/cleanup behavior and actionable error messages.
- [x] Prove with focused isolation tests that the flow does not call transcript save code or mutate `session.exportPath`.

## Phase 3: UI and Integration (R3, R4)

- [x] Replace **Add to document** with **Create insights document**.
- [x] Verify compact rail layout, tokens/primitives, keyboard focus, labels, exact narrow/high-zoom geometry, and desktop layout; retain the broad light/dark/high-contrast spoken matrix in the release checklist by owner decision.
- [x] Verify primary transcript isolation, seek/citation contracts, runtime readiness, regeneration, and cancellation through automated plus selected live evidence; retain the broader native matrix in release QA.

## Phase 4: Speaker Names (R5, added 2026-08-22)

- [x] Make Workbench playback shortcuts ignore interactive/editable event targets.
- [x] Normalize speaker labels without removing internal spaces or Unicode characters; reject empty results.
- [x] Add one-line ellipsis and bounded width to transcript-gutter and speaker-chip labels.
- [x] Preserve the full name in tooltips, accessible naming, rename input, stored session, transcript Markdown, and Insights prompt.
- [x] Add keyboard, normalization, persistence, export/prompt, narrow-width, and 200%-zoom regression coverage.

## Phase 5: QA and Closeout

- [x] Run focused extension and webview tests.
- [x] Rebase onto merged Sprint 112 plus review polish at `fb0d3a3` and regenerate the shared webview bundle from the combined source (`8752982`).
- [x] Add DOM-order and narrow responsive-containment regressions for the two first-smoke failures.
- [x] Add viewport-height allocation, bounded rail-scroller, and **Regenerate** focus-ring contracts after the exact `354×300` rerun failure.
- [x] Re-test draft PR #217 language-selector tab order and the exact `354×300` / approximately 207% responsive geometry after the local fixes.
- [x] Run authenticated known-language generation/regeneration; accept custom-language focused contract coverage without another paid model call by explicit owner closure decision.
- [x] Run the final **Create insights document** mutation and inspect the separate Estonian Markdown snapshot without adding it to source control.
- [x] Review the full scenario matrix and capture automated/live known-language, file-isolation, full-name, ellipsis, and performance evidence; defer the residual release-level manual rows explicitly rather than claiming them as executed.
- [x] Run `./scripts/validate-qa.sh` using the repository QA workflow and complete independent full QA.
- [x] Update `docs/development/architecture.md` for the new typed messages and language/save contract.
- [x] Update `docs/user/features/transcribe.md`, `docs/CHANGELOG.md`, v1.10.0 release notes, and test checklist.
- [x] Update the v1.10.0 release tracker.
- [x] Update issue #208 and PR #217 with implementation, QA, and measured performance evidence; merge closes the linked issue.
- [x] Obtain independent review, commit, push, CI, and explicit owner merge approval.

## Phase 6: Any-Language Combobox (R6, added 2026-08-24)

- [x] Replace the three-language allowlist with a legacy-compatible Auto/known/custom typed contract.
- [x] Add local catalog/native-name/code search and safe custom-language normalization without a new dependency.
- [x] Replace the fixed Select with an accessible editable Popover combobox and explicit commit/cancel behavior.
- [x] Keep raw query text out of the wire contract and pass only committed normalized language data to the prompt.
- [x] Add R6 unit/component/protocol/prompt/persistence/high-zoom tests and regenerate `media/webview.js`.
- [x] Re-run focused tests, `./scripts/validate-qa.sh`, and the live RunDev language-selection matrix.

## Phase 7: Insights latency correction (R7, added 2026-08-24)

- [x] Capture authenticated evidence for the multi-minute Latvian generation and separate prompt/result size from model reasoning usage.
- [x] Pin the extraction turn to low thinking effort, remove all built-in tools, and skip coding-agent setting sources without introducing another AI stack or sharing chat context.
- [x] Re-run focused tests, extension compile, webview build, and QA after the correction.
- [x] Verify authenticated regeneration after the user approves the model call; record elapsed time without claiming a network-independent SLA (27.2 s and 15.2 s runs versus the 3m43.5s baseline).
- [x] Update architecture, user docs, changelog, release notes/checklist, issue #208, and PR #217 for the revised contract.
