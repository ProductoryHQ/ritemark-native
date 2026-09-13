# Sprint 119 Spec — Publish to Google Docs

**Parent:** [sprint-plan.md](./sprint-plan.md) · **Release:** [v1.11.0](../release-plan.md) · **Issue:** pending · **Evidence:** [current-state audit](./research/current-state-audit.md), [Google API contract audit](./research/google-api-contract-audit.md)

## Purpose

Let an author connect a Google account once, optionally choose a Google Docs template, create a Google Doc from the active Ritemark Markdown document, and explicitly push later revisions to the same Google file ID.

## Product Boundary

- Ritemark Markdown is the only source of truth.
- Create and Sync are explicit user actions; there is no background synchronization.
- Sync replaces the published document body. It does not merge remote edits.
- A local document has zero or one Google Docs binding. One Google Doc may not be silently rebound to another local document.
- Account access is user-scoped OAuth. This sprint does not introduce service accounts, shared credentials, or broad Drive access.
- Conversion begins from the same normalized export representation used to strip editor-only comments and unsafe markup.

## Proposed Domain Model

Phase 0 must freeze the exact schema and migration rules. The planning baseline is:

```ts
interface GoogleDocsBindingV1 {
  schemaVersion: 1
  documentUri: string
  workspaceIdentity: string | null
  accountSubject: string
  accountDisplayHint: string | null
  fileId: string
  webViewLink: string
  templateFileId: string | null
  createdAt: string
  lastSuccessfulSyncAt: string
  lastPublishedSourceHash: string
  remoteVersion: string | null
}
```

The host owns this record. The editor webview receives a redacted projection only: bound/unbound, account hint if approved, last successful sync time, safe document URL, and current operation state. It never receives OAuth tokens.

## Requirements

### R1: Account connection and identity

As a user, I want to connect the intended Google account and understand its state, so publishing never depends on an invisible or ambiguous identity.

Acceptance criteria:

- Settings has a distinct **Google Docs publishing** card; it is not conflated with the existing Google AI API key.
- The card reports `not connected`, `connecting`, `connected`, `reauthorization required`, `configuration unavailable`, and `error` as distinct states.
- Connect begins only from a user gesture and uses the approved installed-desktop OAuth flow in the system browser.
- The callback is bound to a single attempt using state and PKCE (or the exact approved equivalent); stale, mismatched, replayed, or duplicate callbacks cannot complete another attempt.
- Success shows a non-secret account identity sufficient to prevent accidental account use. Tokens and authorization codes never reach the settings webview.
- Cancel, browser close, redirect timeout, occupied loopback port, malformed callback, consent denial, and provider error end in recoverable states.
- Disconnect revokes remotely when practical, deletes local tokens, clears the active account projection, and retains existing document bindings as inaccessible history until the user explicitly rebinds or reconnects the matching account.
- Account switching cannot silently redirect an existing binding to a different account or create a replacement file.

### R2: Least privilege and secret safety

As a user, I want Ritemark to have only the access required for files I choose or create.

Acceptance criteria:

- Phase 0 proves the narrowest scope set. The default target is `drive.file`; any broader scope requires a written blocker, threat review, and Jarmo approval.
- Template selection under least privilege uses the approved Picker/desktop Picker grant or another officially supported per-file grant; Ritemark does not enumerate the whole Drive by default.
- Access tokens, refresh tokens, authorization codes, PKCE verifier, client credential material, and raw API response bodies containing them are excluded from webview state, Memento, bindings, Markdown, telemetry, support logs, and errors.
- Refresh/access tokens are stored only in VS Code SecretStorage under versioned, Google-Docs-specific keys and are deleted on explicit disconnect.
- Installed-desktop OAuth public configuration is separated from secrets. Missing or invalid release configuration disables Connect with an actionable build/configuration message.
- All logging uses an allowlist and redacts authorization headers, query parameters, file content, tokens, user email, Google file IDs where not essential, and provider error bodies.
- Redirect listeners bind only as broadly and as long as the approved installed-app flow requires; they close on success, failure, cancel, timeout, and extension disposal.
- The OAuth consent application's publication/verification state, test users, ownership, and redirect configuration are release blockers tracked outside product credentials.

### R3: Template grant and lifecycle

As a user, I want an optional default template without granting broad Drive access or producing misleading formatting promises.

Acceptance criteria:

- Settings offers **Choose template**, current template identity, **Change**, and **Remove default** only when the account is connected and the feature flag is on.
- The approved picker restricts selection to compatible Google Docs files and returns only the fields required by the host.
- Choosing a template verifies file type and access before committing the default.
- Cancel leaves the previous template unchanged.
- Revoked, deleted, moved-to-inaccessible, wrong-type, or cross-account templates show **Template unavailable** and do not fall back silently.
- Create either uses the chosen template under the approved copy/replace semantics or stops with an explicit choice to remove/change the template; it never quietly creates an untemplated Doc.
- Sync uses the already-bound destination and does not need the original template to remain accessible.
- Template semantics are documented by fixture: which body/style/header/footer/page settings survive, which are replaced, and which are unsupported.

