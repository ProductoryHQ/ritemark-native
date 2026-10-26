# Sprint 143 QA evidence

26–27 October 2026, on `sprint-143-fixes` (from `origin/main` at `84ea15db`), Mac (darwin-arm64), the dev tree of this branch: VS Code 1.142 at the pin, the bundled Codex 0.163.0.

**After QA, 27 October:**
- **Rebased** on `origin/main` at `72f509e8` (Sprint 142 merge 1). The bundle was rebuilt from the merged sources, and `npm test`, `npm run compile`, both `tsc --noEmit`, `validate-qa.sh` and the validator were run again on the rebased branch.
- **The review's two P2s fixed:** waits are paired per turn, and stderr is read by whole lines.
- **Tooltips:** the Continue with <AI> tooltips are the Development manager's words.
- **Screenshot:** `busy-card.png` was retaken on the rebased build.

The landing, mention and #507 runs below were on `84ea15db`. Main's Sprint 142 changed none of their code (`src/welcome/`, `FormattingBubbleMenu`, the comment's list). Its one change in the sheet's store is a second branch in `startChatFromHost` (Home's ready request reopening its chat). The landing doesn't take that branch; it goes through `openLandingChat`.

**How it ran.** Hidden launches (`open -n -g -j`), a short throwaway profile under `/private/tmp/claude-501/` with its own `--user-data-dir`, `--extensions-dir` and `--shared-data-dir`, `--use-mock-keychain`, CDP on 9244, `RITEMARK_BUILD_CHANNEL=test`, usage data off (`ritemark.analytics.enabled: false`, and no welcome answered yes). One launch per check, each quit with ⌘Q. HOME unchanged; nothing signed in or out; `~/.codex/config.toml` not changed (its modification time is 22 October 16:09 before and after); ChatGPT turns ran only in a folder Codex already trusts (`/private/tmp/ritemark-s116-rundev-workspace`) and wrote Codex's own session records, as every Codex client does.

**What couldn't run here:** Claude (not signed in on this Mac, no test keys: "Mitte praegu"), OpenCode (no key), Windows (no PC here), a person's keyboard (#507), a real 429 from ChatGPT (it can't be made on demand without spending the account's limit). Each is named below and in the Gate 2 list.

## Unit tests and builds

- `npm test` in `extensions/ritemark` passes (the whole suite, with `pretest`), including the six new test files: `views/HomePanel.test.ts`, `ai-sidebar/chatBubbles.test.ts`, `formattingToolbar.test.ts`, `utils/dialogDefaults.test.ts`, `codex/codexRetry.test.ts`, `ai-sidebar/continueWithAlternative.test.ts`, and the cases added to `audioPrep`, `JobManager`, `panelChrome`, `landing`, `welcomeState`, `landingChat`, `ConversationTitleGenerator`, `CodexRuntime` (Tests 17–19), `runtimeErrorPresentation` and `activityState`. Main's `splitButton.test.ts` runs beside them.
- `tsc --noEmit` passes for the extension and for the webview; `npm run compile` and the webview's `npm run build` pass.
- The pre-commit validator, run by hand with `CLAUDE_PROJECT_DIR` set to this worktree, passes (bundle freshness, `office-preview.js` rebuilt byte for byte, 18 patches stacking).
- The bundle: [notes/bundle.md](notes/bundle.md) (+3,932 bytes on `72f509e8`).

## Each fix's check, before and after (E1)

| Req | Check | On `main` | On the branch |
|---|---|---|---|
| R1 #556 | `HomePanel.test.ts` | Fails: `TypeError: disposable.dispose is not a function` at `HomePanel.ts:517` (the installed app's log line) | Passes: every subscription and the panel disposed; a throwing one doesn't stop the rest |
| R2 #551 | `landingChat.test.ts`: ChatGPT's model list arriving after 25 s | Fails: the landing was dropped at 20 s and the chat stayed on Claude | Passes; OpenCode still gives up after 20 s and posts `landing/dropped` |
| R2 #551 | `scripts/qa/landing-check.mjs`, 20 runs on fresh profiles | Not reproduced on `main` either (21 of 21 in the planning session) | See *The landing check* below |
| R3 #544 | `codexRetry.test.ts`, `CodexRuntime.test.ts` (Test 17), `runtimeErrorPresentation.test.ts`, `activityState.test.ts`, `continueWithAlternative.test.ts` | The app-server's `error` notification was emitted as an EventEmitter `'error'` with no listener, which threw inside the JSON loop and was logged as an unparseable line; the final 429 classified as `provider` ("exceeded retry limit, last status: 429 Too Many Requests") | Pass; screenshots below |
| R3a, the review's P2s | `CodexRuntime.test.ts` Test 18 (two chats retrying together), Test 19 (the real `CodexAppServer`'s stderr, a retry line split across two chunks, beside another line); `codexRetry.test.ts` (`LineBuffer`, `CodexRetryPairing`) | Test 19 fails against the app-server before the fix: the split line gave no wait (`actual: []`). Before the fix one global slot held the newest notification, so a second chat's notification took the first one's line | Pass |
| R4 #514 | `ConversationTitleGenerator.test.ts` | Fails: the title session had no `settingSources` | Passes: `settingSources: []`, `availableTools: []` |
| R5 #513 | `scripts/qa/comment-mention-check.mjs` | 3 of 3 clicks on @claude landed on the formatting toolbar (`research/reproductions.md`, `repro/repro-513b.mjs`) | 5 of 5 ways assigned the comment; the element under each option's centre was the option, and the toolbar was hidden |
| R6 #511 | `chatBubbles.test.ts`; the sheet on a dev instance | Fails: the bubble had no element keeping line breaks | Passes; the message showed its card's lines (computed `white-space: pre-wrap`, 8 lines), screenshot below |
| R7 #507 | No code (A3) | — | `research/home-keys-audit.md`: 20 of 20 with the films' exact method here and on the installed 2.0.1 |
| R8 #509 | `audioPrep.test.ts`, `JobManager.test.ts`, `panelChrome.test.ts` | `cannotTakeOnDevice` and `dismiss` didn't exist; the failed card had no button | Pass |
| R9 #510 | `dialogDefaults.test.ts` (with a scan of every `showOpenDialog` in `src/`) | 8 of the 15 open dialogs passed no starting folder, the two Flow pickers none without a workspace, and the rest one that wasn't checked to exist | Passes: 15 of 15 start in a folder that exists. The 7 save dialogs are unchanged (spec, *Addendum*). **A4 and S41 are Gate 2**, on Windows: the CHANGELOG's #510 line stands for Ritemark's pickers; whether the main process's dialog lock needs a patch is A4's to show |

