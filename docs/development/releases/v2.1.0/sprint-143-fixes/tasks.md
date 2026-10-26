# Sprint 143 Tasks

Nothing here starts before the plan is approved. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); S numbers are scenarios in [scenarios.md](scenarios.md); A numbers are the audits.

## Phase 0: Branch and starting tree

- [ ] `git checkout -b sprint-143-fixes` from `origin/main`; `git branch --show-current` shows it
- [ ] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [ ] Each Mac check of S1–S38 that can fail on `main` run once on `main` at `1e91466c` and its failure recorded in `qa-evidence.md` (E1): S1, S2's throw, S10–S12 (the store fed the recorded notifications), S15, S18 and S21, S23–S26, S35, S37, S40
- [ ] Asked through the Development manager: the "Ritemark on Windows" session for A4; the Social manager for how the films sent ⌘⇧P (A3); the Experience lead for R3's line and card and R8's words

## Phase 1: Audits

- [ ] `research/landing-audit.md` (A1; R2): every path from `goTo()` to the first chat's runtime; the three ways forced by hand (no record, a replaced sheet, a held model list), each run once with `research/repro/landing-551.mjs`. A fourth way found changes `spec.md` first
- [ ] `research/mention-audit.md` (A2; R5): the editor's other floating menus checked against the comment's bubble with the toolbar following the focus
- [ ] `research/home-keys-audit.md` (A3; R7): how the films sent ⌘⇧P; S27–S32 typed by a person, Mac and Windows, ten presses each, with a trace. Decision: a cause and a place, or #507 to 2.2
- [ ] `research/windows-pickers-audit.md` (A4; R9), on Windows with `USERPROFILE=C:\Ritemark` and `--log trace`: each picker's default folder, the dialog lock line, the processes after quitting; then with W9a. Decision: W9a enough, a patch hunk (tier line first), or a separate cause for the processes
- [ ] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol)

## Phase 2: Home lets go (W1, R1)

- [ ] `src/views/HomePanel.ts`: the project list's unsubscribe pushed as `{ dispose }`; `dispose()` disposes each in its own `try`, then the panel
- [ ] `src/views/HomePanel.test.ts` (new, `vscode` stubbed): every subscription and the panel disposed; a throwing one doesn't stop the rest; added to `npm test`

## Phase 3: Line breaks and the toolbar (W6, W5; R6, R5)

- [ ] `webview/.../ai-sidebar/ChatBubbles.tsx`: the message's text in an element with `whitespace-pre-wrap` and wrapping for long words; `ChatMessage.tsx` the same
- [ ] `webview/.../ai-sidebar/chatBubbles.test.ts` (new, `renderToStaticMarkup`): newlines kept in the pre-wrap element
- [ ] `webview/src/components/FormattingBubbleMenu.tsx`: `shouldShow` through a pure `formattingToolbarShows` helper that also asks for the editor's (or the toolbar's) focus
- [ ] `webview/src/components/formattingToolbar.test.ts` (new): hidden with the focus in a comment's box, shown in the editor or the toolbar
- [ ] Any cover A2 finds: fixed here or filed

## Phase 4: The first chat's AI (W2, R2)

- [ ] `src/welcome/welcomeHost.ts` `goTo()`: `ritemark.ai.selectedAgent` written before `vscode.openFolder` when the person chose an AI on this welcome
- [ ] `webview/.../ai-sidebar/store.ts` `applyPendingLanding`: the 20 s limit for `opencode` only
- [ ] The dropped landing's reason logged: `runLanding()` (record dropped) and the sheet's `landing/dropped` (wait ended), the host logging both
- [ ] `landingChat.test.ts`: ChatGPT's late list still lands; OpenCode still gives up after 20 s. A welcome test: the setting written before `openFolder`, only with a chosen AI
- [ ] `scripts/qa/landing-check.mjs` (from `research/repro/landing-551.mjs`, with `--runs` and `--updates`); `scripts/qa/three-runtimes-check.mjs` fails the step when the landing is wrong instead of picking the AI

## Phase 5: The wait on ChatGPT (W3, R3)