### R4: Conversion fidelity

As an author, I want the Google Doc to preserve the supported document structure and never expose editor-only data.

Acceptance criteria:

- Phase 0 compares direct Markdown import, DOCX upload/conversion, and native Docs API requests using one versioned fixture corpus and a scored decision record.
- The corpus covers title/frontmatter projection, headings 1–6, paragraphs, bold, italics, inline code, code blocks, ordered/unordered/nested lists, blockquotes, links, horizontal rules, tables, local images, remote/data images under approved policy, Mermaid output, Unicode/emoji, and empty documents.
- Ritemark comment nodes and comment attributes are removed at `buildNormalizedExportHtml`; comment text/metadata never reaches Google.
- Script, iframe, event-handler, unsupported URI, and unsafe external-resource content is stripped or rejected before upload.
- Local images are resolved relative to the source document with the existing safe image loader or an approved successor; missing/oversized/unsupported images produce an honest preview/error policy.
- The chosen adapter is deterministic for the same normalized input, document URI, properties, and template.
- Unsupported formatting is documented and degrades predictably; it may not disappear without an explicit fixture expectation.
- Conversion failures do not create or update a binding and do not mutate the remote destination.

### R5: Create semantics

As a user, I want Create Google Docs to result in exactly one discoverable remote document.

Acceptance criteria:

- An unbound, saved Markdown document shows **Create Google Docs**. An untitled/dirty document follows the approved save/snapshot rule before publishing; the uploaded content must match what the confirmation describes.
- Preflight verifies feature flag, connected account, template availability, supported document URI, normalized export payload, and absence of another active operation for the same binding key.
- The user sees progress stages that distinguish preparing, converting, uploading, and verifying.
- Create uses an idempotency strategy approved in Phase 0. Double click, late UI retry, panel reload, and response loss cannot silently create multiple accepted bindings.
- A template flow copies the exact selected template before body replacement only when the selected conversion path requires it.
- The host verifies the returned file ID, MIME type, account ownership/access, and browser URL before storing a binding.
- Binding persistence is atomic and occurs only after remote success and verification. A local write failure after remote creation reports an orphan-recovery path with the created Doc link; it never claims the document is bound.
- Success changes the action to **Sync**, shows last-published state, and offers **Open Google Doc** for the exact returned file.
- Create never overwrites a pre-existing binding. Rebinding requires an explicit recovery/remove-binding decision.

### R6: Local-to-remote binding identity

As a user, I want Sync to target the correct Google Doc even when local files are renamed or copied.

Acceptance criteria:

- Binding keys use canonical document URI plus approved workspace identity; path normalization is platform-correct and does not rely on title or content hash as identity.
- A rename/move observed through VS Code migrates the binding transactionally from old URI to new URI.
- If the destination URI already has another binding, the move is blocked from automatic migration and presents a recovery decision.
- Save As and copied files are unbound by default, even if content/frontmatter is identical. They must use Create or an explicit future rebind flow.
- Opening the same URI in multiple editor instances produces one consistent host binding projection.
- Missing/corrupt/unknown-schema registry data fails closed and does not guess a remote target.
- Bindings record the Google account subject. A different connected account cannot Sync until the matching account is restored or the binding is explicitly removed/recreated.
- Removing a binding is separate from deleting the Google Doc or disconnecting the account and requires confirmation explaining the effect.
- Store writes are atomic and recover from partial temp files without losing the last valid registry.

### R7: Same-ID Sync and overwrite honesty

As a user, I want every Sync to update the bound Google Doc and to understand that remote edits may be replaced.

Acceptance criteria:

- Sync reads the bound file ID from the host registry; it never chooses a file by title, search result, active Drive page, template, or most-recent creation.
- Preflight verifies matching account and remote accessibility/type before conversion or mutation.
- The UI clearly says that Sync replaces the published contents and may overwrite edits made directly in Google Docs.
- Phase 0 freezes whether the warning is per-sync, first-sync, or persistently adjacent copy; the user can never encounter destructive semantics only after the request starts.
- The chosen Google operation preserves the exact file ID. A missing/deleted/inaccessible/wrong-type target does not trigger automatic Create.
- A successful remote update is verified, then atomically records remote version/revision where available, source hash, and last successful sync time.
- If the source hash matches the last successful publication and remote verification is unchanged under the approved rule, Sync may report **Already up to date** without mutation.
- If remote version evidence indicates possible manual edits, the approved warning/escalation is shown. Sprint 119 does not merge those changes.
- Success opens or links to the same Google Doc; every retry remains bound to that exact ID.

### R8: Failure, retry, and recovery

As a user, I want failures to preserve both my Markdown and the last honest binding state.

