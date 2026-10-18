# Sprint 133 Tasks

Nothing here starts before Jarmo approves the sprint plan, and not before Sprint 132 is merged (both merges). Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [ ] Sprint 132's merge 2 is on `origin/main`
- [ ] `git checkout -b sprint-133-welcome` from `origin/main`; `git branch --show-current` shows it
- [ ] VS Code at the pin with patches 001–019 from reset + clean + apply (copy-on-write clone for the worktree)
- [ ] Record patch 001's and 016's file lists and hunk counts in `notes/patches-before.md` (`PATCH-RULES.md` §8)
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)

## Phase 1: Audits first

- [ ] `research/getting-started-retirement-audit.md` (W2, R12): the hunks of 001, 016 and 017 sorted; every route into Getting Started; `IOnboardingService` (007); where `workbench.startupEditor: none` wins; the stacking check's pairs
- [ ] `research/welcome-alone-audit.md` (W3, R1): the context key and the class; what it hides; the traffic lights and Windows' buttons; no jump at the landing
- [ ] `research/muted-extension-audit.md` (W9, R13): the label path for the tree and the tabs; highlights; the hunk's shape
- [ ] `research/ext-host-start-401-audit.md` (W10, R15): a CPU profile of a fresh profile's first seconds on the Mac; the Windows profile through the Development manager's Windows session; the decision
- [ ] `research/confirmations.md`: the 1.x signal (`lastConfirmedVersion`); the sign-in entry points and their progress events; how the healer closes the text tab
- [ ] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol)

## Phase 2: Consent and events (W1)

- [ ] `analytics/consent.ts`: the gate; `ritemark.analytics.enabled` default false in `package.json`; the kill switch through `isEnabled('analytics')` (R7, E1)
- [ ] `posthog.ts`: the client made only after a yes; every send through the gate; the notice and `hasSeenNotice` retired (R7)
- [ ] `analytics/welcomeEvents.ts`: held events, sent at a yes, dropped at a no (R8; per Jarmo's answer to Open Question 1)
- [ ] `events.ts`: `welcome_shown`, `ai_signed_in`, `project_opened`, `first_message_sent` with R8's properties
- [ ] `first_message_sent` from the AI sheet's host, once per profile (R8)
- [ ] `build_channel` in the shared properties (R9)
- [ ] `consent.test.ts`, `analytics.test.ts` extended (E1)

## Phase 3: Getting Started retires (W2)

- [ ] 001: the Getting Started hunks removed per the audit; file list diffed against `notes/patches-before.md`
- [ ] 016: only the Source Control hunks kept
- [ ] 017: retired; `CLAUDE.md`'s and `PATCH-RULES.md`'s patch tables updated
- [ ] `workbench.startupEditor: none` where the audit says
- [ ] Every route into Getting Started opens Ritemark's welcome or is gone (S40)
- [ ] `apply-patches.sh` no longer copies the welcome SVGs; `check-patch-stacking.mjs`'s known pairs updated
- [ ] Dry run, real apply from pristine, a second run clean; `compile-check-ts-native` green

## Phase 4: The welcome (W3, W4, W5)

- [ ] `src/welcome/protocol.ts` + test
- [ ] `src/welcome/welcomeState.ts` + test (R1, R2, R5)
- [ ] `src/welcome/WelcomePanel.ts`: the panel in the shared bundle; opened for a window with no folder; columns closed; `ritemark.welcomeAlone` (R1)
- [ ] `extension.ts`: the AI sheet's 4 s focus and the start-up layout writes skip while the welcome is open (R1)
- [ ] 018: the welcome alone, per its audit (R1)
- [ ] `webview/src/main.tsx`: the `welcome` root
- [ ] `webview/src/components/welcome/`: `WelcomeSheet`, `ProviderCard`, `UsageDataSwitch`, step 1 and step 2 (R1, R2, R5, R7)
- [ ] `media/welcome/`: the resized header illustration (E4)
- [ ] `src/welcome/providerStatus.ts`: the three providers through their existing checks; 20 s Try again; offline (R4)
- [ ] Sign in, Cancel and Open the page again for Claude and ChatGPT through Settings' entry points; OpenCode's Set up (R3)
- [ ] `src/welcome/words.ts`: failures in one sentence each (R3)
- [ ] API keys: the Anthropic key entry (R2)
- [ ] Start a new project: name check, `<Documents>/Ritemark/<name>`, About this project per Jarmo's answer (R5)
- [ ] The missing Git or Node line on step 2 (R5)
- [ ] `src/welcome/landing.ts` + test: written before `openFolder`, read after the reload, Documents, the AI's new chat naming the project, About this project, `project_opened`, deleted (R6)

## Phase 5: Updating, the first window with a file, Settings, the extension (W6, W7, W8, W9)

- [ ] `src/welcome/updateDetection.ts` + test, read before `extension.ts:265` (R10)
- [ ] The update sheet: Your AI rows, Add another, up to three projects, Open when you left without a reload, Open another folder…, Start a new project, the switch (R10)
- [ ] `ritemark.welcome.finished` and `ritemark.updatedFrom1x` written when a project is picked (R10)
- [ ] A fresh profile's first window with a file or folder leaves the welcome for later (R11)
- [ ] `utils/stickyTabHealer.ts` + `extension.ts`: the healer closes the text tab it replaced; test (R11, #429)
- [ ] Ritemark Settings: Usage data with the links; This computer with Git and Node (R7, R12)
- [ ] 018: the muted extension per its audit; its VS Code unit test (R13)
- [ ] #401: the fix in `activate` if the audit finds one in Ritemark's code; the welcome's queued click either way (R15)

## Phase 6: QA, merge and closeout

- [ ] CDP checks in `scripts/qa/`: the welcome alone, the landing, the update sheet (E3)
- [ ] The screenshot baseline gains the welcome's frames, light and dark (E3)
- [ ] `media/webview.js` measured after; `notes/bundle.md` (E4)
- [ ] Docs: `architecture.md`, `CLAUDE.md`'s patch table, `PATCH-RULES.md`, `references/layout-invariants.md` (E6)
- [ ] Manual QA on the Mac: S1–S44; evidence in `qa-evidence.md`
- [ ] Windows overlay round before the merge: S45, S46 on the extension side
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; Jarmo's "admin merge"
- [ ] After the merge: a production build from a clean-room worktree at the merged commit (E5)
- [ ] After the merge: Windows round from main: S45–S47 and the shell parts (Getting Started gone, the welcome alone, the muted extension); findings in `qa-evidence.md`
- [ ] After the merge: the drift check into the release plan's risk register (E7)
- [ ] PostHog: the four events seen live after a yes on a production build; none before an answer or after a no (S24–S30)
- [ ] Linked issues closed with evidence: [#429](https://github.com/ProductoryHQ/ritemark-native/issues/429), [#338](https://github.com/ProductoryHQ/ritemark-native/issues/338); [#401](https://github.com/ProductoryHQ/ritemark-native/issues/401) closed or updated with the audit
- [ ] The privacy note (opt-in, `build_channel`) sent to the Development manager for ritemark.app (E6)
- [ ] `docs/CHANGELOG.md` and the v2.0.0 release-notes draft
- [ ] Release plan: tracker, feature-complete rows and risk register updated
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
