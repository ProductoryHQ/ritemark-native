# Sprint 119 Technical Plan

Architecture and workstreams for [spec.md](./spec.md), grounded in [current-state-audit.md](./research/current-state-audit.md) and [google-api-contract-audit.md](./research/google-api-contract-audit.md).

## Architecture Overview

```text
Settings webview                         Editor webview / Export menu
  connect / disconnect / template         create / sync / open / remove binding
             │ typed redacted messages                 │
             └───────────────┬─────────────────────────┘
                             ↓
                   GoogleDocsController
                    │        │        │
                    │        │        └─ operation registry/generations
                    │        └────────── GoogleDocsBindingStore
                    └─────────────────── GoogleOAuthController
                             ↓ authenticated, redacted client
                     GoogleDriveClient
                             ↓
             selected GoogleConversionAdapter
       normalized export ──→ create/update/verify ──→ Google Drive/Docs API
```

The extension host owns account, operation, conversion, and binding truth. Webviews render redacted projections and send intent; they do not hold tokens, Google clients, or authoritative file IDs.

## Proposed Host Modules

Exact names are frozen after Phase 0, but ownership should remain cohesive:

```text
extensions/ritemark/src/googleDocs/
  types.ts                    domain types and redacted projections
  protocol.ts                 exact-field Settings/editor request-result-event codecs
  GoogleOAuthController.ts    one OAuth attempt, PKCE/state/callback, refresh/revoke
  GoogleDriveClient.ts        narrow authenticated provider operations and error mapping
  GoogleDocsBindingStore.ts   atomic versioned local URI → Google file identity registry
  GoogleDocsPublisher.ts      preflight, conversion, Create/Sync, verification, idempotency
  GoogleDocsController.ts     Settings/editor integration and operation generations
  conversion/
    GoogleConversionAdapter.ts
    markdownImportAdapter.ts  Phase 0 candidate only
    docxImportAdapter.ts      Phase 0 candidate only
    docsApiAdapter.ts         Phase 0 candidate only
```

Integrations are expected in `extension.ts`, `RitemarkSettingsProvider.ts`, `ritemarkEditor.ts`, Settings React, `ExportMenu.tsx`/`App.tsx`, feature flag registry/settings, export v2 seams, package/build configuration, tests, architecture, privacy, user docs, and release docs.

## Boundary Rules

1. `GoogleOAuthController` is the only component that reads/writes Google Docs token SecretStorage keys.
2. `GoogleDriveClient` accepts access through an injected token provider and returns typed allowlisted results/errors, never raw token-bearing responses.
3. `GoogleDocsBindingStore` is the only authority for local URI → account subject/file ID association.
4. `GoogleDocsPublisher` receives a frozen source snapshot plus binding key and coordinates remote mutation; it does not read the currently active editor after dispatch.
5. `buildNormalizedExportHtml` remains the shared safety/comment-stripping seam. The selected adapter consumes its output or an explicitly reviewed sibling representation.
6. Settings and editor webviews never call Google directly. All inbound messages are exact-field validated and flag-gated in the host.
7. Existing Google AI/BYOK settings remain separate from Google Docs OAuth in names, state, storage keys, UI, and telemetry.

## State Machines

### Account

```text
not-connected
  → connecting → exchanging → connected
  → cancelled | error

connected → refreshing → connected | reauthorization-required
connected → disconnecting → not-connected
any → configuration-unavailable (when build config is absent/invalid)
```

Only the host transitions to `connected`, after identity verification and SecretStorage commit.

### Template

```text
none → choosing → verifying → selected
selected → choosing → selected(new) | selected(old on cancel)
selected → unavailable
selected/unavailable → removing → none
```

### Document publishing

```text
unbound
  → create-preflight → converting → creating → verifying → committing-binding → bound
  → cancelled | failed | verification-required | orphan-created-unbound

bound
  → sync-preflight → overwrite-confirmation → converting → updating → verifying → bound(updated)
  → cancelled | failed | verification-required | account-mismatch | target-unavailable
```

`failed` never advances last-success metadata. `verification-required` means a remote mutation may have happened and must be checked before retry. `orphan-created-unbound` carries an exact safe recovery reference but is not treated as bound.

## Binding Store Design

The proposed registry lives under extension global storage and is written with temp-file + atomic rename. Phase 0 freezes the exact format, but it must include:

- schema version and store revision;
- canonical document URI and workspace identity;
- Google account subject, file ID, safe browser link, and optional template ID;
- creation/last-success timestamps, source hash, and remote version/revision evidence;
- no tokens, document content, document title, or full account email unless explicitly approved.

Key behaviors:

- Resolve/snapshot by document URI before publishing.
- Migrate on VS Code-observed rename only after destination collision check.
- Do not bind copied/Save As paths based on content equality.
- Broadcast revisioned projections to every open editor for the URI.
- Retain a binding across disconnect and feature flag-off.
- Make local Remove binding explicit and independent of remote deletion.
- Fail closed on corrupt/newer schema while preserving recoverable last-known-good data.

