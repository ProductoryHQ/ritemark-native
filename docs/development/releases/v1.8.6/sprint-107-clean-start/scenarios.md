# Sprint 107 Scenarios

BDD examples pinning [spec.md](./spec.md). These are the manual QA matrix for the QA/closeout phase in [tasks.md](./tasks.md); starred (★) scenarios are the minimum regression set to re-run before every future release that touches `patches/`, `branding/product.json`, or the daemon scheduler. Seeded from the analysis doc's QA section, expanded per requirement with negative/hostile paths per SDD discipline.

Fixture: a fresh `--user-data-dir` profile and a loose `notes.md` file, matching the analysis doc's exact repro setup, plus a second fixture workspace folder containing `.agents/nightly-summary.md` with a valid `schedule:` frontmatter block (for R2 scenarios).

## Feature: Effective `product.json` defaults on first launch (R1)

### ★ Scenario: Fresh profile, double-click `.md` from Finder/Explorer
Given a brand-new Ritemark profile with an empty `editorOverrideService.cache`
When the user double-clicks a `.md` file in Finder (or Explorer on Windows)
Then Ritemark launches with that file already open in the Ritemark WYSIWYG editor
And no plain-text editor is shown at any point, even momentarily
And no Restricted Mode badge appears
And no workspace-trust modal appears

### Scenario: Other product.json-mapped file types resolve correctly on first launch
Given the same fresh-profile conditions
When the user opens a `.csv`, `.xlsx`, `.pdf`, `.docx`, or `.flow.json` file as the startup file
Then each opens directly in its mapped Ritemark viewer (`ritemark.editor` / `ritemark.excelViewer` / `ritemark.pdfViewer` / `ritemark.docxViewer` / `ritemark.flowEditor`) on the very first launch

### Scenario: Second launch, same profile
Given the profile from the first scenario has now launched once successfully
When the user double-clicks the same (or a different) `.md` file again
Then Ritemark opens it in the Ritemark editor again
And no sticky plain-text tab exists to interfere (nothing to heal — R1 prevented the tab from ever getting stuck)

### Negative scenario: Unmapped file types are unaffected
Given the same fresh profile
When the user opens a file type that is NOT in product.json's `configurationDefaults.workbench.editorAssociations` (e.g. a `.txt` or `.json` file)
Then it opens in the plain-text editor exactly as before this sprint
And no new default silently redirects it elsewhere

### Negative scenario: Manual "Reopen With -> Text Editor" still works
Given a `.md` file currently open in the Ritemark editor
When the user explicitly chooses "Reopen With..." and selects "Text Editor"
Then the file reopens in the plain-text editor for that tab
And this per-tab override is respected until the user closes the tab or reopens the file fresh

### Scenario: Windows Explorer parity
Given the win32-x64 shell build with patch 013 applied
When the user double-clicks a `.md` file in Windows Explorer on a fresh profile
Then the result matches the macOS scenario above exactly (Ritemark editor, no text-editor flash, no trust modal)

## Feature: Trust posture stays off (R2)

### ★ Scenario: No trust noise, any launch shape
Given patch 013 is applied and `security.workspace.trust.enabled` is now an effective default of `false`
When the user opens a loose file, an empty window, or a folder — in any combination, first launch or the hundredth
Then no "do you trust the authors of this workspace" modal ever appears
And no Restricted Mode badge ever appears
And the terminal (if it auto-creates) does not fail to launch with an untrusted-workspace error

### ★ Scenario: Untrusted folder's scheduled agent does not auto-run without consent
Given a workspace folder containing `.agents/nightly-summary.md` with a valid `schedule:` frontmatter block, never opened in Ritemark before
When the user opens that folder
Then the daemon scheduler discovers the file (it is visible in Agent Library as a defined scheduled agent)
But no cron timer is armed for it and it does not fire on its schedule
And the user is shown a way to grant scheduling consent for this workspace (mechanism per the chosen product decision, D1)

### Scenario: Granting consent arms the schedule
Given the scenario above, with the consent prompt visible
When the user grants scheduling consent for this workspace
Then the agent file is registered and will fire on its next scheduled occurrence
And this consent decision is visible and revocable later in the Agent Library view

