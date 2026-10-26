# Sprint 139 Spec — The AI you chose keeps working

## Purpose

The 2.1 shape's item 4 (`ritemark-dev`: `releases/v2.1.0/shape.md`, approved by Jarmo on 21 October 2026). A newcomer picks an AI on the welcome. Before they sign in, Ritemark says which plans work. When Claude refuses a free plan, Ritemark says so in its own words and offers a way on. When any AI fails, the person reads one sentence and sees one thing to do, not raw JSON twice. A chat keeps its model when the person comes back the next day. And Ritemark can finally count whether people reach a reply, and the two bets' measures.

## Principles

- **The drawings are the contract.** Experience 35, frame 6, draws the refusal card. Experience 2's step-1 cards were redrawn with the plan lines (`ritemark-dev`: `product/design/experience/experiences/firstday/` and `welcome/`). Where a drawing and this spec disagree, the drawing wins and this spec changes first.
- **Ritemark speaks for the plan, not the AI** (experience 35, decision 6). A refusal about the account comes from Ritemark in plain words, with the way on beside it.
- **People's names for things.** ChatGPT, Claude and OpenCode. Never Codex, never "authenticated" or "runtime", in anything a person reads.
- **One sentence, once, with one way on.** A failed turn says what happened and what to do. It never shows a JSON envelope or says the same thing twice.
- **No guessed words.** The refusal card's words are final only after a Claude Free account has been tried (the shape's §4; #496). Matchers are built from errors that have been seen, never from a guess.
- **The same for all three AIs.** Every piece works for Claude, ChatGPT and OpenCode alike. Where one AI has nothing to show (only Claude refuses a plan), the shared mechanism still serves the others.
- **Model ids live in `src/ai/modelConfig.ts`, model lists come from `src/ai/modelCatalog/`.** A card that names a fallback model asks the catalog for its default; nothing here hardcodes an id.
- **Inside 2.0's usage-data contract.** Nothing is sent before the welcome is left or with usage data off. No location, dev runs marked, and no text, file, path, project, model or account in any count.
- **Records stay readable both ways.** A chat saved by 2.1 opens in 2.0.x, and a chat saved by 2.0 opens in 2.1.

## Requirements

### R1: Which plans work, before sign-in (#496)

As someone choosing an AI on my first day, I want to know before I sign in whether my plan works in Ritemark.

Acceptance criteria:
- The welcome's step-1 cards say it on their own line, where "Sign in with the account you already use." is today, with no other notice:
  - ChatGPT: "Sign in with any plan, free included."
  - Claude: "Sign in with a paid plan, such as Pro or Max."
  - OpenCode: "Open models, with an API key of your own." (unchanged)
- The update welcome's Add another shows the same cards with the same lines.
- A card that shows a state shows that state instead, as today: Checking…, Signed in, or the reason a sign-in ended. The plan line belongs to a card that offers Sign in.
- Ritemark Settings says the same for each AI that is not set up. Settings is still 1.x's page in 2.1; the redesign of experience 15 is not in this sprint.
  - Claude's card leads with "Sign in with a paid plan, such as Pro or Max." and keeps its API-key choice.
  - ChatGPT's card leads with "Sign in with any plan, free included." and keeps "Paid plans get higher limits." (#482).
  - The OpenCode section says "Open models, with an API key of your own."
- If Jarmo agrees (*Open Questions* 2), the AI sheet's own sign-in cards say the same. Those are the ones someone who skipped the welcome meets.
- The word Codex appears nowhere.

### R2: When Claude refuses for the plan (#496; the shape's decision 6)

As someone on Claude's free plan, I want Ritemark to tell me plainly that my plan doesn't include working here, and what I can do instead.

Acceptance criteria:
- When Claude refuses a message because the account's plan doesn't include Claude Code, the chat shows Ritemark's card in place of an answer, with no AI name above it (experience 35, frame 6):
  - heading "Claude needs a paid plan here";
  - body "Your Claude plan doesn't include working in Ritemark. Pro or Max does, and ChatGPT works on any plan.";
  - Use ChatGPT (primary) and See Claude's plans (secondary, with an arrow out);
  - the muted line "It asks the same in a new chat with ChatGPT. This chat stays as it is."
