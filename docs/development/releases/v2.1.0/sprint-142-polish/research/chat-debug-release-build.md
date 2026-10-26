# A1: Does "Chat Debug" show in More on a release build? (R6; #557, item 1)

Run while writing the plan, 26 October 2026, on `main` at `84ea15db` and the installed 2.0.1. Read-only: nothing was built or changed.

## The question

The smoke test of main (a dev build) found "Chat Debug" in More, with no icon and out of line with the other entries (#557, item 1). The brief: find out whether it shows on a release build, and hide it there if so.

## What draws it

- **The built-in Copilot Chat** (`vscode/extensions/copilot`, the package `copilot-chat`) contributes an activity-bar view container `copilot-chat`, titled "Chat Debug", with one view whose `when` is `github.copilot.chat.showLogView` (`vscode/extensions/copilot/package.json`, `contributes.views` and `contributes.viewsContainers`). More lists it because its view becomes visible and it doesn't fit the places row. Patch 018's `RITEMARK_PLACE_WORDS` has no entry for it, so it shows VS Code's name. Its icon is an SVG file, not a codicon, which may be why the smoke test saw none.
- **The context key is set** in `src/extension/contextKeys/vscode-node/contextKeys.contribution.ts`, `_updateShowLogViewContext()`:
  - `showLogView = copilotToken.isInternal || !envService.isProduction()`;
  - `isProduction()` is `packageJson.buildType !== 'dev'` (`src/platform/env/common/packagejson.ts:47`);
  - the source tree's `package.json` says `"buildType": "dev"`.

  So in a dev build, where Copilot Chat runs from source, the key is always set and Chat Debug always shows.
- **The command `github.copilot.debug.showChatLogView`** also sets it, in any build.

## What a release build ships

- **The built-in Copilot Chat is removed at packaging,** on every platform:
  - `scripts/build-prod.sh`, step 4.5: `for unwanted_ext in copilot mermaid-markdown-features theme-modern-icons` deletes `Contents/Resources/app/extensions/copilot`;
  - `.github/workflows/build-macos-x64.yml` and `build-windows.yml` ("Strip bundled copilot extension from output") do the same.
- **The installed 2.0.1** (`/Applications/Ritemark.app`, `ritemarkVersion` 2.0.1) has no `extensions/copilot` folder. Its built-in extensions are the language, theme and Git ones, and `ritemark`.

With no built-in Copilot Chat, nothing contributes the `copilot-chat` container, so **Chat Debug cannot show in More on a release build.**

## The one way it could still appear

Someone who installs GitHub Copilot Chat from the Marketplace (patch 007's Copilot Chat launcher supports that) gets a published build, where `buildType` is not `dev`. Chat Debug then shows only:
- for a GitHub-internal Copilot account (`copilotToken.isInternal`); or
- after running Copilot's own debug command "Show Chat Log View".

Both are Copilot's own developer paths, not something a Ritemark user meets by accident.

## A stale guard, noted

`build-prod.sh` (and the Windows workflow) also append a CSS rule that hides `.activitybar .action-item a[class*="copilot-chat"]`. It was written for 1.x's activity bar. 2.0's More is Ritemark's own menu (`ritemark-more-menu`, patch 018), which that selector doesn't reach. With the extension removed the rule has nothing to hide, so it is harmless. Changing it would be a shell-tier script edit for no visible gain, so this sprint leaves it.

## Decision

- **No code.** Chat Debug is a dev-build artefact. A release build doesn't show it.
- **One check on 2.1's release candidate** (Gate 1): More lists no Chat Debug, and the app has no `extensions/copilot` folder. The same row goes into the release plan's Gate 2 list, so Jarmo sees it on Windows too.
- #557's item 1 closes with this note and the candidate's screenshot.
- **Not taken:**
  - a guard in `validate-build-output.sh` that fails a build with `extensions/copilot` in it. It is shell-tier harness work, and the strip step already logs each removal;
  - hiding the container in dev builds. The dev build is ours, and the entry helps when Copilot Chat is being debugged.
