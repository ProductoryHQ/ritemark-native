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
| Welcome, step 1 (S1) | Every card keeps its line, signed in or not (the Experience lead's words, 26 October): ChatGPT "Any plan works, free included." with Continue · Signed in, Claude "Needs a paid plan, such as Pro or Max." with Sign in, OpenCode "Open models, with an API key of your own." with Set up. No "Codex" anywhere. |
| Finish the welcome with ChatGPT, Open a folder… | Home of the project; usage data on (the welcome's default) |
| First message | Reply arrived; stand-in: `first_message_sent {provider: chatgpt}`, `agent_used {agent: chatgpt, source: chat, outcome: arrived}`, `first_reply {provider: chatgpt, outcome: arrived}` (S43) |
| Pick GPT-6-Luna, send | Reply arrived; the record holds `modelByRuntime: { codex: gpt-6-luna }` |
| New chat, pick GPT-5.4 Mini, send | ChatGPT refused it for real: `{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The 'gpt-5.4-mini' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}}`. The turn showed one card, "ChatGPT couldn't use GPT-5.4 Mini" / "It isn't available in Ritemark right now. Switch to GPT-6.1 Sol, then send your message again." / **Use GPT-6.1 Sol**; nothing on the status line; no JSON in the chat; the raw envelope in the turn's activity row, labelled "What ChatGPT said" (S17, S24, S25). `agent_used … outcome: model` |
| Use GPT-6.1 Sol | The model button switched to GPT-6.1 Sol, nothing was sent, and the card read "Now using GPT-6.1 Sol" with the green check and "Send your message again when you're ready.", with no button (S25). The pick saved to the chat (`modelByRuntime: { codex: gpt-6.1-sol }`) |
| ⌘Q, second launch | The refused chat shows the same card, "Now using GPT-6.1 Sol", with no button and nothing on the status line (S21). Found and fixed in the first run: it offered Use GPT-6.1 Sol again although the chat had switched (`a22e2c2c`). |
| Open the first chat from the rail / All conversations, while the other is open | Its own model, GPT-6-Luna, not the open chat's (S33, S36, S37) |
| Send in it | `continuation-state: native-restored`; ChatGPT remembered its earlier one-word answer; no new "Previous messages were included as context." (S33). The one such line in that chat is from before the restart, when the model changed from GPT-6.1 Sol to GPT-6-Luna, which starts a new ChatGPT thread by design |

The scripted run (`scripts/qa/three-runtimes-check.mjs --ai chatgpt --default-model "GPT-6.1 Sol" --other-model GPT-6-Luna --refused-model "GPT-5.4 Mini"`) repeats the steps on the final code, on a fresh profile, with two hidden launches: **all twelve checks pass** (26 October, after the Experience lead's words and QA's fixes, at `9e27873e`):
1. S1: every step-1 card keeps its plan line, with Signed in, Sign in or Set up beside it; no "Codex".
2. S43: the first message, with `first_message_sent`, `agent_used` and `first_reply`.
3. S33: a message on GPT-6-Luna.
4. S25: a refused model shows one card, and nothing on the status line.
5. The activity row with the raw envelope reads "What ChatGPT said".
6. S25: Use GPT-6.1 Sol switches without resending; the card says "Now using GPT-6.1 Sol" with the check, no button, no em dash.
7. S40: the refused turn is counted with `outcome: model`.
8. S33/S36: after the restart, the first chat comes back on GPT-6-Luna.
9. S33: its next message is `native-restored`.
10. S36: the refused chat, after the restart, still says "Now using GPT-6.1 Sol", with no button and nothing on the status line.
11. S4: Settings' Claude card leads with "Needs a paid plan, such as Pro or Max." and OpenCode's section with its line (ChatGPT is signed in, so its signed-out line isn't drawn).
12. S56: nothing beyond the listed properties.

The run before it, on the same words, failed two of its own checks: the raw-words row read "1 action completed · What ChatGPT said" (the label now follows the Experience lead's rule: a row that opens the provider's raw text says whose words they are), and the script's way into Settings (F1, Enter) didn't open the palette over CDP (it now uses ⌘⇧P and clicks the palette row).

Seen in every run, not changed here: the chat's header says "Interrupted" after a failed or stopped turn (`conversationStatusLabel`, lifecycle `interrupted` with reason `failed` or `cancelled`, as in 2.0). Beside "Now using GPT-6.1 Sol" or a Stopped status line it reads as a third word for the same turn. A question for the Experience lead.

Getting the harness there took five runs. The earlier failures were the harness's own:
- it read the chat's title before the AI had named it;
- it typed before the window had reloaded into the project;
- once, the dev tree's "Ritemark 2.0.1 is available" notice sat under a click. The click opened VS Code's "Do you want Ritemark Dev to open the external website?" question for the installer link. It was cancelled and nothing was downloaded. The question itself is A3's finding, seen live.

In one run, the project's chat opened on Claude after the welcome was finished with ChatGPT. That is not root-caused: the update notice was in the corner in that run too. The script now turns the update notice off in its profile, and it picks the AI itself if the chat opens on another one.

Screenshots (not in the repository; on this Mac under `/private/tmp/claude-501/r139-evidence-3/`, for the Development manager and the Experience lead): the welcome's cards, the model card with "What ChatGPT said", the "Now using" card, the restored card, the first chat after the restart, and Settings' Claude card (the script captures only that card, so the ChatGPT card's account e-mail is never in it). The first run's Claude signed-out card with its tooltip is under `/private/tmp/claude-501/r139/`.

### What the stand-in received (S56)

Every new event, with its own properties (each event also carries `product_area`, `app_version`, `build_channel: test`, `$geoip_disable: true`, `$process_person_profile: false`):

```
app_session_start   {version, platform}
welcome_shown       {kind: fresh}
project_opened      {source: existing_folder, has_ai: true}
first_message_sent  {provider: chatgpt}
agent_used          {agent: chatgpt, source: chat, outcome: arrived}   ×5 by hand, ×3 in the script's run
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
| S3 a card with a state | Live: a signed-in card keeps its line, with Signed in in its button row. An ended ChatGPT sign-in's reason: not run (would need signing out) |
| S4 Settings | Live (scripted): Claude's card leads with "Needs a paid plan, such as Pro or Max." and keeps its API key; OpenCode's section has its line. ChatGPT's signed-out text: not run (ChatGPT is signed in); it reads "Any plan works, free included. No API key is needed. Paid plans get higher limits." |
| S5 the AI sheet's sign-in cards | Not run: they show only with no AI ready, and ChatGPT is signed in. The text change is two lines in `OnboardingWizard.tsx` |
| S6–S15 the refusal card | Not built: no Claude Free reproduction (A1) |
| S16 other Claude failures never show a plan card | There is no plan card; Claude's other failures take R3/R4's cards (unit) |
| S17 a Codex envelope | Live |
| S18 Claude's status line | Unit (`activityState.test.ts`: "Failed" only); live Claude turns not run |
| S19 ChatGPT's sign-in ended | Unit (code `unauthorized` and Codex's own words → "ChatGPT needs you to sign in again" / "Your sign-in has ended. Sign in, then send your message again." / Sign in to ChatGPT); not run live |
| S20 no connection | Unit (the card "Ritemark couldn't reach ChatGPT" / "Check your connection, then send your message again."); not run live (turning the network off would affect this Mac's other work) |
| S21 a restored failed turn | Live |
| S22 comment tasks and task cards | Unit (`safeFailureMessage` unwraps through the classifier; the host passes the sentence); not run live |
| S23 an answer about an error | By construction (only a terminal error is classified) and unit (prose untouched) |
| A stopped turn after a restart (Sprint 140's QA: ChatGPT's read "Failed") | Unit (`activityState.test.ts`, `conversationProjection.test.ts`): Stopped for all three AIs, live and restored; a real failure still Failed |
| S24 the raw text for diagnosis | Live, in the turn's activity row "What ChatGPT said". Not after a restart: activity details aren't saved in 2.0 either |
| Anything else, and an AI that stopped mid-turn | Unit: "<AI> couldn't finish this request" with the provider's sentence once, then "Send your message again."; "<AI> stopped unexpectedly"; an envelope cut short never becomes the sentence (QA) |
| A stopped Claude follow-up (QA) | By code: `_claudeLiveHooks` reads the Stop before posting, and the sheet's `stopped` mapping is unit-tested (`activityState.test.ts`); not run live (Claude isn't signed in) |
| #552: ChatGPT's working note and answer | Unit (`conversationRouting.test.ts`, `CodexRuntime.test.ts` Test 6b): a new message starts a new paragraph, in the sheet and the record |
| S25 ChatGPT refuses the model | Live |
| S26 the default is the model that failed | Unit |
| S27 Claude refuses the model | Unit |
| S28 OpenCode's provider doesn't have the model | Unit (no button: OpenCode has no catalog default) |
| S29 Google credits through OpenCode | Unit, from Jarmo's seen text; the card names Google AI Studio in words (A3) |
| S30 an OpenAI key's quota | Unit |
| S31, S32 a plan's usage limit | Unit (no reset time is invented; without one, "Try again later."). Continue with <AI> when another AI is ready, through the signed-out card's own mechanism; not run live (no limit to reach, and no second AI signed in) |
| S33 ChatGPT keeps its model | Live |
| S34 Claude, S35 OpenCode | Not run live (see above); the restore and fallback are one mechanism for all three (unit) |
| S36 the Conversations list | Live |
| S37 a pick without a send | Live (the card's switch, saved without a send, came back after the restart) |
| S38 a model no longer offered | Unit (`reconcileRestoredModels`, `reconciledOpenCodeModel`, which the bootstrap now uses for OpenCode too (QA), `modelSubstitution.test.ts`) |
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
- `media/webview.js`: 8,611,995 → 8,624,481 bytes (`notes/bundle.md`).
- QA's review of `a5b28da3` (26 October): every finding fixed in this PR, with tests where code changed (`turnCounts`, `voiceNotes`, `runtimeErrorPresentation`, `conversationProjection`); the script's profile guard needs five path parts.

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
5. The rules that hold for all of them, as today: nothing before the welcome is finished, nothing with usage data off, no location.

**2.1 must not publish with these counts before the page says so** (a row for the release checklist).