- **These words are the drawn draft.** They become final only after audit A1 has tried a Claude Free account. If A1 shows different facts, this requirement changes first, under the Mid-Sprint Scope Change Protocol, and the Experience lead confirms the new words.
- **Use ChatGPT** opens a new chat with ChatGPT and sends the refused message's text in it. The refused chat stays as it is, with its card.
  - If ChatGPT isn't signed in, its own sign-in runs first, the same flow as the welcome's and the AI sheet's. The message is sent once ChatGPT is ready.
  - If that sign-in is cancelled or fails, the new chat stays open with the text in its message box, unsent.
  - If the refused message had attachments, the new chat's message box is filled instead of sent, so nothing goes without them.
- **See Claude's plans** opens Claude's pricing page in the browser, with no question first (`claude.com` is already a trusted link domain in `product.json`).
- **The status bar's AI item** reads "Claude needs a paid plan" with an amber dot, until a message goes through with any AI. Clicking it opens the AI's sheet.
- **A refusal at sign-in.** If A1 shows the refusal comes at sign-in, or that the plan can be read at sign-in, the welcome's and Settings' Claude cards say the body sentence there, with the same two buttons, instead of moving on as if Claude were ready.
- The card survives a restart: a restored chat shows the same card (E2).
- A ready request on Home (Sprint 138) that Claude refuses this way leaves its Home card in place.
- Only the refusal A1 records is matched. Any other Claude failure is R3's, and never shows this card.

### R3: One sentence, once, with one way on (#376)

As someone whose message failed, I want to read what happened in one sentence and know what to do next, whichever AI I use.

Acceptance criteria:
- Every failed turn, from Claude, ChatGPT or OpenCode, shows one sentence saying what happened. Where there is one, it offers one way on.
- A provider's JSON envelope is unwrapped to the human sentence inside it. The same unwrapped sentence goes everywhere the error shows: the transcript, the conversation record, comment tasks and task cards.
- Known kinds get their own words and action:

  | Kind | Example | Way on |
  |---|---|---|
  | The sign-in ended, or a key was refused | "Your ChatGPT sign-in has ended. Sign in again, then send your message again." | Sign in to ChatGPT (Claude keeps today's card; a refused key opens Settings' key) |
  | The plan doesn't include the AI | R2 | R2 |
  | A limit, a quota or credits ran out | R5 | R5 |
  | The AI refused the model | R4 | R4 |
  | No connection | "Ritemark couldn't reach ChatGPT. Check your connection, then send your message again." | none |
  | Anything else from the provider | the provider's own sentence, unwrapped | none |

  The words in this table are proposals. The Development manager or the Experience lead confirms them before merge 1 (*Tasks*, Phase 1).
- **The status line.** Under a failed turn, it says only "Failed" for every AI, Claude included, because the sentence is right above it. Under a card (sign-in, plan, model, limit), it says nothing, as it already does under Claude's sign-in card.
- The provider's raw text stays in the turn's activity details and in Report AI issue, for diagnosis. It never appears in the main line.
- A restored chat shows the same sentence and card after a restart.
- Only a turn's terminal error is classified. An answer that merely talks about an error is never turned into one.

### R4: A model the AI refuses (#376)

As someone whose AI refused the model I picked, I want to switch to one that works with one click.

Acceptance criteria:
- When ChatGPT, OpenCode or Claude refuses the chosen model, the turn shows a card in place of the red line. This covers both Codex wordings seen so far ("…model is not supported when using Codex with…", "…model requires a newer version of Codex…"), Claude's Sprint 127 R6 wordings, and the model-not-found errors that OpenCode passes on from a provider:
  - title "ChatGPT couldn't use GPT-6.1 Sol" (the AI's name, and the model's label from the catalog);
  - message "It isn't available in Ritemark right now. Switch to GPT-5.6 Sol, then send your message again.";
  - a button, Use GPT-5.6 Sol, with the tooltip "Switch this chat to GPT-5.6 Sol. You'll need to send your message again."
- The button switches this chat's model to the catalog's default for that AI (`modelCatalog.getDefault`). It does not resend.
- When there is no default, or the default is the model that failed, there is no button, and the message ends "Choose another model in the model menu below."
- After the switch, the card reads "Switched to GPT-5.6 Sol — send your message again when you're ready."
- The words don't mention the account. In the case #376 was found in, the same sign-in ran that model in OpenAI's own app.

### R5: Limits, quotas and credits (#376, Jarmo's comment of 24 October)

As someone whose AI stopped because a limit ran out, I want to know whose limit it is and where to fix it.

