# Sprint 119 Current-State Audit

**Date:** 2026-09-13<br>
**Scope:** checked-in Ritemark editor export, Settings, storage, feature flags, and lifecycle seams.<br>
**Purpose:** distinguish reusable foundations from new integration work before Phase 0 chooses an API/conversion design.

## Executive Finding

Ritemark has a useful export normalization pipeline, a working Word document builder, Settings/SecretStorage patterns, and host-owned editor message handling. It has no Google Drive/Docs OAuth client, no cloud publish operation model, and no durable Markdown→remote-file binding. Sprint 119 is therefore a new external-integration subsystem, not an extra Export menu handler.

The safest reusable boundary is `buildNormalizedExportHtml`: it already strips Ritemark-only comments and unsafe tags for PDF/Word. The current `exportToWordV2` function is not directly reusable as a cloud converter because it also opens a Save dialog and performs a synchronous local write; Phase 0 should extract a pure buffer builder only if DOCX conversion wins.

## Audited Paths

- `extensions/ritemark/webview/src/components/header/ExportMenu.tsx`
- `extensions/ritemark/webview/src/App.tsx`
- `extensions/ritemark/src/ritemarkEditor.ts`
- `extensions/ritemark/src/export/v2/htmlPipeline.ts`
- `extensions/ritemark/src/export/v2/wordHtmlExporter.ts`
- `extensions/ritemark/src/export/v2/pdfHtmlExporter.ts`
- `extensions/ritemark/src/export/v2/imageSource.ts`
- `extensions/ritemark/src/export/v2/types.ts`
- `extensions/ritemark/src/settings/RitemarkSettingsProvider.ts`
- `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx`
- `extensions/ritemark/src/features/flags.ts`
- `extensions/ritemark/src/features/featureGate.ts`
- `extensions/ritemark/src/features/featureSettings.ts`
- `extensions/ritemark/src/extension.ts`
- relevant `package.json`/build/webview tests and architecture documentation.

## Current Export Flow

```text
Editor React App
  editor.getHTML()
  → preprocess tables
  → inline Mermaid SVG/images
  → postMessage exportPDF/exportWord
       ↓
RitemarkEditorProvider
  → exportToPDFV2 / exportToWordV2
       ↓
buildNormalizedExportHtml
  → strip unsafe tags/events
  → strip comments / unwrap annotated text
  → normalized metadata/style
       ↓
local PDF/Word builder + Save dialog
```

## Findings

### F1 — Export menu has three local actions

`ExportMenu.tsx` exposes Export PDF, Export Word, and Copy as Markdown. It has no account/binding/status input and assumes each menu action closes or locally updates its own state.

Implication: publishing requires a host-backed projection and async operation state, not only two callbacks added to the component.

### F2 — Editor sends a frozen-looking payload but host ownership is incomplete

`App.tsx` builds PDF/Word messages from current `content`, properties, and editor HTML after Mermaid/image preprocessing. `ritemarkEditor.ts` handles the message against the custom editor's `document.uri`.

Implication: the correct starting point is a document-specific host handler. Phase 0 must freeze dirty-buffer/saved-file semantics and prevent later reads from whichever editor is active.

### F3 — Normalized HTML is the shared safety chokepoint

`htmlPipeline.ts` removes scripts, iframes, inline event handlers, table-only editor metadata, standalone `<ritemark-comment>` nodes, and anchored comment attributes while preserving highlighted text. Both current V2 exporters call it.

Implication: Google publishing must reuse or explicitly extend this audited chokepoint so comments and unsafe markup cannot bypass existing protections.

### F4 — Comment stripping includes a non-trivial quoted-attribute case

The current matcher explicitly accounts for literal `>` inside quoted `data-comment` attributes. Reimplementing sanitization in a Google-specific path risks reopening a fixed export leak.

Implication: add Google fixture coverage to the same tests rather than writing a separate regex/parser casually.

### F5 — Word exporter already maps a meaningful structure subset

`wordHtmlExporter.ts` maps headings, paragraphs, bold/italic/code, hyperlinks, blockquotes, nested ordered/unordered lists, tables, horizontal rules, and images into `docx` structures. It constrains image dimensions and skips undecodable images instead of aborting the entire export.

Implication: DOCX conversion is a credible candidate, but current fidelity behavior—including silent image skip—must be scored explicitly for cloud publishing.

