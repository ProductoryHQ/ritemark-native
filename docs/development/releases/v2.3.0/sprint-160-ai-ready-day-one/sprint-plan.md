# Sprint 160: the AI is ready on day one, on Mac and Windows

Track: Full. It changes how Claude's readiness is decided (`src/agent/setup.ts`) and what a turn's end records.<br>
Release tier: **extension**, for all three PRs. They ship in `out/**/*.js` and `media/webview.js`.<br>
**Status:** **Approved** on the night of 15 November 2026: the Experience lead on looks and words (written in below), the Development manager on the technical part, on Jarmo's delegation: "tore! ja võid alustada sprints ise kui olete Experienciga yhel meelel" and "ja release 2.3 sees tehtagu muud skoorid olnud asjad ära! mitte ainult Excel".<br>
**Release:** v2.3.0. Its direction, agreed with Jarmo: the AI works from day one, on Mac and Windows.<br>
**Issues:** #703, #541, #696 and #686.<br>
**Technical plan:** [technical-plan.md](technical-plan.md). It is a read-only study with file:line causes.<br>
**Branches:** `sprint-160-pr-a-claude-readiness`, `sprint-160-pr-b-sheet-signin` and `sprint-160-pr-c-usage-limit`, each from `origin/main`. Their files don't overlap, so they are built in parallel.

## What a person sees after it
- **#703 (Windows):** Claude shows as signed in only when Claude's own check says so, or when an Anthropic key is saved. Today any Windows PC can show Claude as "signed in", and the first question then fails. If the check can't answer, Claude shows Sign in, and the log says why.
- **#541:** with an Anthropic API key saved in Settings and no Claude.ai sign-in, Claude is ready everywhere: the AI's sheet, the welcome, Home and Settings. Send works, and chats and Flow steps run on the key. A wrong key gets the existing "Claude did not accept your API key…" card.
- **#696:** while a sign-in runs, wherever it was started, the AI's sheet shows it as waiting and doesn't offer that AI's Sign in again. Re-check, Settings or saving a key no longer brings the button back early. A second ChatGPT sign-in joins the running one instead of starting another.
- **#686:**
  - When a model's usage limit is reached, the chat says so plainly, with when to try again if the service said, and a way on: another model, or another ready AI.
  - The rail and the chat list say the limit was reached instead of "Interrupted".
  - The next message no longer adds "The previous agent did not return a saved answer."
  - **Still true:** with OpenCode, the chat can show "Working" for about a minute first, while OpenCode retries without telling Ritemark. That gets a follow-up issue.

## Decided in this plan (the Development manager, technical)
1. **#703: cmdkey goes, with no replacement.** Its check is true on every Windows PC, because cmdkey repeats the filter in its header. A false "Sign in" costs one click; a false "Signed in" gives an AI that can't answer. A `.credentials.json` check is decided after the Windows log shows why Claude's own check failed on Gate 2's cold start.
2. **No retry and no longer timeout for Claude's check yet.** First the log records why an answer was unusable: `timeout`, `spawn-error` or `no-json`, with the timings and never the output.
3. **The macOS Keychain fallback stays,** and is logged when used.
4. **A Claude.ai sign-in still wins over a saved key.** A saved key wins over the CLI's "signed out".
5. **A wrong saved key shows Claude as ready until the first turn,** as OpenCode's keys do. Settings has Test key.
6. **Claude's "signing in" has one writer:** the shared sign-in owner, `claudeLogin.ts`. The eight other places that cleared it are removed. Their polls keep running.
7. **A second ChatGPT sign-in joins the running one** and gets the same page.
8. **"Did not return a saved answer"** shows only when the earlier turn has no recorded end. After a recorded failure or stop, the turn already says what happened.
9. **Other failures keep "Interrupted" this sprint.** The failure kind travels with them, so changing their words later is copy only.
10. **Google's "Please retry in 41s"** is read as a usage limit with a time, not as "Add credits". "Prepayment credits are depleted" stays a billing message.
11. **The dev-run proof sends a placeholder key** (not a credential) to Anthropic's and Google's model lists once. Those lists don't follow the base-URL override. This is accepted and recorded.

## Looks and words (the Experience lead, agreed 15 November)
**#696: the waiting look is the welcome's frame 2,** as Home's card already borrowed it in Sprint 156. The words come from `welcomeCopy.ts` and `src/welcome/words.ts`, so the welcome, Home and the sheet look and read alike. Per card:
1. **Signed out:** as today.
2. **Signing in, started on the sheet:**
   - The main button waits: spinner, "Signing in…", disabled.
   - A quiet **Cancel** follows it (tooltip `stopWaitingTip`). It runs the same command as Home's Cancel, the shared owner's `cancelClaudeLogin` or `stopCodexSignIn`.
   - The plan line becomes `browserOpened()`: "Your browser opened Claude's sign-in page."
   - Under the row: "Did nothing open? Open the page again" (`COPY.reopen`, tooltip `reopenTip`), only when the page's address is known.
