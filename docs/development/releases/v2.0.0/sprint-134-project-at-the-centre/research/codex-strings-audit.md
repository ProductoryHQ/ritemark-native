# "Codex" in visible strings (Phase 1, audit 8)

Checked 2026-10-19 on `sprint-134-project-at-the-centre` at `30d7fa3a`, after Sprint 133 merged (`eae1dedd`). Line numbers are this commit's. The branch moved to `0eb75272` during the audit: the three searches below find the same lines there, and only `src/taskBoard/BoardController.ts` moved (its numbers here are the new ones).

This is the list R22 asks for before any word changes. Every string a person can read that names the AI "Codex" is below, with where it is read, what it says now and what it will say. What stays is listed apart, with a reason.

How to read the paths: `src/…`, `webview/src/…` and `package.json` are under `extensions/ritemark/`. `patches/…`, `branding/…` and `vscode/…` are at the worktree's root. A bare file name in a "where" column is in the same folder as its row's file, or under `webview/src/components/ai-sidebar/`.

Nothing was seen on screen. Every "where" below comes from reading the code that shows the string. VS Code's settings page (area K) is read from VS Code's own code, not from a running app.

Rules used for "will say":
- "Codex" as the AI's name becomes "ChatGPT".
- A sentence that reads oddly after the swap is rewritten in plain words, one point each.
- A command a person types (`npm install -g @openai/codex`) and a model's own name stay as written.
- Three messages point to places that no longer exist ("Settings > Features", "under Agent Runtime"). Their new words point to where the thing is now. These are the same strings, so they change in the same pass.

## The visible strings

### A. Ritemark Settings (12)

`webview/src/components/settings/RitemarkSettings.tsx`

| # | Line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| A1 | 400 | Agent Runtime card, Runtime preference menu, second choice | Use system install — prefer Codex/Claude installed on PATH; bundled is fallback | Use system install — prefer ChatGPT and Claude installed on PATH; bundled is fallback |
| A2 | 403 | Agent Runtime card, the line under that menu | Applies to both Codex and Claude. Bundled runtimes are pinned… | Applies to both ChatGPT and Claude. Bundled runtimes are pinned… (rest unchanged) |
| A3 | 420 | Agent Runtime card, "Currently active" row | Codex | ChatGPT |
| A4 | 655 | ChatGPT Account card, own install missing, above the install command | Codex CLI binary not found. Install it first: | ChatGPT is not installed. Install it first: |
| A5 | 656 | ChatGPT Account card, own install broken | Codex CLI is installed but broken. Reinstall it first: | ChatGPT is installed but broken. Reinstall it first: |
| A6 | 682 | ChatGPT Account card, button | Repair Codex | Repair ChatGPT |
| A7 | 706 | ChatGPT Account card, signed out | Sign in with your ChatGPT account to use Codex agents without an API key. | Sign in with your ChatGPT account. No API key is needed. |
| A8 | 783 | ChatGPT Account card, foot line | Used for: Codex Agents (autonomous coding) | Used for: ChatGPT in chats, flows and the task board |
| A9 | 810 | ChatGPT Account card, under Approval Policy | Controls when Codex asks for your approval before executing shell commands or modifying files. | Controls when ChatGPT asks for your approval before executing shell commands or modifying files. |
| A10 | 823 | ChatGPT Account card, Sandbox Mode menu, first choice | Read only — Codex can only read files | Read only — ChatGPT can only read files |
| A11 | 828 | ChatGPT Account card, under Sandbox Mode | Controls what Codex is allowed to do on your filesystem. | Controls what ChatGPT is allowed to do on your filesystem. |
| A12 | 1597 | Updates, Update Center, Component readiness, the card's title | Codex | ChatGPT |

### B. Settings' host: toasts, a terminal, the card's errors (8)

`src/settings/RitemarkSettingsProvider.ts`

| # | Line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| B1 | 915 | Toast, when a task board card or a comment asks to sign in (`ritemark.codexLogin`) and ChatGPT is turned off | Codex integration not enabled. | ChatGPT is turned off. Turn it on in Advanced settings. |
| B2 | 926 | Toast, the same sign-in failing | Codex login failed: {error} | ChatGPT sign-in failed: {error} |
| B3 | 1333 | ChatGPT Account card, red line, sign-in pressed while ChatGPT is turned off | Codex integration not enabled | ChatGPT is turned off |
| B4 | 1363 | Toast, Settings' Sign in with ChatGPT failing | Codex login failed: {error} | ChatGPT sign-in failed: {error} |
| B5 | 1395 | Terminal tab's name, Settings' Repair ChatGPT on an own install | Codex Repair | Repair ChatGPT |
| B6 | 1404 | Toast after B5 opens | Opened Codex repair in terminal. After it finishes, reload the window and reopen Settings. | Opened ChatGPT's repair in a terminal. When it finishes, reload the window and reopen Settings. |
| B7 | 1449 | ChatGPT Account card, red line (fallback when no reason came back) | Codex runtime not found. | ChatGPT was not found. |
| B8 | 1464 | ChatGPT Account card, red line (fallback) | Codex CLI is installed but could not be started. | ChatGPT is installed but could not start. |

### C. ChatGPT's status and errors (20)

