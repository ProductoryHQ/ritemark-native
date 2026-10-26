# Sprint 143 Tasks

Nothing here starts before the plan is approved. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); S numbers are scenarios in [scenarios.md](scenarios.md); A numbers are the audits.

## Phase 0: Branch and starting tree

- [x] `git checkout -b sprint-143-fixes` from the plan commit rebased on `origin/main` (`84ea15db`); `git branch --show-current` shows it
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [x] Each unit check that can fail on `main` run against `main`'s file and its failure recorded in `qa-evidence.md` (E1). The running-app checks for R5 and R2 were run on `main` in planning (`research/reproductions.md`)
- [x] Asked through the Development manager (answered 26–27 October): the Social manager on how the films sent ⌘⇧P (A3); the Experience lead's words for R3 (R3a). The "Ritemark on Windows" session for A4: the manager's to arrange

## Phase 1: Audits

- [x] `research/landing-audit.md` (A1; R2): every path from `goTo()` to the first chat's runtime and the three ways. The forced runs by hand were **not run**; the file says why and what covers each
- [ ] `research/mention-audit.md` (A2; R5): **not written.** The comment check found nothing else over the list once the toolbar follows the focus (5 of 5, the option under each click's centre); the other floating menus weren't tried one by one
- [x] `research/home-keys-audit.md` (A3; R7): the films' method (the Social manager's answer) tried here, 20 of 20 on the dev build and 20 of 20 on the installed 2.0.1. Decision: no code; a person's keyboard at Gate 2
- [ ] `research/windows-pickers-audit.md` (A4; R9), on Windows: **not run** (no Windows PC here). W9b waits on it
- [x] Where an audit changes a requirement, `spec.md` changes first: R3a added (the Experience lead's words, the wait's length from Codex's log)

## Phase 2: Home lets go (W1, R1)

- [x] `src/views/HomePanel.ts`: the project list's unsubscribe pushed as `{ dispose }`; `dispose()` disposes each in its own `try`, then the panel
- [x] `src/views/HomePanel.test.ts` (new, `vscode` stubbed): every subscription and the panel disposed; a throwing one doesn't stop the rest; added to `npm test`

## Phase 3: Line breaks and the toolbar (W6, W5; R6, R5)

- [x] `webview/.../ai-sidebar/ChatBubbles.tsx`: the message's text in an element with `whitespace-pre-wrap` and `overflow-wrap: anywhere`; `ChatMessage.tsx` the same
- [x] `webview/.../ai-sidebar/chatBubbles.test.ts` (new, `renderToStaticMarkup`): newlines kept in the pre-wrap element
- [x] `webview/src/components/FormattingBubbleMenu.tsx`: `shouldShow` through a pure `formattingToolbarShows` helper that also asks for the editor's (or the toolbar's) focus, keeping Sprint 138's equation rule
- [x] `webview/src/components/formattingToolbar.test.ts` (new): hidden with the focus in a comment's box, shown in the editor or the toolbar

## Phase 4: The first chat's AI (W2, R2)

- [x] `src/welcome/welcomeHost.ts` `goTo()`: `ritemark.ai.selectedAgent` written before `vscode.openFolder` when the person chose an AI on this welcome (`welcomeState.selectedAgentOnLeave`)
- [x] `webview/.../ai-sidebar/store.ts` `applyPendingLanding`: the 20 s limit for `opencode` only
- [x] The dropped landing's reason logged: `runLanding()` (`landing.whyNoLanding`) and the sheet's `landing/dropped`, the host logging both
- [x] `landingChat.test.ts`: ChatGPT's late list still lands (fails on `main`); OpenCode still gives up after 20 s. `welcomeState.test.ts`: the AI saved only when chosen. `landing.test.ts`: the log's reasons
- [x] `scripts/qa/landing-check.mjs`; `scripts/qa/three-runtimes-check.mjs` fails the step when the landing is wrong instead of picking the AI

## Phase 5: The wait on ChatGPT (W3, R3)

- [x] `src/codex/CodexRuntime.ts`: Codex's `error` notification with `willRetry: true` → `config.onRuntimeRetry` for its own turn; the raw notification to the trace. `codexAppServer.ts` re-emits it as `codex/error` (an unheard EventEmitter `'error'` threw inside the JSON loop)
- [x] `src/views/UnifiedViewProvider.ts`: `codex-retry` to the sheet, guarded by `isCurrentRuntimeTurn()`
- [x] `webview/.../ai-sidebar/store.ts`: the running turn's `retry`, cleared on the next delta, activity, question, approval or result
- [x] `activityState.ts`, `ActivityStatusLine.tsx`: the waiting state
- [x] `src/runtime/runtimeErrorPresentation.ts`: `ratelimitexceeded`, and `responsetoomanyfailedattempts` / `responsestreamdisconnected` with 429 → `limit`, `limit: 'busy'`
- [x] `src/runtime/turnFailureCopy.ts`: `LimitKind` `'busy'` and its card, with Continue with another ready AI
- [x] Tests: `CodexRuntime.test.ts` (Test 17), `runtimeErrorPresentation.test.ts`, `activityState.test.ts`, `continueWithAlternative.test.ts`
- [x] Codex's start: no arguments added, nothing in `~/.codex` written; one environment variable for Ritemark's own process (R3a)

