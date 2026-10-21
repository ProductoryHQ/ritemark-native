# Sprint 136: the update-path audit (R1, E4)

Read on 20 October 2026 from `09b4bc61`, its patched VS Code 1.142.0 tree and the tag `v1.14.0`; nothing was launched. Extension paths are under `extensions/ritemark/src/`, VS Code paths under `vscode/src/vs/` (with the owning patch). "By code" means read, not run.

## 1. What 2.0 changes once on a v1.14.0 profile

### The frame

| Change | Code | Marked done by | Second start | Proved on a v1.14.0 profile |
|---|---|---|---|---|
| Places row in 2.0's order | `workbench/browser/parts/compositeBar.ts:41, 288–293, 884–887` (002) | `ritemark.places.order.v2`, profile storage | Not reordered | Sprint 132 S45, twice (1.117 dev) |
| Views out of the AI column | `workbench/browser/parts/auxiliarybar/auxiliaryBarPart.ts:407–472` (018) | None: a guard at every start; VS Code saves the new location | Nothing to move | Sprint 132 S45; Sprint 135 S23 (Search, 1.142 dev) |
| Terminals as tabs | `workbench/contrib/terminal/browser/ritemarkTerminalTabs.ts:107–131` (019) | None: a guard after every restore | Same guard | **Not proved**: v1.14 kept no terminal across a quit (Sprint 132 S45, "Not exercisable") |

### The theme

The set-up (`extension.ts:295–311`) is marked by `ritemark.designFoundationsThemeMigration` = `sprint-52-design-foundations-v1`. v1.14.0 already wrote that marker (`v1.14.0:extensions/ritemark/src/extension.ts:277`), so it does **not** run on an updated profile; only on a fresh one. #461 (it overwrites `window.autoDetectColorScheme`) is a fresh-profile issue. Theme kept: Sprint 132 S45 ×2, Sprint 135 S23.

### The welcome and usage data

