# Sprint 126 Tasks

**Parent:** [technical-plan.md](./technical-plan.md) · Phases are gates, not estimates. Nothing in Phase 1 starts before Jarmo approves this package.

## Phase 0 — Freeze (W0)

- [x] Audit the generative surfaces and the acquisition promotions — [research/phase-0-audit.md](./research/phase-0-audit.md)
- [x] Decide recipient, content policy, consent model, transport, triage owner, surface scope
- [x] Establish that no feature-flag change is needed and that there is no separate Store build
- [ ] Identify the live `StoreLogo2` asset in Partner Center and record it with dimensions — **Jarmo, his own work.** Blocks the resubmission, not Phases 1-4: the code track does not wait on it.
- [ ] Capture the saved listing text that describes AI usage, for the Freemium rewrite — **Jarmo**
- [ ] Jarmo approves this specification package

## Phase 1 — Report composition (W1 — RQ2, RQ5)

- [ ] `composeReport.ts`: turn + context → report text
- [ ] `reportCopy.ts`: every user-visible string in one module
- [ ] Unit tests: each excluded category (other turns, document content, file paths, workspace name, credentials) asserted absent
- [ ] Unit test: a caller passing extra fields has them dropped, not forwarded

## Phase 2 — Transport (W2 — RQ3, RQ4)

- [ ] `reportTransport.ts`: handler detection, `mailto:` construction, encoded-length bound
- [ ] `protocol.ts`: typed message and result, field-by-field validation
- [ ] Wire the message pair in `UnifiedViewProvider.ts`
- [ ] Host tests without VS Code: handler present, handler absent, over-length degrades to fallback
- [ ] Test: the copy module contains no delivery-claiming word

## Phase 3 — UI (W3 — RQ1, RQ2, RQ4)

- [ ] `ReportDialog.tsx` on `ui/dialog.tsx`, with the editable body and the fallback state
- [ ] Turn-level control in `AgentResponse.tsx` and `CodexView.tsx`
- [ ] Entry in `AIInformation.tsx`
- [ ] Accessibility: keyboard reach, accessible names, dialog focus handling, 200% zoom, minimum sidebar width
- [ ] Styles in `index.css`, brand font, `cursor: pointer` on everything clickable

## Phase 4 — Acquisition promotion (W4 — RQ6)

- [ ] Patch the three `scm.missing.*` strings: drop the bare link line, keep the explanation and the reload/troubleshoot commands
- [ ] Patch the two welcome-page launch checks: keep the status line, drop the install action
- [ ] Applicability check that fails loudly if an upstream bump restores the strings
- [ ] Verify on Windows: Git absent → no button; Git installed → Source Control unchanged

## Phase 5 — Evidence and closeout (W5 — RQ7, RQ8)

- [ ] Packaged-app Windows evidence: report raised from each runtime, mail handler present and absent
- [ ] Freemium classification and listing text saved in Partner Center — **Jarmo**
- [ ] Replacement artwork for the identified `StoreLogo2`, and every other image checked — **Jarmo, his own work; the sprint produces no Store imagery**
- [ ] Reviewer reproduction instructions, naming `info@productory.eu` and its monitoring by the Ritemark team
- [ ] `docs/microsoft-store-submission/` updated with final asset mapping and dated evidence
- [ ] `docs/CHANGELOG.md` and the v1.11.0 release notes
- [ ] `architecture.md` updated for the new message contract and module
- [ ] Repository QA green; release gates; new candidate at a new immutable URL

## Deliberately out

- A backend ingestion service, report history, or in-app report status.
- Reporting on Transcribe insights, Flows output, generated images, conversation titles, comment-task summaries.
- Any feature-flag promotion, and any Store-specific build variant.
- Moderation or classification of reported content.

## Cannot be claimed as verified until it happens

Microsoft's acceptance. This sprint clears four findings and produces evidence; certification is an external outcome with its own timeline, and no document here may describe the submission as accepted before Partner Center says so.
