# Sprint 119 Integration Decisions

**Status:** In progress. Opened 2026-09-20. This file is the Phase 0 gate: no OAuth production configuration, dependency, message contract or product code starts until Jarmo approves it.<br>
**Decisions:** 8 (see [spec.md](../spec.md) § Phase 0 Decisions). Decision 6 is partly recorded below; the rest are open.<br>
**Rule:** every entry records what was observed, when, and by whom. No credential, token or secret value belongs in this file.

## Decision status

| # | Decision | Status |
|---|---|---|
| 1 | OAuth desktop flow, redirect/PKCE/state, scope set, consent publication, test accounts, release credential injection | Flow canaried end to end 2026-09-20; recommendation below, publication still open |
| 2 | Direct Markdown import vs DOCX conversion vs native Docs API | **Decided 2026-09-20: native Docs API.** Built, run and measured; see the decision below |
| 3 | Template selection/grant/copy semantics | Copy-and-replace proven on the chosen adapter 2026-09-20; the Picker grant is still untested |
| 4 | Create and same-ID Sync sequence, idempotency, verification, retry/cancel | Same-ID update, version signals and atomicity measured 2026-09-20 |
| 5 | Binding schema, workspace identity, rename/copy/Save As/account switch | Open |
| 6 | Credentials and operations | Recorded 2026-09-20; publication and verification open |
| 7 | Feature flag, telemetry allowlist, threat model, dependency choice, architecture impact, canary matrix | Open |
| 8 | Google user-data facts for the Ritemark privacy policy (R11) | Open |

## Decision 6 — credentials and operations

Recorded 2026-09-20 by Claude, driven in the browser with Jarmo present, in the Google Cloud console as jarmo@productory.eu.

### Project

An existing project was reused rather than creating a new one.

| Field | Value |
|---|---|
| Project name | Ritemark |
| Project ID | `root-cathode-471905-q1` |
| Project number | `620148959973` |
| Organization | None. The project sits directly under the account, not under a Productory organization resource |
| Owner account | jarmo@productory.eu (Productory Workspace) |

### Enabled APIs

| API | State |
|---|---|
| Google Drive API | Already enabled before this sprint |
| Google Docs API | Enabled 2026-09-20 |
| Google Picker API | Enabled 2026-09-20 |
| Google Search Console API | Already enabled; unrelated to this sprint |

### OAuth application

| Field | Value |
|---|---|
| Publishing status | Testing |
| User type | External |
| App name | Ritemark |
| User support email | jarmo@productory.eu |
| Developer contact | jarmo@productory.eu |
| Application home page | `https://ritemark.app/en/` |
| Privacy policy link | `https://ritemark.app/en/privacy/`, added 2026-09-20 once the page was live |
| Terms of service link | `https://ritemark.app/en/terms/`, added 2026-09-20 |
| Authorized domains | `ritemark.app` |
| Logo | None uploaded |
| Test users | jarmo@productory.eu (1 of the 100 pre-verification cap) |

Until 2026-09-20 the Audience page refused publication because Branding was incomplete. With the two links saved, that block is gone and a **Publish app** action is now offered. It has deliberately not been used: publication waits for the Phase 0 gate and for the open items below.

### Legal pages (R11 evidence)

`ritemark-web` shipped its Sprint 26, "Ritemark's own privacy policy and terms of use", merged as PR #119 and deployed. Checked live on 2026-09-20:

| URL | Status |
|---|---|
| `https://ritemark.app/en/privacy/` | 200 |
| `https://ritemark.app/en/terms/` | 200 |
| `https://ritemark.app/et/privacy/` | 200 |
| `https://ritemark.app/et/terms/` | 200 |
| `https://www.productory.ai/en/privacy/` | 200, and since 2026-09-20 it points at the Ritemark policy |

The English privacy policy names Productory Services OÜ as provider with info@productory.eu, is dated 18 September 2026, and carries over the Ritemark commitments: local files, PostHog EU analytics with its opt-out, and the direct AI provider routes. It has **no Google Docs section yet** — that text is decision 8 and is written from the Phase 0 facts.

`productory-2026` PR #21, "Move Ritemark legal details to ritemark.app", was reviewed and merged on 2026-09-20 as `815bf85c`, and the deploy is live. Each Productory legal page now carries a short Ritemark section linking to the matching ritemark.app page in the same language, verified after the deploy:

| Productory page | Links to |
|---|---|
| `/en/privacy/` | `ritemark.app/en/privacy/` |
| `/en/terms/` | `ritemark.app/en/terms/` |
| `/et/privacy/` | `ritemark.app/et/privacy/` |
| `/et/terms/` | `ritemark.app/et/terms/` |

The review checked that nothing was lost between the two documents. Every Ritemark commitment removed from Productory's terms — MIT License, "AS IS", the liability limitation, the AI provider policy links, user responsibilities, best-effort support, and the AI-output review duty — is present on ritemark.app, as are the privacy items: the PostHog policy link, analytics on by default with its opt-out, the direct AI routes, feedback transmission, and that Productory receives no copy of the workspace. The Productory URLs did not move, so 1.11-era in-app links still land on a correct page.

S79 is therefore satisfied on the web side. It closes for this sprint when the in-app links also point at ritemark.app, which is product code behind the Phase 0 gate.

Two open points:

- The Estonian pages live at `/et/privacy/` and `/et/terms/`, English slugs, while other Estonian routes use Estonian ones such as `/et/tugi`. Both `productory-2026` (`src/config/legal.ts`) and this sprint's in-app links hardcode the current slugs, so a later rename in `ritemark-web` must update both.
- `productory-2026` still contains `src/app/ritemark/components/RitemarkFooter.tsx`, whose legal links point at the Productory pages. That section 301s to ritemark.app and is not served, and a separate task already covers removing the dead Ritemark code there.

### Scopes

`https://www.googleapis.com/auth/drive.file` is registered, and Google classifies it as non-sensitive. No sensitive or restricted scope is registered. Any scope beyond this needs a written necessity proof and Jarmo's approval (R2).

### Clients

| Client | Type | Created | Notes |
|---|---|---|---|
| Ritemark | Web application | 2025-09-12 | Pre-existing, presumably the earlier web Ritemark. Not modified by this sprint |
| Ritemark desktop (Phase 0) | Desktop app | 2026-09-20 | Created for the Phase 0 canaries |

Desktop client ID, public build configuration per Google's installed-app guidance:

```
620148959973-bpog94okgjf7lh95hebl4i9ecrq76gbi.apps.googleusercontent.com
```

The client secret Google issued with it is held by Jarmo in his password manager. It is never committed, logged, or written into this repository, and Google will not display it again. Google's installed-app documentation says a distributed desktop app cannot keep a secret, so it is not treated as a security boundary; the real secrets remain the user's tokens and the per-attempt PKCE verifier (R2).

### Open items for this decision

- **Publication and verification.** The app stays in Testing, where refresh tokens expire after seven days for non-profile scopes such as `drive.file`. Since 2026-09-20 nothing in the console blocks publication, so this is now a decision rather than a missing prerequisite: publish only after the Phase 0 gate fixes the scope set, and after the privacy policy states the Google facts (decision 8). Verification lead time is unknown and runs on Google's clock.
- **Dedicated test account.** Only jarmo@productory.eu is a test user. A separate test account is still needed so canary evidence does not depend on the owner's own Drive.
- **Project ownership.** The project has no organization. Whether it should move under a Productory organization resource, and who the second owner is, is Jarmo's decision and is not yet made.
- **The legacy web client** shares this project's consent screen. Publishing and verifying the project therefore also affects that client. Jarmo has not yet confirmed whether that web application is still in use.
- **Release credential injection.** Which client the shipped app uses, and how its ID reaches the build, is undecided and belongs with decision 1.


## Decision 1 — the installed-app OAuth flow, canaried

Run on 2026-09-20 against the real Google endpoints with a disposable canary client and Jarmo's own account as the single test user. Scripts live outside the repository, in the session scratch directory, and are not product code.

**The loopback flow works exactly as Google's installed-app guide describes.** A listener on `127.0.0.1` with an OS-assigned port, an `S256` PKCE challenge and a random `state` produced a callback carrying a 73-character authorization code, the `state` matched, and the listener closed itself on success.

**A desktop client must send a client secret.** The token exchange with PKCE but no `client_secret` is refused:

```
400 invalid_request — "client_secret is missing."
```

With the secret the same exchange returns `200`: an access token valid for 3599 seconds, a refresh token, `token_type: Bearer`, and exactly the `drive.file` scope that was requested. So the shipped app has to carry a client secret that Google's own installed-app documentation says cannot be kept secret. That is public build configuration, not a security boundary, and R2's rule stands: the tokens and the per-attempt PKCE verifier are the real secrets.