These are made in `src/codex/` and shown in several places: the ChatGPT Account card (`codexAuth.error`, `codexAuth.diagnostics`, `RitemarkSettings.tsx:663–673`), the Update Center's card (`errorMessage`, `diagnostics`), the AI sheet's ChatGPT setup (`CodexSetupView.tsx:75–129`), the sign-in toasts (B2, B4) and a flow step's error. Most show only when something has gone wrong.

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| C1 | `src/codex/codexManager.ts:35` | Toast, Repair ChatGPT on the bundled ChatGPT (`RitemarkSettingsProvider.ts:1390`, `UnifiedViewProvider.ts:2747`) | Codex ships with Ritemark and cannot be repaired on its own. If it does not work, reinstall Ritemark to restore it. | ChatGPT ships with Ritemark and cannot be repaired on its own. If it does not work, reinstall Ritemark to restore it. |
| C2 | `src/codex/codexManager.ts:275` | Card, setup and Update Center: nothing found, own-install preference | Codex runtime not found. Check your own Codex install (npm install -g @openai/codex), or reinstall Ritemark to restore the bundled agent. | ChatGPT was not found. Check your own install (npm install -g @openai/codex). Or reinstall Ritemark to restore the one that ships with it. |
| C3 | `src/codex/codexManager.ts:276` | The same, bundled preference | Codex runtime not found. Reinstall Ritemark to restore the bundled agent. | ChatGPT was not found. Reinstall Ritemark to restore it. |
| C4 | `src/codex/codexManager.ts:388` | Inside C13 or as the error, when the program printed nothing | Codex CLI exited with code {n} | ChatGPT exited with code {n} |
| C5 | `src/codex/codexManager.ts:429` | Sign-in toast or the AI sheet, if ChatGPT is turned off; rare, because B1, B3 and G1 usually answer first | Codex integration is not enabled. Enable it in Settings > Features. | ChatGPT is turned off. Turn it on in Advanced settings. |
| C6 | `src/codex/codexManager.ts:444` | The same places, rare | Codex app-server is already running | ChatGPT is already running. |
| C7 | `src/codex/codexManager.ts:450` | The same places (fallback) | Codex runtime not found. | ChatGPT was not found. |
| C8 | `src/codex/codexManager.ts:453` | The same places (fallback) | Codex CLI is installed but could not be started. | ChatGPT is installed but could not start. |
| C9 | `src/codex/codexManager.ts:506` | The same places, rare | Codex app-server is not running | ChatGPT is not running. |
| C10 | `src/codex/codexManager.ts:577` | Card and setup, Technical details, own install on Apple silicon | Rosetta/x64 Node install detected. This can install the wrong Codex binary on Apple Silicon. | Rosetta/x64 Node install detected. This can install the wrong ChatGPT binary on Apple silicon. |
| C11 | `src/codex/codexManager.ts:702` | Card and setup (fallback) | Codex CLI failed to start. | ChatGPT failed to start. |
| C12 | `src/codex/codexManager.ts:708` | Card, setup and Update Center: the bundled ChatGPT cannot start | The bundled Codex runtime could not start ({reason}). Reinstall Ritemark to restore it. | The bundled ChatGPT could not start ({reason}). Reinstall Ritemark to restore it. |
| C13 | `src/codex/codexManager.ts:762` | AI sheet, "Some agent features are unavailable" notice, a bullet (`CodexView.tsx:113–117`) | Approval requests were not detected in the current Codex app-server protocol. | This version of ChatGPT does not ask for approvals. |
| C14 | `src/codex/codexManager.ts:765` | The same notice | Interactive question prompts were not detected in the current Codex app-server protocol. | This version of ChatGPT does not ask you questions. |
| C15 | `src/codex/codexManager.ts:768` | The same notice | Structured plan update notifications were not detected in the current Codex app-server protocol. | This version of ChatGPT does not send plan updates. |
| C16 | `src/codex/codexManager.ts:814` | The same notice, its message (`CodexView.tsx:129`) | Codex is runnable, but one or more lifecycle capabilities Ritemark expects were not detected. | ChatGPT runs, but some features Ritemark expects are missing. |
| C17 | `src/codex/CodexRuntime.ts:330` | AI sheet, the first activity line of a ChatGPT turn (`ActivityCard.tsx:61`, `ActivityStatusLine.tsx:37`) | Starting Codex… | Starting ChatGPT… |
| C18 | `src/codex/CodexRuntime.ts:687` | AI sheet's setup, red line (fallback) | Codex CLI is not available. | ChatGPT is not available. |
| C19 | `src/codex/codexAppServer.ts:159` | AI sheet, under a turn that takes more than 10 s to start (`CodexView.tsx:244–247`) | Starting Codex session, this may take a moment… | Starting ChatGPT. This may take a moment… |
| C20 | `src/codex/codexAppServer.ts:422` | AI sheet or a toast, when the program stops mid-request | Codex app-server exited unexpectedly | ChatGPT stopped unexpectedly. |

