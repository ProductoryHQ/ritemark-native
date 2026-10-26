# Sprint 139 Technical Plan

The plan for [spec.md](spec.md). The release is 2.1.0. Its shape is in `ritemark-dev`: `releases/v2.1.0/shape.md`, item 4, approved by Jarmo on 21 October 2026. The drawings are experience 35 (`product/design/experience/experiences/firstday/`, frame 6) and experience 2's redrawn step-1 cards.

Code shapes here are proposals. When the code needs something else, this file changes first. File references are to `main` at `b1ac84a7` (the 2.0.1 closeout). All paths are under `extensions/ritemark/` unless they say otherwise.

## What exists today

| Part | Today | File |
|---|---|---|
| The welcome's step-1 cards | ChatGPT and Claude share one line, "Sign in with the account you already use."; OpenCode says "Open models, with an API key of your own." | `webview/src/components/welcome/welcomeCopy.ts:24–25`, `WelcomeParts.tsx:82` |
| Settings' sign-in cards | Claude, not signed in: "Sign in to start using Claude. Choose Claude.ai for the simplest setup, or paste an Anthropic API key if you prefer." ChatGPT (#482): "Sign in with your ChatGPT account. No API key is needed. Any ChatGPT account works, Free included. Paid plans get higher limits." OpenCode's section has only its auto-approve switch; its keys sit under API keys | `webview/src/components/settings/RitemarkSettings.tsx:504`, `:706–708`, `:836–848` |
| The AI sheet's sign-in cards | "Connect your Claude.ai account to get started." and the same for ChatGPT, for someone who skipped the welcome | `webview/src/components/ai-sidebar/OnboardingWizard.tsx:219–247` |
| Knowing the plan | Codex's `account/read` reports a ChatGPT `planType`. Ritemark reads only `loggedIn` and `authMethod` from Claude's `auth status --json`, so it never knows Claude's plan | `codex/codexAuth.ts:89–90`, `agent/setup.ts:73–74`, `:381–385` |
| Claude's errors | `presentRuntimeError()` knows only Claude: two `failureKind`s (OAuth, API key), each with its own card, and Sprint 127 R6's unavailable-model sentence. Anything else is passed through as it arrived | `runtime/runtimeErrorPresentation.ts:93–131` |
| Claude's structured error | The SDK's assistant event carries an error category (`message.error`). `claudeSdkAssistantError()` keeps the text and drops the category, unless there is no text | `agent/AgentRunner.ts:154–165` |
| ChatGPT's and OpenCode's errors | Both report through `onCodexComplete`. `formatCodexTurnError()` returns Codex's `turn.error.message`, which is often a JSON envelope. `describeAcpTurnError()` knows one case, no model selected. The host posts `codex-result` with the raw string and checkpoints it unchanged | `codex/CodexRuntime.ts:112–123`, `:913`; `acp/AcpRuntime.ts:279`, `:343–348`; `views/UnifiedViewProvider.ts:1207–1240` |
| Where the error shows twice | `CodexView` prints `turn.result.error` as a red line. The status line then repeats its first 120 characters as "Failed — …", for Claude too | `webview/src/components/ai-sidebar/CodexView.tsx:251–257`, `ActivityStatusLine.tsx:35`, `activityState.ts:123` |
| Envelope unwrapping | `safeFailureMessage()` digs the sentence out of an envelope, for comment tasks and task cards only | `commentTasks/types.ts:236–271`; `taskBoard/CardHandoffLedger.ts:293`, `:352` |
| The card | `RuntimeNotice`: title, message, tone, two actions. Its buttons have no tooltips | `webview/src/components/ai-sidebar/RuntimeNotice.tsx` |
| Claude's card per failure | The sign-in card (by `failureKind`) and the context-overflow card (by text, `isContextOverflowError`) | `webview/src/components/ai-sidebar/AgentResponse.tsx:36`, `:134`, `:213` |
| The record's failure fields | `failureKind` on assistant and boundary events, decoded strictly as `'authentication' \| 'api-key-authentication'`. Unknown keys are ignored by the decoders, which pick known fields only (`appliedThinkingEffort`, `activeDurationMs` and `readAt` were added that way) | `conversations/types.ts:85–125`, `:455–467`, `:497–505`, `:660–666` |
| The record's composer preferences | `thinkingEffortByRuntime` only, saved at creation and by `conversation/set-composer-preference`. No model | `conversations/types.ts:153–155`, `:576–588`; `ConversationStore.ts:~340–365`; `ConversationController.ts:~847`; `protocol.ts:217–229` |
| A reopened chat's model | The projection fills all three model fields from the open chat, or with `''`. The bootstrap then fills `''` with Codex's catalog default, the app-wide Claude pick or the first OpenCode row, silently except for Claude | `webview/src/components/ai-sidebar/conversationProjection.ts:~97–105`; `store.ts:~2603–2680` (`agent:bootstrap`) |
| The model a turn runs | Every `agent-execute` carries the composer's model. For Claude the host compares it with the app-wide `ritemark.ai.selectedModel` and names a substitution (Sprint 127 R6) | `store.ts:1384`, `:1743`; `UnifiedViewProvider.ts:683–700`, `:3183` |
| Native resume | A continuation is used only when the turn's model equals the one it was taken on | `runtime/continuation.ts:102` |
| A new chat from the host | `openLandingChat(runtimeId, placeholder)` opens a new chat with an AI and a placeholder (the welcome's landing). It sends nothing | `UnifiedViewProvider.ts:1714–1721`; `store.ts:2152`, `:2940` |
| The AI status item | "AI Ready" or "AI Offline" (warning background) in the status bar; a click opens the AI's sheet | `ai/connectivity.ts:123–150` |
| Trusted link domains | `claude.com`, `claude.ai`, `platform.claude.com`, `console.anthropic.com`, `auth.openai.com` and `*.ritemark.app`. No provider billing host other than Anthropic's console | `branding/product.json:176` (repo root) |
| Usage data | One gate (`ConsentGate`): nothing before the welcome is left, nothing with usage data off, GeoIP off, `build_channel` on every event. Nine events | `analytics/consent.ts`, `posthog.ts`, `events.ts` |
| Counting AI use | `agent_used` only from Flows, as `ritemark_llm`, `claude` or `codex`; none has arrived since 30 March. The chat sends only `first_message_sent`, once per profile, at the top of the handler, before the message is saved | `flows/FlowExecutor.ts:100–114`; `analytics/posthog.ts:204–218`; `UnifiedViewProvider.ts:686` |
| Dictation | One `DictationController` per editor; `producedText` marks a dictation that inserted text | `ritemarkEditor.ts:975`; `voiceDictation/controller.ts:204`, `:444` |
| Transcribe | A job's transcript lives in its session. It becomes a document when written (`writeTranscriptMarkdown`), from the export step | `speech/JobManager.ts`, `speech/autoExport.ts:60`, `speech/exportTranscript.ts:83` |

## Architecture overview

| Layer | What changes | Where |
|---|---|---|
| Runtime presentation | One classifier for all three runtimes: kind, sentence, action data; structured codes first, then matchers from A2's corpus; the envelope unwrapping moves here | `src/runtime/runtimeErrorPresentation.ts` |
| Host: the turn's end | Codex and OpenCode results go through the classifier like Claude's; the kind is sent and checkpointed; the plan state goes to the status item; `first_reply` is sent | `src/views/UnifiedViewProvider.ts` |
| Conversations | `errorKind` on failed events; `composerPreferences.modelByRuntime`; both decoded leniently; the model saved at an accepted turn and on a pick | `src/conversations/types.ts`, `ConversationStore.ts`, `ConversationController.ts`, `protocol.ts` |
| Comment tasks, task cards | Their sentence comes from the classifier | `src/commentTasks/types.ts`, `src/taskBoard/CardHandoffLedger.ts` |
| Webview: the AI's sheet | One `TurnFailureCard` for all three runtimes; the status line; the restored model; ask the same in a new chat with another AI | `webview/src/components/ai-sidebar/` |
| Welcome and Settings | The plan lines | `webview/src/components/welcome/welcomeCopy.ts`, `WelcomeParts.tsx`; `webview/src/components/settings/RitemarkSettings.tsx`; `OnboardingWizard.tsx` (if agreed) |
| Status bar | The AI item's third state | `src/ai/connectivity.ts` |
| Analytics | `agent_used` from the chat and Flows; `first_reply`; `voice_captured`, `voice_note_edited` and the local voice list | `src/analytics/`, `src/flows/FlowExecutor.ts`, `src/voiceDictation/`, `src/speech/` |

**Release tier: extension.** Every path above is under `extensions/ritemark/`, and every changed file ships in an extension's `out/**/*.js` or `media/webview.js`. It ships in 2.1.0's shell release (the shape's decision 1).

Two findings could add a shell-tier line, and either one changes this plan's tier line before it is built:
- A3: the providers' billing hosts in `branding/product.json`'s trusted link domains;
- the drawn amber dot, if it needs a status bar style in patch 018.

No new runtime, no change to `AgentRuntime`, no new subsystem. The new webview ↔ host messages stay inside the AI sheet's protocol. `architecture.md` changes in three sections (E5).

## Phase 1 audits

Four requirements carry real unknowns, so each gets an audit under `research/` before code (spec-driven-sprint skill, "Audit-First").

1. **`research/claude-free-audit.md` (A1; R2, R5, R8).** What a Claude Free account sees, on the Claude Code version 2.1 bundles.
   - **Isolation first.** Ritemark uses the shared Claude and Codex homes (no `CLAUDE_CONFIG_DIR`), and Claude's sign-in is a Keychain item for the whole Mac user. Signing in a test account in Jarmo's own macOS user would replace his sign-in. So the run happens under a separate macOS user on the Mac, signed in once by Jarmo (*Open Questions* 5). If `CLAUDE_CONFIG_DIR` is shown to isolate the Keychain item too, that is recorded, not assumed.
   - **At sign-in:** what Claude's browser page and `claude auth login --claudeai` show for a Free account, and what `claude auth status --json` reports (does it name the plan?).
   - **At the first message:** the SDK's result (`is_error`, `subtype`), the assistant event's error category and text, and what 2.0.1 shows today (a screenshot).
   - **ChatGPT Free in the same session:** `account/read`'s `planType`, a turn that works, and the usage-limit error's shape if it is reached.
   - **The decision:** where the refusal is caught (sign-in, first message or both), the structured code or anchored matcher, the card's final words (`spec.md` first if they change, with the Experience lead), and the `first_reply` outcome it maps to.
2. **`research/error-corpus-audit.md` (A2; R3–R5, R8, E1).** The real failures, per runtime and per kind, as fixtures.
   - **Sources:** #376's envelopes, Jarmo's Google credits text (24 October), Sprint 127 R6's Claude wordings, the bundled Codex app-server's `turn.error` (does it carry structured error info beside `message`?), OpenCode's ACP errors (JSON-RPC code and text, the "Internal error: …" wrapper), and runs with the test keys where they exist.
   - **The kinds to cover:** an ended sign-in, a refused key, a plan, a plan's usage limit (with its reset time), a key's quota, credits, a refused model, no connection, a timeout, and a runtime that exits.
   - **The result:** one table of kind, structured code or anchored pattern, and the fixture. Words are proposed for each kind and confirmed by the Development manager or the Experience lead (spec R3).
3. **`research/links-audit.md` (A3; R2, R5).** Whether `vscode.env.openExternal` from the extension asks first for a host that isn't a trusted link domain, in 2.0.1. Then each provider's billing page: Google AI Studio, OpenAI's platform billing, Anthropic's console, OpenRouter's credits. The decision is one of two:
   - those hosts join `branding/product.json`'s trusted link domains (one shell-tier line);
   - the card says where to go in words, with no button.
4. **`research/record-skew-audit.md` (A4; E2).**
   - A profile written by this branch (`errorKind`, `modelByRuntime`) opened by the installed 2.0.1 on a copy, and back. No quarantine, and what each side shows.
   - Confirm nothing compares a re-encoded record with the stored one (#417's question): the store's write path, the index, legacy migration, comment-task and task-card ledgers.

A short `research/confirmations.md` also records:
- the turn identity `first_reply` waits on, and where `first_message_sent` moves to so it counts only a saved message;
- every path that runs an `agent-execute` (the chat, comment tasks, task cards, Home's ready request), and which are continuations;
- where a dictation's insert ends, and where a Transcribe job becomes text and becomes a document;
- which save events fire for a Ritemark document under autosave, and from whom (the person, the agent, sync);
- whether the AI status item shows in 2.0's status bar, and how its third state can draw the amber dot;
- whether 2.0.1's resolver offers `opencode` a catalog default (expected: none).

## Workstream 1: One classifier (R3, E1)

This goes first: R2, R4, R5 and R8 all read its kinds.

- **Shape** (proposal):

  ```ts
  type RuntimeErrorKind = 'sign-in' | 'plan' | 'limit' | 'model' | 'network' | 'provider';
  interface ClassifiedRuntimeError {
    kind: RuntimeErrorKind;
    sentence: string;              // one sentence, unwrapped, never JSON
    failureKind?: RuntimeFailureKind; // Claude's two auth kinds, unchanged
    model?: string;                // 'model': the refused model id
    provider?: 'google' | 'openai' | 'anthropic' | 'openrouter' | 'chatgpt' | 'claude'; // 'limit'
    resetsAt?: string;             // 'limit': when a plan's limit resets, if the AI said
  }
  classifyRuntimeError(agentId: AgentId, raw: string | undefined, hints?: { code?: string; turnModel?: string }): ClassifiedRuntimeError | undefined
  ```

  `presentRuntimeError()` keeps its signature for its two callers and becomes a thin wrapper.
- **Order:**
  1. a structured code, when the runtime gives one (Claude's SDK category, carried from `AgentRunner` as a hint; Codex's error info, if A2 finds it);
  2. the unwrapped envelope;
  3. anchored matchers from A2's corpus;
  4. else `provider`, with the unwrapped sentence.

  A matcher never runs on assistant text, only on a turn's terminal error.
- **Unwrapping** moves from `safeFailureMessage()` into the classifier. `safeFailureMessage()` keeps its contract (its comment-sized clamp and its fallback) and calls the classifier for the sentence.
- **`describeAcpTurnError()`** keeps its no-model case and otherwise returns the raw text for the classifier.
- **The host** (`UnifiedViewProvider`):
  - `onCodexComplete` and `onExit` pass the error through the classifier, as `onComplete` does at `:1142`;
  - `codex-result` and `agent-result` carry `errorKind` and the action data;
  - `completeRuntimeTurn` checkpoints `error` (the sentence) and `errorKind`;
  - the raw text goes to the turn's activity trace, where Report AI issue reads it.
- **The record:** `errorKind?: RuntimeErrorKind` on assistant-message and boundary events. It is decoded leniently: an unknown value is dropped and never fails the record. `failureKind` is unchanged (E1, E2).
- **Tests:** `runtimeErrorPresentation.test.ts` with A2's fixtures (each kind × runtime, envelopes, ordinary text untouched, no match inside a long answer), and `conversations/types.test.ts` for the lenient field.

## Workstream 2: The cards and the status line (R3, R4, R5)

- **`TurnFailureCard`** (new, `webview/src/components/ai-sidebar/`), built on `RuntimeNotice`, is used by `AgentResponse` (Claude) and `CodexView` (ChatGPT, OpenCode) for a failed turn with an `errorKind`. It picks title, message and action from the kind, the runtime's people-name and the catalog's labels. Claude's existing sign-in card stays as it is for its two `failureKind`s.
- **`RuntimeNotice`** buttons gain tooltips (`ui/tooltip.tsx`; memory: every button gets a tooltip), for every card that uses it.
- **Actions:**
  - **Use <default>** (R4): `selectRuntimeModel(runtime, modelCatalog default)`, through the bootstrap's catalog lists. No resend. The card's text changes to "Now using …", with the green check.
  - **Open <billing page>** (R5): a host message that opens the provider's page (A3).
  - **Continue with <other AI>** (R5, the plan's limit) and **Use ChatGPT** (R2): the signed-out card's mechanism (`useReadyAlternative`, then `selectRuntimeModel`): this chat continues with that AI.
  - **Sign in to ChatGPT** (R3): the sheet's existing ChatGPT sign-in (`startCodexSignIn`).
- **The status line:** `presentActivityState` drops `errorFirstLine`. A failed turn says "Failed", and a turn with a card that has a way on (sign-in, model, limit) says nothing, extending today's rule for Claude's sign-in card (`failureSilencesStatusLine`).
- **`CodexView`'s red line** is replaced by the card or by the sentence, once.
- **Restored chats:** the projection carries `errorKind` (`conversationProjection.ts`), so a restored turn draws the same card.
- **Tests:** webview tests for each kind's card, the status line, and a restored turn.

## Workstream 3: The plan lines (R1)

- `welcomeCopy.ts`: `accountLine` splits into `chatgptLine` and `claudeLine`; `WelcomeParts.tsx:82` picks the line by provider. The update sheet's Add another uses the same cards.
- `RitemarkSettings.tsx`: Claude's and ChatGPT's signed-out text lead with the lines; the OpenCode section gains its line. The words come from one shared module, so the welcome and Settings can't drift: `webview/src/components/welcome/welcomeCopy.ts`, imported by Settings.
- `OnboardingWizard.tsx`: the same lines, if *Open Questions* 2 is yes.
- **Tests:** the webview's copy test (no "Codex", one line per provider).

## Workstream 4: The refusal (R2), after A1

- **Detection:** the structured code or matcher A1 records, as the classifier's `plan` kind for `claude-code`. If A1 shows the plan is readable at sign-in, `agent/setup.ts`'s status gains the plan, and the welcome and Settings show the refusal there (S14).
- **The card:** the `plan` kind's `TurnFailureCard`, laid out as experience 35 frame 6: no AI name above it, Use ChatGPT primary, See Claude's plans secondary with an arrow out, and the muted line.
- **Ask the same in a new chat with another AI** (shared with R5's Use <other AI>):
  - The host's `openLandingChat` grows into `openChatWith(runtimeId, { text, send })`, which opens a new chat bound to that AI. With `send`, it sends the text as the first message once the AI is ready; otherwise it leaves the text in the box.
  - If the AI isn't ready, it starts that AI's own sign-in, as the sheet's sign-in cards do, then sends. A cancelled or failed sign-in leaves the text unsent.
  - A message with attachments is never sent this way; its text fills the box (R2).
  - Sprint 138's ready request needs the same thing ("a button that sends at once, as a first message in a new chat"). Whichever sprint merges first builds it, and the other uses it (*Coordination*).
- **See Claude's plans:** `vscode.env.openExternal` to Claude's pricing page on `claude.com`, already trusted.
- **The status item:** `ai/connectivity.ts` gains a `plan` state set by the host when a `plan` turn ends. It shows "Claude needs a paid plan" with the dot, and clears when any AI's turn completes. Offline still wins over it while offline.
- **Home's card:** Sprint 138 reads the turn's outcome. A `plan` (or any failed) turn leaves Home's ready-request card in place (experience 35's rule).

## Workstream 5: A chat keeps its model (R6)

- **The record:** `composerPreferences.modelByRuntime?: Partial<Record<AgentId, string>>`, decoded leniently. An entry that isn't a string, or is longer than 256 characters, is dropped.
- **Writing it:**
  - at each accepted turn, in `acceptRuntimeTurn`, with the model the host resolved for that turn (Claude: `requestedModel`; ChatGPT and OpenCode: the message's `model`);
  - when the person picks a model in a saved chat: `conversation/set-composer-preference` gains an optional `modelId` beside `thinkingEffort`, both checked by `exactKeys`.

  Neither write moves `lastActivityAt` (as thinking effort, a draft control).
- **Reading it:**
  - `projectionToConversation` fills `selectedModel`, `codexSelectedModel` and `opencodeSelectedModel` from the record before it looks at the open chat;
  - the bootstrap reconciliation keeps a chat's own model when the catalog offers it, and falls back to the catalog default only when it doesn't. That is today's rule for Claude, now for all three.
- **The substitution line:** the host's Sprint 127 R6 check generalises from Claude's app-wide `ritemark.ai.selectedModel` to the chat's own saved model, for all three runtimes. It names the substitution once per conversation, before the turn runs. The app-wide pick stays as the starting model for a new chat (HARD RULE #1).
- **Native resume** follows by itself: the same model means a compatible continuation (`continuation.ts:102`).
- **Tests:** store and controller tests for both writes; a projection test for the restore; a reconciliation test for the fallback; the host's substitution test for ChatGPT and OpenCode.

## Workstream 6: The counts (R7, R8, R10)

- **`events.ts`:**
  - `agent_used: { agent: WelcomeProvider; source: 'chat' | 'flow'; outcome?: FirstReplyOutcome }` (`outcome` only if *Open Questions* 3 is yes);
  - `first_reply: { provider: WelcomeProvider; outcome: FirstReplyOutcome }`;
  - `voice_captured: { source: 'dictation' | 'transcribe'; input?: 'recorded' | 'file' }`;
  - `voice_note_edited: { source: 'dictation' | 'transcribe'; days_since_capture: number }`.

  `FirstReplyOutcome` maps W1's kinds plus `arrived`, `stopped` and `other`.
- **The chat:**
  - `agent_used` is sent in the `agent-execute` handler once the turn is accepted, never for a `conversationContinuation`;
  - `first_message_sent` moves to the same place, after the save (the adjacent fix);
  - when it is sent, the handler remembers that conversation and turn in memory, and the turn's terminal checkpoint (`onComplete`, `onCodexComplete`, `onExit`, cancel) sends `first_reply` with the outcome.
- **Flows:** `FlowExecutor` sends `agent_used` for the Claude step (`claude`) and the ChatGPT step (`chatgpt`), with `source: 'flow'`. The LLM step sends `feature_used: flow_llm_step`.
- **Voice:**
  - The dictation controller reports a dictation that ended with `producedText` to its editor, which sends `voice_captured` and adds the document to the voice list.
  - A Transcribe job that finishes with text sends `voice_captured` (`input` from the job's origin, recorded or file). Its document joins the list when written.
- **The voice list** (`analytics/voiceNotes.ts`, new, pure apart from storage):
  - globalState `ritemark.analytics.voiceNotes.v1`, at most 200 entries of `{ id: hash, day, source }`;
  - `hash` is SHA-256 of the document's URI with a random salt made once per profile and kept beside the list;
  - written only while the gate may send, and cleared when usage data turns off (through `setUsageData`).
- **Edited again:** `workspace.onDidSaveTextDocument`, for a document whose hash is in the list. If the day is later than the capture's and within 30 days, it sends `voice_note_edited` once and drops the entry. Entries older than 30 days are dropped at activation and on each save check.
- **Tests:** `analytics.test.ts` for each event through the gate; the first-reply pairing (sent once, for that turn only, nothing if the turn never ends); `voiceNotes.test.ts` (hashing, the 200 cap, expiry, clear on off, same day vs later day); and the Flow mapping.

## Workstream 7: The bets' insights and the privacy lines (R9, R10, R11)

- **Insights**, defined in the QA evidence and built in PostHog by whoever holds its access (the Development manager, with Jarmo's sign-in):
  - B1: per month, distinct ids with `agent_used` across two or more `agent` values, divided by distinct ids with `app_session_start`, with `build_channel = prod`;
  - B2: per week, distinct ids with `voice_captured`, divided by those with `app_session_start`; and the count of `voice_note_edited` per week.
- **Links:** the Strategy Room adds the insights' links to `strategy/bets.md` (`ritemark-dev`). It is their file.
- **Privacy lines:** spec R11's lines go to the Development manager for the Inbound Traffic manager, with S56's payload log as proof. The release checklist gains a row: "ritemark.app's privacy page carries 2.1's new counts before 2.1 publishes".

## Workstream 8: The three-runtime run, Windows, tests and docs (R12, E3–E6)

- **The run** (`scripts/qa/three-runtimes-check.mjs`, new, CDP):
  - one launch per AI on a fresh test profile, reused for every step, against the local PostHog stand-in;
  - S51–S53's steps; a forced failure through the bridge's hold-back where the provider can't be made to fail on demand (memory: webview bridge trace + hold-back);
  - screenshots and the stand-in's log into the QA evidence.
- **Windows:** S54 through the test overlay on the latest Windows build from main, before merge 1.
- **Unit tests** as W1–W6 list; `npm test` and the webview tests pass; `validate-qa.sh`.
- **Bundle:** `media/webview.js` measured before and after (`notes/bundle.md`).
- **Docs:** `architecture.md` (E5) and `docs/CHANGELOG.md`; the 2.1 release notes draft through the Development manager.

## Coordination

- **Sprint 138** (item 2, the ready request, #498): both need "ask in a new chat with an AI". Whichever merges first builds `openChatWith`; the other uses it. 138's Home card reads a turn's outcome to stay after a refusal (W4). 138's counts (ready request used, starting point used, made something) are its own, through the same gate, and its privacy lines join R11's PR.
- **The feedback door** (#466): it adds Send feedback to the status bar, beside the AI item this sprint changes. No shared code. Its "opened" count joins R11's PR.
- **The model catalog issues** (#529–#532), if they become their own sprint (*Open Questions* 1): R4's card names the catalog's default, whatever the lineup is; #531's message for a saved Flow on a retired Gemini model can reuse W1's classifier once merge 1 is in.
- **The release:** the R11 row in the release checklist; the Claude Free and ChatGPT Free accounts in `governance/test-keys.md` (`ritemark-dev`).

## Delivery plan: two merges

The refusal card waits on A1, which waits on an account only Jarmo can make. The rest doesn't, so the sprint merges twice:

1. **Merge 1:** W1, W2, W3, W5, W6, W7 and W8, with Mac QA (S1–S5, S16–S57 except S44's plan case) and the Windows overlay round. The `plan` kind exists in the classifier only once A1 has recorded it, so nothing in merge 1 guesses Claude's refusal.
2. **Merge 2:** W4 (the refusal), after A1. It runs S6–S15 and S44's plan case, and the screenshots go to the Experience lead before the merge (memory: match the Experience prototype exactly).

If A1 isn't done by the release's feature freeze, merge 2 moves to the next release (*Open Questions* 6).

## Risks inside the sprint

| Risk | Retirement |
|---|---|
| The reproduction replaces Jarmo's own Claude sign-in | A1 runs under a separate macOS user; nothing in Jarmo's user is signed in or out |
| No Claude Free account in time | Merge 2 is separate; R1 ships either way; *Open Questions* 6 decides the cut |
| Providers change their wording, so a matcher misses | Structured codes first; anchored matchers from seen errors; anything unmatched still shows its unwrapped sentence once, never JSON |
| An answer gets read as an error | Only a turn's terminal error is classified; S23 |
| A 2.1 chat is quarantined in 2.0.x | No new `failureKind`; new fields optional and lenient; A4 and S57 |
| A restored model the catalog dropped | Fallback to the default with the substitution line; S38 |
| Counting a turn twice (continuations, retries) | Counted at acceptance, never on a continuation; S42 |
| The voice "edited again" signal is noisy (autosave, an agent's writes, sync) | A later calendar day only, once per capture; confirmations.md records who saves; the limits are written beside the insight |
| The counts ship before the privacy page says so | The release checklist row (R11) |
| Sprint 138 and this sprint both build the new-chat path | *Coordination*: one builds, one uses |
| A billing page asks before opening | A3 decides: a trusted link domain (one shell-tier line), or words with no button |
| No OpenCode test key | *Open Questions* 7. Until the key is in the vault, S53 can't run and R12 isn't met; nobody types a key into a test window (`governance/test-keys.md`) |
