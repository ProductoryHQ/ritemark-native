# Sprint 119 Scenarios — Publish to Google Docs

Behavioral acceptance scenarios for [spec.md](./spec.md). A ★ scenario requires manual/native evidence in addition to automated coverage. Provider failures are simulated with a fake transport unless the scenario explicitly calls for an authenticated canary.

## Account connection and identity (R1)

### S1 ★ — Connect from Settings

**Given** publishing is enabled and no Google account is connected<br>
**When** the user chooses Connect Google account and completes consent in the system browser<br>
**Then** Settings shows the verified account identity, the callback listener closes, and no token or code enters the webview.

### S2 — User cancels before opening the browser

**Given** the Connect action is available<br>
**When** the user cancels the host-side start or account flow before authorization<br>
**Then** state returns to not connected and no token, listener, or partial account state remains.

### S3 ★ — Consent denied or browser closed

**Given** an OAuth attempt is pending<br>
**When** the user denies consent or never returns before timeout<br>
**Then** Settings reports a recoverable cancellation/timeout, closes local listeners, and offers Connect again.

### S4 — Callback state/PKCE mismatch

**Given** one OAuth attempt is pending<br>
**When** a callback has a stale/missing state, wrong verifier context, replayed code, or wrong attempt generation<br>
**Then** it is rejected, no token is stored, and the active attempt remains safe or fails explicitly.

### S5 — Duplicate callback

**Given** one valid callback already completed<br>
**When** the browser repeats or reloads the callback<br>
**Then** it cannot overwrite the stored account or create a second completion event.

### S6 — Loopback listener unavailable

**Given** the approved flow needs a local loopback listener<br>
**When** its selected port cannot bind or the callback cannot be received<br>
**Then** Settings reports an actionable connection error and leaves no listener/token behind.

### S7 — Disconnect connected account

**Given** an account and existing document bindings exist<br>
**When** the user confirms Disconnect<br>
**Then** local tokens are deleted, remote revocation is attempted safely, bindings remain as inaccessible history, and editor actions require the matching account.

### S8 — Switch to a different account

**Given** a document is bound under account A<br>
**When** the user connects account B<br>
**Then** the document reports account mismatch and cannot Sync or silently create/rebind.

## Least privilege and secret safety (R2)

### S9 — Scope request is exact

**Given** Phase 0 approved `drive.file` and any identity scopes required by the chosen flow<br>
**When** Connect builds the authorization request<br>
**Then** it asks for exactly the approved set and no broad Drive scope.

### S10 — Missing release OAuth configuration

**Given** the build lacks valid installed-desktop public OAuth configuration<br>
**When** Settings loads or Connect is attempted<br>
**Then** Connect is disabled with a build/configuration message and no malformed request opens.

### S11 — Token/log redaction

**Given** a provider error includes authorization headers, tokens, email, file IDs, content, or raw response bodies<br>
**When** errors, telemetry, or diagnostic details are recorded<br>
**Then** only allowlisted error/stage data remains and secret/content markers are absent.

### S12 — Flag disabled during a pending callback

**Given** an OAuth attempt is pending<br>
**When** the publishing flag becomes disabled or the extension disposes<br>
**Then** the listener closes, callback is rejected, and no token is stored through the disabled feature.

## Template grant and lifecycle (R3)

### S13 ★ — Choose a compatible Google Docs template

**Given** the correct account is connected<br>
**When** the user opens the approved picker and selects an accessible Google Doc<br>
**Then** the host verifies type/access and Settings commits its safe identity as the default template.

### S14 — Cancel template picker

**Given** a default template already exists<br>
**When** the user opens Change and cancels the picker<br>
**Then** the previous template remains unchanged and no error is shown.

### S15 — Select wrong file type

**Given** picker/provider data returns a non-Google-Docs file<br>
**When** the host validates it<br>
**Then** selection is rejected and the previous template remains unchanged.

### S16 — Template permission is revoked

**Given** a default template was valid<br>
**When** preflight finds it deleted or inaccessible<br>
**Then** Settings/editor reports Template unavailable and Create asks the user to change/remove it rather than silently falling back.

### S17 ★ — Create from template

**Given** a valid template is selected and the template path won Phase 0<br>
**When** Create succeeds<br>
**Then** the destination contains the approved surviving template elements and normalized Ritemark body according to fixtures.

### S18 — Sync after template disappears

**Given** a bound Doc was originally created from a template<br>
**When** that template later becomes inaccessible and the user Syncs<br>
**Then** Sync targets the bound Doc without needing the template again.

## Conversion fidelity (R4)

