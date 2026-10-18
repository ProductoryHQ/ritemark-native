# Sprint 134 Tasks

Nothing here starts before Jarmo approves the sprint plan, and not before Sprint 133 is merged. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [ ] Sprint 133 is on `origin/main`
- [ ] `git checkout -b sprint-134-project-at-the-centre` from `origin/main`; `git branch --show-current` shows it
- [ ] VS Code at the pin with every patch from reset + clean + apply (copy-on-write clone for the worktree)
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] The test projects of `scenarios.md` made in a scratch folder, and a v1.14.0 profile with chats and boards in several projects

## Phase 1: Audits first

- [ ] `research/waiting-audit.md` (W3, R3, R6): another project's calls through `deriveWho` with its hand-off records; chats from `index.json` with live owners; the cost with 20 projects
- [ ] `research/first-fill-audit.md` (W2, R2): the three sources, the boards found only through a known folder, VS Code's own record of opened folders as a read-only extra
- [ ] `research/switch-audit.md` (W8, R9): what "the AI is working" means and where it is known; Ritemark's switch paths; VS Code's own Open Folder and Open Recent
- [ ] `research/splash-audit.md` (W8, R9): `partsSplash.ts`'s colours; the ground in Light and Dark; a v1.14.0 profile's stored splash
- [ ] `research/about-file-audit.md` (W7, R8): where a file's name is drawn (menu, tab, Documents, Home, the AI sheet) and how each says About this project; how Documents hides only the pointer-only `CLAUDE.md`; the book-open icon and the tooltip on the tab and the Documents row
- [ ] `research/confirmations.md`: `ritemarkMenu.ts` and a submenu; `revealFileInOS` on Windows; opening the AI's new chat from Home; `BoardStore` writing nothing until the first card
- [ ] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol)

## Phase 2: The projects subsystem (W1, W2, W3)

- [ ] `src/projects/projectFile.ts` + test (R1)
- [ ] The sample project's `.ritemark/project.json` with its line, in the Experience lead's words (R1)
- [ ] `media/home/cover.jpg` and the Home tab icons as image files (E4)
- [ ] `src/projects/ProjectList.ts` + test (R2)
- [ ] `src/projects/firstFill.ts` + test, once per profile (R2)
- [ ] `src/projects/waiting.ts` + test (R3)
- [ ] `src/projects/protocol.ts` + test (E2)
- [ ] `extension.ts`: `ProjectList.opened` on every activation with a folder; the first fill
- [ ] 019: the Tasks tab's count from the Tasks place's badge, up to "99+", in the accessible name; its VS Code unit test (R6)

## Phase 3: Home and the permanent tabs (W4, W5)

- [ ] `src/views/HomePanel.ts`: the panel in the shared bundle, serializer, `onWebviewPanel:ritemark.home`, the cover's resource root (R4)
- [ ] `webview/src/main.tsx`: the `home` and `projects` roots
- [ ] `webview/src/components/home/`: `HomePage`, `ProjectCover`, `WaitingList`, `StartSomething`, `LastChanged`, `WhatMovedCard` (R4, R11, R13)
- [ ] Home's redraws: the board, chats' lifecycle, files, shown (R4)
- [ ] Home's actions: Documents, the line, Change image, a waiting item, Start something, a recent document, Got it (R4, R11)
- [ ] The empty project's state and its drop target, copying in (R13)
- [ ] `src/views/permanentTabs.ts` + test: open, pin, Home first, return to the person's tab; Home alone with the board flag off (R5)
- [ ] `ritemark.openHome`; the Home place clicked, and clicked again, brings Home forward (R5)
- [ ] The board opened only through the permanent tabs (R5)
- [ ] Sprint 133's landing opens Home first (R10)

## Phase 4: The list, the head, switching (W6, W7, W8)

- [ ] `src/views/ProjectsViewProvider.ts` in the `ritemark.homeView` slot: rows, counts, Not found rows, search, Add a project…, ⌥ click (R7, R13)
- [ ] Home's not-found box, Find it… at the nearest existing parent, another project's folder refused (R13)
- [ ] `ritemark/projectHead`: Switch project ▸, Open a folder… through the switch, Reveal, About this project (R8)
- [ ] `src/projects/aboutFile.ts` + test: open `AGENTS.md`, or ask and create it with the one-line `CLAUDE.md`; never over an existing `CLAUDE.md` or `AGENTS.md`; the note with Add the line and Not now for a folder's own `CLAUDE.md`; pointer-only recognised (R8)
- [ ] The file shown as About this project in the menu, its tab, Documents and Home, with the book-open icon and the tooltip "AGENTS.md, read by Claude and ChatGPT", per the about-file audit; Ritemark's pointer-only `CLAUDE.md` hidden in Documents (R8)
- [ ] 018: `ritemarkMenu.ts` draws an extension-supplied submenu (`ritemark.projects.switcherItems`) (R8)
- [ ] 018: `ritemark/fileMenu` mapped to the File menu; the extension contributes Switch project (R8)
- [ ] `src/projects/switchProject.ts` + test: the dialog (Cancel, Switch and stop, Open in a new window), Switch and stop as Stop, the switch, the "Switched to…" note with Go back (R9)
- [ ] VS Code's own Open Folder and Open Recent as the switch audit decided (R9)
- [ ] 018 (and 001's dark default if kept): the splash in the ground's colour (R9)

## Phase 5: The document's bar, and removing the launcher (W9, W6)

- [ ] `DocumentHeader.tsx`: Saved from `document:sync-state`; test (R12)
- [ ] `ExportMenu.tsx` → Share as experience 26's frame 1, with today's handlers and every Google Docs state; test (R12)
- [ ] R14's table checked row by row on the branch (S40)
- [ ] `HomeViewProvider.ts` and its test deleted; `home-launcher` set to `disabled` with a tombstone in `flags.ts`; its `package.json` entries tidied (R14)

## Phase 6: QA, merge and closeout

- [ ] CDP checks in `scripts/qa/`: the permanent tabs, the Tasks tab's count, switching, the splash (E3)
- [ ] The screenshot baseline gains Home, the list, the switcher and What moved, light and dark (E3)
- [ ] `media/webview.js` measured after; `notes/bundle.md` (E4)
- [ ] Docs: `architecture.md` (Projects), `references/layout-invariants.md`, `CLAUDE.md`'s patch descriptions, `update-vscode.sh`'s checklist line (E6)
- [ ] Manual QA on the Mac: S1–S40, S43, S44; evidence in `qa-evidence.md`
- [ ] Windows overlay round before the merge: S41 on the extension side
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; screenshots to the Experience lead; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree at the merged commit (E5)
- [ ] After the merge: Windows round from main: S41, S42, S29, the splash and the Tasks tab's count; findings in `qa-evidence.md`
- [ ] After the merge: the drift check into the release plan (E7)
- [ ] `docs/CHANGELOG.md` and the v2.0.0 release-notes draft
- [ ] Release plan: tracker, feature-complete rows (Home's launcher in the "everything reachable" list) and risk register updated
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
