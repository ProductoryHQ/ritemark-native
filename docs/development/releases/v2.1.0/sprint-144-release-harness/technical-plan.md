# Sprint 144 Technical Plan

## What exists today (27 October, `origin/main` `c99a8596`)

- **`build-windows.yml`** runs on `windows-8core`, `timeout-minutes: 120`, `workflow_dispatch` only, with `source_commit` as an input that must equal canonical `origin/main`. It checks out the product at that commit (`r/`) and the harness at `github.sha` (`ci-harness/`, three PowerShell scripts), and records both in the installer's identity file. The 8-core runner's runner group (which one can't be read without `admin:org`; inferred to be the default) admits private repositories only, GitHub's default ("By default, only private repositories can access runners in a runner group, but you can override this", GitHub docs, *Controlling access to larger runners*). Hence the toggle in the `release` skill's Step 5.
- **The last green 8-core run** (40079413435, 2.0.1, 24 October) took 48 minutes: `npm ci` in `vscode/` 21.8 min, the gulp build 5.6 min, signing 1.4 min, Inno Setup 7.5 min, the standard-user round trip 5.0 min. At $0.042 a minute that is about $2.0. October's Actions bill is $29.53, all "Actions Windows 8-core", 703 minutes (billing usage API, 27 October).
- **`windows-canary.yml`** already runs weekly on the free `windows-latest`, with Node 24.18.0's node-gyp and the same Visual Studio check. Its last scheduled run (26 October) was green. `windows-latest` and `windows-8core` both run the image `windows-2025-vs2026` (20261021.278 and 20261007.264 in the last runs' logs).
- **`build-macos-x64.yml`** runs on `macos-15-intel`, a free standard runner; it needs no toggle and no change here beyond R3's Electron.
- **The pinned VS Code** downloads Electron 43.7.7 from Electron's own GitHub release and checks it against `build/checksums/electron.txt` ([research/electron-node-audit.md](research/electron-node-audit.md)).

## The audits

