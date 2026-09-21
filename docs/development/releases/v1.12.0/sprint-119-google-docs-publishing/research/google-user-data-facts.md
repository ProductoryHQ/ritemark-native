# Google user data: facts for Ritemark's privacy policy (R11, gate item 8)

**Date:** 2026-09-21
**Status:** facts checked against the Sprint 119 code on branch `sprint-119-google-docs-publishing`. This is not legal text. `ritemark-web` writes the policy section from it, and Jarmo approves the wording.

Each fact names the code that makes it true, so a later change that breaks a fact is visible in review.

## What Ritemark asks Google for

- **One OAuth scope:** `https://www.googleapis.com/auth/drive.file` (`src/googleDocs/types.ts`, `GOOGLE_DOCS_SCOPE`). With it, Ritemark can open only the files it created and the files the user picks in Google's own file picker. It cannot list, read or change anything else in the user's Drive.
- **No other scopes.** There is no `openid`, `email` or `profile` scope. Ritemark gets the account's identity from Drive's `about.get` call, which `drive.file` allows.
- Sign-in is Google's installed-app flow in the user's browser, with PKCE and a one-time `state`. The browser returns to a loopback address on the user's own machine (`127.0.0.1`, random port) (`src/googleDocs/oauth.ts`).

## What Ritemark reads

- **The connected account's identity:** its stable Drive user id (`permissionId`), email address and display name (`GoogleApiClient.whoAmI`). Ritemark shows the email in Settings and uses the id to stop a document linked under one account from syncing under another.
- **Metadata of the files Ritemark works with:** id, name, type, whether the file is in the trash, its web link, and Ritemark's own tag (`appProperties.ritemarkPublish`) (`GoogleApiClient.getFile`).
- **The content of the Google Docs Ritemark created.** On each Sync, Ritemark reads the document to check whether it was edited in Google Docs since the last Sync (its revision id), and to place tables and images while writing.
- **The template the user picks** in Google's file picker: its id and name. On creating a new Doc, Ritemark copies the template.

## What Ritemark writes

- **New Google Docs,** created on the user's explicit "Create Google Doc" action, in the user's own Drive and owned by the user.
- **The body of those Docs on Sync.** Sync replaces the document text with the current Ritemark version. A Doc edited in Google Docs is overwritten only after the user confirms. Ritemark does not change the header or footer, the named styles, or the sharing settings.
- **Images, briefly.** A local image in the document is uploaded to the user's Drive and shared as "anyone with the link can view" for the few seconds Google needs to copy it into the Doc. Ritemark then removes the sharing and deletes the uploaded file (`src/googleDocs/imageStaging.ts`). The link is random and never shown or sent anywhere else, but for those seconds anyone who had it could open the image. **The policy should say this plainly.**
- **Remote images** (an `https://` image in the document) are passed to Google by URL. Google's servers fetch them from their source; Ritemark does not download them.

## Where the data lives

Everything stays on the user's device and at Google. **No document content, token or Google data passes through Productory servers.** All requests go straight from the app to `googleapis.com`, `oauth2.googleapis.com` and `accounts.google.com`.

| Data | Where | Code |
| --- | --- | --- |
| OAuth access and refresh tokens, account id, email, display name | The operating system's secure credential store (macOS Keychain, Windows Credential Manager), through the editor's secret storage | `GoogleAccountService`, key `ritemark.googleDocs.account.v1` |
| Chosen template (file id and name) | The app's local state | key `ritemark.googleDocs.template.v1` |
| Links between local files and Google Docs: local file path, Google file id, account id and email, Doc title, created and last-synced times, last revision id, a hash of the last published content, and whether the first-sync warning was confirmed | A JSON file in the app's local storage folder (`google-docs/v1/bindings.json`, plus a last-good copy) | `GoogleDocsBindingStore` |

Ritemark's usage analytics (PostHog) record nothing about Google Docs publishing: the `src/googleDocs/` code sends no analytics events.

## Retention and control

- **Disconnect** (Settings → Google Docs → Disconnect) revokes the grant at Google and deletes the tokens, identity and template choice from the device (`GoogleAccountService.disconnect`). Google Docs already created stay in the user's Drive; Ritemark never deletes them.
- **Link records are kept after Disconnect**, so reconnecting the same account continues to sync the same Docs. "Remove Google Docs link…" in the Export menu deletes one record. The records hold file ids and paths, not document content.
- The user can also revoke Ritemark at any time in their Google Account under third-party access. Ritemark then asks them to reconnect.
- Uninstalling Ritemark leaves the local files to the operating system's normal cleanup. The policy can say how to remove them if Jarmo wants that.

## Statements Google requires for publication and verification

- The policy must disclose how the app accesses, uses, stores and shares Google user data (the sections above).
- It must include the Limited Use statement, or equivalent wording: *Ritemark's use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.*
- Ritemark does not use Google user data for advertising, does not sell it, does not transfer it to third parties, and does not use it to train AI models. The Google Docs feature does not hand document content to Ritemark's AI features. **Before the policy states this, Jarmo should confirm it stays true for planned features.**
- `drive.file` is a non-sensitive scope, so publication should need brand verification but not a security assessment. That is the Phase 0 understanding; Google's review is the final word.
- The consent screen's home page, privacy policy and terms URLs are on `ritemark.app`, which is an authorized domain.
