# Sprint 149 Technical Plan

The plan for [spec.md](spec.md). File references are to `origin/main` at `e23e2140` (3 November 2026). Paths are under `extensions/ritemark/` unless they say otherwise; `webview/…` is `extensions/ritemark/webview/src/…`; `vscode/…` lines are read from the main checkout's patched submodule at the pin. **The code was read for this plan, not run:** no dev instance, build, test or Cloudflare call was made.

## What exists today

| Part | Today | File |
|---|---|---|
| `.html` opens as a page | A workbench resolver routes `file://` `*.{html,htm}` to the browser editor at default priority, reusing a tab for the same URL | `patches/vscode/010-ritemark-browser-action-bridge.patch:165–214` (`registerEditor` at `:179`, `canSupportResource` at `:187`) |
| The page's isolation | Separate `WebContentsView`, `sandbox`, `contextIsolation`, no node, own session partition, popups denied | `vscode/src/vs/platform/browserView/electron-main/browserView.ts:91–147` (from `page-sandbox.md` §b) |
| The page's session | `workbench.browser.dataStorage`, default **Global**; Ephemeral only in an untrusted workspace, and Ritemark turns trust off (patch 013), so every local page shares the Global session | `vscode/src/vs/workbench/contrib/browserView/common/browserView.ts:350–361` |
| The browser's bar | `MenuId.BrowserActionsToolbar`, workbench-only: `menusExtensionPoint.ts` has no browser menu, so an extension can't contribute to it. Patch 009 already adds a Ritemark action there | `vscode/src/vs/platform/actions/common/actions.ts:305`; `browserEditor.ts:197`; `patches/vscode/009-ritemark-browser-context-bridge.patch:506–520` |
| The tab's resource | `vscode-browser:` per tab, not the file, so `resourceExtname`/`resourceLangId` `when` clauses don't see `.html` on a page tab | `vscode/src/vs/workbench/contrib/browserView/common/browserEditorInput.ts:161–162` |
| What the extension knows of the page | `workbench.action.browser.getActiveContext` (patch 009) and the `ritemark.browser.didNavigate` push per navigation | `src/browser/BrowserContextStore.ts:4`; `src/browser/browserNavigationRecorder.ts:14` |
| "Open in browser" today | Opens the **integrated** browser; offered in the Explorer and text-editor menus for `resourceLangId == html` | `src/extension.ts:1046–1062`; `package.json:264`, `:870`, `:877`; `src/browser/IntegratedBrowser.ts:26–31` |
| System browser | `vscode.env.openExternal` used for web addresses | `src/browser/IntegratedBrowser.ts:51` |
| Editor-title actions | The tab row keeps an editor-actions toolbar (patch 019) and the extension contributes `editor/title` | `patches/vscode/019-ritemark-tab-row.patch:517`; `package.json:831–841` |
| Secrets | VS Code `SecretStorage` (`context.secrets`); key names in one list | `src/settings/RitemarkSettingsProvider.ts:596–613` |
| **The Settings page can write any secret name** | `setApiKey` stores `message.key` with no allowlist | `src/settings/RitemarkSettingsProvider.ts:382–389` |
| Google OAuth (Sprint 119), the pattern | One-shot listener on `127.0.0.1:0`, S256 PKCE, random `state` checked, system browser, deadline, listener closed on every exit | `src/googleDocs/oauth.ts:4–6`, `:135`, `:178–179`, `:207`, `:246–251`, `:260–261` |
| Client ID as public build config | esbuild `define` from env; env wins at run time; a build without it still runs; a release check refuses a missing one | `esbuild.config.mjs:84–93`; `src/googleDocs/config.ts`; `scripts/check-google-oauth-build.mjs` |
| Account in SecretStorage, single-flight refresh | One JSON entry; refreshes share a request; `invalid_grant` → connect again | `src/googleDocs/GoogleAccountService.ts:100`, `:164`, `:228–243`, `:256` |
| Per-file records outside the project | Global storage folder per feature | `src/googleDocs/GoogleDocsBindingStore.ts:29–30` |
| A sharing feature's flag | `google-docs-publishing` | `src/features/flags.ts:134` |
| Settings ▸ Sharing (Sprint 147) | Section exists ("Where your copies and pages go when you share them"), Google Docs card in it | `webview/components/settings/settingsSections.ts:25`; `GoogleDocsSettingsCard.tsx` |
| AI tools | One registry; nothing publishes | `src/runtime/ritemarkTools.ts` |
| URL scheme | `ritemark` | `branding/product.json:178` |
| The vault script | Not written yet (`governance/test-keys.md`, *Next* 2) | `scripts/qa/` has none |

## Phase 1: audits, before the code they gate

Each writes one file in `research/`.