Acceptance criteria:
- When an AI stops because a limit is reached, the turn says who stopped it and why, in one sentence, naming the provider. That covers a plan's usage limit (ChatGPT, Claude), an API key's quota, and prepaid credits that ran out (Google, OpenAI, Anthropic or OpenRouter, through OpenCode or Claude with a key). For example: "Google stopped this request: your Gemini API credits have run out."
- A key's quota or credits offers one way on: that provider's billing page, opened in the browser, with a button that names it (for example "Open Google AI Studio").
- A plan's usage limit says when it resets, when the AI says so ("You've used ChatGPT's limit for now. It resets at 14:30."). If another AI is ready, it offers it ("Use Claude"), which asks the same in a new chat with it, as R2's Use ChatGPT does. Otherwise there is no button.
- A billing page opens with no question first, or the card says where to go in words (audit A3 decides).

### R6: A chat keeps its model after a restart (#417)

As someone coming back on another day, I want my chat to carry on with the model it was using.

Acceptance criteria:
- Each chat remembers, for each AI it has used, the model it last ran or the person last chose in it. This holds after a restart, after a window reload, and when the chat is opened from the Conversations list. It holds for Claude, ChatGPT and OpenCode alike.
- A new chat starts as today: the last pick for that AI, or the catalog's default.
- When a saved model is no longer offered, the chat falls back to the catalog's default. It says so once, before the next turn runs: "X isn't available right now — using Y." (Sprint 127 R6's line, now for all three.)
- When the model is unchanged, a chat sent again after a restart continues the AI's own thread. No "Previous messages were included as context." line appears for that reason.
- A chat saved by 2.0 has no saved model. It behaves as today, then remembers from its next turn or pick.

### R7: Count each AI turn (#479)

As the people building Ritemark, we want to know whether people work with an agent, and with which one, without learning anything else.

Acceptance criteria:
- One anonymous event, `agent_used`, each time a person's turn runs with an AI:
  - `agent`: `claude`, `chatgpt` or `opencode`;
  - `source`: `chat` or `flow`. A comment task, a task card's Give to…, and Home's ready request run as chat turns, so they count as `chat`. A Flow's Claude step and ChatGPT step count as `flow`.
- Nothing else is carried: no model, no text, no word count, no file, no project. A continuation of the same turn (after an approval or a plan review) is not a new turn.
- A Flow's LLM step is a provider API call, not an agent. It moves from `agent_used` to `feature_used` with `feature: 'flow_llm_step'`. No `agent_used` has arrived since the data begins (30 March 2026), so no history breaks.
- Everything goes through 2.0's one consent gate (`analytics/consent.ts`).

### R8: The first reply's outcome (#479, the shape's §6)

As the people reading the welcome's path, we want it to end at a reply, so we can tell "no first message" from "a first message that failed".

Acceptance criteria:
- Once per profile, for the turn that `first_message_sent` counted, one event `first_reply` is sent when that turn ends:
  - `provider`: `claude`, `chatgpt` or `opencode`;
  - `outcome`: `arrived`, `sign_in`, `plan`, `limit`, `model`, `network`, `provider_error`, `stopped` or `other`.
- No text, no error message, no model.
- The outcome is R3's kind, from the same classifier.
- A turn that never ends (the window closed first) sends nothing. The data reads that as no reply.
- `first_message_sent` is counted once the message is saved, not before. Today it is counted at the top of the handler, so a message that failed to save, and was never sent, can still be counted (an adjacent fix).
- If Jarmo agrees (*Open Questions* 3), every `agent_used` also carries its turn's `outcome`.

### R9: Agents per user in a month (#473, the bet "Any agent, your memory")

As Jarmo, I want to read the bet's measure from the data, so its review on 1 March 2027 has months of counts.

Acceptance criteria:
- A PostHog insight shows, per calendar month, the share of active users who used two or more agent families. Active users are distinct ids with `app_session_start`; the agent families come from R7's `agent_used`.
- It is linked from `strategy/bets.md` in `ritemark-dev`, beside the bet's stop rule: fewer than 1 in 10 by March 2027.
- The insight's definition is written in this sprint's QA evidence, so anyone can rebuild it.

### R10: Voice captures that become drafts (#473, the bet "Speaking is thinking")

As Jarmo, I want to see whether spoken notes grow into documents, so the bet's review on 1 February 2027 has its counts.

Acceptance criteria:
- `voice_captured` is sent once per dictation that put text into a document, and once per Transcribe recording or file that became text:
  - `source`: `dictation` or `transcribe`;
  - for Transcribe only, `input`: `recorded` (recorded in Ritemark) or `file` (an audio file brought in).