**What a test user sees.** Because the app is in Testing, the account chooser is followed by a full-page **"Google hasn't verified this app"** interstitial with `Continue` and `Back to safety`. Only then comes the consent screen, which shows the app name **Ritemark**, the account, the single permission "See, edit, create, and delete only the specific Google Drive files you use with this app", and links to Ritemark's privacy policy and terms on ritemark.app. The interstitial is what publication and verification remove; the consent screen itself is already correct.

**Recommendation for decision 1:** keep the loopback + PKCE + state design as specified; treat the client ID *and* secret as build configuration with no security claim attached; keep tokens in SecretStorage only. Nothing here blocks implementation.

## Decision 2 and 4 — conversion and same-ID sync, measured

Two of the three candidates were exercised against a fixture corpus covering headings 1–6, inline styles, links, fenced and indented code, ordered/unordered/nested/mixed lists, blockquotes, a table with alignment, a horizontal rule, task lists, escapes, Unicode and emoji, a remote image, a missing local image, raw HTML, and a Ritemark comment.

**Markdown import is officially supported and was confirmed at runtime.** `about.importFormats` maps `text/markdown` and `text/x-markdown` to a Google Doc, and `exportFormats` offers Markdown back, so a round trip is measurable rather than a matter of opinion.

What survived the round trip: all six heading levels, bold/italic/bold-italic, inline code, links, ordered, unordered, nested and mixed lists, the table including its alignment row, the horizontal rule, task list checkboxes, hard breaks, escapes, and every Unicode and emoji character.

What did not:

- **Fenced and indented code blocks lose their block identity.** They come back as ordinary paragraphs, one per line, with the angle brackets escaped. Only 15 characters in the whole document kept a monospace font, which is the inline `code` spans. For a Markdown editor this is the most serious loss in the corpus.
- **Blockquotes are flattened.** Two quoted lines merged into one and empty quote markers appeared around them; the nested quote survived.
- Heading 6 came back wrapped in italics, because Google's Heading 6 style is italic.

Content-safety probes on the created document, read back through the Docs API rather than through the export:

| Probe | Result |
|---|---|
| Ritemark comment id and body (`<!-- {id:…} -->`) | absent |
| Any HTML comment marker | absent |
| `<script>` tag, `alert(1)` payload, `onerror` attribute | absent |
| Raw `<img src=x onerror=…>` | **became an inline image object** with source `x` and no content |
| Remote image `https://ritemark.app/favicon.ico` | fetched and re-hosted by Google |
| Missing local image `./does-not-exist.png` | **became an inline image object** with the relative path as its source and no content |

So Google's importer strips scripts and comments by itself, but it turns image-shaped markup into real inline objects, including references it cannot resolve. A naive upload therefore produces documents with silently broken images. R4's demand to resolve or reject images before upload is justified by measurement, not by caution.

**Same-ID sync works.** `files.update` with `uploadType=media` and a Markdown body against an existing document returned the same file id, replaced the entire contents, bumped Drive's `version` from 6 to 7, moved `modifiedTime`, and left `appProperties` intact.

**`appProperties` survive creation through conversion.** The tag set at create time came back on the created file and again after the update. That makes it a usable marker for the orphan/duplicate problem that pre-generated ids cannot solve for converted Workspace files: tag the create, and on an indeterminate response search for the tag instead of blindly retrying.

**Version signals do not agree.** A Docs API edit — which is what a person typing in Google Docs produces — changed the Docs `revisionId` but left Drive's `version` and `modifiedTime` unchanged. Drive's `version` is stable when nothing writes, but it moved on its own between create and the first update, while Google finished converting. `headRevisionId` is not populated for Google Docs at all.

The consequence is sharp: **the only trustworthy "has someone edited this since our last Sync" signal is the Docs `revisionId`**, captured after our own write completes. Drive's `version` is good for "our write landed", not for detecting remote edits.

**Atomicity is real, and index arithmetic is the cost.** A four-request `batchUpdate` with one bad index was rejected whole, with the document left exactly as it was, which is the documented all-or-nothing behaviour observed. The rejection itself came from a miscalculated bullet range — a fair sample of the work a native mapper carries.

