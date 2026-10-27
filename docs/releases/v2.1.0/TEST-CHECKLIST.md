# Ritemark 2.1.0 Test Checklist

> **RC1, not built yet.** Written on 27 October 2026 for 2.1's first release candidate, from the [release plan](../../development/releases/v2.1.0/release-plan.md) (the done list, *Gate 1 additions*, the Gate 2 checklist and the risk table) and from the scenarios and QA evidence of Sprints 137–144. **Gate 1** is Jarmo on the signed, un-notarized arm64 Mac DMG. **Gate 2** is the x64 Mac DMG under Rosetta and the Windows installer. Results go into `evidence/` beside this file, and the sign-off table at the end records the gates in Jarmo's words. `main` is frozen from the version bump until publication, so this file and its record go into the closeout PR.

Release: Ritemark 2.1 ([release plan](../../development/releases/v2.1.0/release-plan.md)). **Shell-tier:** a full app release on VS Code 1.142.0 with Electron 43.8.3 (patch 020), with Claude Code 2.1.310 / Agent SDK 0.3.310, Codex 0.164.0 and OpenCode 1.19.4 bundled. Gate 1 and Gate 2 run on un-notarized builds. Notarization comes after the 60-minute hardening window, and publication is for all three platforms at once, with the Store update.

## The candidate

