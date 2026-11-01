# Sprint 152 Technical Plan

The design and its reasons are in [the proposal](../../../analysis/2026-11-01-startup-contract.md). This file is how it is
built. R numbers are in [spec.md](spec.md); A numbers are the audits below.

## What exists today

Read for this plan on `6d082c96`, with VS Code's files read in the main checkout's `vscode/`; nothing was run.

- **VS Code scans the extensions after the first frame.** `nativeExtensionService.ts:137–142` waits for
  `LifecyclePhase.Ready` and then a window idle before it initializes, and the scanner starts in `_doResolveExtensions`.
  So the extension's contributions (containers, commands, menus, defaults, themes) exist only from
  `whenInstalledExtensionsRegistered()`. Sprint 145's head rows wait for exactly that.
- **VS Code keeps the last session in six places:** the parts splash (`partsSplash.ts`, colours and `layoutInfo`
  widths, drawn before the workbench), the layout state per workspace, the places row's placeholders
  (`paneCompositeBar.ts`: `cachedViewContainers`, `workbench.activity.placeholderViewlets`), the themes
  (`colorThemeData`, the icon themes' stored data), the extensions' configuration defaults (`DefaultConfiguration`'s
  cache, `DefaultOverridesCacheExists`), and each restored editor's serialized name.
- **product.json is read at the first frame.** Patch 013 registers `product.configurationDefaults` in
  `DefaultConfiguration`'s constructor; `apply-patches.sh` copies `branding/product.json` whole into `vscode/`, so a new
  block reaches the build as is.
- **The shell already holds Ritemark's frame in pieces:** 002's `RITEMARK_PLACE_ORDERS` (`viewsExtensionPoint.ts`) and
  `workbench.view.extension.ritemark-ai` (`layout.ts`, `paneCompositePart.ts`); 018's `HEAD_PLACES`
  (`ritemarkProjectHead.ts`), `WELCOME_VIEW_TYPE` (`ritemarkWelcomeAlone.ts`) and the landing (`ritemarkSwitchGuard.ts`,
  `editorPart.ts`); 019's `RITEMARK_PERMANENT_VIEW_TYPES` (`editorGroupView.ts`) and the terminal wait
  (`ritemarkTerminalTabs.ts`, `RITEMARK_RESTORED_TERMINALS_WAIT_MS`).
- **The extension's start:** `activationEvents` has `*`. In a project window it calls `ritemark.unifiedView.focus` at
  activation (`extension.ts:802`) and after 4 s (`:378–382`); `permanentTabs.ts` opens Home and the board and, in a window
  that had no tab, Home's place (`:135`); `welcomeHost.ts:382–390` makes the welcome alone and closes both columns. Home
  and the board have webview serializers since 2.0 (`projectsHost.ts:205`, `taskBoardHost.ts:304`).
- **The AI view's in-between:** `AISidebar.tsx` draws a not-ready card ("Preparing Agent Chat…", lines 291–321) until
  `agent:bootstrap` arrives, and the chat while `setupStatus` is unknown, before `sidebarView` becomes `onboarding`.
- **VS Code runs the bundled extension whenever its version is the same or newer** than the user folder's copy
  (`extensionsUtil.ts`, `dedupExtensions`), so an extension older than its shell doesn't normally run.
- **The checks to build on:** `project-check.mjs --measure` samples every 50 ms from a new window's first moment and
  prints the workbench's marks; `frame-screenshots.mjs --compare` and `frame-geometry.mjs` hold the settled frame;
  `release-extension-preflight.sh` already diffs against the last shell-release tag (`--ref`).

## Architecture overview

```
branding/product.json ──► ritemarkFrame block (data: places, head rows, AI column, permanent tabs, desk front, welcome)
                                │ read at frame one through `product`
                                ▼
002  ritemarkFrame.ts (reader, placement) ──► viewsExtensionPoint.ts (place order), layout.ts (AI column, Home's place,
                                │                                       the welcome alone's columns), paneCompositePart.ts
                                ▼
018  ritemarkSlots.ts (reserve / fill / release, the log line, the loading look)
        ├─ ritemarkProjectHead.ts (head rows)        ├─ webviewViewPane.ts (the AI column's view)
        ├─ editorPart.ts + ritemarkSwitchGuard.ts (the desk's front: a switch, a new project)
        ├─ ritemarkWelcomeAlone.ts (the welcome alone at frame one)   └─ paneCompositeBar.ts (placeholders, R9)
019  ritemarkTerminalTabs.ts (restored terminals behind the front slot), ritemarkEmptyDesk.ts (no tiles while it waits),
     editorGroupView.ts (permanent tabs from the manifest)

extension ── fills the slots: its containers, commands, views, pages; #624's AI view draws once
scripts  ── release-extension-preflight.sh (the extension against the manifest at --ref), validate-build-output.sh
            (the block in the built app), project-check.mjs --first-frame (the four starts)
```

Each consumer stays in the patch that owns its kind. Patches apply in number order, so 018 and 019 may import 002's
reader, never the other way. If an audit finds a consumer can't read `product` where it needs it, the reader keeps the
same API and holds the data as a TypeScript table in 002 instead (the proposal's fallback).

## Phase 1: audits

Each writes `research/<name>.md` before the code it gates. Every launch is a hidden dev instance (`open -n -g -j`), one
per check, with `--use-mock-keychain`, scratch AI homes, a short profile under `/private/tmp`, and a CDP port checked to
be free. A held extension host's inspector is checked to be a child of that instance (145's S47 notes).

- **A1, the inventory seen** (`research/first-frames.md`; R3, R4, R6, R9; rows 4, 5, 11, 13, 14, 16, 17): the four
  starts on `main` with the extension host held for 10 s, then let go, captured every 50 ms with the workbench's marks,
  in Light and Dark. For each *read* row: seen or not, when, and what it looked like. It confirms R1's list of
  frame-shaping settings (which of them change the first frame of a new profile). It is the failing set for R8.
- **A2, the extensions read on a cold Windows start** (`research/windows-marks.md`): by the "Ritemark on Windows"
  session, on the installed 2.1.0: a cold start after a reboot and a warm one, with `code/didStartWorkbench`,
  `code/didRemovePartsSplash`, `code/didLoadExtensions` and Ritemark's activation from the workbench's startup
  performance marks. It sets how long a released slot can wait on Windows.
- **A3, the desk's front before Ritemark starts** (`research/desk-front.md`; R3): can the editor part put Home's and the
  board's tabs in a new project's grid as if restored, for their serializers to bring back once Ritemark starts? What
  does VS Code do with a restored webview whose serializer never registers (an older extension, a failed start)? It
  chooses between those tabs and the plain-desk fallback.
- **A4, the AI view's starts** (`research/ai-view-start.md`; R5): what the view draws from its load to its settled
  look, signed in and not, for each AI; which message decides the look; whether the host can send it in
  `agent:bootstrap`; which component draws the turning mark in the webview.

When an audit changes a requirement or the tier, `spec.md` and the sprint plan's tier line change first.

## Workstream 1: the first-frame check (R8, PR 1)

- `project-check.mjs --first-frame`: reuse `--measure`'s sampler and its CDP session; add the boxes (`getBoundingClientRect`
  of the parts and of the places row's, the head's and the tab row's items, by their existing classes) and the active
  editor. Compare the first laid-out sample with the settled one; print each moved box.
- The four starts (spec, *The four starts*) as options of the same script, each started by the existing launch notes;
  the held extension host is let go over its inspector (`Runtime.runIfWaitingForDebugger`), as in S47.
- Five runs per start on `main` before it gates; the result is A1's failing set.
- The `release` skill's Gate 1 frame step and layout-invariants.md's *When patching layout* name it.

## Workstream 2: the AI column draws once (R5, PR 1)

- From A4: the view keeps a single "starting" state until the first answer that decides chat or sign-in, and draws only
  the turning mark in it, at the column's centre, where the shell's mark was.
- The not-ready card goes from a normal start; its error branch keeps a card in the Experience lead's words, with Try
  again.
- No new message type. If the host has to say more in `agent:bootstrap`, it is a field the webview reads when present.
- Webview tests: the view draws neither the chat nor the sign-in before the deciding answer; the two orders of answers.
  Bundle size in `notes/bundle.md`.

## Workstream 3: the AI column at start (R6, PR 1)

By Jarmo's answer to decision 2. Recommended: the two start-time `ritemark.unifiedView.focus` calls (`extension.ts:378–382`,
`:802`) don't open a column the layout restored closed; A1 says whether they are still needed for anything else (their
comment names the terminal taking the focus). Otherwise: the calls stay, and PR 2's `layout.ts` shows the AI column at
the first frame of every project window.