- **A1, the bar** (`research/page-bar.md`), gates W2. Answered by the lead (answer 1): the buttons go on the page's own bar, so PR 2 patches 010. The audit now only maps what patch 010 needs: where `MenuId.BrowserActionsToolbar`'s right end is, how the address row and back/forward are hidden for local pages, how a link's navigation is turned into a new tab, and whether the browser model can reload on a file change (or keeps its reload button).
- **A2, the sandbox live** (`research/page-sandbox-live.md`), no account. `page-sandbox.md`'s live-check steps on a hidden dev instance with `hostile.html` and a decoy local server: every row of its escape table, plus the session (the shared one, kept by Jarmo's decision 4) and what `file://` subresource tags can load. Recorded, not changed.
- **A3, the gather's corpus** (`research/gather-corpus.md`), no account. Ten real pages: Claude and ChatGPT HTML artifacts, a page with pictures in a folder, a page with a linked stylesheet and fonts, a page from a template site. What each references, so R3's rules are right before W3's tests freeze them.
- **A4, the live measurements** (`research/cloudflare-measurements.md`), **needs the account**. The 14 below, by `scripts/qa/cloudflare-contract.mjs` through the vault script, one Worker created and deleted per run. Gates W4's client and W5's connection; R6 and R7 change in `spec.md` first if a measurement says so.

### The 14 live measurements

The spike's list was kept with the manager's session; this is its reconstruction from `web-page-publish.md` §5–§6, for the manager to check against that copy.

| # | Measurement | Needs |
|---|---|---|
| M1 | The account ID from a token alone (`GET /accounts`), and its name for the sheet | Test account + token |
| M2 | Whether a new account already has a workers.dev name; registering one by API (error 10007) | Test account + token (a fresh account is best) |
| M3 | The asset hash the upload session accepts: sha256 truncated, or only blake3 as Wrangler sends | Test account + token |
| M4 | The metadata-only `PUT …/scripts/{name}` from a direct caller deploys an assets-only Worker (the API reference contradicts itself once) | Test account + token |
| M5 | `POST …/subdomain` with `previews_enabled: false`; no preview address answers | Test account + token |
| M6 | Time from deploy to the first 200 at a new address | Test account + token |
| M7 | `X-Robots-Tag: noindex` on `/`, on `/index.html`'s redirect, on a picture and on a 404 | Test account + token |
| M8 | Update with the same name: only missing hashes upload; a file left out is gone | Test account + token |
| M9 | Unpublish: `DELETE …/scripts/{name}`; time until the address stops serving the page; no old version reachable | Test account + token |
| M10 | Workers Scripts Edit alone covers every call (subdomain included); the template link pre-fills it | Test account (to make the token from the link) |
| M11 | The new Workers Admin role: does it change what the token needs or what the consent asks | Test account |
| M12 | OAuth's accepted redirect URIs: loopback with any port, or `ritemark://` | An OAuth client (a private test one) |
| M13 | OAuth's scope IDs for publishing, and what the consent screen shows | An OAuth client |
| M14 | OAuth's token lifetime, refresh, and a revoke endpoint for Disconnect | An OAuth client |

**None needs the public, verified client.** M1–M11 need only the test account and its token; M12–M14 need a private OAuth client in a Cloudflare account Productory controls.

## Workstreams

### W0: The vault script (E3), PR 1

`scripts/qa/with-test-keys.sh -- <command>`: reads named entries of the `ritemark-test-keys` Keychain service into that one process's environment (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the registry's five), prints only the names, refuses without `RITEMARK_BUILD_CHANNEL=test` and a test profile path. The registry's `.ps1` twin waits for the Windows vault. `governance/test-keys.md` gains row 6 (Cloudflare) in ritemark-dev, by the manager.

### W1: The extension's commands (R2), PR 1

- New command `ritemark.page.openInSystemBrowser` (`vscode.env.openExternal` on the file URI, any local `.html`), and `ritemark.page.publish` registered but reachable from no menu until PR 4; it refuses a file outside the project by `realpath`.

### W2: The page's bar in patch 010 (R1, R2), PR 2

- Two Ritemark actions at the right end of `MenuId.BrowserActionsToolbar`, calling the extension's commands: Open in browser when `ritemarkBrowserLocalPage`, Publish (and later the Published chip and Copy link) when `ritemarkBrowserProjectPage`. Both keys computed in the workbench from the model's URL and the workspace folders.
- The rest of the bar stays the browser's (Jarmo, 4 November, ritemark-dev 14e0d03 and 05bc028): the address, back, forward and reload; links open in the same tab and back returns. No navigation handler.
- Reload on a file change: upstream's `browserAutoReloadFeatures.ts` (VS Code 1.142, `workbench.browser.autoReloadOnFileChange`, on) already watches a `file:` page and reloads it while it is in front; nothing to build.
- The session is unchanged (Jarmo, decision 4: no).