### D. The AI sheet's host, the shared label and the install terminal (9)

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| D1 | `src/views/UnifiedViewProvider.ts:1224` | AI sheet, error under a turn when the program dies | Codex exited unexpectedly. Please try again. | ChatGPT stopped unexpectedly. Please try again. |
| D2 | `src/views/UnifiedViewProvider.ts:2704` | AI sheet, the runtime notice when the status check throws | Codex could not be checked. {detail} | Ritemark could not check ChatGPT. {detail} |
| D3 | `src/views/UnifiedViewProvider.ts:2738` | Toast, Sign Out on the AI sheet's setup failing | Codex sign-out failed: {error} | ChatGPT sign-out failed: {error} |
| D4 | `src/views/UnifiedViewProvider.ts:2752` | Terminal tab's name, the AI sheet's Repair ChatGPT on an own install | Codex Repair | Repair ChatGPT |
| D5 | `src/views/UnifiedViewProvider.ts:2760` | Toast after D4 opens | Opened Codex repair in terminal. After it finishes, reload the window. | Opened ChatGPT's repair in a terminal. When it finishes, reload the window. |
| D6 | `src/views/agentSidebarBootstrap.ts:69` | AI sheet, the load error (`UnifiedViewProvider.ts:2407`, `AISidebar.tsx:168`) | Codex model catalog is empty. | ChatGPT's model list is empty. |
| D7 | `src/agent/types.ts:52` | AI sheet, the line where a chat moves to another AI: "Continuing with Codex. Previous messages were included as context." (`ConversationController.ts:395`, `:787`) | Codex | ChatGPT |
| D8 | `src/runtime/availability.ts:167` | **The shared label** (`RUNTIME_LABELS`). It is the name in: the AI sheet's runtime notices ("Codex is signed out", "Finish signing in to Codex", "Use Codex", `RuntimeAvailabilityNotice.tsx:18–54, 92`), the composer's placeholders and Send tooltip ("Checking Codex…", `ChatInput.tsx:314–328, 1736`), "Use Codex" under a reply (`AgentResponse.tsx:198`), the host's availability sentences (`availability.ts:198–208`), and the task board: Give to agent's label, "Reviewing · Codex", "Queued for Codex", busy answers and history lines (`taskCopy.ts:50`, `BoardController.ts:331, 624, 699, 802, 930`) | Codex | ChatGPT |
| D9 | `src/agent/installer.ts:422` | Terminal tab's name, the AI sheet's first-run setup, Install on the ChatGPT row | Install Codex | Install ChatGPT |

### E. The AI sheet (27)

`webview/src/components/ai-sidebar/`

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| E1 | `AISidebar.tsx:167` | Notice when the status check is slow: "Still checking Codex", "Finding out whether Codex is ready…" (`:273–274`) | Codex | ChatGPT |
| E2 | `ChatInput.tsx:1074` | Composer footer, the AI and model ("Codex · GPT-6.1 Sol"), and its tooltip (`:1435–1438`) | Codex | ChatGPT |
| E3 | `ChatInput.tsx:1497` | Model picker, the group's heading | Codex | ChatGPT |
| E4 | `ChatInput.tsx:1637` | Thinking effort button's screen-reader label (`ThinkingEffortControl.tsx:92`) | Codex | ChatGPT |
| E5 | `CodexSetupView.tsx:27` | ChatGPT setup, title | Checking Codex | Checking ChatGPT |
| E6 | `CodexSetupView.tsx:29` | ChatGPT setup, title | Codex CLI needs repair | ChatGPT needs repair |
| E7 | `CodexSetupView.tsx:38` | ChatGPT setup, text | Codex is installed, but it could not start correctly. | ChatGPT is installed, but it could not start correctly. |
| E8 | `CodexSetupView.tsx:39` | ChatGPT setup, text | Ritemark could not find Codex. | Ritemark could not find ChatGPT. |
| E9 | `CodexSetupView.tsx:41` | ChatGPT setup, offline | Codex sign-in needs an internet connection. Reconnect, then try again. | ChatGPT sign-in needs an internet connection. Reconnect, then try again. |
| E10 | `CodexSetupView.tsx:43` | ChatGPT setup, signing in | Your browser was opened for ChatGPT sign-in. When you finish there, Codex will become ready here. | Your browser was opened for ChatGPT sign-in. When you finish there, ChatGPT will be ready here. |
| E11 | `CodexSetupView.tsx:45` | ChatGPT setup, signed out | To use Codex in Ritemark, sign in with your ChatGPT account. | To use ChatGPT in Ritemark, sign in with your ChatGPT account. |
| E12 | `CodexSetupView.tsx:46` | ChatGPT setup, other states | Preparing Codex for this workspace. | Preparing ChatGPT for this project. |
| E13 | `CodexSetupView.tsx:100` | ChatGPT setup, button | Repair Codex | Repair ChatGPT |
| E14 | `CodexView.tsx:167` | A ChatGPT turn: the small name above it in a mixed chat, "Codex is waiting for approval" (`:401`), "Codex needs your input to continue" (`AgentQuestion.tsx:261`) | Codex | ChatGPT |
| E15 | `CodexView.tsx:221` | Plan review card, title | Codex is waiting for plan review | ChatGPT is waiting for you to review its plan |
| E16 | `CodexView.tsx:277` | Plan card, heading | Codex plan | ChatGPT's plan |
| E17 | `CodexView.tsx:491` | Compatibility notice, close button's screen-reader label | Dismiss Codex compatibility notice | Dismiss this notice about ChatGPT |
| E18 | `EnvironmentStatusNotice.tsx:40` | Setup, Windows with an own install and no Node.js | Claude or Codex installed with npm runs on Node.js. Install Node.js and reload Ritemark, or switch Runtime preference to Bundled in Settings. | Claude or ChatGPT installed with npm needs Node.js. Install Node.js and reload Ritemark. Or switch Runtime preference to Bundled in Settings. |
| E19 | `OnboardingWizard.tsx:137` | First-run setup, AI Assistants, the row's name | Codex | ChatGPT |
| E20 | `OnboardingWizard.tsx:209` | First-run setup, compact row | Codex | ChatGPT |
| E21 | `OnboardingWizard.tsx:240` | First-run setup, sign-in card title | Sign in to Codex | Sign in to ChatGPT |
| E22 | `OnboardingWizard.tsx:278` | First-run setup, last step: "Codex is ready to help you with your documents." | Codex | ChatGPT |
| E23 | `RuntimeAvailabilityNotice.tsx:129` | Runtime notice, button | Repair Codex | Repair ChatGPT |
| E24 | `aiDisclosure.ts:116` | "You are interacting with AI" line ("Codex · OpenAI · {model}", `AIInformation.tsx:90`) and AI information's Runtime row (`:174`) | Codex | ChatGPT |
| E25 | `continuationPresentation.ts:5` | Notice on a chat whose AI is not available: "Codex isn't available." | Codex | ChatGPT |
| E26 | `store.ts:114` | The line when a chat moves to another AI: "Continuing with Codex." (`:146`, `:2348`) | Codex | ChatGPT |
| E27 | `store.ts:2814` | Error under a running turn when ChatGPT stops being ready (fallback) | Codex is not ready. | ChatGPT is not ready. |

