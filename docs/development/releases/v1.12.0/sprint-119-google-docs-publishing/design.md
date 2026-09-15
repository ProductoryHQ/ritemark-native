# Sprint 119 Design — Google Docs Publishing

Interaction design for [spec.md](./spec.md). Copy is a planning baseline and must be approved in Phase 0. Google Docs account access is deliberately separated from the existing Google AI API key.

## Design Principles

- **Name the consequence.** Sync says it replaces the published contents and can overwrite Google-side edits.
- **Show identity before action.** Account, template, and bound/unbound destination are visible where a wrong choice would be costly.
- **One primary action.** An unbound file offers Create; a bound file offers Sync. Never show both as equivalent shortcuts.
- **Host truth only.** Progress and success reflect host/provider verification, not a clicked button or sent webview message.
- **Recovery over guessing.** Missing target, account mismatch, unknown outcome, and orphan creation get distinct next actions.
- **Keep export familiar.** PDF, Word, and Copy Markdown stay in their existing order/behavior.

## Settings: Account Card

### Not connected

```text
Google Docs publishing
Publish a Ritemark document to one Google Doc and sync later changes.

[ Connect Google account ]

Ritemark asks for access only to files it creates or you choose.
This is separate from the Google AI API key below.
```

### Connecting

```text
Google Docs publishing
Waiting for Google…

Finish sign-in in your browser.
[ Open browser again ]  [ Cancel ]
```

The card remains operable while the browser has focus. Status uses a polite live region. Cancel is available until the provider mutation/exchange stage frozen in Phase 0.

### Connected

```text
Google Docs publishing                         Connected
Account: j••••@example.com

Default template
No template selected
[ Choose template ]

[ Disconnect ]
```

Account display may use a full address only if the privacy decision approves it; otherwise use a stable masked hint. The connected state must not display access scopes as vague “full Drive access” copy.

### Template selected

```text
Default template
Course handout template
[ Change ]  [ Remove default ]  [ Open template ]
```

`Open template` is shown only for a verified safe link. Choosing Change and cancelling preserves the current template.

### Template unavailable

```text
Default template                             Needs attention
Course handout template is no longer available to this account.
[ Choose another ]  [ Remove default ]
```

Create does not silently ignore this state. Existing bound Docs can still Sync because their identity no longer depends on the template.

### Reauthorization required

```text
Google Docs publishing                       Reconnect required
Google no longer accepts this connection.

[ Reconnect account ]  [ Disconnect ]

Your existing document links are kept. Reconnect the same account to sync them.
```

### Configuration unavailable

```text
Google Docs publishing                       Unavailable in this build
This Ritemark build is missing its Google connection configuration.
[ Copy support details ]
```

The details include only a stable internal code/build version—never tokens or raw provider data.

## Editor Export Menu

### Unbound, connected, no blocking template issue

```text
Export
  Export PDF
  Export Word
  ──────────────────
  Create Google Docs
  Copy as Markdown
```

If the label is grammatically finalized as **Create Google Doc**, update release/user copy consistently. The voice-memo wording is retained here pending Phase 0 approval.

### Bound and account matches

```text
Export
  Export PDF
  Export Word
  ──────────────────
  Sync Google Doc
  Open Google Doc
  Publishing details…
  Copy as Markdown
```

`Publishing details…` opens a small host-backed dialog/popover with destination link, masked account, last successful sync, and Remove publishing link. It does not expose the raw file ID by default.

### Unbound but not connected

```text
Create Google Docs                         Connect account…
```

Choosing it opens Settings at the Google Docs card. It must not start an OAuth flow from a stale editor message without host validation.

### Account mismatch

```text
Google Doc linked to another account       Reconnect…
```

Detail copy:

```text
This document was published with j••••@example.com.
Connect that account to sync the existing Google Doc.

[ Open Google Docs settings ]  [ Cancel ]
```

There is no “sync with current account” shortcut because it would change destination identity.

## Create Flow

### Confirmation/preflight

```text
Create a Google Doc?

Source: Course-outline.md
Account: j••••@example.com
Template: Course handout template

Ritemark will create one Google Doc and remember its link for later Sync.

[ Create Google Doc ]  [ Cancel ]
```

For an untemplated creation, show `Template: None`. Dirty/untitled source handling precedes this dialog according to the Phase 0 rule so the shown source matches the published snapshot.

### Progress

```text
Creating Google Doc…
Preparing document → Converting → Uploading → Verifying
```

Stages may appear as one changing status line rather than a stepper at narrow width. Do not show percentage unless the transport reports meaningful bounded progress.

### Success

```text
Google Doc created
Future Sync actions will update this same document.

[ Open Google Doc ]  [ Done ]
```

Focus returns to the invoking editor control or moves to the primary success action under the approved dialog convention.

### Remote created, local binding failed