## Phase 5a: The countdown and the busy card (W3a, R3a; added 2026-10-26)

- [x] `src/codex/codexManager.ts`: `RUST_LOG=error,codex_core::responses_retry=warn` for Ritemark's own app-server when the environment has none (`codexRetry.codexAppServerEnv`)
- [x] `src/codex/codexAppServer.ts`: the retry line parsed from stderr (`parseCodexRetryLine`); `CodexRuntime` pairs it with the notification, in either order
- [x] `turnFailureCopy.ts`: `retryingLine` (minutes, "a minute", "soon"), `continueWithAction`, the busy card with and without `retryAt` in the person's time format
- [x] `runtimeErrorPresentation.ts`: the service's time (`serviceRetryAt`)
- [x] `ActivityStatusLine.tsx`: the countdown tick (15 s) and Continue with <AI>; the busy card's Continue the same (`continueWithAlternative`); "Failed" under the busy card
- [x] Tests for both, and screenshots of the line and the card
- [x] After QA and the PR's review (27 October):
  - the waits paired per turn (`CodexRetryPairing`, by `turn_id`; Test 18);
  - stderr read by whole lines (`LineBuffer`; Test 19);
  - the busy card's own Continue tooltip ("Send your message to <AI> instead.");
  - `serviceRetryAt` reads "at …" too;
  - the spec's addendum;
  - `busy-card.png` retaken on the rebased build.

## Phase 6: Titles (W4, R4)

- [x] `src/conversations/ConversationTitleGenerator.ts`: `settingSources: []`, `availableTools: []`
- [x] `ConversationTitleGenerator.test.ts`: both options pinned (fails on `main`), the prompt still pinned
- [ ] `scripts/qa/title-language-check.mjs`: **not built**; the change is Claude-only, and ChatGPT's 36 October titles stand (`qa-evidence.md`)

## Phase 7: Transcribe (W8, R8)

- [x] `src/speech/audioPrep.ts`: `cannotTakeOnDevice(ext, engineAccepts, canConvert)`; `prepareAudio` uses it
- [x] `src/views/TranscribeViewProvider.ts`: `refusal` on an engine's estimate; `_start` refuses it; `transcribe:dismissJob`
- [x] `src/speech/JobManager.ts`: `dismiss(jobId)` for failed, interrupted and cancelled jobs only
- [x] `webview/src/components/transcribe/`: the pending card's disabled engine with its sentence; Dismiss with its tooltip on every Needs attention card; a tooltip on Try again too (`panelChrome.ATTENTION_ACTIONS`)
- [x] Tests: `audioPrep.test.ts`, `JobManager.test.ts`, `panelChrome.test.ts`

## Phase 8: The pickers (W9, R9)

- [x] `src/utils/dialogDefaults.ts` (new): `pickerFolder(candidates)`, the first that is a folder now, else the home
- [x] Every Ritemark `showOpenDialog` starts in a folder that exists (15 of 15). The 7 save dialogs pass a file path beside the open document, or a remembered folder checked to exist; unchanged (spec, *Addendum*)
- [x] `dialogDefaults.test.ts`: the cases, and a scan of every `showOpenDialog` in `src/`
- [ ] W9b, if A4 asks for it: the patch hunk (tier line changed first). Waits on A4

## Phase 9: ⌘⇧P on Home (W7, R7)

- [x] No code (A3's decision). The reproducers are in `research/repro/` (`repro-513-507.mjs`, `repro-507b.mjs`, `repro-507c.mjs`); `scripts/qa/home-keys-check.mjs` not added
- [ ] Gate 2: a person types S27–S33; without a reproduction, #507 moves to 2.2 with `research/home-keys-audit.md`

## Phase 10: QA and closeout

- [x] `npm test` and the webview tests pass; `tsc --noEmit` for both; the pre-commit validator by hand
- [x] The scripted checks on the branch: `landing-check.mjs` (S3), `comment-mention-check.mjs` (S18–S22)
- [x] The sheet on a dev instance: S10–S12 (injected), S23 (a real ChatGPT turn)
- [ ] Manual Mac scenarios not run: S5, S7 (forced landings), S9 (`ps`), S24–S25, S34, S37–S38 (Transcribe on the Mac), S43 (2.0.1 reading this build's records)
- [ ] Windows through the test overlay (S33, S36, S39–S41): the "Ritemark on Windows" session's
- [ ] Screenshots to the Experience lead before the merge (in the PR)
- [x] `media/webview.js` size after (`notes/bundle.md`)
- [x] `docs/development/architecture.md` (E5); `docs/CHANGELOG.md`
- [ ] Release notes draft to the Development manager (the CHANGELOG entry is its source)
- [x] Gate 2 rows in 2.1's release plan: S17 (Claude titles), S27–S33 (a real keyboard on Home), S36 and S41 (Windows)
- [ ] Issues on merge: #556, #513, #511, #544, #514, #509 closed with their evidence (#514's Claude half and #509's Windows half at Gate 2); #551 after S3's 20 of 20 (passed on the branch, 27 October); #510 after S41; #507 as A3 decided
- [x] `qa-evidence.md` written; `release-plan.md`'s tracker row updated