## Workstream 4: the manifest and the slot (R1, PR 2)

- `branding/product.json`: the `ritemarkFrame` block, and the frame-shaping settings in `configurationDefaults`.
- 002: `ritemarkFrame.ts`, the typed reader (no block, unknown keys); the place order and the AI column's id read it.
- 018: `ritemarkSlots.ts`: a slot has a name, a kind (contribution or content), a box, and three states; it releases a
  contribution slot at `whenInstalledExtensionsRegistered()` and a content slot on a failed activation or after 60 s,
  and logs each release once. The loading look (the ground, the mark after 1 s) is the slot's, given per slot.
- `validate-build-output.sh`: the block is in the built app's `product.json`.
- Unit tests for the reader and the slot.

## Workstream 5: Sprint 145's four on the slot (R2, PR 2)

- `layout.ts` (002): the AI column restored from the manifest; closing it again is its release.
- `ritemarkSwitchGuard.ts` and `editorPart.ts` (018): the note as it is; the decision goes through the desk's front slot.
- `ritemarkTerminalTabs.ts` (019): restored terminals wait for the front slot; the 60 s constant is the slot's release.
- `ritemarkProjectHead.ts` (018): `HEAD_PLACES` from the manifest, the rows' room as slots.
- `webviewViewPane.ts` (018): the AI column's mark through the slot's loading look.
- Sprint 145's checks before and after, unchanged in what they assert.