### F6 — Word buffer construction is coupled to UI and synchronous disk I/O

`exportToWordV2` normalizes, shows a Save dialog, builds the document, calls `Packer.toBuffer`, writes with `fs.writeFileSync`, and displays messages in one function.

Implication: if DOCX wins, extract a pure `buildWordBuffer`-style seam. Do not invoke Save dialogs or create temp files merely to upload.

### F7 — Image handling depends on document URI

The Word path resolves an image from its TipTap title/src using `tryLoadImageSource(imagePath, documentUri)`. The editor also inlines rendered Mermaid/SVG data before host export.

Implication: the publisher must carry the originating document URI through conversion and freeze remote/data/local image policy. A converter cannot operate on Markdown text alone and preserve current image behavior.

### F8 — Copy as Markdown is selection-oriented

The existing Copy as Markdown handler converts `getSelectionHTML(editor)` through Turndown. It is not necessarily a canonical full-document Markdown export service.

Implication: “direct Markdown import” must be a Phase 0 adapter built from the actual document snapshot/normalizer, not assumed to equal the current Copy action.

### F9 — Settings has a host-owned SecretStorage pattern

`RitemarkSettingsProvider` receives `ExtensionContext`, uses `context.secrets`, sends masked configuration state to its webview, and handles host-side provider tests/actions.

Implication: token storage and account operations belong in the host and can integrate with a familiar lifecycle, but OAuth needs a dedicated controller rather than the generic API-key handler.

### F10 — Existing Google AI key is unrelated and potentially confusing

Settings stores `google-ai-key` for Gemini/Google AI API calls and labels it **Google AI API Key**. This is not Google user OAuth and cannot authorize Drive/Docs publishing.

Implication: new storage keys, types, UI card, messages, tests, copy, and telemetry must be explicitly Google-Docs-specific. Never reuse `google-ai-key`.

### F11 — Generic `setApiKey` accepts key names from a message

The current API-key path stores `message.key` after limited special-case gating. That pattern is designed for pasted BYOK values, not OAuth token bundles.

Implication: do not route OAuth through `setApiKey`; define exact host requests and fixed SecretStorage keys with runtime validation.

### F12 — Settings protocol is currently an in-provider switch

Settings receives loose webview messages in `RitemarkSettingsProvider` and posts state/results directly. There is no shared Google account service or typed Google Docs protocol.

Implication: add a cohesive controller/protocol so editor publishing and Settings consume one account truth rather than duplicating token reads and refresh races.

### F13 — No Google Drive/Docs OAuth or API subsystem exists

Repository search found no Drive/Docs OAuth controller, Picker integration, file create/update client, Docs request mapper, or Google file binding registry.

Implication: dependencies and transport design must be approved in Phase 0; this is not “wire up an existing service.”

### F14 — No local document-to-cloud identity exists

The custom editor knows the document URI, but no host service maps it to an external file ID or account subject. No rename listener currently preserves such a mapping.

Implication: binding storage, atomic migration, multi-root identity, Save As/copy behavior, corruption recovery, and account mismatch are first-class deliverables.

### F15 — Frontmatter is not a safe default binding carrier

Document properties/frontmatter are exported and travel with copied Markdown. A Google file ID written there would also travel through Save As, Finder/Explorer copy, Git clone, or template duplication.

Implication: a copied document could silently overwrite the original's Google Doc. The planning default is a host-owned registry; any frontmatter design needs explicit evidence and approval.

### F16 — Custom editor instances are document-specific, but broadcasts need design

`RitemarkEditorProvider.resolveCustomTextEditor` receives a `TextDocument` and webview. The provider also maintains a static collection of active webviews for some global messaging.

Implication: binding/operation events must target editors by canonical URI and revision. A global undifferentiated success broadcast would repeat the comment-status class of bug found in Sprint 117.

### F17 — No generic file-rename binding hook is present

Search found feature-specific rename logic but no extension-level binding registry migration for Markdown files.

Implication: Sprint 119 must register and test VS Code rename events. External filesystem copy/move that cannot be observed must fail closed rather than be guessed by hash/title.

### F18 — Host open-external patterns already exist

The extension has host-side external-link handling and can open trusted URLs rather than asking webviews to navigate directly.

Implication: Open Google Doc and OAuth browser handoff should validate/construct allowed HTTPS URLs in the host and reuse safe platform behavior.

### F19 — Feature flags have canonical files