### Scenario: Declining consent leaves the workspace dormant, not silently retried
Given the same untrusted-folder scenario
When the user declines (or dismisses without deciding)
Then the scheduled agent remains dormant — no cron timer armed
And the workspace is not silently re-prompted on every file save or every app restart in a way that feels like nagging (exact re-prompt cadence is an implementation detail, but "never fires without an explicit grant" must hold regardless of cadence)

### Negative scenario: Consent gate does not touch interactive or already-approved-action flows
Given a workspace with scheduling consent NOT yet granted
When the user manually opens a chat and talks to an agent interactively (not schedule-triggered)
Then the interactive conversation works exactly as it does today, gated only by the existing unified approval gate — the R2 consent gate never applies to interactive use
And when a scheduled run IS permitted to fire (consent granted) and it attempts a file write or shell command, the existing `ritemark.daemon.approveScheduledAction` modal still gates that action exactly as before — R2 adds nothing and removes nothing at that layer

## Feature: Sticky-tab healer (R3)

### ★ Scenario: Upgrade path — existing stuck text tab gets healed
Given a profile that predates this sprint, with a `.md` file's tab stuck open in the plain-text editor (the mechanism-2 bug from the analysis doc)
When the user updates to the version shipping this sprint and relaunches
Then, once during that activation, the stuck tab is closed and reopened in the Ritemark editor automatically
And the tab's position (group/column) and pinned state are preserved as closely as possible
And no error or visible flicker/notification interrupts the user

### Scenario: Healer runs exactly once per profile
Given the healer already ran once on this profile
When the user relaunches again
Then the healer does not re-scan or attempt to heal anything a second time
And a `.md` tab the user has since deliberately reopened as Text Editor is left alone (it is not "already healed", it's a fresh choice made after the one-shot marker was set)

### Negative scenario: Healer ignores non-candidate tabs
Given a mix of open tabs: a stuck `.md` text tab, an open `.txt` file, an open diff editor, and an untitled buffer
When the healer runs
Then only the `.md`/`.markdown` text tab is migrated
And the `.txt` file, the diff editor, and the untitled buffer are untouched

### Negative scenario: Healer is a no-op on a clean profile
Given a profile created fresh after this sprint ships (R1 already prevents any tab from getting stuck)
When the healer runs during activation
Then it finds zero candidate tabs and does nothing observable

## Feature: "Claude is ready" welcome card removed (R4)

### ★ Scenario: Ready agent goes straight to chat
Given Claude Code is installed, authenticated, and `setupStatus.state === 'ready'`
And the user has no existing conversation yet in this sidebar session
When the AI sidebar renders
Then the user sees the normal empty-chat composer directly
And no "Claude is ready" / "Get Started" / "Technical details" card is shown at any point

### Negative scenario: Genuine setup states are unaffected
Given Claude Code is NOT installed, OR the binary is broken, OR authentication is required
When the AI sidebar renders
Then `<SetupWizard />` still renders with the matching state (Install Claude / Could not verify Claude / Sign in with Claude.ai, etc.) exactly as before this sprint

### Negative scenario: First-run onboarding is unaffected
Given no agent is ready yet on a brand-new install (`onboardingStatus.anyAgentReady === false`)
When the AI sidebar renders
Then `<OnboardingWizard />` renders exactly as before this sprint — this path is untouched by R4

### Negative scenario: Codex and OpenCode setup views are unaffected
Given the active runtime is Codex with `codexStatus.state !== 'ready'`, or OpenCode with no configured provider
When the AI sidebar renders
Then `<CodexSetupView />` or `<OpenCodeSetupView />` renders exactly as before this sprint

## Cross-cutting end-to-end scenario

### ★ Scenario: The original complaint, resolved
Given a completely fresh Ritemark profile (the exact state of a brand-new user)
When the user double-clicks a `.md` file in Finder/Explorer for the very first time
Then the file opens directly in the Ritemark WYSIWYG editor
And there is no trust modal, no Restricted Mode badge, no plain-text flash
And if this is also the user's first time seeing a ready Claude agent with no conversation yet, the sidebar shows the normal composer, not a welcome card
And relaunching later reproduces the same clean result — nothing about this experience is "sometimes broken, sometimes fine"
