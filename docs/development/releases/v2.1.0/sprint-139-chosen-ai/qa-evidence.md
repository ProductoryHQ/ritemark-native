# Sprint 139 QA evidence (merge 1)

26 October 2026, on `sprint-139-chosen-ai`, Mac (darwin-arm64), dev instance of this branch: VS Code 1.142 at the pin, bundled Codex 0.163.0, Claude Code 2.1.304, OpenCode 1.19.3.

**How it ran.** Hidden launches (`open -n -g -j`), a short throwaway profile under `/private/tmp/claude-501/`, `--use-mock-keychain`, `--shared-data-dir`, CDP on 9234, `RITEMARK_BUILD_CHANNEL=test`, usage data sent only to a local PostHog stand-in (`RITEMARK_POSTHOG_PROJECT_KEY` set to a dummy, `RITEMARK_POSTHOG_HOST` to 127.0.0.1). HOME unchanged; nothing signed in or out; `~/Library/Application Support/Ritemark`, `~/.ritemark-shared`, `~/.codex` and `~/.config/opencode` not touched by hand. Each instance was quit with ⌘Q.

**What the three AIs could do on this Mac:**
- **ChatGPT:** Jarmo's own sign-in. Run in full, by hand and then by `scripts/qa/three-runtimes-check.mjs`. The test folder was one Codex already trusts (`/private/tmp/ritemark-s116-rundev-workspace`), so Codex had no reason to add it to `~/.codex/config.toml`; each ChatGPT turn writes Codex's own session record under `~/.codex/sessions`, as every Codex client does.
- **Claude:** **in-app turns not run.** Claude Code isn't signed in on this Mac (`loggedIn: false`), and nobody signs in for Jarmo. Claude's signed-out paths were checked: the welcome's and Settings' plan lines, and the AI sheet's signed-out card with its tooltips.
- **OpenCode:** **in-app turns not run.** The bundled OpenCode has no keyless provider and doesn't find the local Ollama model by itself, the picker and send gate need one of the four cloud keys, and no test key exists (Jarmo: "Mitte praegu"). No placeholder key, no redirected provider. OpenCode's error paths are covered by unit fixtures.
- **Windows (S54): not run** in this session (no Windows PC here; the Windows test overlay is a separate round).

## The ChatGPT run (S52)

