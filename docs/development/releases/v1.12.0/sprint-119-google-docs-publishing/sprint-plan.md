# Sprint 119 — Publish to Google Docs

**Track:** Full SDD, integration-first Phase 0<br>
**Status:** Draft — prepared, not approved, no branch created<br>
**Branch after approval:** `sprint-119-google-docs-publishing`<br>
**Issue:** Pending release mapping<br>
**Release:** [v1.12.0](../release-plan.md)

## Release Outcome

This sprint owns the v1.11 headline: a Markdown document can be published to one durable Google Doc and later synchronized to that same remote identity. It does not own two-way synchronization or make Google Docs a second source of truth.

## SDD Artifacts

- [spec.md](./spec.md) — product, security, persistence, and recovery contract.
- [scenarios.md](./scenarios.md) — behavior-driven acceptance matrix, including hostile paths.
- [technical-plan.md](./technical-plan.md) — subsystem boundaries, state machines, and workstreams.
- [tasks.md](./tasks.md) — phased implementation and verification checklist.
- [design.md](./design.md) — Settings and editor interaction states and copy.
- [research/current-state-audit.md](./research/current-state-audit.md) — checked-in seams, gaps, and reusable primitives.
- [research/google-api-contract-audit.md](./research/google-api-contract-audit.md) — official Google API/OAuth evidence and Phase 0 decision matrix.

## Requirement Traceability

| Requirement | Primary scenarios | Workstreams | Close evidence |
|---|---|---|---|
| R1 account connection and identity | S1–S8 | W0, W1, W6 | OAuth controller tests + native connect matrix |
| R2 least privilege and secret safety | S9–S12 | W0, W1, W7 | scope/token/redaction evidence |
| R3 template grant and lifecycle | S13–S18 | W0, W3, W6 | Picker/template contract tests |
| R4 conversion fidelity | S19–S26 | W0, W4, W7 | approved fixture matrix |
| R5 create semantics | S27–S33 | W3–W6 | fake transport + authenticated canary |
| R6 local-to-remote binding | S34–S42 | W2, W5 | binding/copy/rename matrix |
| R7 same-ID sync and overwrite honesty | S43–S50 | W3–W6 | remote ID/version evidence |
| R8 failure, retry, and recovery | S51–S62 | W1–W6 | fault-injection matrix |
| R9 concurrency, observability, and privacy | S63–S69 | W1, W2, W5, W7 | race/redaction/telemetry tests |
| R10 flag, accessibility, docs, and QA | S70–S76 | W6–W8 | accessibility, flag, docs, QA evidence |

## Goal

Let a Ritemark author connect Google once, create a Google Doc from the current Markdown file, and later push updates to that same Doc while Ritemark remains the source of truth.

## Product Contract

- Publishing is one-way: Ritemark pushes; it does not import remote edits.
- **Create Google Docs** creates one remote Doc and records its identity only after remote success.
- **Sync** updates that same remote Doc; it never silently creates a replacement.
- Before an overwrite, the UI states that manual edits in Google Docs may be replaced.
- OAuth secrets never enter the public repository, document, logs, or webview state.

## Scope

- Google account connect/disconnect/status in Ritemark Settings using least-privilege scopes.
- Optional default Google Docs template selection with a clear unavailable/revoked state.
- **Create Google Docs** and **Sync** actions in the document export toolbar.
- Conversion that preserves the supported Markdown export surface and strips Ritemark-only comments at the existing export chokepoint.
- Stable local binding between the Markdown document and Google file ID, including rename/move, missing/stale/deleted remote ID, and copy semantics.
- Explicit progress, success link, re-authentication, permission, quota, offline, conflict/overwrite, and retry feedback.
- Tests with a fake transport plus an authenticated canary against a dedicated test account before release readiness.

## Phase 0 Decisions

Phase 0 produces evidence and a recommendation for Jarmo; it does not implement product behavior.

1. **Conversion:** direct Markdown import, existing DOCX exporter + Drive conversion/update, and native Docs `batchUpdate` against the same fidelity fixtures.
2. **OAuth:** installed-app loopback/device flow, token storage, account identity, redirect handling, and exact `drive.file`/Picker requirements.
3. **Template:** copy-and-replace-body semantics versus style inheritance, and how the user grants access to a template under least privilege.
4. **Binding:** frontmatter versus host-owned workspace metadata; behavior for Save As, file copy, rename/move, and missing remote files.
5. **Update semantics:** same-ID replacement mechanics, image handling, manual remote edits, and failure atomicity.
6. **Credentials/operations:** Google Cloud project ownership, OAuth consent publishing, test users, rate/quota observability, and secret injection for dev/release.

