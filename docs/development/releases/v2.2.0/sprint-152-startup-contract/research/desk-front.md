# A3: The desk's front before Ritemark starts (R3)

1–2 November 2026, for Sprint 152's PR 1. Read in the patched tree of `origin/main` (`f84f4513`, VS Code `d956e8a6` with the 19 patches), and seen in one hidden dev instance of the same tree. It answers the two questions [technical-plan.md](../technical-plan.md#phase-1-audits) asks before W6, and chooses between Home's and the Task board's tabs from the first frame and the plain-desk fallback.

## Answer

**The tabs can be there from the first frame.** VS Code already has the path, and it is the one a relaunch takes every day: Home and the Task board come back as restored webview tabs, named and with their icons from the first frame, and their pages fill when Ritemark's serializers register. A project opened for the first time has nothing stored, so the editor part has nothing to restore; PR 2 can give it the two tabs through the same service a restore uses. **R3 keeps the tabs; the plain desk stays the fallback** only for a window where the shell can't place them (below).

## What a restored Home tab is

A project's stored editor state (`memento/workbench.parts.editor` in the workspace's `state.vscdb`, read from a run's profile) holds Home and the board as `workbench.editors.webviewInput`, each with:

- `viewType` `mainThreadWebview-ritemark.home` (and `…ritemark.taskBoard`), `providedId` `ritemark.home`, `title` `Home` (`Task board`);
- `options`: `retainContextWhenHidden`, `allowScripts`, `forwardUntrustedKeypressEvents`, and `localResourceRoots` (the extension's `media`, and for Home the project's `.ritemark`);
- `extensionId` `ritemark.ritemark` and `extensionLocation`, the extension's folder;
- `iconPath`: the light and dark tab icons in the extension's `media` (`home/home-tab-*.svg`, `tasks-tab-*.svg`);
- `origin`, a per-panel id, and the board's `state` (`{"tab":"board"}`).

`WebviewEditorInputSerializer.deserialize` (`webviewEditorInputSerializer.ts`) turns each into `IWebviewWorkbenchService.openRevivedWebview(...)`, a `LazilyResolvedWebviewEditorInput` (`webviewWorkbenchService.ts`). That input has its name and icon at once, so the tab row draws them at the first frame, and its page waits:

1. When the tab is shown, `resolve()` asks `resolveWebview`, which tries each registered resolver and otherwise parks the input in the revival pool.
2. The main thread's catch-all resolver (`mainThreadWebviewPanels.ts`, "This reviver's only job is to activate extensions") calls `activateByEvent('onWebviewPanel:ritemark.home')`. A2 saw exactly this on Windows: a warm start activates Ritemark by `onWebviewPanel:ritemark.home`.
3. Ritemark registers its serializer at activation (`projectsHost.ts:205`, `taskBoardHost.ts:304`); `registerResolver` revives the parked input; `updateExtensionLocation` moves `extension` and the resource roots to wherever the running extension is (an extension-tier update lives in the user's folder); then `$deserializeWebviewPanel` hands the panel to the extension, which draws it.

A background tab isn't revived until it is shown (`permanentTabs.ts` relies on this for a board that is turned off). So at a start only Home, in front, is revived; the board waits for its first click.

## Can the shell place them in a new project's grid?

Yes, with these conditions, all of which PR 2 can meet inside 019 (the tab row) and 002's reader:

- **Where they come from.** The editor part restores an empty grid for a project with nothing stored (`editorPart.ts`, no `editorpart.state`). In that case, and only in a project window, the shell opens the two inputs through `openRevivedWebview` into the first group, pinned (patch 019 already keeps a pinned Home or board tab first and permanent, `RITEMARK_PERMANENT_VIEW_TYPES` in `editorGroupView.ts`), Home active. Using `IEditorService` to open them keeps VS Code's opening rules.
- **What the shell knows at the first frame.** The view types, titles and order are the manifest's (R1). The extension's location is not known before the extensions are read, but the built-in copy's is (`environmentService.builtinExtensionsPath`, `ritemark/`): the shell gives that, and `updateExtensionLocation` corrects it on revival when an extension-tier update runs another copy. The icons stay the built-in copy's files, which are always in the app.
- **Options.** The shell gives the same three options and the extension's `media` root. The project's `.ritemark` root comes from the extension when it deserializes (its serializer sets the panel's options again).
- **The `task-board` flag.** It is a user setting (`ritemark.features.task-board`), readable at the first frame through `IConfigurationService`; with it off the shell places Home alone, as R3 requires. With no setting the flag is on.
- **The extension's own check.** `ensurePermanentTabs` (`permanentTabs.ts`) finds Home first and pinned and the board pinned, so `planPermanentTabs` returns nothing and it changes nothing. It then moves a window "that had no tab of its own" to Home's place (`:135`); with the tabs placed by the shell, `before` is Home's tab, so that branch no longer runs and R3's left column has to come from 002 (Home's place for a project with no stored place), as the plan already says.

## A restored webview whose serializer never registers

Read, and seen. The input stays in the revival pool: there is no timeout, and `shouldPersist` keeps a `LazilyResolvedWebviewEditorInput` across restarts ("a reviver should exist when it is actually needed"). So the tab keeps its name and icon, its page stays empty, and it comes back at every start. If the extension's deserializer throws, the page says "An error occurred while loading view: …" (`getWebviewResolvedFailedContent`).

Seen in the dev instance with Ritemark turned off: see *The run* below.

That is the risk the plan names: an older extension without a serializer, or a start that fails, leaves a dead tab. PR 2's slot release covers it: a placed tab whose resolver hasn't registered when Ritemark failed to start, or after 60 s, is closed (logged once as a released slot). A2's slowest start had Ritemark active at 17.2 s, and a start after an install about 26 s (#401), so 60 s doesn't release a slow start.

## When the plain desk is the fallback

- A window where the manifest has no permanent tabs (no block: the reader returns no slots).
- A shell that can't find the built-in extension folder.

In both, the desk is a plain sheet with no tiles until the extension opens Home, one known move, as the Experience lead accepted (answer 2).

## The run

One hidden dev instance of this tree (scratch profile and AI homes, `--use-mock-keychain`), on a project whose Home and Task board tabs a run before had stored, launched again with Ritemark turned off (`--disable-extension=ritemark.ritemark`), so no serializer ever registers. 12 s after the launch ([qa/a3-no-serializer.png](../qa/a3-no-serializer.png)):

- the tab row is `Home, pinned`, `Task board, pinned`, Home in front, named and with their icons;
- Home's page is empty, and VS Code's progress line runs under its tab with nothing to end it;
- the rest is VS Code's own frame, since Ritemark's settings never came (the places on the side, VS Code's tab sizes).

So a tab the shell places at the first frame, with no extension to fill it, is exactly what a restored one already is today: named, empty, and lasting. The release PR 2 adds is what makes it safe to place one.
