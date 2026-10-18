# Audit: retiring the Getting Started page (R12)

Done 2026-10-18 on `sprint-133-welcome`, VS Code 1.117.0 at `10c8e557` with patches 001–019. `GS` = `vscode/src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`, `contrib` = `…/gettingStarted.contribution.ts`. The counts before are in [`notes/patches-before.md`](../notes/patches-before.md).

## 1. The hunks, sorted

**001, 16 hunks in the Getting Started files; every one goes.**

| File | Hunks | What they do | Only the page? |
|---|---|---|---|
| `gettingStarted.ts` | 10 | Imports (`FileAccess`, `gettingStartedGuide.css`); drops the toggle, agents banner and footer; `getWelcomeMediaUri`; a generic `runCommand` dispatch; the hero, New document (New table, New flow), Open folder, the three ritemark.app links; recent list at 6; the launch check (`populateHealthCheck`: `ritemark.getHealthStatus`, `ritemark.codexLogin`, `ritemark.claudeLogin`); "Recent files and folders"; the height threshold 600 → 760 | Yes. Hunk 6 also removed upstream's "Show welcome page on startup" toggle, which the page no longer offers anyway |
| `media/gettingStarted.css` | 3 | Padding, the two-column grid, overflow; all under `.gettingStartedContainer` | Yes |
| `media/gettingStartedGuide.css` (created) | 1 | 425 lines, 70 selectors, all under `.gettingStartedContainer`; uses `ritemark-welcome-hero-bg.png`, Sofia Sans and Space Grotesk by name | Yes |
| `gettingStarted.contribution.ts` | 2 | `workbench.startupEditor` default → `welcomePageInEmptyWorkbench`; a trailing blank line | No: the default is global (Settings UI, `remote.contribution.ts:136`). It is replaced, see 3 |

001's other 11 files (fonts, codicons, dialogs, splash, icons, themes, breadcrumbs, the tab title) do not depend on these hunks: no Getting Started class, image or path is used outside the page. The dependency runs the other way (the page used the fonts 001 loads).