### F. The model catalog (1)

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| F1 | `src/ai/modelCatalog/bundledCatalog.ts:83` | Model picker, the line under GPT-6 Astra (`ChatInput.tsx:1499`) | Most capable Codex model | Most capable model |

F1 shows only when the bundled catalog is at least as new as the published model feed. When both have the row, the newer document's row wins (`resolver.ts:209–219`). The bundled catalog is dated `2026-10-13` (`bundledCatalog.ts:37`). So W16 bumps that date, and the feed is refreshed from the bundled catalog at 2.0's release (`feedExport.ts:1–15`). What the published feed says today was not checked.

### G. Flows (10)

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| G1 | `src/flows/nodes/CodexNodeExecutor.ts:46` | Flow's Run panel: the step's error and "Failed at …" (`FlowEditorProvider.ts:552–563`) | Codex integration is disabled. Enable it in Settings > Features > Codex Integration. | ChatGPT is turned off. Turn it on in Advanced settings. |
| G2 | `src/flows/nodes/CodexNodeExecutor.ts:55` | The same | Codex node missing prompt | This ChatGPT step has no prompt. |
| G3 | `src/flows/nodes/CodexNodeExecutor.ts:74` | The same | Codex is not signed in. Open Settings and sign in with ChatGPT under Agent Runtime, then run the flow again. | ChatGPT is signed out. Sign in with ChatGPT in Ritemark Settings. Then run the flow again. |
| G4 | `src/flows/nodes/CodexNodeExecutor.ts:105` | The step's result in the Run panel (the result is shown as JSON, `FlowEditorProvider.ts:546–549`) | Codex timed out after {n} minutes | ChatGPT timed out after {n} minutes |
| G5 | `src/flows/nodes/CodexNodeExecutor.ts:162` | The same, a step that wrote no text | Codex completed the task. | ChatGPT finished the task. |
| G6 | `src/flows/nodes/CodexNodeExecutor.ts:173` | The same | Codex app-server exited unexpectedly (code: {n}) | ChatGPT stopped unexpectedly (code: {n}) |
| G7 | `webview/src/components/flows/stepKinds.ts:22` | Flow editor: the step's name in the palette, its config panel's title and on the canvas (`NodePalette.tsx:49`, `NodeConfigPanel.tsx:89`, `BaseNode.tsx:40`) | Codex | ChatGPT |
| G8 | `webview/src/components/flows/stepKinds.ts:22` | The step's description, same line | Gives a task to Codex, which can read and change the project's files. | Gives a task to ChatGPT, which can read and change the project's files. |
| G9 | `webview/src/components/flows/stores/flowEditorStore.ts:305` | A new step's label, on the canvas and in "Failed at …" | Codex | ChatGPT |
| G10 | `webview/src/components/flows/NodeConfigPanel.tsx:963` | The step's config, under Model | Select the Codex model to use. | Select the ChatGPT model to use. |

G1's "Settings > Features" no longer exists: the switch is `ritemark.features.codex-integration` on VS Code's settings page, reached through Advanced settings (R23). G3's ChatGPT Account card sits under API Keys, not Agent Runtime (`RitemarkSettings.tsx:441–633`).

### H. The task board (5)

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| H1 | `webview/src/components/tasks/AgentSplitButton.tsx:16` | Give to agent's menu, the row's name (`:94`) | Codex | ChatGPT |
| H2 | `webview/src/components/tasks/AgentSplitButton.tsx:64` | Give to agent's tooltip, when no AI is set up | Set up Claude, Codex or OpenCode in the AI sidebar first | Set up Claude, ChatGPT or OpenCode in the AI sidebar first |
| H3 | `webview/src/components/tasks/CardMenu.tsx:18` | A card's … menu, the agent rows (`:128`) | Codex | ChatGPT |
| H4 | `webview/src/components/tasks/CardPage.tsx:44` | A card's page: "reviewed by Codex", "Codex asked", "Codex's result" (`:466`, `:557`, `:669`) | Codex | ChatGPT |
| H5 | `webview/src/components/tasks/taskCopy.ts:244` | A card's line: "Codex finished in 4m 12s" | Codex | ChatGPT |

Most of the board's other words come from D8.

### I. Comments (1, and 3 held)

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| I1 | `webview/src/extensions/comment/commentModel.ts:35` | The @ picker's name, the pill on a comment, "Send to Codex", the Comments menu's groups, "Codex is working", "… · Codex takes over" (`AgentMentionPicker.tsx:30`, `MarginCommentRail.tsx:406, 657`, `CommentsMenuButton.tsx:254–282`, `commentTaskCopy.ts:94–142`) | Codex | ChatGPT |

Held for a decision (see *Hard cases*, 1). These name the handle a person types, `@codex`:

| # | File:line | Where a person reads it | Now |
|---|---|---|---|
| I2 | `webview/src/components/comment/AgentMentionPicker.tsx:176` | The @ picker, beside the name | @codex |
| I3 | `webview/src/components/MarginCommentRail.tsx:957` | A comment's error when no agent is named | Assign an agent with @claude, @codex, or @opencode before sending. |
| I4 | `webview/src/components/header/CommentsMenuButton.tsx:241` | Comments menu, empty | No comments are assigned to an agent yet. Assign one with @claude, @codex, or @opencode in the comment text. |

