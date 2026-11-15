# Sprint 160 PR A: the proof (the fault first, then the fix)

Run on the night of 15 to 16 November 2026, on macOS arm64 (Node 24.18.0), by the PR A builder. Nothing here used a real key, a real sign-in or a real browser.

## 1. The unit faults, red on main and green on the branch

`red-green.ts` runs the same checks against two trees: an export of `origin/main` (`5cc64df5`) and the branch. Claude and cmdkey are fakes first on PATH (cmdkey prints what it really prints on a PC with no Claude credential: the filter in its header, then `* NONE *`, exit 0), and cmd.exe is a stand-in, since Node runs a Windows shell command as `cmd.exe /d /s /c "…"`. The output is in [`unit-red-green.txt`](unit-red-green.txt): seven FAILs on main, seven PASSes on the branch.

- #541: a signed-out CLI with a saved key gives `needs-auth` on main and `ready/api-key` on the branch.
- #703: on Windows, an unusable answer with cmdkey's `* NONE *` gives `ready/claude-oauth` on main (cmdkey asked), and `needs-auth` on the branch (cmdkey not asked), with `no-json` in the diagnostics.
- #696: on main, `UnifiedViewProvider.ts` and `RitemarkSettingsProvider.ts` also write Claude's signing-in flag; on the branch only `claudeLogin.ts` does.
- #541: on main neither `runAgent` nor the Flow's Claude step passes a key.

The branch's own tests (`setup.test.ts`, `claudeLogin.test.ts`, `ClaudeCodeNodeExecutor.test.ts`, `providerKeys.test.ts`) cover the same ground and more; `npm test` passed on the branch.

## 2. The dev run: Claude on a saved key

Two hidden-profile dev instances (`scripts/qa/dev-launch-isolated.sh`: a fresh profile, scratch `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `XDG_*`, `--use-mock-keychain`), the bundled Claude Code 2.1.289, and `--env ANTHROPIC_BASE_URL=http://127.0.0.1:18765` pointing at [`capture-server.mjs`](capture-server.mjs), which records each request's path and whether it carried the placeholder key, and answers every `/v1/` request with Anthropic's `401 authentication_error "invalid x-api-key"`. In each run Claude starts signed out (its scratch config dir has no sign-in), and the placeholder `sk-ant-test-placeholder-0000` (not a credential) is saved in Settings → AI accounts → API keys → Anthropic.

| | main (`5cc64df5`) | branch |
| --- | --- | --- |
| Before the key | `main-01-start.png`: Almost there!, Sign in to Claude | `branch-01-start.png`: the same |
| Settings after the key | `main-06-settings-after.png`: Claude Sign in; OpenCode Ready on the Anthropic key | `branch-04-settings-after.png`: Claude Ready, "Uses your Anthropic API key" |
| The AI's sheet | `main-06`: "Claude is signed out" over the composer; status bar "Claude: sign in" | `branch-04`: the composer, "Ask Claude…"; status bar "Claude ready" |
| Home | `main-07-home.png`: "Ask OpenCode what it can do here" | `branch-05-home.png`: "Ask Claude what it can do here" |
| The welcome (a new window) | `main-08-welcome.png`: Claude "Sign in"; "Claude: not signed in." | `branch-06-welcome.png`: Claude "Continue", "Signed in"; "Claude: signed in." |
| A chat | not possible: Claude is signed out | `branch-07-chat.png`, then `branch-08-chat-401.png`: "Claude API key needs attention. Claude did not accept the saved key." with Update key |
| A Flow's Claude step | `main-12-flow-result.png`: "Claude is not signed in…", nothing sent | `branch-11-flow-result.png` and `branch-12-flow-step-output.png`: the step ran on the key; its output holds the CLI's "Invalid API key" (see below) |
| Requests at the capture | [`capture-main.jsonl`](capture-main.jsonl): 6 × `HEAD /api/hello`, no `POST`, no key | [`capture-branch-chat.jsonl`](capture-branch-chat.jsonl) and [`capture-branch-flow.jsonl`](capture-branch-flow.jsonl): 13 `POST /v1/messages` each, every one with `x-api-key` = the placeholder and no `authorization` |

## What the run also showed

- **Claude Code retries a 401 from the stand-in many times** (13 `POST /v1/messages` over about 4 minutes) before the turn ends with the API-key card, and the chat shows "Working" meanwhile. The Flow step's 1-minute limit didn't stop it either: the retries count as activity. Whether Anthropic's real 401 (with its own headers) is retried the same way was not checked (no real key tonight). Not changed in this PR.
- **A Flow's Claude step whose turn failed reads as Finished** (`branch-11`, `branch-12`): the step returns the CLI's error in its output (`{"text":"","files":[],"error":"Invalid API key · Fix external API key"}`) instead of failing, and the run goes on. The ChatGPT step does the same (`CodexNodeExecutor.ts` resolves a failed turn with `error`). It is older than this PR (any failed Claude or ChatGPT step reads so) and is a product call (does a failed step stop the flow?), so it is a follow-up, not fixed here.
- **After the 401 the status bar says "Claude: sign in again"** while the card says to update the key: the status item's words for any Claude sign-in failure, unchanged by this PR.
- **"Activating extension 'GitHub.copilot-chat' failed"** shows in both runs: the dev tree's built-in Copilot Chat extension, the same on main; not Ritemark's.
- **The model list sent the placeholder to Anthropic once** on the branch (Anthropic's `/v1/models` doesn't follow the base-URL override), as the plan accepted (decision 11).

## Not verified

- Windows (#703): a cold start on a fresh Windows PC with the branch. The unit tests use cmdkey's real `* NONE *` output, and the Windows path runs on macOS with fakes; why Claude's own check failed on Gate 2's cold start is still unknown, and the branch now logs it (`[ritemark] Claude's sign-in check gave no usable answer: …`).
- A real Anthropic key answering (test-keys row S4), and a real Claude.ai sign-in winning over a saved key (the decision table covers the logic).
- A real sign-in finishing while the sheet waits (#696): the single writer is checked by source and by `claudeLogin.test.ts`.
