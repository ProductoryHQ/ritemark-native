# Sprint 139 Tasks

Nothing here starts before Jarmo approves the plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md); R and E numbers are requirements in [spec.md](spec.md); S numbers are scenarios in [scenarios.md](scenarios.md); A numbers are the Phase 1 audits.

## Phase 0: Branch and starting tree

- [x] The v2.1.0 release plan is on `main` (`docs/development/releases/v2.1.0/release-plan.md`, written by the Development manager from the shape). sprint-manager needs it before Phase 3
- [x] `git checkout -b sprint-139-chosen-ai` from `origin/main`; `git branch --show-current` shows it
- [x] `media/webview.js` size recorded in `notes/bundle.md` (E4)
- [x] Asked through the Development manager (answered 26 October: no test accounts or keys now, "Mitte praegu"; the words go to the Experience lead with the PR's screenshots):
  - Jarmo: the Claude Free and ChatGPT Free test accounts under a separate macOS user (*Open Questions* 5); the OpenCode test key (*Open Questions* 7);
  - the Experience lead: confirm R3–R5's proposed words, or the manager decides them as small wording

## Phase 1: Audits first

- [ ] `research/claude-free-audit.md` (A1; R2, R5, R8). **Not run** (no accounts: "Mitte praegu"); the file says what waits on it. It waits on the accounts and runs under the separate macOS user:
  - sign-in (the browser page, `auth login`, `auth status --json` and whether it names the plan);
  - the first message (the SDK result, its error category and text, and 2.0.1's screenshot);
  - ChatGPT Free (`planType`, a working turn, the usage-limit shape if reached);
  - the decision: where, how matched, final words, outcome
- [x] `research/error-corpus-audit.md` (A2; R3–R5, E1): each kind × runtime as a fixture, with its structured code (Claude's category; Codex's error info if present) or anchored pattern; the proposed words per kind
- [x] `research/links-audit.md` (A3; R2, R5): `openExternal` and untrusted hosts on 2.0.1; each provider's billing page; the decision (trusted domains in `product.json`, or words only). If shell-tier, `sprint-plan.md`'s tier line changes first
- [x] `research/record-skew-audit.md` (A4; E2): a branch-written profile in 2.0.1 and back; nothing compares re-encoded records
- [x] `research/confirmations.md`:
  - the first-reply turn identity, and where `first_message_sent` moves;
  - the `agent-execute` paths and continuations;
  - dictation's and Transcribe's capture and write points;
  - who saves a document under autosave;
  - the AI status item in 2.0 and the amber dot;
  - `opencode`'s catalog default
- [x] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol). No requirement changed: A3 chose words for untrusted billing hosts, which R5 allows; A4 corrects S57's last line (a 2.0.1 write-back also drops the cards' kinds), noted in the audit

## Phase 2: One classifier, the cards, the status line (W1, W2)

