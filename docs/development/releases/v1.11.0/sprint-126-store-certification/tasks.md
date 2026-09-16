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

- [x] `composeReport.ts`: context lines + user text → report text. The signature accepts nothing else.
- [x] `reportCopy.ts`: every user-visible string in one module
- [x] Unit tests: each excluded category (conversation content, document content, file paths, workspace name, runtime/model identifiers, credentials) asserted absent
- [x] Unit test: a caller passing extra fields has them dropped, not forwarded

## Phase 2 — Transport (W2 — RQ3, RQ4)

- [x] `reportTransport.ts`: handler detection, `mailto:` construction, encoded-length bound
- [x] `protocol.ts`: typed message and result, field-by-field validation
- [x] Wire the message pair in `UnifiedViewProvider.ts`
- [x] Host tests without VS Code: handler present, handler absent, over-length degrades to fallback
- [x] Test: the copy module contains no delivery-claiming word

## Phase 3 — UI (W3 — RQ1, RQ2, RQ4)

- [x] `ReportDialog.tsx` on `ui/dialog.tsx`, with the editable body and the fallback state
- [x] `reportStatusBar.ts`: item at right/priority 99, plus the command that reveals the AI panel and opens the window
- [x] Entry in `AIInformation.tsx`, opening the same window in the same state
- [x] Verify status bar order on a narrow window: word count, AI status, report, scheduled tasks
- [x] Accessibility: keyboard reach, accessible names, dialog focus handling, 200% zoom, minimum sidebar width
- [x] Styles (Tailwind classes on the dialog; no new `index.css` rules were needed), brand font, `cursor: pointer` on everything clickable

## Phase 4 — Acquisition promotion (W4 — RQ6)

- [x] Patch the three `scm.missing.*` strings: drop the bare link line, keep the explanation and the reload/troubleshoot commands
- [x] Patch the two welcome-page launch checks: keep the status line, drop the install action
- [ ] Applicability check that fails loudly if an upstream bump restores the strings — **carried out of the sprint**, see below
- [ ] Verify on Windows: Git absent → no button; Git installed → Source Control unchanged — **not run**, needs a machine without Git

## Phase 5 — Evidence and closeout (W5 — RQ7, RQ8)

- [ ] Packaged-app Windows evidence: report raised from the status bar and from AI Information, mail handler present and absent
- [ ] Freemium classification and listing text saved in Partner Center — **Jarmo**
- [ ] Replacement artwork for the identified `StoreLogo2`, and every other image checked — **Jarmo, his own work; the sprint produces no Store imagery**
- [ ] Reviewer reproduction instructions, naming `info@productory.eu` and its monitoring by the Ritemark team
- [ ] `docs/microsoft-store-submission/` updated with final asset mapping and dated evidence
- [x] `docs/CHANGELOG.md` and the v1.11.0 release notes
- [x] `architecture.md` updated for the new message contract and module
- [ ] Repository QA green; release gates; new candidate at a new immutable URL

## Verified on the running dev instance (2026-09-15)

Driven through CDP against `scripts/code.sh`, not only asserted in tests:

- The status bar item renders as **Report AI issue** immediately right of the AI status indicator, with its tooltip.
- Clicking it reveals the AI panel and opens the report window with an empty body and the three context lines.
- The AI Information dialog carries the report entry, with its explanatory line.
- The no-mail-handler state renders the honest wording and the address, keeping the typed report intact.
- Geometry at real sidebar width: dialog 267px inside a 299px viewport, **zero** elements overflowing horizontally, every button one line (36px).
- The welcome-page launch check renders with no actionable install control, and the compiled `out/` no longer contains `clickHereToInstall` or either download URL.

Two defects were found this way and fixed: a three-button footer whose labels each wrapped to four lines at 299px, and fallback copy that pointed "below" at a control which had moved above.

### Not driven in the running app

- **The Git/Node "missing" branch on the welcome page**, and **the Source Control empty state**. Both need a machine without Git. The guarantee is structural rather than observed: `renderLaunchCheckItem` is now called with no action argument in *either* branch, so no install control can render in either, and the three `scm.missing.*` strings have no line that parses to a single link, which is the condition `viewPane.ts` uses to render a button.
- **The real `mailto:` handoff.** Opening a mail client is a side effect on the tester's machine; the three transport outcomes are covered by host tests instead.

## Deliberately out

- A backend ingestion service, report history, or in-app report status.
- Reporting on Transcribe insights, Flows output, generated images, conversation titles, comment-task summaries.
- A per-turn report control, and any change to the transcript components.
- Any feature-flag promotion, and any Store-specific build variant.
- Moderation or classification of reported content.

## Carried out of the sprint, deliberately

- **A patch-applicability check for the `scm.missing` strings.** An upstream VS Code bump can restore them silently. The check belongs with the patch tooling rather than with this sprint's code, and `apply-patches.sh --dry-run` is already known to misreport (it says "can apply" for patches that are applied), so a check bolted on now would inherit that unreliability. Worth its own issue.
- **The Windows Git-absent verification.** Needs a machine without Git. The structural guarantee — no action argument in either branch, no single-link line in any `scm.missing` string — is what stands in for it, and the sprint record says so rather than implying a test that did not run.

## Cannot be claimed as verified until it happens

Microsoft's acceptance. This sprint clears four findings and produces evidence; certification is an external outcome with its own timeline, and no document here may describe the submission as accepted before Partner Center says so.
