# Sprint 119 Google API Contract Audit

**Checked:** 2026-09-13<br>
**Authority:** current official Google documentation only.<br>
**Status:** planning evidence, not a selected implementation. Every provider behavior that affects data loss, identity, or release operations still requires a real-account Phase 0 canary.

## Executive Finding

The intended product is feasible with a least-privilege `drive.file` baseline, but the exact path is not yet safe to choose from documentation alone.

Three viable conversion candidates exist:

1. upload Markdown and convert it to Google Docs;
2. build DOCX from Ritemark's existing exporter and upload/convert it;
3. create/copy a Google Doc and replace its contents through Docs API requests.

Google documents full-content replacement during a Drive `files.update` conversion and atomic request validation/application for a Docs `batchUpdate`, but fidelity, template survival, images, response-loss recovery, and revision behavior differ. Those are Phase 0 measurements.

The largest release-operational risk is OAuth publication state: Google's OAuth overview says an external app whose consent screen is in **Testing** gets refresh tokens that expire in seven days when non-profile scopes such as `drive.file` are requested. A test-only OAuth project is therefore not sufficient for a durable shipping integration.

## Official Sources

- [OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Choose Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Integrate Google Picker into desktop and mobile apps](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker)
- [Upload file data / import conversion](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive files.create](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- [Drive files.update](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/update)
- [Drive files.copy](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy)
- [Docs documents.batchUpdate](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/batchUpdate)
- [Docs request types](https://developers.google.com/workspace/docs/api/reference/rest/v1/documents/request)

## Confirmed OAuth Constraints

### Installed desktop apps cannot keep a client secret

Google's installed-app guide explicitly treats distributed installed apps as unable to keep secrets. The authorization flow opens the system browser and returns through an approved local/custom redirect; out-of-band copy/paste authorization is deprecated and no longer supported.

Planning consequence:

- An installed-desktop client ID is public build configuration, not a credential we can hide in the repository binary.
- A client secret, if a chosen library/config format contains one, cannot be treated as security protection.
- Access/refresh tokens and the per-attempt PKCE verifier remain secrets and belong only in host memory/SecretStorage.
- Phase 0 must validate the actual macOS/Windows redirect flow used by this Electron/VS Code shell.

### PKCE and state are part of the desktop flow

The installed-app guide documents a per-request PKCE verifier/challenge, recommends `S256`, and requires clients to prevent CSRF, commonly through a validated `state` value. Loopback redirect uses `127.0.0.1` or `::1` with a random available port; the local listener lifecycle is application responsibility.

Planning consequence:

- One active connection attempt gets its own cryptographic state, PKCE verifier, generation, listener, timeout, and cancellation.
- Exact redirect URI matching, IPv4/IPv6 behavior, browser reload, stale callback, duplicate callback, port collision, disposal, and firewall/security-software interference need tests.
- OAuth must use the system browser, not an embedded webview user agent.

### Refresh tokens are fallible and Testing mode is not release-ready

Google documents multiple refresh-token invalidation causes: user revocation, long inactivity, token-count limits, administrator policy, and time-based access. It also documents the seven-day expiration for external OAuth consent screens in Testing unless only basic profile scopes are requested.

Planning consequence:

- `invalid_grant`/revocation is a normal recoverable account state, not a fatal corrupt installation.
- Existing document bindings must survive reauthorization.
- The release tracker must name the Google Cloud project owner and prove the consent application is in the production/published state required for durable use.
- A canary that works for seven days does not establish release readiness.

### Installed-app incremental authorization limitation

The installed-app guide says incremental authorization is not supported for installed apps/devices. Separately, the desktop/mobile Picker guide's special Picker authorization flow permits only `drive.file` and says it cannot be combined with other scopes in that flow.

Planning consequence:

- The attractive flow “connect with identity scopes now, add Picker access later” cannot be assumed.
- Phase 0 must canary whether the product uses one standard installed-app grant plus the Picker file grant, one Picker-triggered `drive.file` flow with account identity derived safely, or another supported sequence.
- Refresh-token replacement, account matching, and consent frequency must be measured before Settings UX is frozen.

## Confirmed Scope and Picker Constraints

### `drive.file` is the preferred baseline

Google classifies `drive.file` as a recommended non-sensitive, per-file scope. It covers files the app creates and files the user shares with/opens through the app or Picker. The scope guidance explicitly recommends `drive.file` plus Picker for user control and narrower access; the broad `drive` scope is restricted.

Planning consequence:

- Sprint 119 defaults to `drive.file`.
- Any request for broad Drive scope blocks implementation pending a written necessity proof, privacy/security review, and explicit approval.
- General Drive listing/search is out of scope and unnecessary for the product promise.

### Desktop/mobile Picker can grant one selected file

Google's desktop/mobile Picker guide opens a browser tab, requires `prompt=consent` and `trigger_onepick=true`, allows a MIME-type filter, and returns selected `picked_file_ids` through the callback. In that Picker-specific flow, only `drive.file` is permitted.

Planning consequence:

- It is a strong candidate for choosing a default template without broad Drive access.
- Use a Google Docs MIME filter and single selection, then verify the returned ID/type/access in the host.
- The returned file ID and authorization code are sensitive callback inputs; the webview must not receive them.
- Cancel, wrong type, account mismatch, selected file later revoked, and callback replay need explicit handling.

## Confirmed Drive Import/Update Behavior

### Markdown is an officially listed import format

Google's upload guide says supported conversions should be read dynamically from the Drive `about.importFormats` resource. Its common conversion table includes Microsoft Word, HTML, RTF, plain text, and **Markdown** as sources for Google Docs.

Planning consequence:

- Direct Markdown import is a first-class Phase 0 candidate, not an undocumented shortcut.
- Documentation confirms convertibility, not Ritemark fidelity. Tables, code blocks, images, Mermaid, frontmatter, template styles, and unsafe/comment stripping still need fixtures.
- The canary should verify `about.importFormats` at runtime or record the approved fallback behavior rather than hardcoding indefinite provider support.

### `files.update` targets an existing file ID and can replace full contents

The `files.update` reference uses `PATCH /upload/drive/v3/files/{fileId}`, accepts media, and permits `drive.file`. Google's upload guide says uploading and converting media during an update to a Google Docs/Sheets/Slides file replaces the full contents.

Planning consequence:

- This is a plausible same-ID one-way Sync primitive for Markdown or DOCX conversion.
- “Full contents replaced” matches the product contract but creates a destructive remote-edit warning requirement.
- Template header/footer/style survival, revision/version fields, image treatment, and failure atomicity must be canaried; the docs do not establish the required fidelity.

### Pre-generated upload IDs do not solve converted Google Doc Create idempotency

The upload guide says pre-generated IDs can make some uploads safely retryable after indeterminate server errors, but also says they are not supported for creation through conversion to Google Workspace file formats.

Planning consequence:

- Markdown/DOCX→Google Docs Create cannot assume a pre-generated file ID will prevent duplicate creations.
- Phase 0 must choose an idempotency/orphan-recovery strategy, potentially using verified app properties or another supported marker where permitted.
- Blind retry after a timeout is explicitly unsafe until outcome verification is designed.

### Template copy is available under `drive.file`

`files.copy` creates a copy of an addressed file, returns a File resource, and lists `drive.file` as an accepted scope.

Planning consequence:

- Copy-template-then-replace-body is technically plausible after the user grants access to the template.
- It does not prove which template elements survive a later Drive import/update or Docs body replacement.
- Copy comments should not be inherited inadvertently; the exact `copyComments` and metadata behavior needs a fixture/canary.

## Confirmed Docs API Behavior

### `documents.batchUpdate` can use `drive.file`

The Docs reference accepts `drive.file`, `drive`, or `documents` authorization. A batch addresses the exact `documentId`.

Planning consequence:

- A native mapper does not inherently require broader scope than the Drive-import candidates.
- The chosen file must still be created or copied through an approved Drive/Docs sequence.

### A valid batch applies together; revision control exists

Google says every request in a batch is validated before application; if one is invalid, the whole request fails. Valid updates are applied together atomically. `WriteControl` can require the latest revision or target a recent revision, with documented collaborator-change behavior.

Planning consequence:

- Native Docs requests offer the strongest explicit concurrency controls of the three candidates.
- The team still must construct correct document indices and multi-stage image/table operations; “batch atomic” does not automatically cover every request across multiple API calls.
- `requiredRevisionId` is a candidate for detecting/avoiding overwrite of remote edits, but the product is still one-way and should warn rather than imply merge.

### Native mapping is broad

The Docs request surface includes text insertion/deletion, paragraph/text styles, bullets, tables, inline images, headers/footers, and more. That provides control but shifts conversion ownership into Ritemark.

Planning consequence:

- Native Docs API may preserve semantics best but has the largest implementation and index-testing surface.
- It must beat the import candidates measurably; control alone is not sufficient justification.

## Phase 0 Decision Matrix

Each row needs observed evidence, not an intuition score.

| Decision dimension | Direct Markdown import | DOCX import | Native Docs API |
|---|---|---|---|
| Headings/inline/list fidelity | canary | canary against current Word result | mapper fixtures |
| Tables/code/blockquote | canary | canary | mapper fixtures |
| Local/remote/data images | canary | current loader + import canary | upload/inline-image design |
| Mermaid | canary after current inline step | current inline step + import canary | render/upload/request design |
| Comments/unsafe markup | normalizer + request assertion | normalizer + request assertion | normalizer + request assertion |
| Template survival | copy + update canary | copy + update canary | explicit body replacement canary |
| Same file ID | `files.update` proof | `files.update` proof | documentId proof |
| Remote-edit detection | Drive version/revision proof | Drive version/revision proof | Docs revision/write control proof |
| Create idempotency | conversion response-loss canary | conversion response-loss canary | create/copy response-loss canary |
| Mutation atomicity | provider canary | provider canary | batch atomic within request; multi-call audit |
| Payload/size/latency | measured | measured | measured/request-count bound |
| Existing code reuse | moderate | highest after pure buffer extraction | lowest |
| Maintenance/testing cost | measured estimate | measured estimate | measured estimate |

## External Release Blockers

These are not code tasks that can be inferred or completed without an owner:

- Google Cloud project and billing/organization ownership.
- Drive API, Docs API, and Picker API enablement required by the selected design.
- OAuth consent application name, support email, authorized domains/privacy policy where required, user type, publishing status, and verification status.
- Desktop/client IDs per platform if Google requires distinct credentials; release configuration injection and rotation ownership.
- Dedicated test accounts and a production-like canary account.
- Evidence that shipped users do not receive seven-day Testing refresh tokens or an unverified-app block inconsistent with release acceptance.
- Quota monitoring/support playbook and provider-policy compliance.

## Phase 0 Exit Questions

1. Can one supported installed-app/Picker grant give durable `drive.file` access plus enough stable account identity without an unsupported incremental-auth sequence?
2. Which conversion candidate wins the complete fixture and template matrix?
3. Can `files.update` conversion preserve the destination ID and approved template elements across Markdown and DOCX inputs?
4. Which remote version/revision signal reliably detects edits since last Sync for the selected path?
5. How does Create recover from an indeterminate response without duplicate Google Docs, given converted Workspace creation cannot use pre-generated IDs?
6. Which image flow stays within least privilege, payload limits, and failure atomicity?
7. Is the Google OAuth application operationally production-ready for a public v1.11 release?

Until all seven have accepted evidence in `research/integration-decisions.md`, Sprint 119 remains research-only.
