# The first fill: the audit (W2, R2)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` (`145d86e7`). Line numbers are this branch's; `vscode/` paths are VS Code 1.117.0 (pin `10c8e557`) with the 18 patches applied.

The counts come from the installed v1.14.0's real profile on this Mac, read only: its SQLite and JSON files were copied to `/tmp` first. No path, name or title from it is written here. Example paths are made up.

## The result in one table

| Source | Gives a folder by | Here | Use it |
|---|---|---|---|
| VS Code's recent folders | `_workbench.getRecentlyOpened`, `workspaces[].folderUri` | 47 folders, 27 still there | Yes, first: its spelling is VS Code's |
| The chat store | A record's `scope.folderUris`; `index.json` has no folders | 13 folders, 11 still there, all 13 also recent | Yes, read raw: one record per project |
| Task boards | Not at all: this computer's records are under a hash of the folder | 1 board, also recent and in the chats | Found through the other two only |
| VS Code's `workspaceStorage` | `workspace.json`'s `folder` | The same 47 folders as the recent list | Not as a source. Yes for "last open" |

Expected list on this profile: 27 projects. The fill takes 20–46 ms here.

## 1. VS Code's recent folders

**How it gives a folder.** The command returns `IWorkspacesService.getRecentlyOpened()` (`vscode/src/vs/workbench/browser/actions/workspaceCommands.ts:317–321`). In a desktop window that service is a proxy to the main process (`workbench/services/workspaces/electron-browser/workspacesService.ts:12–23`), which reads the stored list (`platform/workspaces/electron-main/workspacesHistoryMainService.ts:197–264`). The extension host revives the URIs (`workbench/api/common/extHostCommands.ts:216`), so `folderUri` arrives as a `vscode.Uri`.

**Shape** (`platform/workspaces/common/workspaces.ts:48–71`):

```ts
{
  workspaces: Array<
    | { folderUri: Uri; label?: string; remoteAuthority?: string }
    | { workspace: { id: string; configPath: Uri }; label?: string; remoteAuthority?: string }
  >;
  files: Array<{ fileUri: Uri; label?: string; remoteAuthority?: string }>;
}
```