## Provider Operation Contract

Phase 0 must document the exact Google sequence with request/response fixtures. At minimum:

- get/refresh/revoke authenticated account state;
- select and verify a template under approved per-file access;
- Create a Google Doc, optionally through a template copy;
- replace/import the full body while preserving the destination file ID;
- retrieve/verify MIME type, safe URL, file version/revision evidence, and account access;
- map 401/403/404/409/429/5xx/network/malformed response into stable internal errors;
- honor bounded retry guidance and abort semantics;
- handle response loss/idempotency without blind duplicate creation.

No implementation may rely on title search or “last created file” recovery.

## Conversion Adapter Decision

All candidates receive the same normalized source and fixture corpus.

| Dimension | Direct Markdown import | DOCX upload/conversion | Native Docs API |
|---|---|---|---|
| Existing Ritemark reuse | raw Markdown + normalizer/sanitizer decisions | Word exporter structure can be extracted to a buffer builder | requires a new structural mapper |
| Template behavior | must be proven | must be proven, especially replacement vs copied style retention | highest control, highest mapping surface |
| Images/tables/code | official import support is not sufficient proof of fidelity | current Word exporter has local-image/table primitives | explicit requests but more code/indices |
| Same-ID update | Drive media update candidate; verify conversion semantics | Drive media update candidate; verify MIME conversion semantics | batchUpdate body replacement with revision control candidate |
| Atomicity/recovery | verify provider behavior | verify provider behavior | request validation can be atomic, but multi-stage media/image flows still need evidence |
| Maintenance | potentially smallest | medium reuse, exporter currently mixes buffer and Save dialog | largest custom implementation |

Phase 0 selects one primary adapter and may retain another only as a documented fallback. Product code must not carry three partially supported paths.

## Workstream 0: Integration and conversion freeze (R1–R10)

- Reproduce every claim in `google-api-contract-audit.md` with a dedicated test account and current Google Cloud project.
- Freeze OAuth client type, PKCE/state/callback, scopes, consent publication/verification, test users, public config injection, token storage keys, and native platform behavior.
- Build thin disposable canaries for all three conversion candidates and run the fixture matrix, same-ID update, template, images, remote-edit version, cancellation, response-loss, and quota/error probes.
- Score fidelity, safety, maintainability, payload/size limits, latency, template survival, API count, and testability; select one adapter.
- Freeze binding schema/identity/copy/rename/account mismatch, dirty/untitled source snapshot, operation concurrency/idempotency/retry/cancel, warning copy/frequency, telemetry, and feature flag.
- Record threat/privacy model and external Google Cloud Console blockers in `research/integration-decisions.md`.
- Stop for Jarmo's Phase 0 approval.

## Workstream 1: OAuth and account service (R1, R2, R8, R9)

- Implement exact-field OAuth configuration parsing with no production token/secret defaults.
- Implement one active connect attempt: cryptographic state, PKCE, system-browser launch, bounded callback listener, timeout/cancel/disposal, code exchange, and identity verification.
- Store refresh/access token material only in SecretStorage; serialize refresh and account switching.
- Implement refresh classification, reauthorization state, remote revocation attempt, local disconnect, and redacted account projection.
- Inject browser/HTTP/clock/random/listener/SecretStorage adapters for deterministic tests.
- Add allowlisted logs/errors and secret-marker assertions.

## Workstream 2: Binding store and document identity (R6, R8, R9)

- Implement versioned registry codec, canonical URI/workspace key, atomic writes, last-known-good recovery, and revisioned events.
- Register VS Code file rename handling and collision-safe transactional migration; document which external moves cannot be inferred.
- Integrate custom editor lifecycle so every instance of the same URI receives one current projection/generation.
- Implement explicit Remove binding, account mismatch, corrupt/newer schema, and flag-off persistence.
- Test Windows/macOS path/URI cases, multi-root/no-folder cases, Save As/copy, rename collision, concurrent writes, interrupted writes, and reload.

## Workstream 3: Google client and template access (R2, R3, R5, R7, R8)

- Implement an injected HTTP client with authorization, timeouts, abort, typed responses, safe field selection, retries, and stable error mapping.
- Implement approved Picker/desktop Picker grant boundary and verify returned file ID/type/access before storing a template.
- Implement template copy/use operations required by the selected adapter and explicit unavailable/wrong-account states.
- Implement file create/update/get/verify/version operations without title search or broad listing.
- Add provider contract fixtures for pagination only if the approved flow actually requires it; no general Drive browser.

## Workstream 4: Conversion implementation (R4, R5, R7)

- Extract pure reusable export primitives instead of calling `exportToWordV2`, which currently owns Save-dialog/file-write UI.
- Keep normalized comment stripping and unsafe-markup handling centralized; validate data/image URI policy before provider payload construction.
- Implement only the approved conversion adapter, with deterministic output and bounded memory/payload behavior.
- Add fixture goldens/semantic assertions for every supported construct and explicit warnings/errors for unsupported items.
- Ensure conversion completes before any remote body mutation where the chosen API allows it.