### J. The Agents place (1)

| # | File:line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| J1 | `webview/src/components/agent/ProvenanceBadge.tsx:7` | An agent's page, the skill suggestions, the badge on a skill from `.agents/` (`AgentConfiguratorPanel.tsx:346`) | [codex] | [ChatGPT] |

The Agents place's tooltip already says "For ChatGPT" (`src/views/AgentLibraryViewProvider.ts:1297`). Its neighbours say "[claude]" and "[shared]". Whether all three take the tooltip's words is a question for the Experience lead, not part of this pass.

### K. VS Code's settings page, Ritemark's settings (10)

`package.json`. A person reaches these through Advanced settings (R23).

| # | Line | Where a person reads it | Now | Will say |
|---|---|---|---|---|
| K1 | 358 | Under `ritemark.features.codex-integration` | Enable Codex CLI integration with ChatGPT authentication (experimental). Requires codex binary installed. | Use ChatGPT in Ritemark, signed in with your ChatGPT account. Turn it off to hide ChatGPT. |
| K2 | 427 | `ritemark.agentRuntime.preference`, the first choice's description | Use the Codex and Claude runtimes that ship inside Ritemark (recommended) | Use the ChatGPT and Claude runtimes that ship inside Ritemark (recommended) |
| K3 | 428 | The same, second choice | Prefer system-installed Codex and Claude; bundled runtimes are used only if no system install is found | Prefer ChatGPT and Claude installed on this computer. The bundled ones are used only if none is found. |
| K4 | 431 | The same setting's description | …Applies to both Codex and Claude. | …Applies to both ChatGPT and Claude. |
| K5 | 437 | The section's title in the settings' table of contents | Codex | ChatGPT and OpenCode (see *Hard cases*, 3) |
| K6 | 454 | Under `ritemark.codex.approvalPolicy` | When Codex should ask for your approval before running shell commands or modifying files. | When ChatGPT should ask for your approval before running shell commands or modifying files. |
| K7 | 466 | `ritemark.codex.sandboxMode`, `read-only`'s description | Codex can only read files (no writing or command execution) | ChatGPT can only read files (no writing or command execution) |
| K8 | 467 | The same, `workspace-write`'s description | Codex can read and write files within the workspace (recommended) | ChatGPT can read and write files within the project (recommended) |
| K9 | 470 | Under `ritemark.codex.sandboxMode` | What Codex is allowed to do on your filesystem. | What ChatGPT is allowed to do on your filesystem. |
| K10 | 495 | `ritemark.ai.selectedAgent`, the `codex` choice's description | Codex (experimental) - OpenAI coding agent with ChatGPT authentication | ChatGPT (experimental) - OpenAI's agent, signed in with your ChatGPT account |

There is no `package.nls*.json`. No command, view or category title in `package.json` names Codex. `branding/product.json` does not name Codex. No Ritemark hunk in `patches/vscode/` adds a visible "Codex" string (the two that name it are under *What stays*).

### Not shown today, changed in the same pass (7)

These are written for people but no screen shows them now. Changing them keeps the QA search's list short, and they would be right the day something shows them.

| File:line | Why it is not shown | Now | Will say |
|---|---|---|---|
| `src/features/flags.ts:131` | No code reads a flag's `description` (`featureGate.ts` reads only status and platforms); the feature switches' UI was removed from Settings | …Give to agent with Claude Code, Codex or OpenCode. | …Give to agent with Claude Code, ChatGPT or OpenCode. |
| `src/features/flags.ts:229` | The same, a `label` | Codex CLI Integration | ChatGPT |
| `src/features/flags.ts:230` | The same | ChatGPT-authenticated coding agent using OpenAI Codex CLI | OpenAI's agent, signed in with a ChatGPT account |
| `src/flows/nodes/CodexNodeExecutor.ts:67` | Sent as `flow:codexProgress` (`FlowEditorProvider.ts:623`); the Run panel listens only to Claude Code's progress (`ExecutionPanel.tsx:137`) | Starting Codex... | Starting ChatGPT... |
| `src/flows/nodes/CodexNodeExecutor.ts:85` | The same | Codex is working... | ChatGPT is working... |
| `src/flows/nodes/CodexNodeExecutor.ts:160` | The same | Codex completed | ChatGPT finished |
| `webview/src/components/ai-sidebar/threadStatus.ts:23` | `RUNTIME_LABEL` is exported but nothing imports it | Codex | ChatGPT |

## Hard cases

