# Sprint 134 Tasks

Nothing here starts before Jarmo approves the sprint plan, and not before Sprint 133 is merged. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [x] Sprint 133 is on `origin/main` (`eae1dedd`, #453)
- [x] `git checkout -b sprint-134-project-at-the-centre` from `origin/main`; `git branch --show-current` shows it (2026-10-19, with #462's plan merged in)
- [x] VS Code at the pin with every patch from reset + clean + apply (copy-on-write clone for the worktree): 18 applied, a second run clean, `transpile-client` done
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [x] The test projects of `scenarios.md` made in a scratch folder, and a v1.14.0 profile with chats and boards in several projects

## Phase 1: Audits first

- [x] `research/waiting-audit.md` (W3, R3, R6): another project's calls through `deriveWho` with its hand-off records; chats from `index.json` with live owners; the cost with 20 projects
- [x] `research/first-fill-audit.md` (W2, R2): the three sources, the boards found only through a known folder, VS Code's own record of opened folders as a read-only extra
- [x] `research/switch-audit.md` (W8, R9): what "the AI is working" means and where it is known; Ritemark's switch paths; VS Code's own Open Folder and Open Recent
- [x] `research/splash-audit.md` (W8, R9): `partsSplash.ts`'s colours; the ground in Light and Dark; a v1.14.0 profile's stored splash
- [x] `research/about-file-audit.md` (W7, R8): where a file's name is drawn (menu, tab, Documents, Home, the AI sheet) and how each says About this project; how Documents hides only the pointer-only `CLAUDE.md`; the book-open icon and the tooltip on the tab and the Documents row
- [x] `research/share-question-audit.md` (W14, R20): every path that opens upstream's share dialog and which go through the sheet; 009's bridge and the stored "Don't ask again"; when the host polls, so the question is never asked unseen
- [x] `research/palette-audit.md` (W15, R21): every All commands entry by category; the list of command IDs to drop, written into the technical plan's W15 table; the kept ones by spec R21's rule
- [x] `research/codex-strings-audit.md` (W16, R22), after Sprint 133 merges: every user-visible "Codex" string, with its file and line, where it is read, its words now and after; what stays listed apart (keys, IDs, identifiers, log lines, model names, the runtime's own text); its search kept for QA
- [x] `research/confirmations.md`: `ritemarkMenu.ts` and a submenu; `revealFileInOS` on Windows; opening the AI's new chat from Home; `BoardStore` writing nothing until the first card; how 018's head takes a place's rows and what happens to a view's title-row actions under it; what ⌘T and Ctrl+T run today; every recursive `mkdir` under a project besides Flows' storage; opening a PDF in Preview on the Mac and in its default app on Windows, and that item's words on Windows, checked with the Experience lead; `workbench.action.openSettings` opening VS Code's settings
- [x] The refresh's design questions on Transcribe's settings button and on Share on a PDF and a Word file, answered by the Experience lead on 19 October (spec, Resolved Questions)
- [x] The refresh's design question on rows under Browser's head answered by the Experience lead (spec, Open Questions)
- [x] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol)

## Phase 2: The projects subsystem (W1, W2, W3)

- [x] `src/projects/projectFile.ts` + test (R1)
- [x] The sample project's `.ritemark/project.json` with its line, in the Experience lead's words (R1)
- [x] `media/home/cover.jpg` and the Home tab icons as image files (E4)
- [x] `src/projects/ProjectList.ts` + test (R2)
- [x] `src/projects/firstFill.ts` + test, once per profile (R2)
- [x] The chat store's read marker: in each record and in `index.json`, set when a chat is in front on a shown sheet, absent on older records (read); store tests (R3, Jarmo's answer of 19 October)
- [x] `src/projects/waiting.ts` + test, with unread replies and a card's chat counted once (R3, S62)
- [x] `src/projects/protocol.ts` + test (E2)
- [x] `extension.ts`: `ProjectList.opened` on every activation with a folder; the first fill
- [x] The welcome's update sheet and "Where do you want to start?" sheet read the project list (R2, S54)
- [x] 019: the Tasks tab's count from the Tasks place's badge, up to "99+", in the accessible name; its VS Code unit test (R6)

## Phase 3: Home and the permanent tabs (W4, W5)

- [x] `src/views/HomePanel.ts`: the panel in the shared bundle, serializer, `onWebviewPanel:ritemark.home`, the cover's resource root (R4)
- [x] `webview/src/main.tsx`: the `home` and `projects` roots
- [x] `webview/src/components/home/`: `HomePage`, `ProjectCover`, `WaitingList`, `StartSomething`, `LastChanged`, `WhatMovedCard` (R4, R11, R13)
- [x] Home's redraws: the board, chats' lifecycle, files, shown (R4)
- [x] Home's actions: Documents, the line, Change image, a waiting item, Start something, a recent document, Got it (R4, R11)
- [x] The empty project's state and its drop target, copying in (R13)
- [x] `src/views/permanentTabs.ts` + test: open, pin, Home first, return to the person's tab; Home alone with the board flag off (R5)
- [x] `ritemark.openHome`; the Home place clicked, and clicked again, brings Home forward (R5)
- [x] The board opened only through the permanent tabs (R5)
- [x] Sprint 133's landing opens Home first (R10)

## Phase 4: The list, the head, switching (W6, W7, W8)

- [x] `src/views/ProjectsViewProvider.ts` in the `ritemark.homeView` slot: rows, counts, Not found rows, search, Add a project…, ⌥ click (R7, R13)
- [x] Home's not-found box, Find it… at the nearest existing parent, another project's folder refused (R13)
- [x] `ritemark/projectHead`: Switch project ▸, Open a folder… through the switch, Reveal, About this project (R8)
- [x] `src/projects/aboutFile.ts` + test: open `AGENTS.md`, or ask and create it with the one-line `CLAUDE.md`; never over an existing `CLAUDE.md` or `AGENTS.md`; the note with Add the line and Not now for a folder's own `CLAUDE.md`; pointer-only recognised (R8)
- [x] The file shown as About this project in the menu, its tab, Documents and Home, with the book-open icon and the tooltip "AGENTS.md, read by Claude and ChatGPT", per the about-file audit; Ritemark's pointer-only `CLAUDE.md` hidden in Documents (R8)
- [x] 018: `ritemarkMenu.ts` draws an extension-supplied submenu (`ritemark.projects.switcherItems`) (R8)
- [x] 018: `ritemark/fileMenu` mapped to the File menu; the extension contributes New tab (⌘T, Ctrl+T), Switch project and Share (R8, S29, S52)
- [x] `src/projects/switchProject.ts` + test: the dialog (Cancel, Switch and stop, Open in a new window), Switch and stop as Stop, the switch, the "Switched to…" note with Go back (R9)
- [x] VS Code's own Open Folder and Open Recent as the switch audit decided (R9)
- [x] 018 (and 001's dark default if kept): the splash in the ground's colour (R9)

## Phase 4b: The other places' heads (W12)

- [x] 018: `HEAD_PLACES` takes Tasks, Browser and Transcribe, with each place's rows from the extension (R16)
- [x] Tasks: New task and Search rows; the list in the order work moves, a call first and marked in its stage, Archived inside Done; test (R17)
- [x] Transcribe: Record and Transcribe a file… as rows; "Recordings" in place of "Library"; the settings gear at the right of the Recordings label, with the tooltip "Transcribe settings" (R16)
- [x] Browser: New page under the head; the Recent label with Clear history; 32-high rows with the site's icon, title and domain; "No pages yet"; `view/title`'s two entries removed once the page has them (R18, the Experience lead's answer of 19 October)
- [x] `FlowStorage` and any other recursive `mkdir` under a project: a gone folder stays gone; test (R13, S53)

## Phase 5: The document's bar, and removing the launcher (W9, W6)

- [x] `DocumentHeader.tsx`: Saved from `document:sync-state`; test (R12)
- [x] `ExportMenu.tsx` → Share as experience 26's frame 1, with today's handlers and every Google Docs state; test (R12)
- [x] The PDF and Word bars: Make an editable copy; Share with Show in Finder (Show in File Explorer on Windows), and Open in Preview or Open in Word; no Export or Google Docs; test (R19, W13)
- [x] R14's table checked row by row on the branch (S40)
- [x] `HomeViewProvider.ts` and its test deleted; `home-launcher` set to `disabled` with a tombstone in `flags.ts`; its `package.json` entries tidied (R14)

## Phase 5b: Jarmo's 19 October additions (W14–W18)

- [x] 009: the share bridge takes the person's answer and opens no dialog; the stored "Don't ask again" honoured (R20)
- [x] `BrowserContextStore` and `UnifiedViewProvider`: the question posted to the sheet, the answer to the bridge, a question withdrawn when its page leaves the front; the messages in `agentSidebarProtocol.ts`; `BrowserContextStore.test.ts` (R20)
- [x] `ShareQuestionCard.tsx` above the message box, as experience 28's frame 1; its webview test (R20)
- [x] 003: the palette skips the audit's IDs and prefixes; its VS Code unit test (R21)
- [x] The copy pass, file by file from the Codex audit: words only; tests' expected words updated; the audit's search run again (R22)
- [x] Ritemark Settings: Advanced settings at the foot, with its tooltip, running `workbench.action.openSettings`; its test; the Settings page check green (R23)
- [x] Agents: the chosen colour on the row's icon, a guessed one not drawn; the eight colours in `package.json` for Light and Dark; the contrast test; the row data's test (R24)

## Phase 6: QA, merge and closeout

- [x] CDP checks in `scripts/qa/`: the permanent tabs, the Tasks tab's count, switching, the splash, the tab row while the share question waits (E3) — `project-check.mjs`; the heads in `frame-geometry.mjs`
- [x] `frame-geometry.mjs` measures the head on Tasks, Browser and Transcribe (E3)
- [x] The screenshot baseline gains Home, the list, the switcher, What moved, the three places with their heads, the share question, Settings' foot and a coloured agent, light and dark (E3) — What moved is not a scene (it needs a Ritemark 1 profile; S35's screenshot is in `qa-evidence/`); Jarmo approved the set of 34 on 19 October
- [x] `media/webview.js` measured after; `notes/bundle.md` (E4)
- [x] Docs: `architecture.md` (Projects; the browser's share question), `references/layout-invariants.md`, `CLAUDE.md`'s patch descriptions for 003, 009, 018 and 019, `update-vscode.sh`'s checklist lines (E6)
- [x] Manual QA on the Mac: S1–S40, S43–S62; evidence in `qa-evidence.md`
- [ ] Windows overlay round before the merge: S41 on the extension side
- [x] `./scripts/validate-qa.sh`; the pre-commit validator by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened ([#467](https://github.com/ProductoryHQ/ritemark-native/pull/467), done); `qa-validator` review (done, two findings fixed); screenshots to the Experience lead (done, approved); the Development manager's smoke test; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree at the merged commit (E5)
- [ ] After the merge: Windows round from main: S41, S42, S29, S52, S58, the splash and the Tasks tab's count; findings in `qa-evidence.md`
- [ ] Linked issues closed with evidence: [#455](https://github.com/ProductoryHQ/ritemark-native/issues/455), [#456](https://github.com/ProductoryHQ/ritemark-native/issues/456)
- [ ] After the merge: the drift check into the release plan (E7)
- [x] `docs/CHANGELOG.md` and the v2.0.0 release-notes draft
- [x] Release plan: tracker, feature-complete rows (Home's launcher in the "everything reachable" list) and risk register updated
- [x] The [v1.14 parity list](../parity-v1.14.md): every Sprint 134 row checked on the branch and marked done
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