- [x] `runtime/runtimeErrorPresentation.ts`: `classifyRuntimeError()` for all three runtimes (structured code, unwrap, A2's matchers, `provider` fallback); `presentRuntimeError()` as its wrapper (R3, E1)
- [x] `agent/AgentRunner.ts`: carry the SDK's error category to the classifier as a hint (E1)
- [x] `commentTasks/types.ts` `safeFailureMessage()` and `acp/AcpRuntime.ts` `describeAcpTurnError()` delegate to the classifier (E1)
- [x] `views/UnifiedViewProvider.ts`: `onCodexComplete` and `onExit` through the classifier; `errorKind` and action data on `agent-result` and `codex-result`; the sentence and `errorKind` checkpointed; the raw text to the activity trace (R3)
- [x] `conversations/types.ts`: optional `errorKind` on assistant and boundary events, decoded leniently; `failureKind` unchanged (E1, E2)
- [x] `runtimeErrorPresentation.test.ts` with A2's fixtures; `types.test.ts` for the lenient field (E3)
- [x] `webview/.../ai-sidebar/TurnFailureCard.tsx`: the card per kind for `AgentResponse` and `CodexView`; Use <default> through `selectRuntimeModel` and the catalog's default; Open <billing page>; Sign in to ChatGPT (R3–R5)
- [x] `RuntimeNotice.tsx`: a tooltip on every button (`ui/tooltip.tsx`)
- [x] `activityState.ts`, `ActivityStatusLine.tsx`: "Failed" only; nothing under a card (R3)
- [x] `CodexView.tsx`: the red line replaced by the card or the sentence, once (R3)
- [x] `conversationProjection.ts`: `errorKind` restored, so a restored turn draws its card (R3)
- [x] Webview tests: each kind's card, the status line, a restored turn (E3)

## Phase 3: The plan lines (W3)

- [x] `welcomeCopy.ts`, `WelcomeParts.tsx`: one line per provider; Add another uses the same cards (R1)
- [x] `RitemarkSettings.tsx`: Claude's and ChatGPT's signed-out lines; OpenCode's line; the words imported from `welcomeCopy.ts` (R1)
- [x] `OnboardingWizard.tsx`: the same lines, if *Open Questions* 2 is yes (R1)
- [x] The copy test: one line per provider, no "Codex" (E3)

## Phase 4: A chat keeps its model (W5)

- [x] `conversations/types.ts`: optional `composerPreferences.modelByRuntime`, decoded leniently (R6, E2)
- [x] `ConversationController.ts` / `ConversationStore.ts`: saved at each accepted turn with the host's resolved model; `lastActivityAt` unchanged (R6)
- [x] `conversations/protocol.ts`: `conversation/set-composer-preference` gains optional `modelId`; the store saves a pick (R6)
- [x] `conversationProjection.ts`, `store.ts`: a chat's own model restored for all three runtimes; the bootstrap keeps it when offered, falls back to the default when not (R6)
- [x] `UnifiedViewProvider.ts`: the substitution line from the chat's saved model, for all three runtimes, once per conversation; the app-wide pick kept for new chats (R6)
- [x] Tests: both writes, the restore, the fallback, the substitution line for ChatGPT and OpenCode (E3)

## Phase 5: The counts (W6, W7)

- [x] `analytics/events.ts`: `agent_used` (`agent`, `source`, and `outcome` if *Open Questions* 3 is yes), `first_reply`, `voice_captured`, `voice_note_edited` (R7, R8, R10)
- [x] `UnifiedViewProvider.ts`: `agent_used` and `first_message_sent` after acceptance, never on a continuation; `first_reply` at the counted turn's end (R7, R8)
- [x] `flows/FlowExecutor.ts`: `agent_used` with `claude` / `chatgpt` and `source: flow`; the LLM step as `feature_used: flow_llm_step` (R7)
- [x] `analytics/voiceNotes.ts` (new): the salted-hash list, 200 entries, 30 days, cleared when usage data turns off (R10)
- [x] Dictation (`voiceDictation/controller.ts`, `ritemarkEditor.ts`) and Transcribe (`speech/`): `voice_captured` and the list's entries; `onDidSaveTextDocument` sends `voice_note_edited` once on a later day (R10)
- [x] Tests: each event through the gate; the first-reply pairing; `voiceNotes.test.ts`; the Flow mapping (E3)
- [x] The insights' definitions in `qa-evidence.md` (building them in PostHog and linking them from `strategy/bets.md` is the Development manager's and the Strategy Room's) (R9, R10)
- [x] R11's lines and S56's payload log in `qa-evidence.md` and the PR, for the Development manager to send to the Inbound Traffic manager; the release checklist row asked for in the PR (R11)

## Phase 6: QA and merge 1

- [x] `scripts/qa/three-runtimes-check.mjs`: one launch per AI, the stand-in, S51–S53 (R12, E3)
- [x] Manual QA on the Mac: ChatGPT in full; Claude's signed-out paths; OpenCode and Claude in-app turns not run (no sign-in, no key); evidence in `qa-evidence.md`, with what could not be run and why
- [ ] Windows overlay round: S54, and R1, R3, R6 on the extension side (E6). **Not run in this session**
- [x] `media/webview.js` measured after; `notes/bundle.md` (E4)
- [x] Docs: `architecture.md`'s three sections and version-history row; `docs/CHANGELOG.md` (E5)
- [x] `npm test`, the webview tests, `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR opened; `qa-validator` review; the Development manager's smoke test; screenshots of the new cards to the Experience lead; Jarmo's admin merge

## Phase 7: The refusal and merge 2 (W4), after A1

- [ ] `spec.md` R2 revised first if A1 changed the facts or the words; the Experience lead confirms
- [ ] The `plan` kind in the classifier, from A1's code or matcher, with its fixture (R2, E1)
- [ ] If A1 shows the plan at sign-in: `agent/setup.ts` reads it; the welcome's and Settings' Claude cards show the refusal (R2, S14)
- [ ] The `plan` card: experience 35 frame 6's layout, words and muted line (R2)
- [ ] `openChatWith(runtimeId, { text, send })`: a new chat bound to that AI; its sign-in first if needed; attachments never sent this way. Built here, or reused from Sprint 138 if it merged first (R2, R5)
- [ ] See Claude's plans: `claude.com`'s pricing page (R2)
- [ ] `ai/connectivity.ts`: the `plan` state, "Claude needs a paid plan" with the dot, cleared when any AI's turn completes (R2)
- [ ] Sprint 138's Home card stays after a `plan` turn (with 138; S15)
- [ ] Manual QA: S6–S15, S44's plan case; screenshots to the Experience lead
- [ ] PR, `qa-validator`, the Development manager's smoke test, Jarmo's admin merge

## Phase 8: Closeout

- [ ] Linked issues closed with evidence, or updated: #496, #376, #417, #479, #473
- [ ] The test accounts recorded in `governance/test-keys.md` (`ritemark-dev`, through the Development manager)
- [ ] The release plan's tracker updated
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
