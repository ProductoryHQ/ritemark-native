# Windows Build EMFILE Root Cause Analysis

**Date:** 2026-04-06
**Run:** `24032653970`
**Job:** `70084678519`
**Workflow:** `Build Windows (x64)`
**Commit:** `e830aa74c8d35648c10ca04ebc17ec55f99748c3`

## Summary

The latest Windows build failed during the VS Code packaging phase, not during dependency installation, patch application, extension compilation, or artifact upload.

The failing step was:

- `Build VS Code (win32-x64-min)` in [`.github/workflows/build-windows.yml`](/Users/jarmotuisk/Projects/ritemark-native/.github/workflows/build-windows.yml#L121)

The failing command was:

```bash
npx gulp vscode-win32-x64-min
```

The concrete error from the GitHub Actions job log was:

```text
HookWebpackError in plugin "webpack-stream"
EMFILE: too many open files, open 'C:\a\ritemark-native\ritemark-native\r\vscode\node_modules\copy-webpack-plugin\node_modules\globby\index.js'
```

This happened during:

- `bundle-non-native-extensions-build`

## What This Means

The Windows runner hit a file-handle limit during VS Code's extension bundling/package phase. This is a packaging-scale problem, not a TypeScript compile failure and not a broken patch.

The repository already contains a targeted mitigation:

- the workflow deletes `extensions/ritemark/webview/node_modules`
- the workflow deletes `extensions/ritemark/webview/src`

That cleanup step explicitly notes it is meant to prevent EMFILE during bundling. The latest failure indicates that the current mitigation is no longer sufficient.

## Evidence

### Failing run

- Run `24032653970` failed on 2026-04-06
- The failure occurred after:
  - VS Code dependencies installed successfully
  - extension dependencies installed successfully
  - patches applied successfully
  - extension compilation completed successfully

### Previous successful comparison point

- Run `23408979802` succeeded on 2026-03-22
- It used the same workflow shape and the same core build command
- The same `Clean webview dev files before build` step existed there too

## Why It Likely Started Failing Now

The most plausible cause is growth in the copied `extensions/ritemark` tree.

Between the previous successful Windows build commit and the current failing commit:

- tracked files under `extensions/ritemark` increased from `274` to `297`
- direct lockfile package entries increased from `133` to `141`
- `posthog-node` and its transitive packages were added
- new source, tests, analytics files, flow UI files, and onboarding-related files were added

Even though some of these files are not needed for the release artifact, they are still present in the copied extension directory during the packaging phase and contribute to file-system pressure on Windows.

## Root Cause

The Windows build now exceeds a practical file-handle threshold during VS Code's webpack-based bundling phase because the copied `extensions/ritemark` directory still contains too many non-essential files for packaging.

## Contributing Factors

1. The workflow copies the full extension source tree into `r/vscode/extensions/ritemark` before build.
2. Only a narrow subset of non-runtime files is removed before `gulp`.
3. Windows runners are more sensitive to large-file-tree packaging workloads.
4. The project has grown enough since the last successful Windows build that the old cleanup no longer keeps the build under the limit.

## Non-Causes

These were investigated and are not the direct cause of this failure:

- `actions/*` Node 20 deprecation warning
- patch application
- TypeScript compilation of the extension
- runner type flip-flop in recent commits

## Secondary Risk

The extension now depends on `posthog-node`, whose lockfile entry declares:

```text
node: ^20.20.0 || >=22.22.0
```

The Windows workflow currently uses Node `22.21.1`, which is below that stated supported range. This did not trigger the observed EMFILE failure, but it is a separate compatibility risk and should be corrected while touching the workflow.

## Recommended Fix Direction

Apply the smallest safe build-footprint reduction in the Windows workflow before `npx gulp vscode-win32-x64-min`:

1. Remove non-runtime extension sources and tests before the packaging step.
2. Keep only files required for runtime validation and copied artifact assembly.
3. Bump workflow Node to a version satisfying `posthog-node` support.

## Candidate Cleanup Targets

Before the `gulp` build, delete:

- `extensions/ritemark/src`
- TypeScript test files if present outside `src`
- docs-like and local-only files such as `.env_local`
- any extension-local dev-only directories that are not needed at runtime

Do not delete:

- `out`
- `media`
- `package.json`
- runtime assets under `themes`, `fileicons`, `binaries` when needed by the extension

## Suggested Validation

After the workflow change:

1. Re-run the Windows workflow on the new branch.
2. Confirm `bundle-non-native-extensions-build` completes.
3. Confirm `Validate build` still finds:
   - `media/webview.js`
   - `out/extension.js`
   - welcome assets
4. If the build still fails with EMFILE, continue by pruning additional non-runtime directories or moving the Windows workflow to a larger/custom-image runner.
