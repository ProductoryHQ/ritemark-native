# Sprint 98 — Phase 1 Research Findings

Date: 2026-07-21. VS Code OSS **1.117.0** (`vscode/package.json:3`).
All references verified against the shipped submodule and the installed production app.

---

## PLAN CORRECTIONS (read these first)

Four assumptions in `sprint-plan.md` were wrong or incomplete. The plan text has been amended; this section records why.

### C1 — `.obsolete` is a dead end; quarantine by directory RENAME

`.obsolete` appears in exactly one file (`vscode/src/vs/platform/extensionManagement/node/extensionManagementService.ts:558`, watcher check at `:472`; read/write at `:822-857`, shape `IStringDictionary<boolean>` keyed by folder name). It is owned by the **node/main-process** management service.

**The scanner that actually produces the workbench extension list never reads it.** In 1.117 user extensions are enumerated from the profile `extensions.json` via `IExtensionsProfileScannerService` (`extensionsScannerService.ts:646-660`), not by directory listing. Writing `.obsolete` would not stop the broken copy from loading.

**Rename wins decisively.** After renaming `<dir>` → `<dir>.quarantined-<ts>`, the profile entry points at a missing `location`; `scanExtension` catches the manifest-read failure and marks `isValid = false` (`extensionsScannerService.ts:677-690`) rather than throwing, and invalid extensions are filtered out entirely because `scanUserExtensions` runs without `includeInvalid` (`cachedExtensionScanner.ts:57`, filter at `extensionsScannerService.ts:357-359`). Only the bundled System copy survives into `dedupExtensions`. **Fallback to built-in is guaranteed and version-agnostic.** VS Code's own hard-delete path already uses rename-with-postfix (`extensionManagementService.ts:814-818`), so this is idiomatic.

### C2 — Do NOT gate on `isBuiltin`; gate on `extensionLocation` containment

`extensionsUtil.ts:31` **mutates `isBuiltin` to `true`** on a user copy that legitimately overrides a built-in. So the broken user copy reports `isBuiltin === true`. `isUserBuiltin` is also not a location signal (`extensionsScannerService.ts:1062`). The only trustworthy discriminator is path containment of `IExtensionDescription.extensionLocation` (`extensions.ts:521-524`) under the user extensions dir.

### C3 — Insert BEFORE the `isDev` early-return

`mainThreadExtensionService.$onExtensionActivationError` (`vscode/src/vs/workbench/api/browser/mainThreadExtensionService.ts:82-108`) ends with:
```ts
const isDev = !this._environmentService.isBuilt || this._environmentService.isExtensionDevelopment;
if (isDev) { this._notificationService.error(error); return; }
console.error(error.message);   // ← the incident's silent-death path in production
```
Any code inserted after the `isDev` branch would never run in a shipped build. Insert before it.

### C4 — `minimumAppVersion` IS already enforced (plan premise wrong)

Enforced at `extensions/ritemark/src/update/updateResolver.ts:52` (`release.minimumAppVersion ?? release.appVersion`, plus exact base-match at `:57`) and `updateService.ts:317-325` (legacy path). The genuine gaps are: (a) no enforcement at the **installer** layer — `applyUpdate` installs any manifest handed to it; (b) `validateManifest` (`updateManifest.ts:71-136`) never validates the field at all.

---

## A) Activation-error hook — CONFIRMED, module-load throws DO reach it

Chain traced end to end:
1. `extHostExtensionService.ts:239-267` (node) — `_doLoadModule` wraps `require()` in `try/finally` with **no catch**; a `Cannot find module 'pdfkit'` propagates unchanged.
2. `extHostExtensionService.ts:467-500` (common) — module load sits inside `Promise.all`, so the rejection becomes the activation promise's rejection.
3. `extHostExtensionService.ts:430-437` — `_activateExtension` explicitly **rethrows**.
4. `extHostExtensionActivator.ts:422-451` — catch fires, builds `Activating extension 'ritemark.ritemark' failed: <msg>.`, calls `onExtensionActivationError(id, error, null)`. Only escape hatch: cancellation errors during shutdown (`:445`) — not our case.
5. `extHostExtensionService.ts:187-189` — proxies to `$onExtensionActivationError`.
6. **`mainThreadExtensionService.ts:82-108`** (renderer) — the patch target. Protocol decl at `extHost.protocol.ts:1961`.