## The landing check (R2, S3)

`node scripts/qa/landing-check.mjs --runs 10 --port 9244`, then the same with `--updates on` and the dev tree's `product.json` set to 2.0.0 (so "Ritemark 2.0.1 is available" shows):

| Batch | Runs | Landed on ChatGPT, "Ask ChatGPT about this project" |
|---|---|---|
| No update notice | 10 | 10 of 10 |
| With the update notice | 10 | 10 of 10 |

Every run ended on "ChatGPT, GPT-6.1 Sol, thinking effort Auto", each on a fresh profile, one launch per run. In the second batch, "Ritemark 2.0.1 is available (729.4 MB)" was on screen in 8 runs when the toasts were read at the end. In runs 3 and 4 no toast was showing at that moment. The dev tree's `product.json` was set back to 2.0.1 afterwards.

That makes S3 20 of 20 on the branch, the count decision 4 asked for. On `main` it was 21 of 21 in planning, so this proves the hardened path still lands. It doesn't prove the fix of a failure nobody has reproduced. The forced cases (S5, S7) weren't run; `landingChat.test.ts` covers the late ChatGPT list.

## The mention list (R5, S18–S22)

`node scripts/qa/comment-mention-check.mjs --port 9244`:

```
PASS  S18 @claude by click: {"note":"@claude Make this warmer","agent":"claude"}
PASS  S22 @codex by click: {"note":"@codex Add an example","agent":"codex"}
PASS  S22 @opencode by click: {"note":"@opencode Shorten it","agent":"opencode"}
PASS  S19 @claude by Enter: {"note":"@claude Check the dates","agent":"claude"}
PASS  S20 typed by hand: {"note":"@claude Make this typed","agent":"claude"}
5 of 5 ways assigned the comment
```

For each click, the element under the option's centre was the option (`LI.rm-mention-opt`) and the formatting toolbar was not shown. On `main` it was the toolbar's own box, 3 of 3.

## The AI's sheet (R3, R3a, R6)

One launch on the trusted folder, ChatGPT as the starting AI:
1. **#511, a real ChatGPT turn:** a card-shaped message (title, Done when, Files, one line asking for "ok"). The bubble kept every line (computed `white-space: pre-wrap`), and ChatGPT answered "ok".
2. **#544, injected:** the host's `codex-retry` and `codex-result` messages, exactly as the host sends them, were dispatched into the sheet while a ChatGPT turn ran (a real 429 can't be made on demand). The bridge hold-back that should have kept those turns from reaching ChatGPT didn't take in this VS Code build, so two short real turns ("Summarise the brief in three lines.", "Try once more.") ran too; the injected messages were applied to them.