3. **Signing in, started elsewhere:** exactly as 2. The card doesn't say where it began.
4. **The page needs opening again** (reopen found no page): `homeReopenNotOpened()`, "Claude's sign-in page didn't open. Cancel, then sign in again."
5. **Ended without success:** back to signed out, with the plan line replaced by `signInProblem()`'s sentence ('failed', 'timed-out' or 'could-not-start').
6. **Ready:** "Almost there!" gives way to the chat, as today, with no "Signed in" card between. If the other AI is still signing in, Home keeps showing it.
7. **Offline:**
   - `OFFLINE_LINE` shows once, under "Sign in to start using AI in Ritemark.".
   - The Sign in buttons are disabled. "Use API key" stays enabled, because a key can be saved offline.
   - A sign-in that was already running keeps its waiting look.

"Use API key" stays enabled while Claude signs in, and the other AI's button stays enabled.

**If the sheet's Cancel turns out to be more than small** (two sheet messages and their handlers), it goes to Not in it, and state 4 then reads "Claude's sign-in page didn't open. Wait for it to stop, or cancel it in Settings."

**#686: the words.**
- **Rail and chat list:** "Limit reached", instead of "Interrupted". Rail tooltip: "Stopped at <AI>'s usage limit".
- **OpenCode's card for a limit:**
  - **Title:** "You've used <model>'s limit for now", or "this model's" when the label is unknown.
  - **With a time:** "It can answer again after <time>. Until then, use another model." `<time>` is in the person's own time format, as on the busy card.
  - **Under two minutes:** "It can answer again in a minute. Until then, use another model."
  - **With no time:** "Try again later, or use another model."
  - The existing "Use <model>" button stays beside it.
- **Decision 8 is confirmed.**

**Shots for the Experience lead,** at the sheet's real width:
- **PR B:** all seven states of Claude's card, plus ChatGPT's state 2.
- **PR C:** the card, the rail with its tooltip, and the chat list.

## PRs
| PR | Issues | Files (main ones) | Tier | Proof |
| --- | --- | --- | --- | --- |
| A | #703, #541, Claude's half of #696 | `src/agent/setup.ts` (+ test), `extension.ts`, `agent/types.ts`, `AgentRunner.ts`, `flows/nodes/ClaudeCodeNodeExecutor.ts`, `agent/index.ts`, 5 lines out of `UnifiedViewProvider.ts`, 3 out of `RitemarkSettingsProvider.ts`, `architecture.md` | High (`/code-review` high + `/security-review`) | See below |
| B | #696 | `OnboardingWizard.tsx` (+ test), `codex/CodexRuntime.ts` (+ test), the sheet's Cancel (`ai-sidebar/store.ts` and two handlers in `UnifiedViewProvider.ts`, different lines from PR A's), bundle | Standard, with one screenshot to the Experience lead | Unit tests; shots of each AI's waiting look, set over CDP with no real sign-in |
| C | #686 | `contextPack.ts`, `continuation.ts`, `conversations/types.ts`, `ConversationStore.ts`, `ThreadRail.tsx`, `conversationActionsModel.ts`, `runtimeErrorPresentation.ts`, `turnFailureCopy.ts` (+ tests), bundle | Standard, plus a research note on OpenCode's retries | A dev run against a local fake Google returning 429 with "Please retry in 41s", on main and on the branch: the card, the rail, and the next message with and without a model switch |

**PR A's proof:**
- the decision table's unit tests, red on main and green on the branch;
- a hidden dev run with isolated AI homes: Claude signed out, a placeholder key saved, and the base URL pointed at a local capture server. The sheet, welcome and Home say ready; a chat and a Flow step carry `x-api-key`; a `401` shows the API-key card.

Merge order: A, then B, then C, each rebuilding `media/webview.js` after the one before. The Development manager merges on each Review record.

## Not verified tonight (needs Windows, a real sign-in or a real key)
- **Windows:** why Claude's check failed on Gate 2's cold start. Where current Claude Code keeps its Windows sign-in. The branch on a fresh Windows cold start, which goes into 2.3's Windows test list.
- **A real Anthropic key** answering (test-keys row S4). OAuth still winning over a saved key with a real Claude.ai sign-in (the table test covers the logic).
- **A real sign-in** finishing while the sheet waits. What Codex's app-server does with a second login.
- **Live limit wording** from Claude, ChatGPT and Google with an exhausted plan.

## Not in it (follow-up issues)
- OpenCode's silent retries on a 429: five retries, no cap on `Retry-After`, nothing over ACP.
- A refreshed Claude check that changes the shared answer without an event (`setup.ts:549-581`).
- Settings' own Codex app-server and a second ChatGPT sign-in from Settings.
- Sign-in state across windows.
- Words for other failure kinds than a usage limit.