| | |
|---|---|
| Source commit (`origin/main`, the version bump's merge) | |
| Release worktree | `.worktrees/release-<commit>` (new, from `create-release-worktree.sh`; RELEASE SOURCE VERIFIED) |
| `main` frozen | from the version bump's merge until publication |
| CI on that commit | macOS x64 · Windows (on `windows-latest`, no visibility toggle) |
| Runtimes | Claude Code 2.1.310 / Agent SDK 0.3.310, Codex 0.164.0, OpenCode 1.19.4, ACP SDK 1.4.0 |
| Electron / Node | 43.8.3 / 24.22.0, unless patch 020 moved to a 43.x with Node 24.22.1 before the version bump (Sprint 144, R3 and R4) |

| Platform | Published as | SHA-256 as tested (un-notarized) | DMG built | Notarize no earlier than | Notarization, stapled | SHA-256 as published |
|---|---|---|---|---|---|---|
| macOS arm64 | `Ritemark-arm64.dmg` | | | | | |
| macOS x64 | `Ritemark-x64.dmg` | | | | | |
| Windows x64 | `Ritemark-Setup.exe` | | CI | n/a | n/a (Productory Services OÜ) | |

## How to use this checklist

- **137-S1** means Sprint 137's S1. The sprints are 137 [files as written](../../development/releases/v2.1.0/sprint-137-files-as-written/scenarios.md), 138 [equations](../../development/releases/v2.1.0/sprint-138-equations/scenarios.md), 139 [the chosen AI](../../development/releases/v2.1.0/sprint-139-chosen-ai/scenarios.md), 140 [the first day](../../development/releases/v2.1.0/sprint-140-first-day/scenarios.md), 141 [the model lineup](../../development/releases/v2.1.0/sprint-141-model-lineup/scenarios.md), 142 [polish](../../development/releases/v2.1.0/sprint-142-polish/scenarios.md), 143 [fixes](../../development/releases/v2.1.0/sprint-143-fixes/scenarios.md) and 144 [the release harness](../../development/releases/v2.1.0/sprint-144-release-harness/scenarios.md).
- **Which gate.** The sprint documents say "Gate 2" for every check a person makes on the candidate. Here, as in 2.0.0 and 2.0.1, what runs on the arm64 Mac is Gate 1, and the x64 Mac and Windows are Gate 2. A line the release plan's Gate 2 list gives with no platform is checked on the arm64 Mac; it is repeated on Windows only where a source says Windows.
- **Needs.** A line ends with what it needs beyond the candidate: an AI signed in (named), a key (named), a Google sign-in, an app such as Word, or the Windows PC. A line with no *Needs* needs nothing more.
- Tick a line only when it passes. A line that fails gets its issue number beside it. A line that was not run says why and stays unticked. A deferral counts only when Jarmo writes it into **Deferred in writing** at the end.
- Mac shortcuts use ⌘; the Windows section uses Ctrl.
- **Test copies.** A file named from the repository (`extensions/ritemark/…`) is copied into a test folder first, with a second copy kept aside, and compared with `cmp` or `diff` (`fc /b` on Windows) after the save.
- **The launch rule** (as in 2.0.0) for scripted runs and fresh profiles. Each gets its own short `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, `--use-mock-keychain` on the Mac, `RITEMARK_BUILD_CHANNEL=test`, and a debugging port that is not 9224, so test folders stay out of the installed app's recent list (#475) and test runs don't count as people (#480). Jarmo's own run on his own profile is the exception, and so is the keychain count below. For a fresh profile Jarmo watches, leave out `-g` so the window comes forward.

```bash
S=/private/tmp/claude-501/rc21-<name>          # short: the IPC socket path has a length limit; new for every run
mkdir -p "$S/ud/User" "$S/ext" "$S/shared"
RITEMARK_BUILD_CHANNEL=test open -n -g -a /Applications/Ritemark.app --args \
  "$FOLDER" \
  --remote-debugging-port=9411 \
  --user-data-dir="$S/ud" --extensions-dir="$S/ext" --shared-data-dir="$S/shared" \
  --use-mock-keychain \
  --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling
```

## Gate 1 technical: the release session, before handover

- [ ] `node ./scripts/worktree-hygiene.mjs --report` reviewed before the release worktree is made
- [ ] **#506, the Windows build without the toggle** (144-S1, S2, S3, S4, S8). The candidate's Windows build runs on `windows-latest` with the repository public, and every step passes, through the standard-user install, the update from v1.14.0, start and uninstall. The repository's `visibility`, stars and watchers read the same before and after, with no visibility change in between. The sidecar's `source_commit` is the candidate's commit. The same PE files are signed as on 2.0.1's 8-core run, each by "Productory Services OÜ". The month's "Actions Windows 8-core" minutes haven't grown. macOS x64 CI is green on the same commit
- [ ] The release worktree is new, detached at the exact `origin/main`; `release-preflight.sh` passes; "RELEASE SOURCE VERIFIED"
- [ ] Version 2.1.0 is in all six version files, and the release notes and `CHANGELOG.md` cover everything merged since v2.0.1. If no 43.x with Node 24.22.1 was published before the version bump, the release plan's #515 row names the Electron 2.1 ships, the CVEs it still carries and the one outside-address path, #515 stays open, and the notes don't claim the fix (144-S16)
- [ ] The runtimes at the release source (141-S42, S43): `check:anthropic-models` prints OK; the bundled runtimes are those in the table above; `verify-agent-runtimes.sh` exits 0 on the release Mac, with OpenCode's permission gate (a write pauses, Deny blocks, Allow writes). Any SKIP is listed as not proven
- [ ] Sprint 137's corpus test is green on the release source (`npm run test:editor-sync`, 137-S37)
- [ ] `build-prod.sh` and `validate-build-output.sh` pass. Check 5f finds the packaged Electron equal to `vscode/.npmrc`'s target (144-S14). The app's extension has `media/katex/` (the stylesheet, its woff2 faces and the licence) and `node_modules/mathml2omml` (138-S42, S43)
- [ ] `codesign-app.sh` reports every component signed and 0 failures; `codesign --verify --deep --strict` passes; TeamIdentifier is `JKBSC3ZDT5`
- [ ] The base window against the baseline, permanent for every shell release: `frame-screenshots.mjs --compare docs/development/frame-baseline --release docs/development/frame-baseline/release` exits 0, or every DIFFERS scene is fixed or approved by Jarmo before Gate 1 passes; `frame-geometry.mjs` exits 0 (142-S51); `project-check.mjs --close-all --share-question` passes
- [ ] The DMG's build time is in the table above. Notarization waits at least 60 minutes from it, and for Jarmo's Gate 1

## Gate 1: Jarmo, macOS arm64

### First, one decision

- [ ] **#515, accept or reject:** 2.1 ships on Electron 43.8.3, which still carries Node 24.22.0, not 24.22.1 with Node's 21 October security fixes; accept, and #515 stays open for the next release that rebuilds the app, or reject, and 2.1 waits for an Electron that has it.

  From the risk table: no Electron with Node 24.22.1 was published on 27 October. Chromium, which draws the browser and Ritemark's pages, isn't exposed to the Brotli flaw. One Ritemark path fetches an outside address with Node: a Flow's Save File step saving an image from a URL. If patch 020 moved to a 43.x with Node 24.22.1 before the version bump, About reads 24.22.1, this line doesn't apply, and #515 closes with the candidate (144-S15).

### Installing

- [ ] **Install over 2.0.1.** Quit 2.0.1 with ⌘Q, mount the DMG and drag Ritemark to Applications, replacing it. It isn't notarized, so if Gatekeeper warns: right-click ▸ **Open**, or System Settings ▸ Privacy & Security ▸ **Open Anyway**. Passes when it starts from `/Applications`
- [ ] **About** (144-S9). Help ▸ About. Passes when it reads 2.1.0, names the candidate's source commit, and reads "Electron: 43.8.3" and "Node.js: 24.22.0" (24.22.1 if patch 020 moved)
- [ ] **The `.claude` folder in Documents** (RC4; Jarmo, 27 October). In a project with a `.claude` folder, look at Documents, then search for a word that is only inside a skill. Passes when `.claude` shows as an ordinary folder (not faded), its skills open, Search finds the word, and `.ritemark` and `.claude/worktrees` stay hidden
- [ ] **No Copilot error toast** (Sprint 144's QA evidence). Watch the first minute after start. Passes when no "Activating extension 'GitHub.copilot-chat' failed" toast shows, as dev builds show it
- [ ] **#557: no Chat Debug** (142-S45). Open More (⋯), and take a screenshot of it. In Terminal, `ls /Applications/Ritemark.app/Contents/Resources/app/extensions | grep copilot`. Passes when More lists no "Chat Debug" and the command prints nothing; #557 then closes with the screenshot

### The update from 2.0.1, on your own profile

- [ ] **Kept.** Look through the projects list, a few projects' Homes and the chat rail. Passes when your settings, projects and chats are all there and none is lost
- [ ] **#417: a chat keeps its model** (139-S33, S39; 141-S46). A 2.0.1 chat opens and works as it did in 2.0.1. In a ChatGPT chat, pick a model other than the default and send a message. Quit with ⌘Q, start again and open that chat. Passes when the model button shows the model you picked, the next message runs on it and continues the same conversation, and no "Previous messages were included as context." line appears. *Needs: ChatGPT signed in.*
- [ ] **Codex and the keychain** (Sprint 141's runtime review, `research/runtime-review.md`). The release re-signs Codex 0.164.0 under Ritemark's team, which is where 1.x's keychain prompt storm came from. On your own profile, without the mock keychain: first back up `~/.codex/config.toml` byte for byte. Start a ChatGPT chat and count the keychain prompts at start. Leave the chat open past a token refresh and count again. Passes when there are no more prompts than 2.0.1's ChatGPT gave on this Mac (none where "Always Allow" was given to 2.0.1). If there are more, the candidate goes back to Codex 0.163.0, or to the untested `mcp_oauth_refresh_coordination=false` override. *Needs: ChatGPT signed in; a `~/.codex/config.toml` with OAuth MCP servers.*

### A fresh profile

- [ ] **The welcome and the plan lines** (139-S1; the release plan's fresh-profile line). Start the candidate on a fresh profile (the launch rule, without `-g`). On step 1, read each card. Sign in with one AI, open a folder as a project. Passes when ChatGPT's card says "Any plan works, free included.", Claude's "Needs a paid plan, such as Pro or Max." and OpenCode's "Open models, with an API key of your own.", the word Codex appears nowhere, and the welcome lands on the project's Home with its ready request card. *Needs: an AI signed in.*

### Files come back as written (137, #270, #454)

- [ ] **137-S1, #270's own fixture.** Copy `extensions/ritemark/webview/src/utils/fidelity-corpus/kept/issue-270-list.md`. Open it, type ` EDITED` at the end of the third item, and wait for Saved. `diff` it against the copy. Passes when exactly one line changed, `- third item EDITED`, with no trailing spaces and no blank line added between the items
- [ ] **137-S21, S24: tables and front matter.** Copy `kept/tables.md` and `kept/front-matter.md` from the same folder. Open each, type one character at the end of the last paragraph, delete it, and wait for Saved. Passes when `cmp` finds each file byte for byte its copy, table alignment and front matter included
- [ ] **137-S40, #454: one question when the AI writes while you type.** Open a document and keep typing in it while the AI changes the same document (ask it on the AI's sheet to change a line). Without an AI, write a changed copy of the file from Terminal while typing. Passes when Ritemark's **Review changes** shows in the document's bar, and VS Code's "The content of the file is newer" notification never shows, then or after the next auto-save. *Needs: an AI signed in (or the Terminal write).*

### Equations and Google Docs quotes (138, #481, #408)

- [ ] **138-S1, S2, S15: typeset, and dollars left alone.** Copy `analyst-report.md` and `prose-dollars.md` from `extensions/ritemark/webview/src/extensions/math/fixtures/`. Open both, in Ritemark Light and then Ritemark Dark. Passes when the report's inline formulas are typeset in their sentences and its display equations are centred, with no `$` where a formula is, readable in both themes, and every `$` in `prose-dollars.md` shows as text with nothing typeset
- [ ] **138-S32: the report as a PDF.** Share ▸ PDF, then open the PDF in Preview and in Acrobat Reader. Passes when inline equations sit on their lines' baseline, display equations are centred, the table's and the list's equations are typeset, they look like the editor's, they are sharp at 200%, and no LaTeX shows anywhere. *Needs: Acrobat Reader.*
- [ ] **138-S36: the report in Word.** Share ▸ Word, then open it in Word for Mac. Passes when Word opens it with no repair prompt, every equation is a Word equation (clicking one opens Word's equation editor), inline ones sit in their sentences and display ones are centred, and no LaTeX shows anywhere. *Needs: Word for Mac.*
- [ ] **138-S41, #408: quote blocks in Google Docs.** Make a document with a one-paragraph quote, a two-paragraph quote, a nested quote and a quote holding a list, and publish it with Share ▸ Google Docs. Passes when every line of every quote, the first included, starts at the quote's indent, and the left border is a thin line. *Needs: Google Docs connected.*
- [ ] **138-S46: the film's document, before capture.** With the Social manager's report for the day-one film: open it, edit one word and save, then share it as PDF and Word. Passes when the file changed only at that word, and the PDF and the Word file pass as in S32 and S36. Only then is the film captured (Windows is in Gate 2). *Needs: the film's document; Word for Mac.*

### The chosen AI, on the new runtimes (139, 141, 144)

- [ ] **A first message with each AI** (the release plan's 139 line; 144-S12). In a project, send one message with Claude, one with ChatGPT and one with OpenCode. Passes when each answers, as on 2.0.1. *Needs: Claude signed in; ChatGPT signed in; an OpenCode provider key.*
- [ ] **A ChatGPT error as one sentence** (139-S17, S25). In a new ChatGPT chat, pick a model ChatGPT refuses for a ChatGPT account (Sprint 139's run used GPT-5.4 Mini) and send. Passes when one card shows ("ChatGPT couldn't use GPT-5.4 Mini" / "It isn't available in Ritemark right now. Switch to GPT-6.1 Sol, then send your message again."), no JSON shows in the chat and nothing is on the status line; **Use GPT-6.1 Sol** switches the model, sends nothing again, and the card then reads "Now using GPT-6.1 Sol". *Needs: ChatGPT signed in.*
- [ ] **The AI on a web page** (144-S12). Open a page in the browser, answer the share question with Share this page, and ask the AI to click and fill something on it. Passes when the AI reads the page and clicks and fills on it, as on 2.0.1. *Needs: an AI signed in.*
- [ ] **OpenCode's own model lists** (141-S35, S36, decision 10; merge 2's look waited for a key). With a provider key saved, open the message box's model menu on OpenCode and take a screenshot for the Experience lead. Passes when that provider's group lists its models, Google's starting with Gemini 3.8 Flash and then Gemini 4 Argon, with no embedding, speech, image or batch models. *Needs: an OpenCode provider key.*

### The first day and the feedback door (140, #497, #498, #466)

- [ ] **A folder of Word files, each AI** (140-S1, S10, S20; the risk table's Word row). The release session makes "Training work" with `sprint-140-first-day/research/spike/make-training-work.py`; `facts.json` beside it lists what each answer should hold. Add it as a new project. Home's card reads "Nothing in this folder was moved or changed", "Claude works only inside it. 37 files: 20 Word documents, 10 PDFs, 4 spreadsheets and 3 text documents", **Ask Claude what is here** and "Reads the names, then the five newest documents." Press it, then do the same with ChatGPT and with OpenCode from **Ask with** (on a fresh copy each time, since an answered card goes). Passes when a new chat opens in front with the request sent, and each answer gives the planted fact of each of the five newest documents or names each one it couldn't open, with no approval asked in Auto, nothing failed, and under three minutes. *Needs: Claude signed in; ChatGPT signed in; an OpenCode provider key.*
- [ ] **An empty project** (140-S13, S21). Add an empty folder as a new project. The card reads "Start with what this project is for" with **Tell Claude what this project is for**. Press it. Passes when a new chat opens with "This project is for " in the box and the cursor after it, nothing is sent; and after you finish the sentence and press Send, the AI writes About this project (`AGENTS.md`) and a first outline as a new document, and says what it did. *Needs: an AI signed in.*
- [ ] **The sample** (140-S14, S22). Choose Try the sample project on the welcome. The card reads "Claude can draft Module 4" with **Ask Claude to draft Module 4**. Press it. Passes when the button reads "Giving it to Claude…" with a spinner and can't be pressed twice, the note says "It shows in Doing in a moment.", the task shows in Doing on the board, its chat appears on the rail, and the card goes. *Needs: an AI signed in.*
- [ ] **The starting points** (140-S33, S37, S39). In Training work with Home in front, open a new chat; then open a CSV and look again; then click a starting point. Passes when the empty chat shows "What shall we work on?" with What is here? · Find what I wrote about… · Write About this project; with the CSV in front, What stands out here? · Write a short summary of this table; and a click puts the words in the box with the cursor at the end and sends nothing. *Needs: an AI signed in.*
- [ ] **The feedback door** (140-S47, S48). Look at the status bar's right group, then open Help. Passes when the status bar shows "Send feedback" before the bell, with no "Report AI issue" and the tooltip "Send feedback or report an AI issue", and both it and Help ▸ Send feedback (after Support) open the feedback sheet. Escape closes it and nothing goes

### Polish (142)

- [ ] **142-S8: File changes.** In a project that is a Git repository, choose More ▸ File changes. Passes when the left column's head reads "File changes", not "Source Control" (its inner views still say Source Control: #567)
- [ ] **142-S46–S48: the desk's corners.** With Home on the desk at 1440 × 900, look closely at the desk's lower right corner (zoom a screenshot), in Ritemark Light and Ritemark Dark. Passes when the thin edge line runs whole round the rounded corner and nothing is cut hard; in Dark there is a line only, no shadow
- [ ] **142-S57: the board at 1440.** Open the Tasks tab at 1440 × 900 with the left column and the AI's sheet showing. Passes when all four columns show whole, the board doesn't scroll sideways, and a card's Give to button keeps its caret

### The fixes (143)

- [ ] **143-S17, #514: Claude's titles.** On your own profile, with your own skills, start five new chats with Claude, each with an English first message. Passes when all five automatic titles are English. *Needs: Claude signed in.*
- [ ] **#507: ⌘⇧P on Home, with your own keyboard** (143-S27–S32). Ten presses of each, each case: click Home's title, then ⌘⇧P (S27); click Home, Tab to a control, ⌘⇧P (S28); with the line's input open (S29); after a file added to the project redraws Home (S30); back on Home by its tab, with and without a click inside Home (S31); and ⌘P and ⌘, on Home, ⌘⇧P on the Task board, Transcribe and a document (S32). Passes when All commands (or Quick Open, or Settings) opens every time. If it never fails, #507 moves to 2.2 with `sprint-143-fixes/research/home-keys-audit.md`; if it fails once, write down which case

### The project switch (144, #569)

- [ ] **#569: the AI column after a switch** (144-S40; *Gate 1 additions*). Scripted, on a test launch of the installed candidate by the launch rule: two projects, each left with a document in front, then `node scripts/qa/project-check.mjs --port 9411 --switch-to <project> --measure 10`. Passes when, in the ten switches, the AI column follows Home by under 300 ms and no document ("Loading…") is in front before Home; #569 then closes. Otherwise it is a 2.1 bug with the record (the dev build left a document in front for 0.7–0.9 s and the AI column up to 0.56 s after Home)

### The done list on the Mac

- [ ] **#499: a synced folder, with the File Provider consent** (144-S20; 137-S48; the done list). Make a new empty folder "Ritemark 2.1 sync test" in your personal Google Drive folder, and one in a OneDrive that isn't the work tenant's (`OneDrive-ProductoryServicesOÜ` stays out of tests). Open each as a project from the welcome or Add a project ▸ Open a folder…. When macOS asks "Ritemark would like to access files managed by Google Drive" (or OneDrive), answer it yourself. In each, open an online-only file, create a document, edit and save it, and ask the AI to edit it. Passes when each folder opens, the online-only file opens (downloading), the saves ask nothing, and the AI's write raises no conflict. The test folders stay for you to remove. *Needs: Google Drive and a non-work OneDrive on this Mac; an AI signed in.*

## Gate 2: macOS x64, under Rosetta

The x64 candidate runs on Jarmo's Mac under Rosetta, unless an Intel Mac is at hand; the evidence says which machine.

- [ ] **Install.** Mount the x64 DMG and replace the arm64 app in Applications (one Ritemark there at a time). Handle Gatekeeper as on arm64, and start it with `open --arch x86_64 -a /Applications/Ritemark.app`. Passes when it starts, and Activity Monitor shows Kind **Intel**
- [ ] **About** (144-S9, S14: the x64 workflow doesn't run `validate-build-output.sh`, so the x64 Electron is read here). Passes when About reads 2.1.0, names the source commit, and reads "Electron: 43.8.3" and "Node.js: 24.22.0" (or 24.22.1)
- [ ] **A Claude turn** (the release plan's *Every release*). Passes when an authenticated Claude turn answers. *Needs: Claude signed in.*
- [ ] **A ChatGPT turn** (*Every release*). Passes when a ChatGPT (Codex) turn answers. *Needs: ChatGPT signed in.*
- [ ] **OpenCode's permission gate** (*Every release*). Ask OpenCode to write a file, Deny, then ask again and Allow. Passes when it asks before the write, Deny writes nothing and Allow writes. *Needs: an OpenCode provider key.*
- [ ] **The smoke test.** Open a `.md`, type, format (⌘B, a heading, a list) and save. Passes when Saved shows and the file on disk has the change
- [ ] **Afterwards** the arm64 candidate is back in `/Applications`

## Gate 2: Windows x64

Ctrl replaces ⌘ in every shortcut. File, Edit, View and Help sit behind the menu button at the start of the left strip. Every line here needs the Windows PC; the Windows session reports item by item, through the Development manager.

### Installing and the first window

- [ ] **The installer** (144-S3; the risk table's SmartScreen row). Passes when its hash matches the sidecar and the sidecar's `source_commit` is the candidate's, Properties ▸ Digital Signatures shows Productory Services OÜ, and the installer says 2.1.0. A SmartScreen "Windows protected your PC" warning is expected while reputation builds and isn't a blocker: record what showed. *Needs: the Windows PC.*
- [ ] **About** (144-S9, S15). Passes when About reads 2.1.0, names the source commit, and reads "Electron: 43.8.3" and "Node.js: 24.22.0" (or 24.22.1). *Needs: the Windows PC.*
- [ ] **#276, a fresh profile** (144-S18; the release plan's fresh-profile line). Install on a profile that has never run Ritemark. Sign in to an AI on the welcome, reading the plan lines, and open a folder as a project. Passes when the first window opens on the welcome, the cards carry the plan lines as in Gate 1, and the welcome lands on Home with the AI in view and its ready request card, never on a terminal or an empty desk. *Needs: the Windows PC; an AI signed in.*
- [ ] **#276, the update from 2.0.1** (144-S18). Install over 2.0.1 with a lived-in profile. Passes when the first window opens on Home with the AI in view, not on a terminal or an empty desk. *Needs: the Windows PC with 2.0.1 and a lived-in profile.*
- [ ] **#501, a terminal on the first start after 1.14** (144-S19). Restore the Windows Harbour profile (v1.14.0, a terminal open at quit), update it with the candidate's installer and start the app. Record how long a restored terminal is in front before the welcome (2.0's retest: 6–14 s). Passes when no terminal is in front after the welcome appears; if one is, #501 is a 2.1 bug with that recording. *Needs: the Windows PC with v1.14.0 and the Windows Harbour.*

### The done list's synced folder

- [ ] **#499 on Windows** (144-S17; 137-S48). In a OneDrive or SharePoint synced folder with at least one online-only file: open it as a project from the welcome, edit and save a document, and have the AI edit another. Passes when the folder opens, the online-only file opens (downloading), the saves ask nothing, and the AI's write raises no conflict. *Needs: the Windows PC with OneDrive or SharePoint; an AI signed in.*

### Files and equations

- [ ] **137-S40, #454 on Windows.** As in Gate 1: type in a document while the AI changes it (or while PowerShell writes a changed copy). Passes when only Ritemark's **Review changes** asks, and VS Code's "The content of the file is newer" notification never shows. *Needs: the Windows PC; an AI signed in (or the PowerShell write).*
- [ ] **138-S46, S32, S36 on Windows.** Copy `analyst-report.md` (and the film's document): open it, edit one word, save, then share it as PDF and as Word. Passes when `fc /b` shows only that word changed, the PDF in Acrobat Reader passes as S32 in Gate 1, and Word for Windows opens the Word file with no repair prompt, every equation a Word equation and no LaTeX anywhere. *Needs: the Windows PC; Word for Windows; Acrobat Reader.*
- [ ] **138-S43: the equation fonts and the Word converter are installed.** In the install folder, look under `resources\app\extensions\ritemark\`. Passes when `media\katex\` holds the stylesheet, its woff2 faces and the licence, and `node_modules\mathml2omml\` is there. *Needs: the Windows PC.*

### Polish (142)

- [ ] **142-S45, #557 on Windows.** Passes when More (⋯) lists no "Chat Debug" and the install folder has no `resources\app\extensions\copilot`. *Needs: the Windows PC.*
- [ ] **142-S8: File changes** (patch 018, first checked on Windows here). In a Git project, More ▸ File changes. Passes when the left column's head reads "File changes". *Needs: the Windows PC.*
- [ ] **142-S46–S48: the desk's corners** (patch 018). Home on the desk, Light and Dark, the lower right corner zoomed. Passes when the edge line is whole round the corner and nothing is cut hard; Dark has a line only. *Needs: the Windows PC.*
- [ ] **142-S62–S64, #508: a restored card's tab** (patch 019). Open a task card's page as a tab not in front, quit and start again; then the same with the card's tab in front; then edit a card's title and quit. Passes when the tab reads the card's title with the task mark from the first paint, never the file's name; with the card in front, the AI's chip names it by its title too; and an edited title comes back as edited. *Needs: the Windows PC.*
- [ ] **142-S58: the board at 1440, 100%.** At 100% scaling and 1440 × 900, with both side columns, open the Tasks tab. Passes when all four columns fit with no sideways scroll. *Needs: the Windows PC.*

### The fixes (143)

- [ ] **143-S33, #507: Ctrl+Shift+P on Home, with a real keyboard.** Gate 1's cases S27–S31, ten presses each. Passes when All commands opens every time. *Needs: the Windows PC.*
- [ ] **143-S36, #509: an .m4a, and Dismiss.** Add the kit's `Call with the HR lead.m4a` in Transcribe. Then transcribe a text file renamed `broken.mp3` on On-device. Passes when the .m4a's card shows On-device disabled with ".m4a files need converting before they can be transcribed on this device. Use .mp3 or .wav, or transcribe with ElevenLabs." and nothing starts; with ElevenLabs set up, ElevenLabs can be chosen; and `broken.mp3` fails into Needs attention with **Dismiss** ("Remove this from the list. The recording stays where it is."), which removes the card and leaves the file. *Needs: the Windows PC; an ElevenLabs key for the ElevenLabs half.*
- [ ] **143-S41, #510: the pickers with no Desktop.** Start Ritemark with `USERPROFILE=C:\Ritemark` (a home with no Desktop folder). Choose Transcribe a file… five times and Add a project ▸ Open a folder… five times, cancelling each. Quit. Passes when a picker opens every time, and no Ritemark process is left 10 s after quitting. *Needs: the Windows PC.*

### The feedback door (140, #466)

- [ ] **140-S47, S48 on Windows.** Passes when the status bar shows "Send feedback" before the bell (no "Report AI issue"; the tooltip "Send feedback or report an AI issue"), and both it and the menu button's Help ▸ Send feedback, after Support, open the feedback sheet. *Needs: the Windows PC.*

### The runtimes (the release plan's *Every release*; 141-S48)

- [ ] **A Claude turn.** Passes when an authenticated Claude turn answers. *Needs: the Windows PC; Claude signed in.*
- [ ] **A ChatGPT turn.** Passes when a ChatGPT (Codex) turn answers, and Codex's sandbox commands run (the Windows helpers, a SKIP on the Mac). *Needs: the Windows PC; ChatGPT signed in.*
- [ ] **OpenCode's permission gate.** Ask OpenCode to write a file, Deny, then again and Allow. Passes when it asks before the write, Deny writes nothing and Allow writes. *Needs: the Windows PC; an OpenCode provider key.*

## Publication and after

- [ ] **The privacy lines** (the done list; Sprint 139's R11, a release checklist row). The `ritemark-web` PR with the lines for #479's and #473's counts and Sprint 140's counts merges with publication. 2.1 doesn't publish with these counts before the privacy page says so
- [ ] **The feed and the assets** (the release plan's *Gates*). The feed is made with `--existing-feed-url` naming v2.0.1's feed and all three assets, and every published asset matches `dist/`
- [ ] **The model feed** (141 R8, R9). At publication, the candidate feed exported from the release source with `--merge` passes `npm run check:model-feed`, its report goes into `evidence/`, and `feeds/model-catalog.json` is committed to `ritemark-public` as `jarmo-productory`
- [ ] **The Microsoft Store** (the done list). The 2.1.0 update, with the installer hosted at `windows/v2.1.0/Ritemark-Setup.exe`. Pricing is checked to read Free and not changed. The certification notes describe the feedback path exactly as built (policy 11.16) and keep the third-party AI disclosure. Submit needs Jarmo's word
- [ ] **The update offer.** On the live feed, 2.0.1 and 1.14.0 are offered 2.1.0 on all three platforms (as 2.0.1's S8)
- [ ] **The issues.** Closed with the candidate's evidence: #557 (Chat Debug's screenshot), #569 (if its line passed), #514 (Claude's half), #509 and #510 (their Windows halves), #499 (both platforms), #506. #507 moves to 2.2 if it never failed. #515 stays open unless About read Node 24.22.1

## Unclear

- **The refusal card.** The release plan's Gate 2 list asks for "the refusal card (if reproducible)". Sprint 139's QA evidence says it wasn't built: there was no Claude Free account to reproduce with (A1 not run), so there is nothing to check on this candidate. (`release-plan.md`; `sprint-139-chosen-ai/qa-evidence.md`, S6–S15)
- **The keychain count.** The runtime review says to count the prompts at start and again past a token refresh, and also to "stop at the first prompt", which leaves at most one to count. It doesn't say how long a token refresh takes, or whether Jarmo's `~/.codex/config.toml` has OAuth MCP servers. (`sprint-141-model-lineup/research/runtime-review.md`)
- **A OneDrive on the Mac.** The done list has Jarmo test "a OneDrive that isn't the work tenant's", but this Mac's OneDrive is only the work tenant. Whether he signs a personal OneDrive in, or the OneDrive half is Windows-only, isn't said. (`release-plan.md`; `sprint-144-release-harness/qa-evidence.md`, S20)
- **141-S46.** It asks for a ChatGPT chat "saved by `main`'s build" (with the older Codex), then opened by the new Codex. On the candidate there is no such build, so it is folded into the restart check in Gate 1's update section; a 2.0.1 chat has no saved model (139-S39). (`sprint-141-model-lineup/scenarios.md`)
- **A corpus file with tables and front matter.** The release plan asks for one such file, but no file in `fidelity-corpus/kept/` has both, so Gate 1 uses `tables.md` and `front-matter.md`. (`release-plan.md`, Gate 2 checklist)
- **The film's document** (138-S46) is the Social manager's report, which isn't in the repository; `analyst-report.md` is its stand-in. Who brings it to Gate 1 isn't said. (`sprint-138-equations/scenarios.md`)
- **"The kit's" `Call with the HR lead.m4a`** (143-S36) isn't in the repository (the sample has `Call with the HR lead.md`); where the kit lives isn't said. (`sprint-143-fixes/scenarios.md`, `spec.md`)
- **#509's Dismiss.** The release plan puts "a failed card can be dismissed" under S36, but Dismiss is S37, a Mac scenario; it is written here as part of the Windows line. (`release-plan.md`; `sprint-143-fixes/scenarios.md`)
- **#510's A4** (143-S39, the pickers with `--log trace`) was due from the Windows session before Gate 2. Sprint 143's folder has no record that it ran; if it didn't, S41 is the only Windows evidence about the main process's dialog lock. (`sprint-143-fixes/qa-evidence.md`)
- **#501's run.** The done list checks #501 "in the same run" as the update from 2.0.1, while 144-S19 starts from a v1.14.0 install with a terminal at quit. S19 is followed here. (`release-plan.md`; `sprint-144-release-harness/scenarios.md`)
- **#569's script.** The release plan gives the command for the arm64 candidate but not who runs it; it is written as a scripted run by the release session on a test launch. (`release-plan.md`, *Gate 1 additions*)
- **144-S11's Windows half** (the native modules on Electron 43.8.3: a terminal, a setting kept, an outside change seen) is listed for the Windows session after the merge, not for the candidate. If it didn't run, the candidate is the first Windows run on 43.8.3. (`sprint-144-release-harness/qa-evidence.md`)
- **144-S1–S4 and S8** were to run on `main` after #572's merge; the folder doesn't record that they did (#575 later changed the signing step). They are written here against the candidate's own Windows build. (`sprint-144-release-harness/qa-evidence.md`)
- **138-S45** (the 2.0.1 regression set on Windows) is marked "not run: Windows session and the release candidate", which doesn't say whether it belongs to the candidate. Left out. (`sprint-138-equations/qa-evidence/qa-evidence.md`)
- **140-S12** (counting a synced folder downloads nothing, Mac and Windows) wasn't run and no source puts it on the candidate, though #499's runs open exactly such folders. Left out. (`sprint-140-first-day/qa-evidence.md`)

## Deferred in writing

| Line | Why | Jarmo's words, date |
|---|---|---|
| | | |

## Sign-off

| Gate | Platform | Artifact (SHA-256 as tested) | Technical (agent) | Jarmo | Notarized + stapled |
|---|---|---|---|---|---|
| Gate 1 | macOS arm64 | | | | |
| Gate 1 | #515 (Electron 43.8.3, Node 24.22.0) | — | — | accept / reject | — |
| Gate 2 | macOS x64 (Rosetta) | | | | |
| Gate 2 | Windows x64 | | | | n/a |
| Publish | All three, one publication; the privacy lines live | | | | — |

**Gate 1 verdict:**
**Gate 2 verdict:**