- `voice_note_edited` is sent once per capture, when the document holding it is saved with a change on a later calendar day than the capture, within 30 days. It carries `source` and `days_since_capture` (whole days, 1 to 30).
- Ritemark remembers which documents to watch only on this computer. Each is kept as a salted hash, a code that can't be turned back into a name or a path, with the capture's day and source. Each is forgotten after 30 days or once its event is sent.
- Nothing is remembered while usage data is off, and turning usage data off clears the list.
- Two PostHog insights: the weekly share of active users with `voice_captured`, and `voice_note_edited` per week. Both are linked from `strategy/bets.md`.
- No text, audio, file name, path, language or length is carried.

### R11: The privacy page says what's counted

As someone who reads ritemark.app's privacy page, I want it to say exactly what 2.1 counts.

Acceptance criteria:
- The lines below go to the Inbound Traffic manager through the Development manager. They become a `ritemark-web` PR that merges with 2.1, beside the lines for 2.1's other new counts (Sprint 138's ready request and the feedback door's "opened" count). They are written for the page:
  1. "When you send a message to an AI in Ritemark, or a Flow runs an AI step, we count it with which AI it was (Claude, ChatGPT or OpenCode) and whether it came from a chat or a Flow. Never the message, the answer, the model, the file or the project."
  2. "For your first message, we count whether an answer came back, or which kind of problem stopped it: a sign-in that ended, a plan that doesn't include the AI, a limit reached, a model the AI refused, no connection, or another error from the AI's company. Never the error's text." (If Jarmo agrees to *Open Questions* 3: "For each message…")
  3. "When dictation or Transcribe turns your voice into text, we count that it happened, and whether the recording was made in Ritemark or brought in as a file. Never the words or the audio."
  4. "When a document that began with your voice is changed again on a later day, we count that, with how many days later. To know which documents these are, Ritemark keeps a code on your computer that can't be turned back into a name, and forgets it after 30 days. The name and the text never leave your computer."
  5. The rules that hold for all of them, as today: nothing before the welcome is finished, nothing with usage data off, no location, and test runs marked.
- 2.1 is not published with these counts before the page says so. This is a row in the release's checklist.

### R12: The same for Claude, ChatGPT and OpenCode

As someone who uses any of the three, I want every piece of this to work for my AI.

Acceptance criteria:
- R1 to R10 work the same for the three AIs, except where an AI has nothing to show. Only Claude has a plan refusal (R2). ChatGPT's and Claude's plan limits and OpenCode's credits are R5's.
- One run per AI on a dev instance proves it (S51–S53): a first message and its reply, the events at a local PostHog stand-in, a model kept over a restart, and a forced error shown as one sentence with its way on.
- The same run, on Windows, through the test overlay on a Windows build from main (S54).

## Engineering requirements

### E1: One classifier

- `src/runtime/runtimeErrorPresentation.ts` turns every runtime failure into a kind and a sentence. It is pure, with no `vscode` import, and uses a runtime's structured error code where it gives one (Claude's SDK `error` category; Codex's error info, if A2 finds it) before any text match.
- Its users: the transcript for all three runtimes, the conversation record, comment tasks and task cards, the status line, and the counts (R8). There is no second copy. `safeFailureMessage()` and `describeAcpTurnError()` delegate to it.
- **No new `failureKind`.** That field is decoded strictly (`'authentication' | 'api-key-authentication'`) by every 2.x build, so a new value would quarantine the chat in 2.0.x. The new kind travels in a new optional field, `errorKind`, decoded leniently.

### E2: Version skew