| Step | Result |
|---|---|
| Welcome, step 1 (S1) | ChatGPT "Continue · Signed in" (a state, so no plan line), Claude "Sign in with a paid plan, such as Pro or Max.", OpenCode "Open models, with an API key of your own." No "Codex" anywhere. While the checks run, every card shows its plan line beside Checking… (R1: the line belongs to a card that offers Sign in). |
| Finish the welcome with ChatGPT, Open a folder… | Home of the project; usage data on (the welcome's default) |
| First message | Reply arrived; stand-in: `first_message_sent {provider: chatgpt}`, `agent_used {agent: chatgpt, source: chat, outcome: arrived}`, `first_reply {provider: chatgpt, outcome: arrived}` (S43) |
| Pick GPT-6-Luna, send | Reply arrived; the record holds `modelByRuntime: { codex: gpt-6-luna }` |
| New chat, pick GPT-5.4 Mini, send | ChatGPT refused it for real: `{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.4-mini' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}`. The turn showed one card, "ChatGPT couldn't use GPT-5.4 Mini" / "It isn't available in Ritemark right now. Switch to GPT-6.1 Sol, then send your message again." / **Use GPT-6.1 Sol**; nothing on the status line; no JSON in the chat; the raw envelope in the turn's activity details (S17, S24, S25). `agent_used … outcome: model` |
| Use GPT-6.1 Sol | The model button switched to GPT-6.1 Sol, nothing was sent, the card read "Switched to GPT-6.1 Sol — send your message again when you're ready." (S25); the pick saved to the chat (`modelByRuntime: { codex: gpt-6.1-sol }`) |
| ⌘Q, second launch | The refused chat shows the same card (S21). Found and fixed here: it offered Use GPT-6.1 Sol again although the chat had switched; it now says "Switched…" (`a22e2c2c`). |
| Open the first chat from the rail / All conversations, while the other is open | Its own model, GPT-6-Luna, not the open chat's (S33, S36, S37) |
| Send in it | `continuation-state: native-restored`; ChatGPT remembered its earlier one-word answer; no new "Previous messages were included as context." (S33). The one such line in that chat is from before the restart, when the model changed from GPT-6.1 Sol to GPT-6-Luna, which starts a new ChatGPT thread by design |

The scripted run (`scripts/qa/three-runtimes-check.mjs --ai chatgpt --default-model "GPT-6.1 Sol" --other-model GPT-6-Luna --refused-model "GPT-5.4 Mini"`) repeats the steps on the final code, on a fresh profile, with two hidden launches: **all nine checks pass** (S1, S43, S33 on GPT-6-Luna, S25 card, S25 switch without resend, `outcome: model`, S33/S36 after the restart, `native-restored`, S56).

Getting the harness there took five runs. The earlier failures were the harness's own:
- it read the chat's title before the AI had named it;
- it typed before the window had reloaded into the project;
- once, the dev tree's "Ritemark 2.0.1 is available" notice sat under a click. The click opened VS Code's "Do you want Ritemark Dev to open the external website?" question for the installer link. It was cancelled and nothing was downloaded. The question itself is A3's finding, seen live.

In one run, the project's chat opened on Claude after the welcome was finished with ChatGPT. That is not root-caused: the update notice was in the corner in that run too. The script now turns the update notice off in its profile, and it picks the AI itself if the chat opens on another one.

Screenshots (not in the repository; sent with the PR to the Development manager and the Experience lead): the welcome's cards, the model card, the switched card, the restored card, the Claude signed-out card with its tooltip, Settings' Claude card (cropped: the ChatGPT card below it shows the account's e-mail).

### What the stand-in received (S56)

Every new event, with its own properties (each event also carries `product_area`, `app_version`, `build_channel: test`, `$geoip_disable: true`, `$process_person_profile: false`):

```
app_session_start   {version, platform}
welcome_shown       {kind: fresh}
project_opened      {source: existing_folder, has_ai: true}
first_message_sent  {provider: chatgpt}
agent_used          {agent: chatgpt, source: chat, outcome: arrived}   ×5
first_reply         {provider: chatgpt, outcome: arrived}
agent_used          {agent: chatgpt, source: chat, outcome: model}
```

Nothing outside R11's lines. No text, model, file, path, project or account.

## Every scenario

**Live** = seen in the run above. **Unit** = covered by a unit test in `npm test`. **Not run** says why.

| Scenario | Result |
|---|---|
| S1 the step-1 cards | Live |
| S2 Add another | Not run (no update-welcome profile); Add another draws the same `ProviderCard`, so the same lines |
| S3 a card with a state | Live for Signed in. An ended ChatGPT sign-in's reason: not run (would need signing out) |
| S4 Settings | Live: Claude's card leads with its plan line and keeps its API key; OpenCode's section has its line. ChatGPT's signed-out text: not run (ChatGPT is signed in); it reads "Sign in with any plan, free included. No API key is needed. Paid plans get higher limits." |
| S5 the AI sheet's sign-in cards | Not run: they show only with no AI ready, and ChatGPT is signed in. The text change is two lines in `OnboardingWizard.tsx` |
| S6–S15 the refusal card | Not built: no Claude Free reproduction (A1) |
| S16 other Claude failures never show a plan card | There is no plan card; Claude's other failures take R3/R4's cards (unit) |
| S17 a Codex envelope | Live |
| S18 Claude's status line | Unit (`activityState.test.ts`: "Failed" only); live Claude turns not run |
| S19 ChatGPT's sign-in ended | Unit (code `unauthorized` and Codex's own words → the card with Sign in to ChatGPT); not run live |
| S20 no connection | Unit; not run live (turning the network off would affect this Mac's other work) |
| S21 a restored failed turn | Live |
| S22 comment tasks and task cards | Unit (`safeFailureMessage` unwraps through the classifier; the host passes the sentence); not run live |
| S23 an answer about an error | By construction (only a terminal error is classified) and unit (prose untouched) |
| A stopped turn after a restart (Sprint 140's QA: ChatGPT's read "Failed") | Unit (`activityState.test.ts`, `conversationProjection.test.ts`): Stopped for all three AIs, live and restored; a real failure still Failed |
| S24 the raw text for diagnosis | Live, in the turn's activity details. Not after a restart: activity details aren't saved in 2.0 either |
| S25 ChatGPT refuses the model | Live |
| S26 the default is the model that failed | Unit |
| S27 Claude refuses the model | Unit |
| S28 OpenCode's provider doesn't have the model | Unit (no button: OpenCode has no catalog default) |
| S29 Google credits through OpenCode | Unit, from Jarmo's seen text; the card names Google AI Studio in words (A3) |
| S30 an OpenAI key's quota | Unit |
| S31, S32 a plan's usage limit | Unit (no reset time is invented). Use Claude waits for Sprint 140's new-chat path |
| S33 ChatGPT keeps its model | Live |
| S34 Claude, S35 OpenCode | Not run live (see above); the restore and fallback are one mechanism for all three (unit) |
| S36 the Conversations list | Live |
| S37 a pick without a send | Live (the card's switch, saved without a send, came back after the restart) |
| S38 a model no longer offered | Unit (`reconcileRestoredModels`, `modelSubstitution.test.ts`) |
| S39 a chat saved by 2.0 | Unit (projection with no saved model) |
| S40 chat turns | Live for ChatGPT; unit for the families |
| S41 Flow steps | Unit (`flowTurnCounts.test.ts`) |
| S42 a continuation | Unit |
| S43 the first reply | Live |
| S44 the first reply is an error | Unit (`sign_in`, `model`, …); live first replies arrived |
| S45 no reply | Unit |
| S46 a message that failed to save | Unit and by construction (counted only after the save) |
| S47 usage data off, dev runs | Unit (nothing sent, no marker, no voice list); this run's events carry `build_channel: test` (the run's `RITEMARK_BUILD_CHANNEL`) |
| S48–S50 voice | Unit (`voiceNotes.test.ts`, the dictation controller's `onCaptured`); not run live (no microphone in an automated run) |
| S51 Claude, S53 OpenCode | Not run (see above) |
| S52 ChatGPT | Live |
| S54 Windows | Not run |
| S55 the insights | Not built: the Development manager builds them in PostHog (definitions below) |
| S56 the payloads | Live |
| S57 2.1 and 2.0.1 on the same chats | Code level, with 2.0.1's own store (`research/record-skew-audit.md`): no quarantine either way; a 2.0.1 write-back loses the saved model and the cards' kinds, never the sentences |

## Unit and build

- `npm test` in `extensions/ritemark`: passes (new: `turnCounts`, `voiceNotes`, `modelSubstitution`, `flowTurnCounts`, `welcomeCopy`; extended: `runtimeErrorPresentation` with A2's corpus, conversation `types`, `ConversationController`, `conversationProjection`, `activityState`, `analytics`, the dictation controller, `AgentRunner`).
- `tsc` for the extension and the webview: clean. The pre-commit validator passes on every commit.
- `media/webview.js`: 8,611,995 → 8,622,913 bytes (`notes/bundle.md`).

## The bets' insights (R9, R10)

Built in PostHog by the Development manager, filtered to `build_channel = prod`, and linked from `strategy/bets.md` by the Strategy Room. Events carry `$process_person_profile: false`, so the distinct id is the anonymous id.

**B1, "Any agent, your memory": per calendar month, the share of active users who used two or more agent families.** Stop rule beside it: fewer than 1 in 10 by March 2027.

```sql
WITH active AS (
  SELECT toStartOfMonth(timestamp) AS month, distinct_id
  FROM events
  WHERE event = 'app_session_start' AND properties.build_channel = 'prod'
  GROUP BY month, distinct_id
),
families AS (
  SELECT toStartOfMonth(timestamp) AS month, distinct_id, uniq(properties.agent) AS agents
  FROM events
  WHERE event = 'agent_used' AND properties.build_channel = 'prod'
  GROUP BY month, distinct_id
)
SELECT active.month AS month,
       countIf(families.agents >= 2) / count() AS share_two_or_more
FROM active
LEFT JOIN families ON families.month = active.month AND families.distinct_id = active.distinct_id
GROUP BY month
ORDER BY month
```

`agent_used` counts from 2.1 on: the months before 2.1 read as zero, not as a fall.

**B2, "Speaking is thinking":**
- per week, distinct ids with `voice_captured` divided by distinct ids with `app_session_start` (both `prod`);
- per week, the count of `voice_note_edited`, broken down by `source`.

Limits to write beside B2: "edited again" counts a captured document saved with a change on a later local day within 30 days, once; the change can be the person's, an agent's through the open editor, or a change on disk taken into an open document; a transcript counts only once it is saved as a document; a recording made before a restart and transcribed after it counts as a file.

## The privacy page's lines (R11)

For the Inbound Traffic manager's `ritemark-web` PR, merged with 2.1, beside Sprint 140's and the feedback door's lines. With Jarmo's decision 3 (every turn's outcome), line 2 says "each message":

1. "When you send a message to an AI in Ritemark, or a Flow runs an AI step, we count it with which AI it was (Claude, ChatGPT or OpenCode) and whether it came from a chat or a Flow. Never the message, the answer, the model, the file or the project."
2. "For each message, we count whether an answer came back, whether you stopped it, or which kind of problem stopped it: a sign-in that ended, a plan that doesn't include the AI, a limit reached, a model the AI refused, no connection, or another error from the AI's company. Never the error's text."

   (The plan's line 2 lacked "whether you stopped it"; the outcome `stopped` is sent, so the page must say so. A plan refusal isn't sent until the refusal card lands, and listing it now is harmless.)
3. "When dictation or Transcribe turns your voice into text, we count that it happened, and whether the recording was made in Ritemark or brought in as a file. Never the words or the audio."
4. "When a document that began with your voice is changed again on a later day, we count that, with how many days later. To know which documents these are, Ritemark keeps a code on your computer that can't be turned back into a name, and forgets it after 30 days. The name and the text never leave your computer."
5. The rules that hold for all of them, as today: nothing before the welcome is finished, nothing with usage data off, no location, and test runs marked.

**2.1 must not publish with these counts before the page says so** (a row for the release checklist).