## Deliverables

1. Approved integration research and decision record for all six Phase 0 questions.
2. Threat/privacy model covering tokens, scopes, logs, document metadata, revocation, and account switching.
3. Approved behavioral spec, scenarios, technical plan, and task checklist.
4. Settings integration, toolbar actions, conversion/upload/sync service, and document binding.
5. Fake-server contract suite, conversion fixtures, and authenticated end-to-end evidence.
6. Architecture, privacy/user documentation, changelog, release notes, and support/recovery guidance.

## Definition of Done

- [ ] Connect, disconnect, expired-token recovery, and account switching are explicit and secrets stay in OS-backed secure storage.
- [ ] The granted scopes are the narrowest that satisfy create, update, and approved template access.
- [ ] Create stores the remote identity only after success and opens the exact created Doc.
- [ ] Repeated Sync updates the same file ID and never silently duplicates or rebinds.
- [ ] Missing, deleted, inaccessible, or stale remote files lead to a clear user decision.
- [ ] Tables, headings, lists, links, images, and Ritemark comments have documented conversion fixtures and expected outcomes.
- [ ] Offline, quota, permission, cancellation, partial-upload, and retry paths preserve both the Markdown source and honest local binding state.
- [ ] Fake transport tests and a real dedicated-account canary pass without production credentials in fixtures or logs.
- [ ] Webview build, extension tests, feature flag, architecture gate, docs, release notes, and repository QA pass.

## Dependencies and Gates

- v1.12.0 must be mapped and the sprint approved before branch creation.
- Phase 0 must be approved before OAuth registration, dependencies, settings contracts, message contracts, or product code change.
- Google Cloud Console configuration and consent-screen publication may require Jarmo-owned external actions; record these as release blockers, not implicit implementation steps.
- Existing DOCX export is a candidate conversion engine, not a pre-decided solution.

## Feature Flag Decision

Add an experimental, default-on `google-docs-publishing` flag as a kill switch. Gate Settings, toolbar UI, and host commands together. Disabled state must leave local Markdown and existing export actions untouched; it must not discard any stored binding or token without an explicit disconnect.

## Product Decisions Proposed for Phase 0 Approval

- Store document bindings in a host-owned, versioned global-storage registry keyed by canonical document URI and workspace identity; do not write a Google file ID into Markdown/frontmatter by default, because Save As and copied files would inherit the remote target.
- Treat rename events observed by VS Code as moves of the same binding. Treat an unobserved copy or a newly opened path as unbound. Never infer identity from title or content hash alone.
- Keep access/refresh tokens only in VS Code SecretStorage. An installed-desktop OAuth client ID is public configuration; no token or service credential may enter source, settings payloads, logs, telemetry, or documents.
- Require an explicit user action for every Create or Sync. Sync is a full-document one-way replacement and warns that remote manual edits may be overwritten.
- Do not store a binding until Create has succeeded and the exact returned Google file ID has been verified. Never change a valid binding as an automatic retry strategy.
- Keep the existing export normalizer as the comment-removal and unsafe-markup chokepoint; Phase 0 selects the downstream Google conversion adapter from measured results.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| OAuth consent or verification delays release | High | Prove scopes and consent path in Phase 0; track external actions explicitly. |
| Sync overwrites manual Google Docs edits | High | One-way contract, pre-sync warning/state, exact same-ID tests, clear recovery. |
| Conversion loses structure or images | High | Reuse proven export primitives where evidence supports it; fixture matrix before UI completion. |
| Template access requires broader scope than intended | High | Validate `drive.file` + Picker/copy behavior against a test account before scope approval. |
| Local binding duplicates or targets the wrong remote file | High | Define copy/rename/Save As semantics; transactional binding updates and identity tests. |
| Secrets or tokens leak through public code/logs | High | Secure storage, redaction tests, no client secret in repo/webview/document. |

## Out of Scope

- Two-way sync, remote-change merge, Google Docs comment import, or real-time collaboration.
- Drive browsing beyond the minimum approved template selection flow.
- Sharing/permission management from Ritemark.
- Automatic/background sync or Google Docs as a second source of truth.
- Google Sheets, Slides, or general cloud storage integration.

## Planning Approval

- [ ] Jarmo approves scope and integration-first Phase 0.
- [ ] GitHub issue is created and assigned to milestone `v1.12.0`.
- [ ] Phase 0 research and all six decisions are approved.
- [ ] SDD artifacts and feature-flag decision are approved.
- [ ] Dedicated branch is created after approval.