**016:** its `gettingStarted.ts` hunk (the Git and Node lines lose "Click here to install") goes; its `extensions/git/package.nls.json` hunk (Source Control's Git download button, Store policy 10.1.5) stays. The `gettingStarted.ts` part had no `diff --git` header, which is why the stacking check filed it under the nls file; with it gone, 016 is one file.

**017:** all three hunks are the launch check's Node line. The patch is retired. Its rule (`nodeRequired`) lives on in the welcome's Git and Node line and in Settings (W8).

No other patch touches the Getting Started page. 003 removes a File-menu entry in `welcomeViews/common/newFile.contribution.ts`; 007 keeps `welcomeOnboarding` loadable (`onboardingVariationA.ts`). Neither changes.

## 2. Every route into the page

| Route | Today | The change |
|---|---|---|
| Start-up runner (`startupPage.ts:136–150`, `:203–223`) | Opens it in an empty window, because of 001's default | `"workbench.startupEditor": "none"` in `branding/product.json`'s `configurationDefaults` (see 3) |
| `workbench.action.openWalkthrough` (`contrib:40–114`): the palette's "Help: Welcome"; also called by `gettingStartedService.ts:459` (a walkthrough on extension install), `helpActions.ts:337` (accessibility getting started), notebook and remote | Opens the page | A Ritemark hunk at the top of its `run()` runs `ritemark.welcome.open` and returns. One change covers every caller |
| `welcome.showAllWalkthroughs` (`contrib:200–260`), in the palette | Opens the page's walkthrough list | The same reroute |
| A Getting Started tab saved in a session (`contrib:116`, the editor serializer; `GS` `canSerialize` → true) | Comes back after a restart, whatever the setting | The serializer is no longer registered; `editorGroupModel.ts:1236–1243` drops saved editors with no serializer, so a 1.x profile's saved page is dropped too |
| A walkthrough opening on extension install (`gettingStartedService.ts:439–461`) | Through `openWalkthrough` | Covered by the reroute; `"workbench.welcomePage.walkthroughs.openOnInstall": false` in `configurationDefaults` as well |
| `tryOpenWalkthroughForFolder` (`startupPage.ts:132`) | Reads `workbench.welcomePage.restorableWalkthroughs`, written only by the page | Nothing: with the page unreachable nothing writes it |
| `walkThrough:` editor resolver (`startupPage.ts:55–77`) | Any `openEditor({ resource: walkThrough://vscode_getting_started_page })`; only `agentSessionsWelcome.ts:678` does, a page Ritemark never opens | Nothing; if it ever opens, it is upstream's page, not a broken one |
| Help menu | Upstream's `1_welcome` group is already dropped by 015's allowlist (`menubarControl.ts:49–89`), on the native, custom and frame menus | Nothing |
| `welcomeOnboarding` (007) | `IOnboardingService` must still register (the runner depends on it); its overlay is off (`experimentalOnboarding`) | Nothing |
| Keybindings | None opens the page | Nothing |
| Ritemark's own code | Nothing opens walkthroughs | Nothing |

## 3. Where `workbench.startupEditor: none` wins

- `branding/product.json` `configurationDefaults` (live on desktop through 013) is registered by `DefaultConfiguration`'s constructor inside `WorkspaceService`'s, before the workbench starts (`configuration.ts:52–57`, `configurationService.ts:129`, `desktop.main.ts:373–376`), and the registry applies an override even to a setting registered later (`configurationRegistry.ts:441–443`, `:708`). Upstream does the same for its Sessions window (`sessions/contrib/configuration/browser/configuration.contribution.ts:25`).
- The extension's `contributes.configurationDefaults` is **not** in time: extensions are scanned at Ready plus idle and their defaults applied in `_doHandleExtensionPoints`, unordered against Restored. On a first start the page would open and stay.
- So: `"workbench.startupEditor": "none"` in `branding/product.json`, and 001's hunk in `contrib` goes back to upstream. The extension then opens its own welcome in a window with no folder.
- A person's own `workbench.startupEditor` still wins over a product default (`isStartupPageEnabled` checks the user value). A 1.x person who set it themselves gets that page as well as Ritemark's welcome; the openWalkthrough reroute does not cover the start-up runner's direct open. This is rare and their own choice; not changed.

## 4. The welcome assets

`apply-patches.sh:303–308` copies `branding/welcome/*` (the 6.7 MB hero PNG, the logo and four SVGs) into the page's `media/`, and `scripts/copy-welcome-assets.sh` copies the same six into the built app. It is called, and its result checked, in `build-prod.sh` (`:277–284`, `:434–441`), `build-prod-windows.sh` (`:189`, `:274`), `build-mac.sh:108`, `build-macos-x64.yml` (`:172`, `:360`), `build-windows.yml` (`:513`, `:688`; and `:340` removes `gettingStartedGuide.css` before patching), `build-windows-local.ps1` (`:163–168`, `:307–310`, `:390–398`) and `test-ci-asset-parity.sh` (`:37–43`, `:114–125`). Only the page used them.

**Decision:** all of it goes with the page: the copy in `apply-patches.sh`, `copy-welcome-assets.sh`, and every call and check above, in the same change. The Windows "inline the welcome logo" steps (`build-prod-windows.sh` Step 8, `build-windows-local.ps1` Step 10) look for a call that has not existed since an earlier release and only warn; they go too. `branding/welcome/` keeps one file, the source illustration, from which the welcome's header (`extensions/ritemark/media/welcome/`) is made; the four SVGs and the full logo are deleted (the welcome uses its own white logo). This is shell-tier harness (`build-prod.sh`, `.github/workflows/build-*`, `apply-patches.sh`), proven by E5's clean-room build and the Windows build from main after the merge.

## 5. The stacking check

Known pairs today: `009>010`, `001>016`, `001>017`, `016>017`, `003>015`. The verbose run hits only `001 → 017` (3 hunks) and `009 → 010`; `001>016` and `016>017` are never hit, because of 016's missing header. After this sprint `001>016`, `001>017` and `016>017` are removed.

## 6. What the extension keeps

`ritemark.newDocument`, `ritemark.newTable`, `ritemark.flows.new`, `ritemark.codexLogin` and `ritemark.claudeLogin` have other callers and stay. `ritemark.getHealthStatus` had only the page; it stays registered (a command is cheap, and Settings' new Git and Node rows read the same data), with its comment updated.