**Optimistic concurrency exists only on the native path.** A `batchUpdate` carrying `writeControl.requiredRevisionId` from a stale read was refused with `400 INVALID_ARGUMENT`. The Drive import path has no equivalent: it overwrites whatever is there, silently.

## Decision 3 — templates, measured

The copy-then-replace idea was tested directly. A template document was given a distinctive font and a page header, then copied, which is the "Create from template" path. The copy kept both. Replacing the copy's contents through the Markdown import path then **erased both**: the font was gone and the header count dropped from one to zero.

Writing into the same copy through the Docs API instead kept the page header and the document's named styles; only direct character formatting applied to the replaced text did not transfer to the new text, which is correct behaviour rather than a defect.

**So a template is incompatible with the Markdown-import path.** If R3 stays in scope, the conversion adapter has to be the native Docs API, or templates have to be reduced to what a converted upload can carry, which today is nothing.

## The DOCX path, measured

The third candidate was run through Ritemark's own Word exporter rather than a synthetic document, so the result describes the code we would actually reuse. `exportToWordV2` was called outside the extension host with a stub `vscode` module, the same fixture corpus was converted to HTML with `marked`, and the resulting 9 KB `.docx` was uploaded to Drive with conversion and exported back to Markdown.

**Caveat on this canary.** The real app feeds the exporter TipTap's `editor.getHTML()`; this run used `marked`'s HTML. The two differ in detail, so treat the structural results as indicative and re-run them against real editor HTML before freezing the fidelity matrix.

What the DOCX path did better than Markdown import:

- Code blocks kept a code appearance instead of becoming plain prose.
- Heading 6 was not silently italicised.
- Nothing unsafe arrived at all: `<script>`, the `onerror` image and the Ritemark comment were already gone, because `buildNormalizedExportHtml` strips them before the exporter runs. The importer never had to be trusted.
- No broken images appeared, because the Word exporter drops images it cannot decode.

What it did worse:

- **List structure is lost.** Ordered items came back as literal text — `1\. First` — and every nested level flattened to a single bullet level. Task list checkboxes became plain bullets.
- **Blockquotes collapsed** into one italic run with the nested quote merged in.
- The horizontal rule vanished, and the table lost its column alignment.
- The document title and byline were emitted in addition to the corpus H1, so the published document opened with a duplicated heading.
- Images vanished silently, which is the honest-failure problem from the other direction: the user is told nothing.

**A real defect surfaced, outside this sprint's scope.** Both exporters read `node.rawText`, which is HTML text with entities still encoded. A document containing `Tom & Jerry` reaches the exporter as `Tom &amp; Jerry` and is written to Word as the literal text `&amp;`. This was reproduced directly: exporting `<p>Ampersand &amp; less-than &lt;tag&gt; …</p>` produced `Ampersand &amp;amp; less-than &amp;lt;tag&amp;gt;` inside `word/document.xml`. `wordHtmlExporter.ts:78` and `pdfHtmlExporter.ts:19` share the accessor, so PDF is very likely affected too, though that half was not run. It is filed as its own task; Sprint 119 should not absorb it.

## Decision 2 — the adapter is the native Docs API

**Decided 2026-09-20 by Claude under Jarmo's explicit delegation** — "tee ise ja vasta ise oma küsimustele … hommikul tahan näha parimat lahendust mida oskad teha". It is recorded here as a decision rather than a recommendation, and Jarmo can overturn it; the evidence for doing so is below in the same place as the evidence for it.

The decision was not taken on paper. A mapper was written, run against the full corpus, and the resulting documents were read back.

### What the mapper does, and the index discipline that makes it safe

The thing that makes this path look expensive is index arithmetic, and the first attempt duly broke: a table landed in the middle of a sentence, because `createParagraphBullets` consumes the leading tabs that express list nesting and shifts every index after it. The working discipline is four passes:

1. **One `insertText`** carrying the entire body, with a placeholder line where each table or image belongs.
2. **Styling only** — paragraph styles, text styles, bullets. None of these changes the document's length, so every offset computed in pass 1 stays valid. Bullets go last, later lists first, because they are the one request that does change length.
3. **Tables and images**, located by finding their placeholders in a fresh read and applied last-first.
4. **Table cells**, filled last cell first.

Each pass is one atomic `batchUpdate`. The whole corpus — 50 blocks — is 35 + 4 + 15 requests and takes about 2.6 seconds.

### What it produces

Measured on the same corpus and the same round trip as the other two candidates:

