# Sprint 147 Technical Plan

The plan for [spec.md](spec.md). The release is 2.2.0 ([release-plan.md](../release-plan.md)). Code shapes here are proposals; when the code needs something else, this file changes first. File references are to `origin/main` at `e86cbb0c` (1 November 2026). Paths are under `extensions/ritemark/` unless they say otherwise; `webview/…` is `extensions/ritemark/webview/src/…`. **The code was read for this plan, not run:** no dev instance, build or test was started.

## What exists today

| Part | Today | File |
|---|---|---|
| The host | One file of 1,558 lines: the panel, every message, the key store and tests, the sign-in calls, the probes | `src/settings/RitemarkSettingsProvider.ts` |
| The page | One component of 2,101 lines, plus the Google Docs card and the Advanced settings link | `webview/components/settings/RitemarkSettings.tsx`, `GoogleDocsSettingsCard.tsx`, `AdvancedSettingsLink.tsx` |
| Messages from the page | 28 types (`ready`, `openExternal`, `setSetting`, `usageData:set`, `theme:set`, `setApiKey`, `testApiKey`, `settings:openAdvanced`, `transcription:clearStorage`, eight `claude:*`, five `codex:*`, six `updates:*`) and Google Docs' five | `RitemarkSettingsProvider.ts:297–528`; `src/googleDocs/protocol.ts` |
| The first draw | The page shows a spinner until one `settings` message arrives | `RitemarkSettings.tsx:342–348`, `:194` |
| What that message waits for | Five secrets read one by one, transcript storage's size, the update snapshot (and a network check when none was ever made), component status (Claude's setup status, ChatGPT's binary and sign-in, the voice model) and the environment (Git and Node probes), all awaited before anything is posted | `RitemarkSettingsProvider.ts:577–740`, `:743–900` |
| How often it runs | Twice per open (the end of `resolvePanel` and the `ready` handler), and again on every setting change, theme change and status event; ChatGPT's binary status is read twice per run | `:571`, `:311–312`, `:336–350`, `:558`; `getComponentStatus` and `sendCodexAuthStatus` (`:1435`) |
| Keys in the page | Every saved key's value goes to the page, "full for input", to fill the fields and the eye | `:595–610`, `:711–735` |
| The page's CSP | Allows `connect-src` to two AI hosts | `:1323` |
| Live redraws today | The theme, usage data (`ritemark.analytics.enabled` only), Claude's and ChatGPT's status events, Google Docs' projection | `:176–181`, `:196–243`, `:558`, `:542` |
| Status events | Emitted by the welcome, the AI's sheet, Claude's login module and ChatGPT's runtime | `src/agent/claudeLogin.ts`, `src/welcome/welcomeHost.ts`, `src/views/UnifiedViewProvider.ts`, `src/codex/CodexRuntime.ts` |
| Ways in | `ritemark.aiSettings` with five section names; a dozen openers pass none | `src/extension.ts:815`; `RitemarkSettingsProvider.ts:148–155` |
| Probes in sign-in code | `getSetupStatus` and `getAgentEnvironmentStatus` | `src/agent/setup.ts:569`, `:583` (High tier) |
| Shared controls | Tabs (Radix 1.1.13, vertical supported), Select, Switch, Dialog, Button (with a `link` variant), Tooltip; no segmented control or radio group | `webview/components/ui/`; `webview/package.json:17–31` |
| The pointer rule | One global rule for buttons, roles, links, `label[for]`, `summary`, `select` | `webview/index.css:9–23` |
| What the Claude SDK reports | A session's init message lists skills, plugins and MCP servers; `mcpServerStatus()` and `supportedCommands()` | `@anthropic-ai/claude-agent-sdk` 0.3.310, `sdk.d.ts:3076–3094`, `:6205–6230` |
| What Ritemark reads of it | Nothing for Claude, ChatGPT or OpenCode; ACP's `available_commands_update` is ignored | `src/acp/acpManager.ts:483`, `:551` |
| Ritemark's own tools | One registry, injected into every runtime | `src/runtime/ritemarkTools.ts` |

## Phase 1: audits, before the code they gate

Each writes one file in `research/`.

