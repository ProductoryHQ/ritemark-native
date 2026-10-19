# Sprint 133 Tasks

Jarmo approved the sprint plan on 18 October ("approved with your proposals"), after Sprint 132's two merges. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [x] Sprint 132's merge 2 is on `origin/main` (`cb59f4cd`, then #450 and #451; the branch starts at `de2b7d6b`)
- [x] `git checkout -b sprint-133-welcome` from `origin/main`; `git branch --show-current` shows it
- [x] VS Code at the pin with patches 001–019 from reset + clean + apply (copy-on-write clone for the worktree)
- [x] Record patch 001's and 016's file lists and hunk counts in `notes/patches-before.md` (`PATCH-RULES.md` §8)
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [x] The Experience lead asked, through the Development manager, to draft the sample project's content, as they offered (R5). Written and approved by Jarmo, 18 October

## Phase 1: Audits first

- [x] `research/getting-started-retirement-audit.md` (W2, R12): the hunks of 001, 016 and 017 sorted; every route into Getting Started; `IOnboardingService` (007); where `workbench.startupEditor: none` wins; the stacking check's pairs
- [x] `research/welcome-alone-audit.md` (W3, R1, R6): the context key and the class; what it hides; the traffic lights and Windows' buttons; no jump at the landing; the empty desk's tiles
- [x] `research/muted-extension-audit.md` (W9, R13): the label path for the tree and the tabs; highlights; the hunk's shape
- [x] `research/ext-host-start-401-audit.md` (W10, R15): a CPU profile of a fresh profile's first seconds on the Mac (done 18 October); on Windows, the first start after a clean install with Defender on (process start to extension host, MsMpEng's CPU, a CPU profile, then a second start to compare), through the Development manager's Windows session; the decision — Windows round 2's numbers in; decided 18 October: Defender's first reads, not Ritemark's code
- [x] `research/confirmations.md`: the 1.x signal (`lastConfirmedVersion`); 1.x's usage-data keys on v1.14.0 profiles after OK, Opt Out, the toast's × and no answer; the sign-in entry points and their progress events; how the healer closes the text tab
- [x] The sample project's content (R5): written by the Experience lead and approved by Jarmo, 18 October (`ritemark-dev` 70701c1, `product/design/experience/sample-project/Leadership programme`). Copied as it is into `extensions/ritemark/sample-project/`, with `.ritemark/tasks/` and the one-line `CLAUDE.md`; checked that every card parses, and that no real person's name, path or account is in it
- [x] The 1.x OK reading decided by Jarmo (18 October): a notice closed without Opt Out counts as the OK (technical-plan.md, W1); write it into `research/confirmations.md` (R7)
- [x] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol): none did; the plan's refinements are in technical-plan.md, *What the audits changed*

## Phase 2: Consent and events (W1)

- [x] `analytics/consent.ts`: the gate; `ritemark.analytics.enabled` default false in `package.json`; the kill switch through `isEnabled('analytics')` (R7, E1)
- [x] `posthog.ts`: the client made only after a yes; every send through the gate; the notice retired and `hasSeenNotice` no longer written (R7)
- [x] The 1.x answers: read once before the gate starts (`hasSeenNotice`, `inspect('analytics.enabled')`); a carried-over yes written as `analytics.enabled: true` and `answeredV2` from 1.x; an Opt Out or no answer off; the closed-notice case as decided (R7, E1)
- [x] `analytics/welcomeEvents.ts`: held events, sent at a yes, dropped at a no (R8; Jarmo, 18 October: hold and send) — the held events live in `consent.ts`'s gate (`trackWelcome`, `dropHeld`), no separate file
- [x] `events.ts`: `welcome_shown`, `ai_signed_in`, `project_opened`, `first_message_sent` with R8's properties
- [x] `first_message_sent` from the AI sheet's host, once per profile (R8)
- [x] `build_channel` in the shared properties (R9)
- [x] `consent.test.ts`, `analytics.test.ts` extended (E1)

## Phase 3: Getting Started retires (W2)

- [x] 001: the Getting Started hunks removed per the audit; file list diffed against `notes/patches-before.md`
- [x] 016: only the Source Control hunks kept
- [x] 017: retired; `CLAUDE.md`'s and `PATCH-RULES.md`'s patch tables updated
- [x] `workbench.startupEditor: none` where the audit says
- [x] Every route into Getting Started opens Ritemark's welcome or is gone (S40)
- [x] `apply-patches.sh` no longer copies the welcome SVGs; `check-patch-stacking.mjs`'s known pairs updated
- [x] Dry run, real apply from pristine, a second run clean; `compile-check-ts-native` green

## Phase 4: The welcome (W3, W4, W5)