- Newest first. A folder joins when a window opens it (`platform/windows/electron-main/windowsMainService.ts:469–486`), unless the open asked for no entry (extension development, a diff, a transient workspace).
- It keeps up to 500 folders and workspaces, and 500 files (`workspacesHistoryMainService.ts:46, 122–128`). It lives in application storage under `history.recentlyOpenedPathsList` (`:48`), in `<user-data>/User/globalStorage/state.vscdb`.
- A label is stored only when it differs from the path (`workspaces.ts:373–378`). It is no use for names.
- The folder open in the calling window is in the list. The Open Recent picker hides it; the command does not.
- The person can remove an entry (Open Recent's ×) or clear the list (File ▸ Open Recent ▸ Clear Recently Opened). Both stay reachable in Ritemark: the head's Switch project… runs `workbench.action.openRecent` (`extensions/ritemark/src/views/projectHeadCommands.ts:27`).
- Today's callers read `workspaces[].folderUri` with scheme `file` only (`src/welcome/welcomeHost.ts:870–892`; `src/views/HomeViewProvider.ts:163–181`).

**Traps.**
- `.code-workspace` entries are `{ workspace: { id, configPath } }`, with no `folderUri`. Untitled workspaces are never added (`workspacesHistoryMainService.ts:88`).
- Remote and virtual folders: `remoteAuthority` is set, or the scheme is not `file` (`vscode-remote:`, `vscode-vfs:`). They need Marketplace extensions Ritemark hides, so they are rare. A profile carried over from elsewhere could still hold some.
- Windows: `Uri.toString()` lower-cases the drive letter and encodes its colon, `file:///c%3A/Users/Ana/Book`. `fsPath` gives `c:\Users\Ana\Book` (`base/common/uri.ts:700`). The rest of the path keeps the disk's case. A network share comes as `file://server/share/Book`, with the server as the authority.
- VS Code compares recent folders ignoring path case on the Mac and on Windows (`extUriBiasedIgnorePathCase`, `base/common/resources.ts:340–344`). So the list never holds two case spellings of one folder.
- It is an internal command. W2 already adds its check to `update-vscode.sh`'s checklist.

**Here.** 83 entries: 47 folders, 0 workspaces, 36 files. All 47 folders are `file:`. None is remote and none ends in a slash. 12 are percent-encoded (spaces or letters outside ASCII). The 4 labels are all on files. 27 of the 47 folders still exist (26 in the home folder, 1 outside it). 20 are gone, 2 of them from the temp folder. 1 of the 27 holds `.ritemark/tasks`.

## 2. The chat store

**Where the folder is.** One store for every project, `<globalStorage>/conversations/v1/` (`src/conversations/ConversationStore.ts:171–173`), with `index.json`, `records/<conversationId>.json`, `tombstones/` and `quarantine/` (`:199–202`).
- The folder is only in the record: `scope: { kind, workspaceFileUri, folderUris }` (`src/conversations/types.ts:35–39, 151–167`).
- An `index.json` entry is a summary without it: `conversationId`, `scopeId`, `title`, `lastActivityAt`, `lifecycle` and the rest (`types.ts:178–197`, built by `summarizeConversationRecord`, `:706–721`).
- The scope id is `ps1-` plus a SHA-256 of the scope (`src/conversations/projectScope.ts:43–45`). It can't be turned back into a folder.

**So `index.json` alone gives each project's scope id and its newest chat time, not its folder.** The fill reads `index.json` and keeps the first entry of each `scopeId`: the index is sorted newest first (`ConversationStore.ts:113–115`). It skips `integrity: 'corrupt'`. Then it reads that one record for its `scope`. A record deleted in the meantime is missing; the fill then reads the scope's next entry.

Scope kinds: `single-root` gives `folderUris[0]`. `multi-root` and `workspace-file` are skipped, as `.code-workspace` entries are. `no-folder` and `unassigned-legacy` have no folder.

**Reading it raw is safe while another window writes.** The index and the records are written to a temporary file, then renamed over the old one (`atomicWrite`, `ConversationStore.ts:709–713`). A reader sees a whole old file or a whole new one, never half. Two details:
- Skip names with `.tmp-`, as the store does (`:620–621`).
- A broken `index.json` is moved to `quarantine/` (`:653`, `:715–731`), so for a moment there is none. When it is missing or doesn't parse, the fill scans `records/` itself.

**Never through the store.** Confirmed: `list()` with no scope rewrites the index. So do `list(scopeId)` and `get()`. Every public method runs `reconcile()` (`:205–233`), which reads every record, writes `index.json` again (`:611–647`) and moves a record it can't decode into `quarantine/`. The waiting audit reads the index raw for the same reason.

**Trap: the folder URI is not VS Code's spelling.** The scope is built from `folder.uri.toString()` (`src/views/UnifiedViewProvider.ts:341–345`), then normalised through WHATWG `URL` (`projectScope.ts:18–33`): no trailing slash, the host in lower case, and on Windows the whole path in lower case (`:25`). On Windows `file:///c%3A/Users/Ana/Book` is stored as `file:///c%3a/users/ana/book`. On the Mac the path keeps its case.

**Here.** 132 records (3.5 MB in all; the median 14 KB, the largest 158 KB). `index.json` is 76 KB. 13 tombstones, and nothing in quarantine. The index and the records agree: none is missing either way.
- 14 scopes: 93 records in 13 single folders, and 39 unassigned legacy records.
- 11 of the 13 folders exist. 1 holds `.ritemark/tasks`.
- All 13 are in the recent list, with exactly the same URI string.

So on this Mac the chats add no folder. On a profile whose recent list was cleared, they would.

## 3. Task boards

- Cards are `<folder>/.ritemark/tasks/*.md`.
- This computer's hand-off records are `<globalStorage>/task-board/v1/<projectKey>/<cardId>.json`, with `projectKey = sha256(fsPath).slice(0, 16)` (`src/taskBoard/CardTaskStore.ts:54–60`). `fsPath` is the window's `folder.uri.fsPath` (`src/taskBoard/taskBoardHost.ts:110, 128–129`).
- A record holds the card id, its state and times, the runtime and the card's `conversationId`. It never holds a folder (`CardTaskStore.ts:22–46`). The directory's name can't be turned back into a folder.

**Confirmed: a board can only be found through a known folder.** There is one link back: a record's `conversationId`, then that chat's record, then its `scope.folderUris`. But that folder is already in the chat source. A board is lost to the fill only when all its cards' chats were deleted and no other source knows its folder. A board whose cards were never given to an agent has no record here at all.

So the "board" source adds no folder. The fill doesn't need to look at boards; W3 reads a project's board when it counts.

**Here.** 1 hand-off directory with 1 record. Its key matches one recent folder, and its chat names the same folder. 25 of the 27 existing recent folders have a `.ritemark/` folder, but only 1 has `.ritemark/tasks`. A `.ritemark/` folder alone is no sign of a board: Flows' storage makes one in every folder opened (R13).

## 4. VS Code's own record of opened folders

**What it is.** `<user-data>/User/workspaceStorage/<id>/` (`platform/environment/common/environmentService.ts:86`), one directory per folder or workspace.
- The main process writes `workspace.json` once, when it makes the directory: `{"folder": "<uri>"}` or `{"workspace": "<configPath>"}` (`platform/storage/electron-main/storageMain.ts:407–427`). The write isn't awaited (`:401`), so a new directory can lack it for a moment.
- An empty window gets no `workspace.json`.
- The id is an MD5 of `fsPath` and the folder's creation time (its birth time on the Mac and on Windows; `platform/workspaces/node/workspaces.ts:47–80`). A folder deleted and made again gets a second directory.
- Folders' directories are never cleaned. The shared process deletes only empty windows' directories, whose ids aren't 32 characters long (`code/electron-utility/sharedProcess/contrib/storageDataCleaner.ts:36, 47–49`). So it remembers every folder this profile ever opened, including those the person removed from Open Recent.

**Can the extension find it?** Yes: `path.join(context.globalStorageUri.fsPath, '..', '..', 'workspaceStorage')`.
- The extension host's global storage is always the default profile's `User/globalStorage` (`workbench/services/extensions/electron-browser/localProcessExtensionHost.ts:525–526`). That holds with VS Code profiles, `--user-data-dir` and portable mode alike.
- It works in an empty window. `context.storageUri` doesn't: it is `undefined` with no folder (`workbench/api/common/extHostStoragePaths.ts:48–51`), and the welcome has no folder.
- Sprint 133 already reads it this way (`src/welcome/welcomeHost.ts:909–935`, `lastOpenTimes`).

**Only this app's profile?** Yes. It lives in Ritemark's own user-data directory (`~/Library/Application Support/Ritemark`, `%APPDATA%\Ritemark`). VS Code's is a different directory, and so is a dev instance started with its own `--user-data-dir`.

**Here.**
- 50 directories, each with `workspace.json` and `state.vscdb`: 50 folders, 0 workspaces, 0 empty windows.
- 47 distinct folders: 3 folders have two directories each, from being made again.
- They are exactly the recent list's 47, string for string.
- 27 still exist; 1 holds `.ritemark/tasks`, the same one.
- The whole tree is 1.1 GB, but the fill reads only the small `workspace.json` files and the time of each `state.vscdb`.

**Recommendation: no, not as a fourth source.** On this profile it adds nothing. It adds a folder only when the person removed it from Open Recent, cleared the list, or passed 500 folders. The first two are the person's choice, and bringing those folders back goes against it. A board in such a folder joins the list when it is next opened, as the plan's fallback says.

**But use it for "last open".** `state.vscdb` is written while a window has the folder open, so its time is the only real "last open" time on the computer. Here it agrees with the recent list's order on 1,075 of 1,081 pairs (99.4 %). The few differences are at the top, among windows that were open at the same time. Sprint 133's `lastOpenTimes` already reads exactly this, taking the newest of a folder's directories. It can move to `src/projects/`.

## 5. Merging

**One key per folder.** The folder's `fsPath`, with trailing separators trimmed, case folded on the Mac and on Windows (as VS Code compares recent folders), and in NFC on the Mac (two apps can write the same name in two Unicode forms). Never the URI string: the chat store's is normalised differently (§2).

**Keep the recent list's spelling,** the URI as `Uri.toString()` gave it. Two reasons:
- On Windows the chat store's path is all lower case, so the project's name would show in lower case.
- What a window finds depends on the exact spelling. This computer's hand-off records are keyed by `sha256(fsPath)` (`CardTaskStore.ts:54`), and W3 reads them that way (`src/projects/waiting.ts:178, 209–212`). VS Code's workspace storage, which keeps the project's tabs, is keyed by an MD5 of `fsPath` (§4). Opening `c:\users\ana\book` instead of `c:\Users\Ana\Book` finds neither: the board's calls known only to hand-off records disappear, and the tabs don't come back (R9).

For a folder known only from chats on Windows, take the disk's spelling with `fs.realpathSync.native`, then `vscode.Uri.file()`, before storing it. On the Mac the chat's spelling is already VS Code's.

**Skip:**
- `workspace` entries (`.code-workspace`), and chat scopes other than `single-root`;
- remote and virtual folders: a `remoteAuthority`, or a scheme other than `file`. Keep `file://server/share/…`, a network path;
- recent files: a file's folder is not a project the person opened;
- folders not there at the fill: a `stat` that fails, or finds no directory. Give each `stat` a timeout (2 s), since a share that is gone can hang; a timeout counts as not there;
- folders inside the extension's own folder (`context.extensionUri`). The shipped sample (`sample-project/`, `src/welcome/sampleProject.ts:12–14`) is never a project. The person's copy of it, in `<Documents>/Ritemark/`, is kept: they opened it. On a 1.x profile the fill runs before the welcome can make a copy.

**Order ("last open").**
1. The newest `state.vscdb` time among the folder's `workspaceStorage` directories.
2. Otherwise, for a folder known only from chats, its newest chat's `lastActivityAt`. That is when the person last chatted there, the nearest thing to a time it was open.
3. Ties and gaps by the recent list's position.

The open project then goes first through `opened()`, which sets its time to now. When an entry is already in the list, the fill keeps the later of the two times.

**How it was found:** `recent`, `chats`, or both. `board` can never be the only source, so it needn't be a value.

## 6. Cost

Measured on the real profile with a read-only Node 22 script, outside the app:

| Step | Here |
|---|---|
| `workspaceStorage`: 50 `workspace.json` reads and 50 stats | 3–4 ms |
| Chats: `index.json` and 14 records | 1–2 ms |
| Chats, if `records/` must be scanned: 132 records | 15–38 ms |
| Stats: 47 folders, and `.ritemark/tasks` in the 27 there | 1–2 ms |
| Total | 20–46 ms (the first run is the slower) |

The recent list is one call to the main process. At the 500-folder limit the stats grow to a few hundred, run in parallel: still well under a second. A share that is gone is bounded by the timeout. The fill runs once.

## Recommendation for W2's `firstFill.ts`

- **Sources:**
  1. VS Code's recent folders, first, for the spelling.
  2. The chat store, read raw: `index.json`, then one record per scope; `records/` when the index can't be read.
  - No board source to read.
  - `workspaceStorage` for the times only.
- **Skips and order:** as §5.
- **Once:** `ritemark.projects.filledV1` is written after the list is. Two windows starting together on a 1.x profile can both run the fill. Make it a merge (the union, the later time), so running twice gives the same list.
- **The same race hits `opened()`.** Several windows restoring at once each write the list, and `ProjectList`'s serialized writer only orders writes within one window. Read, merge and write in one step just before the rename. Record a removal, so a window holding an older copy can't bring the project back.
- **The welcome's update sheet reads the list** (W2), so it waits for the fill: tens of milliseconds.
- **Here** the list would hold 27 projects.

## What changes in spec R2

- "Every project that has a task board record" can't be met as written: a board's records name no folder. Proposed: "…and every task board in those folders. A board in a folder neither of them knows joins the list when it is next opened."
- Say that the fill adds only folders that are there at the time. R2's "never dropped silently" is about projects already in the list. Here 20 of the 47 recent folders and 2 of the 13 chat folders are gone; adding them would open 2.0 with 20 Not found rows.
- "VS Code's recent folders" means single folders, on this computer or on a network share. Workspace files and remote folders are left out. The plan says so; the spec doesn't yet.
