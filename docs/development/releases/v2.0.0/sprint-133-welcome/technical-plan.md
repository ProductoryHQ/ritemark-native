# Sprint 133 Technical Plan

The plan for [spec.md](spec.md). The release is [v2.0.0](../release-plan.md), step 2; the research behind it is the release's [feasibility read](../feasibility.md) and the Experience lead's technical analysis (`ritemark-dev`: `product/design/experience/technical/README.md`, "The first impression: the welcome" and "Reading the numbers"). Code shapes here are proposals: when the code needs something else, this file changes first. File references are to `main` at `d781a0e1` (Sprint 132 merge 1).

## What exists today

| Part | Today | File |
|---|---|---|
| The first window | VS Code's Getting Started page, rewritten by patch 001: logo and "Write Smarter. Think Faster.", a New document split button (New table, New flow), Open folder, three links (Getting started, Support articles, Blog), up to six recent files and folders, and the Launch check | `patches/vscode/001-ritemark-branding.patch` (`gettingStarted.ts`, `gettingStarted.css`, the new `gettingStartedGuide.css`, the `startupEditor` default in `gettingStarted.contribution.ts`); the SVGs are copied from `branding/welcome/` by `scripts/apply-patches.sh` |
| When it opens | 001 changes `workbench.startupEditor`'s default to `welcomePageInEmptyWorkbench`, so it opens in a window with no folder and no restored editors. Neither `product.json` nor the extension sets it | 001; `branding/product.json` `configurationDefaults` (made live on desktop by patch 013) |
| The launch check | `ritemark.getHealthStatus`, shown as rows: ChatGPT and Claude.ai "authenticated" or not, with "Click here to log in" (`ritemark.codexLogin`, `ritemark.claudeLogin`); "Ritemark found Git" or "needs Git" (016 removed its install link); "found Node" or "needs Node", only when `nodeRequired` (017) | 001, 016, 017; `settings/RitemarkSettingsProvider.ts:814–856` |
| Start-up | The extension activates on `*`. Once per profile it runs the theme set-up and the sticky-tab healer (1500 ms); it writes layout settings on every start; it focuses the AI's sheet at 4000 ms with no folder check; it starts analytics, which shows the usage-data notice | `extension.ts:250–344` |
| Usage data | Opt-out. `ritemark.analytics.enabled` defaults to true; the kill switch `ritemark.features.analytics` (read directly, not through `isEnabled`). The notice is a toast (OK, Opt Out, Privacy Policy, Terms of Use) shown while `ritemark.analytics.hasSeenNotice` is unset; any answer, even closing it, writes that key; only Opt Out writes false. Before an answer only `app_session_start` waits; every other event is sent at once. GeoIP is on. Ritemark Settings has no usage-data switch | `analytics/posthog.ts:70–232`, `events.ts`, `package.json:292–331` |
| Events | `app_session_start`, `feature_used`, `agent_used`, `reaction_submitted`, `feedback_sent`, with `$process_person_profile: false`, `product_area`, `app_version` and an anonymous id (`ritemark.analytics.anonymousId`). Dev runs send to the production project with nothing to tell them apart (#338) | `analytics/posthog.ts:119–145` |
| Claude's sign-in | `claude auth login --claudeai` as a subprocess; the CLI opens the browser; Ritemark reads the sign-in link from its output and offers "Copy backup link"; 5 minutes; one sign-in for the whole app. "Signed in" comes from `detectClaudeAuthMethod`: `auth status --json` (5 s), the stored Anthropic key, the keychain (3 s), `ANTHROPIC_API_KEY`; before it the binary is found (3 s) and asked its version (up to 15 s on a cold start); cached | `agent/installer.ts:299–307`, `agent/claudeLogin.ts:54–89`, `agent/setup.ts:187–447` |
| ChatGPT's sign-in | Codex's `account/login/start` gives a link that Ritemark opens; `account/read` says who is signed in (RPC timeout 30 s; binary probes 3 s each); the AI sheet polls every 2 s | `codex/codexAuth.ts:76–107`, `settings/RitemarkSettingsProvider.ts:882–897`, `codex/CodexRuntime.ts:603–623` |
| OpenCode | No sign-in: keys of the person's own (`openai-api-key`, `google-ai-key`, `anthropic-api-key`, `openrouter-api-key`); ready when a key is set and that provider has models | `acp/acpKeyEnv.ts`, `runtime/availability.ts:139–149` |
| The AI sheet with nothing usable | `OnboardingWizard` (checklist, then "Almost there! Sign in…" with Claude and ChatGPT), or the selected runtime's setup view (`SetupWizard`, `CodexSetupView`, `OpenCodeSetupView`); the wizard's dismissal lives in memory | `webview/src/components/ai-sidebar/` (`sidebarGate.ts:51–62`, `AISidebar.tsx:224–335`, `OnboardingWizard.tsx`) |
| A 1.x profile | No first-run marker. `ritemark.activation.lastConfirmedVersion` is empty on a fresh profile and `1.14.0` on an updated one; `lastAttemptedVersion` is overwritten early in `activate` | `update/activationIntegrity.ts:36–37`, `extension.ts:265`, `:960` |
| A new project, About this project, a sample project | Nothing | — |
| State across a reload | Only `ritemark.update.pendingRestartVersion` and the activation keys are written before a reload and read after it | `update/updateService.ts` |
| The webview bundle | One IIFE; the root is picked by `data-editor-type` in `webview/src/main.tsx:85–121`; `media/webview.js` is 8,478,880 bytes | `webview/vite.config.ts:95–98` |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Extension: a new `welcome` subsystem | The welcome's state, its panel and protocol, the provider states, the landing, a new project, the update detection | `src/welcome/` (new) |
| Extension: analytics | One consent gate; off until yes; the held welcome events; `build_channel`; the notice retired; four events | `src/analytics/` |
| Extension: start-up | The welcome opened when it should be; the AI sheet's 4 s focus not while the welcome shows; the healer replaces a tab (#429); the landing read after a reload | `extension.ts`, `utils/stickyTabHealer.ts` |
| Extension: Settings | Usage data, and the launch check's Git and Node rows | `settings/RitemarkSettingsProvider.ts`, `webview/src/components/settings/RitemarkSettings.tsx` |
| Webview | The welcome page and the update sheet, in the shared bundle | `webview/src/components/welcome/` (new), `webview/src/main.tsx` |
| Patch 001 | The Getting Started hunks leave; the files go back to upstream where nothing else of Ritemark's is in them | `patches/vscode/001-ritemark-branding.patch` |
| Patches 016, 017 | 016 keeps only its Source Control part; 017 is retired | `patches/vscode/016-…`, `017-…` |
| Patch 018 | The welcome alone (no strip, sheet or status bar while it is the only thing open); a file's extension in muted ink | `patches/vscode/018-ritemark-surfaces.patch` |
| Harness | The stacking check's known pairs; the welcome in the screenshot baseline and CDP checks | `scripts/check-patch-stacking.mjs`, `scripts/qa/` |

The release tier is **shell** (`patches/`). One new webview ↔ host protocol (the welcome's) crosses the welcome subsystem's boundary only; `architecture.md` gets the welcome and the consent gate as a subsystem note (E6).

## Phase 1 audits

Four requirements carry real unknowns, so each gets an audit under `research/` before code (spec-driven-sprint skill, "Audit-First"):

1. **`research/getting-started-retirement-audit.md`** (R12): every hunk of 001, 016 and 017 sorted into welcome-page-only or other; every way into the Getting Started page (start-up, Help, the command palette, `workbench.action.openWalkthrough` and friends, the `welcomeOnboarding` contribution that patch 007 keeps loadable because the start-up runner depends on `IOnboardingService`); where `workbench.startupEditor: none` must be set to win before the start-up runner reads it (`branding/product.json` through 013, or the extension's defaults); what `apply-patches.sh` stops copying; the stacking check's known pairs after 017 goes.
2. **`research/welcome-alone-audit.md`** (R1): how the workbench learns that the welcome is the only thing open (a context key the extension sets, observed by a small 018 contribution that puts a class on the workbench), what the class hides (the desk's strip and sheet, the status bar), the Mac traffic lights and Windows' window buttons with it, and that nothing jumps when the first project opens.
3. **`research/muted-extension-audit.md`** (R13): where the tree and the tabs render a file's name (`base/browser/ui/iconLabel/iconLabel.ts`, `workbench/browser/labels.ts`), how filter highlights (`matches`) and descriptions run through it, and the smallest hunk that renders the name and the extension apart, with a class the stylesheet colours.
4. **`research/ext-host-start-401-audit.md`** (R15, [#401](https://github.com/ProductoryHQ/ritemark-native/issues/401)): a CPU profile of the extension host's first seconds on a fresh profile on the Mac (memory: `reference_ext_host_startup_profiling`), then on Windows in the Development manager's Windows session; what in `activate` blocks; the decision (fix here, or record and rely on R15's guarantee).

A short `research/confirmations.md` also records: the signal for a 1.x profile (`lastConfirmedVersion`, read before line 265); the provider entry points the welcome calls; how the healer finds and closes the text tab.

## Workstream 1: Consent and the four events (R7, R8, R9, E1)

This goes first: it changes what every part of Ritemark may send.

- **One gate.** `analytics/consent.ts` (new) owns the answer: `unknown`, `yes` or `no`, read from `ritemark.analytics.enabled` (default **false** from now on) and a new globalState key `ritemark.analytics.answeredV2`. The kill switch (`ritemark.features.analytics`) is read through `isEnabled('analytics')` in the same place. `trackEvent` asks the gate and returns when it is not `yes`; nothing in Ritemark calls PostHog around it.
- **Before an answer.** The PostHog client is not created until the gate says yes, so nothing, not even a session start, leaves the computer before it.
- **The held events.** `analytics/welcomeEvents.ts` (new) keeps the welcome's `welcome_shown` and `ai_signed_in` in memory only. At a yes it sends them, then forgets them; at a no, or when the window closes without an answer, it drops them. (This is the recommendation in spec Open Question 1; if Jarmo chooses to drop them, the module shrinks to a no-op and S29 changes.)
- **The four events** join `events.ts` with their properties exactly as spec R8 lists them. `project_opened` is sent by the landing (W5) after the reload, when the gate is yes. `first_message_sent` is sent by the AI sheet's host on the first `agent-execute` of the profile, under a globalState key `ritemark.analytics.firstMessageSent`.
- **`build_channel`** (#338) joins the shared properties: `dev` when `context.extensionMode === Development` or the extension's version has no pre-release suffix (a run from source; installed builds are floored to `X.Y.Z-0` or `X.Y.Z-ext.N`), otherwise `prod`. The detection rule and its reason are written beside it.
- **The notice retires.** The toast in `posthog.ts:213–232` and `hasSeenNotice` stop being used; the Privacy Policy and Terms of Use links move to the welcome's switch and to Settings (W8).
- **1.x answers.** An explicit `false` stays `no`. Anything else on a 1.x profile is `unknown` until the update welcome's switch (spec Open Question 2).
- **Not changed:** what the existing events carry, and GeoIP. Both are listed for the privacy note to the Development manager (E6).
- **Tests:** `analytics/consent.test.ts` and an extended `analytics.test.ts`: no send before an answer, none after a no, held events sent once at a yes and dropped at a no, `build_channel` on every event, the kill switch winning over a yes.

## Workstream 2: Retiring the Getting Started page (R12)

Per `research/getting-started-retirement-audit.md`:

- **Patch 001** loses `gettingStartedGuide.css` (a file it creates), its hunks in `gettingStarted.ts`, `gettingStarted.css` and the `startupEditor` default. 001's other branding (fonts, codicons, the splash colours, About, icons, themes, breadcrumbs) is untouched.
- **Patch 016** keeps its Source Control hunks (the Git download button and the Git strings) and loses its Getting Started hunks.
- **Patch 017** only changes the Launch check's Node line, so it is retired, and the `nodeRequired` rule moves to the welcome and Settings (W8).
- **`workbench.startupEditor: none`** is set where the audit shows it wins at start-up (expected: `branding/product.json`'s `configurationDefaults`, live on desktop through 013).
- **Every way in** opens Ritemark's welcome or is gone. Where a VS Code command can still open Getting Started, the smallest change is a hunk in the file 001 already owns (`gettingStarted.contribution.ts`) that runs `ritemark.welcome.open` instead; the audit names the commands.
- `scripts/apply-patches.sh` stops copying the welcome SVGs; `branding/welcome/` keeps the header illustration the welcome uses (resized, W3).
- `scripts/check-patch-stacking.mjs`: the known pairs `001 → 016`, `001 → 017` and `016 → 017` are removed or narrowed to what remains.
- `PATCH-RULES.md` §8's rule for consolidation applies to 001: its file list is counted before and after.

## Workstream 3: The welcome page (R1, R2, R5)

- **Host.** `src/welcome/WelcomePanel.ts` (new) opens a webview panel, view type `ritemark.welcome`, in the first group, with the shared bundle (`<div id="root" data-editor-type="welcome">`, nonce and CSP as `taskBoard/boardSurface.ts:198–228`). `retainContextWhenHidden` is on, so a sign-in's progress survives a moment in the background.
- **When it opens.** In `activate`, after the update detection (W6): a window with no folder opens it (on step 1 until the profile has finished the welcome, on step 2 after), closes both side columns for it and sets the context key `ritemark.welcomeAlone`. The AI sheet's 4 s focus (`extension.ts:329–331`) and the start-up layout writes (`:318–326`) skip while it is open.
- **The welcome alone** (018, per `research/welcome-alone-audit.md`): while `ritemark.welcomeAlone` is true and the welcome is the only editor, a class on the workbench hides the desk's strip and sheet and the status bar; the ground, the traffic lights and Windows' window buttons stay. The class goes as soon as anything else opens.
- **Protocol.** `src/welcome/protocol.ts` (new): an exact-field union of messages, decoded on both sides as the task board's `protocol.ts` does. Host → page: `welcome/state` (kind, step, providers, projects, usage-data answer, missing tools). Page → host: `welcome/sign-in`, `welcome/cancel-sign-in`, `welcome/reopen-sign-in`, `welcome/set-up-opencode`, `welcome/api-keys`, `welcome/skip`, `welcome/open-folder`, `welcome/new-project`, `welcome/open-recent`, `welcome/usage-data`, `welcome/open-link`.
- **State.** `src/welcome/welcomeState.ts` (new, no `vscode` import): the kind (`fresh`, `update`, `done`), the step, each provider's state, and the transitions; unit tested.
- **Page.** `webview/src/components/welcome/` (new): `WelcomeSheet`, `ProviderCard`, `ProviderRow` (the update sheet's rows), `ProjectRow`, `UsageDataSwitch`, from the UI components (`ui/button.tsx`, `ui/tooltip.tsx`, the dialog primitives where they fit). Space Grotesk 40 for the title only; everything else in Sofia Sans.
- **The header illustration** is a resized copy of `branding/welcome/ritemark-welcome-hero-bg.png` (6.7 MB today) at 1280 wide, as WebP or JPEG, under `extensions/ritemark/media/welcome/`, loaded through the webview's resource roots; never inlined into `webview.js` (E4).
- **API keys** opens the Anthropic key entry Settings already has (the Claude card's "Use Anthropic API key" input, `RitemarkSettingsProvider.ts:955–973`), or Settings' API keys section, as the Experience lead answers.
- **Skip for now** moves to step 2 with no provider; the AI sheet keeps its `OnboardingWizard` for later.

## Workstream 4: Provider states (R3, R4)

- `src/welcome/providerStatus.ts` (new) asks each provider through the code that answers today, never a second copy: Claude through `agent/setup.ts`'s cached detection, ChatGPT through `CodexAuth.getStatus`, OpenCode through `runtime/availability.ts`. Each answer is posted to the page as it arrives.
- A check still running after 20 s is shown as not answered, with Try again; the check itself is left to finish or time out on its own.
- Offline comes from `ai/connectivityPolicy.ts`'s existing state; the rows then say Not checked yet and the checks run when the connection is back.
- **Signing in** calls the same entry points as Settings: `startClaudeLoginFromCommand` (`RitemarkSettingsProvider.ts:858–880`) and Codex's `account/login/start` (`:882–897`). Their progress (the link opened, the backup link, done, failed, cancelled) is mapped to the card's states. Cancel stops the sign-in's subprocess (Claude) or stops waiting (ChatGPT). "Open the page again" opens the same link again.
- **Words.** A small table in `src/welcome/words.ts` maps each provider's failure to one sentence, with no error code and no "authenticated".

## Workstream 5: Set up project and the landing (R5, R6)

- **Open a folder…** shows the system's folder picker (`vscode.window.showOpenDialog`, folders only).
- **Start a new project** (`src/welcome/newProject.ts`, new, reused by Sprint 134's Add a project…) asks for a name in place on the sheet, checks it (no existing folder, no character the system refuses), and creates `<Documents>/Ritemark/<name>`. `<Documents>` is the system's Documents folder (`os.homedir()/Documents` on the Mac; the known folder on Windows, which a OneDrive-moved Documents folder can change, so it is read, not assumed). It then writes About this project as Jarmo decides (spec Open Question 4).
- **The landing.** Before opening the folder, `src/welcome/landing.ts` (new) writes `ritemark.welcome.landing.v1` to globalState: the folder's URI, the provider, whether Ritemark created the project, and the time. Then `vscode.openFolder(uri, { forceNewWindow: false })`.
- **After the reload**, `activate` reads the landing. If it names this window's folder and is younger than 10 minutes, it:
  - shows Documents (`workbench.view.explorer`);
  - opens the AI's sheet on a new chat with that provider, its placeholder naming the project (through the sheet's existing new-chat path and its runtime selection, with the project's name sent in the bootstrap);
  - opens About this project on the desk when Ritemark created the project;
  - sends `project_opened` through the gate;
  - deletes the landing.
  A landing for a folder that is gone shows a notification and opens the welcome's step 2. A landing that does not match, or is old, is deleted and ignored.
- Step 3 (Sprint 134) adds "open Home first" here.

## Workstream 6: Updating from 1.x (R10)

- **Detection** (`src/welcome/updateDetection.ts`, new, read before `extension.ts:265` overwrites the activation keys): a profile is a 1.x profile when `ritemark.activation.lastConfirmedVersion` is set and below 2.0.0 and the welcome has never finished on it (`ritemark.welcome.finished` absent). A fresh profile has neither.
- **When it shows.** On that profile's first start of this build, whether or not the window restored a folder. With a folder, the update sheet opens as a tab over the restored window with the columns closed (as W3), and the window's own tabs stay behind it.
- **Your AI** lists the providers the profile can use (W4's states), with Add another, which shows step 1's cards in the same sheet.
- **Projects.** Up to three recent folders. The one the window restored, if any, is first with "Open when you left"; otherwise the most recent. The list comes from VS Code's recent folders (`_workbench.getRecentlyOpened`, the internal command 1.x's Home already uses at `HomeViewProvider.ts:163–181`; Sprint 134 replaces it with Ritemark's own project list).
- **Open when you left** closes the sheet, reopens the columns and leaves the window as it was: no reload. Any other row goes through W5's landing.
- **Finished.** Picking a project writes `ritemark.welcome.finished` (with the kind and the time). It also writes `ritemark.updatedFrom1x` for Sprint 134's What moved card.

## Workstream 7: A first window with a file, and #429 (R11)

- The welcome opens only in a window with no folder (W3). A fresh profile whose first window has a folder or a file leaves the welcome for the next window with no folder, until `ritemark.welcome.finished` is written; the AI sheet's existing onboarding offers the sign-ins meanwhile. (Spec Open Question 6.)
- **The healer** (`extension.ts:291–312`, `utils/stickyTabHealer.ts`): after `vscode.openWith(uri, 'ritemark.editor')` succeeds, it closes the plain-text tab it replaced (`vscode.window.tabGroups.close(tab)`), keeping the Ritemark tab in the text tab's place. The pure selection function gains the "replace" result and its test.
- **Proof.** The issue's deterministic reproduction becomes a scripted check on a fresh profile (S39), and 25 fresh launches with a `.md` are run in the background (memory: no pop-up test windows).

## Workstream 8: Settings (R7, R12)

- Ritemark Settings gains:
  - **Usage data**: the same switch and words as the welcome, with the Privacy Policy and Terms of Use links; it writes `ritemark.analytics.enabled` through the gate (W1);
  - **This computer**: Git found or missing, and Node.js when `nodeRequired`, from `ritemark.getHealthStatus`, in words only (patch 016's Store rule: no download or install link).
- The sign-in cards Settings has stay as they are.
- The full Settings redesign (experiences/settings) is not in this sprint.

## Workstream 9: A file's extension in muted ink (R13)

Per `research/muted-extension-audit.md`. Expected shape: one hunk in 018 where the resource label renders a file's name, splitting it at the last dot into the name and `<span class="label-extension">`, with filter highlights split the same way; no split for names with no dot or a leading dot only; and rules in `ritemarkSurfaces.css` that colour `.label-extension` with the theme's muted ink, except on the chosen tab and the open row. A VS Code unit test covers the split (names with several dots, a leading dot, none, highlights across the dot).

## Workstream 10: Windows and #401 (R15)

- Before the merge, the extension side is tried through the test overlay (`windows-test-overlay.yml`) on the latest Windows build from main. The Getting Started page may still show in that round (its retirement is shell), unless the audit finds the start-up default can be set from the extension.
- After the merge, a Windows build from main (`build-windows.yml` with `source_commit`) for S45–S47 and the shell parts.
- **#401**, per its audit: if Ritemark's `activate` holds the extension host (a synchronous probe or binary step), it is moved off the start path or made asynchronous in this sprint, as `utils/runProcess.ts` did for the setup probes in v1.12.0 (#366, #367). Either way, the welcome draws from its own page at once, queues a click on Sign in until the host answers, and shows Checking… meanwhile.

## Workstream 11: Tests, docs and builds (E3–E7)

- **Extension unit tests** (added to `package.json`'s `test` script): `welcome/welcomeState.test.ts`, `welcome/landing.test.ts`, `welcome/updateDetection.test.ts`, `welcome/protocol.test.ts`, `analytics/consent.test.ts`, the extended `analytics.test.ts`, `utils/stickyTabHealer.test.ts` (the replace case).
- **Webview tests:** the welcome's words (no "Codex", no "authenticated"), the provider card's states.
- **VS Code unit test:** the muted extension's split (W9).
- **CDP checks** (`scripts/qa/`): the welcome alone (the sheet 640 wide and centred; no strip, sheet or status bar measured), the landing's state after the reload, the update sheet on a v1.14.0 profile.
- **Screenshots:** the baseline from Sprint 132 gains the welcome's step 1, step 2 and the update sheet, light and dark.
- **Bundle:** `media/webview.js` before and after, in the sprint's QA evidence.
- **Docs:** `architecture.md` (a "Welcome and usage data" section and the version-history row), `CLAUDE.md`'s patch table and count (017 retired; 001 and 016 described again), `PATCH-RULES.md`'s table, `references/layout-invariants.md` (the welcome alone), and the welcome's states in the release plan's Gate 2 checklist.
- **Builds:** after the merge, a production build from a clean-room worktree at the merged commit (`create-release-worktree.sh`, `build-prod.sh`), as a build check only; all patches dry-apply and apply on the pin, a second `apply-patches.sh` run is clean, the stacking check passes; then the drift check (`scripts/check-vscode-drift.sh`) into the release plan's risk register.

## Delivery plan: one merge

The shell part is small (patches 001, 016, 017 shrink; 018 gains two hunks), so the sprint merges once:

1. Before the merge: Mac QA (S1–S44), an overlay round on Windows for the extension side.
2. The merge.
3. After it: the production build check, the Windows round from main (S45–S47 and the shell parts), and the drift check. Fixes from the Windows round go in a small follow-up PR on the same sprint.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| A VS Code route still opens Getting Started after 001's hunks go | The retirement audit lists every route; S40 tries each |
| The start-up default is read before the extension's defaults, so Getting Started flashes | The audit decides where the default lives (expected: `product.json` through 013) |
| The welcome alone needs a shell hook, and the frame jumps when the first project opens | Audit first; CDP check of the frame before and after the landing |
| A sign-in flow behaves differently from inside the welcome (focus, the browser, the backup link) | The same entry points as Settings; S8–S11 on both providers; on Windows in the overlay round |
| Turning usage data opt-in drops PostHog's numbers sharply | Expected and intended (Jarmo's rule); the Development manager tells the people who read the numbers |
| The healer's change closes a tab the person wanted as text | It closes only the text tab it has just replaced, once per profile, as Sprint 107 R3's named trade-off already says |
| #401 is outside Ritemark | Recorded in the issue; R15's guarantee holds either way |
| The bundle grows | The illustration is a file, not inlined; measured before and after |