- **A1, the Windows draw (#593): the sprint's first task.** A measurement branch adds timing lines only (no behaviour change): in the host at the panel's creation, the HTML set, `ready` received, each probe's end and each message posted; in the page at the script's start, the first render and the first render with settings. Each line names the step and the milliseconds since the panel's creation, nothing else. The "Ritemark on Windows" session runs it through the test overlay (`scripts/qa/make-windows-test-overlay.sh`, `windows-branch-test.ps1`): five normal starts with Settings opened from You ▸ Settings once the AI column shows, and five with Settings restored as the open tab. The same ten on the Mac, on a hidden dev instance. Medians and spread in `research/windows-draw-time.md`, naming the slow steps and how much is the script's own load. R10's target and W5's shape follow it. The branch isn't merged; PR 3 keeps one summary line.
- **A2, stale Settings (#460).** On a dev instance with Settings open: Claude signed in from the welcome and from the AI's sheet; ChatGPT the same; a sign-out from the AI's sheet; the runtime choice and each other setting the page shows changed in All settings and in `settings.json`; a key saved by the welcome and by `Ritemark: Configure API Key`; Google Docs connected from Share; an update found from the bell; a sign-in in a terminal with this computer's runtime. Each row: redrawn or stale, and the event or listener missing. `research/stale-settings.md`.
- **A3, what each AI reports (#415).** For the bundled Claude (0.3.310), ChatGPT and OpenCode: what each reports of its skills, connectors and plugins, by which call, whether it needs a session (and a sign-in, a network call or a keychain read), and how long it takes on the Mac and on Windows. It names what each can't report, so the list says so instead of reading another app's files. `research/agent-capabilities.md`.
- **A4, the inventory against the code.** At the sprint branch's start: every message type, `ritemark.*` key and payload field the page uses; every state each row has; which runtimes honour `timeoutMinutes` (I41's words); the `docs/user/` pages that name Settings' sections. Rows it finds go into spec R1's table first. `research/inventory-check.md`.

## Workstreams

### W1: The inventory test (R1), first

`webview/components/settings/settingsInventory.test.ts` (in `npm test`): the 28 message types and Google Docs' five, and the `ritemark.*` keys the page writes, as a list. It reads the Settings components' sources and fails when one is no longer sent; it reads `handleMessage`'s cases and fails when one is gone. It is written against today's page, so it passes before the new page exists and holds the new one to the same list. The mapping of today's five section names to the new places gets its own small test.

### W2: The frame (R2) and the one new control

- `webview/components/settings/` is split by section: `SettingsPage.tsx` (the frame and the list), `AiAccountsSection.tsx`, `AppearanceSection.tsx`, `SharingSection.tsx`, `UsageDataSection.tsx`, `UpdatesSection.tsx`, `AdvancedSection.tsx`, and `SettingsRow.tsx` (name, one line, control). `RitemarkSettings.tsx` shrinks to the data and messages, then goes once nothing imports it.
- The sections are a list of data (id, name, icon, component, and the flag or condition that shows it), so Sprint 151 adds AI on this computer and Sprint 149 adds Web pages with one entry each.
- The list is `ui/tabs.tsx`, vertical. If the drawn chosen fill needs a variant, it goes in `tabs.tsx`, not a local class.
- **`ui/segmented-control.tsx`** (new): two or three choices on native radio inputs (keyboard and screen readers for free, no new dependency), used by Where the AI runs from and Text size in chats; the theme pictures are its large variant if the lead's drawing allows, else a Settings component built on it. Its catalogue row and approved images go in with it (Sprint 146 R2, R4), and `control-states.mjs` runs on its PR.
- The page draws from whatever parts it has: every part of the payload may be missing and shows "Checking…" until it comes. So PR 3 changes when parts arrive, not how the page reads them.

### W3: The sections' rows (R4–R8)

Appearance, Sharing (`GoogleDocsSettingsCard.tsx`'s states in the new rows), Usage data, Updates and Advanced, each from today's code with the lead's words. In PR 1, AI accounts holds today's Claude, ChatGPT, OpenCode and API key cards, moved whole, so `main` keeps every setting working between PR 1 and PR 2.

### W4: AI accounts (R3)

`AiAccountsSection.tsx` with the three rows; `AiDetailsSheet.tsx` (one component for Claude and ChatGPT, and OpenCode's if the lead draws one); `ApiKeysSheet.tsx`. Both sheets on `ui/dialog.tsx`. They send today's messages. The API keys sheet never needs a saved key's value: Change opens an empty field (decision 2), so it works the same before and after PR 3 stops sending values. Render tests for each AI state from recorded payloads (not installed, broken, waiting for a reload, signed out, signing in, ready by sign-in, ready by key).

### W5: The host (R10, R11, decision 2), PR 3, High

In `RitemarkSettingsProvider.ts`, by A1's result:
- **Draw first:** `settings` carries only what needs no probe (config values, which keys are saved, the theme, Google Docs, usage data, the versions, the cached update snapshot). Each probe posts its own part as it answers (`settings:part` with `componentStatus`, `environment`, `updateCenter`; ChatGPT's sign-in keeps `codex:authStatus`). The first-ever update check no longer holds the first draw.
- **Once per open:** the extra `sendCurrentSettings` at the end of `resolvePanel` goes; a setting change sends that setting's own state; a theme change sends the theme; ChatGPT's binary status is read once per run.
- **Keys stay in the host:** the payload carries `…KeyConfigured` only, never a value. The CSP's `connect-src` is checked and closed if the page fetches nothing (W4 removes the last reader of key values).
- **Follow changes (R11):** one `onDidChangeConfiguration` listener for every `ritemark.*` key the page shows (replacing the usage-data-only one); `context.secrets.onDidChange` for the five key names; `onDidChangeViewState` to check each AI's state and read the update snapshot again (no network) when the tab comes back into view; any status event A2 finds missing, emitted where the change happens. `src/update/` has no change event today; one is added only if A2 shows an update change that stays stale on a visible tab, and since `src/update/` is High too, it stays in this PR.
- **The tab's title** reads Settings, as drawn.
- **If A1 puts a slow probe in `src/agent/setup.ts`** (for example a probe run again where its answer is cached), the fix goes here too, keeping all High paths in this one PR.
- One summary log line per open (R10).

### W6: What each AI can use (R12), PR 4

- `src/runtime/capabilityReport.ts` (new): one shape for every AI (`{ kind: 'skill' | 'connector' | 'plugin', name, line, source, usable, why? }`), Ritemark's tools from `ritemarkTools.ts`, and one reader per AI next to its runtime, by A3: Claude from a short session's start report and `mcpServerStatus()`, with the same setting sources as a chat; ChatGPT and OpenCode by what A3 finds. No reader touches a key or a permission path (`canUseTool`, `codexApproval.ts`, `session/request_permission`), so the PR stays Standard.
- The host answers `capabilities/request` through a small module the provider hands the prefix to, as it does for `google-docs/`; the answer is cached for the window, and Check again asks again.
- The page shows it where the lead puts it (question 1).

## Pull requests

The sprint plan's table holds the four PRs with their tiers. PR 1 and PR 2 change only `webview/src/`; every host change is in PR 3, so the High paths sit in one PR; PR 4 adds new host files outside the High list and two lines in the provider that don't touch key handling. If a reviewer reads the provider's file as High as a whole, PR 4 goes to High; the author never lowers a tier.

## What 147 leaves for 149 and 151

- Sprint 151 adds AI on this computer: one entry in the sections list (W2), second, and its own component. If 151 is cut, 2.2 has six sections and nothing to remove.
- Sprint 149 adds Web pages to Sharing: one group in `SharingSection.tsx`, with its own row.

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| A setting is lost in the move (v1.3.0) | The inventory and its test first; every row checked; PR 1 moves the AI cards whole |
| Key entry breaks | The same messages; the K rows on the Mac and on Windows in PR 2 and again after PR 3; the welcome's key path untouched |
| A1 finds the script's load, not the probes | R10's target is measured from the script's load; the bundle split is named for later |
| PR 3 and PR 2 both change the page's message handling | W2 draws from parts from the start; PR 3 after PR 2 |
| Redraws loop or flicker (a listener that fires on its own write) | Each listener sends only its part; a test that a setting change posts one part |
| R12 starts sessions: a sign-in, a keychain prompt, cost | Only on request; A3 measures; a short session with no prompt sent; first cut |
| The lead's answers come late | PR 1 needs only the drawing as it is; the cut order |
| Sprint 146 isn't merged | The build waits for it; the plan is written now |
| The seven sections overflow a narrow desk | Question 8; checked at 560 and 440 wide |
