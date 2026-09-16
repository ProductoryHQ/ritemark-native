# Sprint 126 — Microsoft Store Certification Gaps

**Release:** [v1.11.0](../release-plan.md) · [milestone 11](https://github.com/ProductoryHQ/ritemark-native/milestone/11)<br>
**Status:** **R2 and R4 merged 2026-09-16** — [issue #305](https://github.com/ProductoryHQ/ritemark-native/issues/305), [PR #304](https://github.com/ProductoryHQ/ritemark-native/pull/304). R1 (Freemium) and R3 (StoreLogo2 artwork) are Jarmo's Partner Center work and remain open; the resubmission depends on them plus a new signed candidate at a new immutable URL.<br>
**Track:** Audit-first; shared AI UX/host boundary, targeted VS Code distribution patch, and Store metadata operations.<br>
**Owner:** Jarmo (scope, external account actions, release gates); implementation/QA assignees TBD at kickoff.<br>
**Issue:** [#305](https://github.com/ProductoryHQ/ritemark-native/issues/305) under milestone `v1.11.0`, closed with the merge.<br>
**Branch:** `sprint-126-store-certification`, merged and deleted.<br>
**Created:** 2026-09-15

## Goal

Address all four findings in Microsoft's 2026-09-15 certification report and prepare an evidence-backed v1.11.0 resubmission. This plan does not authorize implementation, builds, installer replacement, or Partner Center changes.

## Evidence and Scope

Source: [Partner Center certification report](https://partner.microsoft.com/en-us/dashboard/win32apps/3a2a9010-fbe3-47cf-ae87-4d338f587830/certification/reports/74230c58-b040-4094-b3fe-ce0aed4e906b), completed 2026-09-15, status **Attention needed**. Product: Ritemark, publisher Productory Services OÜ. The table paraphrases the findings; it is not a claim that any fix has passed certification.

| ID | Report finding | Required outcome | Verification evidence |
|---|---|---|---|
| R1 | 10.8.2 Third-Party In-Product Purchases: features fit FREEMIUM | Correct Store pricing classification from Free to Freemium; verify descriptions accurately explain third-party paid AI usage | Saved Partner Center classification and matching listing text |
| R2 | 11.16 Live Generative AI Content: no inappropriate-output reporting mechanism | A discoverable, working user action to report inappropriate generated output, with an owned receiving/triage process | End-to-end delivery from the packaged app, privacy/failure tests, reviewer reproduction instructions |
| R3 | 10.1.1.3 Inaccurate Representation: non-Windows UI/devices in metadata images; Found In StoreLogo2, English UK | Identify the exact live StoreLogo2 asset and replace the offending imagery with accurate Windows-compatible artwork | Before/after asset mapping, dimensions, saved listing preview; check all other submitted images |
| R4 | 10.1.5 Software Distribution: Source Control offers Download Git for Windows linking to git-scm.com/install/windows | Remove the external Git acquisition promotion without breaking use of installed Git | Clean Windows, Git absent: no promotion; Git present: SCM still works; packaged-app screenshots and patch validation |

Do not assume StoreLogo2 means the poster art until the uploaded asset is inspected. The user uploaded the final logo/poster art themselves; a repository logo is not evidence of the live asset.

## Phase 0 — Audit and Decisions Before Implementation

1. Inventory generative-output surfaces (shared AI sidebar across Claude/Codex/OpenCode, inline/editor output, generated images, Flows and other applicable surfaces). Record which need reporting and why; do not silently cover only one provider.
2. Review the existing feedback/support path and choose the simplest reliable report channel. Confirm recipient/triage owner, retention, response expectations, and whether an existing service suffices. `info@productory.eu` is the known public contact, not an approved ingestion design by itself.
3. Specify report UX: select/identify output, preview/edit the submitted content, explicit send consent, accessible controls, success/cancel/failure/retry states. No automatic full conversation, document, API key, token, or local-path attachment. Define payload limits and host validation.
4. Trace the Git welcome/download contribution to its source and select the smallest maintainable configuration or `patches/vscode/` change. Preserve installed Git and normal Source Control; do not directly edit the VS Code submodule or remove SCM wholesale.
5. Map StoreLogo2 to the actual live asset; agree replacement artwork and pricing copy with Jarmo.
6. Produce behavioral spec, scenarios, technical plan and tasks, including per-finding evidence ownership. Jarmo approves this scope before implementation begins on a dedicated branch. **Done 2026-09-15** — [spec.md](./spec.md), [scenarios.md](./scenarios.md), [technical-plan.md](./technical-plan.md), [tasks.md](./tasks.md), built on [research/phase-0-audit.md](./research/phase-0-audit.md). Items 1-4 are closed by the audit; item 5 (live StoreLogo2) still needs Partner Center.

The shared architecture in [architecture.md](../../../architecture.md) applies: three existing runtimes, canonical conversation identity, centralized model identifiers, and shared host/webview boundaries. Reporting must not introduce another runtime or provider-specific dispatch path. Decide feature-flag behavior during the audit; the submitted build must expose the reporting mechanism without an experimental opt-in.

## Deliverables and Execution Order

1. Approved Phase 0 specification and test matrix, with a GitHub issue linked to milestone v1.11.0.
2. Shared inappropriate-output reporting UX and validated receiving path; focused tests for privacy, delivery, failure and runtime/surface coverage.
3. Targeted Git acquisition-promotion fix, patch applicability checks and Windows SCM regressions.
4. Approved replacement Store artwork and Freemium classification/copy, applied and verified in Partner Center during the authorized resubmission workflow.
5. Central Store documentation under [docs/microsoft-store-submission](../../../../microsoft-store-submission/) updated with report traceability, final asset mapping, reproduction instructions and dated verification evidence.
6. Gated release handoff: QA, release preflight, fresh release worktree, required release approvals, then a signed Windows candidate with a new immutable URL. Record exact version, provenance, SHA-256 and fresh public-download verification before submission.

Steps 2–3 follow approved Phase 0. Metadata preparation can proceed independently; actual external writes remain subject to Jarmo's confirmation. Resubmission depends on the release candidate, not just completion of this sprint's code.

## Definition of Done

- [ ] R1–R4 each have implementation/metadata evidence and a reviewer reproduction path.
- [ ] Reporting is discoverable on every in-scope generative surface and tested across the three runtime paths where applicable.
- [ ] A test report reaches the agreed recipient; the UI never claims delivery when it only opens a compose window or when transport fails.
- [ ] Users can preview/cancel reporting; payload minimization, secret exclusion, inaccessible destination and retry behavior are tested.
- [ ] Windows Git-absent and Git-installed cases pass; no external Git download promotion remains on the reported path, and installed Git functionality is preserved.
- [ ] Exact StoreLogo2 asset is identified, corrected and verified in the saved English UK listing; other images are checked for the same issue.
- [ ] Freemium classification and related copy are saved and verified, without inventing Ritemark subscription/payment features.
- [ ] Repository QA and relevant UI/native checks pass; architecture documentation is updated if message contracts, flags or module structure change.
- [ ] User-facing changes are recorded in `docs/CHANGELOG.md` and v1.11.0 release notes; central Store documentation links the final evidence.
- [ ] Release handoff explicitly separates completed sprint work from remaining candidate, release-gate and submission actions.

Microsoft certification acceptance is an external follow-up, not a guaranteed sprint outcome. Until candidate/download tests and authorized resubmission are complete, do not label the Store submission ready or accepted.

## Dependencies

- Existing Sprint 116 runtime baseline and merged Sprint 117 conversation/UI contracts. Sprints 118 and 119 moved to v1.12.0 on 2026-09-15, so no generative surface they would have added can appear in this release; the reporting inventory covers the surfaces that exist on the merged 116/117 baseline.
- Jarmo's approval of reporting destination/privacy contract, artwork and metadata; authenticated Partner Center access for later external changes.
- Windows environment with and without Git; signed release candidate and the existing release-process gates.
- Existing immutable installer hosting. The submitted `https://getritemark.com/windows/v1.10.1/Ritemark-Setup.exe` must remain byte-for-byte unchanged; a new candidate needs a new, never-reused URL.

## Risks

| Risk | Mitigation |
|---|---|
| Reporting action exists but cannot actually deliver or be triaged | Prove the complete receiving path and assign its owner before implementation scope approval |
| Reports leak private documents, conversations or credentials | Minimal user-reviewed payload, explicit consent, host validation and negative tests |
| Git fix hides useful SCM or returns after an upstream update | Target the acquisition promotion, keep installed-Git tests and persistent patch checks |
| Wrong artwork is changed | Resolve live StoreLogo2 mapping before preparing replacements |
| Metadata-only fixes are mistaken for full compliance | Track all four findings separately; R2/R4 require packaged-app evidence |
| Additional certification findings appear | Record as new intake; do not silently expand this sprint or promise acceptance |

## Out of Scope

- Rebuilding or replacing the submitted v1.10.1 installer under its existing URL.
- New billing/subscription implementation, broad moderation infrastructure, or automatic report collection.
- Removing Source Control, adding a fourth agent runtime, unrelated editor changes, or DNS/hosting migration.
- macOS release work except the normal shared release gates.
- Further changes to other releases’ sprint allocations. The 2026-09-15 move of Sprints 118 and 119 to v1.12.0 is already decided and recorded in the [release plan](../release-plan.md); this sprint does not revisit it.

## Decisions Log

| Date | Decision | Authority |
|---|---|---|
| 2026-09-15 | Add a dedicated certification-remediation sprint to the open v1.11 release; planning only in this step | Jarmo |
| 2026-09-15 | Allocate Sprint 126 because 120–125 are already allocated to v1.12 | Existing release plans |
| 2026-09-15 | Move Sprint 126 to the front of v1.11.0 and defer Sprints 118–119 to v1.12.0 | Jarmo: "meil on vaja Microsofti asjad korda teha ja siis teha uus release ja see üles panna." The submission is already lodged and blocked on four fixable findings; the deferred sprints are unstarted. |