| Injected | The status line | The card |
|---|---|---|
| `codex-retry`, busy, 419 s left | "ChatGPT is busy. Trying again in 7 minutes." (amber, the clock) | — |
| busy, 45 s left | "ChatGPT is busy. Trying again in a minute." | — |
| busy, the length unknown | "ChatGPT is busy. Trying again soon." | — |
| `codex-progress` (ChatGPT goes on) | "Working — Thinking..." | — |
| `codex-result`, failed, `limit`/`busy` | "Failed" | "ChatGPT is busy right now" / "It turned this request away several times. Send your message again in a few minutes." No button: no other AI is ready on this Mac |
| the same with `retryAt` in seven minutes | "Failed" | First run: "… Send your message again after 0:15." That build wrote `hour: 'numeric'`. Retaken on the rebased build (27 October, one launch): "… Send your message again after 01:40.", the webview's `en-GB` short time, as `personTime` writes it (`busy-card.png`) |

The chat's header read "Working" under the injected card only because of the injection. The header reads the host's record of the chat (`hostConversations` → `headerStatusLabel`), and an injected message never reaches the host, whose real turn was still running. A real 429 that runs out of retries ends in Codex's `turn/completed`, which goes to `onCodexComplete` in `UnifiedViewProvider`. That one handler posts the card's `codex-result` and calls `completeRuntimeTurn` with `status: 'failed'` (the turn has an error). That moves the record to `interrupted` (reason `failed`), for which the header shows nothing (`conversationActionsModel.test.ts`, for all three AIs).

**Continue with <AI>** couldn't be shown live (no other AI is ready on this Mac); `continueWithAlternative.test.ts` covers it: the waiting turn is stopped, the chat continues with Claude, the message is back in the box, nothing is sent.

## Screenshots (light theme)

In [qa/](qa/), cropped to the part that changed (no names, e-mails or accounts in them):
- `waiting-line.png`: the status line under a running ChatGPT turn;
- `busy-card.png`: the busy card with the service's time ("after 01:40"), "Failed" under it. Retaken on the rebased build; the header's "Working" is the real short turn the result was injected into;
- `line-breaks.png`: the card-shaped message on its own lines;
- `mention-list-open.png`, `mention-assigned.png`: the comment's list with no toolbar over it, and the comment assigned to Claude.

Not captured: R8's pending card and Dismiss (the pending card's refusal shows only on a computer that can't convert, and no failed Transcribe job was made here).

## Not run

- **Claude** (S17, R4's half): at Gate 2, on Jarmo's Mac with his own skills.
- **A real 429** (R3): no way to make one without spending the account's limit; the app-server's side was recorded against a local endpoint in planning.
- **The wait's length never came through live.** The branch's own path never ran end to end with a real or mocked 429:
  - the `RUST_LOG` filter on Ritemark's app-server;
  - the retry line on its stderr;
  - the line read and paired with its turn's notification;
  - `codex-retry` with `retryAt` reaching the sheet.

  The countdown in `waiting-line.png` is the host's message injected into the sheet. Each piece has its unit test:
  - `codexAppServerEnv`;
  - the parser, on the line the bundled app-server printed against a local 429 endpoint in planning, on `main`;
  - `LineBuffer`, and the real `CodexAppServer`'s stderr handler (Test 19);
  - the pairing (Tests 17–18, `codexRetry.test.ts`).

  The first person to meet a 429 on this build is the first to see the countdown for real. Without the line, the status line says "Trying again soon." and offers no Continue.
- **The bridge hold-back** didn't take on VS Code 1.142: the hooks in the sheet's outer frame saw no outgoing message at all. So each injection ran one short real ChatGPT turn in the trusted folder, two in the first run and one in the retake.
- **#507 with a person's keyboard** (S27–S33): at Gate 2.
- **Windows** (S33, S36, S39–S41; A4), **Gate 2**: no Windows PC here. #510's CHANGELOG line covers Ritemark's own pickers, which the unit test proves; A4 and S41 decide the rest. A4 (the pickers with `USERPROFILE=C:\Ritemark` and `--log trace`) is the "Ritemark on Windows" session's, through the test overlay, before Gate 2. If A4 finds the dialog lock, its fix is a patch hunk (shell-tier) after this merge, or 2.2.
- **The ChatGPT title check** (S16): not built. The title change touches only Claude's session (`settingSources` and `availableTools` are Claude Code options; ChatGPT ignores them), so ChatGPT's 36 titles from October (`research/reproductions.md`) stand.
- **`scripts/qa/home-keys-check.mjs`**: not added; #507 has no code, and its reproducers are in `research/repro/`.