Flags are defined through `features/flags.ts`, evaluated via `featureGate.ts`, and projected through feature settings. Repository guidance requires new experimental/integration work to use this system.

Implication: add one `google-docs-publishing` flag and gate Settings, editor UI, callback handling, and all host requests. UI-only gating is insufficient.

### F20 — Webview changes require committed bundle regeneration

Editor/Settings React source is built into the extension's committed webview artifact under the repository's established build process.

Implication: Sprint close needs both source tests/build and committed-bundle verification; editing React alone is incomplete.

### F21 — Current exporters catch/display errors locally

PDF/Word exporters catch exceptions and show VS Code messages. They do not expose a persistent operation ID, stage, unknown remote outcome, or retry state to the editor.

Implication: cloud publishing needs a typed host operation state machine. Reusing local-export error handling would make response loss and partial remote mutation dishonest.

### F22 — Existing export metadata includes title, author, and date

The normalizer projects these fields and template style independently of raw body HTML.

Implication: the conversion matrix must decide exactly how metadata maps into the Google Doc body/properties and ensure title selection does not become remote identity.

### F23 — Current Word image failure can be silent to the user

The Word builder logs a warning and skips unrenderable images. That may be acceptable for local export but could make a remote teaching handout look complete when it is not.

Implication: Phase 0 must choose fail-all, warn-and-publish, or per-image placeholder behavior for Google; it cannot inherit silence accidentally.

### F24 — Existing local export does not need OAuth lifecycle or release operations

No current Settings/export path has Google consent-screen publishing, test-user expiry, redirect registration, quota, token revocation, or provider SLA dependencies.

Implication: the release plan must track Google Cloud configuration as an external blocker with an owner and production-state proof, not only code completion.

## Reusable vs New Responsibility

| Responsibility | Reuse | New Sprint 119 work |
|---|---|---|
| Normalize/sanitize export source | `buildNormalizedExportHtml` and tests | Google-specific policy/fixtures only where needed |
| Markdown/HTML source snapshot | editor payload + document URI pattern | dirty/untitled freeze, exact typed request, operation generation |
| Word structural conversion | `wordHtmlExporter` internals if DOCX wins | pure buffer seam, cloud warnings, no Save dialog/write |
| Images/Mermaid | preprocessing + `tryLoadImageSource` | cloud size/URI/upload policy and fidelity evidence |
| Secure secrets | VS Code SecretStorage pattern | OAuth-specific controller/keys/refresh/revoke/redaction |
| Settings UI | provider/panel/React conventions | account/template state and typed actions |
| External link opening | host platform pattern | allowlisted Google Docs/OAuth URLs |
| Feature gating | canonical feature system | new flag and host/UI coverage |
| Cloud identity | none | versioned binding store and rename/copy semantics |
| Remote operations | none | Google client, adapter, idempotency, verification, recovery |

## Phase 0 Questions Raised by the Audit

1. Which source representation is canonical for direct Markdown import, given Copy as Markdown is selection-based and normalized HTML is the current safety boundary?
2. If DOCX wins, which Word builder helpers become pure exports without changing existing local Word behavior?
3. How do large/local/Mermaid images reach Google under each candidate, and when does one failed image stop the whole publish?
4. What document snapshot is published when the editor is dirty, and how is it bound to a durable URI?
5. How is workspace identity stable enough for multi-root/renames while preventing copied-file inheritance?
6. How are operation/account/binding updates targeted to multiple editor instances without a global stale broadcast?
7. Which Google Cloud/OAuth artifacts are public build configuration versus secrets, and who owns their production publication?

## Audit Exit Criteria

This audit is input, not authorization. W0 must verify the current Google API behavior, run candidate canaries, and turn every question above into an explicit approved decision before production changes begin.

## Addendum — re-verification at kickoff (2026-09-18)

