# Confirmations (Phase 1)

Checked 2026-10-18 on `sprint-133-welcome` (main `de2b7d6b`). Line numbers are this branch's.

## 1. Telling a 1.x profile from a fresh one

- `ritemark.activation.lastConfirmedVersion` is written only at the end of `activate()` (`extension.ts:989–991`, `confirmActivationAndCleanup`), so the top of `activate()` reads the version of the profile's previous successful start. `lastAttemptedVersion` is overwritten at `extension.ts:283`; it is not the signal.
- On the four v1.14.0 profiles below, `lastConfirmedVersion` was `"1.14.0-0"` (the bundled, floored version). Over-the-air extension versions are `X.Y.Z-ext.N`; a run from source is `1.14.0`.
- **Main's own version is still `1.14.0`** (`package.json:5`; 2.0.0 is set in step 4). After this build's first start, `lastConfirmedVersion` holds this build's version too, so "below 2.0.0" cannot be re-evaluated on later starts. **The kind is decided once, on the first start of this build, and stored** (`ritemark.welcome.kind`: `fresh` or `update`), before `confirmActivationAndCleanup` runs. Later starts read the stored kind until `ritemark.welcome.finished` is written. This is a refinement of W6's rule, not a change to R10: the update welcome still shows once and only for a 1.x profile.
- Profiles older than Sprint 93 (no activation keys) are rare; for them the same first-start reading also accepts `ritemark.analytics.anonymousId` or `ritemark.analytics.hasSeenNotice` (both written only by 1.x; from this sprint neither is written before a yes) as 1.x evidence. `ritemark.designFoundationsThemeMigration` is not used: this build writes it 1.5 s after a fresh profile's first start.

## 2. 1.x's usage-data answers, on four real v1.14.0 profiles

The installed v1.14.0 (`/Applications/Ritemark.app`, `posthog.ts` unchanged since the `v1.14.0` tag) was started four times in the background, each with its own short profile and `RITEMARK_POSTHOG_PROJECT_KEY` / `RITEMARK_POSTHOG_HOST` pointing at a closed local port, so the notice showed and nothing reached PostHog. Each was answered over CDP, then quit with ⌘Q (`window.confirmBeforeClose: never`). What each profile kept:

| Answer | `globalState` `ritemark.analytics.hasSeenNotice` | `User/settings.json` `ritemark.analytics.enabled` |
|---|---|---|
| OK | `true` | unset |
| Opt Out | `true` | `false` |
| The notice's × (Clear Notification) | `true` | unset (the same as OK) |
| No answer (quit while it showed) | absent | unset |

This matches W1 exactly. The reading built (Jarmo, 18 October): unset + `hasSeenNotice` → yes, carried over; `false` → no; unset with no `hasSeenNotice` → unknown, off; an explicit `true` (only a person writes it) → yes. `inspect('analytics.enabled').globalValue` is read, never `get`, because the default becomes `false` in this sprint.

Seen on the way: started with `open -g` (in the background), 1.x put the notice straight into the notification centre (the bell showed a dot), not on screen as a toast. The answers above were given there; it resolves the same promise. People who started 1.x in front saw the toast.

All four profiles are kept under `/tmp/r133/` for the update scenarios (S28, S33–S36, S52, S53); the OK profile also has three recent folders, the last one "Leadership programme".

## 3. The sign-in entry points the welcome calls

| Provider | Start | Progress and end | Cancel | State |
|---|---|---|---|---|
| Claude | `beginClaudeLogin(binaryPath, { onUrl, onComplete, onError, onTimeout, onCancel })` (`agent/claudeLogin.ts:54`), the one app-wide flow Settings and the AI sheet share; `binaryPath` from `getSetupStatus({ refresh: true })`, which must be `runnable` | `onUrl(url)` once the CLI prints its link (the backup link); `onComplete`, `onError(message)`, `onTimeout` (5 min); a second surface joining a running flow gets `'already-running'` and the same callbacks | `cancelClaudeLogin()` (`:93`) kills the subprocess and calls `onCancel` | `getSetupStatus()` (cached): `ready`, `needs-auth`, `auth-in-progress`, `not-installed`, `broken-install`; probes 3 s (lookup), up to 15 s (`--version`, cold), 5 s (`auth status`), 3 s (keychain) |
| ChatGPT | The AI sheet's own Codex runtime: `CodexRuntime.beginLogin()` returns the sign-in link, opened with `openExternal`; `setLoginInProgress(true)` and `startLoginPolling(onStatus)` as `UnifiedViewProvider._handleCodexLogin` does (`UnifiedViewProvider.ts:2638`) | `startLoginPolling` reports `CodexSidebarStatus` every 2 s, stops at `ready` or after 60 tries (2 min); `emitCodexStatusInvalidated('login-started' / 'login-finished')` keeps Settings in step | No RPC cancels a Codex sign-in; Settings' "cancel" only stops waiting (`codex:cancelLogin`). The welcome does the same: `stopLoginPolling`, `setLoginInProgress(false)` | `CodexRuntime.getCodexSidebarStatus()`: `ready`, `needs-auth`, `auth-in-progress`, `broken-install`, `disabled` |
| OpenCode | No sign-in. Keys of the person's own in SecretStorage (`openai-api-key`, `google-ai-key`, `anthropic-api-key`, `openrouter-api-key`), stored as Settings' `setApiKey` does | — | — | `deriveOpenCode` (`runtime/availability.ts:128`): ready when a key is set and that provider has models |

All three states come from one host function, `UnifiedViewProvider.runtimeAvailability(runtimeId)` (`UnifiedViewProvider.ts:1917`), the same one the task board's Give to agent uses. The welcome asks it for each provider and never keeps a copy of a check.

Using the AI sheet's Codex runtime (rather than Settings' own `CodexAppServer`, `RitemarkSettingsProvider.ts:888`) is deliberate: the landing opens a chat on that same runtime, and its polling already reports progress. Settings' path only shows toasts.

The Git and Node.js line (R5) reads `getAgentEnvironmentStatus()` (`agent/setup.ts:583`): `gitRequired`, `gitInstalled`, `nodeRequired`, `nodeInstalled`, `restartRequired`, `recommendedAction`. `gitRequired` and `nodeRequired` are true only on Windows with `ritemark.agentRuntime.preference: system` (`systemRuntimeToolsRequired`, `:144`).

## 4. The healer and #429

- The healer (`extension.ts:309–330`, `utils/stickyTabHealer.ts`) runs once per profile, 1.5 s after start. For each `.md`/`.markdown` text tab it runs `vscode.openWith(uri, 'ritemark.editor', { viewColumn, preserveFocus })`. A text editor and a custom editor are different inputs, so VS Code opens the Ritemark tab **beside** the text tab: two tabs (#429's second half, reproduced by the issue with `"workbench.editorAssociations": {"*.md": "default"}`).
- The fix (W7): the selection keeps the tab it found (`TabLike`), and after `openWith` succeeds the healer closes that text tab with `vscode.window.tabGroups.close(tab)`. A text tab with unsaved changes is not closed (closing would ask to save); it is left beside the Ritemark tab, as today. The pure function's test gains the replace case and the dirty case.
- The first half of #429 (why the first resolve sometimes picks text, 1 in 25 launches) stays a VS Code start-up race; with the healer replacing instead of adding, the person ends with one tab either way.
