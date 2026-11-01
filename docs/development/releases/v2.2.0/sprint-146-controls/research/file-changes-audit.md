# A6: File changes with no Git, and the outline on a mouse open (R7, #567)

1–2 November 2026, on the Mac, for PR 4 (`sprint-146-controls-shell`, from `origin/main` at `8aa08f99`). Run on hidden dev instances of a patched VS Code 1.142 tree (the method is in [pr4-shell-checks.md](pr4-shell-checks.md)): `main`'s 19 patches first, then PR 4's. Real CDP input only (`Input.dispatchMouseEvent`, `Input.dispatchKeyEvent`). The project is the frame baseline's sample, which has no Git.

## The words

Every Git welcome string File changes shows lives in VS Code's Git extension (`extensions/git/package.nls.json`, `view.workbench.scm.*`), chosen by each `viewsWelcome` entry's `when` in `extensions/git/package.json`. GitHub's extension adds two paragraphs in the same panel (`extensions/github/package.json`, `welcome.publishFolder` and `welcome.publishWorkspaceFolder`). Patch 016 already owned the three `scm.missing.*` lines (Sprint 126's Store rule), so the lead's words go there; a second patch on those lines would stack (pre-commit Check 14).

| State (`view.workbench.scm.*`) | Shows when | On `main` | PR 4 (the Experience lead's words, section 5) |
| --- | --- | --- | --- |
| `missing.mac`, `.windows`, `.linux`, `missing` | Git not found | "Source control depends on Git being installed. After installing Git, please reload (or troubleshoot)." (016); `missing` (remote windows) linked to aka.ms | "File changes needs Git." / "Git isn't on this computer. Once it is, File changes works in every project." No button, no link |
| `disabled` | `git.enabled` off | "If you would like to use Git features…" and a docs link | "Git is turned off." / "File changes needs Git, and Git is turned off in Ritemark's settings." / Open the setting |
| `empty` | no folder open | Open Folder, Clone Repository, docs link | "No project is open." / "Open a project to see what changed in its files." / Open a project… |
| `folder` | a folder with no Git | "The folder currently open doesn't have a Git repository…", Initialize Repository, docs link | "Git isn't set up in this project." / "File changes shows what changed in each file since your last commit. Set up Git to use it. Its record stays inside this folder." / Set up Git here (`git.init?[true]`, as before) |
| `workspace` | a workspace, no folder with Git | The same in workspace words | The same as `folder`; Set up Git here (`git.init`, which asks which folder) |
| `emptyWorkspace` | a workspace with no folders | "…Add Folder to Workspace", docs link | "This project has no folders yet." / "Add a folder to see what changed in its files." / Add a folder… |
| `scanFolderForRepositories`, `scanWorkspaceForRepositories` | Git still starting | "Scanning folder (workspace) for Git repositories..." | "Looking for Git in this project…" |
| `repositoryInParentFolders`, `repositoriesInParentFolders` | Git in a folder above | Open Repository, the setting's line, a docs link | "Git is set up in a folder (folders) above this project." / "Ritemark can show what changed in that folder's files too." / Show its file changes |
| `unsafeRepository`, `unsafeRepositories` | another user owns the folder | Manage Unsafe Repositories, a docs link | "Git doesn't trust this folder (these folders) yet." / the lead's line / Allow this folder… (these folders…) |
| `closedRepository`, `closedRepositories` | closed earlier | Reopen Closed Repository, a docs link | "File changes is closed for this project." / "It was closed earlier. Open it again to see what changed in each file." / Open it again |
| GitHub's `welcome.publishFolder`, `publishWorkspaceFolder` | Git on, a folder | "You can directly publish this folder to a GitHub repository…" and Publish to GitHub | Gone (decision 4): the entries leave `extensions/github/package.json`; `github.publish` stays, and All commands offers Publish to GitHub (checked live) |
| `view.workbench.cloneRepository`, `learnMore` | explorer only | Already removed from the explorer by patch 003 | Unchanged: no entry shows them |

Each button is the same command as before. A line that is only a link still draws as the panel's button (`viewPane.ts`), so "File changes needs Git" has no line that parses to a lone link: the Store rule (016) still holds. None of the shown strings says "VS Code", "repository", "initialize", "source control" or "workspace", or links to docs.

Seen live on PR 4: no Git on the computer (a launch with no Git on its PATH), no Git in the project, Git turned off (`git.enabled: false` written to the test profile), Set up Git here (the folder became a repository and the panel showed its changes), closed (Git: Close Repository) and Open it again. Not run here: `empty` (a window with no folder), `workspace`, `emptyWorkspace`, the parent-folder and unsafe states; their words are checked in the patch's diff above, and no state's words reach the screen differently from the ones run.

Screenshots (`qa/`): `pr4-r7-folder-{light,dark}-main.png` and `pr4-r7-folder-{light,dark}.png`; `pr4-r7-not-installed-light-main.png` and `pr4-r7-not-installed-{light,dark}.png`; `pr4-r7-turned-off-light.png`, `pr4-r7-closed-light.png`, `pr4-r7-after-set-up-light.png`.

**Windows** isn't run here: most Windows PCs have no Git, so `missing.windows` is the first thing most people there see. Gate 2 on 2.2's candidate (S43).

### For the Experience lead (review round 1)

The lead's words stand in PR 4; these are questions about them, from the review:

- **"Once it is, File changes works in every project"**: the Git extension looks for Git once, when Ritemark starts, so after installing Git the panel keeps saying "File changes needs Git" until Ritemark is restarted, and the old reload and troubleshoot links are gone (finding 1). A line such as "Restart Ritemark once Git is installed." would say so; it's the lead's call.
- **Git turned off** says "in Ritemark's settings", and Open the setting opens the person's own settings; `git.enabled` can also be off in the project's own settings (finding 7).
- **Git in folders above** reads "folders above this project … that folder's files too … Show its file changes": the lead wrote "The same" for the plural (finding 8).

### Still VS Code's, beyond the lead's words (for a follow-up)

Found on the way, not changed (PR 4 keeps to the lead's words):

- **Open it again** runs `git.reopenClosedRepositories`, as before, which opens VS Code's own picker: "Reopen Closed Repositories", "Pick a repository to reopen" (`qa/pr4-r7-open-it-again-pick-light.png`). Allow this folder… (`git.manageUnsafeRepositories`) opens a picker of the same kind. Their words are in the Git extension's code (`l10n.t`), not in `package.nls.json`.
- **Set up Git here in a project of several folders** runs `git.init` with no folder, as Initialize Repository did, and VS Code's picker asks "Pick workspace folder to initialize git repo in", with Choose Folder… (review round 1, finding 6).
- **SCM's own fallback**, "No source control providers registered." (`contrib/scm/browser/scm.contribution.ts`, `when: default`), shows when no Git state matches, for one while the Git extension hasn't started (round 1, finding 9).
- **The Git extension's own toast** (`extensions/git/src/main.ts`, `warnAboutMissingGit`): a folder with a `.git` folder opened on a computer without Git shows "Git not found. Install it or configure it using the \"git.path\" setting." with a **Download Git** button (`aka.ms/vscode-download-git`). It is outside File changes' welcome and older than this PR, but it is the kind of offer patch 016 exists to keep out (Store policy 10.1.5), so it matters for the Store more than for the words (review round 2, finding 2). Round 3 (finding 3) names a one-line fix: `"git.ignoreMissingGitWarning": true` in `branding/product.json`'s `configurationDefaults`, which patch 013 makes apply on desktop; it stops only that toast, and File changes already says Git isn't installed. It is shell-tier and outside the lead's words, so it is left for an issue of its own.
- **Git turned on with no Git installed**: with `git.enabled` off at start, the extension waits for it and then looks for Git; on a computer without Git that fails uncaught (`main.ts`), `git.missing` is never set, and the panel stays on "Looking for Git in this project…" until a restart. Upstream's; Open the setting leads into it as the old link did (round 2, finding 5).
- **A remote window** (`missing`, `remoteName != ''`) says "Git isn't on this computer" when the remote host lacks it. Ritemark ships no remote extensions, so it doesn't show today (round 2, finding 6).
- **Right after Set up Git here**, before a first commit, the Graph view at the panel's foot says "The selected source control provider does not have any source control history items." (SCM's history view), and the Repositories and Graph views keep "Source Control" in their names (patch 018's Sprint 142 note left them "for now (#567)").

## The outline

The workbench outlines every `[tabindex="0"]:focus` (`vscode/src/vs/workbench/browser/media/style.css`, Keyboard Focus Indication Styles). A view's welcome words are a `.welcome-view-content` with `tabIndex: 0`, and `ViewPane.focus()` focuses them when the view opens (`viewPane.ts:164`, `:677–678`).

Each place opened with the mouse from the places row or More, on `main` (light):

| Place | What takes the focus | `:focus-visible` | Outline drawn |
| --- | --- | --- | --- |
| Home, Tasks, Browser, Agents, Transcribe | the place's webview (`iframe.webview`) | no | none |
| Documents | the tree (`.monaco-list`, its rows' outline already off in 018) | no | none |
| More ▸ Search | the search box | yes (a field) | none |
| More ▸ File changes | `.welcome-view-content` | **no** | **1 px solid `focusBorder`** (`#4338ca` Light, `#818cf8` Dark) |
| More ▸ Extensions | the search box | yes | none |

So File changes is the one place in this window that draws it, and only because its welcome words take the focus. Any view's welcome words would do the same (Documents with no folder, for one), so the rule is for every `.welcome-view-content`, wherever its view is.

Chromium's guess is right after a mouse open (`:focus-visible` false), so the fix is CSS, in patch 018 (`ritemarkSurfaces.css`): `.monaco-workbench .welcome-view-content:focus:not(:focus-visible) { outline: none }`, more specific than the workbench's rule. No input-mode tracker is needed in the workbench (the plan's fallback).

| How File changes was reached | `main` | PR 4 |
| --- | --- | --- |
| More ▸ File changes, with the mouse | outline (`:focus-visible` false) | **none** |
| The same, then Tab to the button and Shift+Tab back | outline (`:focus-visible` true) | outline, kept (`qa/pr4-r7-folder-{light,dark}-keyboard.png`) |
| ⌃⇧G (View: Show File changes) | outline (`:focus-visible` false) | none |

The shortcut's row is Chromium's rule: a key pressed with Ctrl, Alt or ⌘ held doesn't count as moving by keyboard, so the focus it moves doesn't match `:focus-visible`. It is the same rule R3's tracker uses in the webviews ("keyboard after a key that is not a modifier alone or a shortcut"), so the workbench and the webviews agree. The keyboard's own way into the words, Tab and Shift+Tab, still draws the outline.