### W3: What goes and the guard (R3, R4, R5, R8), PR 3

New folder `src/publish/` (no `vscode` import in the pure parts, so they test under Node):
- `gather.ts`: parse with the HTML tokenizer the extension already bundles (A3 names it; no new dependency), collect references, resolve and `realpath` each, apply the project boundary and the exclusions (dot segments, `node_modules`, `git check-ignore` when Git is there), recurse through linked CSS, return `{ files, leftOut: [{ ref, reason }], links }`.
- `secretScan.ts`: the patterns of R4, line numbers, masked previews. Test fixtures are assembled at run time so no key-shaped string sits in the repo.
- `publishRecords.ts`: `globalStorage/publish/v1/records.json`, keyed by the file's real path; content hash over every file that goes.
- The sheet: `webview/components/publish/PublishSheet.tsx` on `ui/dialog.tsx`'s parts; it receives the list, counts and the masked hits, never a token.
- `REVIEW.md`: `src/publish/` joins the High row.

### W4: The Cloudflare client (R7), PR 4

`src/publish/cloudflare/client.ts`: the spike's calls as plain `fetch` with a deadline (`fetchWithDeadline`'s pattern, `src/googleDocs/oauth.ts:50`), `redact()` on every error text, bucket uploads with the upload JWT, metadata-only deploy with `assets.config._headers = "/*\n  X-Robots-Tag: noindex\n"`, subdomain on with previews off, delete, and an address check after delete. Behind `src/publish/host.ts`'s interface (`connect`, `publish`, `update`, `unpublish`, `status`), Cloudflare its first implementation. Tested against a local fake server built from M-measurements' recorded responses.

### W5: The connection (R6, R9), PR 4

- `src/publish/cloudflare/oauth.ts`: Google's flow shape (listener, PKCE, `state`, deadline) with Cloudflare's endpoints and M12's redirect; token auth `none`.
- `src/publish/cloudflare/config.ts` + `esbuild.config.mjs` define `__RITEMARK_CLOUDFLARE_OAUTH__` from `RITEMARK_CLOUDFLARE_CLIENT_ID`; `scripts/check-google-oauth-build.mjs`'s twin check for releases once the public client exists.
- `src/publish/cloudflare/account.ts`: the SecretStorage entry, single-flight refresh, Disconnect with revoke (M14).
- The token path: on `publish:startTokenEntry` (which carries no value) the host opens the template link and its own input box (`vscode.window.showInputBox({ password: true })`, the lead's words in spec R6), checks the token, and stores it; the value never touches a webview.
- Settings ▸ Sharing ▸ Web pages: a row like `GoogleDocsSettingsCard.tsx`, with messages `publish:connect`, `publish:startTokenEntry`, `publish:disconnect`, `publish:open`, `publish:unpublish`, none carrying a token. **The generic `setApiKey` gets an allowlist** of today's five key names (`RitemarkSettingsProvider.ts:382–389`), so the page can't write `ritemark.publish.*` or any other secret: the adjacent defect fixed in the same PR, with its failing-first test.

### W6: The states and wiring (R2, R7), PR 4

Publish, Publishing…, Published (Copy link, Open the page, Update the page, Unpublish), Published · changed, Failed with Try again, Signed out. The chip and menu draw in the same toolbar as W2. The flag `web-page-publishing` gates creating, connecting, publishing and updating; the published-page list and Unpublish stay when it's off.

## Pull requests

See [sprint-plan.md](sprint-plan.md#pull-requests).

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| A file goes public that the person didn't choose | R3's boundary and exclusions as tests first (S8–S13), A3's corpus, the sheet's full list, High review with `/security-review` |
| A key in the page goes public | R4's scan on Publish and on every Update (S14) |
| The token leaks to a webview, log or error | The host-only input box, `redact()`, the allowlist on `setApiKey`, S21's search of the run's logs and messages |
| The direct-upload API differs from the docs | A4 before W4's code is final; the contract script stays as a check before each release |
| Cloudflare's OAuth client is late or refused | The token path ships alone (cut order 1); OAuth joins in an extension release |
| Unpublish leaves the page up (cache, old version) | M9; Ritemark says "Unpublished" only after the address check |
| Patch 010 conflicts with another 2.2 shell PR | 146 and 152 change 018/019, not 009/010; PR 2 rebases alone |
| A hostile local page uses the person's sign-ins in the shared session | Accepted by Jarmo (decision 4: no private session); A2 records what a page can do with it, and the release notes don't promise more |
| The free plan's 100 Workers per account | One Worker per page; Settings lists them with Unpublish; a refusal reads plainly |