1. **The comment handle `@codex`.** It is syntax, not only a word. A person types it into the document, and it is saved there. The parser reads it (`commentModel.ts:79–84`), and the host keeps the same list (`src/commentTasks/types.ts:34`), checked against the webview's by `types.test.ts`. The AI is told about it too (`src/ai/capabilityContext.ts:104`). Swapping the word would break every comment already assigned with it. The recommendation for 2.0: the handle stays `@codex`, and the name beside it says ChatGPT (I1). An extra `@chatgpt` handle is a code change, not copy, and needs its own decision. I2–I4 stay until then.
2. **Names VS Code makes from setting keys.** VS Code's settings page names a setting from its key (`vscode/src/vs/workbench/contrib/preferences/browser/settingsTreeModels.ts:758–777`, `…/common/preferences.ts:242–258`). So it shows "Codex: Approval Policy" for `ritemark.codex.approvalPolicy`, "Codex: Sandbox Mode" for `ritemark.codex.sandboxMode` and "Codex-integration" for `ritemark.features.codex-integration`. R22 keeps the keys, so these words stay. In VS Code 1.117 an extension's setting cannot carry its own title (the editor's `setting.title` is never set from a contribution, `preferencesModels.ts:729–766`). Also, the `ritemark.ai.selectedAgent` menu shows the value `codex` (`package.json:490`). `enumItemLabels` (`vscode/src/vs/workbench/api/common/configurationExtensionPoint.ts:82–87`) can show "ChatGPT" there, with `codex` still in smaller type after it. The recommendation: add `enumItemLabels` to that one setting, and let R22 say the key-made names stay.
3. **The "Codex" section holds OpenCode's setting.** `ritemark.opencode.autoApprove` (`package.json:473`) sits in the section titled "Codex" (`:437`). A plain swap would put OpenCode under "ChatGPT". K5 proposes the title "ChatGPT and OpenCode". Moving the setting to another section would also keep its key and value, but that is more than copy.
4. **A model's name and the AI's name in one place.** "GPT-5.3 Codex Spark" (`bundledCatalog.ts:88`) is OpenAI's name for a model and stays. In "Most capable Codex model" (F1) "Codex" names OpenAI's model family, under a heading that will say ChatGPT. F1 drops the word rather than swapping it. A model that only Codex's own list knows shows the name and description Codex wrote (`providerDiscovery.ts:180, 216–222`), and those stay.
5. **"Codex" as the program, not the AI.** A1, A4, A5, C2, C4, C10, C11, E18, K1 and K3 talk about the program a person installs with npm. They still say ChatGPT. The npm command keeps its package name, so a person who needs the real name sees it there.
6. **The AI information panel's Runtime row** (E24). For Claude it says "Claude Code", the program. For ChatGPT it will say "ChatGPT", by R22. The provider row still says OpenAI.
7. **Words already saved stay as they were.** New words apply to what is written after the change. These keep the old word: a flow step saved with the label "Codex" (G9's default), a card's history line "Gave it to Codex" or "Retried with Codex" in the card's own file (`src/taskBoard/BoardController.ts:802, 930`; `src/taskBoard/cardFile.ts:182–188`), and "Continuing with Codex." already in a chat's history (`ConversationController.ts:395`). This is a copy pass, so they are not rewritten.

## What stays

| Kind | Examples (file:line) | Why |
|---|---|---|
| Setting keys and values | `ritemark.codex.approvalPolicy` (`package.json:439`), `ritemark.codex.sandboxMode` (`:457`), `ritemark.features.codex-integration` (`:355`), the value `codex` of `ritemark.ai.selectedAgent` (`:490`) | What a person set is kept (R22). Their visible names are *Hard cases*, 2 |
| Command IDs | `ritemark.codexLogin` (`src/extension.ts:759`, `src/taskBoard/taskBoardHost.ts:60`, `src/ritemarkEditor.ts:1118`) | Not in `package.json`'s commands, so no title shows |
| Message types | `codex:startLogin`…`codex:repair` (`src/settings/RitemarkSettingsProvider.ts:441–466`), `codex-progress`, `codex-result` (`src/views/UnifiedViewProvider.ts:1092, 1221`), `flow:codexProgress` (`src/flows/FlowEditorProvider.ts:623`) | Code between host and webview |
| IDs | the runtime `codex` (`src/agent/types.ts:21`), provider and surface `codex` (`src/ai/modelCatalog/schema.ts:99–117`), the flow step type `codex` / `codexNode` (`src/flows/types.ts:72`, `webview/src/components/flows/stores/flowEditorStore.ts:134`), the card actor `codex` (`src/taskBoard/cardTypes.ts:16`), the flag `codex-integration` (`src/features/flags.ts:227`), the sheet's view `codex-setup` (`webview/src/components/ai-sidebar/sidebarGate.ts:19`), `codex-cli` (`webview/src/components/ai-sidebar/types.ts:216`), the model ID `gpt-5.3-codex-spark` (`src/ai/modelConfig.ts:33`) | Saved in files and settings, or code only |
| The comment handle `@codex` | `commentModel.ts:79`, `src/commentTasks/types.ts:34` | Held (*Hard cases*, 1) |
| File, folder and program names | `src/codex/`, `CodexRuntime.ts`, `CodexSetupView.tsx`, `CodexNode.tsx`; the programs `codex-app-server`, `codex.exe` (`src/utils/bundledAgentRuntime.ts:35–46`); the log `ritemark-codex-trace.log` (`src/codex/codexTrace.ts:3`); the temp folder `ritemark-codex-protocol-` (`src/codex/codexManager.ts:739`); Codex's own `~/.codex` (`src/welcome/welcomeHost.ts:905`, `src/ai/modelCatalog/providerDiscovery.ts:180`) | Names on disk |
| Code identifiers | `CodexRuntime`, `CodexManager`, `codexStatus`, `CODEX_MODEL_IDS` (`src/ai/modelConfig.ts:24`), `BUNDLED_CODEX_REPAIR_MESSAGE` | Code |
| Log lines | `console.*`: `src/flows/nodes/CodexNodeExecutor.ts:41, 54, 60`, `src/codex/codexManager.ts:482, 490`, `src/codex/codexAppServer.ts:416`, `src/views/UnifiedViewProvider.ts:2698`; the log label `'Codex status'` (`UnifiedViewProvider.ts:2653, 2677, 2694, 2707`, used only in `console.error`, `:2331`); the Output channel "Ritemark Codex Trace" (`src/codex/codexTrace.ts:3`), made only with `ritemark.ai.debugTrace` on (`src/utils/runtimeTrace.ts:24–31, 78–85`) | Logs |
| A model's own name | "GPT-5.3 Codex Spark" (`src/ai/modelCatalog/bundledCatalog.ts:88`); live-only models from Codex's list (`providerDiscovery.ts:216–222`) | OpenAI's names |
| Text the runtime writes | the program's first line of output (`src/codex/codexManager.ts:387, 697–703`), a turn's error (`src/codex/CodexRuntime.ts:112–121`, `CodexNodeExecutor.ts:155–157`), an RPC error (`src/codex/codexAppServer.ts:463`), an error such as "The '…' model requires a newer version of Codex" (`src/commentTasks/types.ts:226–228`) | Shown as it came (R22). Ritemark's words around it say ChatGPT |
| Commands, packages and links | `npm install -g @openai/codex` (`src/agent/installer.ts:426`, `src/codex/codexManager.ts:620–648`, inside C2), the "Learn more" link to OpenAI's Codex page (`RitemarkSettings.tsx:785`) | A person types or follows them as written |
| Analytics values | `agent: 'codex'` (`src/flows/FlowExecutor.ts:114`) | An event's value. The welcome's events already say `chatgpt` (`src/analytics/posthog.ts:210`) |
| Never shown | "Codex lifecycle capabilities detected." (`src/codex/codexManager.ts:822`; the notice shows only when features are missing, `CodexView.tsx:108`); "CodexRuntime: createSession() must succeed…" (`src/codex/CodexRuntime.ts:211`, a programmer's check); "Mock Codex response…" (`src/flows/FlowTestRunner.ts:357`, the command `ritemark.flows.runTests` is not in `package.json`); the AI's instructions (`src/ai/capabilityContext.ts:104`) | Nobody reads them in the app |
| Comments, and the patches | code comments everywhere, including a JSX comment's second line (`RitemarkSettings.tsx:650`); patch 009's header (`patches/vscode/009-ritemark-browser-context-bridge.patch:10`); patch 019's comment and its test's sample terminal name "Install Codex" (`patches/vscode/019-ritemark-tab-row.patch:1144, 1547, 1553`) | Not visible. Patch 019's test passes with any name, so the patch need not change |

## Tests whose expected words change

These fail until their words change with the strings (14 lines in 8 files):

| Test file:line | Expects now | Changes with |
|---|---|---|
| `src/codex/codexManager.test.ts:370` | Codex is runnable, but… | C16 |
| `src/codex/codexManager.test.ts:372` | …the current Codex app-server protocol. | C14 |
| `src/codex/codexManager.test.ts:415` | The bundled Codex runtime could not start (…)… | C12 |
| `src/runtime/availability.test.ts:159` | starts with "Codex is signed out" | D8 |
| `src/taskBoard/BoardController.test.ts:175` | Codex is signed out. Sign in and try again. | D8 |
| `src/conversations/ConversationController.test.ts:217` | Continuing with Codex. … | D7 |
| `src/views/agentSidebarBootstrap.test.ts:100` | /Codex model catalog is empty/ | D6 |
| `webview/src/components/tasks/taskCopy.test.ts:53` | Queued for Codex (twice) | D8 |
| `webview/src/components/tasks/taskCopy.test.ts:99`, `:100` | Reviewing · Codex | D8 |
| `webview/src/components/tasks/taskCopy.test.ts:137` | Codex finished in 1m 01s | H5 |
| `webview/src/components/comment/commentTaskCopy.test.ts:68` | Codex is working | I1 |
| `webview/src/components/comment/commentTaskCopy.test.ts:187` | → Release note review · Codex takes over | I1 |
| `webview/src/components/ai-sidebar/runtimeSwitching.test.ts:253` | Continuing with Codex. … | E26 |

Words a rewrite must keep, or these tests fail:
- `src/codex/codexManager.test.ts:148, 170` look for "Reinstall Ritemark" (C3, C12).
- `:159` looks for "reinstall Ritemark" and `:158` for "npm install -g @openai/codex" (C2).
- `:182` checks that an own install's error does not say "Reinstall Ritemark".

Sample data that passes either way and may follow the new words: `boardClicks.test.ts:101`, `commentTaskCopy.test.ts:222, 252–253`, `ExecutionPanel.test.ts:59`, `runtimeSwitching.test.ts:663`, `bootstrapStorageIsolation.test.ts:72`. Two stay as they are: `conversationProjection.test.ts:39, 54` is a saved boundary (*Hard cases*, 7), and `codexManager.test.ts:286` matches the string that stays at `codexManager.ts:822`.

Tests that already guard the welcome against "Codex" stay: `src/welcome/welcomeState.test.ts:52, 56`.

## The QA search

QA runs these three from the worktree's root after the pass. They use `git grep`, so they read only tracked files. They skip tests, test data and comment lines.

```sh
P=(extensions/ritemark/src extensions/ritemark/webview/src extensions/ritemark/package.json branding/product.json patches/vscode
   ':(exclude)*.test.ts' ':(exclude)*.test.tsx' ':(exclude)extensions/ritemark/src/ai/modelCatalog/testdata')
NOCOMMENT=':[0-9]+:[[:space:]]*(//|\*|/\*|\{/\*|#|\+[[:space:]]*(//|\*|/\*))'

# A: "Codex" as a word
git grep -n -I -w 'Codex' -- "${P[@]}" | grep -v -E "$NOCOMMENT"

# B: "codex" standing alone in text: not a quoted ID, a path, a package or part of a name
git grep -n -I -P "(?<![\w.:/\$'\"\x60@-])@?codex(?![\w./:'\"\x60-])" -- "${P[@]}" | grep -v -E "$NOCOMMENT"

# C: the ID used as a label
git grep -n -I -E "label:[[:space:]]*['\"]codex['\"]" -- "${P[@]}"
```

The commands were run in both bash and zsh. Today A finds 125 lines, B 9 and C 1.

After the pass, every line found must match one row below. Paths are as `git grep` prints them, from the root.

**A may find (16 lines):**

| File | Pattern on the line |
|---|---|
| `extensions/ritemark/src/ai/modelCatalog/bundledCatalog.ts` | `GPT-5.3 Codex Spark` |
| `extensions/ritemark/src/codex/codexManager.ts` | `Codex app-server exited unexpectedly with code` (a `console.error`) |
| `extensions/ritemark/src/codex/codexManager.ts` | `Codex lifecycle capabilities detected.` |
| `extensions/ritemark/src/codex/codexTrace.ts` | `Ritemark Codex Trace` |
| `extensions/ritemark/src/flows/FlowTestRunner.ts` | `Mock Codex response` |
| `extensions/ritemark/src/flows/nodes/CodexNodeExecutor.ts` | `console.log('[Codex]` or `console.error('[Codex]` (3 lines) |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | `'Codex status'` (4 lines) |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | `[Agent Chat Codex status]` |
| `extensions/ritemark/webview/src/components/settings/RitemarkSettings.tsx` | `Codex the error below says to reinstall Ritemark. */}` |
| `patches/vscode/019-ritemark-tab-row.patch` | `'Install Codex'` (2 lines) |

**B may find (6 lines, 8 while `@codex` is held):**

| File | Pattern on the line |
|---|---|
| `extensions/ritemark/src/codex/codexAppServer.ts` | `console.error('[codex stderr]'` |
| `extensions/ritemark/src/codex/codexManager.ts` | `console.error('Failed to spawn codex app-server:'` |
| `extensions/ritemark/src/codex/codexManager.ts` | `\/bin\/)codex$/` (a path match) |
| `patches/vscode/019-ritemark-tab-row.patch` | `codex` as a variable in the test (3 lines) |
| `extensions/ritemark/webview/src/components/MarginCommentRail.tsx` | `@claude, @codex, or @opencode` (held, I3) |
| `extensions/ritemark/webview/src/components/header/CommentsMenuButton.tsx` | `<code>@codex</code>` (held, I4) |

**C may find nothing.**

Three things no search finds, so QA checks them by eye in S59:
- the @ picker's `@codex` beside the name (I2, built from the alias at `AgentMentionPicker.tsx:176`);
- VS Code's settings page: the names made from keys, and the `ritemark.ai.selectedAgent` menu (*Hard cases*, 2);
- F1 in the model picker, which depends on the published feed.

## Totals

Visible strings to change, by area (104):

| Area | Strings |
|---|---|
| A. Ritemark Settings | 12 |
| B. Settings' host (toasts, terminal, card errors) | 8 |
| C. ChatGPT's status and errors | 20 |
| D. The AI sheet's host, the shared label, the install terminal | 9 |
| E. The AI sheet | 27 |
| F. The model catalog | 1 |
| G. Flows | 10 |
| H. The task board | 5 |
| I. Comments | 1 |
| J. The Agents place | 1 |
| K. VS Code's settings page | 10 |

Across those areas: 9 are toasts (B1, B2, B4, B6, C1, D3, D5, and C5 and C20 when they reach a toast), and 3 are terminal tab names (B5, D4, D9). The AI's name is spelled in 16 separate places, one per map or condition (D7, D8, E1, E2, E4, E14, E22, E24–E26, H1, H3–H5, I1, and `threadStatus.ts:23`). The pass changes each one; it does not merge them.

Also:
- not shown today, changed in the same pass: 7;
- held for a decision, the `@codex` handle: 3 visible (I2–I4), plus the AI's instructions;
- shown but not changeable by copy, the names VS Code makes from keys: 3 setting names and 1 menu value.

What stays, by kind: 3 setting keys and 1 value; 1 command ID; message types, IDs, file and program names and identifiers (kinds, not counted line by line); 11 log lines and 1 debug Output channel; 1 model name in the bundled catalog; text the runtime writes (4 kinds); 2 commands or links; 1 analytics value; 4 strings never shown; 5 comment or patch lines.

Tests: 14 expected lines in 8 files change; 5 lines need their words kept.

## What this changes in R22 and W16

1. **R22 should name the `@codex` handle.** Recommended: the handle stays for 2.0, and the name beside it says ChatGPT. A `@chatgpt` handle is code and comes later, or gets its own decision.
2. **R22 should say what VS Code's settings page keeps.** The keys stay, so "Codex: Approval Policy", "Codex: Sandbox Mode" and "Codex-integration" stay where Advanced settings (R23) leads. W16 adds `enumItemLabels` to `ritemark.ai.selectedAgent`, and titles the section "ChatGPT and OpenCode".
3. **R22 should say that saved words stay.** Flow step labels, card history and chat history keep "Codex" where it was written before the change.
4. **W16 bumps the bundled catalog's date** (`bundledCatalog.ts:37`) with F1. The 2.0 release refreshes the published feed, or the picker keeps the old description.
5. **W16 fixes two pointers in the same strings.** "Settings > Features" (C5, G1) and "under Agent Runtime" (G3) name places that no longer exist.
6. **W16 leaves patch 019 alone.** Its comment and test name "Install Codex", but no person reads them. The test makes its own sample terminal, so it passes either way.
7. **The user documents are outside this audit.** `docs/user/` names Codex about 100 times in 13 files (`git grep -c -i -w codex -- docs/user`). R22 says "anywhere else a person reads Codex". Whether that covers the user documents in this sprint is an open question.
