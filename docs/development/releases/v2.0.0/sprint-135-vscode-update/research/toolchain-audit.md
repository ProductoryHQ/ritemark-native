# Toolchain audit (Workstream 2b)

The audit for [technical-plan.md](../technical-plan.md) Workstream 2b, with W4, W5 and W6, and spec R3, R4, R5 and R9. It compares the pin, 1.117.0 (`10c8e557`), with the frozen target, 1.142.0 (`d956e8a6`). Done on 19 October 2026, read-only, in the sprint worktree at `9e7e57bb`.

How to read the citations:

- `target:<path>:<line>` is `git -C vscode show d956e8a6:<path>`.
- `pin:<path>:<line>` is the same at `10c8e557`.
- Plain paths are repository files at `9e7e57bb`.
- "Observed" means seen in this worktree's `vscode/node_modules`. The sprint session installed it today at 17:57, at the target, with Node 24 arm64. This audit did not install anything.

## Summary

| # | Item | Finding | Action for the sprint |
|---|---|---|---|
| 1 | Node and npm | The target's `.nvmrc` is 24.18.0. `preinstall.ts` needs Node 24.x at 24.18.0 or later, npm below 13, and no yarn. Node 24.18.0 arm64 with its npm 11.16.0 passes. Node 22.22.1 fails. | None. Commit `2986632f` already moved the pins. |
| 2 | Windows layer 1 | npm 11.16.0 bundles node-gyp 12.3.0, which maps Visual Studio 18 to 2026. The first version with that mapping is 12.1.0, not 12.0.0 or 12.4.0 as the workflow and the memory say. | Drop the node-gyp swap in `build-windows.yml` and `windows-canary.yml`, in one commit. Keep a fast check that npm's own node-gyp finds Visual Studio and is 12.1.0 or later. |
| 3 | Windows layer 2 | The target's `preinstall.ts` finds VS 2026 by its `18` folder and reads `vs2026_install`. | Remove the `vs2022_install` wiring. Don't rename it. |
| 4 | Windows layer 3 | Of 65 lockfiles at the target, only `build/npm/gyp` pins a node-gyp, and it shadows nothing. Copilot no longer pins one, and its `sqlite3` is gone. | Drop copilot's `ignore-scripts=true` step. If Windows CI then fails inside copilot's install, put it back: it was green at the pin. |
| 5 | macOS build steps | The `vscode-darwin-arm64`, `vscode-darwin-x64` and `vscode-win32-x64-min` tasks still exist, and they bundle with esbuild. Everything `build-prod.sh` reads still exists. The `.woff2` loader belongs in `build/next/index.ts` only; the rebased 001 (`4d5236b8`) already does this. The x64 CI overrides the Electron headers with 30.5.1. | Delete the `npm_config_*` overrides in `build-macos-x64.yml`. Remove the dead `mermaid-chat-features` strip in `build-prod.sh`. Add a font check to the built app. |
| 6 | Native modules | The target's `vscode/node_modules` has 41 `.node` files: 19 compiled from source, 7 prebuilt for this platform and 15 prebuilt for other platforms. New since 1.117.0: `@vscode/fs-copyfile`, `@vscode/os-proxy-resolver-*`, `@github/copilot-sdk-*`, `@koromix/koffi-*` and `foundry-local-sdk`. Every shipped macOS module uses N-API. | Derive `check-native-modules.sh`'s list from `find`, with the rule below. Add a check of every `.node` file's architecture to `validate-build-output.sh`, before its Check 6. Add the proxy resolver to the S10 smoke list. |
| 7 | Electron 39 → 43 | None of Electron 40–43's breaking changes touch what patches 004, 012 or 018 call. The extension host still sets `ELECTRON_RUN_AS_NODE`. Node 24 warns (DEP0190) when `args` are passed with `shell: true`, in 4 extension call sites. The EMFILE preload works on Node 24. | No change is needed. Optionally, silence DEP0190. Add a PDF page to S26 and dialogs to the dev pass. |
| 8 | The extension on Node 24 | The extension already uses `@types/node` 24. No package in either lockfile excludes Node 24 by its engines. The tests use `tsx`, not mocha or vitest. | Run W4's compile, build and tests as planned. Optionally, fix the `node20` comment in `esbuild.config.mjs`. |
| 9 | Node pins | `2986632f` moved `.nvmrc` and the six workflows. 22.x is still named in `SKILL.md`, the ritemark-automation skill, `plan-truth-matrix.sh`, `build-windows-local.ps1` and the workflow's layer-1 comments. | Update the files listed in §9. Leave the descriptive mentions. |

No blockers were found. The risks are in the first Windows CI run (see "Other findings": the new compile-cache step) and in the x64 header override.

## 1. Node and npm

**The target's pins.** `target:.nvmrc` is `24.18.0`. `target:.npmrc` sets Electron `43.7.7` (`ms_build_id` 15553055). `target:remote/.npmrc` sets Node `24.21.0`. The target's `remote/.npmrc` no longer has the pin's `min-release-age="1"`.

**What `target:build/npm/preinstall.ts` checks**, in order:

- `:12`: `VSCODE_SKIP_NODE_VERSION_CHECK` skips the version gate.
- `:14-38`: the running Node must have the same major as `.nvmrc`. Its minor must be at least `.nvmrc`'s, and at an equal minor, so must its patch. So 24.18.0 through 24.x pass, and 22.x and 25.x fail.
- `:41-44`: it refuses yarn.
- `:46-54`: npm must be below 13. The pin required npm below 11.2.0, so the pin would refuse npm 11.16.0 as well as Node 24.
- `:58-61`: the install-state fast path.
- `:63-70`: on Windows, the Visual Studio check (§3).
- `:72`, `:123-163`: `installHeaders()`.
  - It runs `npm ci` in `build/npm/gyp`.
  - It runs `node-gyp install` for the `.npmrc` and `remote/.npmrc` targets.
  - It overlays `build/npm/gyp/custom-headers` on the downloaded headers. That now happens on every platform; at the pin it happened only on Linux.
- `:74-77`: a Node architecture that differs from the OS's only prints a warning. `validate-build-env.sh` Check 2 is what enforces arm64.

**Node 24.18.0 on this Mac.** The installed Node is `v24.18.0`, arm64 (`file` reports a Mach-O arm64 executable). It has NODE_MODULE_VERSION 137 and N-API 10. Its npm is `11.16.0`. Nodejs.org's release index agrees: 24.18.0 ships npm 11.16.0.

**The gate, run.** Lines 12–54 of the target's `preinstall.ts` were run in a scratch copy, with npm's user agent set:

- On Node 24.18.0 arm64 with npm 11.16.0, the gate passes.
- On Node 22.22.1, it stops with "Please use Node.js v24.18.0 or newer with the same major version (24)".

**Note.** Nodejs.org marks 24.18.1 (28 July) as a security release, and 24.22.0 is current. The gate accepts both. R3 pins the root `.nvmrc` to the target's 24.18.0, so nothing changes now. This is something to know when the next bump comes.

## 2. Windows layer 1: npm's node-gyp and VS 2026

**What npm 11.16.0 bundles.** It bundles node-gyp **12.3.0**, at `~/.nvm/versions/node/v24.18.0/lib/node_modules/npm/node_modules/node-gyp/`. Its engines are `^20.17.0 || >=22.9.0`.

**12.3.0 maps major 18 to 2026.** In its `lib/find-visualstudio.js`:

- `:392-394`: `versionMajor === 18` gives `versionYear = 2026`.
- `:121-123`, `:164-166` and `:225-227`: all three discovery paths search `[2019, 2022, 2026]`.
- `:463-464`: 2026 gives toolset `v145`.

**The first version with the mapping is 12.1.0**, released 12 November 2025.

- The bundled `CHANGELOG.md:56-62` reads "Add support for Visual Studio 2026 (18.x)" under 12.1.0.
- `lib/find-visualstudio.js` on GitHub has no 2026 code at tag `v12.0.0` and has it at `v12.1.0`, `v12.4.0` and `v13.1.0`.
- 12.1.0's engines (`npm view`) are `^20.17.0 || >=22.9.0`, so it supports Node 24.
- Two notes in the repository are wrong:
  - `build-windows.yml:143` says 12.0.0 (2026-01-27) added the mapping. 2026-01-27 is 12.2.0's date.
  - The VS2026 memory says 12.4.0 was the first.
- 13.x now requires `^22.22.2 || ^24.15.0 || >=26.0.0`, so Node 24.18.0 would also accept 13.x. That no longer matters if the swap goes.

**What the current swap step does** (`build-windows.yml:131-231`):

1. It finds npm's bundled node-gyp next to `node.exe` (`:188-198`).
2. It installs `node-gyp@12.4.0` with `--install-strategy=nested` in a staging project (`:201-203`).
3. It replaces npm's bundled `node-gyp` folder with that copy (`:205-206`).
4. It checks that the version is `v12.4.0` (`:208-213`).
5. It runs `findVisualStudio()` from the replaced copy and writes the path it finds as the `vs_path` step output (`:215-231`). The install step reads that output as `vs2022_install` (`:288`).

**Action.**

- Drop the swap (`:201-213`). Keep a short probe: run the same `check-vs.js` against npm's bundled node-gyp, and fail when its version is below 12.1.0. A wrong Node or npm then fails in seconds, not after a full `npm ci`.
- Drop the `vs_path` output, which only layer 2 used.
- Rewrite the comments at `:132-183`, `:240-262`, `:280-281` and `:316-318`, which name 12.4.0, 11.2.0 and "node-gyp 11".
- `windows-canary.yml:77-127` mirrors the swap, and its error text names 12.4.0. Its drift-prevention rule (`build-windows.yml:132-135`) requires the same change in the same commit.
- The canary's compile probe (`:129-145`) can stay. Its `npm_config_node_gyp` (`:137`) then points at npm's own node-gyp 12.3.0.
- `NODE_GYP_FORCE_PYTHON` (`:282`, `:319`) still works: 12.3.0 reads it at `lib/find-python.js:73`. Python 3.11 is inside its range (`>=3.6.0`, `:46`).

## 3. Windows layer 2: VS Code's own toolchain check