## Workstream 5: Publisher/controller and protocol (R5–R9)

- Define versioned Settings/editor request-result-event types and runtime validators for account, template, binding, Create, Sync, Open, Remove, Cancel, and state snapshots.
- Freeze the source HTML/Markdown/properties/document URI at request acceptance; reject unsupported/untitled/dirty states under the approved contract.
- Serialize/deduplicate by binding key with operation IDs and generations; coordinate account changes through one controller.
- Implement Create preflight → conversion → remote create/update → verification → atomic binding commit.
- Implement Sync preflight/version warning → conversion → exact-ID update → verification → atomic last-success commit.
- Implement verification-required and orphan-created-unbound recovery without blind create/update retries.
- Broadcast redacted state only to the relevant document/editor generation.

## Workstream 6: Settings and editor UX (R1, R3, R5–R10)

- Implement [design.md](./design.md) account/template card and editor action states.
- Keep Google AI API key and Google Docs account visually and semantically distinct.
- Add Create/Sync/Open/Remove action flow with progress stages, overwrite disclosure, matching-account/template/unavailable states, safe links, and recovery actions.
- Restore focus after browser/picker/dialog operations and announce async state with polite/assertive semantics appropriate to severity.
- Gate every Settings/editor projection and host intent with `google-docs-publishing`; preserve existing export menu behavior.

## Workstream 7: Security, contract, and native evidence (R1–R10)

- OAuth unit/contract tests: state/PKCE, callback replay, listener cleanup, exchange/refresh/revoke, SecretStorage, missing config, flag-off forged messages, and redaction.
- Binding/publisher tests: URI identity, copy/rename, atomicity, same-ID update, account mismatch, idempotency, response loss, retries, cancellation, stale generations, and corrupted store.
- Conversion fixture and regression suites across chosen adapter, existing PDF/Word, comments, images, and metadata.
- Fake transport fault matrix for network/401/403/404/429/5xx/malformed/timeout/unknown outcome.
- Authenticated dedicated-account canaries for Create, template Create, same-ID Sync, remote edit warning, revoke/re-auth, and orphan recovery.
- RUNDEV plus packaged macOS arm64/x64 and native Windows browser/callback/open-link/accessibility matrix.

## Workstream 8: Docs, QA, and release blockers (R10)

- Update architecture for subsystem, webview protocols, token/binding ownership, conversion seam, feature flag, and branch-date rule.
- Update privacy/security documentation, user connection/publishing/recovery guide, changelog, v1.12.0 release notes, issue, and parent tracker.
- Record Google Cloud project owner, consent-screen state, production/test OAuth clients, approved redirect configuration, support contact/privacy URLs, and any verification/publishing lead time as explicit release blockers without committing credentials.
- Run focused tests/builds, webview bundle, native evidence, `./scripts/validate-qa.sh`, and release readiness gate only after implementation.

## Workstream 9: Ritemark's own legal pages (R11, added 2026-09-18)

- Phase 0 (W0) records the Google user-data facts the privacy policy must state, and the consent-screen fields: app name, support email, home page, privacy and terms URLs, authorized domain, and domain-verification state.
- Hand the `ritemark-web` and `productory-2026` work off to those repositories with the facts attached; this repository does not edit their code. Record their merge/publish status and live-URL checks in `research/integration-decisions.md` or the sprint closeout.
- After dated live-URL evidence, switch `PRIVACY_POLICY_URL`/`TERMS_OF_USE_URL` in `extensions/ritemark/src/analytics/posthog.ts` and `RITEMARK_PRIVACY_URL`/`RITEMARK_TERMS_URL` in `extensions/ritemark/webview/src/components/ai-sidebar/aiDisclosure.ts` to the ritemark.app pages. Update `aiDisclosure.test.ts` and `analytics.test.ts` if they assert the URLs, rebuild the webview bundle, and grep that no productory.ai privacy/terms URL remains.
- Update `docs/microsoft-store-submission/LEGAL-AND-URLS.md` with the new URLs, and record the Partner Center change as Jarmo's action.

## Implementation Order

W0 audit/canaries → Phase 0 approval → W1 OAuth and W2 binding foundations → W3 provider client/template → W4 selected converter → W5 controller/protocol → W6 UX → W7 evidence → W8 docs/QA. W9 runs alongside: its facts come out of W0, and its link switch waits only for the live pages, not for W1–W8.

W1 and W2 may proceed in parallel only after Phase 0 approval because their contracts meet in W5. W3 and W4 may proceed after their shared API/conversion decision is frozen. No UI should be considered complete before unknown-outcome, account-mismatch, and copied-file scenarios work end to end.

## Architecture Gate

Triggered by a new external-integration subsystem, two webview message surfaces, SecretStorage keys, global-storage schema, file-rename handling, conversion adapter, operation state machine, and feature flag. Update `docs/development/architecture.md` before sprint close, with `Last updated` no earlier than branch creation.
