# Surfaces audit (W2d, R8)

Checked 2026-10-19 in the sprint worktree. `vscode/` holds both trees: the pin 1.117.0 (`10c8e557`) and the target 1.142.0 (`d956e8a6`). Line numbers are the target's `vscode/` unless a line says "pin". Nothing was launched and nothing was changed except this file.

Patches are read as they are on `HEAD` (`git show HEAD:patches/vscode/…`). The worktree's own copies of 001–006 were being rebased by another session while this was written, so they were not used as the reference.

How it was read:
- `git diff 10c8e557 d956e8a6` of the files named below, by hand.
- A scan of every `f1: true` command in `src/vs/{workbench,editor,platform}` at both commits (671 at the pin, 729 at the target), diffed by command ID.
- A scan of every configuration property with a `default` in the 154 files that register configuration, at both commits, diffed by key.
- Per-file counts of `MenuId.*`, `registerViewContainer`, `registerViews`, `StatusbarAlignment` and `registerWorkbenchContribution2` at both commits, then each new one read.
- The `package.json` of every built-in extension at both commits.

## Summary: what the sprint does

| # | Action | Where | Why (section) | Weight |
|---|---|---|---|---|
| A1 | Add `"sharedDataFolderName": ".ritemark-shared"` (name is a suggestion) | `branding/product.json` | New required product field, read without a guard while the main process starts. Without it, the storage service throws before any window opens, in dev and in production (§4.2) | **Blocker** |
| A2 | Add 5 API proposals to `extensionEnabledApiProposals["github.copilot-chat"]`: `agentsWindowConfiguration`, `authIssuers`, `chatInputNotification`, `envIsConnectionMetered`, `languageModelPricing` | `branding/product.json` | product.json's list wins over Copilot Chat's own. The Copilot Chat built for 1.142 asks for 65; our list has the pin's 60 (§4.3) | **Blocker for Copilot Chat** |
| A3 | Pin `"workbench.experimental.modernUI": false` | `branding/product.json` `configurationDefaults` | New, default `true`: floating cards with 4 px gaps, rounded corners, new font ramp, 28 px pane headers, 8 px scrollbars, restyled tabs, title bar and status bar (§3.1) | **Must** |
| A4 | Pin `"workbench.welcomePage.experimentalOnboarding": false` | same | Default flipped `false` → `true`. On a fresh profile the Copilot sign-in wizard opens over the workbench at first launch (§1.2, §6.3) | **Must** |
| A5 | Close the Agents window: make `OPEN_AGENTS_WINDOW_PRECONDITION` false in Ritemark; add its two command IDs to the palette filter; guard `windowsMainService.openAgentsWindow` | 003 (`chat/common/constants.ts`, `commandsQuickAccess.ts`, `windowsMainService.ts`) | "Chat: Open Agents Window" and "Chat: Open in Agents" now show in All commands. The pin hid them on stable; the target does not. `--agents` and `ritemark://` agent links now open it too (§1.1) | **Must** |
| A6 | Add 9 always-visible developer commands (and 14 more that show with Copilot Chat) to the palette filter | 003 (`commandsQuickAccess.ts`) | New since the pin; neither the ID list nor the prefixes catch them (§5.2) | **Must** |
| A7 | Pin `"onboarding.enabled": false` and `"update.showPostInstallInfo": false` | `branding/product.json` `configurationDefaults` | A new tour engine that "may appear automatically". The post-install hover fetches VS Code's "New in 1.142" notes on a major/minor version change, and 1.117 → 1.142 is one. Both are off today only through upstream's current defaults (§3.2) | Should |
| A8 | Re-base 007 onto the new files (§6) | 007 | `chat.contribution.ts` lost its registrations to `chat.shared.contribution.ts`. Its copy of the setup action uses `ChatConfiguration.AIDisabled`, which no longer exists | Must |
| A9 | Strip `mermaid-markdown-features` and `theme-modern-icons`; drop `mermaid-chat-features` from the strip list | `scripts/build-prod.sh:351`, `build-windows.yml` "Strip bundled copilot extension from output", and a new step in `build-macos-x64.yml` | Same as 1.x on the Mac: no VS Code Mermaid, no extra icon theme. Windows and macOS x64 strip less than the Mac arm64 build today (§2.3) | Should (Jarmo may choose "ship") |
| A10 | Merge `defaultChatAgent`: add `optimizeUsageDocumentationUrl`, `managedSettingsUrl`, `mcpConnectorsUrl`; drop `manageSettingsUrl`, `manageOverageUrl`, `completionsRefreshTokenCommand`. Leave out `provider.microsoft`, `trustedExtensionAuthAccess.microsoft`, `voiceWsUrl`, `sessionsWindowAllowedExtensions` | `branding/product.json` | Matches the new `IDefaultChatAgent`. The left-out fields would switch on a Microsoft sign-in probe and button, the Agents voice backend and the Agents window's extension list (§4) | Should |
| A11 | Optional pins: `"chat.titleBar.openInAgentsWindow.enabled": false`, `"update.titleBar": false`, `"workbench.browser.enableChatTools": false` (2c decides), `"terminal.integrated.resizeDimensionsOverlay.enabled": false` (Experience lead decides) | `branding/product.json` `configurationDefaults` | Cheap insurance, or new visible behaviour (§3) | Could |
| A12 | Re-base 013's `product.ts` hunk (its context moved: two interfaces were inserted above `IProductConfiguration`) | 013 | `configuration.ts` still has the same `DefaultConfiguration` anchor (§4.4) | Must |
| A13 | Update `PATCH-RULES.md` §2–§7 for 2.0 and for the items above | skill | §7 of this audit | Should |