The audit above is kept as written on 2026-09-13. At kickoff it was re-checked against main `c2522479`, which by then included Sprint 116 (runtime/model baseline), Sprint 117 (comment-to-agent handoff, PR #293) and Sprint 126 (Store certification, PR #304). 36 claims still hold, and nothing under `export/v2`, `ExportMenu.tsx`, `App.tsx`, `RitemarkSettings.tsx` or `features/flags.ts` has changed since the audit. The corrections and new precedents below supersede the original text wherever the two conflict.

### Corrections

| Audit reference | What it said | What the code says on 2026-09-18 |
|---|---|---|
| Audited paths list, F19 | Flags are projected through `features/featureSettings.ts` | That file does not exist and never did. Experimental flags reach users as `ritemark.features.<id>` entries in `extensions/ritemark/package.json`; the editor receives them through the `load.features` payload in `ritemarkEditor.ts`, and Settings receives them as booleans from `RitemarkSettingsProvider.ts`. There is no `google-docs-publishing` flag yet. |
| Reuse table, F4 | `buildNormalizedExportHtml` "and tests"; add Google fixtures to "the same tests" | `htmlPipeline.ts` and `stripComments` have no tests. The extension `npm test` script's only export tests are `export/v2/imageSource.test.ts` and `export/saveAsMarkdown.test.ts`, and neither exercises the normalizer. Phase 0 creates the first normalizer fixtures rather than extending existing ones. |
| F9 | Settings "sends masked configuration state" | The host sends full API key values to the Settings webview (`RitemarkSettingsProvider.ts`, commented "masked for display, full for input"); masking is only a password input in the webview. OAuth tokens must not follow this pattern: the webview gets a redacted projection only (R2). |
| F14, F17 | No rename hook exists; Sprint 119 must add the first | Since Sprint 117, `ritemarkEditor.ts` registers `workspace.onDidRenameFiles` and moves records through `CommentTaskStore.renameSource`. That store is versioned, lives in global storage, is keyed by document URI and is written atomically, and on purpose it does not follow external moves. This is the direct precedent for the binding registry (R6). |
| F16 | Only a global `activeWebviews` broadcast exists | `activeWebviews` still exists for global broadcasts, but Sprint 117 added a per-document `commentTaskWebviews: Map<uri, Set<Webview>>` with cleanup on dispose. That fixes the "comment-status" class of bug the audit warned about, and binding/operation events should use the same per-URI targeting. |
| F23 | The Word exporter warns on image failures | It warns only when an image fails to decode. Any image `tryLoadImageSource` returns null for is dropped silently, including every http(s) image and anything that isn't PNG/JPEG. R4's "honest preview/error policy" has no existing behaviour to reuse. |

### New since 2026-09-13

- **Comments in raw Markdown (Sprint 117).** Standalone comments are saved as `<!-- {id:…} body -->` (`commentTurndownRules.ts`, `commentMarkedExtension.ts`), and both comment types carry `data-comment-id`. The HTML normalizer's patterns still catch them. But the raw file text and Copy as Markdown now carry comments with stable IDs, so a direct-Markdown adapter must strip both forms before upload (R4).
- **Typed, gated host protocol (Sprint 117).** `comment-task/*` requests go through one host controller with a typed decoder (`commentTasks/protocol.ts`), a feature-flag gate in `extension.ts`, document scope via `resolveProjectScope`, and a frozen document snapshot with version and dirty state (`CommentTaskController.ts`). This is the template for Sprint 119's missing typed protocol (F12) and for Phase 0 question 4 (dirty-buffer freeze).
- **Honest outcomes when handing off externally (Sprint 126).** `reporting/reportTransport.ts` opens `mailto:` with typed results (`opened`, `no-handler`, `too-long`) and treats "opened" as not delivered. This is the precedent for the "Could not verify" and handed-off states (F21, R8).
- **Shared dialog layering.** `ui/dialog.tsx` now sits at z-80, above the header/rail (z-60) and the Comments menu (z-70) and below popovers (z-90/100), and goes full-screen below 640px. Publishing dialogs use it as is.
- **Store policy 10.1.5 (patch 016).** The build now removes software-download promotion. Google onboarding copy must not tell users to download or install anything.
- **OAuth precedent.** There is no `registerUriHandler`. `branding/product.json` already declares `urlProtocol: "ritemark"`, but Google's Desktop-app client type uses a loopback redirect, so Sprint 119 does not need that protocol or any shell change. Existing sign-in flows only open an `authUrl` owned by the Claude or Codex CLI, so Ritemark has no loopback or PKCE code of its own.
- **Legal links in the app (R11).** `extensions/ritemark/src/analytics/posthog.ts` and `extensions/ritemark/webview/src/components/ai-sidebar/aiDisclosure.ts` link to `https://www.productory.ai/en/privacy/` and `/en/terms/`. `https://ritemark.app/en/privacy/` and `/en/terms/` return 404 as of 2026-09-18.
