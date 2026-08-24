# Sprint 113 — Transcribe Insights & Speaker Names

**Track:** Full SDD, audit-first<br>
**Status:** Implementation handoff — automated Sprint 113 checks pass; independent QA, manual UI evidence, and post-Sprint-112 rebase remain<br>
**Branch:** `codex/sprint-113-transcribe-insights-output` from `origin/main@db5c475`<br>
**Worktree:** `.worktrees/sprint-113-transcribe-insights-output`<br>
**Issue:** [#208](https://github.com/ProductoryHQ/ritemark-native/issues/208)<br>
**Release:** [v1.10.0](../release-plan.md)

## Goal

Let users generate Transcribe Insights in a language they choose, save them as a separately named new Markdown document, and use readable full speaker names without breaking the transcript layout.

## Why This Is a Separate Sprint

The shipped **Add to document** action sends `workbench:save`, the same path used for the primary transcript, while the Insights prompt implicitly asks in English. Correcting both crosses the webview, typed host messages, persisted session data, prompt construction, Markdown rendering, and filesystem collision boundary. It is kept out of the conversation/runtime sprints so each branch retains one product theme.

## In Scope

- Insights language selector with Auto and at least Estonian/English.
- Validated typed language input, explicit prompt variable, and persisted selected/resolved language.
- Generated prose in the chosen language while verbatim quotes remain source-faithful.
- Dedicated **Create insights document** action with user-chosen filename/location.
- Insights-only Markdown output with provenance, timestamps, and model attribution.
- New-file-only collision behavior and strict isolation from transcript contents, mtime, link, and `session.exportPath`.
- Legacy session, regeneration, cancellation, failure, keyboard, responsive, and cross-platform filename/path coverage.
- Speaker names accept internal spaces and Unicode full names; Workbench playback shortcuts never intercept typing in editable controls.
- Long speaker labels are bounded and ellipsized in the transcript gutter and speaker chips while the full name remains accessible and persists into exports/Insights.
- Architecture, user, changelog, v1.10.0 release, tracker, and evidence updates.

## Explicitly Out of Scope

- Re-transcribing or translating the raw transcript.
- Multiple languages in one Insights generation.
- Updating/deleting previously created Insights files after regeneration/session deletion.
- Expanding the current Insights runtime implementation.
- A new feature flag or changes to primary transcript save behavior.

## Deliverables

1. Approved current-contract and file-safety audit.
2. Language-aware typed generation/persistence contract.
3. Accessible Insights language UI.
4. Dedicated Insights-only Markdown renderer and new-file save handler.
5. Automated/manual Estonian, English, reload, collision, and transcript-isolation evidence.
6. Full-name editing plus long-name ellipsis/accessibility fixes and evidence.
7. Architecture, user, release, and issue documentation.

## Success Criteria

- [ ] The user can generate/regenerate Insights in at least Estonian and English independently from transcript language.
- [ ] The normalized selected/resolved language reaches the prompt explicitly and persists across reload.
- [ ] Quotes stay verbatim and existing timestamp/citation trust behavior passes.
- [ ] The rail no longer sends `workbench:save` or labels its action **Add to document**.
- [ ] Creating an Insights document asks for filename/location and writes a new Insights-only `.md` file.
- [ ] Existing and primary transcript targets cannot be overwritten; success/cancel/collision/failure leave transcript bytes, mtime, link, and `session.exportPath` unchanged.
- [ ] Primary transcript save, runtime readiness, regeneration, cancellation, accessibility, and responsive behavior pass.
- [ ] Names such as `Jarmo Tuisk` can be typed, saved, reloaded, exported, and used in Insights without Space toggling playback.
- [ ] Long names remain single-line and ellipsized in the gutter/chips, preserve transcript alignment, and expose the full accessible name.
- [ ] Architecture, docs, v1.10.0 evidence, tracker, and issue #208 are current.

## Dependencies and Gates

- There is no product dependency on Sprint 112; Jarmo approved parallel implementation in a dedicated worktree. After Sprint 112 merges, rebase this branch and regenerate the shared webview bundle before readiness review.
- Jarmo approves this plan and a dedicated non-`main` branch before implementation.
- Phase 0 approval freezes language/default, persistence, filename, collision, and post-save UX.
- Architecture Gate applies because new webview↔host message types cross the Transcribe subsystem boundary.
- Sprint close requires focused Transcribe tests, manual Estonian/English evidence, and `./scripts/validate-qa.sh`.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Insights still reaches transcript save code | High | Separate message/handler/renderer; assert transcript bytes, mtime, link, and `exportPath`. |
| Collision or path alias overwrites user data | High | Audit first; validate host-side; exclusive new-file write; reject primary/existing targets. |
| UI language is lost or becomes prompt injection | High | Normalized allowlisted code; typed required input; prompt tests. |
| Translation alters verbatim quotes | Medium | Separate prompt rules and fixtures for generated prose versus quotes. |
| Failed regeneration replaces a good result | Medium | Commit session data only after successful parse. |
| Legacy sessions fail after schema extension | Medium | Optional backward-compatible fields and legacy fixtures. |
| Global Space shortcut prevents full-name entry | High | Ignore interactive/editable targets; keyboard regression test with `Jarmo Tuisk`. |
| Long names wrap and displace transcript layout | Medium | Fixed-width/min-width contract, ellipsis on the label span, narrow/zoom visual tests. |

## SDD Artifacts

- [spec.md](./spec.md) — behavior contract and R1–R5 acceptance criteria.
- [scenarios.md](./scenarios.md) — manual/automated behavior matrix.
- [design.md](./design.md) — rail, language-control, copy, and save-dialog UX.
- [technical-plan.md](./technical-plan.md) — architecture and implementation workstreams.
- [tasks.md](./tasks.md) — phase checklist and QA closeout.
- [research/insights-output-contract-audit.md](./research/insights-output-contract-audit.md) — Phase 0 evidence and decision gate.

## Product Decisions

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-22 | Add Sprint 113 to v1.10.0 rather than reopen Sprint 108 | The shipped feature needs a bounded correction with its own branch, tests, and release evidence. |
| 2026-08-22 | Insights always creates a separately named new file | User-owned transcript edits must never be at risk. |
| 2026-08-22 | Insights language is independent from transcription language | The deliverable's audience language need not match the recording. |
| 2026-08-22 | Previously created files are immutable snapshots | Regeneration/session lifecycle must not mutate user-owned documents. |
| 2026-08-22 | Full SDD and Architecture Gate apply | The change crosses persisted state, messages, prompt, and filesystem boundaries. |
| 2026-08-22 | Add R5 full speaker names and bounded display | Real names contain spaces; long labels must not wrap or move the transcript column. |
| 2026-08-24 | Approve parallel kickoff and the Phase 0 output contract | Sprint 113 has no product dependency on Sprint 112. Auto supports detected Estonian/English and falls back to English; legacy Insights retain English provenance; names derive from the linked transcript or recording; writes are exclusive and never overwrite; success offers Open without stealing focus. |

## Implementation Handoff — 2026-08-24

- Focused Sprint 113 extension/webview tests pass, including language allowlisting/resolution, legacy provenance, prompt language and quote fidelity, full Unicode speaker names, interactive-target keyboard guards, Markdown rendering, primary/existing target rejection, exclusive create, and partial-write cleanup.
- Extension compile, extension TypeScript, webview TypeScript, and the production webview build pass. The build retains the repository's standard large-chunk warning; extension esbuild retains the pre-existing duplicate `refresh` case warning in `src/ritemarkEditor.ts`.
- The full extension test chain passes through all unit, Transcribe, and free Save File integration coverage, then fails only in the existing authenticated `ClaudeCodeNodeExecutor.integration.test.ts` environment because the standalone runner cannot resolve the `vscode` module (5 failures, 1 expected error-path pass).
- Independent repository QA and the manual Estonian/English, save-dialog, no-focus-steal, long-name, narrow-width, high-contrast, and 200%-zoom scenarios remain intentionally open.
- Before merge readiness, rebase after Sprint 112 and regenerate `extensions/ritemark/media/webview.js`; do not hand-merge the generated bundle.

## Planning Approval

- [x] Jarmo approves Sprint 113 SDD/design artifacts and parallel delivery order.
- [x] Jarmo approves branch creation.
- [x] Phase 0 file/language contract approved.
- [x] GitHub issue #208 created and assigned to milestone v1.10.0.