Acceptance criteria:

- Offline/DNS, timeout, OAuth refresh failure, revoked grant, 401, 403, 404, quota/429, provider 5xx, malformed response, conversion failure, upload interruption, verification failure, and local persistence failure map to distinct actionable result classes.
- Retry policy is bounded, cancellable before remote mutation where safe, honors server retry guidance, and never retries authentication/permission/schema errors blindly.
- Create retry uses the approved idempotency/orphan-detection mechanism; Sync retry targets only the existing binding.
- The last successful source hash/version/time remain unchanged on failed Sync.
- Failure after possible remote mutation is reported as **Could not verify** rather than **Failed with no changes**; the next action re-verifies before mutating again.
- 401/revoked grant transitions account state to reauthorization required without deleting bindings.
- 404/inaccessible target offers Open help, reconnect matching account, remove binding, or Create after explicit removal; it never auto-rebinds.
- Cancel is honest about the stage: local preflight/conversion can cancel cleanly; an in-flight provider mutation may become **finishing/verification required** instead of pretending it was undone.
- Local Markdown, comments, editor state, existing PDF/Word export, and remote file identity remain intact on every error.

### R9: Concurrency, observability, and privacy

As the team, we want deterministic operations and useful support evidence without leaking content or identity.

Acceptance criteria:

- The host serializes Create/Sync per binding key and defines whether unrelated documents may publish concurrently.
- Every request has a host-generated operation ID and generation; stale webview results cannot overwrite newer UI state.
- Settings account changes and editor publish operations coordinate through one account-state service rather than separate token readers.
- Extension shutdown/disposal closes callback listeners and records no false success. In-flight operations settle under the approved bounded shutdown rule.
- Telemetry, if retained, records only allowlisted event names, adapter, duration bucket, and redacted result class; no content, path, email, title, template/file ID, URL, token, or provider body.
- User-facing support details use stable internal error codes and safe stage information, not raw provider payloads.
- Fake transport tests can assert requests without real tokens. Live canary credentials exist only in a dedicated test account/environment and never in fixtures or CI logs.
- Debug logging defaults off or redacted and has a documented cleanup path.

### R10: Flag, accessibility, docs, and regression safety

As the team, we want the integration independently disableable and release evidence complete.

Acceptance criteria:

- `google-docs-publishing` is experimental/default true and gates Settings UI, editor commands/menu, OAuth callbacks, picker actions, and host publish handlers.
- Flag-off preserves stored tokens and bindings but exposes no active publishing surface; explicit disconnect remains available through an approved safe path or documented recovery command.
- Controls and progress/errors are keyboard and screen-reader accessible, focus-safe, non-color-only, high-contrast compatible, and usable at narrow editor width and 200% zoom.
- The editor action is not enabled for unsupported/untitled contexts without explaining the required next action.
- Existing PDF, Word, Copy Markdown, export normalization, image handling, and Settings API-key flows continue to pass.
- Architecture, privacy/security docs, user guide, changelog, v1.11 release notes, issue/tracker, external OAuth blockers, and support/recovery instructions are current.
- Focused unit/integration/webview tests, authenticated canary, native macOS/Windows matrix, extension/webview builds, and repository QA pass before readiness.

## Non-Requirements

- Two-way synchronization, conflict merge, remote edit import, change tracking, Google Docs comments, suggestions, or collaboration events.
- Background/automatic sync, periodic sync, file watching, or sync-on-save.
- General Drive browsing, sharing/permission management, folder management, or deleting remote Docs.
- Google Sheets, Slides, service accounts, domain-wide delegation, or administrator-managed shared credentials.
- Publishing an unsaved transient editor buffer unless Phase 0 explicitly approves and documents snapshot identity semantics.
- Perfect parity with Google Docs for unsupported Markdown/extensions; the approved fidelity matrix is the contract.

## Phase 0 Decisions

Phase 0 ends with an approved `research/integration-decisions.md` covering:

1. OAuth desktop flow, redirect/PKCE/state rules, scope set, consent publication status, test-account ownership, and release credential injection.
2. Direct Markdown import vs DOCX conversion vs native Docs API, scored on fidelity, template behavior, update atomicity, payload size, image support, maintainability, and testability.
3. Template selection/grant/copy semantics under the chosen least-privilege scope.
4. Exact Create and same-ID Sync API sequence, idempotency/orphan recovery, remote verification/version checks, and retry/cancel behavior.
5. Versioned binding schema, workspace identity, rename/copy/Save As/account-switch/missing-target semantics, atomic persistence, and migration.
6. UI copy/state model in [design.md](./design.md), including overwrite warning frequency and dirty/untitled document behavior.
7. Feature flag, telemetry allowlist, threat/privacy model, dependency choice, architecture impact, and native/live canary matrix.

No OAuth registration, dependency addition, message-contract change, or product code starts before this gate is approved.
