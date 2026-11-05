# Ritemark 2.2.0 Test Checklist

> **RC1, not built yet.** Written on 6 November 2026 for 2.2's first release candidate, from the [release plan](../../development/releases/v2.2.0/release-plan.md), the Gate rows, done lists and scenarios of Sprints 145–149 and 152–154, the review and merge records on 2.2's merged PRs, and the [release notes](release-notes.md). **Gate 1** is Jarmo on the signed, un-notarized arm64 Mac DMG. **Gate 2** is the x64 Mac DMG and the Windows installer. Results go into `evidence/` beside this file, and the sign-off table at the end records each gate in Jarmo's words. `main` is frozen from the version bump until publication, so this file and its record go into the closeout PR.

Release: Ritemark 2.2 ([release plan](../../development/releases/v2.2.0/release-plan.md)). **Shell-tier:** a full app release on VS Code 1.142.0 with Electron 43.8.6 / Node 24.22.1 (patch 020, #620), with Claude Code 2.1.310 / Agent SDK 0.3.310, Codex 0.164.0 and OpenCode 1.19.4 bundled ([runtime review](runtime-review.md)). Notarization comes after the gates and the 60-minute hardening window; publication is for all three platforms at once, with the Store update.

## The candidate

| | |
|---|---|
| Source commit (`origin/main`, the version bump's merge) | |
| Release worktree | `.worktrees/release-<commit>` (new, from `create-release-worktree.sh`; RELEASE SOURCE VERIFIED) |
| Publish (Sprint 149 PR 4, #668) | merged before the candidate: yes / no. If no, skip every row marked **PR 4** |

| Platform | File in the release worktree's `dist/` | SHA-256 as tested (un-notarized) | DMG built | Notarize no earlier than | SHA-256 as published |
|---|---|---|---|---|---|
| macOS arm64 | `Ritemark-arm64.dmg` | | | | |
| macOS x64 | `Ritemark-x64.dmg` | | | | |
| Windows x64 | `Ritemark-Setup.exe` (from CI) | | CI | n/a | |

2.1's closeout couldn't recover the hashes of the DMGs that passed its gates, so this time each un-notarized hash is written above when its gate starts.

## How to start

- **Where the candidate is.** The release session puts the path and the hash in the table above: `dist/` in the new release worktree, `ritemark-native/.worktrees/release-<commit>/dist/`. The Windows installer comes from the candidate commit's CI run.
- **Signed, not notarized.** Mount the DMG and drag Ritemark to Applications, replacing 2.1.0 (quit it with ⌘Q first). macOS will warn the first time: right-click Ritemark ▸ **Open**, or System Settings ▸ Privacy & Security ▸ **Open Anyway**. On Windows a SmartScreen warning is expected and isn't a blocker; write down what showed.
- **Your own profile** is the main test: it is the update from 2.1.0 as people will get it. Most rows run there.
- **A fresh profile, safely.** Rows marked **Fresh** run in a test instance with its own throwaway folders, so your projects, recent list and keychain stay untouched. Never change `HOME`. Leave out `-g` so the window comes forward. Quit it with ⌘Q when done.

  ```bash
  S=/private/tmp/rc22-<name>          # short: the socket path has a length limit; a new name for every run
  mkdir -p "$S/ud/User" "$S/ext" "$S/shared"
  RITEMARK_BUILD_CHANNEL=test open -n -a /Applications/Ritemark.app --args \
    --remote-debugging-port=9411 \
    --user-data-dir="$S/ud" --extensions-dir="$S/ext" --shared-data-dir="$S/shared" \
    --use-mock-keychain
  ```

  `--shared-data-dir` keeps test folders out of your recent list (#475), `RITEMARK_BUILD_CHANNEL=test` keeps test runs out of usage data (#480), and `--use-mock-keychain` keeps the keychain from asking. Use a port other than 9224.
- **What a row needs** is in bold at its end:
  **AI** = a real signed-in AI (named where one is needed), **Key** = a real API key, **Mic** = a real microphone, **Cloudflare** = Jarmo's Cloudflare test account, **OneDrive** = a OneDrive (or other cloud-synced) folder, **Fresh** = a fresh profile, **PR 4** = only if Publish ships. No mark means the candidate alone is enough.
- **The source** is in small text at the end: a sprint and its row (145-S1 is Sprint 145's scenario S1), or a PR number.
- Tick a row only when it passes. A row that fails gets its issue number beside it. A row not run says why and stays unticked. A deferral counts only when Jarmo writes it into **Deferred in writing** at the end.

## Gate 1: the release session, before handover (arm64 Mac)

1. [ ] `node ./scripts/worktree-hygiene.mjs --report` is read before the release worktree is made; the worktree is new, detached at the exact `origin/main`, `release-preflight.sh` passes and prints RELEASE SOURCE VERIFIED. <sub>release skill, Step 0</sub>
2. [ ] Version 2.2.0 in every version file; the release notes' Sprint 149 markers resolved for what merged (PR 4 in or out); `CHANGELOG.md` covers everything since v2.1.0. <sub>release-notes.md</sub>
3. [ ] `check:anthropic-models` prints OK in the release worktree (the catalogue expires on 12 November); `verify-agent-runtimes.sh` exits 0, with OpenCode's permission gate. <sub>runtime-review.md</sub>
4. [ ] `build-prod.sh` and `validate-build-output.sh` pass; check 5f finds Electron 43.8.6; `codesign-app.sh` reports 0 failures, `codesign --verify --deep --strict` passes, TeamIdentifier `JKBSC3ZDT5`. <sub>#620, release skill</sub>
5. [ ] **The reference images.** The frame baseline is retaken under the isolated launch rule (a fresh profile, isolated AI homes, the sample project) before the compare, since the 2.0 set had signed-in AIs and differs by about 8% on the AI's sheet alone; Jarmo approves the new set. If it was already retaken, write its commit here. <sub>release plan, Risks; frame-baseline/README.md</sub>
6. [ ] **The base window against the baseline.** On a test launch of the installed candidate: `node scripts/qa/frame-screenshots.mjs --port 9411 --out <dir> --compare docs/development/frame-baseline --release docs/development/frame-baseline/release` and `node scripts/qa/frame-geometry.mjs --port 9411`. Every scene's **JOINS** line is ok; a scene over 0.5% is fixed or approved by Jarmo (look at `<dir>/joins.html` at 4×); geometry passes. Note whether the share-question and settings-foot scenes crashed in the full run. <sub>release skill; #641, #672</sub>
7. [ ] **The first frame.** `node scripts/qa/project-check.mjs --port <port> --user-data-dir <dir> --first-frame <start> --ext-port <port>` for `new-profile`, `new-project --to <folder>`, `switch --to <folder>`, `relaunch` and `relaunch --ai-closed`, on a candidate launched with `--inspect-brk-extensions`. Nothing in the frame moves after its first frame; the 3 px terminal-tab step seen in source trees is gone. <sub>152 R8; #632, #638, #639</sub>
8. [ ] **Every control's states.** The candidate launched as above with `RITEMARK_CONTROL_CATALOGUE=1`: `node scripts/qa/control-states.mjs --port <port> --out <dir> --compare docs/development/control-baseline` exits 0, or each state that differs is fixed, or approved by the Experience lead and Jarmo. <sub>146 R4; #621, #637, #642</sub>
9. [ ] **The project switch.** Two projects, each left with a document in front: `node scripts/qa/project-check.mjs --port 9411 --switch-to <project> --measure 10`, both ways. In 10 of 10 switches no document is in front before Home, and the AI column follows Home within 300 ms. <sub>145-S43, #622</sub>
10. [ ] **The logs of a fresh start.** `main.log` has no "Refused to load resource /phosphor.woff2"; `exthost.log` has no DEP0169 error and no built-in extension (Emmet, GitHub sign-in, configuration editing) failing to start; `renderer.log` has no `[ritemark] slot released:` line. <sub>145-S41; #620; 152 Gate 2 list</sub>
11. [ ] The DMG's build time is in the table above; notarization waits at least 60 minutes from it, and for Jarmo's Gate 1. <sub>release skill</sub>

## Gate 1: Jarmo, macOS arm64

### Start and update

12. [ ] **Install over 2.1.0.** Quit 2.1.0, drag the candidate to Applications, right-click ▸ Open. It starts from `/Applications`. <sub>release skill</sub>
13. [ ] **About.** Help ▸ About reads 2.2.0, names the candidate's commit, Electron 43.8.6 and Node.js 24.22.1. <sub>145-S51, #620</sub>
14. [ ] **Nothing lost.** Your projects, chats and settings are all there after the update. <sub>release-notes.md, Updating</sub>
15. [ ] **A ChatGPT chat from before the update goes on.** Open a 2.1 ChatGPT chat and send a message. Its history is on screen and it answers (ChatGPT starts its own side afresh, once). **AI: ChatGPT** <sub>153 Gate 1 row 2, #660</sub>
16. [ ] **The window opens in its final shape.** Quit and start again a few times, watching. Nothing moves while it starts; the AI column shows once, with no flicker; a waiting slot shows its plain ground, then a small turning mark after about 1 s; no "Loading..." text and no VS Code progress bar. <sub>152, #638, #639</sub>
17. [ ] **The AI column you closed stays closed.** Close the AI column, quit, start again; then Reload Window. It stays closed both times. <sub>152 R6, #632</sub>
18. [ ] **The welcome on a fresh profile.** The welcome shows alone from the first frame, with no places bar or AI column behind it. Open a folder as a project: it lands on Home with Home's and the Task board's tabs. **Fresh** <sub>152 Gate 2 list, #638</sub>
19. [ ] **Switching projects lands on Home, with the AI beside it.** Switch project from the project menu three times, each project left with a document in front. Home shows first, with the AI column, and no document flashes before it. <sub>145-S43, #622</sub>
20. [ ] **No "Git not found".** Start with Git missing (a fresh profile with `git.path` set to a missing file in its settings). No "Git not found" or Download Git notification appears. **Fresh** <sub>#638, #633</sub>

### Documents

21. [ ] **Both changes stay.** In a scratch project, open a Markdown file, type a sentence and let it save. Ask the AI (or run a script from Terminal) to change line 1 from a copy made before your last save. Your sentences and its change are both in the document and the file, with no question; Saved shows; the caret didn't move. **AI**, or a Terminal write <sub>145-S1, #605</sub>
22. [ ] **One Undo takes it back.** After row 21, press ⌘Z once. Only the other app's change goes, as one step. <sub>145-S62, #605</sub>
23. [ ] **You choose when you both changed one paragraph.** Keep typing in the opening paragraph while Claude changes that same paragraph and a later one. The later one takes Claude's text, yours stays in the opening, and **Review changes** shows in the document's bar. Open it: "A paragraph changed in two places" with **Keep mine** (default) and **Use Claude's**; each choice works and the button goes. **AI: Claude** <sub>145-S56, S57, #605</sub>
24. [ ] **Another app, the tab behind.** Do row 23's write from Terminal with the document's tab behind another. A notification says another app saved a copy and yours is kept; its Review changes brings the tab forward with the dialog. <sub>145-S59, #605</sub>
25. [ ] **A whole-file rewrite asks.** Within 30 s of a save, replace the file from Terminal with a rewrite of almost every line. The whole-document question asks, **Keep my version** is the default, no warning icon. <sub>145-S8, #605; release-notes.md, Known issues</sub>
26. [ ] **Comments stand out from search.** In a document with a comment, open the find bar (⌘F) and search a word. Find marks are grey with the current one filled in indigo; the comment stays amber. Light and Dark. <sub>#648</sub>
27. [ ] **A Flow you look at isn't saved.** Open a Flow and click its steps without changing anything. The file's date doesn't change. <sub>145 R4, #607</sub>
28. [ ] **A Flow step without its key.** With no OpenAI or Google key saved (a fresh profile), open a Flow with an AI step and an image step. Each says which key it needs in one sentence; **Add it in Settings** opens Settings at that key. **Fresh** <sub>145 R5, S30–S33, #607</sub>
29. [ ] **A task card Ritemark can't open.** In Terminal, `chmod 000` one card file in the project's tasks folder. The board shows it with one sentence, **Try again** and **Remove**; Remove asks once ("It goes to the Trash…") and moves it to the Trash. Put the file back after. <sub>145 R2, #610</sub>
30. [ ] **A dropped card moves at once.** Drag a card to another column with the mouse. It is there at once; a slow save shows a small turning mark after 1 s. With the tasks folder read-only (`chmod 555`), the card goes back with "Couldn't save …". <sub>145 R3, #610</sub>
31. [ ] **The board's columns.** Scroll a board with one short column. Every column's header stays at the top. <sub>#637, #613</sub>

### The AI and its browser

32. [ ] **A first message with each AI.** In a project, send one message with Claude, one with ChatGPT and one with OpenCode. Each answers. **AI: Claude, ChatGPT; Key: an OpenCode provider key** <sub>release plan, Gates</sub>
33. [ ] **The AI works in the page you gave it, each AI.** Open three browser tabs; give the AI the one not in front, and ask it to click, type and go to another address. Everything lands in that page, and no tab comes to the front. Do it with Claude, ChatGPT and OpenCode. **AI: all three** <sub>153 Gate 1 row 1, #660</sub>
34. [ ] **A page that's gone.** In row 33, close the page the AI was given and ask it to act again. It says the page is no longer open and asks, and no other tab is used. **AI** <sub>#660</sub>
35. [ ] **A failed answer has no green check.** Make a turn fail (pick a model the account can't use, or cut the network mid-answer). Its done card shows in ink, no green. Light and Dark. **AI** <sub>145 R6, #612</sub>
36. [ ] **The ring in the AI column.** With the keyboard (Tab), reach the AI column's first-use notice, the selected-text tab, the continuation notice and the report dialog. Each shows the indigo ring. **AI** <sub>#643</sub>

### Search

37. [ ] **Search from Documents.** In a project you know, type two words in the Search box at the top of Documents. Results show as you type, in the tree's place, grouped as Documents, Chats and Tasks (five each, "Show all N documents"). Clear the box and the tree comes back. <sub>148, #636, #641</sub>
38. [ ] **The kinds it reads.** Search a word that is only inside a Word file, a PDF, a CSV, a chat and a task. Each is found. <sub>148, #636</sub>
39. [ ] **A document opens at the words.** Open a Markdown, a Word and a PDF result. Each opens at the shown passage with the find bar holding the word ("4 of 6"); the PDF at the passage's page; the tab isn't marked edited. <sub>#646</sub>
40. [ ] **A chat opens at the message.** Open a chat result. It opens on the AI's sheet at the matching message. A task result opens as its card. **AI** (a chat to find) <sub>#636</sub>
41. [ ] **Keys only.** ⌘⇧F puts the cursor in the box; ↓ moves into the results; Enter opens the chosen one; Esc goes back to the box, Esc on an empty box goes to the desk. <sub>#636, #641</sub>
42. [ ] **Accents.** Search "kasi" in a project holding both "kasi" and "käsi": both are found, "kasi" first. "käsi" finds only "käsi". <sub>148 spec</sub>
43. [ ] **No results.** Search nonsense. "Nothing in <project> has these words." <sub>#636</sub>
44. [ ] **The first search reads once.** In a large project opened for the first time on 2.2, search at once. Results come while it reads ("Still reading …"); a second search after it finishes is quick. <sub>release-notes.md, Updating; #631</sub>
45. [ ] **Online-only files by name.** In a cloud-synced folder with a file kept only online, search a word inside it and its name. The name is found, the word isn't, and the file isn't downloaded. **OneDrive** (or Google Drive / iCloud) <sub>148 A4, #631</sub>
46. [ ] **Advanced search.** More (⋯) lists **Advanced search**; it opens VS Code's search with that title and Replace in files; View ▸ Advanced search opens it too. <sub>#651</sub>

### Settings and keys

47. [ ] **Six sections.** ⌘, opens Settings at AI accounts. The list reads AI accounts, Appearance, Sharing, Usage data, Updates and Advanced; the tab reads "Settings" with a gear. Narrow the window under 640 px: the list becomes a menu. <sub>147, #644</sub>
48. [ ] **Settings opens at once.** Close and open Settings. It draws at once and each AI's row fills in as it is known, with a turning mark, no "Checking…". <sub>147 R10, #657</sub>
49. [ ] **Each AI at a glance.** Claude, ChatGPT and OpenCode each have one line and one button (Ready, Sign in, Repair…); Details… opens each AI's sheet. **AI** <sub>147, #645</sub>
50. [ ] **Sign in and cancel.** For Claude and for ChatGPT: start Sign in (the browser opens), then Cancel; then sign in for real. Each row follows. Sign out from Details on one and sign back in. **AI: Claude, ChatGPT** <sub>147 I10, I13, I15, I22, I26, #645</sub>
51. [ ] **API keys, the round trip.** Open API keys: OpenAI, Anthropic, Google AI, OpenRouter and ElevenLabs, each Not added or Saved. For each real key: Add, press the eye (it shows, then hides), Test ("it works"), Change, then Remove key (asks once). Put your keys back after. **Key: all five** <sub>147 K, I32–I38, #645, #657</sub>
52. [ ] **Saved keys stay out of the page.** With a key saved, the row reads Saved, not the key; the eye shows it only while pressed; switching away from the Settings tab hides it again. **Key** <sub>#657</sub>
53. [ ] **Settings stays current.** With Settings open, change Text size in All settings, and sign Claude out in a terminal (`claude logout`, then sign in again). Settings shows each change without reopening. **AI: Claude** <sub>147 R9, #657</sub>
54. [ ] **The links.** Get one at Anthropic, Learn more (Claude, ChatGPT) and the Privacy Policy and Terms of Use each open your browser at the right page. <sub>147 I12, I19, I27, I44</sub>
55. [ ] **Your Google account.** Sharing ▸ Your Google account: Connect, then Cancel while the browser is open; then connect, and choose a template for new Google Docs. **Google sign-in** <sub>147 I39, I40</sub>
56. [ ] **Appearance and Advanced.** Pick Dark and Light from the pictures; Text size in chats Smaller, Usual, Larger. Advanced's "Now:" line names the AIs and tools in use. Transcripts' working files shows its size, and Clear empties it. <sub>147 I1, I4, I58, #644, #657</sub>
57. [ ] **The version line.** Settings reads "App 2.2.0 · Extension 2.2.0", not "2.2.0-0". <sub>145 R7, #612</sub>

### Transcribe

58. [ ] **The wrong microphone.** In System Settings ▸ Sound ▸ Input, pick a muted or unused input, and record in Transcribe. The card says "From <that input>"; after about 3 s, "No sound from the microphone. Check the input in System Settings ▸ Sound." (the link opens Sound); the recording goes on. After Stop and use: "No sound was recorded…" with **Record again** as the main button, and nothing is sent to an engine. **Mic** <sub>153 Gate 1 row 3, #661</sub>
59. [ ] **The right microphone, a long name.** Record with a headset whose name is long. "Recording" and the time stay on one line; "From <name>" is cut with … and its tooltip has the whole name; no warning while you speak; the transcript comes. **Mic** <sub>153 Gate 1 row 4, #661</sub>

### Publish a web page

60. [ ] **A web page on the desk.** Open an `.html` file from Documents. It opens as the page, not as code, with the browser's bar (back, forward, reload, the `file:///` address) and **Open in your browser** at its right end. Links to another page in the project open in the same tab, and Back returns. <sub>149-S1, S4a, #670</sub>
61. [ ] **Open in your browser.** Press it. The page opens in your default browser; the tab stays. <sub>149-S2, #670</sub>
62. [ ] **Where the buttons show.** An `.html` file from outside the project (dragged from Downloads) has Open in your browser and no Publish; a website has neither. Without PR 4, no project page shows Publish either. <sub>149-S3, S4, #670</sub>
63. [ ] **The page follows its file.** With the page open, ask the AI to change the file. The page reloads by itself. **AI** <sub>149-S4b</sub>
64. [ ] **Connect Cloudflare.** Settings ▸ Sharing ▸ Web pages: Not set up. Set up opens Cloudflare's token page and Ritemark's own "Cloudflare token" box. A wrong token gets "Cloudflare didn't accept this token…" and the box stays open; the real one connects and the section reads Connected. **PR 4, Cloudflare** <sub>149-S20, #668</sub>
65. [ ] **See exactly what goes.** On a project page with pictures and a stylesheet, press **Publish** ("Get a link anyone can open"). The sheet opens over the dimmed window: "This page and N files", "Nothing else from the project.", See the files lists them, page first; Left out names files outside the project and hidden ones. Esc closes it and nothing is sent. **PR 4** <sub>149-S7, S8, S9, S16, #669, #672</sub>
66. [ ] **A key in a page.** Put a fake-looking key string in the page's script. The sheet says "This looks like a key or password: script.js, line N…", **Cancel** is the main button, Publish reads **Publish anyway**, the value never shows; Open script.js opens it at that line. **PR 4** <sub>149-S14, #669</sub>
67. [ ] **Publish.** Publish (the first time, choose the address name). "Publishing…", then Published with **Copy link**. The link opens the page in a private browser window, from another device too. **PR 4, Cloudflare** <sub>149-S24, S25, S28a, #668</sub>
68. [ ] **Kept out of search engines.** `curl -sI <link>` shows `X-Robots-Tag: noindex`, also for a picture and a missing page. **PR 4, Cloudflare** <sub>149-S24, #668</sub>
69. [ ] **Update the page.** Change the page's words and press **Update the page**. The same link shows the change; a picture added since shows in the sheet first. **PR 4, Cloudflare** <sub>149-S26, S27, #668</sub>
70. [ ] **Unpublish.** Press **Unpublish**; it asks once, with a red Unpublish. After it, the link stops answering, and Publish shows again. Settings ▸ Sharing ▸ Web pages lists the page while it is up, with Open and Unpublish. **PR 4, Cloudflare** <sub>149-S28, R9, #668</sub>
71. [ ] **No network.** Turn Wi-Fi off and press Publish. "Ritemark couldn't reach Cloudflare…" with Try again; the file is unchanged. **PR 4** <sub>149-S29</sub>
72. [ ] **The AI can't publish.** Ask the AI to publish the page. It has no way to; it tells you to press Publish. **PR 4, AI** <sub>149-S31</sub>

### Menus and frame

73. [ ] **See where the keyboard is.** On Home, open Ask with's menu with the mouse and pick an item: no ring. Do it again with Tab and Enter: an indigo ring with a small gap. Same in the PDF viewer's zoom menu and the Share menu. Light and Dark. <sub>146 S1–S6, #618, #642</sub>
74. [ ] **Narrow buttons show their icon.** Narrow the desk until Home's first-day button and Change image can't fit their words. Each shows its icon alone (never "A…"), with the words in its tooltip; widen and the words come back. <sub>146, #637</sub>
75. [ ] **Tooltips look the same.** Hover buttons on Home, Settings and the AI column. Every tooltip has the same surface and hairline, no arrow. Light and Dark. <sub>146, #637</sub>
76. [ ] **File changes without Git.** In a folder with no `.git`, More ▸ File changes says "Git isn't set up in this project." with **Set up Git here**, which works. With Git missing (row 20's profile): "File changes needs Git." with nothing to press. A mouse open shows no outline; Tab to the button does. **Fresh** for the second half <sub>146 S37–S41, #630</sub>
77. [ ] **A tab's menu.** Right-click a document's tab: no Add File to Chat, Open Preview, Reopen Editor With… or Find File References, and **Show in Documents** is there. Home's and the Task board's tabs have no Close, Unpin, Split & Move or Move into New Window. A terminal's and a web page's tab menus are as before. <sub>146 S44, #630, #649</sub>
78. [ ] **The tab row's empty area.** Right-click it: New tab (⌘T) and Reopen closed tab (⇧⌘T) first; no Editor Actions Position ▸, no Tab Bar ▸. With two desks, right-clicking the other desk's empty area makes that desk active. <sub>154 Gate 1 row 1, #664, #649</sub>
79. [ ] **Right-click menus are shorter.** In Documents (a file) and inside a text file: no Add File to Chat, Open Inline Chat or Add Selection to Chat; Send to AI Chat still in Documents'. A folder in Documents still has Add Folder to Chat. A result in Advanced search has no Add File to Chat. No "Copy vscode.dev Link" anywhere. <sub>154 Gate 1 rows 2–3, #664, #649</sub>
80. [ ] **No sparkle beside selected text.** Reopen a Markdown file with the text editor, and open a code file; select text in each. No amber sparkle at the edge; any light bulb is plain. ⌘I still opens Inline Chat, and All commands finds "Inline Chat: Open Inline Chat". <sub>154 PR 2 Gate 1 row, #666</sub>
81. [ ] **Copilot's quick actions can come back.** All settings ▸ search "Copilot code actions": Enable Code Actions is off. Turn it on and the sparkle returns; turn it off again. <sub>release-notes.md, Updating; #666</sub>
82. [ ] **The left column's hovered row.** In a long Documents tree with its scroll thumb showing, hover a row under the thumb. The thumb is one tone over the row; nothing runs under it. <sub>146 S50, #630</sub>
83. [ ] **The comment card in Dark.** In Ritemark Dark, a document with a comment: the marker and card are indigo with light words. <sub>#637</sub>
84. [ ] **#507, ⌘⇧P on Home** (only if it was seen again). Ten presses after a click on Home's title: All commands opens every time. <sub>145-S49</sub>

## Gate 2: macOS x64

The x64 candidate runs on Jarmo's Mac under Rosetta unless an Intel Mac is at hand; the evidence says which.

85. [ ] **Install.** Replace the arm64 app with the x64 DMG's (one Ritemark at a time), right-click ▸ Open, start it with `open --arch x86_64 -a /Applications/Ritemark.app`. Activity Monitor shows Kind **Intel**. <sub>release skill</sub>
86. [ ] **About.** 2.2.0, the candidate's commit, Electron 43.8.6, Node.js 24.22.1. <sub>#620</sub>
87. [ ] **A Claude turn and a ChatGPT turn** each answer. **AI: Claude, ChatGPT** <sub>release plan, Gates</sub>
88. [ ] **OpenCode's permission gate.** Ask OpenCode to write a file: it asks first; Deny writes nothing, Allow writes. **Key: an OpenCode provider key** <sub>release plan, Gates</sub>
89. [ ] **A document and a search.** Open a `.md`, type, format and save: Saved, and the file has the change. Search a word from Documents: results show and open at the words. <sub>148; smoke test</sub>
90. [ ] **A web page.** Open an `.html` file: it shows as the page; Open in your browser works. <sub>#670</sub>
91. [ ] Afterwards the arm64 candidate is back in `/Applications`.

## Gate 2: Windows x64

Ctrl replaces ⌘. File, Edit, View and Help are behind the menu button at the start of the left strip. Every row needs the Windows PC; the Windows session reports row by row through the Development manager. The AI's browser actions (row 33) are Mac-only behind a flag, so they aren't tested here.

### Start and update

92. [ ] **The installer.** Its hash matches the sidecar, whose `source_commit` is the candidate's; Properties ▸ Digital Signatures shows Productory Services OÜ; it says 2.2.0. Record any SmartScreen warning. <sub>release skill</sub>
93. [ ] **About.** 2.2.0, the commit, Electron 43.8.6, Node.js 24.22.1. A terminal opens, a setting is kept, the browser opens a page; `exthost.log` has no built-in extension failing. <sub>145-S51, #620</sub>
94. [ ] **A cold first start after install.** On a profile that never ran Ritemark: the welcome alone from the first frame, plain ground until it opens, no places bar or AI column. Sign in to an AI and open a folder: Home with Home's and the Task board's tabs. **Fresh, AI** <sub>152 Gate 2 list, #638</sub>
95. [ ] **The update from 2.1.0.** Install over 2.1.0 with a lived-in profile left on Home. Home is chosen in the places row from the first frame, the AI column is there, nothing moves; projects, chats and settings are kept. <sub>152 Gate 2 list, #638</sub>
96. [ ] **The first start after Ritemark 1.** A 1.14.0 install with a terminal open at quit, updated with the candidate. No terminal is in front of the welcome; the terminal waits behind it. <sub>145-S46, #622, #501</sub>
97. [ ] **A slow start.** On the first start after the install: a turning mark at about 1 s, and after 10 s "Ritemark is still starting. The first start after an install or an update takes longer."; no "Extension host did not start" notification. <sub>#639</sub>
98. [ ] **A new folder, a switch, a reload.** Open Recent into a folder never opened: Home and the Task board's tabs from the first frame. Switch project twice: Home first, the AI column beside it. Reload Window with a terminal on the desk: its tab is named from the first frame. `renderer.log` has no `[ritemark] slot released:` line. <sub>152 Gate 2 list, 145-S43, #622, #638</sub>
99. [ ] **Quitting stops the helpers.** With ChatGPT as the AI on a fresh profile, close the window while ChatGPT is starting. Task Manager shows no `codex`, `opencode` or `git.exe` left, and its folder can be removed at once. **Fresh, AI: ChatGPT** <sub>#629, #619</sub>

### Documents

100. [ ] **Both changes stay, ten times.** Row 21 with a PowerShell write, ten times: both changes kept every time, no silent loss; row 23's shared paragraph raises Review changes. **AI**, or a PowerShell write <sub>145-S1, S56, #605</sub>
101. [ ] **The Task board.** A card file locked by another program: Try again and Remove, the question and the result say Recycle Bin. A dragged card moves at once. <sub>145 R2, R3, #610</sub>
102. [ ] **Search.** The Search box, the results in the tree's place and back, at 100%, 125% and 150%. Markdown, Word and PDF results open at the passage. Tooltips show Windows paths (`c:\…`). <sub>148 PR 3 Gate 2, #636, #641, #646</sub>
103. [ ] **OneDrive.** In a OneDrive project, search a word inside a file and its name. Files are found by name only, and nothing downloads. **OneDrive** <sub>148 tasks; release-notes.md, Known issues</sub>
104. [ ] **Comments and find marks**, Light and Dark: grey find marks, amber comments. <sub>#648</sub>

### Settings, keys and the AI

105. [ ] **Settings opens at once.** Open Settings on a lived-in, signed-in profile. It draws at once; `exthost.log` has a line `settings: drawn <ms>, filled <ms>, slowest <step> <ms>`; record it (2.1 took about 13 s). **AI** <sub>147 tasks, #657, #593</sub>
106. [ ] **API keys, the round trip** for one key: Add, the eye, Test, Change, Remove key. **Key** <sub>#657</sub>
107. [ ] **Each AI answers.** A Claude turn; a ChatGPT turn whose sandbox commands run; OpenCode's permission gate (Deny writes nothing, Allow writes). **AI: Claude, ChatGPT; Key: OpenCode** <sub>release plan, Gates</sub>

### Transcribe

108. [ ] **The silent microphone.** Record with a muted input. The line says "Settings ▸ System ▸ Sound", and the link opens Sound settings. **Mic** <sub>#661</sub>

### Publish a web page

109. [ ] **A web page on the desk.** Open an `.html` file: it shows as the page; Open in your browser opens it in the default browser. <sub>149 PR 2 Gate 2, #670</sub>
110. [ ] **The Publish sheet.** On a project page, Publish's sheet opens centred over the dimmed window, lists the files with Windows paths, and Esc closes it. **PR 4** <sub>149-S11, #669, #672</sub>
111. [ ] **Publish, Copy link, Unpublish** with the test account. **PR 4, Cloudflare** (only if the Windows vault exists; else "not run") <sub>149 Windows</sub>

### Menus and frame

112. [ ] **No Git on the PC.** A PC without Git, a folder with `.git`: no "Git not found" notification; File changes says "File changes needs Git.". With Git installed and no `.git`: "Git isn't set up in this project." and Set up Git here works. <sub>146-S43, #630, #638</sub>
113. [ ] **A tab's menu**, Light and Dark: as row 77. <sub>146-S47, #630</sub>
114. [ ] **The hovered row** under the scroll thumb at 100%, 125% and 150%. <sub>146 PR 4 Gate 2, #630</sub>
115. [ ] **The keyboard ring, a real mouse and keyboard**, at 100% and 150%: a mouse pick leaves no ring; Tab after it shows one; Escape and a keyboard pick show one; Alt alone changes nothing. The control catalogue by eye, Light and Dark. <sub>146-S21, #618, #621, #642</sub>
116. [ ] **Right-click menus and the sparkle.** Rows 78–80 on Windows; Ctrl+I opens Inline Chat. <sub>#664, #666</sub>
117. [ ] **Ctrl+Shift+P on Home, a real keyboard.** Ten presses each: after a click on Home's title; after Tab to a control; in the line's input; after Home redraws; after coming back from the Task board; and Ctrl+P and Ctrl+, after the first. All commands, Quick Open and Settings open every time; a failure is written down with its case. <sub>145-S48, #507</sub>
118. [ ] **The frame.** Where the Windows session can run them, `frame-screenshots.mjs` against `release-win32/` with JOINS ok; otherwise screenshots compared by eye with 2.1's Windows round. <sub>frame-baseline/README.md</sub>

## After publication

- [ ] The feed is made with `--existing-feed-url` naming v2.1.0's feed, and every published asset matches `dist/`.
- [ ] On the live feed, 2.1.0 is offered 2.2.0 on the Mac (Download Installer) and on Windows from our download; the Store gets its update (Submit needs Jarmo's word).
- [ ] Issues closed with the candidate's evidence: #588, #569, #501, #593, #567, #568, #594 (their Windows rows passed), #515 (About read Node 24.22.1); #507 by row 117; #591 stays open for the meaning layer.

## Unclear

- **The reference images.** No commit since 2.0 retakes `docs/development/frame-baseline/` under the isolated launch rule, though the release plan expected 2.1's closeout to do it. Row 5 makes it the release session's step before the compare; if Jarmo prefers, the old set is compared and its AI-sheet differences approved instead.
- **Publish before PR 4.** Sheet, gather and key scan (#669, #672) are on `main` but can't be reached without PR 4 (#668), so rows 65–66 and 110 are marked PR 4 though their code merged.
- **#668's page-bar states.** PR 4 registers Copy link, Update the page and Unpublish, but #670 as merged draws only Open in your browser and Publish on the bar. Where Copy link and Update the page show isn't settled in the PRs; rows 67–70 follow the scenarios.
- **The Windows live Publish run** needs the Windows test-key vault, which isn't written; row 111 is "not run" until it is.
- **#673:** ⌘W, ⌃` and ⌘J still act behind the Publish sheet through the Mac's menu bar (known, follow-up).
- **#593's 13 s** was never reproduced on a clean profile; row 105 uses a lived-in, signed-in one.
- **Search speed on Windows** misses the plan's targets on a 10,821-document folder (cold about 28.6 s against 15 s; #655). Not a row; it is the record if row 102 feels slow.
- **Sprint 147's A2 re-run** (a ChatGPT sign-in made in a terminal shows in Settings without restarting its server) isn't recorded as done; row 53 checks Claude's.
- **145-S9** (what each AI's own edit tool does when the file changed under it) was never run with signed-in AIs; rows 21–23 cover the result, not the audit.
- **"The AI couldn't start"** (#632) waits for the Experience lead's words; there is no row for it.
- **#660's browser tools** are Mac-only behind `browser-agent-control`; Windows has no AI-browser row.

## Deferred in writing

| Row | Why | Jarmo's words, date |
|---|---|---|
| | | |

## Sign-off

| Gate | Platform | Artifact (SHA-256 as tested) | Technical (agent) | Jarmo | Notarized + stapled |
|---|---|---|---|---|---|
| Gate 1 | macOS arm64 | | | | |
| Gate 2 | macOS x64 | | | | |
| Gate 2 | Windows x64 | | | | n/a |
| Publish | All three, one publication | | | | — |

**Gate 1 verdict:**
**Gate 2 verdict:**
