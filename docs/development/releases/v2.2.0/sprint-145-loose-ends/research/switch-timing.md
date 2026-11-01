# A3: Who shows the AI column after a project switch (R9, S42–S44, #569)

31 October 2026: not run in the first pass (the profile had no second project). 1 November: measured in PR 2 ([pr2-ext-checks.md](pr2-ext-checks.md), R9), which put the cause in the shell; fixed and measured again in PR 5. Patches 002 and 018; no tier moves.

## What PR 2 measured

`project-check.mjs --switch-to <folder> --measure 10`, twice, on a hidden dev instance of `main`: a document in front first in 9 of 10 switches (956–1394 ms in the dev build), the AI column up to 747 ms after Home. The workbench's own marks showed that it never restores the AI column (`code/willRestoreAuxiliaryBar` absent in every switch), that the column appears within 50 ms of the end of Ritemark's activation (its `ritemark.unifiedView.focus`), and that the document in front comes from the workbench's editor restore, 380–500 ms before Ritemark starts. Both failures start before the extension exists.

## Why the workbench doesn't restore the AI column

Read in PR 5's patched tree and the test profile's workspace storage after the switches. Both projects had `workbench.auxiliaryBar.hidden = false` (the column was open when each was left) and **no** `workbench.auxiliarybar.activepanelid`:

- Patch 002 makes Ritemark AI the AI column's default container (`paneCompositePart.ts`: the part's `defaultCompositeId` is `workbench.view.extension.ritemark-ai`, and its constructor removes the stored key). VS Code's `CompositePart.showComposite` stores the open container's id only when it is not the default, so with Ritemark AI open the key is never stored.
- At the next start, `layout.ts`'s `initLayoutState` asks for that key with `getDefaultViewContainer(AuxiliaryBar)` as the fallback. Ritemark AI is an extension's container, registered only once the extensions are read, so at this moment there is none: the layout finds nothing to restore and sets the column hidden.
- The extension opens it again at activation, about half a second after the restore put the document (or Home) in front at full width. Home is then laid out twice.

A project opened for the first time hit the same in another way: VS Code's "the column was empty before" rule (`auxiliaryBar.empty`, profile storage) hides a new workspace's column, and in this profile it was `true` only because a part had opened at start before Ritemark AI's container existed.

## The fix (PR 5)

- **The AI column comes back with the layout** (patch 002, `layout.ts`): in a project window, when nothing is stored and no default is registered yet, the layout restores `workbench.view.extension.ritemark-ai`; `openViewContainer` waits for the extension's container to be registered, as it does for the left column's Home place. The "was empty" rule no longer applies to a project window. A window with no folder (the welcome's) keeps upstream's rules.
- **A switch lands on Home in the workbench** (patch 018): when the switch guard lets a `LOAD` go on, it leaves a note in application storage (the folder left, the folder opened when the window knew it, the time). The new window's main editor part takes it once, before it makes the grid, and puts Home's tab first in its desk's order of use (`mru`), so Home is the tab in front from the first frame and the document stays behind it. The rule is the extension's own (`ProjectSwitcher.takeLanding`): within two minutes, in the folder the switch opened, or in any other folder when the window didn't know it. The extension's landing stays as it is and now finds Home already in front.
- **No "Drag a view here to display."** (patch 018, `ritemarkSurfaces.css`): while a column waits for its place or the AI, it shows the ground. VS Code's empty-part message flashed for about half a second in the left column at every start on `main`, and with the AI column restored early it would have flashed there too.
- **After review round 1:** the note is written only with the storage's last save of a switch that really goes on (`onWillSaveState`, `SHUTDOWN`), so a switch another participant vetoes (unsaved files, a running terminal) leaves none; it is taken by the next main window as it makes its desks, restoring them or not; Home's desk becomes the desk in front too; the project's folder is the extension's (`workspaceFolders[0]`), so a multi-root window lands as the extension does. In `layout.ts`, a column that has nothing to show once the extensions are read (Ritemark AI never registered) closes again, and upstream's rule that gives an empty desk's keyboard to the AI column applies only to a window with no folder. **After review round 2:** the note's time is taken when it is written, not when Ritemark answered (another question, such as unsaved files, can wait longer); a late answer to a switch that another participant already vetoed sets no note (each shutdown attempt has its number); only the main editor part takes the note, never a modal or floating one; and the empty column closes only in a project window. Measured again in a fresh launch after round 1: 6 of 6 switches PASS (Home first at once, the AI column in the same sample), Reload Window keeps the document in front, and no note is left after the switches; after round 2, 4 of 4 PASS.

## Measured, before and after (S42–S44)

The same hidden dev instance of PR 5's tree, two scratch projects (`alpha-notes` with `Plan.md`, `beta-notes` with `Brief.md`) seeded in the instance's own shared recents, first with `main`'s compiled files for the changed modules, then with PR 5's after Reload Window. `project-check.mjs --port <port> --user-data-dir <profile> --switch-to alpha-notes --measure 10`. Times in ms from the new page's start (a dev build is slower than a release).

| | main | PR 5 |
|---|---|---|
| Switch 1 (into a project left on Home) | Home 2387, AI column 2941 (+554) | Home 2294, AI column 2294 (0) |
| Switches 2–10 (left with a document) | the document first, 971–1244 ms; Home 3366–3683; the AI column 386–690 ms before Home | Home first at 2283–2517; the AI column in the same sample (0) |
| `willRestoreAuxiliaryBar` | absent | present in all 10 (2260–2497) |
| Result | FAIL both rules (worst +554 ms; a document first in 9 of 10) | PASS both rules, 10 of 10 |

S44 (the first switch of a launch, into a project left on Home) passes too: it was the outlier because the AI column waited for the extension, not because of the launch.

Also checked in the same instance: Reload Window keeps the tab that was in front (a document) after a switch, so a later start is not landed on Home; the note is gone from application storage after the switch that used it; a switch back restores the project's tabs in their order (`project-check.mjs`'s own checks, PASS); Home's page draws at the same time as before (3.6–4.9 s after the page starts in both builds, varying run to run).

A project opened for the first time, while the extension host was held (the S47 run in [first-start-terminal.md](first-start-terminal.md)): on `main`'s layout the AI column stayed hidden until the extension started; with PR 5's it was there from the layout.

**First frames** (`qa/r9-switch-first-frames-light.png`, `qa/r9-switch-first-frames-dark.png`): on `main` the document is in front at full width, the AI column then arrives and the desk narrows, and Home comes forward; with PR 5 Home's tab is in front at the desk's final width from the first frame, both columns on the ground while they load, then filled. Nothing else in the frame changes: `frame-screenshots.mjs` with `main`'s build and PR 5's in the same instance gave the same pixels in every scene apart from the dev build's own notices (built-in extensions without `out/` failing to start), the browser page that one of them paused, the Browser place's recent pages and the settings foot's last update check; the joins pass was ok in all 34 scenes, light and dark, for both.

**What a slow start now shows:** while the AI waits, the AI column shows VS Code's thin loading bar at the top of its strip (2 px, indigo), where before the column itself was missing. It shows only when the AI takes long (it was there in the S47 run with the extension held, not in a normal switch).

Windows is proved at Gate 2 on 2.2's candidate: Windows CI builds only `main`.