| Change | Code | Marked done by | Second start | Proved |
|---|---|---|---|---|
| Fresh or update, once | `welcome/welcomeHost.ts:112–124`; `welcome/updateDetection.ts:53–59` | `ritemark.welcome.kind`, from `ritemark.activation.lastConfirmedVersion` below 2, `ritemark.analytics.anonymousId` or `.hasSeenNotice` | Stored kind wins | Sprint 133 S33, S37 (1.117 dev); Sprint 135 S23; Windows round 3 S47 (signed 1.117 shell, copy of Jarmo's profile) |
| 1.x usage answer | `welcomeHost.ts:127–140`; `analytics/consent.ts:54–63` | `ritemark.analytics.answeredV2` (`from: '1.x'`); an OK writes `ritemark.analytics.enabled: true` to user settings | Not again | Sprint 133 S52 (OK), S28 (Opt Out); "no answer" only in unit tests |
| Update welcome | `welcomeHost.ts:241–249, 907–916`; `updateDetection.ts:76–79` | `ritemark.welcome.finished`, written only when a project is picked | Start sheet, only with no folder | Sprint 133 S34, S35 |

Not checked: a welcome closed without a pick writes nothing (`welcomeHost.ts:372–385`), so by code it shows again.

### Projects

| Change | Code | Marked done by | Second start | Proved |
|---|---|---|---|---|
| First fill | `projects/projectsHost.ts:71–94, 104–112`; `projects/firstFill.ts:63–111` | `ritemark.projects.filledV1`; `<globalStorage>/projects/v1/list.json` | Only opened folders join | Sprint 134 S5, S54 (1.117 dev, hand-made Ritemark 1 profile) |
| What moved | `projects/homeState.ts:105–108`; `views/HomePanel.ts:27, 249–251, 407` | `ritemark.updatedFrom1x` (`{ at }`, from the welcome's finish), then `ritemark.whatMovedSeen` | Shows on every Home **until Got it** | Sprint 134 S35 (same profile) |

### Extension copies in the user directory

The bundled `2.0.0-0` wins over an older user copy (`platform/extensionManagement/common/extensionsScannerService.ts:375–409`); patch 012 (`workbench/api/browser/mainThreadExtensionService.ts:111–115, 145–187`) quarantines a broken one. 2.0's first clean activation sets `ritemark.activation.lastConfirmedVersion` to `2.0.0-0` and, by code, deletes every `~/.ritemark/extensions/ritemark-*` older than that except the last confirmed one (`extension.ts:1038`, `update/activationIntegrity.ts:89–107`, `update/userExtensionInstaller.ts:248–284`). **Not proved**: every 2.0 step ran with an empty `--extensions-dir`.

### Recent folders (VS Code 1.142, no Ritemark code)

The 1.x list goes into `<shared>/sharedStorage/state.vscdb`, marked by its key and `__$__migratedStorageMarker` (`platform/workspaces/electron-main/workspacesHistoryMainService.ts:289–316`; `platform/storage/electron-main/storageMain.ts:373–389`; `base/parts/storage/common/storage.ts:441–480`). Sprint 135 S23 ran a v1.14.0 profile on 1.142 without recording the shared folder's state.

## 2. More than one 2.0 build on a computer (#475)

- The folder is `--shared-data-dir`, else `$VSCODE_PORTABLE/shared-data`, else `~/.ritemark-shared` (`platform/environment/common/environmentService.ts:151–163`; `branding/product.json:154`).
- **A move, not a copy.** On the first read with no shared key, 1.142 takes `history.recentlyOpenedPathsList` from the user-data folder's `User/globalStorage/state.vscdb` and deletes it there (`setFallbackStorage(…, false)`, `storageMain.ts:387`; `storage.ts:466–473`). By code. R1 says "copies".
- Once any 2.0 build has written the shared key, no profile's own list is read again.

| Part | Its folders come from | Assumes one profile's list? |
|---|---|---|
| Welcome's first-start check | globalState only | No |
| "Open when you left" | The window's restored folder (`welcome/recentProjects.ts:82, 97`; `windowsState`, `platform/windows/electron-main/windowsStateHandler.ts:67, 85`), joined first (`projectsHost.ts:104`) | No |
| The welcome's other rows, the start sheet | The project list (`welcomeHost.ts:946–960`) | Through the first fill |
| First fill | `_workbench.getRecentlyOpened`, the shared list (`projectsHost.ts:60–69`) | **Yes**; its folders stay in `list.json` |
| File ▸ Open Recent | The shared list | Yes |

If another 2.0 build ran first: someone updating gets the right welcome and "Open when you left", but Open Recent and the projects list show that build's folders; their 1.x folders come in only where they have chats, and their 1.x list stays unread. A fresh profile's welcome has no rows (`welcomeHost.ts:947`), then the start sheet, projects list and Open Recent show that build's folders. This hits our Macs and the Windows PC (dress rehearsal, round 5, maybe Jarmo's 2.0 preview: not checked), not people with one install.

## 3. Going back to v1.14.0 (S7), from what 2.0 writes

| Area | v1.14.0 should show (by code) |
|---|---|
| Places | 2.0's order, on the side (v1.14 reorders only when Tasks is new to the bar) |
| Views | Where 2.0 saved them; the terminal's and Copilot Chat's containers in the panel. How 1.14 shows them: not checked |
| Terminals | 2.0's tabs; v1.14's 002 does not save terminal editors. Result: not checked |
| Theme | Kept: 2.0 never rewrites `ritemark.themeAppliedVersion` on an updated profile. On a profile 2.0 made fresh, v1.14 resets it |
| Recent folders | **Empty**: the list was moved. Folders opened in 1.14 then never reach 2.0 |
| Chats | Readable: v1.14.0's decoder ignores `readAt`, `lastReplyAt`, `titleIsFirstMessage` (`v1.14.0:…/conversations/types.ts:622–648`). The index: not checked |
| Usage data | A carried-over `true` is 1.14's default; an Opt Out stays `false` |
| Extension | Bundled `1.14.0-0` loads; no profile data deleted |
| 2.0-only state | Ignored. Back on 2.0: no welcome, refill or reorder |

## 4. What this sprint must test as one chain

No step ran the whole chain on one profile, or on a production 2.0 build. Sprints 132–133 used 1.117 dev builds and a profile without chats; Sprint 134 a hand-made profile; Sprint 135 S23 a 1.142 dev build without chats, boards or a known shared folder. Only Windows round 3's S47 ran a signed shell (1.117).

On the signed candidate, Harbour restored from its archive each run, with an empty `--shared-data-dir`:

1. Before S1, record: the profile's `history.recentlyOpenedPathsList`, `~/.ritemark/extensions` (for S6), and whether v1.14 left a terminal.
2. S1 and S4 as written, plus: the shared database holds Harbour's folders and the profile's no longer does.
3. S1's terminal: if v1.14 left none, record "not exercisable".
4. End S1 with What moved's Got it, or S5 sees it again.
5. S5: also one start after closing the welcome without a pick.
6. S6: the older copy is not loaded; record whether it is deleted.
7. S7: confirm section 3, especially the empty Open Recent, for the known issues.
8. S2: an empty `--shared-data-dir` on Windows too; round 5 runs 1.142 there.
9. S43: before moving `~/.ritemark-shared` aside, check that Jarmo's `User/globalStorage/state.vscdb` still holds his 1.x list. If a 1.142 build moved it, it lives only in the shared folder. Keep the moved folder.
10. S42 as written.
