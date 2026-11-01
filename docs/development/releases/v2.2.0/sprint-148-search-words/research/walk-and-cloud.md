# A4: the walk's rules, and files kept only online (R1)

Run on 1–2 November 2026 on the Mac, on `sprint-148-search-words`. **The Mac half is answered; the Windows half is not run** (it needs the "Ritemark on Windows" session and the overlay). Until it is, the code keeps the spec's fallback: on Windows nothing under a OneDrive folder is read, so PR 1 can merge without it. Cases in `src/search/worker/walk.test.ts`.

## Git's rules, `files.exclude`, links

A fixture tree written to a temp folder by the test:

| Case | Result |
|---|---|
| Dot folders (`.ritemark`, `.claude`, `.github`, `.git`), `node_modules` at any depth | Left out |
| Root `.gitignore`: `build/`, `*.tmp.md`, `!keep.tmp.md` | `build/` and `a.tmp.md` out, `keep.tmp.md` in |
| Nested `team/.gitignore`: `private/`, `Plan.markdown` | Relative to `team/`; the deeper file's rule wins |
| `.git/info/exclude` | Applied, below the root's `.gitignore` |
| A file inside an ignored folder | Out, as in Git: no rule re-includes it |
| `files.exclude` (per folder, only patterns set to `true`; a `when` clause is left to VS Code's tree) | Applied; globs with `**`, `*`, `?`, `{a,b}`, `[…]`; capitals count on the Mac and Linux, not on Windows |
| A symbolic link to a folder | Left out; a link to a file is a file |
| `~$Report.docx` (Office's lock file) | Left out |
| Root `CLAUDE.md` whose whole text is `@AGENTS.md`, with `AGENTS.md` beside it | Left out, as Documents hides it; with the person's own words it stays |
| Root `AGENTS.md` | Named "About this project", as patch 018 names it |
| The watcher's events | Judged by the same rules (`classifyPath`); a changed `.gitignore` or `.git/info/exclude` walks again |

Windows paths: the rules work on root-relative paths with `/`, so they don't depend on the separator; a Windows run belongs to the overlay session.

## Files kept only online: the Mac

iCloud Drive's and the File Provider clouds' (OneDrive, Dropbox, Google Drive) evicted files are "dataless": `stat` gives their size and no blocks on disk. `stat` and `readdir` don't download a file; opening it does. So the walk asks only `stat` and `readdir`, and a file with `size > 0` and `blocks === 0` is found by its name and never opened. The same rule covers the files the walk would otherwise read itself: a dataless `.gitignore` isn't read (its rules are then missing, which can show a file Git ignores but never downloads one), nor is a dataless `CLAUDE.md` checked for the pointer.

What `blocks` says for files made in `/private/tmp` (APFS):

| File | `size` | `blocks` | Search |
|---|---|---|---|
| A plain file | 12 | 8 | Read |
| A sparse file (1 MB, nothing written) | 1,048,576 | 0 | By name; it holds no words |
| A file stored compressed (`ditto --hfsCompression`) | 200,000 | 8 | Read |

**Not run:** a real evicted cloud file. Making one needs a cloud folder with an account (iCloud Drive or a File Provider) and evicting a file in it; that was not done here, to keep away from Jarmo's own folders and sign-ins. The test drives the rule with a file system that reports a dataless file, and shows the walk never opens one. A check on a test account's folder belongs with the Gate 2 rows.

## Files kept only online: Windows

Not run (the overlay session). The code's rule until it is: a folder named by the `OneDrive`, `OneDriveConsumer` or `OneDriveCommercial` environment variables, or any folder named `OneDrive` or `OneDrive - <organisation>`, has nothing under it read: not its documents, not its `.gitignore`, not a pointer `CLAUDE.md`. Its documents are found by name. A project inside OneDrive on Windows therefore searches names only, without its Git rules.

What the overlay should look for: whether one listing of a folder gives each file's attributes (`FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS`, `FILE_ATTRIBUTE_OFFLINE`) without opening it. Node's `fs.stat` doesn't return them, so a proven check is likely a small listing through PowerShell or `fsutil` per walk, run by the host, never a read of the file.