- A record written by 2.1, with `errorKind` and `composerPreferences.modelByRuntime`, opens in 2.0.1 without quarantine. A record written back by 2.0.1 then opens in 2.1.
- 2.0.x ignores the new fields. 2.1 drops a value it doesn't know, rather than failing the record (as Sprint 134's `readAt`).
- Nothing compares a re-encoded record with the stored one (#417's question; audit A4).

### E3: Tests

- Extension unit tests:
  - the classifier, with A2's corpus as fixtures: each kind for each runtime, envelopes unwrapped, ordinary text untouched, nothing classified from an answer;
  - the record's decoding (lenient `errorKind` and `modelByRuntime`, unknown values dropped);
  - the controller saving the model at an accepted turn and on a pick;
  - the events and the gate (`agent_used`, `first_reply` pairing, `voice_captured`, the voice list hashed, expiring and cleared);
  - the Flow step mapping.
- Webview tests: the card per kind, the status line ("Failed" only), the projection's restored model, and the plan lines with no "Codex".
- A CDP check per runtime for S51–S53, driven against a local PostHog stand-in.

### E4: The bundle (#107)

- `media/webview.js` is measured before and after. This sprint adds no dependency.

### E5: Docs

- `architecture.md`:
  - *Recoverable runtime failures* gains the classifier for all three runtimes and `errorKind`;
  - *Durable Agent Conversations* gains `composerPreferences.modelByRuntime`;
  - *The welcome and usage data* gains the new events and the voice list;
  - a version-history row.
- The privacy lines (R11) and the bets' insight definitions (R9, R10) are in the QA evidence.

### E6: Windows

- Before merge 1, the extension side is tried on the latest Windows build from main, through the test overlay: R1, R3, R6, and R12's run (S54).

## Non-Requirements

- **A real Resend for a failed turn.** It would be the better ending for R4's card, and belongs on the prompt queue's frozen payload (#376 says so).
- **The model catalog issues #529, #530, #531 and #532.** Recommended as a sprint of their own (*Open Questions* 1).
- **The Settings redesign** (experience 15). The plan lines go into today's Settings page.
- **The ready request and the starting points** (Sprint 138, #498), and **Send feedback** (#466). This sprint only coordinates with them (technical plan, *Coordination*).
- **Carrying attachments** into Use ChatGPT's new chat. A message with attachments fills the new chat's box instead (R2).
- **Telling a ChatGPT plan apart before the first message.** Every ChatGPT plan works (OpenAI's help centre; #482).
- **Codex's model source** (#377) and **Claude Code currency.** The latter is the release's runtime review, as every release.
- **Any PostHog dashboard** beyond R9's and R10's insights.

## Resolved Questions

- **2026-10-21 (Jarmo, the shape approved "with recommendations"):** item 4 is in 2.1; the plan lines' words; the refusal card offers ChatGPT (decision 6); #479 also counts the first reply's outcome; the privacy lines go to `ritemark-web` as a PR merged with 2.1.
- **2026-10-21 (the Experience lead, experience 35 frame 6 and #496's comment):** the refusal card's heading, body, buttons and muted line; the status bar's "Claude needs a paid plan" with an amber dot until a message goes through; Use ChatGPT signs in first if needed; the words are final only after the Claude Free reproduction.
- **2026-10-24 (Jarmo, "jah, lisa gemini-4-argon ja OpenCode #376 alla"):** #376 covers OpenCode too. Provider billing and quota errors are recognised by name.
- **2026-10-26 (Jarmo, decision log):** 2.1's four sprint plans (137–140) start as documents. Strategy Room step 4 waits. That leaves the two bets of 13 October as they are, and #473 measures them.
- **Engineering, in this plan:**
  - no new `failureKind`; the new optional `errorKind` instead (E1, E2);
  - the model is saved at each accepted turn and when the person picks one, beside thinking effort (R6);
  - the agent families are named as the welcome's events name them (`claude`, `chatgpt`, `opencode`);
  - a Flow's LLM step is `feature_used`, not `agent_used` (R7);
  - the voice list keeps salted hashes only (R10);
  - #376's suggested card title said "Codex couldn't use…"; it says "ChatGPT couldn't use…", by the rule of people's names.

## Open Questions

All are for Jarmo, each with a recommendation. The sprint plan repeats them under *Decisions for Jarmo*.

1. **The model catalog issues (#529–#532): in this sprint, or their own?** Recommended: their own sprint. They share no code with this one, they wait on a Google test project and an old-app resolution check, and #530's feed publish belongs to the release's runtime review.
2. **The AI sheet's own sign-in cards:** do they carry the plan lines too? Recommended: yes. It is the third place a person picks an AI before signing in, and it is text only.
3. **Every turn's outcome, not only the first reply's?** Recommended: yes. Item 4 is also about "when you come back", which the first reply can't show. It is the same closed list of kinds on an event this sprint already adds, with no text.
4. **#376's open triage points:** one sentence and one way on for every runtime; the model card switches the model and doesn't resend; the status line says only "Failed" for Claude too. Recommended: yes to all three, as the issue proposes.
5. **The test accounts:** a Claude Free account for A1, and a ChatGPT Free one to confirm "free included" and see its usage limit. Only Jarmo can create these. Recommended: both, signed in under a separate macOS user on the Mac, so his own Claude and ChatGPT sign-ins are never replaced. Then the registry (`governance/test-keys.md`) lists them.
6. **If A1 isn't done when the release's features freeze:** recommended: the plan lines (R1) ship, and the refusal card (R2) waits for the next release rather than ship with guessed words.
7. **An OpenCode test key** for R12's OpenCode run. Recommended: the Google AI Studio test project the registry already asks for (row 2), with a small prepaid balance. The catalog sprint needs it too.