### S19 — Headings, paragraphs, and inline styles

**Given** the canonical fixture contains headings 1–6, paragraphs, bold, italic, inline code, links, Unicode, and emoji<br>
**When** each candidate adapter renders it<br>
**Then** scored results match the documented semantic expectations.

### S20 — Lists and blockquotes

**Given** ordered, unordered, nested, mixed lists and blockquotes<br>
**When** converted<br>
**Then** nesting, order, readable indentation, and text content meet the fixture contract.

### S21 — Tables and empty cells

**Given** tables with headers, alignment metadata, Unicode, empty cells, and long content<br>
**When** converted<br>
**Then** the chosen adapter produces the documented Docs table structure without leaking editor attributes.

### S22 ★ — Local and rendered images

**Given** valid local PNG/JPEG and rendered Mermaid output plus missing/unsupported/oversized cases<br>
**When** published from a real workspace<br>
**Then** approved images render within bounds and every omitted/rejected image follows the documented warning/error rule.

### S23 — Comments never publish

**Given** standalone Ritemark comments, anchored comments containing `>`, and visible anchored text<br>
**When** normalized and converted<br>
**Then** comment bodies/metadata are absent while the visible anchored text remains.

### S24 — Unsafe HTML never publishes

**Given** script, iframe, event attributes, unsafe URI, and malformed markup fixtures<br>
**When** normalized<br>
**Then** unsafe payloads are stripped/rejected before any provider call.

### S25 — Empty document and frontmatter projection

**Given** an empty body with or without title/author/date properties<br>
**When** converted<br>
**Then** the output is valid and the approved metadata projection is deterministic.

### S26 — Conversion failure is pre-mutation

**Given** an input the chosen adapter cannot convert<br>
**When** Create or Sync is requested<br>
**Then** conversion fails before remote mutation, leaves binding/history unchanged, and names the unsupported element safely.

## Create semantics (R5)

### S27 ★ — Create an untemplated Google Doc

**Given** a saved, unbound document and connected account with no template<br>
**When** the user chooses Create Google Docs<br>
**Then** exactly one verified Google Doc is created, one binding is stored, the action becomes Sync, and Open Google Doc targets its returned ID.

### S28 — Dirty document contract

**Given** the editor has unsaved changes<br>
**When** Create is chosen<br>
**Then** the approved save/snapshot step makes the source identity and uploaded content explicit; stale on-disk content is never published under a success claim.

### S29 — Untitled document

**Given** the editor has no durable URI<br>
**When** publishing is considered<br>
**Then** Create is disabled or first invokes Save under the approved rule, with no binding to a transient URI.

### S30 — Double-click and repeated request

**Given** Create is already in progress<br>
**When** the user double-clicks, the webview repeats the request, or reloads and retries<br>
**Then** the host accepts one logical operation and does not bind multiple Docs.

### S31 — Remote success, local binding write failure

**Given** Google returns a verified created file but the local registry cannot commit<br>
**When** Create completes<br>
**Then** the UI reports an unbound orphan with the exact Doc link/recovery ID and never claims Sync is ready.

### S32 — Response lost after possible creation

**Given** the upload may have completed but the response is lost<br>
**When** bounded recovery runs<br>
**Then** the approved idempotency/app-property/recovery lookup distinguishes the created Doc or reports verification required; it does not blindly create another.

### S33 — Create requested for an already-bound document

**Given** a valid binding exists<br>
**When** a stale UI sends Create<br>
**Then** the host rejects it with the current binding projection and performs no provider mutation.

## Local-to-remote binding identity (R6)

### S34 — Reload and reopen

**Given** a successful binding exists<br>
**When** the editor/webview/app reloads and the same document URI reopens<br>
**Then** the host restores Sync, last-success metadata, account match, and exact safe link.

### S35 ★ — Rename within VS Code

**Given** a bound document<br>
**When** VS Code reports a successful rename/move to an unbound destination<br>
**Then** the binding migrates atomically and Sync still targets the original Google file ID.

### S36 — Rename collides with another binding

**Given** source and destination paths have different bindings<br>
**When** a rename/move is reported<br>
**Then** automatic migration fails closed and requires an explicit recovery choice.

### S37 — Save As creates an unbound copy

**Given** a bound document<br>
**When** it is saved as a new file<br>
**Then** the new URI has no binding and offers Create; the original retains its binding.

### S38 — Filesystem copy outside Ritemark

**Given** a bound file is copied in Finder/Explorer or another tool<br>
**When** the copy opens in Ritemark<br>
**Then** it is unbound even though contents and frontmatter match.

