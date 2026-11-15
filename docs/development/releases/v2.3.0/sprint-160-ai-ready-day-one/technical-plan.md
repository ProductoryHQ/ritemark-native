# Sprint 160 technical plan: the AI is ready on day one, on Mac and Windows

A read-only study from the night of 15 November 2026, made for the Development manager. It read the code and ran nothing. The line numbers are as of `cb99ddca`. Main has moved since then (Sprint 158, #706, #707), so check each line before editing. `EXT` = `extensions/ritemark`.

**The short version:**
- #703 and #541 are two wrong steps in one function, `detectClaudeAuthMethod` (`EXT/src/agent/setup.ts:414-447`).
- #696 has two parts. The "Almost there!" view ignores the shared availability state, and Claude's "signing in" flag can be cleared by things other than the sign-in itself.
- #686 has two causes in Ritemark. A third is in the bundled OpenCode: it retries a quota error silently, and nothing about the retries reaches Ritemark.

## 1. The four issues

### #703: on Windows, Claude can show as signed in when it isn't
**Cause (proven from the code).**
- `checkWindowsAuth` (`setup.ts:366-376`) counts any `cmdkey /list:Claude*` output containing "Claude" as a sign-in. cmdkey repeats the filter in its header and exits 0, so this is true on every PC. It is called at `setup.ts:436-438`.
- It runs whenever the CLI's answer is unusable. `checkClaudeAuthStatus` (`setup.ts:396-412`) returns `undefined` with no record in three cases:
  - a timeout (5 s, `:398`);
  - a spawn error;
  - output that isn't a single JSON value (`parseClaudeAuthStatusJson`, `:378-394`).
- `hasCliOAuth()` (`setup.ts:501-503`) is uncalled.

**Not proven:** why the CLI check failed on Gate 2's cold start.
- One plausible way the surfaces came to disagree: a probe with `refresh: true` replaces the shared answer without an event (`setup.ts:549-581`), and the welcome re-checks only on an event (`EXT/src/welcome/welcomeHost.ts:246-248`).
- Likely causes of the bad first answer:
  - the 5 s limit on a cold start's first `auth status` (the `--version` call just before it gets 15 s, `setup.ts:251`);
  - several first runs of the CLI at once;
  - a notice printed before the JSON.

**Fix (PR A).**
- Delete `checkWindowsAuth`, its call, and the uncalled `hasCliOAuth`.
- Make `checkClaudeAuthStatus` return why an answer was unusable: `timeout`, `spawn-error:<code>` or `no-json`, with the exit status, elapsed ms and byte counts. Never the output, which can include the account's e-mail.
- Log the reason with `console.warn('[ritemark] …')`, as `setup.ts:296` does, and add it to `SetupStatus.diagnostics`.

**Tests (`EXT/src/agent/setup.test.ts`).**
- The decision table in §2. On Windows, an unusable answer with no key gives `null`.
- The old cmdkey rule, given cmdkey's "NONE" output, returns true. This row is red on main and is removed with the function.
- With the fake CLI (`setup.test.ts:330-351`): non-JSON gives `no-json`, and a slow answer with an injected timeout gives `timeout`.
- **Inject the keychain check.** Otherwise the macOS fallback reads the developer's real Keychain.

### #541: Claude stays "signed out" with an Anthropic API key saved
**Cause (proven).**
1. **Order.** A CLI answer of `loggedIn:false` returns `null` at `setup.ts:419-424`, before the saved key is checked (`:427-429`).
2. **The key flag goes stale.**
   - `hasAnthropicKeyInSecrets` (`setup.ts:32`) is set only through `setAnthropicKeyAvailable`. The callers are `UnifiedViewProvider.ts:3088`, `RitemarkSettingsProvider.ts:448,998,1286` and `welcomeHost.ts:875`.
   - The welcome's check (`UnifiedViewProvider.runtimeAvailability`, `:2598-2614`) and Home's (`GuidanceHost.ts:86`) never set it.
3. **Flows break once (1) is fixed.**
   - The Flow's Claude step checks readiness (`EXT/src/flows/nodes/ClaudeCodeNodeExecutor.ts:53-60`), then calls `runAgent` with no key. `runAgent` passes `claudeRuntimeOptions(undefined, …)` (`EXT/src/agent/AgentRunner.ts:458`), and `AgentExecutionOptions` has no key field (`EXT/src/agent/types.ts:350-365`).
   - Chats already handle this. They send the key when `authMethod === 'api-key'` (`UnifiedViewProvider.ts:1109-1115`, then `claudeApiKey` in `EXT/src/ai/providerKeys.ts:147`, then `ANTHROPIC_API_KEY` in `AgentRunner.ts:233-245`).

**Fix (PR A).**
- **The decision order** in §2.
- **A key reader** replaces the flag, and `setup.ts` asks it on every probe.
  - `extension.ts` registers it at activation with `readProviderKey(context.secrets, 'anthropic-api-key')`.
  - A failed read counts as no key and is logged.
  - Only true or false leaves `setup.ts`.
  - The diagnostic at `setup.ts:482-484` uses the probe's own value.
  - The existing `setAnthropicKeyAvailable` calls can stay.
- **Flows.** Add `anthropicApiKey` to `AgentExecutionOptions`. `runAgent` passes it into `claudeRuntimeOptions`, and the Flow step passes `claudeApiKey(setupStatus.authMethod, key)`.

**Tests.**
- **Table rows:**
  - CLI signed out + key → `api-key`;
  - CLI OAuth + key → `claude-oauth`;
  - no CLI answer + key → `api-key`.
- **Fake CLI:** `loggedOut` plus a key reader saying yes → `state: 'ready'`, `authMethod: 'api-key'`. This is red on main.
- **The Flow step:** passes the key for `api-key` and none for OAuth.

**What a test can prove without a real key.** Use a hidden dev instance with isolated homes; its scratch `CLAUDE_CONFIG_DIR` means the CLI is signed out.
1. Save a placeholder `sk-ant-…` key.
2. Launch with `--env ANTHROPIC_BASE_URL=http://127.0.0.1:<port>`, pointing at a local capture server. Sprint 127's `request-capture.mjs` (`docs/development/releases/v1.12.0/sprint-127-day-zero-models/research/probes/`) has the pattern.
3. The sheet, the welcome and Home say ready, and Send is enabled.
4. A chat and a Flow step carry `x-api-key` set to the placeholder.
5. A `401 invalid x-api-key` shows "Claude did not accept your API key…".

### #696: the AI's sheet offers a second sign-in while one is running
**Cause (proven).**
1. **The view ignores the running state.**
   - `AuthenticateStep` (`EXT/webview/src/components/ai-sidebar/OnboardingWizard.tsx:166-270`) draws both cards from `OnboardingStatus` true/false fields only (`:220`, `:243`).
   - The sheet's own setup views already draw a running sign-in: `SetupWizard.tsx:25` and `CodexSetupView.tsx:22`.
   - The view rule shows "Almost there!" whenever no AI is usable (`sidebarGate.ts:71-73,90`).
   - The live states are in the store: `setupStatus.state` and `codexStatus.state`, combined by `deriveRuntimeAvailabilities` in `AISidebar.tsx:161`.
2. **Claude's "signing in" is switched off while the login runs.** The login is owned by `beginClaudeLogin` (`EXT/src/agent/claudeLogin.ts:61-113`, which times out after 5 minutes, `installer.ts:299`). But `setClaudeLoginInProgress(false)` is also called from:
   - the sheet's status handler for `status-refresh`, `settings-updated`, `install-finished`, `logout` and `authentication-failed` (`UnifiedViewProvider.ts:3148,3151`);
   - the sheet's 2-minute poll (`:3194,3203`);
   - Settings' logout (`RitemarkSettingsProvider.ts:1302`) and Settings' own 2-minute poll (`:1337,1344`).

   The sheet's Re-check sends `onboarding:recheck`, then `status-refresh` (`UnifiedViewProvider.ts:1808-1813`). `docs/development/architecture.md:942-946` says the shared owner keeps every surface's waiting state; the code doesn't.
3. **ChatGPT can start a second login.**
   - `CodexRuntime.beginLogin` (`EXT/src/codex/CodexRuntime.ts:702-706`) and `codexAuth.startLogin` (`codexAuth.ts:115-127`) never check for a pending login.
   - Both of the sheet's starts call it unconditionally: `_handleCodexLogin` (`UnifiedViewProvider.ts:3291-3307`) and `startCodexSignIn` (`:2150-2171`).
   - Claude's second `beginClaudeLogin` joins the running one (`claudeLogin.ts:65-72`).

**Fix.**
- **PR B, the view.** `AuthenticateStep` reads `deriveRuntimeAvailabilities`. For an AI in `auth-in-progress` it draws the waiting look (reuse `WaitingMark`, `EXT/webview/src/components/ui/turning-mark.tsx`) instead of its Sign in.
- **PR B, ChatGPT.** `CodexRuntime.beginLogin` keeps the pending login's sign-in address and returns it to any second caller until the login ends.
- **PR A, Claude.** Only `claudeLogin.ts` writes the flag.
  - Delete the other calls at `UnifiedViewProvider.ts:3145,3148,3151,3194,3203` and `RitemarkSettingsProvider.ts:1302,1337,1344`.
  - Stop exporting `setClaudeLoginInProgress` from `EXT/src/agent/index.ts`.

**Tests.**
- **`OnboardingWizard.test.ts`:** with `auth-in-progress`, the running AI has no enabled Sign in and shows the waiting words. The other card is unchanged, and Re-check is still there.
- **`CodexRuntime.test.ts`:** two `beginLogin` calls while one login is pending start one login and return the same address. After the login ends, a new login starts.
- **A check** that only `claudeLogin.ts` calls `setClaudeLoginInProgress`.

### #686: a usage limit shows as "Interrupted" and "did not return a saved answer"
**Cause 1 (proven).** Every failed or stopped turn is recorded as `interrupted`, with reason `failed` or `cancelled` (`EXT/src/conversations/ConversationController.ts:602-605`).
- The rail (`ThreadRail.tsx:9-15`) and the list (`conversationActionsModel.ts:65-75`, used by `ConversationsPanel.tsx:25`) print "Interrupted" whatever the reason.
- The summary carries no failure kind (`EXT/src/conversations/types.ts:225-252`, built at `:911-934`).

**Cause 2 (proven).** A turn without a completed answer counts as unanswered (`EXT/src/conversations/contextPack.ts:102-117`, `:106`).
- That sets `hasUnansweredRequest` (`:235`), then `unansweredPriorRequest` (`EXT/src/runtime/continuation.ts:155-161`).
- After a failure the session is closed (`UnifiedViewProvider.ts:1437-1438`), and the continuation is cleared (`ConversationController.ts:590-591`).
- So the next message shows the line (webview `store.ts:2533-2541`; host `ConversationController.ts:423-429`).
- The copies at `ConversationController.ts:862-888` fire only when the earlier turn has no recorded end, which is correct.

**Cause 3 (found in the bundled OpenCode 1.19.4).** OpenCode retries a quota error silently.
- **The retry settings:**
  - `RETRY_INITIAL_DELAY=2000`, `RETRY_BACKOFF_FACTOR=2`, `RETRY_JITTER_FACTOR=0.25`;
  - `RETRY_MAX_DELAY_NO_HEADERS=30000`, `RETRY_MAX_DELAY=2147483647`;
  - `RETRY_MAX_RETRIES=5`.
- **What counts as retryable:** an API error that is retryable (a 429 is), or text matching `429`, `resource exhausted` or `resource_exhausted`, or "try again later" or "try again in".
- **Nothing reaches Ritemark.** The `retry` status is never sent over ACP.
- **What a person sees:**
  - A Gemini 429 with no `Retry-After` shows "Working" for about 62–78 s, and then the error.
  - With `Retry-After`, the wait can outlast Ritemark's 15-minute OpenCode limit (`AcpRuntime.ts:98,264-279`). The turn then ends with a general "did not respond…".
  - Stop during the retries gives "Interrupted".

**Cause 4 (proven).** The classifier reads Google's quota error as billing: `limit: 'quota'`, way on "Add credits in Google AI Studio" (`runtimeErrorPresentation.ts:478-486`). It never reads "Please retry in 41s.", because `resetClause` and `serviceRetryAt` (`:283-306`) only look for "try again …" and "resets …". Claude's and ChatGPT's limits are already classified and tested (`runtimeErrorPresentation.test.ts:151-159,226-227`).

**Fix (PR C).**
- **`contextPack`** returns a second flag: an unanswered turn *with no recorded end*. `transcriptRestoredState` uses it for `unansweredPriorRequest`, and the model's context still marks the turn unanswered.
- **The summary** gets an optional last-failure kind, set from the ending event's `errorKind` and `detail.limit`. It follows Sprint 155's `changedFiles` pattern: built in `types.ts:911`, decoded in `ConversationStore.ts:153-172`. Older builds drop it.
- **The rail and the list** use the Experience lead's usage-limit words when the kind is `limit`. Other failures keep "Interrupted".
- **The classifier:**
  - reads Google's "retry in Ns" and RetryInfo's `retryDelay` into `retryAt`;
  - counts `RESOURCE_EXHAUSTED` with a retry time as a usage limit with a time;
  - keeps "prepayment credits are depleted" as billing.
- **For OpenCode,** the card offers "try again after …" and the existing "Use <model>".

**Tests.**
- **contextPack and continuation:** a failed `limit` turn followed by the next message gives no line. A turn ended by a restart still gives the line.
- **The summary:** its round trip through the index.
- **The labels:** in `conversationActionsModel.test.ts`.
- **The classifier:** with Google's documented 429 body, with and without the retry time.

**Proof.** A hidden dev run on main and on the branch.
1. Save a placeholder Google key.
2. Launch with `--env OPENCODE_CONFIG_CONTENT={"provider":{"google":{"options":{"baseURL":"http://127.0.0.1:<port>/v1beta"}}}}`. OpenCode reads that variable and inherits the host's environment (`acpManager.ts:476-484`).
3. Run a local fake that answers every call with 429 and `RESOURCE_EXHAUSTED` ("… Please retry in 41s.").
4. Record:
   - the time "Working" shows;
   - the card;
   - the rail's tooltip;
   - the next message, with and without a model switch.

## 2. One readiness model
It exists. `SetupStatus` and `CodexSidebarStatus` feed `deriveRuntimeAvailabilities` (`EXT/src/runtime/availability.ts:146`). The welcome, Home (`GuidanceHost.ts:706-717`), the sheet's view rule and composer (`AISidebar.tsx:161`) and comment tasks all read it.

#703, #541 and #696 are bad inputs to it, plus one view that bypasses it:
- #703 and #541 come from one input function's wrong order (PR A).
- #696's Claude half: the "signing in" input has nine writers instead of one (PR A).
- #696's view half: "Almost there!" doesn't read the shared availability (PR B).

**Claude's decision order (PR A):**
```
cli signed in            -> its method (claude-oauth | api-key)     // an OAuth sign-in still wins over a saved key
saved Ritemark key       -> 'api-key'                               // #541
cli said signed out      -> null
cli gave no usable answer:
   log why (no output text)                                         // #703
   macOS: Keychain item  -> 'claude-oauth'                          // kept as today
   Windows: nothing                                                 // #703: cmdkey removed
   ANTHROPIC_API_KEY env -> 'api-key'
   else                  -> null
```

**Changed after PR A's review (the Development manager, 16 November):** when the CLI gives no usable answer, the macOS Keychain item comes before a saved key (decision 4: a Claude.ai sign-in wins over a saved key; billing a plan holder's API key unawares is the worse mistake). That branch is now: log why; macOS Keychain item → `claude-oauth`; saved Ritemark key → `api-key`; `ANTHROPIC_API_KEY` → `api-key`; else `null`. The CLI's own answers are unchanged.

## 3. Security points (PR A)
- The key is read only on the host. It is never logged and never sent to the webview.
- The Flow runner puts it in the CLI child's environment, as chats do.

## 4. Could not determine
- Why the CLI check failed on Gate 2's cold start (#703).
- Where current Claude Code keeps its Windows sign-in (likely `%USERPROFILE%\.claude\.credentials.json`; not checked against the bundled version).
- What Gemini returned on 8 November.
- Whether OpenCode's ACP returns the final error as an internal error.
- Whether Codex's app-server cancels the first login when a second starts.
- Windows OpenCode behaviour.
- Whether `OPENCODE_CONFIG_CONTENT` with a custom Google `baseURL` reaches the fake.
- The words and looks, which are the Experience lead's.
