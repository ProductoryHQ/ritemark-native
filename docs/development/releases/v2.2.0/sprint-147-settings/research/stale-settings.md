# A2: stale Settings (#460)

Sprint 147, audit A2, for R11 and PR 3. Every way a change made elsewhere reaches an open Settings tab, whether `main`
redraws it, and what PR 3 adds.

**Method: code reading only.** It was daytime, so no dev instance was launched (no pop-up test windows). The table is
from `origin/main` at `e609ba18` (`src/settings/RitemarkSettingsProvider.ts` and the emitters it names). Its re-run on
a dev instance, on PR 3's branch, is a launch check still to do; this file gets its results then.

## The table

"Today" is `main` before PR 3. "Redrawn" means the open tab shows the change without being closed and opened again.

| # | Change made elsewhere | How it reaches the tab today | Today | PR 3 |
|---|---|---|---|---|
| 1 | Claude signed in from the welcome | `claudeLogin.ts` emits `login-started`; Settings' listener polls `getSetupStatus` every 2 s | Redrawn (a full probe run every 2 s) | Redrawn: the poll asks Claude's part only |
| 2 | Claude signed in from the AI's sheet | `UnifiedViewProvider` emits `login-finished` | Redrawn (full run) | Redrawn: Claude's parts only (`claudeEventParts`) |
| 3 | ChatGPT signed in from the welcome or the AI's sheet | `CodexRuntime` and `UnifiedViewProvider` emit `login-finished`; Settings recreates its app server | Redrawn (full run, and the auth twice) | Redrawn: ChatGPT's part only (`codexEventParts`) |
| 4 | ChatGPT signed out from the AI's sheet | `UnifiedViewProvider` emits `logout` | Redrawn (full run) | Redrawn: ChatGPT's part only |
| 5 | The runtime choice changed in All settings or `settings.json` | Nothing: the only configuration listener was `ritemark.analytics.enabled` | **Stale** (and no AI's cached state was invalidated) | Redrawn: `settings`, and Claude's, ChatGPT's and the tools line's parts; the invalidation is emitted from the configuration listener, for every surface |
| 6 | Another setting the page shows changed in All settings or `settings.json` (`ai.agentTimeout`, `ai.debugTrace`, `chat.fontSize`, `codex.approvalPolicy`, `codex.sandboxMode`, `opencode.autoApprove`, `updates.enabled`) | Nothing | **Stale** | Redrawn: `settings` only, no probe (`PAGE_CONFIG_KEYS`) |
| 7 | Usage data from the welcome | The `ritemark.analytics.enabled` listener (Sprint 133) | Redrawn (full run) | Redrawn: `settings` only |
| 8 | The theme from the palette or the OS | `onDidChangeActiveColorTheme` | Redrawn (full run) | Redrawn: `settings` only; `workbench.colorTheme` and `window.autoDetectColorScheme` are followed too |
| 9 | The Anthropic key saved by the welcome | `welcomeHost.ts` stores it and emits `settings-updated` | Redrawn (full run) | Redrawn: `secrets.onDidChange` sends `settings`, and Claude's part |
| 10 | Another key saved by the welcome, or by the guidance (`GuidanceHost.ts`) | The secret is stored; no event | **Stale** ("Not added" stays) | Redrawn: `secrets.onDidChange` for the five names (`settingsKeys.ts`) |
| 11 | The OpenAI key saved or removed by `Ritemark: Configure API Key` (`apiKeyManager.ts`) | No event | **Stale** | Redrawn: `secrets.onDidChange` |
| 12 | Google Docs connected or disconnected from Share | The Google Docs controller's settings listener posts `google-docs/settings` | Redrawn | Unchanged |
| 13 | An update found, installed or snoozed from the bell | No event from `src/update/` | **Stale** until the tab is opened again | Re-read when the tab comes back into view (the snapshot, no network) |
| 14 | A sign-in in a terminal for this computer's runtime (`claude login`, `codex login`) | No event; Claude's status is cached until one | **Stale** | Checked again when the tab comes back into view: Claude asked with `refresh: true`, ChatGPT's account asked again, the tools line again |

## What PR 3 adds, and what it leaves

- **Listeners:** one `onDidChangeConfiguration` for every setting the page shows (rows 5–8), `secrets.onDidChange`
  for the five key names (rows 9–11), and `onDidChangeViewState` for what no event reports (rows 13–14). The
  check on view runs once the open's probes are in, not while they fill in, and at most once in 30 s. A shown saved key is dropped when the tab is hidden or the key is removed elsewhere.
- **What each redraw sends:** only what changed: `settings` (no probe) for a setting or a key, and the part of the AI
  whose event it was. Changes in one turn are coalesced into one `settings` and one probe run.
- **No `src/update/` event.** Row 13 is covered by the check on view, which is enough for a tab that isn't in view
  while the bell is used. A tab in view beside the bell (split desks) stays stale until it is shown again; an event
  in `src/update/` would cover it, and is left out to keep that High path untouched unless the re-run shows it matters.
- **Row 14 for ChatGPT:** Settings keeps one ChatGPT app server; whether its account answer sees a terminal sign-in
  without the server being recreated is for the re-run to show.