- [x] `src/welcome/protocol.ts` + test — its decoder's tests are in `welcomeState.test.ts`
- [x] `src/welcome/welcomeState.ts` + test (R1, R2, R5)
- [x] `src/welcome/WelcomePanel.ts`: the panel in the shared bundle; opened for a window with no folder; columns closed; `ritemark.welcomeAlone` (R1) — `welcomePanel.ts` (the HTML) and `welcomeHost.ts` (the controller)
- [x] `extension.ts`: the AI sheet's 4 s focus and the start-up layout writes skip while the welcome is open (R1)
- [x] 018: the welcome alone, per its audit (R1)
- [x] 018: an empty desk's three tiles running the +'s commands (R6)
- [x] The finished profile's "Where do you want to start?" sheet (R1)
- [x] `webview/src/main.tsx`: the `welcome` root
- [x] `webview/src/components/welcome/`: `WelcomeSheet`, `ProviderCard`, `UsageDataSwitch`, step 1 and step 2 (R1, R2, R5, R7) — `WelcomePage.tsx`, `WelcomeParts.tsx`, `welcome.css`, `welcomeCopy.ts`, `welcomeClient.ts`
- [x] `media/welcome/`: the resized header illustration (E4)
- [x] `src/welcome/providerStatus.ts`: the three providers through their existing checks; 20 s Try again; offline (R4) — in `welcomeHost.ts` through the AI sheet's `runtimeAvailability`, the pure part in `welcomeState.ts`
- [x] Sign in, Cancel and Open the page again for Claude and ChatGPT through Settings' entry points; OpenCode's Set up (R3)
- [x] `src/welcome/words.ts`: failures in one sentence each (R3)
- [x] The small sheets over the welcome: API keys (the Anthropic key) and OpenCode's Set up, with Done (R2, R3)
- [x] `src/welcome/newProject.ts` + test: the name field, Create, the place line and Change…, the name check, an empty `<Documents>/Ritemark/<name>` (R5)
- [x] `src/welcome/sampleProject.ts` + test: Try the sample project copies `extensions/ritemark/sample-project/` into `<Documents>/Ritemark/Leadership programme`, never writing over a folder, the next free name, the cards' `created` and `updated` set to the time of copying, a failed copy in one sentence, then the landing with `source: sample` (R5, R6, R8)
- [x] `scripts/check-bundled-extension-complete.sh`: fails when the sample is missing from the bundled extension (R5)
- [x] The missing Git or Node line under "Signed in to Claude": its words, Use Ritemark's own Claude, Restart (R5)
- [x] `src/welcome/landing.ts` + test: written before `openFolder`, read after the reload, Documents, the AI's new chat ("Ask Claude about this project"), the empty desk, `project_opened`, deleted (R6)

## Phase 5: Updating, the first window with a file, Settings, the extension (W6, W7, W8, W9)

- [x] `src/welcome/updateDetection.ts` + test, read before `extension.ts:265` (R10)
- [x] The update sheet: Your AI rows, Add another, up to three projects, Open when you left without a reload, Open another folder…, Start a new project, the switch with the 1.x answer and its words (R7, R10)
- [x] `ritemark.welcome.finished` and `ritemark.updatedFrom1x` written when a project is picked (R10)
- [x] A fresh profile's first window with a file or folder leaves the welcome for later (R11)
- [x] `utils/stickyTabHealer.ts` + `extension.ts`: the healer closes the text tab it replaced; test (R11, #429)
- [x] Ritemark Settings: Usage data with the links; Git and Node rows under the runtime choice, for this computer's runtime only (R7, R12)
- [x] 018: the muted extension per its audit; its VS Code unit test (R13)
- [x] #401: the fix in `activate` if the audit finds one in Ritemark's code; the welcome's queued click either way (R15) — the welcome's side is in (a Sign in click shows Checking… until the host answers; the Mac's profile found nothing in `activate`); nothing to move in `activate` (the audit's decision)

## Phase 6: QA, merge and closeout

- [x] CDP checks in `scripts/qa/`: the welcome alone, the landing, the update sheet (E3) — `welcome-check.mjs`, `welcome-screenshots.mjs`
- [ ] The screenshot baseline gains the welcome's frames, light and dark (E3) — captured in `qa-evidence/` (light and dark: step 1, step 2, update on and off, start); into `frame-baseline/` only with Jarmo's approval
- [x] `media/webview.js` measured after; `notes/bundle.md` (E4)
- [x] Docs: `architecture.md`, `CLAUDE.md`'s patch table, `PATCH-RULES.md`, `references/layout-invariants.md` (E6)
- [x] Manual QA on the Mac: S1–S44, S48–S53; evidence in `qa-evidence.md` — every scenario recorded, with what could not be run here and why
- [ ] Windows overlay round before the merge: S45, S46 on the extension side
- [x] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree at the merged commit (E5)
- [ ] After the merge: Windows round from main: S45–S47 and the shell parts (Getting Started gone, the welcome alone, the muted extension); findings in `qa-evidence.md`
- [ ] After the merge: the drift check into the release plan's risk register (E7)
- [ ] PostHog: the four events seen live after a yes on a production build; none before an answer or after a no; a 1.x OK sending from the first start (S24–S30, S52, S53)
- [ ] Linked issues closed with evidence: [#429](https://github.com/ProductoryHQ/ritemark-native/issues/429), [#338](https://github.com/ProductoryHQ/ritemark-native/issues/338); [#401](https://github.com/ProductoryHQ/ritemark-native/issues/401) closed or updated with the audit
- [ ] The privacy note (opt-in, `build_channel`) sent to the Development manager for ritemark.app (E6)
- [x] `docs/CHANGELOG.md` and the v2.0.0 release-notes draft
- [ ] Release plan: tracker, feature-complete rows and risk register updated
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