**The target's detection** (`target:build/npm/preinstall.ts:79-121`):

- It lists `{ year: '2026', folder: '18' }` first (`:83-87`).
- For each version, it accepts an existing path in `vs<year>_install` (`:92-96`), then looks for `%ProgramFiles%/Microsoft Visual Studio/<folder>/<edition>` (`:102-108`). Editions include Enterprise and BuildTools.
- The error text names `vs2026_install` (`:67`).

At the pin, the check knew only the `2022` and `2019` folders (the pin→target diff).

**The runner.** The VS2026 memory records the `windows-8core` install at `C:\Program Files\Microsoft Visual Studio\18\Enterprise`. Lines 104–108 match that path with no environment variable.

**Action.** Remove `vs2022_install` (`build-windows.yml:283-288`) together with the `vs_path` output. Don't rename it to `vs2026_install`: nothing needs it. If it stays, it still passes (`:92-95` checks only that the path exists), but it names the wrong year and depends on the step that layer 1 removes.

## 4. Windows layer 3: lockfiles that pin a node-gyp

**The scan.** `git -C vscode ls-tree -r --name-only d956e8a6` lists **65** `package-lock.json` files; the pin had 60. They were searched for `"node_modules/…node-gyp"` entries, nested ones included.

| Lockfile | Pin | Target |
|---|---|---|
| `build/npm/gyp/package-lock.json` | node-gyp 11.2.0 (`:714`) | node-gyp 11.2.0 (`:703-704`) |
| `extensions/copilot/package-lock.json` | node-gyp 10.3.1 (`:16724-16725`) | **none** |
| the other 63 | none | none |

**`build/npm/gyp` is harmless.** It is only called by path in `preinstall.ts:134-149`, for `node-gyp install`, which downloads headers. No dependency's install script resolves to it, as the memory already says.

**Copilot at the target.**

- Its lockfile has no node-gyp, and its `sqlite3` (5.1.7 at the pin) is gone.
- The packages in it with install scripts are: `esbuild`; `keytar` 7.9.0 (optional, dev, an optional dependency of `@vscode/vsce`); `@playwright/browser-chromium`; `@vscode/vsce-sign`; two `fsevents`; and `protobufjs`.
- `keytar` is the only native one. Its `prebuild-install || node-gyp rebuild` now reaches npm's own node-gyp 12.3.0. Because it is optional, a failure would not fail `npm ci`.
- Copilot's own `allowScripts` (`target:extensions/copilot/package.json`) denies `protobufjs`.

**Action.** Drop the "Skip native builds for bundled copilot extension" step (`build-windows.yml:233-268`), as the plan's rule says.

What changes: copilot's `postinstall` (`tsx ./script/postinstall.ts`) and its dependencies' install scripts run on Windows for the first time since 1.117. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (`:275`) still stops the Chromium download. If the first Windows run fails inside copilot, re-adding the one line is the known-safe fallback.

**npm 11 enforces `allowScripts`. This is new.**

- `target:package.json:298` approves the native packages by exact version. It denies `ssh2`, `cpu-features`, `koffi`, `protobufjs`, `es5-ext` and `husky`.
- npm 11.16.0's `strict-allow-scripts` defaults to false (`npm/docs/content/using-npm/config.md`). So scripts that are neither approved nor denied still run, with a notice. Denied ones are skipped silently.
- The result: the non-fatal `ssh2` `sshcrypto` build error noted in the VS2026 memory should go. This is observed on the Mac: the 1.117 install in the main checkout has `remote/node_modules/ssh2/lib/protocol/crypto/build/Release/sshcrypto.node`, and the target install has none.

## 5. macOS build steps

### The gulp tasks

- `target:build/gulpfile.vscode.ts:564-628` defines `vscode-<platform>-<arch>`, `…-min` and `…-ci` for `win32-x64`, `darwin-x64` and `darwin-arm64`, among others.
- `vscode-darwin-arm64` (`:610-621`) runs in series: codicons; cleaning and compiling the non-native extensions; compiling copilot; extension media; `writeISODate('out-build')`; `esbuild-bundle-darwin-arm64` (`:600-608`, which calls `runEsbuildBundle('out-vscode', …)`); and `vscode-darwin-arm64-ci`, which packages (`:581-597`).
- So all three calls exist at the target: `build-prod.sh:205` (`npm run gulp vscode-$TARGET`), `build-macos-x64.yml:144` (`npm run gulp vscode-darwin-x64`) and `build-windows.yml:483` (`npx gulp vscode-win32-x64-min`).
- `build/lib/esbuild.ts` is a thin wrapper. It starts `build/next/index.ts bundle` (`target:build/lib/esbuild.ts:51-60`).
- The packaging task does **no type-check**: esbuild only strips the types. The type gates are:
  - `core-ci`'s `tsgo-typecheck` (`:67-83`);
  - `npm run compile`, whose `compileTask` runs `spawnTsgo(…, { noEmit: true })` (`target:build/lib/compilation.ts:114-134`). TypeScript 7 is installed as `@typescript/native` (`target:build/lib/tsgo.ts:25`).
- At the pin, the same task already used esbuild. `pin:build/buildConfig.ts` sets `useEsbuildTranspile = true`, and `pin:build/gulpfile.vscode.ts:757-777` then picks `esbuild-bundle-*`.

