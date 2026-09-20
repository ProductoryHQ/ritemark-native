# Sprint 119 Tasks

Implementation checklist for [technical-plan.md](./technical-plan.md). Tick `[x]` only with branch diff/evidence.

> **Gate:** Phase 0 is research, disposable canaries, fixtures, design, and decision documentation only. No OAuth registration/config change, dependency addition, production message contract, or product implementation begins until Jarmo approves `research/integration-decisions.md`.
>
> *(revised 2026-09-18)* A Testing-mode Google Cloud project with test users only may be created for the Phase 0 canaries. Publication, verification and the production client configuration wait for the gate.

## Phase 0: Audit, canaries, and freeze (W0 — R1–R10)

> **Progress 2026-09-20.** First canary session done; see [integration-decisions.md](./research/integration-decisions.md). The OAuth flow, the Markdown-import path, the DOCX path and a native Docs write were exercised against the real endpoints. Still open: the Picker/template grant, Windows, Mermaid and large-payload limits, the cancel/timeout matrix, and every freeze below.

- [x] Verify every current-state finding and complete `research/integration-decisions.md` with owner/date/evidence. *(audit re-verified with a dated addendum; the decision record is open and filling)*
- [x] Establish a dedicated Google Cloud project/test account in Testing mode and record project ownership, consent status, test users, support/privacy URLs (ritemark.app), OAuth client types, release configuration path, and external blockers without storing credentials. *(project reused, APIs enabled, consent screen and scope set; Jarmo deferred the separate test account, so canaries run on his own account)*
- [ ] Prove the exact installed-desktop OAuth flow on macOS and Windows: browser, callback, PKCE/state, timeout/cancel, token exchange/refresh/revoke, and cleanup. *(macOS proven end to end, including the missing-secret refusal; Windows, the cancel/timeout/port-collision matrix and revoke still to run)*
- [ ] Prove the least-privilege scope set and template grant; document why any scope beyond `drive.file` is unavoidable before requesting approval. *(`drive.file` proven sufficient for create, update, copy and Docs writes; the Picker grant is untested)*
- [x] Build disposable direct-Markdown, DOCX-conversion, and native-Docs-API canaries.
- [ ] Run the same versioned fidelity corpus through all candidates: metadata, headings, inline styles, code, lists, blockquotes, tables, links, comments, unsafe markup, images/Mermaid, Unicode, and empty documents. *(corpus run through Markdown import and DOCX; the native path covered only a small mapper sample; Mermaid and empty documents not covered)*
- [x] Measure template survival, same-file-ID update, remote version evidence, payload/size limits, latency, API count, mutation atomicity, retry/cancel, and unknown-outcome recovery for each candidate. *(template survival, same-ID update, version signals and atomicity measured; payload limits, latency at size, retry/cancel and unknown-outcome recovery still open)*
- [x] Select one conversion adapter and record scored rationale plus unsupported-format contract. *(native Docs API, decided 2026-09-20 under Jarmo's delegation, on measured results; unsupported-format contract recorded: local images, checked checkboxes, mixed-list glyphs)*
- [ ] Freeze exact Create/Sync API sequence, same-ID proof, idempotency/orphan strategy, preflight/verification, error mapping, retry budget, and cancellation semantics.
- [ ] Freeze binding schema, workspace/document identity, Save As/copy/rename/collision/account mismatch/corruption/migration behavior, and atomic persistence.
- [ ] Freeze dirty/untitled snapshot rule, concurrency, overwrite warning frequency, remote-edit version response, telemetry/log allowlist, and support error codes.
- [ ] Approve `design.md`, feature flag, threat/privacy model, dependency choice, architecture impact, and native/live test matrix.
- [ ] **Jarmo Phase 0 gate:** authorize production implementation.

## Phase 1: OAuth and account service (W1 — R1, R2, R8, R9)

- [ ] Add Google-Docs-specific domain/account types and exact redacted projections.
- [ ] Add validated public OAuth configuration with actionable unavailable state; keep all tokens/credentials out of source defaults and webviews.
- [ ] Implement one-attempt OAuth controller with cryptographic state, PKCE, bounded callback listener, system-browser launch, cancel/timeout/replay protection, and disposal.
- [ ] Implement token exchange, identity verification, SecretStorage commit, serialized refresh, reauthorization classification, revocation attempt, disconnect, and account switching.
- [ ] Add injected HTTP/browser/listener/clock/random/SecretStorage adapters.
- [ ] Test success, cancel, denial, timeout, port failure, malformed/mismatched/replayed callback, partial token commit, refresh/revoke failures, dispose, and flag-off.
- [ ] Add redaction tests that seed token/email/file/content markers through every error/log path.

## Phase 2: Binding store and identity (W2 — R6, R8, R9)

- [ ] Add versioned binding/store codecs, canonical URI + workspace identity, and safe redacted projection.
- [ ] Add temp-write + fsync/close where appropriate + atomic rename and last-known-good recovery.
- [ ] Add monotonic registry revisions and per-document events for multiple editor webviews.
- [ ] Register VS Code rename/move handling with destination collision checks and transactional migration.
- [ ] Implement Save As/copy isolation, account mismatch, unknown/corrupt schema, remove-binding confirmation, and feature-off/disconnect persistence.
- [ ] Test POSIX/Windows URI normalization, multi-root/no-folder, two editors, concurrent writes, interrupted temp, rename collision, external copy, reload, and newer schema.

## Phase 3: Google client and templates (W3 — R2, R3, R5, R7, R8)

- [ ] Add injected authenticated HTTP client with bounded timeout, abort, safe fields, stable internal errors, retry guidance, and response validation.
- [ ] Implement the approved template picker/grant flow and verify file type/account/access before committing selection.
- [ ] Implement template change/remove/unavailable and copy/use semantics required by the selected adapter.
- [ ] Implement only required file create/update/get/verify/version operations; do not add general Drive listing/search.
- [ ] Prove every mutation addresses the exact file ID and unknown outcomes require verification before retry.
- [ ] Add contract fixtures for 401/403/404/409/429/5xx/network/timeout/malformed/aborted/unknown results.

## Phase 4: Conversion adapter (W4 — R4, R5, R7)

- [ ] Extract pure export buffer/structure helpers needed by the selected adapter; do not couple cloud publishing to Save dialogs or synchronous file writes.
- [ ] Route source through the approved normalized comment/safety chokepoint and validate document-relative assets.
- [ ] Implement the one selected adapter with deterministic bounded output and no product fallback to unapproved candidates.
- [ ] Add semantic/golden fixtures for every R4 construct and explicit missing/oversized/unsupported image behavior.
- [ ] Assert Ritemark comments, unsafe markup, credentials, and local-only metadata never reach provider requests.
- [ ] Run PDF/Word/Copy Markdown regression suite after any shared export refactor.

## Phase 5: Publisher, controller, and protocols (W5 — R5–R9)

- [ ] Add versioned Settings/editor request-result-event codecs with exact field/runtime validation.
- [ ] Freeze source snapshot at accepted request and enforce saved/dirty/untitled/unsupported URI contract.
- [ ] Add operation IDs/generations and per-binding serialization/deduplication; reject stale Create/Sync/cancel/results.
- [ ] Implement Create preflight, conversion, optional template step, remote mutation, verification, and atomic binding commit.
- [ ] Implement response-loss/orphan-created-unbound recovery and ensure repeated Create never silently duplicates a bound result.
- [ ] Implement Sync matching-account/target/version preflight, overwrite decision, conversion, exact-ID update, verification, and atomic last-success commit.
- [ ] Implement Already up to date, target unavailable/wrong type, account mismatch, verification required, bounded retry, and stage-honest cancellation.
- [ ] Broadcast only redacted per-document state to relevant editors and coordinated account state to Settings.
- [ ] Test same title/different IDs, two documents, two editors, concurrent requests, reload, disconnect mid-operation, stale generations, and all failure stages.

## Phase 6: Settings and editor UX (W6 — R1, R3, R5–R10)

- [ ] Implement Google Docs publishing account card states from `design.md`, separate from Google AI API key.
- [ ] Implement Connect/Cancel/Reauthorize/Disconnect with system-browser handoff, focus restoration, safe status, and configuration-unavailable guidance.
- [ ] Implement Choose/Change/Remove template with cancellation preservation and unavailable/wrong-type feedback.
- [ ] Add Create Google Docs/Sync/Open Google Doc/Remove publishing link states to the export surface without regressing PDF/Word/Copy.
- [ ] Implement preparing/converting/uploading/verifying/success/already-up-to-date/error/verification-required progress and safe retry choices.
- [ ] Implement overwrite disclosure and stronger remote-edit warning under the approved frequency rule.
- [ ] Add experimental/default-true `google-docs-publishing` to flags/settings and gate Settings UI, editor UI, callbacks, and every host handler coherently.
- [ ] Verify keyboard flow, screen-reader names/live regions, focus/dialog behavior, 200% zoom, narrow width, high contrast, and reduced motion.

## Phase 7: Security, integration, and native evidence (W7 — R1–R10)

- [ ] Run OAuth/account, SecretStorage, redaction, callback lifecycle, binding, publisher, adapter, protocol, feature-gate, and existing-export tests.
- [ ] Run the complete fake-transport fault matrix and assert last-success/binding invariants after each failure.
- [ ] Run authenticated dedicated-account Create, template Create, same-ID Sync, remote manual edit, response-loss recovery where safely injectable, revoke/re-auth, and disconnect canaries.
- [ ] Verify returned file IDs remain identical across Sync and captured evidence contains no credential/content/private identity.
- [ ] Run RUNDEV plus packaged macOS arm64/x64 and native Windows connection/browser/callback/picker/open-link/publish matrix.
- [ ] Walk every ★ scenario and link dated evidence; automate or justify every remaining scenario.
- [ ] Confirm OAuth consent/publishing/verification and production configuration are release-ready, not merely working for test users.

## Phase 8: QA and closeout (W8 — R10)

- [ ] Rebuild committed webview artifacts after source changes and verify clean bundle provenance.
- [ ] Run focused webview/extension/export/feature/security tests and builds.
- [ ] Run `./scripts/validate-qa.sh` through repository QA.
- [ ] Update `docs/development/architecture.md` for subsystem/protocol/SecretStorage/binding/rename/conversion/flag, with a valid Last updated date.
- [ ] Update privacy/security docs, Google Docs user/recovery guide, changelog, v1.12.0 release notes, parent release tracker, issue, and PR evidence.
- [ ] Confirm all Google Cloud external blockers have owners/status and no production/test credentials appear in the repository or artifacts.
- [ ] Verify every checked requirement/task against branch diff and evidence before readiness handoff.

## Phase 9: Ritemark's own legal pages (W9 — R11) (added 2026-09-18)

- [ ] Record the Google user-data facts and consent-screen fields for the privacy policy in `research/integration-decisions.md` (Phase 0 decision 8).
- [ ] Hand off the `ritemark-web` privacy/terms pages (EN + ET, provider Productory Services OÜ, Google Docs section from the facts) and the `productory-2026` update (short Ritemark reference, links to ritemark.app, old URLs keep resolving), and record their status.
- [ ] Capture dated live-URL evidence for every ritemark.app legal URL the app and the consent screen use (S78).
- [ ] Switch the privacy/terms URLs in `posthog.ts` and `aiDisclosure.ts` to ritemark.app, update their tests, rebuild the webview bundle, and grep that no productory.ai privacy/terms URL remains (S77).
- [ ] Verify the productory.ai pages still load for 1.11-era links and point to ritemark.app (S79).
- [ ] Configure and verify the consent screen's ritemark.app URLs and authorized domain (S80), and check the policy text against the approved facts (S81).
- [ ] Update `docs/microsoft-store-submission/LEGAL-AND-URLS.md`, and record Jarmo's Partner Center URL change.