`missingExtensionDependency` will be **`null`** for our failure mode — do not key off it.

## B) Where the extension was loaded from

`IExtensionDescription.extensionLocation: URI` (`extensions.ts:521-524`); no `extensionPath` on this interface. Obtain via `await this._extensionService.getExtension(extensionId.value)`. Compare against the user extensions dir with `extUri.isEqualOrParent`. `IWorkbenchEnvironmentService` is already injected (`mainThreadExtensionService.ts:48`).

## D) Dedupe / semver floor — and why the ext lane works at all

Desktop workbench uses `extensionsUtil.ts:13-40` (called from `cachedExtensionScanner.ts:115`). Line 26: `if (semver.gte(builtin.version, user.version)) skip user`. **Picks by VERSION, not location precedence.**

This is why `scripts/floor-bundled-extension.sh` exists (invoked at `scripts/build-prod.sh:252`): it floors the **bundled** copy's version to `X.Y.Z-0`. Verified empirically:

| bundled | user | `gte(bundled,user)` | outcome |
|---|---|---|---|
| `1.8.3` | `1.8.3-ext.1` | true | user SKIPPED |
| **`1.8.3-0`** | `1.8.3-ext.1` | **false** | **user WINS** ✅ |
| `1.8.4` | `1.8.3-ext.1` | true | user SKIPPED (correct — newer app) |

Installed app confirms bundled `package.json` version is `1.8.4-0` while the source tree says `1.8.4`. **The floor mechanism is the `-0` suffix applied at build time, not a patch.** Patch 012 must not touch `extensionsUtil.ts`.

Post-quarantine fallback does **not** depend on this comparison at all — it works via the invalidity filter in C1, which is stronger.

## E) Reload mechanics — already available

`IHostService` is **already injected** at `mainThreadExtensionService.ts:44`. In-file precedent at `:113-122`: `INotificationService.notify` with a `toAction` primary running `this._hostService.reload()`. `toAction`, `Severity`, `localize`, `INotificationService`, `IHostService` all already imported (lines 6, 10, 12, 17, 29).

## F) Patch 012 shape — ONE file

Target: `vscode/src/vs/workbench/api/browser/mainThreadExtensionService.ts`, inserted in `$onExtensionActivationError` after the `missingExtensionDependency` block (~`:100`), before the `isDev` branch.

Scoping (both conditions are pure reads on data already in hand):
1. exact id match on `ritemark.ritemark`;
2. `extensionLocation` under the user extensions dir.

New DI params needed: `IFileService` (for the rename via `move`) and `IUriIdentityService` (for `extUri.isEqualOrParent`). Constructor at `:39-49`.

**Patch-ordering: ZERO overlap.** No existing patch (001–011) touches `mainThreadExtensionService.ts`, `extensionsUtil.ts`, `extensionsScannerService.ts`, `extHostExtensionService.ts`, or `cachedExtensionScanner.ts`. Patch 012 appends last with no reordering.

---

## Installer research (Phase 3 inputs)

### Current `applyUpdate` — `extensions/ritemark/src/update/userExtensionInstaller.ts:86-152`

Guards (type/files/dirname) → `targetDir = <userData>/extensions/<extensionDirName>`, `stagingTarget = <userData>/staging/<extensionDirName>` (`:111-112`) → **`Already installed` short-circuit (`:116-122`)** → `ensureDir` (`:125-126`) → `downloadFilesToStaging` (`:129`) → `verifyAllChecksums` (`:132`) → **atomic `fs.promises.rename(stagingTarget, targetDir)` (`:135`)**.