Nothing found needs a new patch. Every hide goes into 003 or 007, or is a pin.

## 1. New ways into chat and agents

### 1.1 The Agents window (new and reachable)

1.142 ships a second workbench, the Agents window (`src/vs/sessions`). The build packs it into the app (`build/gulpfile.vscode.ts:144–147`, `build/next/index.ts:104,118`).

| Entry point | Registered | Shown in Ritemark today? | 003/007 already hide it? |
|---|---|---|---|
| "Chat: Open Agents Window" in All commands, `workbench.action.openAgentsWindow` | `chat/electron-browser/agentSessions/agentSessionsActions.ts:311–336`, registered at `chat/electron-browser/chat.contribution.ts:222` | **Yes.** Its `f1` item's `when` is its precondition (`platform/actions/common/actions.ts:755`). `OPEN_AGENTS_WINDOW_PRECONDITION` (`chat/common/constants.ts:671–677`) is true in Ritemark: chat not hidden, not the Agents window, `config.chat.agent.enabled` (Ritemark's extension sets it `true`), not an auxiliary window. At the pin the same action ("Open Agents Application") required `ProductQualityContext.notEqualsTo('stable')` (pin `agentSessionsActions.ts:23`), so stable Ritemark never showed it | No |
| "Chat: Open in Agents", `workbench.action.openWorkspaceInAgentsWindow` | `agentSessionsActions.ts:183–204`, f1, same precondition | **Yes** | No |
| ⌘⇧A / Ctrl+Shift+A (⌘⇧⌥A with a screen reader) | `agentSessionsActions.ts:319–331`; only after a session was created in the Agents window | Not until the window is used once | No |
| "Open in Agents Window" title-bar button, `MenuId.TitleBarAdjacentCenter` | `agentSessionsActions.ts:231–250`; setting `chat.titleBar.openInAgentsWindow.enabled`, default `true` (`chat.shared.contribution.ts:2441–2445`) | No: 018 draws no title row on the Mac and Windows (`shouldShowCustomTitleBar` returns false, `RITEMARK_FRAME_WITHOUT_TITLE_ROW = isNative && (isMacintosh \|\| isWindows)`), and the precondition excludes auxiliary windows | No |
| Copilot Chat's title menu: "Open in Agents Window", "Open in Agents" | `agentSessionsActions.ts:206–228` and `:357` (`OpenChatSessionInAgentsWindowAction`), both on `MenuId.ChatTitleBarMenu` | Only inside Copilot Chat | No |
| `ritemark --agents` | `code/electron-main/app.ts:1542` | Yes. At the pin it needed a non-stable quality (pin `app.ts:1400`) | No |
| `ritemark://` agent session links | `app.ts:1076–1092` (`handleProtocolUrl`) and `:1549–1562` (first window) | Yes, if a page or app opens such a link | No |
| Onboarding tryout hand-off | `platform/onboarding/electron-main/onboardingTryoutHandoff.ts:41` | Through tryout links only | No |
| "Agents Window" in recently opened | `platform/workspaces/electron-main/workspacesHistoryMainService.ts:202–225` | Only after the window was opened once. `_workbench.getRecentlyOpened` then returns an "Agents Window" workspace | No |

**Proposed hide (003):**
1. `chat/common/constants.ts:671`: in Ritemark, `OPEN_AGENTS_WINDOW_PRECONDITION` is `ContextKeyExpr.false()`. That one change hides both palette commands, the title-bar button, the chat-title items and the keybinding.
2. The palette filter gets `workbench.action.openAgentsWindow` and `workbench.action.openWorkspaceInAgentsWindow`, in case the precondition is ever re-based away.
3. Every main-process opener goes through `IWindowsMainService.openAgentsWindow` (`platform/windows/electron-main/windowsMainService.ts:296`). It returns `[]` when `productService.applicationName === 'ritemark'`. That closes `--agents`, the links and the tryout hand-off in one place. This file is new to 003, so `PATCH-RULES.md` §2 grows by one.

### 1.2 First-launch onboarding

| Entry point | Registered | Shown? | Hidden today? | Proposed |
|---|---|---|---|---|
| The Copilot sign-in wizard ("Variation A", a modal over the workbench) | `welcomeGettingStarted/browser/startupPage.ts:103` calls `tryShowOnboarding()` (`:236–268`) from the runner's constructor, whatever `workbench.startupEditor` says | **Yes, on a fresh profile.** It returns early only when `workbench.welcomePage.experimentalOnboarding` is off, or chat is hidden (`chat.disableAIFeatures`, `chatEntitlementService.ts:1516–1522`), or application storage is not new, or it ran before. The setting's default flipped `false` → `true` (`gettingStarted.contribution.ts:342–350`; pin `:341–350`) | No. 001's Sprint 133 redirect (`gettingStarted.contribution.ts`) covers the Getting Started page, not this overlay. 007's header says "the wizard itself remains unreachable because no UI links to it". That is no longer true | Pin `false` (A4). Correct 007's header |
| The new onboarding engine: tours and hints | `contrib/onboarding/browser/onboarding.contribution.ts` (new directory), setting `onboarding.enabled`, default `true` (`:85–91`) | Not today: the scenarios registered in the editor window are tryout links (`onboarding/common/onboardingTryout.ts:190`) and Codex continuation (`agentHost/codexContinuationGuide.ts:277`). The automatic tours are in `src/vs/sessions` | n/a | Pin `false` (A7) as insurance |
| "Try the Agents window" banner on Getting Started and the agent-sessions welcome | `chat/browser/agentSessions/agentSessionsBanner.ts`, used by `gettingStarted.ts:73` and `agentSessionsWelcome.ts:66` | No, as long as 001 keeps sending Getting Started to Ritemark's welcome | 001 | Nothing; check the 001 rebase keeps the redirect |
| Voice Mode onboarding | `agentsVoice/browser/agentsVoice.contribution.ts:179` | No: `agents.voice.enabled` defaults to `false` and voice also needs Copilot Chat (`agentsVoice/common/agentsVoice.ts:34–38`) | n/a | Nothing |