| Construct | Markdown import | DOCX via our exporter | **Native mapper** |
|---|---|---|---|
| Headings 1–6 | kept, H6 italicised | kept | kept, H6 italicised (Google's own style) |
| Bold, italic, inline code, links | kept | kept | kept |
| Nested unordered lists | kept | **flattened** | kept, correct glyph per level |
| Ordered lists and numbering | kept | **lost, numbers became text** | kept, continuous numbering, nested a/b |
| Fenced code blocks | **lost, became prose** | code-styled text | kept: monospace, shaded block |
| Blockquotes | flattened into one | **collapsed** | kept, indented with a left rule |
| Horizontal rule | kept | **lost** | kept |
| Table | kept | kept, **alignment lost** | kept, bold header row |
| Task lists | checkboxes kept | **became plain bullets** | checkboxes kept, unchecked only |
| Unicode, emoji, escapes | kept | **entities mangled** | kept |
| Ritemark comments, scripts | dropped by Google | dropped by our normalizer | dropped by our normalizer |
| Unsafe `<img onerror>` | **became an inline object** | dropped | dropped |
| Template | **erased** | erased | **kept, including the page header** |
| Overwrite protection | none | none | `requiredRevisionId` refuses stale writes |

Two defects in the mapper's own first run were found and fixed rather than documented away: `<pre>` is a raw-text element in `node-html-parser`, so the `<code class="language-ts">` tag itself was published — the same trap the product's Word exporter has a comment about — and `ParagraphBorder.color` is an `OptionalColor`, one level deeper than `TextStyle`'s, which failed an entire batch.

### Why this one

- It is the only candidate that keeps a template, which is the release's own headline promise (R3).
- It is the only candidate with overwrite protection. On the import paths a Sync silently overwrites whatever a colleague typed; here a stale revision is refused (R7).
- It has the best structural fidelity of the three, and the two constructs a Markdown editor cares most about — code blocks and nested lists — survive only here.
- Safety is the product's, not the provider's: the normalizer strips comments and unsafe markup before anything is sent, so nothing depends on Google's importer being well-behaved.

### What it costs, stated plainly

- **Local images cannot be published.** Docs fetches images itself, anonymously, so it accepts only a public `https` PNG, JPEG or GIF. Uploading the image to the user's own Drive and referencing it does not work: both `drive.google.com/uc` and the thumbnail URL were refused, because the fetcher cannot see a private file. A `.ico` was refused too. The DOCX path is the only one that embeds local images, and only when the HTML puts `<img>` at block level; wrapped in a `<p>` the Word exporter drops it silently, which is worth its own look in the product.
- **A checkbox cannot be published as checked.** The API creates checkbox bullets but exposes no way to tick one.
- **Mixed lists are approximate.** A Docs list has one preset, so unordered children under an ordered parent come out as `a.`, `b.`.
- **The mapper is ours to maintain.** Every construct is code, and index arithmetic is where its bugs will live. The four-pass discipline and the fixture corpus exist so that those bugs are caught by a round trip rather than by a user.

### The image policy this forces, and the one question left

For v1: remote `https` PNG/JPEG/GIF images are inlined; every other image is **not published and named to the user** — which document, which image, and why — rather than silently dropped or published broken. That is the honest-failure rule R4 and R8 already ask for.

The alternative is uploading local images to the user's Drive and making them link-visible so Google's fetcher can read them. That publishes a private screenshot to anyone holding the link, so it is a privacy decision, not a technical one. It is **not** in v1 and belongs to Jarmo.

## The evidence that was weighed

(kept for the record; the decision above is what it produced)

- **Direct Markdown import** is by far the cheapest to build and is faithful for ordinary prose, lists, tables and links. It cannot keep code blocks, it flattens blockquotes, it wipes templates, it has no concurrency control, and it needs image pre-processing to avoid broken inline objects.
- **Native Docs API** keeps templates and headers, offers `requiredRevisionId` as a real guard against overwriting someone's edits, and applies atomically. It costs a mapper with careful index arithmetic, and images become their own upload problem.
- **DOCX through the existing Word exporter** inherits the normalizer's safety for free and handles code and images predictably, but it loses list structure, blockquotes, rules and table alignment, and it carries an entity-decoding defect that has to be fixed first. It reuses the most code and produces the least faithful structure of the three.

That middle path — shipping on the import path without templates — was the obvious cheap answer before the mapper existed. Having built the mapper and measured it, it is no longer the better trade: the expensive path took four passes and about 2.6 seconds per document, and it is the only one that can keep a promise the release already made.

## Recovery, scope and limits, measured

Run at the end of the same session, on the same grant.

**`drive.file` really is a per-file window.** Listing files with no query at all returned exactly the five documents the canary had created and nothing else from Jarmo's Drive. That is the concrete claim the privacy policy's Google section can make (decision 8): Ritemark cannot see documents it did not create or that the user did not hand it.

**The orphan query works.** `files.list` with `appProperties has { key='ritemarkCanary' and value='…' }` returned every canary document with its creation time. Combined with tagging each create, that is the recovery path for an indeterminate create response: search for the tag rather than retry blindly and risk a duplicate.

**Refresh works** and returns a fresh hour-long access token.

**Revocation produces three distinct, recognisable states**, which is what R8's error classification needs:

| Step | Result |
|---|---|
| `POST /revoke` with the refresh token | `200` |
| Any Drive call with the old access token | `401`, "Request had invalid authentication credentials" |
| Refresh with the revoked refresh token | `400 invalid_grant`, "Token has been expired or revoked" |

**Writing into a trashed document silently succeeds.** A document that the user moved to the bin still accepted a `files.update` and returned `200`. Only a permanently deleted file gives `404 File not found`. So Sync must check `trashed` explicitly: without that check Ritemark would report a successful publish into a document the user believes they threw away. This is a product requirement the spec does not currently state.

**Size and time.** An empty document converted fine. A 281 KB Markdown document — roughly 4000 paragraphs — created in 7.4 seconds, against 2.6 seconds for an empty one. Publishing is therefore a multi-second operation on ordinary documents and needs the staged progress R5 already asks for; it is not a spinner-free instant action.

## Canary artifacts

Created in Jarmo's Drive, all tagged `appProperties.ritemarkCanary = sprint-119-phase-0`, all disposable:

| Document | Purpose |
|---|---|
| [Markdown import corpus](https://docs.google.com/document/d/1R77_vWek-zPlBrNFIQ5x4jarZgqrsr4CVs5dQGxxCeE/edit) | the fidelity corpus, later overwritten by the same-ID sync test |
| [TEMPLATE](https://docs.google.com/document/d/1LrlWqmoQKK4fffkpXUnpB2yKNfOoHJ39QBwZf0FlBDg/edit) | template with a distinctive font and a page header |
| [FROM TEMPLATE](https://docs.google.com/document/d/1R8NfKVjBksQm8oX3HQuQeqfdfKBtdJjCAyB9FP2wZ5o/edit) | copy whose styling the Markdown update erased |
| [NATIVE into template](https://docs.google.com/document/d/1aC4lmNI2yRoF04w34PBCETKvaxo2Y5Zb7TyufmAqyzU/edit) | copy written through the Docs API, header preserved |
| [DOCX import](https://docs.google.com/document/d/1j3SeyY7K4SqjiluT3Ai3vt-3iuoVqgSa2nq_Ip821cw/edit) | the same corpus through Ritemark's Word exporter, then Drive conversion |
| [NATIVE MAPPER](https://docs.google.com/document/d/18lad5r7kgQ4pSzoEUAKT9vmgCCGY5MvWrHYhmAl2-gk/edit) | the same corpus through the chosen adapter |
| [NATIVE MAPPER into a template](https://docs.google.com/document/d/1POkVUPI4bsfccCYKiaoy-lRgX3J5eY7v54zE3cvc67g/edit) | the same, published into a template copy, page header intact |

The grant these canaries used was revoked at the end of the session, and the local token file was deleted, so nothing on this machine holds access to Jarmo's Drive overnight. Continuing the canaries needs one new consent round.

A second OAuth client, **Ritemark canary (Phase 0, disposable)**, was created because Google never shows an existing client's secret again and the Phase 0 client's secret is in Jarmo's password manager. Its secret lives only in the session scratch directory with mode 0600 and is not in this repository. Both the canary client and these documents should be deleted when Phase 0 closes.

The legacy **Ritemark** web-application OAuth client, created 2025-09-12, was deleted on 2026-09-20 at Jarmo's instruction, so the project's consent screen now covers only the desktop clients. Google keeps deleted credentials restorable for 30 days. The new Auth Platform UI failed to delete it silently; the older Credentials page did it.
