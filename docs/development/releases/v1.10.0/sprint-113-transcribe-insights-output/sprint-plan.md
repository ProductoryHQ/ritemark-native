# Sprint 113 — Transcribe Insights & Speaker Names

**Track:** Full SDD, audit-first<br>
**Status:** R6 implementation and live autocomplete smoke pass; independent review and PR update in progress<br>
**Branch:** `codex/sprint-113-transcribe-insights-output`, current `main@faba032` integrated at `38f0091`<br>
**Worktree:** `.worktrees/sprint-113-transcribe-insights-output`<br>
**Issue:** [#208](https://github.com/ProductoryHQ/ritemark-native/issues/208)<br>
**Release:** [v1.10.0](../release-plan.md)

## Goal

Let users generate Transcribe Insights in a language they choose, save them as a separately named new Markdown document, and use readable full speaker names without breaking the transcript layout.

## Why This Is a Separate Sprint

The shipped **Add to document** action sends `workbench:save`, the same path used for the primary transcript, while the Insights prompt implicitly asks in English. Correcting both crosses the webview, typed host messages, persisted session data, prompt construction, Markdown rendering, and filesystem collision boundary. It is kept out of the conversation/runtime sprints so each branch retains one product theme.

## In Scope

- Insights language autocomplete with Auto, broad catalog search, and explicit custom language/dialect entry.
- Validated typed language input, explicit data-only prompt variable, and persisted selected/resolved language.
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
3. Accessible any-language Insights autocomplete UI.
4. Dedicated Insights-only Markdown renderer and new-file save handler.
5. Automated/manual catalog, custom-language, reload, collision, and transcript-isolation evidence.
6. Full-name editing plus long-name ellipsis/accessibility fixes and evidence.
7. Architecture, user, release, and issue documentation.

## Success Criteria

- [ ] The user can search or explicitly enter any audience language and generate/regenerate Insights independently from transcript language.
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

- There is no product dependency on Sprint 112; Jarmo approved parallel implementation in a dedicated worktree. The branch now includes merged Sprint 112 and current `main@faba032` through merge commit `38f0091`; the shared webview bundle is regenerated from that combined source.
- Jarmo approves this plan and a dedicated non-`main` branch before implementation.
- The original Phase 0 language allowlist is superseded by Jarmo's 2026-08-24 R6 any-language decision; persistence, filename, collision, and post-save UX remain frozen.
- Architecture Gate applies because new webview↔host message types cross the Transcribe subsystem boundary.
- Sprint close requires focused Transcribe tests, manual known/custom-language evidence, and `./scripts/validate-qa.sh`.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Insights still reaches transcript save code | High | Separate message/handler/renderer; assert transcript bytes, mtime, link, and `exportPath`. |
| Collision or path alias overwrites user data | High | Audit first; validate host-side; exclusive new-file write; reject primary/existing targets. |
| UI language is lost or custom text becomes prompt injection | High | Discriminated committed value; query never crosses the bridge; host normalization; quoted data-only prompt field; prompt tests. |
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
| 2026-08-24 | Replace the fixed language allowlist with an any-language autocomplete (R6) | Insights language is only an output parameter. Auto stays available, catalog search speeds common choices, and explicit normalized custom input covers any language or dialect without sending raw query text. |
| 2026-08-24 | Bound Insights extraction to low thinking effort (R7) | The authenticated Latvian run took about 3m44s and spent 15,836 output tokens for a ~2,900-character result. Keep the existing no-tools Claude path, but do not let a deterministic memo extraction use an open-ended coding-agent reasoning budget. |

## Implementation Handoff — 2026-08-24

- Focused Sprint 113 extension/webview tests pass, including typed language selection/resolution, catalog search, normalized custom input, legacy provenance, prompt language and quote fidelity, full Unicode speaker names, interactive-target keyboard guards, Markdown rendering, primary/existing target rejection, exclusive create, and partial-write cleanup.
- Extension compile, extension TypeScript, webview TypeScript, and the production webview build pass. The build retains the repository's standard large-chunk warning; extension esbuild retains the pre-existing duplicate `refresh` case warning in `src/ritemarkEditor.ts`.
- Independent full QA completed after the exact quote-membership P1 fix; repository `./scripts/validate-qa.sh`, extension compile, webview typecheck/build, and focused Sprint 112–113 regressions pass with no remaining automated blocker.
- The branch includes merged Sprint 112 and current `main@faba032` through merge commit `38f0091`; `extensions/ritemark/media/webview.js` is rebuilt from the combined source before each readiness handoff.
- Manual authenticated known/custom-language generation, negative save-path cases, screen-reader spoken announcements, and the remaining theme/high-contrast matrix remain intentionally open. The sprint is not Done or merge-ready until that evidence and lifecycle approval are complete.
- First draft PR #217 smoke failed DOM/tab order (**Regenerate** before language) and approximately 207% zoom containment (`innerWidth=354`, `scrollWidth=1080`). Minimal DOM reordering and responsive flex containment fixes were implemented with automated regressions; at that checkpoint manual PR retest remained pending and no manual pass was claimed.
- The first responsive-fix rerun passed DOM/tab order, horizontal containment, column stacking, the wider zoom case, and long-name accessibility, but still failed the exact `354×300` gate because fixed chrome collapsed the Insights rail and focused controls remained clipped; **Regenerate** also showed a native orange outline. A viewport-bounded chrome/pane allocation, two-row narrow grid, bounded rail scroller, and standard 4 px indigo focus ring were then implemented locally with contract coverage; at that checkpoint another manual PR rerun remained pending and no manual pass was claimed.
- The final Electron rerun passes the exact `354×300` / DPR `4.147200107574463` gate with zero document overflow, 150 px bounded chrome, two `74.9904px` pane rows, independent transcript/Insights scrolling, wholly visible language/**Regenerate**/**Create** focus targets, and the approved 4 px translucent indigo ring without a native orange outline. `654×300` high zoom, `1400×766` desktop, and long-name ellipsis/accessibility checks also pass. Authenticated model calls and the final **Create insights document** mutation were deliberately not performed and remain open.
- R6 live RunDev smoke loads the editable combobox in the existing Estonian session, searches `cymraeg` to the canonical **Welsh / Cymraeg / CY** row, exposes correct combobox/listbox/active-descendant/live-result semantics, stays horizontally contained, and restores the prior Estonian selection on Escape without changing transcript or Insights data.
- The same live session successfully created `KUMi AI arutelu - Risto Raaperiga-insights.md` as a separate Estonian Markdown snapshot with recording, generation time, language, model, timestamp, and section provenance; the workbench continued to show the primary **Save to document** action. The user-created evidence file remains untracked and is excluded from the source commit.
- Authenticated latency evidence corrected the initial estimate: the Latvian regeneration ran from `16:35:01.704Z` to `16:38:45.239Z` (3m43.5s), with ~82k input/cache tokens and 15,836 output tokens for a sub-4k-character response. R7 now forces low extraction effort, removes built-in SDK tools, and skips coding-agent setting sources; compile, focused tests, webview build/typecheck, and `validate-qa.sh` pass.
- Post-fix authenticated runs completed in 27.2 s and 15.2 s. The final German run produced and persisted valid German Insights in 15.2 s with 1,151 output tokens, approximately 14.7× faster than the 3m43.5s Latvian baseline; Jarmo confirmed the improvement in the running app. These are observed timings, not a network-independent SLA.

## Planning Approval

- [x] Jarmo approves Sprint 113 SDD/design artifacts and parallel delivery order.
- [x] Jarmo approves branch creation.
- [x] Phase 0 file/language contract approved.
- [x] GitHub issue #208 created and assigned to milestone v1.10.0.