`downloadFilesToStaging` (`:271-291`) creates staging and writes **only manifest files** — nothing else ever exists. That is the incident, exactly.

**Clone+overlay slots between `:126` and `:129`.** The atomic rename at `:135` is the only publish point, so cloning into staging preserves atomicity for free.

### Locating the BUILT-IN copy — the trap and the fix

`vscode.extensions.getExtension('ritemark.ritemark')?.extensionPath` returns whichever copy the scanner **loaded** — after any successful update that is the user copy, i.e. after the incident it is the broken 4-file tree. Cloning from it would be self-perpetuating corruption.

Use **`path.join(vscode.env.appRoot, 'extensions', 'ritemark')`** (`vscode.env.appRoot` already used at `versionService.ts:43`). Build pipeline confirms the offset: `scripts/build-prod.sh:175` `EXT_DEST="$APP_PATH/Contents/Resources/app/extensions/ritemark"`. Verified live: that dir holds `node_modules/` (428 MB), `themes/`, `media/*.svg`, `binaries/`, `starter-pack/`.

Do **not** copy `bundledAgentRuntime.ts:14-22`'s `__dirname`-depth math (forbidden — `vscode-development/SKILL.md:250`); reuse only its candidate-list + `existsSync` probe shape. New util: `src/update/bundledExtensionPath.ts`, appRoot-injectable for testability. **Fail closed** if not found.

### App version API

`versionService.ts:41-59` `getCurrentAppVersion()` — reads `product.json` from `vscode.env.appRoot`, prefers `product.ritemarkVersion`. NOT `vscode.version` (that's upstream VS Code's, deliberately left intact).

### Manifest / feed

`UpdateFile` (`updateManifest.ts:11-20`): `path`, `url`, `sha256`, `size` — all required, no operation discriminator, so **deletions cannot be expressed**. Minimal addition: optional `op?: 'write' | 'delete'` (default `'write'`), with conditional field validation.

`fetchUpdateFeed(feedUrl = DEFAULT_UPDATE_FEED_URL)` (`updateFeed.ts:193`); constant at `:10-13` → `https://github.com/jarmo-productory/ritemark-public/releases/latest/download/update-feed.json`. **Single production call site passes nothing** — `updateService.ts:256`. `UpdateFeed.channel` typed `'stable'` (`:54`) with a degenerate no-op ternary at `:183` that must become a real branch.

### Settings

`extensions/ritemark/package.json:186-201` holds `ritemark.updates.enabled` / `.dismissed` / `.mode`. `.mode` is a `string` + `enum` — direct structural precedent for `.channel`. Read sites: `updateScheduler.ts:15-16`, `updateService.ts:431` (enabled), `updateService.ts:359` (mode). Channel→URL wiring goes at `updateService.ts:256`.

### esbuild externals — the completeness rule

`extensions/ritemark/esbuild.config.mjs:20-26`: `['vscode','fsevents','@anthropic-ai/claude-agent-sdk','@agentclientprotocol/sdk','pdfkit']` (module-local `const`, **not exported** — export it rather than regex-scraping).

| module | required by `out/extension.js` | mechanism |
|---|---|---|
| `vscode` | yes | host-provided — **exempt from existence check** |
| `fsevents` | no (0 refs) | transitive/optional |
| `@anthropic-ai/claude-agent-sdk` | yes | `dynamicImport` (lazy) |
| `@agentclientprotocol/sdk` | yes | `dynamicImport` (lazy) |
| **`pdfkit`** | **yes** | **static top-level `require` (`extension.js:10312`)** — throws at MODULE LOAD, which is why the incident killed the extension outright |

`out/browser/browserMcpAdapter.js` requires only `net` (built-in) — zero external deps.

