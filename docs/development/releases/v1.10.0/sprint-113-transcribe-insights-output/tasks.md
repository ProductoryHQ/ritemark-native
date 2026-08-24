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
- [ ] Add prompt, invalid-value, Auto, persistence, cancellation/failure, and legacy-session tests.

## Phase 2: Separate Insights Document (R3)

- [x] Add deterministic `speech/insightsMarkdown.ts` serialization and tests.
- [x] Add a dedicated `workbench:createInsightsDocument` message and host handler.
- [x] Add user filename/location selection with `.md` normalization and new-file-only validation.
- [x] Reject collisions, primary transcript path, invalid Windows names, and unsafe/path-alias cases.
- [x] Use exclusive write/cleanup behavior and actionable error messages.
- [ ] Prove the flow does not call transcript save code or mutate `session.exportPath`.

## Phase 3: UI and Integration (R3, R4)

- [x] Replace **Add to document** with **Create insights document**.
- [ ] Verify compact rail layout, Ritemark tokens/primitives, keyboard focus, labels, light/dark/high contrast, narrow width, and 200% zoom.
- [ ] Verify primary transcript Save/Save again, seek/citations, runtime readiness, regeneration, and cancellation regressions.

## Phase 4: Speaker Names (R5, added 2026-08-22)

- [x] Make Workbench playback shortcuts ignore interactive/editable event targets.
- [x] Normalize speaker labels without removing internal spaces or Unicode characters; reject empty results.
- [x] Add one-line ellipsis and bounded width to transcript-gutter and speaker-chip labels.
- [x] Preserve the full name in tooltips, accessible naming, rename input, stored session, transcript Markdown, and Insights prompt.
- [ ] Add keyboard, normalization, persistence, export/prompt, narrow-width, and 200%-zoom regression coverage.

## Phase 5: QA and Closeout

- [x] Run focused extension and webview tests.
- [ ] Execute every scenario in `scenarios.md` and capture Estonian/English, file-isolation, full-name, and ellipsis evidence.
- [ ] Run `./scripts/validate-qa.sh` using the repository QA workflow.
- [x] Update `docs/development/architecture.md` for the new typed messages and language/save contract.
- [x] Update `docs/user/features/transcribe.md`, `docs/CHANGELOG.md`, v1.10.0 release notes, and test checklist.
- [ ] Update issue #208 and the v1.10.0 release tracker.
- [ ] Obtain review, commit, push, PR, and merge approval.