## Workstream 6: the new members (R3, R4, R9, PR 2)

- **R3:** `layout.ts` (002) opens Home's place in a project window with no stored place; the desk's front for a project
  with no stored tabs follows A3 (the two tabs restored from the manifest, or the plain desk); `ritemarkEmptyDesk.ts`
  (019) draws no tiles on the main desk while its front slot is reserved.
- **R4:** `ritemarkWelcomeAlone.ts` (018) starts alone in a window with no folder and no file to open (the environment's
  files to open), and `layout.ts` (002, beside the empty-window rules) starts both columns closed there; released as R4
  says.
- **R9 (cut first):** `paneCompositeBar.ts` seeds the placeholders from the manifest when nothing is stored.

## Workstream 7: version skew (R7, PR 2)

- `release-extension-preflight.sh`: a check after Check 6 that reads `branding/product.json` at `--ref` (`git show`) and
  the extension's `package.json`, and refuses a release whose view containers, views, head-row commands or
  frame-shaping defaults differ from the manifest. A fixture proves it.
- The extension's `npm test`: the frame-shaping keys in `package.json` equal `branding/product.json`'s.
- Docs (E5).

## Delivery plan

| PR | Branch | Holds | Release tier | Review tier |
| --- | --- | --- | --- | --- |
| 1 | `sprint-152-startup-contract` | A1–A4's research; W1 (the first-frame check), W2 (#624), W3 (R6, by decision 2); the plan's doc updates | extension | Standard (`webview/src/`, `src/`, `scripts/qa/`, `.claude/skills/`); screenshots of the AI column's start to the Experience lead |
| 2 | `sprint-152-startup-contract-shell` | W4–W7 (R1–R4, R7, R9) and E5 | shell | High: `/code-review` at high and `/security-review`; up to three rounds, the third only when the second found something Important (`REVIEW.md` as #625 drafts it; as `REVIEW.md` stands at review time otherwise). Built on a CoW-cloned, patched `vscode/`; the first-frame check, `frame-screenshots.mjs --compare`, `frame-geometry.mjs`, `project-check.mjs --measure 10` |

PR 1 first: its check records `main`'s failing set before PR 2's code, and #624 needs no patch. PR 2 after Sprint 146's
shell PR merges (both change 018 and 019) and after the Experience lead answers questions 1–4, 6 and 8.

## Coordination

- **The Experience lead:** the proposal's nine questions, before PR 2's code; screenshots before each merge.
- **The "Ritemark on Windows" session:** A2 now; PR 1 through the test overlay; PR 2 at Gate 2 on 2.2's candidate, since
  Windows CI builds only `main`.
- **Sprint 146:** its PR 4 changes 018 and 019; PR 2 starts from `main` after it.
- **Sprint 147** (Settings) touches no patch and not the AI view; it runs alongside.

## Risks inside the sprint

| Risk | Retirement |
| --- | --- |
| Moving Sprint 145's fixes onto a new module breaks them | R2's checks before and after; same behaviour is a requirement |
| Home's tab can't be put on the desk before Ritemark starts, or an extension without its serializer leaves a dead tab | A3 first; the plain-desk fallback needs neither |
| The welcome alone shows in a window that never gets the welcome | Files to open are known at the first frame; release on a failed start or after 60 s; a unit test per case |
| The extensions are read late on a cold Windows PC, so slots wait long | A2 first; content slots are bounded at 60 s, VS Code's own limit |
| A build without the block silently undoes Sprint 145 | `validate-build-output.sh` fails it; the reader logs |
| More than three new hunks in upstream files | E2's budget: stop and decide |
| The first-frame check flakes on a hidden window | It compares boxes, not pixels; the held host gives a long still stretch; five runs agree before it gates |
| Patch stacking between 002, 018 and 019 | `check-patch-stacking.mjs` on every commit; 018 and 019 only import 002's file |
| Scope grows into colours and the status bar | Measured in A1 only; filed for 2.3 unless the lead asks |
| Disk | The worktree-hygiene report first; a CoW-cloned `vscode/`; profiles removed after each run |