**No `.vscodeignore` exists.** Packaging is `cp -R extensions/ritemark "$EXT_DEST"` (`build-prod.sh:187`) minus three subtractions (`:191` webview/node_modules, `:192` webview/src, `:201` foreign agent runtimes) plus the version floor (`:252`). So the built-in copy is the whole source tree — exactly the base layer to clone.

Rule: for each `external` except `vscode`, assert `<bundled-ext>/node_modules/<mod>/package.json` exists. **Must run against the BUILT APP's copy** (the source tree passes trivially) → this belongs in a **shell-release** preflight, not `release-extension-preflight.sh`. Complementary extension-tier guard = the install-and-activate smoke test.

### Release scripts today

`release-extension-preflight.sh` — 5 checks: clean tree (`:53-58`), release-tier denylist (`:60-113`), `engines.vscode` floor (`:115-141`), extension compiles (`:143-151`), webview bundle present/fresh/sentinel (`:153-169`). **Denylist drift check: CLEAN** — 12 entries identical to `CLAUDE.md:82-96`.

`release-extension.sh:174-177` packages `out/**/*.js` + `media/webview.js(.map)` + `package.json`. Incident artifact `release-staging/upload/update-manifest.json` (1.8.3-ext.1) confirms **4 files**. The `⚠ not found, skipping` branch (`:230`) is non-fatal — a missing file degrades to a warning.

Publication is **not automated**: `:254` only prints `gh release create ...`. **`--prerelease` is used nowhere.** `update-feed.json` is swept up by the `upload/*` glob; the feed is **cumulative-by-fetch** (`generate-update-feed.mjs:83` fetches the current `latest` feed and merges). Smoke test wires in at `release-extension.sh:245` (after feed generation, before the ready banner) where a real manifest + assets exist; `set -e` (`:21`) makes it blocking by construction. `vscode`-stub technique already proven at `activationIntegrity.test.ts:9-26`.

### Verified external facts (GitHub)

- `releases/latest` → `v1.8.4`, `prerelease: false`, assets include `update-feed.json`.
- An existing prerelease (`v1.0.1-beta`) is NOT latest → **prereleases are excluded from `/releases/latest` — plan assumption confirmed with live data.**
- Feed schema top-level keys: `schemaVersion`, `generatedAt`, `channel`, `fullReleases`, `extensionReleases`. `extensionReleases` is currently **empty** (the withdrawn ext.1 entry was removed).
- No `canary` tag release exists yet — Phase 5 must create it.
- `cp -c -R` (macOS): man page states it **automatically falls back to `copyfile(2)`** when src/dst are on different filesystems or the target can't clone. Verified empirically on an HFS+ volume (exit 0, content identical), and preserves mode bits + symlinks. 200 MB: 0.005 s cloned vs 0.181 s copied. **→ The plan's explicit "fallback to recursive copy" branch is unnecessary on macOS; `cp -c -R` is universally safe.**
- `gh release upload --clobber` = "Overwrite existing assets of the same name" — exactly what the canary feed needs. `gh release create --latest=false` also exists as finer-grained control.

---

## New risks surfaced (added to sprint-plan.md)

1. **`Already installed` short-circuit is a re-release trap** (`userExtensionInstaller.ts:116-122`): anyone holding the broken `ritemark-1.8.3-ext.1` would have a corrected re-release of the same version silently no-op'd. Needs either a version-bump-only policy or a validity probe before the short-circuit.
2. **No path-traversal containment** on `file.path` (`downloadFilesToStaging:282` joins without checking the result stays inside staging). Checksums are not an independent control — they live in the same manifest. Becomes materially more important once `op: 'delete'` exists.
3. **Feed generation is cumulative-by-fetch and channel-blind** (`generate-update-feed.mjs:83`): a canary publish would merge into and clobber the stable feed unless the fetch becomes channel-aware.
4. **Zero test coverage of `applyUpdate`** — `updateService.test.ts` stubs it out entirely; only `activationIntegrity.test.ts` builds a real installer, and only for cleanup/removal paths.