```text
Google Doc created, but Ritemark could not save its link

The Doc was not marked as connected to this Markdown file.
[ Open created Doc ]  [ Retry saving link ]  [ Copy recovery details ]
```

This is not styled as ordinary success and the editor remains unbound until recovery commits.

### Outcome unknown

```text
Creation could not be verified

Google may have received the document. Ritemark will check before trying again.
[ Check result ]  [ Open Google Drive ]  [ Cancel ]
```

No blind **Try again** button is shown until the idempotency/recovery check resolves.

## Sync Flow

### Standard overwrite disclosure

```text
Sync to Google Docs?

This replaces the published document contents with the current Ritemark version.
Edits made directly in Google Docs may be overwritten.

Destination: Course outline
Last synced: 12 minutes ago

[ Sync ]  [ Cancel ]
```

Phase 0 decides whether this is every time, first time plus persistent adjacent copy, or another equally explicit pattern.

### Remote changes detected

```text
Google Doc changed since the last sync

Sync will replace those Google-side changes. Ritemark cannot merge them in this version.

[ Open Google Doc ]  [ Overwrite with Ritemark ]  [ Cancel ]
```

`Overwrite with Ritemark` is visually destructive/cautionary, not the default focused action.

### Sync progress

```text
Syncing Google Doc…
Preparing document → Converting → Updating → Verifying
```

During provider mutation, Cancel may change to **Stop waiting** or disappear under the frozen semantics; it must not claim the remote request was rolled back.

### Success / no-op

```text
Google Doc synced · just now                 [ Open ]
```

```text
Google Doc is already up to date             [ Open ]
```

The success toast/status is based on verified same-ID completion.

## Target and Binding Recovery

### Target missing or inaccessible

```text
The linked Google Doc is unavailable

It may have been deleted, moved out of your access, or belong to another account.
[ Reconnect account ]  [ Open help ]  [ Remove publishing link… ]
```

There is no automatic replacement creation. After explicit Remove publishing link, the file becomes unbound and can Create again.

### Remove publishing link

```text
Remove this publishing link?

Ritemark will forget which Google Doc belongs to this Markdown file.
The Google Doc will not be deleted. Your Google account stays connected.

[ Remove link ]  [ Cancel ]
```

### Rename collision

```text
Publishing link needs attention

The renamed path already belongs to a different Google Doc. Ritemark did not choose between them.
[ View details ]  [ Keep both files unmodified ]
```

Phase 0 decides the exact recovery UI. The core rule is fail closed—never choose a remote target automatically.

## Error Copy Matrix

| Internal class | User heading | Primary next action |
|---|---|---|
| `offline` | You're offline | Try again when connected |
| `reauthorization_required` | Reconnect Google account | Reconnect |
| `permission_denied` | Google access denied | Check account/access |
| `target_not_found` | Linked Google Doc unavailable | Recovery choices |
| `template_unavailable` | Template unavailable | Choose/remove template |
| `rate_limited` | Google is temporarily limiting requests | Retry after advised time |
| `provider_unavailable` | Google Docs is temporarily unavailable | Safe bounded retry |
| `conversion_failed` | This document could not be prepared | Show supported-format guidance |
| `verification_required` | Update could not be verified | Check result before retry |
| `local_binding_failed` | Ritemark could not save the publishing link | Orphan recovery |
| `configuration_unavailable` | Google connection unavailable in this build | Support/build guidance |

Messages use stable safe details and never append raw provider bodies.

## Accessibility Contract

- Menu items retain native button semantics and visible focus.
- Account/template/status labels are not communicated only by color or icons.
- Async state uses `aria-live="polite"`; blocking failures use an appropriately assertive alert without repeating continuously.
- Confirmation/recovery dialogs trap focus, expose a programmatic title/description, close by Escape only when cancellation is safe, and restore focus.
- System-browser and Picker handoffs announce what opened and where focus will return.
- Progress animation respects reduced motion; status text remains sufficient.
- At 200% zoom/narrow width, actions wrap vertically and safe URLs do not overflow.
- Masked account identity must remain distinguishable enough to avoid account mistakes and readable by a screen reader.

## Feature-Off Design

When `google-docs-publishing` is off:

- Google Docs account/template UI and editor publish actions are absent.
- Existing PDF, Word, and Copy Markdown remain unchanged.
- Tokens and bindings are retained; re-enabling restores their verified projection but performs no network action.
- A support-safe way to disconnect/remove data must be documented if the Settings card is entirely hidden.

## Phase 0 Design Decisions

- Final Create/Sync labels and placement in the Export menu.
- Dirty and untitled document flow.
- Account masking and whether full identity is ever shown.
- Template picker/browser focus-return behavior on macOS and Windows.
- Overwrite warning frequency and stronger remote-change warning.
- Whether Open Google Doc lives directly in the menu, in details, or both.
- Cancel semantics at every progress stage.
- Orphan/unknown-outcome recovery actions and safe support details.
- Feature-off disconnect/data-removal access.