### S39 — Same document in two editors

**Given** two editor webviews show the same URI<br>
**When** one completes Create/Sync or removes a binding<br>
**Then** both receive the same host-owned generation and neither can overwrite it with stale state.

### S40 — Corrupt or unknown binding schema

**Given** the registry record is corrupt or newer than supported<br>
**When** the document opens<br>
**Then** publishing fails closed with recovery/support guidance and no remote request.

### S41 — Remove local binding

**Given** a valid binding exists<br>
**When** the user confirms Remove publishing link<br>
**Then** only local association is removed; the Google Doc and account tokens remain unchanged.

### S42 — Account mismatch after reload

**Given** the stored binding belongs to account A and account B is connected<br>
**When** the document opens<br>
**Then** it shows matching-account-required and exposes no enabled Sync mutation.

## Same-ID Sync and overwrite honesty (R7)

### S43 ★ — Sync the bound Doc

**Given** a document is bound and its Markdown changed<br>
**When** the user accepts the overwrite contract and Sync succeeds<br>
**Then** the same Google file ID is updated, verified, linked, and recorded with a new source hash/time/version.

### S44 — Remote file selected by ID only

**Given** Drive contains duplicate titles and recently opened Docs<br>
**When** Sync runs<br>
**Then** only the registry file ID is addressed; title/search/recency/template are irrelevant.

### S45 — Source is already up to date

**Given** source hash and approved remote evidence match the last successful publication<br>
**When** Sync is chosen<br>
**Then** the product reports Already up to date or performs the approved harmless verification without body replacement.

### S46 — Manual remote edits detected

**Given** remote version evidence differs since the last sync<br>
**When** Sync preflight runs<br>
**Then** the user receives the approved stronger overwrite warning and chooses overwrite or cancel; no merge is offered.

### S47 — Warning is visible before mutation

**Given** Sync replaces the remote body<br>
**When** the user initiates it<br>
**Then** overwrite semantics are visible under the Phase 0 frequency rule before the first provider mutation.

### S48 — Bound Doc deleted or inaccessible

**Given** remote preflight returns not found/inaccessible<br>
**When** Sync is chosen<br>
**Then** no replacement is created; recovery offers reconnect, open help, or explicit local binding removal.

### S49 — Bound target has wrong MIME type

**Given** the stored ID resolves to an incompatible resource<br>
**When** Sync preflight runs<br>
**Then** it fails closed without content update or automatic binding change.

### S50 — Original template unavailable

**Given** the bound Doc was created from a template that is now gone<br>
**When** Sync runs<br>
**Then** it updates the same bound Doc using the approved adapter and does not copy a new template.

## Failure, retry, and recovery (R8)

### S51 — Offline before mutation

**Given** the machine is offline<br>
**When** Create/Sync preflight fails<br>
**Then** the UI reports Offline, no remote mutation is claimed, and retry preserves the same intent.

### S52 — Access token refresh succeeds

**Given** the access token expired and a valid refresh token exists<br>
**When** a publish operation requires authorization<br>
**Then** the host refreshes once, stores the replacement safely, and continues without exposing credentials.

### S53 ★ — Refresh token revoked/expired

**Given** Google rejects refresh<br>
**When** Create/Sync begins<br>
**Then** account state becomes Reauthorization required, binding remains, and reconnecting the matching account can resume.

### S54 — Permission denied

**Given** the account lacks access to the selected template or bound Doc<br>
**When** the provider returns 403<br>
**Then** the UI identifies the affected resource class, does not retry blindly, and leaves local state honest.

### S55 — Rate limit and retry guidance

**Given** Google returns 429 or a retryable quota result<br>
**When** retry guidance is present<br>
**Then** bounded backoff honors it, Cancel remains honest, and operation IDs prevent duplicate acceptance.

### S56 — Provider 5xx or timeout before known mutation

**Given** a transient provider failure occurs before accepted mutation<br>
**When** retry budget is available<br>
**Then** bounded retry continues the same logical operation and reports the final safe class.

### S57 — Timeout after possible mutation

**Given** the request may have mutated the remote Doc but the response is lost<br>
**When** the host cannot prove outcome<br>
**Then** state becomes Could not verify and a re-verification step occurs before any retry mutation.

### S58 — Malformed provider response

**Given** a success response lacks required ID/type/version/link fields<br>
**When** it is validated<br>
**Then** it is not committed as success and safe diagnostics name the schema failure.

### S59 — Cancel during local conversion

**Given** conversion is running before provider mutation<br>
**When** the user cancels<br>
**Then** the operation ends Cancelled and binding/remote state remain unchanged.