### 1.3 Chat surfaces that patch 003 already hides (mechanism checked at the target)

| Surface | Target | 003's mechanism still works? |
|---|---|---|
| "Agents" in the command center (`Codicon.chatSparkle`) | `agentSessionsExperiments.contribution.ts:254–265` | Yes. The registration still exists and gained `InEditorZenModeContext.negate()`, so the hunk is re-based, not dropped. The command center is off anyway (002 sets `window.commandCenter` to `false`) |
| "Chat" in the title bar (`Codicon.chatSparkle`) | same file `:268–281` | Yes, same hunk |
| Copilot status-bar item | `chatStatus/chatStatusEntry.ts:192–200` is still the only `addEntry` | Yes. 003 empties `update()`. The new Copilot promo dot (`:405–413`) goes with it |
| Chat view container as the aux bar's default | `chatParticipant.contribution.ts:42–51` | Yes. `isDefault: true` is still on the same call. The `mnemonicTitle` 003 removes is at `:63` |
| `ChatSetupContribution` (setup badge, sign-in title-bar button, account menu items, "Manage GitHub Copilot Budget") | now registered at `chat.shared.contribution.ts:3341`, with `ChatTeardownContribution` at `:3347` | Yes, once 007's hunk moves to that file (§6) |

`Codicon.chatSparkle` is used in exactly the same 15 workbench files, the same number of times, at both commits. 1.142 added no new sparkle entry point. The new entry points are the Agents window above, not new sparkle icons.

### 1.4 New chat surfaces that need no action

