# Sprint 160: the AI is ready on day one, on Mac and Windows

Track: Full. It changes how Claude's readiness is decided (`src/agent/setup.ts`) and what a turn's end records.<br>
Release tier: **extension**, for all three PRs. They ship in `out/**/*.js` and `media/webview.js`.<br>
**Status:** **Done**, 16 November 2026. All three PRs are on main (#730, #732, #734). #696 is closed, #686 closes with the close-out, and #703 and #541 stay open until Windows and a real key are checked. What was not run is under [Close-out](#close-out) at the end. Approved on the night of 15 November 2026: the Experience lead on looks and words (written in below), the Development manager on the technical part, on Jarmo's delegation: "tore! ja võid alustada sprints ise kui olete Experienciga yhel meelel" and "ja release 2.3 sees tehtagu muud skoorid olnud asjad ära! mitte ainult Excel".<br>
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

## Close-out

All three PRs are merged to main on the night of 15 to 16 November: B first, then A and C. Codex reviewed all three before the account hit its usage limit later that night.

| PR | Issues | What | Tier and review | Merged |
| --- | --- | --- | --- | --- |
| A | #703, #541, Claude's half of #696 | Claude's readiness has one source per state: cmdkey is gone, a saved key beats the CLI's "signed out", and the macOS Keychain beats a saved key when the CLI can't answer | High: two rounds and the security review | #732 |
| B | #696 | The AI's sheet shows a running sign-in, with Cancel | Standard: one round | #730 |
| C | #686 | A usage limit says so: OpenCode's limit card, "Limit reached" on the rail and in the chat list, and no "did not return a saved answer" after a recorded failure | Standard: one round | #734 |

**Changed during the sprint:**
- **The macOS Keychain comes before a saved key** when Claude's own check gives no usable answer (the Development manager, after PR A's first round), so a person with a Claude plan isn't billed on their key unawares. The technical plan's §2 had the key first; it and `architecture.md` now say so. A Claude.ai sign-in still wins over a saved key (decision 4).
- **A fourth reason for an unusable answer,** `too-much-output` (more than 1 MiB), beside `timeout`, `spawn-error` and `no-json`.
- **A key changed in another window counts at once.** `secrets.onDidChange` drops the cached status and sends no event, so it can't end a sign-in that is still running on Home or the welcome.
- **The sheet's and Settings' sign-in polls call a sign-in finished only on a Claude.ai sign-in,** since with a key saved Claude reads ready on the key while the browser sign-in still runs. The waiting look can then last until the sign-in owner's 5-minute limit (decision 6).
- **The sheet's Cancel went in;** it was small enough. "Open the page again" sits on the card's text edge (the Experience lead). Like Home's Cancel, it settles quietly.
- **Offline, the AI column's banner is the one offline message** (the Experience lead, on PR B), and the sheet's own `OFFLINE_LINE` is gone. Sign in is disabled with "Claude sign-in needs an internet connection." (or ChatGPT's), and Use API key stays enabled.
- **OpenCode's rail tooltip names the model** (the Experience lead, 16 November): "Stopped at Gemini 3.8 Flash's usage limit", or "Stopped at a usage limit" when the label is unknown. Claude and ChatGPT keep "Stopped at <AI>'s usage limit".
- **ChatGPT's busy card keeps "Interrupted"** on the rail, since its own card says it isn't a limit. **A time that has passed** keeps "It can answer again after <time>", with no fifth body. The Experience lead confirmed both.
- **Which errors are a limit with a time:** "limit: 0" stays the quota card, and a daily quota gets no time. The saved record, comment tasks and task cards keep no time ("Try again later, or use another model."), so a saved sentence never goes stale. The card never offers a model the chat found still at its limit.
- **No feature flag for the limit card.** Codex asked for one on PR C; it wasn't added, because the card is a fix to existing cards and a misread error falls back to them.
- **It reaches people with 2.3's shell release.** The three PRs are extension tier, but main has had shell-tier changes since v2.2.0 (patch 010 in #720, then Sprint 159's patches and `product.json`), so `release-extension-preflight.sh` refuses an extension release from main.

**Not run:**
- **A Windows cold start (#703).** No one started the branch on a fresh Windows PC. Why Claude's own check failed on 2.2's Gate 2 cold start, and where current Claude Code keeps its Windows sign-in, are still unknown; the branch now logs why an answer was unusable. The red-green proof ran a Windows cold start on macOS, with cmdkey's real output and a stand-in for cmd.exe.
- **A real Anthropic key (#541).** The dev runs used a placeholder key against a local stand-in that answered 401. Claude read ready in Settings, the sheet, Home and the welcome, and a chat and a Flow step sent the key. Not tried: a real key answering (test-keys row S4), a real Claude.ai sign-in winning over a saved key (the decision table's test covers the logic), and Anthropic's real 401. Against the stand-in, Claude Code retried the 401 13 times over about 4 minutes before its card.
- **A real sign-in finishing while the sheet waits.** The sheet's states were set by posting the host's messages, and no Claude or ChatGPT sign-in finished, failed or timed out while it waited. Also not tried: what Codex's app-server does with a second login, and "Open the page again" opening a real page (only its no-page answer ran).
- **Live limit wording from Claude, ChatGPT and Google.** The proof used a local fake Google that answers 429 with "Please retry in 41s". No real exhausted plan was seen, so Claude's and ChatGPT's own words, and whether Google sends `Retry-After`, are unchecked. Also not shown live: the "after <time>" card with a fresh time more than two minutes away (unit-tested), and Stop during OpenCode's retries.

These are rows in `docs/releases/v2.3.0/TEST-CHECKLIST.md`, under AI ready on day one, for Jarmo to test on the release candidate.

**Found, for follow-up issues** (none filed yet):
- OpenCode's silent retries on a 429: five retries in about 72 s, with nothing on the sheet (`research/2026-11-16-opencode-silent-retries.md`).
- A failed Claude or ChatGPT Flow step reads as Finished, with the error in its output. It is older than this sprint, and whether a failed step stops the flow is a product call.
- A third copy of the availability derivation (the sheet, `AISidebar.tsx` and `ChatInput.tsx`), for one shared hook.
- This plan's Not in it, above.