### Where patch 001's `.woff2` loader belongs

- At the pin, `build/lib/optimize.ts` and `vscodeResourceIncludes` fed only `bundleVSCodeTask` (`pin:build/gulpfile.vscode.ts:125-165`), which Ritemark's build never ran. So 001's hunks in `optimize.ts` and `gulpfile.vscode.ts` were already dead in production.
- The hunk that worked was the loader in `pin:build/next/index.ts:863-869`, with `assetNames: 'media/[name]'`.
- The shipped 1.14.0 app proves it. `/Applications/Ritemark.app` has `out/media/phosphor.woff2`, `SofiaSans-latin.woff2` and `SofiaSans-latin-ext.woff2`, and `workbench.desktop.main.css` points to `url("../../media/….woff2")`.
- At the target, the only esbuild loader map in `build/` is `target:build/next/index.ts:518-523` (`assetNames` at `:524`). `vscodeResourceIncludes` is gone. Desktop resources are now listed in `build/next/resources.ts:34-82`, which the fonts don't need.
- **Done:** the rebased 001 (`4d5236b8`) adds `'.woff2': 'file'` at `index.ts:517-523` and drops the other two hunks.
- Without the loader, esbuild would be expected to stop with "No loader is configured" (unverified here). So a missing loader fails loudly; it does not drop the fonts silently.
- **Suggested:** a font check in `validate-build-output.sh` Check 3. It would require the three `.woff2` files in `out/media/` and their `url()`s in `workbench.desktop.main.css`.

### What `build-prod.sh` relies on before and after the gulp task

- **`apply-patches.sh` copies these files to the target** (`:266-339`):
  - `resources/darwin/code.icns`, `resources/win32/code.ico`, `code_150x150.png`, `code_70x70.png` and `VisualElementsManifest.xml`;
  - `src/vs/workbench/browser/media/code-icon.svg`;
  - `src/vs/base/browser/ui/codicons/codicon/` and `product.json`.
  - All of these exist at both commits (`git cat-file -e`).
  - The fonts are copied into `src/vs/workbench/browser/media/fonts/` and `…/codicon/phosphor.woff2` (`:305-334`).
- **`product.json` is replaced wholesale** (`apply-patches.sh:336-341`). So W8 must merge new upstream fields into `branding/product.json`.
  - Keep `electronArtifactFeed` and `nodejsArtifactFeed` empty, as they are at `target:product.json:35-36`.
  - When the feed is set, `target:build/lib/electron.ts` fetches Electron from an Azure feed with the `az` CLI, not from GitHub releases.
- **The Electron version** comes from `vscode/.npmrc` (`target:build/lib/electronVersion.ts:12-14`). `electron` is no longer an npm dependency at the target. It is absent from `target:package-lock.json`, which was at 39.8.7 at the pin. `@vscode/gulp-electron` 1.43.1 downloads it.
- **The output path is unchanged.** `buildRoot = path.dirname(root)` (`:562`) gives `VSCode-<target>/Ritemark.app`. `productAppName` is `product.nameLong` (`target:build/lib/electron.ts:145`). The `Contents/MacOS/<nameShort>` and `Contents/Resources/app` layout is unchanged (`target:build/lib/nodeCompileCache.ts:37-41`).
- **After the gulp task**, each input still exists:
  - `ritemarkVersion` and the copied product keys (`build-prod.sh:279-304`);
  - `Info.plist` (`:312-315`);
  - `out/vs/workbench/workbench.desktop.main.css` (`:360`). `vs/workbench/workbench.desktop.main` is still a CSS-bundled entry point (`target:build/next/index.ts:102-103`, `:184`).
  - The provenance inputs (`scripts/build-provenance.mjs:173-179`), including `vscode/package-lock.json`.
- **A dead entry:** `build-prod.sh:351` strips `mermaid-chat-features`, which the target no longer has. The new built-ins, `mermaid-markdown-features` and `theme-modern-icons`, are W8's decision.

### Xcode, the macOS SDK and Python