| Surface | Where | Why no action |
|---|---|---|
| Codex status-bar item (`$(openai)`) | `chatStatus/codexStatusEntry.ts`, registered `chat.shared.contribution.ts:3349` | Shown only for a signed-in Codex account with `chat.agentHost.codexAgent.enabled`, default `product.quality !== 'stable'`, so `false` in Ritemark (`agentHostStarter.config.contribution.ts:337–341`; `codexAccountService.ts:65–69`) |
| Agent-host profiling status item | `chat/electron-browser/actions/profileAgentHostAction.ts` | Only while a developer profile runs |
| "Voice Transcripts" side-bar container | `agentsVoice/browser/transcriptsView/voiceTranscripts.contribution.ts:45–55` | `hideIfEmpty`, and its view needs a context key that only "Show Voice Transcripts" sets (precondition: Copilot Chat). The "Voice Event Stream" container file is not imported anywhere |
| "Chat Update Requirement" view (⌃⌘I / Ctrl+Alt+I) | `chatParticipant.contribution.ts:87–104` | Inside the chat container. Shows only when managed settings need a newer client. Its keybinding has weight `WorkbenchContrib` (`services/views/browser/viewsService.ts:493`); 007's Copilot Chat binding has `WorkbenchContrib + 1`, so 007 still wins the chord |
| Promo, experiment, quota, Copilot harness and Agents-window invitations | `chatPromoNotification.ts`, `expNotification/`, `chatQuotaNotification.ts`, `agentsWindowInvitation.ts`, `agentSessionsActions.ts` (`CopilotHarnessIntroductionContribution`) | All use `IChatInputNotificationService`, so they appear only inside Copilot Chat's input |
| Microsoft sign-in probe | `chatSetup/chatSetupMicrosoftProbe.ts:238–241` | Inert unless `defaultChatAgent.provider.microsoft.id` is set (A10 leaves it out) |
| "Layout Density" in the gear menu | `modernUI/browser/modernUI.contribution.ts:65–71` | Only when Modern UI is on (A3 turns it off) |
| Update indicator in the title bar (`MenuId.TitleBarUpdate`) | `update/browser/updateTitleBarEntry.ts` | The update service is disabled without `updateUrl` (`platform/update/electron-main/abstractUpdateService.ts:206–207`), and there is no title row |
| Toolbar in the empty editor watermark (`MenuId.EditorGroupWatermarkToolbar`) | `editorGroupWatermark.ts:115` | Only `src/vs/sessions` contributes to it. Its new wrapper element is a frame-audit matter (019's empty desk) |
| `MenuId.EditorTitleLayout` | `editorTabsControl.ts:353,416` | Only the Agents window contributes. All editor-title actions are hidden in Ritemark anyway (`workbench.editor.editorActionsLocation: hidden` in the extension's defaults) |
| Browser "Add to Chat" split button | `browserEditorChatFeatures.ts:1106–1118` | Same `ChatContextKeys.enabled` gate as the pin's separate buttons. Left to audit 2c |
| "Open in Integrated Browser" for `.html`/`.mht` in the Documents and tab context menus | `browserTabManagementFeatures.ts:350–376` | New and visible. Left to audit 2c and the Experience lead; it is not a chat entry point |

### 1.5 New keybindings

| Chord | Command | Gate | Note |
|---|---|---|---|
| ⌘⇧A / Ctrl+Shift+A | Open Agents Window | `hasCreatedSessionInAgentsWindow` | A5 closes it |
| ⌃⌘I / Ctrl+Alt+I | Chat Update Requirement view | view active | 007 outranks it (+1 weight) |
| ⌘I | Dictation in the chat input | dictation configured, in chat input (`chatSpeechToTextActions.ts:160–175`) | Copilot Chat only |
| ⌘⇧Space, ⌘⇧M | Voice Mode | `agents.voice.enabled` (default `false`) and Copilot Chat | Inert |
| ⌘⇧V | Paste in chat | in chat | Copilot Chat only |

## 2. New built-in extensions

### 2.1 What changed

`git ls-tree` of `extensions/` at both commits: new are `mermaid-markdown-features` and `theme-modern-icons` (and the shared build helper `esbuild-common.mts`). Gone is `mermaid-chat-features`. In `build/`, `mermaid-chat-features` was replaced by `mermaid-markdown-features` in `build/npm/dirs.ts:41` and `build/lib/extensions.ts:631`; the new one is also compiled at `build/gulpfile.extensions.ts:78`, with its output folders in `build/filters.ts:56,162–164,221–223`. Gulp's `excludedExtensions` (`build/lib/extensions.ts:318–326`) still drops only `copilot` and the test extensions, so both new ones ship unless we strip them.

### 2.2 What each contributes

**`mermaid-markdown-features`** (it replaces and widens `mermaid-chat-features`):
- `markdown.previewScripts` and `markdown.markdownItPlugins` (`package.json:182–187` and its `extendMarkdownIt` in `src/extension.ts`): Mermaid in VS Code's own Markdown preview.
- A notebook renderer (`:188–199`), a chat output renderer and a language-model tool, `renderMermaidDiagram` (`:200–240`).
- Three internal commands, all hidden from the palette (`"when": "false"`), and three `webview/context` items that apply only inside the Markdown preview, notebook output and chat output webviews (`:61–77`).
- Eight settings under "Mermaid" (`markdown-mermaid.*`, `:79–181`).

What Ritemark would show: nothing in its own documents. `.md` opens in `ritemark.editor`, which renders Mermaid with its own `mermaid` 11.17.1 (`extensions/ritemark/webview/package.json:63`), and the extension never calls VS Code's preview or `markdown.api.render`. It would show only (a) a "Mermaid" section in VS Code's settings editor, (b) Mermaid in VS Code's Markdown preview when someone opens it by command, and (c) Mermaid diagrams inside Copilot Chat. In 1.x on the Mac, `mermaid-chat-features` was stripped, so (c) is unchanged by stripping.

**`theme-modern-icons`**: one file icon theme, "VS Code Modern Icons" (`package.json:16–22`). No other code refers to it, and the default file icon theme is still `vs-seti` (`workbenchThemeService.ts:54`). Ritemark pins `workbench.iconTheme: ritemark-icons` (extension `configurationDefaults`). What Ritemark would show: one more entry in "Preferences: File Icon Theme".

### 2.3 Recommendation and where the strip goes

Strip both. This keeps the shipped set as it was in 1.x on the Mac, under "no new visible surface without Jarmo". Shipping either one is harmless if Jarmo prefers it.

Where Copilot's strip lives today, and what it covers:

| Build | Strip step | Strips today | Change |
|---|---|---|---|
| Mac arm64 (`scripts/build-prod.sh:345–356`, Step 4.5) | `for unwanted_ext in copilot mermaid-chat-features` | copilot, mermaid-chat-features | `copilot mermaid-markdown-features theme-modern-icons`, and fix the comment at `:346–348` |
| Windows (`.github/workflows/build-windows.yml:508–520`, "Strip bundled copilot extension from output") | copilot only | copilot | Add the two new folders. Today Windows ships `mermaid-chat-features` |
| macOS x64 (`.github/workflows/build-macos-x64.yml`) | **none.** Steps at `:140–176` go from the gulp build to copying the extension and injecting `ritemarkVersion` | nothing | Add the same strip after "Build VS Code (darwin-x64)". Today x64 ships `mermaid-chat-features`, and `copilot` too whenever gulp packages it |

Another option, outside the plan's rule: one 004 hunk adding the folder names to `excludedExtensions` (`build/lib/extensions.ts:318`) would drop them from every build at the source. Copilot shows that this list works for packaging.

`mermaid-chat-features` appears in Ritemark's scripts only at `scripts/build-prod.sh:346,351`. `branding/product.json` does not mention it. Two docs quote the old line: `sprint-134-project-at-the-centre/research/palette-audit.md:52` and `.claude/skills/vscode-development/SKILL.md:502`.

### 2.4 A changed built-in: the Markdown extension's new editor

`markdown-language-features` now has a second custom editor, "Markdown Editor" (`vscode.markdown.editor`, `package.json:1956`), at priority `option` for text and `explicit` for diffs. It does not take over `.md`: Ritemark's `*.md → ritemark.editor` association stands. It adds an entry to "Reopen Editor With…" and new palette items ("Markdown: Toggle Preview" while a Markdown resource is active). No action. If Jarmo wants it hidden, it needs an `editorAssociations`-independent hide, not a strip: the extension also carries VS Code's Markdown language support.

## 3. Default drift

Every `default` added or changed between the commits, in the 154 configuration files plus `editorOptions.ts` and the built-in extensions. **Visible** means chrome Ritemark shows. "Pinned" means `branding/product.json` `configurationDefaults` or the Ritemark extension's `contributes.configurationDefaults`. None of the rows below is pinned today.

### 3.1 Must pin

| Setting | Pin → target | Visible effect | Proposed pin |
|---|---|---|---|
| `workbench.experimental.modernUI` | (new) → `true`, experiment `auto` (`workbench.contribution.ts:834–839`) | Side bars and panel become floating cards with a 4 px gap (`layoutService.ts` `FLOATING_PANEL_MARGIN`, `layout.ts:635–637`). Rounded corners, padding, font ramp, 28 px pane headers, 8 px scrollbars, restyled tabs, title bar, command center, status bar, notifications and dialogs (`modernUI/browser/modernUI.contribution.ts` module list). Adds "Layout Density" to the gear menu. Would move every one of 018's frame numbers | `false` |
| `workbench.welcomePage.experimentalOnboarding` | `false` → `true`, experiment `auto` (`gettingStarted.contribution.ts:342–350`) | The first-launch Copilot wizard (§1.2) | `false` |

With Modern UI off, its dependants are inert: `window.density.layout`, `workbench.modernUIFrostedGlass` (`true`) and its opacity, `workbench.experimental.modernUIEditorTabStyle`, `…UppercaseViewHeaders`, and `workbench.editor.tabActionReserveSpace` (`true`; its CSS is only under `.modern-ui-tabs`, `modernUI/browser/media/tabs.css:175–190`). Pin none of them.

Ritemark has no `tasConfig`, so no experiment can override these defaults. Experiments need `productService.tasConfig` (`services/telemetry/common/workbenchTelemetryUtils.ts:21–26`); without them there is no TAS client and no treatment (`assignmentService.ts:283–286,344–350`). If a `tasConfig` is ever added, 013 could register the product defaults with a `source` and `preventExperimentOverride: true` (`configurationRegistry.ts:398`, `configurationService.ts:1405,1420–1431`). That is optional.

### 3.2 Should pin

| Setting | Pin → target | Effect | Proposed pin |
|---|---|---|---|
| `onboarding.enabled` | (new) → `true` (`onboarding.contribution.ts:85–91`) | Tours and hints "may appear automatically". None reaches the editor window today (§1.2) | `false` |
| `update.showPostInstallInfo` | `true` → `false`, experiment `auto` (`platform/update/common/update.config.contribution.ts:82–89`) | When on, the first start after a major/minor version change fetches `code.visualstudio.com/raw/v1_142_update.md` and shows "New in 1.142" as a hover (`postUpdateWidget.ts:82–90,119–125`; `updateUtils.ts:88–90`). The 2.0 shell is exactly such a change. The new default keeps it off | `false` |

### 3.3 Could pin (someone else decides)

| Setting | Pin → target | Effect | Who decides |
|---|---|---|---|
| `workbench.browser.enableChatTools` | `false` → `true` (`browserEditorChatFeatures.ts:1122`) | Lets Copilot Chat's agents open and drive the integrated browser through VS Code's own tools. Not a visible element, but it bypasses the share question that 009 adds for Ritemark's AI | Audit 2c; suggested `false` |
| `terminal.integrated.resizeDimensionsOverlay.enabled` | (new) → `true` (`terminalContrib/resizeDimensionsOverlay/common/terminalResizeDimensionsOverlayConfiguration.ts`) | A "columns × rows" overlay while a terminal tab is resized | Experience lead; suggested `false` |
| `update.titleBar` | (new) → `true` (`update.config.contribution.ts:90–96`) | Update indicator in the title bar. Already inert (§1.4) | Optional `false` |
| `chat.titleBar.openInAgentsWindow.enabled` | (new) → `true` | Already gated by A5 | Optional `false` |

### 3.4 Changed or new, no pin needed

| Setting | Change | Why no pin |
|---|---|---|
| `workbench.accounts.showAvatar` | new, `true` | 002 removes the Accounts item from the global composite bar |
| `breadcrumbs.showEditorType` | new, `true` | Breadcrumbs are off (`breadcrumbs.enabled: false`) |
| `workbench.browser.dataStorage` | `global` → `'default'` | `'default'` means `global` for local workspaces (`browserDataStorageFeatures.ts:170`) |
| `extensions.autoUpdate` | `true` → `'on'` | Same behaviour, new value type |
| `terminal.integrated.windowsUseConptyDll` | `false` → `true` | Windows terminal uses the bundled `conpty.dll`. `build/.moduleignore:141–142` keeps it; 008's rebase must keep those lines. Check in S12 |
| `terminal.integrated.fontRendering` | new, `'inherit'` | Same as before |
| `workbench.editor.useModal` | `'some'`, gained an experiment | Inert without `tasConfig` |
| `editor.quickSuggestions.other` | `'on'` → `'offWhenInlineCompletions'` (`editorOptions.ts:3817`) | Plain text editors only |
| `markdown.preview.markEditorSelection`, `…doubleClickToSwitchToEditor` | `true` → `false`; new `markdown.preview.frontMatter`, `markdown.editor.*`, `markdown.experimental.richLinks.enabled` | VS Code's Markdown preview and editor only |
| `chat.agentHost.claudeAgent.enabled` | new, `true` | VS Code's own agent host. Not visible. Whether it starts a process in Ritemark was not checked here (R9) |
| `agents.voice.*` | new; `enabled: false` | Off |
| `zenMode.*` | moved to `workbench.zenMode.contribution.ts`, same values | none |
| `search.location`, `search.usePCRE2`, `search.useRipgrep`, `search.maintainFileSearchCache` | removed | none |

No default changed in `window.*` (`electron-browser/desktop.contribution.ts`, `platform/window/`), in the tab settings, or in `explorer.*`/`files.*`. Many settings gained an `agentsWindow:` default; that applies to the Agents window only.

All existing pins still name live settings, except one: `chat.commandCenter.enabled` in the Ritemark extension's `configurationDefaults` exists at neither commit. It does nothing and can go.

## 4. product.json

`scripts/apply-patches.sh:336–340` copies `branding/product.json` over `vscode/product.json` whole, for dev and for every build. So every field below comes from `branding/product.json` or nowhere.

### 4.1 Upstream product.json, pin → target

| Field | Change | Value at the target | Merge into branding? |
|---|---|---|---|
| `sharedDataFolderName` | added | `.vscode-oss-shared` | **Yes, required (§4.2).** Suggested `.ritemark-shared` |
| `linuxDesktopName` | added | `com.visualstudio.CodeOSS` | No. Linux only (`build/gulpfile.vscode.linux.ts`, `src/mainImpl.ts:72–76`, guarded) |
| `nodejsArtifactFeed`, `electronArtifactFeed` | added | `""` | No. Build-time and optional (`build/gulpfile.reh.ts:135`, `build/lib/electron.ts:115`) |
| `nodejsRepository` | removed | n/a | Not in branding |
| `agentsTelemetryAppName` | added | `agents` | No (telemetry off) |
| `sessionsWindowAllowedExtensions` | added | `[]` | No (Agents window, optional) |
| `voiceWsUrl` | added | Microsoft voice service | **No.** Leaving it out keeps Agents voice without a backend |
| `trustedExtensionAuthAccess.microsoft` | added | `["vscode.github-authentication"]` | Only with `provider.microsoft` |
| `defaultChatAgent.optimizeUsageDocumentationUrl`, `.managedSettingsUrl`, `.mcpConnectorsUrl` | added | GitHub/aka.ms URLs | **Yes** (A10) |
| `defaultChatAgent.provider.microsoft` | added | `{ id: microsoft, name: Microsoft }` | **No**, unless Jarmo wants "Continue with Microsoft" in Copilot's sign-in. Without it the probe and the button stay off (`chatSetupMicrosoftProbe.ts:238–241`, `chatSetupRunner.ts:510–515`) |
| `defaultChatAgent.manageSettingsUrl`, `.manageOverageUrl`, `.completionsRefreshTokenCommand` | removed | n/a | Drop from branding (harmless if kept) |
| `builtInExtensions` | js-debug 1.117.0 → 1.140.0, js-profile-table 1.0.10 → 1.0.11 | n/a | No. Branding keeps `[]` |
| `builtInExtensionsEnabledWithAutoUpdates` | unchanged (`["GitHub.copilot-chat"]`) | n/a | Branding keeps `[]`; the field is still required and present |

### 4.2 `IProductConfiguration` (`src/vs/base/common/product.ts`)

Required (no `?`) at the target: `version`, `nameShort`, `nameLong`, `applicationName`, `urlProtocol`, `dataFolderName`, **`sharedDataFolderName`** (new, `:122`), `serverApplicationName`, `extensionProperties`, `builtInExtensionsEnabledWithAutoUpdates`, `defaultChatAgent`. Branding lacks `version` (the build adds it), `extensionProperties` (required at the pin too, unchanged) and `sharedDataFolderName`.

`sharedDataFolderName` is read without a guard on the main process's startup path:
- `StorageMainService`'s constructor creates the shared storage (`platform/storage/electron-main/storageMainService.ts:102`).
- That reads `environmentService.appSharedDataHome` (`:203`).
- Unless `--shared-data-dir` or `VSCODE_PORTABLE` is set, the getter returns `joinPath(userHome, productService.sharedDataFolderName)` (`platform/environment/common/environmentService.ts:151–163`).
- `URI.joinPath` calls `paths.posix.join` (or `win32.join`) (`base/common/uri.ts:360–371`), which throws on a non-string fragment (`base/common/path.ts:76–80,1229`).
- There is no dev fallback (`platform/product/common/product.ts` only fills `version` and `copilotVersions`).

This is read, not run. It is the same class of failure as 1.117's `builtInExtensionsEnabledWithAutoUpdates`. A1 fixes it.

Also new and optional: `agentSdks`, `copilotVersions` (the build writes it, `build/gulpfile.vscode.ts:201–203`), `dictationRuntime`, `nlsMetadataHash`, `win32ContextMenu` (now typed; branding already has it), `extensionsGallery.accessScopes`. Removed: `win32SiblingExeBasename`, `telemetryAppName`, `darwinSiblingBundleIdentifier`, `embedded`, `extensionsEnabledWithApiProposalVersion`. Branding uses none of them.

`IDefaultChatAgent` gained required `optimizeUsageDocumentationUrl`, `managedSettingsUrl` and `provider.microsoft`, plus optional `mcpConnectorsUrl`. At runtime they are read with guards (`modelPickerWidget.ts:489`, `defaultAccount.ts:1152–1153`, `copilotConnectorsRequestService.ts:74`), except in `onboardingVariationA.ts:570`, inside the wizard that A4 keeps closed.

### 4.3 `extensionEnabledApiProposals` (Copilot Chat)

The branding list equals the 60 proposals of the in-tree Copilot Chat at the pin (`extensions/copilot/package.json`, `copilot-chat` 0.45.0). At the target the in-tree Copilot Chat is 0.70.0 and asks for 65. Missing: `agentsWindowConfiguration`, `authIssuers`, `chatInputNotification`, `envIsConnectionMetered`, `languageModelPricing`.

For an extension listed in product.json, the product list replaces the extension's own. Outside extension-development mode the extra proposals are dropped, and the log says "this EXTENSION WILL BE BROKEN unless product.json is updated" (`services/extensions/common/extensionsProposedApi.ts:78–101`). A2 adds the five. The Marketplace Copilot Chat that pairs with 1.142 should be checked against the same list in W8.

### 4.4 Patch 013

The `product.ts` hunk fails only because upstream inserted `IAgentSdkProductConfig` and `IDictationRuntimeProductConfig` (`product.ts:81–97`) right above `export interface IProductConfiguration {`. The anchor is the same; the context moved. The `configuration.ts` hunk's anchor, the `DefaultConfiguration` constructor's web `configurationDefaults` block, is unchanged; upstream's only change there is `reparseWorkspaceSettings` at `:710`. Both hunks are re-based.

## 5. Sprint 134's lean points

### 5.1 Anchors

| Lean point | At the target | Result |
|---|---|---|
| `commandsQuickAccess.ts` `getCommandPicks` returns the joined picks | Unchanged upstream (0/0). `getCommandPicks` at `:119`, the array at `:128–131`, `.map` at `:131`. The base class changed by one line (`platform/quickinput/browser/commandsQuickAccess.ts:297`, `id: commandPick.commandId`), and every list still reads `allCommandPicks` | 003's filter applies as is |
| `explorerViewer.ts` `FilesFilter` and `getAriaLabel` (018) | Upstream added one line, in `FileDragAndDrop.dispose` (`:2067`). `ITEM_HEIGHT` `:80`, `domId` `:1019`, `getAriaLabel` `:1190`, `FilesFilter` `:1228`, `ignoreTreesPerRoot` `:1238`, `onDidFilesChange` `:1255`, `isHiddenResource` `:1410`, `isIgnored` `:1426` | 018's hunks apply; only line numbers move |
| `_workbench.getRecentlyOpened` | Still registered, unchanged (`browser/actions/workspaceCommands.ts:317–321`) | Works. New: the main process folds Agents-window workspaces into one "Agents Window" entry (`workspacesHistoryMainService.ts:202–225`). After A5 none is ever created |
| The filter's kept commands | `reloadWindow`, `toggleDevTools`, `webview.openDeveloperTools`, `openProcessExplorer` all still exist | Unchanged |
| The filter's 88 IDs | Every ID found as a string at the pin is still found at the target. Three (`workbench.panel.repl.view.focus`, `workbench.action.exportLogs`, `workbench.action.importLog`) are built from constants at both commits | No stale entries |

### 5.2 New commands the filter does not catch

Found by the `f1` scan (71 new IDs). Shown in Ritemark's All commands **without Copilot Chat**:

| ID | Title | Source |
|---|---|---|
| `workbench.action.startHeapTracing` | Developer: Start Heap Tracing | `electron-browser/actions/developerActions.ts:206–209` |
| `workbench.action.onboarding.resetShownState` | Developer: Reset Onboarding Shown State | `onboarding/browser/onboarding.contribution.ts:136–139` |
| `developer.onboarding.copyTryoutLink` | Developer: Copy Feature Example Link | `onboarding/browser/onboardingTryout.contribution.ts:127–130` |
| `agentsVoice.simulateConnection` | Voice: Simulate Connection (Dev) | `agentsVoice/browser/agentsVoice.contribution.ts:543` (no precondition) |
| `agentsVoice.resetOnboarding` | Voice: Reset Onboarding | `agentsVoice.contribution.ts:559` (no precondition) |
| `workbench.action.openAgentsWindow` | Chat: Open Agents Window | §1.1 |
| `workbench.action.openWorkspaceInAgentsWindow` | Chat: Open in Agents | §1.1 |
| `multiDiffEditor.openLayoutDebug` | Developer command, only in a multi-diff editor | `multiDiffEditor/browser/actions.ts` |
| `workbench.action.openSurvey` | Developer: Open Survey (needs `IsDevelopmentContext`, so dev builds only) | `surveys/browser/survey.contribution.ts` |

Shown **only with Copilot Chat** (`ChatContextKeys.enabled` or an agent-host state). These are Developer-category commands like the chat ones the filter already hides:
`workbench.action.chat.debugAgentHostInDevTools`, `agentHost.exportDebugLogs`, `workbench.action.chat.inspectAgentHostSubscriptions`, `workbench.action.chat.agentHostNetworkDiagnostics`, `agentHost.openSessionEventsFile`, `workbench.action.chat.profileAgentHost`, `workbench.action.chat.stopAgentHostProfile`, `workbench.action.chat.restartLocalAgentHost`, `workbench.action.chat.resetPermissionWarningDialogs`, `workbench.action.chat.resetCopilotHarnessIntroduction`, `chat.pet.developer.resetAchievements`, `chat.pet.developer.resetSize`, `chat.pet.developer.unlockAllAchievements`, `workbench.action.chat.agentHost.otel.exportAgentTracesDB`.

Debug, breakpoint and walkthrough families: no new command IDs at the target outside chat's own debug panel (`chatDebug.cache.agentSelectAll`, not `f1`). The existing prefixes still cover the debug family. The new developer commands sit outside the existing prefixes, so they go in as single IDs. The test (`ritemarkPalettePolicy.test.ts`) needs the new IDs.

Not hidden, on purpose: "Focus Window" (`workbench.action.focusWindow`, a window command), the browser's new emulation, favorites and history commands (only with a browser tab in front; audit 2c), and the Markdown extension's new commands (§2.4).

## 6. Patch 007 at the target

### 6.1 Where `chat.contribution.ts` went

At the target `contrib/chat/browser/chat.contribution.ts` is 17 lines: three actions and one singleton. Its registrations moved to the new `chat.shared.contribution.ts` (3,488 lines). `workbench.common.main.ts:226` loads it, and so does the Agents window (`sessions/sessions.common.main.ts:227`). Agent-plugin views moved to the new `chat.view.contribution.ts`.

### 6.2 007's hunks, one by one

| Hunk | Pin anchor | Target | Class |
|---|---|---|---|
| `paneCompositeBar.ts`: Copilot Chat launcher follows installed/disabled | `onDidChangeViewContainers` listeners, `shouldBeHidden`, `ViewContainerActivityAction` constructor and `run` | Applied in the dry run. `contextKeyService` `:109`, `shouldBeHidden` `:437/442`, `@IActivityService` `:781`, `run` `focus` `:812`, `ACTIVITYBAR_PART` `:814`. `ChatEntitlementContextKeys.Setup.installed/disabled` still exist (`chatEntitlementService.ts:42–43`) | Carried |
| `chat.contribution.ts`: import `ChatSetupActionsContribution`; register it instead of `ChatSetupContribution` and `ChatTeardownContribution` | pin `chat.contribution.ts:144,2110–2111` | **Moved** to `chat.shared.contribution.ts`: import `:231`, `ChatSetupContribution` `:3341`, `ChatTeardownContribution` `:3347`, `ChatStatusBarEntry` `:3348` (still registered; 003 empties it) | Re-cut into the new file |
| `chatSetupContributions.ts`: imports and the new `ChatSetupActionsContribution` above `ChatSetupContribution` | pin `:60–70` | `defaultChat` `:67`, `SIGN_IN_TITLE_BAR_ACTION_ID` `:71`, `ChatSetupContribution` `:79`. The file already imports `ChatEntitlementContextKeys` (`:42`), `ChatAIDisabledSettingId` (`:56`), `ChatViewContainerId` (`:58`), `IChatSetupCommandOptions`/`IChatSetupResult`/`ChatSetupSource` (`:61`) and `ChatSetup` from `./chatSetupRunner.js` (`:65`) | Re-based, **with content changes** (below) |
| `onboardingVariationA.ts`: soft fallback for `defaultChatAgent` | pin `:13` import, `:73–74` assert | Upstream still asserts at module load: import `:13`, `assertDefined(product.defaultChatAgent, …)` `:81`, `const defaultChat` `:82` | Re-based. It is defensive now, because `branding/product.json` defines `defaultChatAgent`, so the assert would pass |

Content changes the `ChatSetupActionsContribution` copy needs. 007 copies upstream's setup action body, and upstream changed it (`chatSetupContributions.ts:228–376` against pin `:219–345`):
- `ChatConfiguration.AIDisabled` no longer exists. Use `ChatAIDisabledSettingId` (`chat/common/constants.ts:34`). As is, this is a compile error.
- `run(…, options?: IChatSetupCommandOptions): Promise<boolean | IChatSetupResult>`; `setup.run({ telemetrySource: ChatSetupSource.Command, ...options })`; `options?.returnResult` returns the result; the retry dialog skips `result.errorAlreadyHandled`.
- The mode argument is resolved by ID or name (`resolveAgentId`) before `setChatMode`.
- The anonymous and force-sign-in actions pass `telemetrySource`. The force-sign-in title is now "Sign in to use GitHub Copilot".
- Upstream's full contribution renamed `manageOverages` → `manageAdditionalSpend` and added `ToggleSignInTitleBarAction`. Neither runs in Ritemark, because the full contribution stays unregistered.
- `workbench.action.chat.openInEditor`, which 007's tab command runs, still exists (`chat/browser/actions/chatMoveActions.ts:35`).

Header: point 1's "the wizard itself remains unreachable" is no longer true (§1.2). Name the A4 pin instead.

## 7. `PATCH-RULES.md` §2–§7: what is out of date

These sections still describe 1.x. What changed, with the source for each:
- **§2** says "14 Files". 003 on `HEAD` has 23 file entries, and A5 adds `chat/common/constants.ts` and `windowsMainService.ts`. At the target the top-level menus moved from `menubarControl.ts` to the new `browser/parts/titlebar/menubar.contribution.ts:10–88`.
- **§3 Menu bar:** "Selection: YES" is stale. 003 removes the Selection menu ("the Selection menu (multi-cursor tooling) is hidden"). The File menu has New Document and New Table (003), plus New tab, Switch project and Share (018, `ritemark/fileMenu`). View has Copilot Chat only while Copilot Chat is usable (007). The browser's View item changed command upstream (`browserTabManagementFeatures.ts:530–537`; audit 2c).
- **§4 Title bar:** on the Mac and Windows there is no title row (018, `shouldShowCustomTitleBar`); controls sit on the strips. The "Chat sparkle icon … known issue" row is obsolete: 003 removes the title-bar Chat and command-center Agents registrations.
- **§5 Sidebar:** the places row on top in Ritemark's order, Documents always a place (002), Copilot Chat's launcher in More (007), no Outline or Timeline sections (003).
- **§6 Status bar:** add the Codex item (hidden by default, §1.4) next to the Copilot item.
- **§7 Keybindings:** Ctrl+Alt+I / ⌃⌘I open Copilot Chat as a tab, or do nothing (007). ⌘T is the desk's + (019, `ritemark.newTab`). Upstream's new ⌘⇧A (Agents window) is closed by A5.
- **§10** checklists: add "no Agents window command in All commands", "no onboarding overlay on a fresh profile", and "Modern UI off".

## 8. Not covered here

- The Windows and macOS x64 product.json steps were read only for the built-in strip. The x64 workflow merges only `posthog*` into the built product.json (`build-macos-x64.yml:176–200`). That is fine, because `apply-patches.sh` has already copied the whole branding file.
- Whether VS Code's own agent host starts a process in the editor window with the new defaults (`chat.agentHost.claudeAgent.enabled: true`) was not traced. It is not visible; it belongs to R9.
- Everything here was read from source. The dev-mode checks in W8 (a fresh `--user-data-dir`, All commands, first launch) are what prove it.