| Audit | Question | When | Status |
|---|---|---|---|
| **A1** | Does the full Windows build fit the free `windows-latest` runner (4 vCPU, 16 GB, 14 GB SSD for public repositories)? Time, disk, memory | Planning | Done: probe run 40425970110, green in 37.5 min, 132 GB free at worst, 3.4 GB memory free at worst ([research/windows-ci-audit.md](research/windows-ci-audit.md)) |
| **A4** | P4: reproduce the step panel's two defects at 1440 × 900 | Planning | Done: [research/repro/flow-step-panel/](research/repro/flow-step-panel/README.md), `qa/p4-*.png` |
| **A5** | P5: what restores the document before Home, and what brings the AI column back late, in time | Phase 1 of Part 2, before any P5 code | Code read in planning (spec P5); the timings measured first (S37) |
| **A2** | Which Electron and Node does 2.1 ship, what does a move cost, and who fetches an outside URL with Node? | Planning | Done: [research/electron-node-audit.md](research/electron-node-audit.md) |
| **A3** | Where does each packaged target name its Electron version, for R3's check? | Phase 1, before W3's check | macOS measured (the framework's `Info.plist` `CFBundleVersion`, 43.7.7 in the installed 2.0.1); Windows and the x64 tarball to read from the first build |

## Workstream 1: The Windows build on the free runner (R1, E1–E4)

`build-windows.yml`, one file:

- `runs-on: windows-8core` → `runs-on: windows-latest`.
- `timeout-minutes: 120` stays: A1's probe took 37.5 minutes to the unsigned installer, and the whole job is estimated at 45–50.
- **The work drive stays D:** (150 GB "Temporary Storage", 147 GB free at the start, 132 GB at the busiest point; the build's tree is 14 GB). No relocation.
- **A disk guard, first step after Git's config:** read the free space of the drive holding `$GITHUB_WORKSPACE` and fail with "The runner's work drive has N GB free; the Windows build needs at least 30 GB" below 30 GB. GitHub documents only 14 GB for this runner, so the day it gives what it documents, the job stops in seconds instead of filling the disk mid-build. Inline PowerShell of three lines, since it checks the runner and validates no artifact (the `release` skill's rule puts artifact validation in scripts).
- The comment over "Check npm's node-gyp finds Visual Studio" says `windows-latest` instead of `windows-8core`; the header comment over `workflow_dispatch` drops "paid larger-runner".
- Nothing else in the job changes: the same steps, order, secrets, scripts and artifact.

Tests: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-windows.yml'))"`; the `release` skill's pre-push audit (read the whole workflow and its sibling); then S1–S4 and S8 on `main` after the merge, the first real run.

## Workstream 2: The release path without the toggle (R2)

- `.claude/skills/release/SKILL.md`: *When to use* (the toggle line), Step 5 (no toggle; "The repository is never made private: each toggle erases its stars and watchers (#506)"), the gotcha *Windows builds — public/private repo toggle* rewritten as *Windows builds run on the free runner*, with A1's numbers.
- `.claude/agents/release-manager.md`: *Windows Build Notes* (lines 342–360 today) is stale three ways: the toggle, "pushing the release tag (which triggers `build-windows.yml`)" (dispatch-only since v1.8.2) and the artifact name `ritemark-windows-x64` (now `ritemark-windows-installer`). It becomes a pointer to the `release` skill's Step 5 and Gate 2, with "never change the repository's visibility". *Target Repository* (line 396) calls ritemark-native the "private development repo" and mentions the toggle; it says public, no toggle.
- `.claude/agents/qa-validator.md` line 285 and `release-manager.md` line 131 ("no repo-visibility toggle" for extension releases) stay true and are left as they are.
- `windows-canary.yml`: the header's WHY paragraph (the real build no longer runs behind a toggle; the canary is still the weekly early warning). No change to its jobs.
- `docs/development/releases/v2.1.0/release-plan.md`: #506's done-list line and risk row after S1 and S2.

## Workstream 3: Electron 43.8.x and the check (R3, R4)

- **Patch 020**, made with `./scripts/create-patch.sh "ritemark-electron-43"` on a pristine pin with patches 001–019 applied, so it stacks last:
  - `vscode/.npmrc`: `target="43.8.3"` (or the newer 43.x with Node 24.22.1); `ms_build_id` left as it is, because Ritemark's build never reads it (no `electronArtifactFeed`).
  - `vscode/build/checksums/electron.txt`: replaced with that release's `SHASUMS256.txt` from `https://github.com/electron/electron/releases/download/v<version>/SHASUMS256.txt`, checked by hand against GitHub's own asset digest for three zips (darwin-arm64, darwin-x64, win32-x64).
  - `vscode/cgmanifest.json`: the `electron` and `nodejs` registrations' versions and commits (from Electron's release tag and its `DEPS`/`releases.json`).
  - Its own patch, not a hunk in 004, because it has its own lifetime: it is deleted, not rebased, at the next VS Code update whose pin already carries this Electron or newer. `scripts/update-vscode.sh --check` should then report it as obsolete (checked in W3's tests).
- **`CLAUDE.md`**: *Current patches (19)* with patch 020's row.
- **The CI header question.** `build-prod.sh` applies patches before `vscode/`'s `npm ci`, so the Mac builds native modules against the new headers. Both CI workflows run `npm ci` before their patch step, so CI builds them against 43.7.7's headers. Every 43.x has ABI 148 (A2), so they load; S11 proves it on Windows. Moving CI's patch step before `npm ci` would change the Windows job's staged-extension provenance order (`--extension-layout absent`) and is not worth it for a same-ABI bump; the technical plan of the next Electron *major* must revisit it.
- **R3's check** in `scripts/validate-build-output.sh` (where validation lives, not YAML): read `vscode/.npmrc`'s `target` and the packaged Electron's version (A3: on the Mac, `Electron Framework.framework/Versions/A/Resources/Info.plist` `CFBundleVersion`), and fail on a mismatch with both versions in the message. On a target where A3 finds no readable version, print that it is checked by About at Gate 1 or Gate 2.
- **R4's record**: the release plan's #515 risk row and A2's audit, updated at the version bump with the Electron 2.1 ships.

Tests: S13 (the patch applies to the pin; the validator hook passes, run by hand with `CLAUDE_PROJECT_DIR="$PWD"` in this worktree); S10 and S14 on scratch copies; S9 on a dev launch here (`.build/electron` is re-downloaded when `.npmrc`'s target changes, `shouldDownloadElectron`); S11 and S12 on the Mac here and on S1's Windows install.

A production arm64 build is not run here: free disk is about 16 GB. S9's production half runs at Gate 1, in the release worktree.

## Workstream 4: The done list's Windows checks before the candidate (R5)

No code. After the merge:
1. Dispatch `build-windows.yml` and `build-macos-x64.yml` on `main` (the release plan's "CI green on `main` before the candidate").
2. The Development manager passes S1's installer to the Windows session for S17–S19, and S11–S12's Windows half.
3. S20 here, if Decision 4 is yes.
4. Anything that fails becomes a 2.1 issue with its reproduction, fixed before the version bump.

## Part 2: polish from the 2.1 smoke test (extension tier)

All under `extensions/ritemark/`, on `sprint-144-release-harness-polish`, one PR of its own (E6).

### Workstream 5: The sign-in card's buttons (P1)

- `webview/src/components/ai-sidebar/OnboardingWizard.tsx`: import `Button` (`ui/button.tsx`) and `Tooltip` (`ui/tooltip.tsx`); the sign-in actions and Get Started become `<Button>` (default variant), Use API key `<Button variant="secondary">`, Re-check, Install and Retry `<Button variant="link" size="sm">` (the link variant keeps today's accent text; `ghost` if the Experience lead prefers). `Icon`s inside keep their `tone` as it is; the Button's `[&_svg]:fill-current` makes them the words' colour.
- Delete the local `ActionButton` and `SecondaryButton` (:428–463).
- Tooltips, proposed (the manager answers wording asks): "Sign in with your Claude account in the browser", "Use an Anthropic API key instead", "Sign in with your ChatGPT account in the browser", "Check again what is installed", "Install <name>", "Try the install again", "Start your first chat".
- Tests: a render test that clicks each button and sees its callback (S23); `grep -n "<button" OnboardingWizard.tsx` empty; screenshots S21–S22.

### Workstream 6: Settings' badges (P2)

- `webview/src/components/settings/RitemarkSettings.tsx`: remove the two `<span>`s (:454–456, :638–640); the comment at :631 reads "Codex ChatGPT Auth". Nothing else in the file changes.
- Test: S24's screenshots; the existing Settings tests stay green.

### Workstream 7: The status bar's AI item (P3)

What exists (read in planning; file:line on `c99a8596`):
- `UnifiedViewProvider.runtimeAvailability(id)` (`src/views/UnifiedViewProvider.ts:2361`) probes one AI on demand, without the sheet: Claude through `getSetupStatus()` (cached, `src/agent/setup.ts:31`), ChatGPT through `CodexRuntime.getCodexSidebarStatus()` (starts the app server), OpenCode through its saved keys. Home's guidance, the welcome and the task board already use it.
- Change events: `onClaudeStatusInvalidated` (`src/agent/claudeStatusEvents.ts:23`), `onCodexStatusInvalidated` (`src/codex/codexStatusEvents.ts:21`), `context.secrets.onDidChange` for the OpenCode keys (`UnifiedViewProvider.ts:372–376`), `connectivityChanged`. The welcome subscribes to the same set (`src/welcome/welcomeHost.ts:221–232`).
- The default AI: the setting `ritemark.ai.selectedAgent`.
- The open chat: the host knows only its id (`_activeConversationId`, set by `conversation/active`, `UnifiedViewProvider.ts:676`, sent from `webview/src/components/ai-sidebar/store.ts:3655–3661`); not its AI, and switching between open chats sends no `ai-select-agent`.
- A failed turn's `errorKind` (`sign-in`, `limit`, …) is stored on the chat's record (`src/conversations/types.ts:92–106`); there is no plan-refusal kind (`src/runtime/turnFailureCopy.ts:21–24`).

The wiring:
- **`src/ai/aiStatusItem.ts` (new):** owns the status bar item(s) and a pure `describeAiStatus({ online, target, availability, lastTurnFailedSignIn, planRefused, anyAiUsable })` → `{ text, tooltip, dot: 'green' | 'grey' | 'amber' | null }` with the Experience lead's words. Pure, so S32 is a unit test. `connectivity.ts` keeps probing and `connectivityChanged`, and stops owning the item (its `updateStatusBar` goes).
- **The dot:** a status bar item colours all its text at once, and the words are in body ink, so the dot is its own item just left of the words (`$(circle-filled)` with a `ThemeColor`: green, the grey of `descriptionForeground`, amber), hidden in a state with no dot. The Experience lead's conditions (`b058692`): it reads as one item: 6 between dot and words, one hover and one pressed fill across both, one tab stop, one screen-reader name with the dot hidden from it. VS Code draws each item's hover on its own, so the dot's item takes no command (no hover, not clickable, not a tab stop) and carries `accessibilityInformation` that hides it; the words' item carries the command and the name. Measure the gap between the two in the dev build and report it with the hover and pressed screenshots.
- **The target AI:** the open chat's AI if the sheet has reported one, else `ritemark.ai.selectedAgent`. One field more on an existing message: the webview's `conversation/active` carries the open chat's `agentId`, and is sent again when that chat's AI changes; `UnifiedViewProvider` fires a new `onDidChangeOpenChat({ conversationId, agentId })` from `_noteActiveConversation` (:2271).
- **Re-derive** on `connectivityChanged`, both status events, the OpenCode key change, the setting's change, `onDidChangeOpenChat`, and the end of each turn (for "sign in again", read the open chat's last failed turn the way `lastAnswerOfOpenChat` reads its record, :1931). Debounced by 300 ms; a result older than the newest request is dropped.
- **Cost:** probe only the target AI; "No AI yet" probes the other two only when the target isn't usable, and reuses results for 15 s as `GuidanceHost` does (:444–456). Offline is decided before any probe.
- **"needs a paid plan":** the `planRefused` input exists and is tested; it is fed when #496's classifier gains a plan-refusal kind. Not before.
- **Click:** `ritemark.showAIPanel` (today `ritemark.unifiedView.focus`, `src/extension.ts:694–696`). For "No AI yet" with a non-empty open chat, it starts a new empty chat first, so the sheet's own gate shows the sign-in card (`sidebarGate.ts:56`); no new message type.
- Tests: `src/ai/aiStatusItem.test.ts` (every state, S32); a host test that each event re-derives with a mocked `runtimeAvailability`; S25–S31 on a dev launch with an isolated profile and isolated Claude/Codex homes (never the person's `~/.codex` or `~/.claude`).

### Workstream 8: The Flow step panel (P4)

- `webview/src/components/flows/NodeConfigPanel.tsx`: move the `{!isTriggerNode && …}` Delete block (:145–187) inside the scroll div (:94) as its last child, dropping its `flex-none px-4 pb-4` wrapper padding in favour of the scroll area's.
- `src/flows/FlowEditorProvider.ts:164`: `this.fetchModels(message.provider, message.modelType === 'image' ? 'image' : 'llm', webview)`. The panel already sends `modelType` (`'llm'` at `NodeConfigPanel.tsx:406–408`, `'image'` at :664); the host reads `message.type` instead. A unit test of the reply's `modelType`.
- `NodeConfigPanel.tsx`: the LLM picker is `disabled` and says "Loading models..." only when `isLoading && models.length === 0`; the LLM list goes through `modelOptionsWithPersistedSelection`, as the Image step's does.
- Not in this workstream: reading the model list from a subscribable store so a late `flow:modelConfig` reaches an open panel (the harness showed it, but the host sends the list before `flow:load`); the autosave on selection.
- Tests: the harness (`shoot.mjs`) against the rebuilt bundle (S33–S35); S36 in a dev launch.

### Workstream 9: The project switch (P5)

1. **Measure (A5):** extend `scripts/qa/project-check.mjs --switch-to` with a 50 ms poll after `connect()`: the front tab, any frame whose text is "Loading...", `.part.auxiliarybar`'s visibility, with `Date.now()`; add temporary `console.log` stamps (removed before the PR) at `activate`'s start, the Markdown editor's resolve, `ensurePermanentTabs`' start and end, the 4 s timer, and `resolveWebviewView`. Ten switches (S37).
2. **If the stamps show Ritemark's timers are the cause:** in `src/extension.ts:377–380`, reveal the AI's view at activation with `preserveFocus` (not while the welcome is open), keeping the 4 s focus for the terminal's sake; in `src/views/permanentTabs.ts:153`, run the check at once when a landing is pending. S38, S39.
3. **If the stamps show the workbench's restore is the cause** (the AI column hidden by the layout, the document restored in front): stop. The fix is patch 002 (keep the AI column's container) or the restore order (Home active when a landing is pending), shell tier; #569 is checked on the candidate (S40) and planned from that measurement.

## Delivery

- **Part 1, one PR from `sprint-144-release-harness`**: W1, W2, W3. Shell tier. The PR body names both tiers' paths (`.github/workflows/build-`, `patches/`).
- **Part 2, one PR from `sprint-144-release-harness-polish`**: W5–W9. Extension tier. It doesn't wait for Part 1, nor Part 1 for it.
- **Before each merge:** the pre-commit validator by hand (`CLAUDE_PROJECT_DIR="$PWD"`), `qa-validator`, and a smoke test on a dev launch (memory: smoke-test before asking for a merge). Part 1: S13, the workflow's YAML and pre-push audit, S9, S11 and S12 here. Part 2: S21–S36 here, S37–S39 if P5 changes code; screenshots to the Experience lead for P1–P4.
- **After Part 1's merge:** W4's dispatches. A red Windows run is fixed in one follow-up PR (the `release` skill: one reactive iteration, with the whole workflow read first).
- **If Electron publishes 43.x with Node 24.22.1 later but before the version bump:** one small PR moves patch 020 to it (S15), then W4's dispatches run again.
- **Both merge before the version bump**, which is the last merge before the candidate.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The free runner can't hold the build (disk) or takes too long | Measured to fit (A1); the disk guard stops a smaller runner in seconds; if a real run fails for a reason the probe couldn't see, Decision 1 falls back to option B, then C |
| Signing behaves differently on the free runner | Same image family, same action and scripts; S4 compares the catalogs with the last 8-core run |
| A free runner's queue is slow on a release day | Measured only by use; the build has no deadline inside a day, and nothing is paid while queued |
| Electron 43.8.x breaks something in VS Code 1.142 | Upstream runs 43.8.3 at 1.144 (A2); S11 and S12; dropping patch 020 restores 43.7.7 |
| CI's native modules built against 43.7.7's headers misbehave | ABI 148 across 43.x (A2); S11 on Windows |
| No 43.x with Node 24.22.1 before the version bump | R4: the written risk, #515 open, Decision 3 |
| A wrong `SHASUMS256.txt` | Cross-checked with GitHub's asset digests; the build verifies every download (S10) |
| The repository is made private by habit | R2 removes every toggle command from the release path |
| P3 probes cost time at window start (ChatGPT's probe starts its app server) | Only the target AI is probed; results reused for 15 s |
| P3's open-chat report misses a path (a restored chat, a chat moved between windows) | S27 and S31; the setting is the fallback, so the item is never blank |
| P5's measurement shows a patch-tier cause | P5 stops at the measurement; #569 becomes an RC check (S40) |
| Part 2 lands after Part 1's CI runs and changes the extension | Both merge before the version bump; W4's dispatches run on the final `main` again if Part 2 merges later (free, so no budget cost) |