### S60 — Cancel during provider mutation

**Given** an upload/update request is in flight<br>
**When** the user requests Cancel<br>
**Then** the UI reports Finishing or Verification required under the frozen contract rather than claiming remote rollback.

### S61 — Failed Sync preserves last success

**Given** a previous Sync succeeded<br>
**When** a later Sync fails<br>
**Then** last successful hash/time/version and binding remain unchanged and the failed attempt is separately visible.

### S62 — Local source/export regression isolation

**Given** any Google publish error<br>
**When** the operation ends<br>
**Then** Markdown, comments, unsaved editor state, PDF/Word export, and Copy Markdown remain usable and unmodified.

## Concurrency, observability, and privacy (R9)

### S63 — Two Sync requests for one binding

**Given** Sync is in progress<br>
**When** another editor instance sends Sync for the same binding key<br>
**Then** the host deduplicates/serializes under one active operation and stale completion cannot win.

### S64 — Create for two different documents

**Given** two unbound documents request Create<br>
**When** concurrency is allowed or queued under the Phase 0 rule<br>
**Then** operation state and returned bindings cannot cross between documents.

### S65 — Account disconnect during publish

**Given** a publish is in progress<br>
**When** Settings confirms Disconnect<br>
**Then** account controller and publisher settle under one coordinated rule; no subsequent retry uses deleted tokens.

### S66 — Webview reload during publish

**Given** the host operation continues or settles while the editor reloads<br>
**When** a new webview attaches<br>
**Then** it receives the current host generation/result and cannot resubmit a duplicate through stale local state.

### S67 — Extension shutdown

**Given** an OAuth or publishing operation is active<br>
**When** the extension host disposes<br>
**Then** listeners/resources close and the next launch sees honest binding/recovery state, never fabricated success.

### S68 — Telemetry allowlist

**Given** Create/Sync succeeds or fails<br>
**When** telemetry is emitted<br>
**Then** it contains only approved event/result/timing/adapter fields and excludes content, URI/path, account, title, template/file IDs, URLs, and provider bodies.

### S69 — Fake transport and live credentials separation

**Given** automated suites and an authenticated canary both exist<br>
**When** tests run<br>
**Then** ordinary tests need no real token and canary secrets/results are excluded from fixtures, snapshots, logs, and commits.

## Flag, accessibility, docs, and QA (R10)

### S70 — Feature flag off

**Given** `google-docs-publishing` is disabled<br>
**When** Settings/editor load and forged messages arrive<br>
**Then** publishing UI is absent, host handlers reject requests, PDF/Word/Copy remain, and stored tokens/bindings are not deleted.

### S71 — Feature flag re-enabled

**Given** flag-off preserved account and binding state<br>
**When** the flag is re-enabled<br>
**Then** Settings/editor restore the verified projection without creating or syncing anything automatically.

### S72 ★ — Keyboard and screen reader flow

**Given** a keyboard/screen-reader user<br>
**When** they connect, choose template, Create, handle warning/error, open the Doc, and Sync<br>
**Then** accessible names, focus order/restoration, live states, dialog semantics, and error association are complete.

### S73 ★ — Narrow width, zoom, contrast, and motion

**Given** narrow editor/Settings width, 200% zoom, high contrast, or reduced motion<br>
**When** publishing states render<br>
**Then** actions/status/copy remain readable and operable without clipping or color-only meaning.

### S74 — Existing Google AI settings remain independent

**Given** Google AI API key is configured or absent<br>
**When** Google Docs account is connected/disconnected<br>
**Then** neither setting changes or impersonates the other and both labels remain unambiguous.

### S75 — Existing exports regressions

**Given** the export fixture suite<br>
**When** Google publishing code is present or flagged off<br>
**Then** PDF, Word, Copy Markdown, comments stripping, images, and Save dialogs behave as before.

### S76 ★ — Release candidate canary

**Given** packaged macOS arm64/x64 and native Windows candidates with approved production OAuth configuration and a dedicated test account<br>
**When** Connect, template Create, untemplated Create, Sync, revoke/re-auth, open-link, and disconnect are exercised<br>
**Then** all pass with the same IDs and redacted evidence required by the release tracker.

## Scenario Evidence Rule

Every ★ scenario needs dated platform/build evidence linked from `tasks.md` or the sprint closeout. Every non-star scenario needs an automated assertion or a written reason approved before the task is checked. Passing Create alone is not sufficient: same-ID Sync, account mismatch, response-loss recovery, copied-file isolation, and flag-off forged-message rejection are release-critical.