- [ ] `src/codex/CodexRuntime.ts`: the app-server's `error` notification with `willRetry: true` → `config.onRuntimeRetry({ attempt, of, httpStatus })` for the session's current turn; the raw notification to the turn's trace
- [ ] `src/views/UnifiedViewProvider.ts`: `codex-retry` to the sheet, guarded by `isCurrentRuntimeTurn()`
- [ ] `webview/.../ai-sidebar/store.ts`: the running turn's `retry`, cleared on the next delta, activity, question, approval or result
- [ ] `activityState.ts`, `ActivityStatusLine.tsx`: the `retrying` state and its two lines
- [ ] `src/runtime/runtimeErrorPresentation.ts`: Codex's `responsetoomanyfailedattempts` / `responsestreamdisconnected` with 429 → `limit`, `limit: 'busy'`
- [ ] `src/runtime/turnFailureCopy.ts`: `LimitKind` `'busy'` and its card, with Continue with another ready AI
- [ ] Tests: `CodexRuntime.test.ts` (retry routed to its turn only), `runtimeErrorPresentation.test.ts` (the recorded final error), `activityState.test.ts` (the line and its clearing), the copy's card
- [ ] Confirmed unchanged: `codexManager.ts` spawns the app-server with no arguments; nothing writes `~/.codex` (S9)

## Phase 6: Titles (W4, R4)

- [ ] `src/conversations/ConversationTitleGenerator.ts`: `settingSources: []`, `availableTools: []`
- [ ] `ConversationTitleGenerator.test.ts`: both options pinned, the prompt still pinned
- [ ] `scripts/qa/title-language-check.mjs` (new): 10 English and 10 Estonian first messages titled on the bundled Codex with the generator's prompt, turns spaced out

## Phase 7: Transcribe (W8, R8)

- [ ] `src/speech/audioPrep.ts`: `cannotTakeOnDevice(ext, engineAccepts, canConvert)`; `prepareAudio` uses it
- [ ] `src/views/TranscribeViewProvider.ts`: `refusal` on the on-device estimate; `_start` refuses it; `transcribe:dismissJob`
- [ ] `src/speech/JobManager.ts`: `dismiss(jobId)` for failed and interrupted jobs only
- [ ] `webview/src/components/transcribe/`: the pending card's disabled engine with its sentence; Dismiss with its tooltip on every Needs attention card
- [ ] Tests: `audioPrep.test.ts`, `JobManager.test.ts`, the attention row's button and tooltip

## Phase 8: The pickers (W9, R9)

- [ ] `src/utils/dialogDefaults.ts` (new): `pickerDefaultUri(projectFolder?)`
- [ ] Every Ritemark `showOpenDialog`/`showSaveDialog` without a `defaultUri` given one
- [ ] `dialogDefaults.test.ts`: the three cases; no dialog call in `src/` without `defaultUri`
- [ ] W9b, if A4 asks for it: the patch hunk (tier line changed first, frame script run)

## Phase 9: ⌘⇧P on Home (W7, R7)

- [ ] `scripts/qa/home-keys-check.mjs` (from `research/repro/repro-513-507.mjs`'s Home cases)
- [ ] If A3 reproduced it: the fix in the place A3 names, with the check failing first. Otherwise: the evidence on #507 and the issue moved to 2.2

## Phase 10: QA and closeout

- [ ] `npm test` and the webview tests pass; `./scripts/validate-qa.sh`
- [ ] The scripted checks on the branch: `landing-check.mjs` 20 of 20 (S3), `comment-mention-check.mjs` (S18–S22), `home-keys-check.mjs` (S27–S32), `title-language-check.mjs` (S16)
- [ ] Manual Mac scenarios: S1, S4, S5, S7, S9, S10–S12 (injected), S23–S25, S34, S37, S38, S43
- [ ] Windows through the test overlay, as far as the "Ritemark on Windows" session can before the merge: S36, S39–S41, S33
- [ ] Screenshots of R3's line and card, R5's comment, R6's message and R8's card to the Experience lead before the merge
- [ ] `media/webview.js` size after (`notes/bundle.md`)
- [ ] `docs/development/architecture.md` (E5); `docs/CHANGELOG.md`; release notes draft to the Development manager
- [ ] Gate 2 rows for 2.1's release plan: S17 (Claude titles), S33 (Ctrl+Shift+P), S36 and S41 (Windows), and A3's keyboard try if still open
- [ ] Issues: #556, #513, #511, #544, #514, #509 closed with their evidence on merge (#514's Claude half and #509's Windows half at Gate 2); #551 closed after S3's 20 of 20 on the branch; #510 after S41; #507 as A3 decides
- [ ] `qa-evidence.md` written; `release-plan.md`'s tracker row updated
