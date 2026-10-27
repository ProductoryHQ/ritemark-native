# Sprint 144 Spec — the release harness, and polish from the 2.1 smoke test

## Purpose

2.1's candidate needs two things in the build itself before it is cut. The Windows build has to run without making the repository private, because every toggle erases its stars and watchers (#506). And the app has to ship on the newest Electron its VS Code line allows, so the extension host's Node carries the 21 October security fixes as soon as Electron publishes them (#515). Both are shell-tier; neither changes what a person sees (Part 1, R1–R5).

The Development manager's combined smoke test of `main` at `c99a8596` also found five small extension-tier defects that should not reach the candidate: hand-rolled buttons with pale icons on the AI's sign-in card, "Experimental" badges on Ritemark's two main AIs in Settings, a status bar item that says "AI Ready" without checking any AI, a Flow step panel whose footer cuts its fields and whose model picker greys out for five seconds, and a project switch that shows a loading document before Home and brings the AI column back late (Part 2, P1–P5). They ship as their own PR, apart from Part 1.

## Principles

- **The build stays the recipe.** The product source is the exact `origin/main` commit; provenance keeps naming it (`source_commit`, `RITEMARK_RELEASE_COMMIT`). What changes is where the Windows job runs and which Electron the VS Code tree downloads, nothing else in the pipeline.
- **Measure, don't guess.** Each choice here rests on a run or a file that was read ([research/windows-ci-audit.md](research/windows-ci-audit.md), [research/electron-node-audit.md](research/electron-node-audit.md)). What is inferred says so.
- **One copy of the workflow.** No second build definition to drift from the first (the `release` skill: "Two places = drift").
- **Free software and the budget.** No commercial components; the Actions budget is $40 a month.
- **The repository's visibility is never changed**, by a person, a script or an agent.

## Part 1: the release harness (shell tier)

### R1: The Windows release build runs on the public repository (#506)

As the release owner, I want `build-windows.yml` to build, sign and test Ritemark's Windows installer while ProductoryHQ/ritemark-native stays public, so the stars and watchers people give it survive every release.

Acceptance criteria:
- `build-windows.yml` runs on the free standard runner `windows-latest` (A1 measured the build there: green in 37.5 minutes to the unsigned installer; Decision 1), in the public repository, dispatched exactly as today (`--ref main -f source_commit=<origin/main>`).
- Nothing changes visibility: the repository's `visibility` is `public`, and its `stargazers_count` and `subscribers_count` are unchanged, when read before the dispatch and after the run.
- The job keeps every step it has today, in the same order: the canonical-source gate, the frozen installs, the patched-state gate, the build, provenance, the unsigned-payload validation, Azure Artifact Signing with the catalog of PE files (#483's catalog-only PE handling included), the signed-payload verification, the signed installer, its identity record, and the standard-user install, update from v1.14.0, start and uninstall.
- The installer's identity record names `source_commit` (the ritemark-native commit) and `workflow_commit` exactly as today.
- The job's time limit stays `timeout-minutes: 120`, more than twice A1's estimate for the whole job on the free runner (45–50 minutes), and under GitHub's six-hour job limit.
- The working tree stays on the runner's work drive (D:, 150 GB, 132 GB still free at the probe's busiest point). Because the build's tree is 14 GB and GitHub documents only 14 GB of SSD for this runner, the job's first step reads the work drive's free space and stops with a clear message below 30 GB, before any build minute is spent.
- A Windows build costs nothing from the Actions budget.

### R2: The release path no longer toggles visibility (#506)

As whoever runs a release, I want the release instructions to build Windows without `gh repo edit --visibility`, so nobody erases the stars by following the old steps.

Acceptance criteria:
- The `release` skill (`.claude/skills/release/SKILL.md`): Step 5 dispatches without a toggle and says the repository is never made private; the *When to use* line and the *Windows builds — public/private repo toggle* gotcha are rewritten for the free runner.
- The `release-manager` agent's toggle section is replaced the same way; `qa-validator`'s line about the toggle reads correctly.
- `windows-canary.yml`'s header no longer says the real build needs a private toggle (comments only; the canary itself is unchanged).
- The v2.1.0 release plan's done-list line for #506 is ticked only after R1's first green run on `main` (S1, S2).
- The Codex harness mirrors follow through the harness equalizer (CLAUDE → CODEX), not by hand in this sprint.

### R3: 2.1 ships on the newest Electron 43 (#515)

As a person using Ritemark, I want the app's own Node and Chromium to carry the newest security fixes their line has, so a security release reaches me with 2.1, not a version later.

Acceptance criteria:
- One new Ritemark patch, `patches/vscode/020-ritemark-electron-43.patch`, sets the pinned VS Code's Electron to the newest published 43.x: `vscode/.npmrc`'s `target`, `vscode/build/checksums/electron.txt` (that release's own `SHASUMS256.txt`), and the Electron and Node versions in `vscode/cgmanifest.json`. No other file in `vscode/` changes.
- Today that is 43.8.3 (Node 24.22.0). When Electron publishes a 43.x whose Node is 24.22.1 or later before 2.1's version bump, the patch moves to it.
- The Mac arm64 build (`build-prod.sh`), macOS x64 CI and Windows CI all package that Electron; a wrong checksum stops the build.
- The built app's About shows that Electron and Node (patch 001 already prints both), on the Mac and on Windows.
- `validate-build-output.sh` fails a build whose bundled Electron isn't `vscode/.npmrc`'s target, on each of the three targets where the packaged app names its Electron version (A3 says where; a target where it can't be read is checked by About at Gate 1 or Gate 2, and the script says so).
- The app works on it: the terminal (node-pty), settings and state (sqlite), file watching (@parcel/watcher), the integrated browser and its AI actions, and the three AI runtimes, on the Mac and on Windows (S9–S13).
- `CLAUDE.md`'s patch table lists patch 020; `./scripts/apply-patches.sh --dry-run` applies all 19 to the pin.

### R4: The risk is written if Node 24.22.1 isn't out in time (#515)

As the release owner, I want to know before the candidate what 2.1 ships with if Electron hasn't published the fix, so the call is made on purpose.

Acceptance criteria:
- [research/electron-node-audit.md](research/electron-node-audit.md) records, for the Electron 2.1 ships: its Node, which of the 21 October CVEs it still carries, and every Node request in the extension host to a URL a person or an agent supplies (today: one, Flows' Save File with an image URL).
- If 2.1 ships without Node 24.22.1, the release plan's risk row for #515 says so with that audit, #515 stays open, and the release notes say nothing about it being fixed.
- Holding the candidate for an Electron release is a decision for the Development manager and Jarmo, raised with the evidence; this sprint doesn't decide it.

### R5: The done list's Windows checks run before the candidate, not at it

As the release owner, I want #499's and the Windows first window's checks run on a Windows build of `main` before the candidate is cut, so a first-week bug they find is fixed before main freezes.

Acceptance criteria:
- After R1 and R3 merge, one signed Windows build of `main` (R1's workflow) is installed by the "Ritemark on Windows" session, which runs S17–S19 and reports through the Development manager.
- The Mac half of #499 (S20) runs on a dev build here if the manager agrees to a test folder in this Mac's OneDrive and Google Drive folders (Decision 4); otherwise at Gate 2.
- A failure becomes a 2.1 issue with its reproduction, fixed before the version bump; nothing in this sprint changes code for #499, #276 or #501 in advance.

## Part 2: polish from the 2.1 smoke test (extension tier)

Found in the Development manager's combined smoke test of `main` at `c99a8596`. Every change is under `extensions/ritemark/`; none touches a patch. Each has a reproduction (what was shown, and how) and a done-when.

### P1: The AI sheet's sign-in card uses the shared Button

As someone signing in on the AI's sheet, I want its buttons to look and behave like every other button in Ritemark, so the sheet reads as one product.

Reproduction (measured in code; seen in the smoke test): `webview/src/components/ai-sidebar/OnboardingWizard.tsx` draws its own `ActionButton` and `SecondaryButton` (:428–463), plain `<button>`s used at :227–234 (Sign in with Claude.ai, Use API key), :246–249 (Sign in with ChatGPT) and :291–294 (Get Started). They lack `ui/button.tsx`'s `[&_svg]:fill-current`, and `Icon` defaults to `tone="muted"`, which it draws as the svg's `fill` attribute (the rule's own comment in `ui/button.tsx`), so the glyph is grey on the indigo button. Five more hand-rolled `<button>`s: Re-check at :152 and :255, Retry at :331, Install at :340 and :389.

Done when:
- Every button in `OnboardingWizard.tsx` is the shadcn `Button` from `ui/button.tsx`: the sign-in actions and Get Started in the default variant, Use API key in `secondary`, Re-check, Install and Retry in `link` (or `ghost`, size `sm`), each with a `Tooltip` from `ui/tooltip.tsx` that says what it does, never a native `title` (memory: every button gets a tooltip).
- `ActionButton` and `SecondaryButton` are deleted; `grep -n "<button" OnboardingWizard.tsx` returns nothing.
- An icon beside words takes the words' colour in every state (the framework, 27 October): screenshots of the step-1, step-2 and ready cards in Light and Dark, at rest, on hover and disabled.
- Buttons stay on one line at the sheet's narrowest width (memory: single-line buttons).
- The handlers are unchanged: the same callbacks fire (a test renders the card and clicks each button).

### P2: Settings shows no "Experimental" badge on Claude and ChatGPT

As someone choosing their AI in Settings, I want Ritemark's two main AIs presented as finished, because they are.

Reproduction (measured in code): `webview/src/components/settings/RitemarkSettings.tsx` hard-codes `<span …>Experimental</span>` beside "Claude Account" (:454–456) and "ChatGPT Account" (:638–640), with a comment "Codex ChatGPT Auth (experimental)" at :631. No feature flag drives them: the flags behind these cards, `agentic-assistant` and `codex-integration`, are `stable` (`src/features/flags.ts:225`, `:232`). No other "Experimental" text exists in the webview.

Done when:
- Both badges are removed, and the comment at :631 no longer says experimental (the Experience lead, experience 15: "No 'Experimental' badges … When something in Settings really is a trial, its own line says what may change, in words").
- No flag, feature or setting is deleted or changed.
- `grep -rn "Experimental" webview/src --include=*.tsx` finds none in the UI.
- Listed, not changed: `AGENTS.codex.experimental: true` (`src/agent/types.ts:54`) is not a badge; its only use hides ChatGPT from the composer's picker when the `agentic-assistant` flag is off (`ChatInput.tsx:1039`), which a stable flag never is. The feature flags with status `experimental` are not shown in Settings (the flags' UI was removed).
- A screenshot of both cards in Light and Dark.

### P3: The status bar's AI item says only what Ritemark knows

As someone working in Ritemark, I want the status bar to name the AI my next message goes to and whether it can answer, so it never says "ready" when no AI is.

Reproduction (measured in code): `src/ai/connectivity.ts:120–134` (`updateStatusBar`) sets "$(cloud) AI Ready", tooltip "Connected to AI service", whenever the internet probe answers (`_isOnline`); nothing reads any AI's sign-in. A fresh profile that chose Skip on the welcome shows "AI Ready" with no AI.

The Experience lead's words (ritemark-dev `55bf49c`, experience 13, *The status bar's AI item*), word for word:
- **Ready:** a green dot and "Claude ready", naming the AI the next message goes to (the open chat's, or the one a new chat starts with). It shows only when that AI is signed in and the internet answers. Tooltip: "Signed in to Claude".
- **No AI yet:** "No AI yet", with no dot, when no AI is signed in or set up. Tooltip: "Sign in to an AI to work with it here". Not "Set up AI".
- **Offline:** a grey dot and "Offline" in body ink, with no warning background. Tooltip: "No internet. Your documents work as usual and save on this computer." Offline comes before every other state.
- **Needing the person:** "Claude: sign in again", and "Claude needs a paid plan" with an amber dot, as already specified in experience 13.
- **Click:** opens the AI's sheet, on the open chat, or on its sign-in card when there is no AI yet.
- The words never say "AI", "service" or "connected", except "No AI yet" itself.

The Experience lead's answers to this plan's three questions (ritemark-dev `b058692`, experience 13), word for word:
1. **Never signed in:** "Claude: sign in", tooltip "Sign in to Claude to work with it here". "Again" is only for a sign-in that ended. If no AI is signed in at all, the item still says "No AI yet".
2. **Tooltips:**
   - "Your Claude sign-in has ended" goes with "Claude: sign in again".
   - "Your Claude plan doesn't include working in Ritemark" goes with "Claude needs a paid plan", matching the refusal card's words.
3. **The dot as its own status bar item:** yes, as long as it still reads as one item:
   - 6 between the dot and the words;
   - one hover fill and one pressed fill across both;
   - one tab stop, and one screen-reader name ("Claude ready"), with the dot hidden from the screen reader;
   - in a state with no dot, the dot's item is hidden.

   If VS Code can't give one hover fill across two items, the dot's item takes no hover and isn't clickable, so only the words light up. The screenshots must show the hover and pressed states.

Done when:
- The item follows the person live, for Claude, ChatGPT and OpenCode alike: a sign-in, a sign-out, a key added or removed (OpenCode), a switch between open chats on different AIs, a new chat, a change of the default AI, and the internet going and coming back each change it within two seconds, without a reload.
- It is right before the AI's sheet has ever been opened (the source is the host's, not the sheet's).
- "Claude ready" and its siblings name the AI by its label (Claude, ChatGPT, OpenCode).
- "<AI>: sign in again" (tooltip "Your <AI> sign-in has ended") shows when the open chat's last turn on that AI failed with `errorKind: 'sign-in'`, until a message goes through. "<AI>: sign in" (tooltip "Sign in to <AI> to work with it here") shows when that AI's availability is `needs-auth` without such a failure, and another AI is signed in; with no AI signed in at all, "No AI yet".
- "<AI> needs a paid plan" (tooltip "Your <AI> plan doesn't include working in Ritemark") shows only from a plan-refusal signal. None exists on the host today (`src/runtime/turnFailureCopy.ts:21–24`: "There is no plan refusal kind yet"); the state is built and tested, and wired when Sprint 139's #496 classifier gains that kind after a Claude Free reproduction. Until then it can't appear, and the plan says so.
- Probing adds no new cost at window start: only the AI in question is probed (ChatGPT's probe starts its app server), and results are reused for a short time the way Home's guidance does (`GuidanceHost.ts:444–456`).
- A unit test covers every state, Offline first, each AI's name, the dot's colour, the tooltips, and that no text says "AI", "service" or "connected" except "No AI yet".
- Screenshots of each reachable state in Light and Dark.

### P4: The Flow editor's step panel keeps its fields whole and its model picker usable

As someone building a flow, I want the step panel to show every field and to let me pick a model at once.

Reproduction (measured with a headless harness on the committed `media/webview.js`, [research/repro/flow-step-panel/](research/repro/flow-step-panel/README.md); screenshots in `qa/p4-*.png`). The Flow editor's webview is about 784 × 824 inside a 1440 × 900 window with both side columns (`docs/development/frame-baseline/light-base.png`):
- **The footer.** At 784 × 824 an LLM step's content is 712 px tall in a 665 px scroll area, and the Delete row (`NodeConfigPanel.tsx:145–187`, `flex-none` below the scroll area at :94) sits flush on its edge with no hairline, cutting the Temperature hint; at 784 × 800 the edge runs through the Temperature and Max Tokens inputs. The layout works (the fields scroll into view), but nothing shows that they do: the overlay scrollbar appears only after scrolling.
- **The model picker.** The host answers `flow:getModels` with `modelType: message.type || 'llm'` (`src/flows/FlowEditorProvider.ts:164`), and `message.type` is `'flow:getModels'`. The panel waits for `'llm'` (`NodeConfigPanel.tsx:414`) or `'image'` (:669), so it never matches; `isLoading` clears only on the 5-second timeout (:429–431), and for those 5 s the picker is `disabled` with "Loading models..." (:472, :477), every time a step is selected. The host's answer arrived after 152 ms and was dropped. Since `435b7c10` (January 2026). Image steps behave the same (:684, :729).

Done when:
- The Delete row is the last child inside the scroll area, so it scrolls with the fields and can never cross one; at 784 × 800 and 784 × 824 the harness shows Temperature and Max Tokens whole, and Delete below them when scrolled.
- The host answers with the type the panel asked for (`message.modelType === 'image' ? 'image' : 'llm'`), with a unit test of the reply.
- The picker greys out and says "Loading models..." only while it has no list at all; a known list and the step's saved model stay usable during a refresh (the LLM list wrapped in `modelOptionsWithPersistedSelection`, as the Image step's already is). In the harness the picker is enabled within 250 ms of the step being selected.
- Noticed, not in scope: selecting a step autosaves the flow about 100 ms later (`flowEditorStore.ts:386` marks every node change dirty); for its own issue, which the Development manager files or not.

### P5: A project switch lands on Home, with the AI column in place (#569)

As someone switching projects, I want to land on the new project's Home with the AI where it was, not see a loading document first and the AI column arrive seconds later.

Reproduction (seen in the smoke test on a dev build: the last document's tab shows "Loading…" before Home; the AI column returns 1.7–4.6 s after Home; #569). What the code shows (measured in code; the timings are not measured yet):
- A switch reloads the window: `ProjectSwitcher.switchTo` (`src/projects/switchProject.ts:132–150`) saves the landing and calls `vscode.openFolder` with `forceReuseWindow`.
- VS Code restores the target project's saved editors, so its last document comes back in front; its Markdown editor shows its own "Loading..." (`webview/src/App.tsx:739–745`) until the host answers `document:ready`.
- Home is brought forward only after activation and a fixed **800 ms** wait (`src/views/permanentTabs.ts:153`, `check(800)` → `ensurePermanentTabs`).
- The AI column is revealed only by a fixed **4-second** timer (`src/extension.ts:377–380`, `ritemark.unifiedView.focus`). Inferred from VS Code 1.117's source (1.142's not checked out here): patch 002 removes the AI column's saved container, so the workbench may start with the column hidden on every load.

Done when:
- **First, measured:** `scripts/qa/project-check.mjs --switch-to` (extended) stamps, every 50 ms after the reload, which tab is in front, whether any frame shows "Loading...", and whether the AI column is visible, for 10 switches on a dev build at 1440 × 900; with temporary timestamps in the extension host's log at activation, the editor's resolve, `ensurePermanentTabs` and the AI view's resolve.
- **Then, only if the cause is small and extension-side:** the AI column is revealed at activation (without taking focus, and not while the welcome is open), keeping the later focus; and with a landing pending, the permanent-tab check runs at once instead of after 800 ms. Done when, in 10 of 10 switches on the dev build, Home is in front without a "Loading..." frame and the AI column is visible within 300 ms of Home.
- **Otherwise** (the cause is the workbench's restore, a patch-tier change): no code in 144. #569 becomes an RC check at Gate 1: measured on the candidate the same way; if the gap is under 300 ms there, #569 closes with that evidence; if not, it is a 2.1 bug with the measurement, and the patch-tier fix (patch 002 keeping the AI column's container; Home restored as the active editor when a landing is pending) is planned then.

#### P5, measured (27 October, during the sprint)

Ten switches on the dev build (`qa-evidence.md`, S37 and S38):
- **Before:** a document in front for 1.3–1.4 s before Home; Home at 3.6–3.8 s; the AI column 3.2–4.6 s after Home, at about 6.9 s: the 4 s timer after activation. Both of Ritemark's timers were the cause of what happens after activation, so the extension-side change was made.
- **After:** the AI column at activation (2.9–3.1 s), before Home in 9 of 10; Home at 3.1–3.4 s; a document in front for 0.7–0.9 s.
- **What is left happens before the extension activates** (the workbench restores the document at about 2.4 s, the extension runs at about 2.9 s): the document in front until then, and, when the workbench restores Home first, the AI column 0.56 s after it. That part is P5's *Otherwise*: #569 is checked on the candidate (S40); a production build starts faster than a dev build, so the gap there is measured, not assumed. If it is over 300 ms, the patch-tier fix (patch 002 keeping the AI column's container; Home restored as the active editor when a landing is pending) is planned from that measurement.

## Engineering requirements

- **E1, provenance.** `source_commit` and `RITEMARK_RELEASE_COMMIT` keep their meaning: the ritemark-native commit whose product bytes ship. The harness commit is `workflow_commit`, in the same repository.
- **E2, signing.** Azure Artifact Signing, the PE catalog and `verify-windows-signatures.ps1` run unchanged; an unsigned PE or a missing secret still fails the job.
- **E3, no secrets in the repository.** The signing and OAuth secrets stay repository secrets; no new secret is needed.
- **E4, budget and licences.** No paid runner, no commercial component.
- **E5, shell tier and the freeze.** Part 1's changes are shell-tier (`.github/workflows/build-`, `patches/`). They merge before 2.1's version bump; the Windows and macOS x64 runs after the merge are the release plan's "CI green on `main` before the candidate".
- **E6, Part 2 apart.** P1–P5 are extension-tier, on their own branch and PR, mergeable before or after Part 1 and independently of it. Webview changes rebuild the committed bundles (`media/webview.js`), which the pre-commit validator checks (freshness, size, the `ai-sidebar` sentinel). No patch changes in Part 2; if P5's cause turns out to need one, P5 stops at its measurement (P5's *Otherwise*).
- **E7, the existing patterns.** shadcn `Button` and `Tooltip`; the host's `runtimeAvailability()` and status events; no new subsystem, no new webview message type unless P3's open-chat report needs one field on an existing message.

## Non-Requirements

- No VS Code update: no VS Code ships Node 24.22.1 either (A2), and an update is the largest shell change there is.
- No change to the build-time Node (`vscode/.nvmrc` 24.18.0, the workflows' `NODE_VERSION`): it runs the build and isn't shipped.
- No code for #499, #276 or #501 before a check fails (R5).
- No change to the macOS x64 workflow beyond what R3 needs: it already runs on a free runner (`macos-15-intel`).
- CI's update test keeps updating from v1.14.0 (the last 1.117 layout); the update from 2.0.1 is Gate 2's.
- No private build mirror and no org-level runner setting, unless Decision 1 chooses one (the audit's options B and C).
- P3 doesn't invent a plan-refusal signal: "needs a paid plan" waits for #496's classifier.
- P4 doesn't change how flows save (the autosave on selection is noted, not fixed).
- P5 doesn't change a patch in this sprint.

## Resolved Questions

- **Which VS Code Electron line?** 43, the pin's. Every 43.x has native-module ABI 148, so the bump needs no rebuild of the dependency tree beyond what `npm ci` already does (A2, measured).
- **Is Chromium exposed to the Brotli flaw?** Not through this CVE: Chromium 150's Brotli already has the fixed block-switch handling (A2, measured).
- **Does About need a change?** No: patch 001 prints `Node.js: ${process.versions['node']}`.

## Open Questions

- Does Electron publish a 43.x with Node 24.22.1 before 2.1's version bump? (Measured on 27 October: merged on `43-x-y` on 22 October, unreleased.)
- Where does each packaged target name its Electron version for R3's check (A3)?
- ~~P3's three questions for the Experience lead~~: answered 27 October (ritemark-dev `b058692`), in P3 above.
- **P5:** is the cause the workbench's restore (patch tier) or Ritemark's two timers (extension tier)? The first step of P5 measures it.