- **The headers' requirements.** Electron 43.7.7's headers compile with `gnu++20` at `MACOSX_DEPLOYMENT_TARGET` **12.0**; Electron 39.8.7's used 11.0. Node 24.21.0's headers, used for `remote/`, set 13.5. Source: `~/Library/Caches/node-gyp/<v>/include/node/common.gypi`.
- **The minimum macOS** stays 12. Electron 38 already dropped macOS 11. Electron **44** drops macOS 12 (Electron's `breaking-changes.md`, 44.0 section), which matters for the next bump.
- **node-gyp 12.3.0** needs the Xcode Command Line Tools and a supported Python (`README.md:37-46`). It notes that Python 3.12 or later needs node-gyp 10 or later.
- **Upstream pins no Xcode.** Its macOS pipeline only runs `xcode-select -print-path` and `python3 -m pip install setuptools` (`target:build/azure-pipelines/darwin/steps/product-build-darwin-setup.yml:84-85`).
- **Observed on this Mac:** every native module in the target install was built for Electron 43.7.7, ABI 148, arm64 (`node_modules/*/build/config.gypi`), with `/Library/Frameworks/Python.framework/Versions/3.11/bin/python3`. The machine has Xcode 26.6 (17F113), SDK 26.5, Apple clang 21.0.0 and macOS 26.5.1. So the local toolchain already builds the target.

### The CI runners

| Workflow | Runner | Notes |
|---|---|---|
| `build-windows.yml` | `windows-8core` | Image `windows-2025-vs2026` (VS2026 memory) |
| `windows-canary.yml` | `windows-latest` | Both jobs |
| `build-macos-x64.yml` | `macos-15-intel` | The last run (job 115857260854, 14 October) resolved to image `macos-15` 20260824.0482.1 on macOS 15.7.9 (log lines 15–19). Its default Xcode is unverified. |
| `agent-runtime-matrix.yml` | `macos-15-intel`, `windows-latest` | |
| `build-whisper.yml` | `windows-latest`, `macos-15-intel`, `macos-15`, `macos-14`, `ubuntu-latest` | |
| `windows-test-overlay.yml` | `ubuntu-latest` | |

### The x64 CI builds against stale Electron headers

- `build-macos-x64.yml:68-73` sets `npm_config_disturl`, `npm_config_target: 30.5.1`, `npm_config_runtime` and `npm_config_build_from_source` for `npm ci`. They date from the commit that created the workflow (`8d46d901`).
- In npm, an environment variable overrides the project's `.npmrc` (`config.md:42`). Tested here with npm 11.16.0: `npm config get target` prints `43.7.7` from a project `.npmrc`, and `30.5.1` when `npm_config_target=30.5.1` is set.
- The last x64 run's log shows the variable (line 559). It also shows the preinstall fetching v39.8.7 headers (lines 628–631), because `preinstall.ts` reads `.npmrc` directly.
- So, as an inference not confirmed by a log line, the native rebuilds compile against Electron 30.5.1's headers.
- This has been hidden because every shipped macOS module uses only N-API. `nm -u` on the target's arm64 builds shows `_napi_*` imports and no V8 or Node C++ symbols. Even so, headers 13 majors old could break a module that uses a newer N-API.
- **Action:** delete the four `npm_config_*` lines, so `vscode/.npmrc` decides, as it does in `build-prod.sh` and upstream. `ELECTRON_SKIP_BINARY_DOWNLOAD` (`:73`, and `build-windows.yml:274`) is moot: the target has no `electron` npm package, and Electron 42 dropped the variable.

### npm's warning about `.npmrc` keys

npm 11.16.0 warns "Unknown project config "target" … This will stop working in the next major version of npm" for VS Code's `.npmrc` keys. That is, npm 12 would ignore the Electron target. `preinstall.ts` still allows npm 12 (`:50`). So keep the npm that comes with Node 24.18.0, and don't upgrade npm globally. This belongs in `SKILL.md`'s gotchas.

## 6. Native modules

### What the target's `vscode/node_modules` contains (observed)

There are 41 `.node` files.

**Compiled from source (19)**, all Mach-O arm64 or universal:

- `@parcel/watcher` (`watcher.node`)
- `@vscode/deviceid` (`windows.node`, a stub on the Mac)
- `@vscode/fs-copyfile` (`vscode_fs.node`, **new**)
- `@vscode/native-watchdog`
- `@vscode/policy-watcher`
- `@vscode/spdlog`
- `@vscode/sqlite3`
- `@vscode/windows-mutex`, `@vscode/windows-process-tree` and `@vscode/windows-registry` (Windows stubs; `.moduleignore.darwin` drops them from the app)
- `bufferutil`
- `kerberos`
- `native-is-elevated`
- `native-keymap` (`keymapping.node`)
- `node-pty` (`pty.node`)
- `utf-8-validate` (universal)
- `windows-foreground-love`
- `fsevents` 2.3.2 (universal)
- `glob-watcher/node_modules/fsevents` 1.2.13 (a file named `.node`; dev only)

**Prebuilt for this platform (7):**

- `@koromix/koffi-darwin-arm64/darwin_arm64/koffi.node` (**new**; `.moduleignore` drops `koffi`)
- `@vscode/os-proxy-resolver-darwin-arm64/os_proxy_resolver.node` (**new**; used in the main process by `nativeHostMainService.ts`)
- `@github/copilot-sdk-darwin-arm64/prebuilds/darwin-arm64/runtime.node` (**new**; the agent host)
- `bufferutil/prebuilds/darwin-arm64`
- `foundry-local-sdk/prebuilds/darwin-arm64` (2 files, **new**). Packaging excludes them (`target:build/gulpfile.vscode.ts:119-125`). They come back only when a dictation-runtime results file exists.
- `utf-8-validate/prebuilds/darwin-x64+arm64`

**Prebuilt for other platforms (15):** in `bufferutil`, `utf-8-validate` and `foundry-local-sdk`, under `prebuilds/<os>-<arch>/`. They are ELF, PE, or Mach-O x86_64.

**Gone since 1.117.0:**

- `@github/copilot` at the root, with its `prebuilds/*/{computer,keytar,pty,conpty,…}.node` and six `@teddyzhu/clipboard` binaries;
- `remote/…/ssh2/…/sshcrypto.node`.

All darwin modules that ship are N-API (`nm -u`). So an Electron ABI change cannot break them; only a wrong architecture can.

### `check-native-modules.sh`: derive the list

- Replace the fixed `MODULES` array (`:41-50`). List the files with `find "$VSCODE_NM" -name '*.node' -type f`. Optionally, also list `vscode/extensions/*/node_modules`, which dev mode loads. That adds, for example, `extensions/git/…/fs-copyfile` and copilot's `keytar`.
- The rule, for each file:
  - A Mach-O file passes if `file` shows an arm64 slice, single-arch or universal.
  - A Mach-O file without one, whose path or name names another platform or architecture (`prebuilds/<os>-<arch>/`, `*-darwin-x64*`, `/x64/`, `linux`, `win32`), is a multi-platform payload. Skip it.
  - Any other Mach-O file fails. These are the `build/Release` builds that `build_from_source` makes.
  - Skip ELF and PE files: they are other systems' payloads.
- Fail when `node_modules` exists but no `.node` file is found. Remove the `MISSING` counter (`:52-59`, `:86-88`). Keep the `npm rebuild` fix text (`:77-82`).
- A dry run of this rule on the current install: 19 compiled files pass, 7 pass as this platform's, 15 are skipped, and **0 fail**.
- Built-in extensions also hold other platforms' files: copilot's `clipboard.darwin-x64.node` and `microsoft-authentication`'s `dist/macos/x64/msal-node-runtime.node`. The path rule above covers both.
- **S10's smoke list:** add the proxy resolver to the terminal, file watching, logging and keyboard layouts. It loads in the main process.

### `validate-build-output.sh`: where the app check fits

- Add **Check 5c, native modules in the app**, after Check 5b's whisper block, its foreign-folder check and its absolute-link check (the block ends near `:492`), and before "Check 6: App Launches" (`:495`).
- The app roots are already set at `:81-92`: `$APP_PATH/Contents` on the Mac and `$APP_PATH` on Windows.
- For every `.node` file:
  - `darwin-arm64` needs `arm64` in `file -b`, and `darwin-x64` needs `x86_64`. Universal files pass. This is the same pattern as the whisper check at `:454-466`.
  - `win32-x64` needs `pe_machine` (`:394-400`) to be `8664`.
- `.node` files are unpacked to `node_modules.asar.unpacked` (`target:build/gulpfile.vscode.ts:260-261`), so `find` reaches them.
- Upstream also runs `build/darwin/verify-macho.ts <arch>` on the whole app, with `APP_PATH` set (`target:build/azure-pipelines/darwin/steps/product-build-darwin-compile.yml:143`). It checks every Mach-O file, not only `.node` files, and has its own skip list (`verify-macho.ts:24-55`). Calling it after Check 5c would also cover `rg`, `copilot-runtime` and the dylibs.
- Whether the first target build needs an allowlist is unverified until that build exists.

## 7. Electron 39 → 43, and Node 24 in the extension host

**The versions** (releases.electronjs.org):

| Electron | Node | Chrome | ABI |
|---|---|---|---|
| 39.8.7 | 22.22.1 | 142 | 140 |
| 43.7.7 | 24.21.0 | 150 | 148 |

**Electron's breaking changes for 40–43** (`docs/breaking-changes.md`, the 40.0 to 43.0 sections), as they affect Ritemark:

- **43: dialogs default to Downloads** when there is no `defaultPath`. Upstream compensates: `fileDialogService.ts` now fills `defaultUri ??=` before native save and open dialogs (pin→target diff, at +169 and +184-186). Check the extension's save and open dialogs in the dev pass.
- **43: WCO layout and rounded corners** change on Linux only. Ritemark doesn't build for Linux.
- **43: `NativeImage.toBitmap()` normalizes to sRGB.** No patch uses it.
- **42: macOS notifications** now use `UNNotification` and need a code-signed app. Ritemark itself creates none. Upstream's toasts (`nativeHostMainService.ts:1428`, `toasts.ts:66`) will fail silently in an unsigned dev build; a signed production build is fine.
- **42: `electron` no longer downloads itself** after install, and `ELECTRON_SKIP_BINARY_DOWNLOAD` is gone. This is moot: see §5.
- **42: `clearStorageData` loses `quotas`.** It is not used by the patches.
- **41: PDFs now render in the same WebContents**, as an out-of-process iframe. Add a PDF page to S26, to check 009's page context and Browser Recent.
- **40: `clipboard` from the renderer is deprecated.** No patch uses it.

**Patch 004** (`app.ts`) uses `systemPreferences.getMediaAccessStatus`, `askForMediaAccess` and `setPermissionRequestHandler`. None of these changed in 40–43, and upstream still calls `getMediaAccessStatus` (`target:src/vs/platform/native/electron-main/nativeHostMainService.ts:816-822`).

The upstream changes in this area are for the rebase:

- `'media'` is now allowed in the core (`target:src/vs/code/electron-main/app.ts:272-279`);
- auxiliary windows are checked by `isRequestFromWindow` (`:254-259`);
- a new compile-cache branch sits at `:806-814` (see "Other findings").

**Patch 012** only touches workbench code (`IFileService.move`), with no Electron API. Nothing to do.

**Patch 018** calls `win.setSheetOffset` and `updateWindowControls`. The latter reaches `setWindowButtonPosition` and `setTitleBarOverlay` (`target:windowImpl.ts:228`, `:490-528`). These APIs are unchanged in 40–43. Upstream moved the traffic-light arithmetic into `getMacOSWindowControlsPosition(height, release, horizontalInset)` (`:528`) and added `hasWindowControlOverlay` (`:188`). That is for frame audit 2a.

**The extension host on Node 24.21.0:**

- **`ELECTRON_RUN_AS_NODE`.** `extensionHostProcess.ts:114-118` sets it at both commits, unchanged. The target's build flips no Electron fuses: there is no `fuses` code in `build/`. Upstream itself still starts processes with `ELECTRON_RUN_AS_NODE=1` (`claudeSdkOptions.ts:393-406`). So the browser MCP adapter, `process.execPath` at `RitemarkToolsInjector.ts:80-83`, should keep starting as Node. Whether it does at runtime is unverified (W9).
- **`child_process`.** Node 24 makes DEP0190 a runtime warning: passing `args` together with `shell: true`. Tested: Node 24.18.0 prints the warning, and Node 22.22.1 doesn't. The command still runs.
  - The sites: `runProcess.ts:107-108` passes `shell` through, and the callers are `RitemarkSettingsProvider.ts:887-888` (every platform), `agent/setup.ts:368-371` (Windows), `codex/codexManager.ts:882-885` (Windows `.cmd`) and `agent/installer.ts:433-436` (Windows).
  - Their behaviour is unchanged. The optional fix is to build one escaped command string when a shell is needed.
- **`fs` and `util`.** Every deprecation Node 23 or 24 made runtime or end-of-life was checked (`doc/api/deprecations.md` at v24.21.0). The extension uses none of them: no `util.is*()`, no `fs.F_OK`, no `Dirent.path`, no `SlowBuffer`, and no `fs.truncate` with a descriptor. Its `readdir({ withFileTypes })` call sites use `entry.name`.
- **ESM loading.** The ESM-only agent SDKs are loaded with a dynamic `import()` (`esbuild.config.mjs:18-19`). That is unchanged. `require(esm)` has been on by default since Node 22.12, so no break is expected.

**The EMFILE preload.**

- It is not in `extensions/ritemark/`: the only EMFILE mention there is a comment at `esbuild.config.mjs:3`. It is `scripts/graceful-fs-preload.cjs`, loaded at build time by `NODE_OPTIONS=--require` in the Windows gulp step (`build-windows.yml:479-480`). It runs on the runner's Node 24.18.0, not in the extension host.
- **Tested on Node 24.18.0 (macOS):**
  - `require('fs').promises === require('fs/promises')` is true.
  - The wrapped methods are writable and configurable.
  - The wrappers are seen through CommonJS, ESM named imports, namespace imports and default imports.
  - graceful-fs 4.2.11 (from the target's `vscode/node_modules`) loads.
- How it behaves at Windows' file-descriptor limit is unverified until Windows CI (S29).

## 8. The extension on Node 24

**What the extension declares.**

- `extensions/ritemark/package.json` has `engines: { vscode: "^1.94.0" }` and no `node` engine.
- Its `@types/node` is `^24.10.8`, locked at 24.12.4: it already targets Node 24.
- `compile` is `tsc --noEmit -p ./ && node esbuild.config.mjs`. The tests are `npx tsx` scripts. There is no mocha or vitest.

**The locked versions and their engines:**

| Lockfile | Package | Version | Engines |
|---|---|---|---|
| extension | typescript | 5.9.3 | `>=14.17` |
| extension | tsx | 4.22.4 | `>=18.0.0` |
| extension | esbuild | 0.28.1 | `>=18` |
| webview | vite | 5.4.21 | `^18.0.0 \|\| >=20.0.0` |
| webview | rollup | 4.60.2 | `>=18.0.0`; native `@rollup/rollup-darwin-arm64` is N-API |
| webview | esbuild | 0.21.5 | `>=12` |
| webview | @vitejs/plugin-react | 4.7.0 | `^14.18.0 \|\| >=16.0.0` |
| webview | postcss | 8.5.13 | `^10 \|\| ^12 \|\| >=14` |
| webview | tailwindcss | 3.4.19 | `>=14.0.0` |
| webview | typescript | 5.9.3 | `>=14.17` |

None of them excludes Node 24.

**Other points.**

- The only install scripts in the extension's lockfile belong to `esbuild` and `fsevents`. Neither package has `allowScripts`, so under npm 11 those scripts run with a notice (§4).
- `esbuild.config.mjs:73` builds for `target: 'node20'`, with the comment "VS Code 1.117 / Electron ships Node 20.x". The output runs on Node 24.21. The comment was already wrong at 1.117 (Electron 39 shipped Node 22.22.1). Optionally, raise the target and fix the comment.
- Whether everything actually compiles, builds and passes its tests on Node 24 is unverified here. W4 runs them.

## 9. Node pins

**Already done in `2986632f`:**

- `.nvmrc`;
- `build-windows.yml:17`;
- `build-macos-x64.yml:32-35`;
- `windows-canary.yml:49`;
- `windows-test-overlay.yml:36`;
- `build-whisper.yml:41`;
- `agent-runtime-matrix.yml:43-46`.

**Still naming Node 22, to change:**

| File | Line(s) | What |
|---|---|---|
| `.claude/skills/vscode-development/SKILL.md` | 261, 264 (and 262) | The Node table: dev mode "v22.22.1", "Repo root `.nvmrc` pins 22.22.1", "VS Code 1.117's `preinstall`". The webview row "Node v20" should read 24.18.0. Also add the npm-12 note from §5. |
| `.claude/skills/ritemark-automation/SKILL.md` | 45, 46, 77, 95, 400 | A hard-coded arm64 `PATH=…/v22.21.1/bin` for the automation tools |
| `.agents/skills/ritemark-automation/SKILL.md` | 30, 31, 60, 78, 240 | The Codex mirror of the row above. `harness-equalizer` syncs it (CLAUDE → CODEX); don't edit it by hand. |
| `scripts/qa/plan-truth-matrix.sh` | 36 | `PATH=…/v22.21.1/bin` for `code.sh`. It works, because `VSCODE_SKIP_PRELAUNCH` limits Node to `node -p`, but it is stale. |
| `scripts/build-windows-local.ps1` | 53 | The message "Install Node 22.x" |
| `.github/workflows/build-windows.yml` | 137-148 | The layer-1 comments; they go with §2 |

**Descriptive only, leave them:**

- `scripts/update-vscode.sh:135`;
- `extensions/ritemark/src/codex/codexManager.ts:184` and `codexManager.test.ts:50-51`;
- `.claude/skills/ritemark-visual-regression/SKILL.md:155` and `scripts/composer-menus-check.mjs:29` ("Needs Node 22" is a minimum);
- `scripts/test-release-source-integrity.sh:39`, a fixture `.nvmrc`.

**Read the version at run time, so need no change:**

- `build-prod.sh:46`, `build-prod-windows.sh:19`, `build-windows.sh:26` and `build-mac.sh:9`;
- `validate-build-env.sh:13`, `create-release-worktree.sh:91` and `release-preflight.sh:41`.

**Other pins.**

- No `package.json` in the repository has a `node` engine. Outside `vscode/`, the only `@types/node` is the extension's, already at `^24.10.8`. The webview declares none; its lockfile has 25.6.0 as an indirect dependency.
- At the target, VS Code's own `@types/node` is `24.x`.

**A note for S7.** `validate-build-env.sh`'s `use_repo_node` (`:16-35`) switches to 24.18.0 through nvm before Check 1. So the "fails on Node 22" case shows only when nvm is missing or 24.18.0 isn't installed. In that case `nvm use` fails under `set -e`, and the script stops without printing Check 1's FAIL line. Test it with `NVM_DIR` pointing at an empty folder, or accept the exit code as the proof.

## Other findings

- **A new Windows packaging step launches the built app.**
  - Because `branding/product.json:177` sets `quality: "stable"`, `shouldGenerateNodeCompileCache` returns true for `win32-x64` (`target:build/lib/nodeCompileCache.ts:27-34`). `vscode-win32-x64-min` then runs `generateNodeCompileCacheTask` (`target:build/gulpfile.vscode.ts:593-595`, `:551-560`).
  - It starts `VSCode-win32-x64/Ritemark.exe` with `VSCODE_GENERATE_NODE_COMPILE_CACHE=1`. It waits for the window, the shared process, the pty host and the agent host (`app.ts:806-814`), stops after 120 s, and validates the cache.
  - At the pin there was no such step. On the Mac it is off: POSIX caches are disabled (`:32-33`).
  - If a Ritemark patch delays window readiness or the agent host, Windows CI fails here. Watch the first Windows run.
- **A workflow step that now does nothing.** "Strip non-Windows binaries from built-in copilot extension" (`build-windows.yml:336-361`) targets `extensions/copilot/node_modules/@anthropic-ai/claude-agent-sdk/vendor`. Copilot no longer depends on that SDK at the target: it is absent from copilot's lockfile, and the root has it only as a dev dependency. The step finds nothing. Patch 008's rules point at similar paths; that is for the rebase (W3).
- **An existing problem in `build-prod-windows.sh`.** It requires Yarn (`:69-75`) and runs `yarn gulp vscode-win32-x64-min` (`:181`). Upstream and our other scripts use `npm run gulp`. This is not caused by the target; it is a small fix whenever that script is touched.

## Not verified here

These need a real install, build or CI run:

- the extension's compile, webview build and tests on Node 24 (W4);
- Windows CI with npm's own node-gyp, copilot's install scripts and the compile-cache step (W6);
- the macOS x64 CI's Xcode, and its native builds without the header override;
- whether the first target build needs an allowlist in the `.node` check;
- the extension host's behaviour at runtime: the MCP adapter under `ELECTRON_RUN_AS_NODE`, and dialogs defaulting to Downloads (W9);
- the EMFILE preload at Windows' file-descriptor limit (S29).
