# Sprint 139: The AI you chose keeps working

Track: SDD (auto-detected: five linked issues and 12 user-facing requirements across the webview, the host, three runtimes, conversation records and usage data; one requirement's words wait on a reproduction)
Override with: "use plain full track"
Branch: `sprint-139-chosen-ai`, made from `origin/main` at Phase 3, after approval. This plan was written on `plan/sprint-139-chosen-ai`.
Release tier: extension. Every change is under `extensions/ritemark/`, and it ships in 2.1.0's shell release (the shape's decision 1). If audit A3 puts billing hosts into `branding/product.json`, or the drawn amber dot needs a patch-018 style, this line changes to shell before that is built.
Status: **Approved (Phase 2 → 3), 26 October 2026,** by the Development manager under Jarmo's delegation. The sprint branch is created before the first code edit. **Merge 1 built** on `sprint-139-chosen-ai` (26 October): W1–W3, W5–W8; evidence in [qa-evidence.md](qa-evidence.md). Merge 2 (W4, the refusal card) waits for audit A1. The tier line stays extension (A3 put no host in `branding/product.json`; no patch changed).

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R12 and E1–E6.
- [scenarios.md](scenarios.md): S1–S57, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the four audits, workstreams W1–W8, two merges.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The release is 2.1.0. Its shape is in `ritemark-dev`: `releases/v2.1.0/shape.md`, item 4, approved by Jarmo on 21 October with all eight recommendations. The drawings are the Experience lead's experience 35, frame 6 (the refusal card), and experience 2's step-1 cards redrawn with the plan lines (`product/design/experience/experiences/firstday/` and `welcome/`).

## Goal

A newcomer knows before signing in which plans work. Someone on Claude's free plan gets Ritemark's own plain card and a way on, not an error. Any AI's failure reads as one sentence with one thing to do. A chat comes back the next day on the model it was using. And Ritemark counts, inside 2.0's usage-data contract, whether people reach a reply and the two bets' measures.

## Linked Issues

- [#496](https://github.com/ProductoryHQ/ritemark-native/issues/496): which plans work, before sign-in and when Claude refuses (R1, R2).
- [#376](https://github.com/ProductoryHQ/ritemark-native/issues/376): agent errors shown raw, twice, for Codex and OpenCode (R3–R5).
- [#417](https://github.com/ProductoryHQ/ritemark-native/issues/417): a chat's model isn't saved across restarts (R6).
- [#479](https://github.com/ProductoryHQ/ritemark-native/issues/479): count AI chat use, and the first reply's outcome (R7, R8).
- [#473](https://github.com/ProductoryHQ/ritemark-native/issues/473): measure the two bets (R9, R10).
- Recommended for their own sprint (*Decisions for Jarmo* 1): [#529](https://github.com/ProductoryHQ/ritemark-native/issues/529), [#530](https://github.com/ProductoryHQ/ritemark-native/issues/530), [#531](https://github.com/ProductoryHQ/ritemark-native/issues/531), [#532](https://github.com/ProductoryHQ/ritemark-native/issues/532).

## MVP Scope

| Area | Requirements |
|---|---|
| Plan lines on the welcome's step-1 cards, Add another and Settings (and the AI sheet's sign-in cards, if agreed) | R1 |
| The refusal card for Claude Free: Use ChatGPT, See Claude's plans, the status bar; its words after the reproduction | R2 |
| One sentence, once, with one way on, for all three AIs; "Failed" alone on the status line | R3 |
| A refused model: Use <default>, no resend | R4 |
| Limits, quotas and credits: the provider named, its billing page or the reset time | R5 |
| A chat's model kept over restarts, reloads and the Conversations list | R6 |
| `agent_used` from the chat and Flows, by agent family | R7 |
| `first_reply` and its outcome | R8 |
| The bets' measures: agents per user in a month; voice captures and notes edited again | R9, R10 |
| The privacy page's lines, for `ritemark-web` | R11 |
| The same for Claude, ChatGPT and OpenCode; one run per AI | R12 |
| One classifier, records readable by 2.0.x, tests, the bundle, docs, Windows | E1–E6 |

**Not in this sprint:**
- the model catalog issues #529–#532 (recommended as their own sprint, below);
- a real Resend for a failed turn (#376 puts it on the prompt queue's frozen payload);
- the Settings redesign (experience 15). The plan lines go into today's page;
- the ready request and the starting points (Sprint 138), and Send feedback (#466);
- Codex's model source (#377), and the release's runtime review.

## The model catalog issues: a sprint of their own

I recommend moving #529, #530, #531 and #532 into one sprint of their own, "2.1's model lineup", rather than this one.

- **They touch nothing this sprint touches.** Their code is `ai/modelConfig.ts`, `ai/modelCatalog/` (the bundled catalog, the resolver and OpenCode's discovery), the export script, and the feed in `ritemark-public`. This sprint's code is the AI sheet, the conversation records, the runtimes' error paths and usage data. Apart, the two can run side by side and merge without conflicts.
- **They wait on different things.**
  - #531's proof needs a Google key from a new account: the registry's Google test project, which doesn't exist yet.
  - #530 needs the new feed resolved by 1.12, 1.13, 1.14, 2.0.1 and 2.1 before it is published. 1.12.0's resolver already drops a feed default whose row is gated by `minAppVersion`, which points to how #530 can set defaults per app version. That is a lead, not a result, until the check runs.
  - #530's publish is a cross-repo step, timed with 2.1's bundled lineup. That makes it part of the release's runtime review, as every release.
- **This sprint is already the release's longest.** It has five issues, three runtimes, a reproduction that only Jarmo can unblock, and two merges. A sixth domain would make it slower to finish.
- **#529 is real feature work.** It needs OpenCode's live lists from four providers, filtered to what the bundled OpenCode can run. It is the one with a rabbit hole, and the first to cut if 2.1's appetite runs out. #532, #531 and #530 are small.
- **The only links are reads.** R4's card names the catalog's default, whatever the lineup is. #531's message for a saved Flow on a retired Gemini model can reuse this sprint's classifier once merge 1 is in.

If Jarmo prefers them here, they become W9 and merge with merge 1, and R13–R16 join the spec under the scope-change protocol.

## Every AI the same, and the three-runtime run

Each piece works for Claude, ChatGPT and OpenCode alike (R12), except where an AI has nothing to show:
- only Claude refuses a plan (R2);
- ChatGPT's and Claude's plan limits and OpenCode's credits are R5's.

The cards, the status line, the saved model and the counts are one mechanism for all three.

**The test:** one run per AI, scripted over CDP on a dev instance (`scripts/qa/three-runtimes-check.mjs`, S51–S53). Each run is one launch on a fresh test profile, reused for every step, against a local PostHog stand-in. Each one:
1. finishes the welcome with that AI, seeing its plan line;
2. sends a first message and sees the reply, with `first_message_sent`, `agent_used` and `first_reply` logged;
3. picks a model other than the default, sends, restarts Ritemark, and sees the chat come back on that model and continue the AI's own thread;
4. forces a failure and sees one sentence, or the card, once, with its way on.

The same run then goes to the Windows PC through the test overlay (S54).

Claude and ChatGPT use Jarmo's own sign-ins on the Mac. OpenCode needs a test key (*Decisions for Jarmo* 7).

## Analytics and privacy

- **Four new events, all through 2.0's one gate:**
  - `agent_used` (`agent`, `source`);
  - `first_reply` (`provider`, `outcome`);
  - `voice_captured` (`source`, and `input` for Transcribe);
  - `voice_note_edited` (`source`, `days_since_capture`).

  None carries text, a model, a file, a path, a project or an account. Nothing is sent before the welcome is left or with usage data off. GeoIP is off, and dev runs are marked.
- **`agent_used` changes meaning.** It counts every turn a person runs with an agent, from the chat or a Flow, named `claude`, `chatgpt` or `opencode`. A Flow's LLM step, which is an API call, becomes `feature_used`. No `agent_used` has arrived since 30 March, so no history breaks.
- **`first_message_sent` moves** to after the message is saved, so a message that was never sent isn't counted (an adjacent fix, R8).
- **The voice list** that tells "edited again" stays on the computer: salted hashes, at most 200, each forgotten after 30 days. Nothing is kept with usage data off, and turning usage data off clears it.
- **The privacy page:** spec R11 lists the exact lines for ritemark.app. They go through the Development manager to the Inbound Traffic manager, as a `ritemark-web` PR that merges with 2.1, beside Sprint 138's and the feedback door's lines. 2.1 doesn't publish with these counts before the page says so (a release checklist row).
- **The bets' insights** (R9, R10) are defined in the QA evidence and built in PostHog by the Development manager. The Strategy Room links them from `strategy/bets.md`. Strategy Room step 4 waits (Jarmo, 26 October), which leaves the two bets of 13 October as they are, so #473 measures them as written.

## Windows

- **Before merge 1:** the extension side through the test overlay on the latest Windows build from main: R1, R3, R6 and the three-runtime run (S54). ChatGPT's sign-in on the Windows PC has expired (`governance/test-keys.md`), so it needs Jarmo's sign-in once.
- **After the merges:** nothing shell-tier changes, so there is no extra Windows build. 2.1's release builds carry it.

## Product Decisions

- **2026-10-21 (Jarmo, the shape approved "with recommendations"):** item 4 is in 2.1; the three plan lines' words; the refusal card offers ChatGPT (decision 6); #479 counts the first reply's outcome; the privacy lines go to `ritemark-web` as a PR merged with 2.1.
- **2026-10-21 (the Experience lead):** experience 35, frame 6: the card's heading, body, buttons and muted line. The status bar reads "Claude needs a paid plan" with an amber dot until a message goes through. Use ChatGPT signs in first if needed. The words are final only after the Claude Free reproduction.
- **2026-10-24 (Jarmo):** #376 covers OpenCode too; provider billing and quota errors are recognised by name ("jah, lisa gemini-4-argon ja OpenCode #376 alla").
- **2026-10-26 (Jarmo, decision log):** 2.1's four sprint plans (137–140) start as documents. Strategy Room step 4 waits.
- **2026-10-26 (engineering, in this plan):**
  - one classifier for all three runtimes, structured codes first;
  - no new `failureKind`; the new optional `errorKind`, decoded leniently, so 2.0.x never quarantines a 2.1 chat;
  - the model saved at each accepted turn and on a pick, beside thinking effort;
  - the agent families named as the welcome's events name them;
  - a Flow's LLM step counted as a feature;
  - the voice list kept as salted hashes;
  - #376's card says "ChatGPT couldn't use…", never "Codex";
  - two merges, so the refusal card waits only on its reproduction.

## Decisions for Jarmo

Seven, each with a recommendation. [spec.md](spec.md#open-questions) carries the same list.

1. **The model catalog issues (#529–#532): in this sprint, or their own?** I recommend their own sprint, for the reasons above: no shared code, different blockers (a Google test project, the old-app check), and #530's feed publish belongs to the release's runtime review.
2. **The AI sheet's own sign-in cards** (for someone who skipped the welcome): should they carry the plan lines too? I recommend yes. It is the third place a person picks an AI before signing in, and it is text only.
3. **Count every turn's outcome, not only the first reply's?** I recommend yes. Item 4 is also "when you come back", and a failure on day two is invisible if only the first reply is counted. It is the same closed list of kinds, with no text, on an event this sprint already adds. The privacy line then says "for each message".
4. **#376's open triage points:**
   - one sentence and one way on for every runtime;
   - the model card switches the model and doesn't resend;
   - the status line says only "Failed", for Claude too.

   I recommend yes to all three, as the issue proposes.
5. **Two test accounts, which only you can create:** a Claude Free account for the reproduction (A1), and a ChatGPT Free one to confirm "free included" and see its usage limit. I recommend both, signed in under a separate macOS user on your Mac. Signing a test account in your own user would replace your own Claude and ChatGPT sign-ins. The registry (`governance/test-keys.md`) then lists them.
6. **If the reproduction isn't done when 2.1's features freeze:** I recommend that the plan lines (R1) ship, and the refusal card (R2) waits for the next release rather than ship with guessed words.
7. **An OpenCode test key for the three-runtime run:** I recommend the Google AI Studio test project the registry already asks for (row 2), with a small prepaid balance. The catalog sprint needs it too, for #531's proof.

## Feature Flag Check

No feature flag. R1–R6 fix and finish what 2.0 shows, and they are on for everyone. The counts sit behind the existing `analytics` kill switch and the usage-data answer. HARD RULE #1 holds:
- Claude's sign-in cards stay;
- the app-wide Claude pick stays as the starting model for a new chat;
- the raw provider text moves to the activity details and Report AI issue, not away.

## Success Criteria

- [ ] The welcome's step-1 cards, Add another and Settings say which plans work, with no "Codex" (R1).
- [ ] A Claude Free account's first message shows Ritemark's card; Use ChatGPT asks the same in a new chat with ChatGPT; See Claude's plans opens the pricing page; the status bar says it until a message goes through. The words are confirmed by A1 (R2).
- [ ] No failed turn from any of the three AIs shows JSON or the same text twice; each shows one sentence and, where there is one, one way on; the status line says "Failed" or nothing (R3–R5).
- [ ] A chat on any of the three AIs comes back after a restart on its model and continues its own thread (R6).
- [ ] `agent_used`, `first_reply`, `voice_captured` and `voice_note_edited` arrive with only their listed properties, and nothing arrives with usage data off (R7, R8, R10).
- [ ] The bets' insights exist and are linked from `strategy/bets.md` (R9, R10).
- [ ] The privacy page's lines are in a `ritemark-web` PR set to merge with 2.1 (R11).
- [ ] The three-runtime run passes for Claude, ChatGPT and OpenCode on the Mac, and on Windows through the overlay (R12).
- [ ] A chat written by this build opens in 2.0.1 without quarantine, and back (E2).

## Risks

| Risk | Retirement |
|---|---|
| The reproduction replaces Jarmo's own Claude sign-in | A1 runs under a separate macOS user |
| No Claude Free account in time | Two merges; R1 ships either way; *Decisions for Jarmo* 6 |
| Providers change their wording | Structured codes first, matchers only from seen errors; anything unmatched still shows one unwrapped sentence |
| A 2.1 chat quarantined in 2.0.x | No new `failureKind`; new fields optional and lenient; A4, S57 |
| The counts ship before the privacy page says so | A release checklist row (R11) |
| Sprints 138 and 139 both build "ask in a new chat" | One builds, the other uses it (technical plan, *Coordination*) |
| A billing page asks before it opens | A3: a trusted link domain, or words with no button |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **The v2.1.0 release plan** on `main` (`docs/development/releases/v2.1.0/release-plan.md`), which the Development manager writes from the shape. sprint-manager needs it before Phase 3.
- **Jarmo's test accounts and key** (*Decisions for Jarmo* 5 and 7).
- **The Experience lead:** R3–R5's words confirmed (or decided by the Development manager as small wording), R2's words after A1, and the screenshots before each merge.
- **Sprint 138**, for the shared new-chat path and the Home card's rule after a refusal.
- **The Inbound Traffic manager**, for the privacy page's PR in `ritemark-web`.
- **The Strategy Room**, for the insights' links in `strategy/bets.md`.

## Pre-Implementation Gate

- This plan is reviewed, and Jarmo's approval gates Phase 0. A Development manager message is not that approval (`ritemark-dev` CLAUDE.md, rule 7).
- Phase 1's audits come before any code beyond the starting tree. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" and "ja muud asjad ka sh worktreede kustutamine" (ritemark-dev `decisions/log.md`, 26 October). Until 2.1's Gate 1 RC, the manager's word counts for plan approval, sprint start and admin merge of 2.1 work. Release approval (Gate 1, Gate 2, publish) stays Jarmo's.

**The plan's questions, decided:**
1. **The model catalog issues #529–#532** become a sprint of their own: Sprint 141, "2.1's model lineup". It is planned separately.
2. **The AI sheet's own sign-in cards** carry the plan lines too.
3. **Every turn's outcome is counted,** not only the first reply's. There is no text and no new kind of data.
4. **#376's three triage points:**
   - one sentence and one way on, for every AI;
   - the model card switches the model without resending;
   - the status line says only "Failed", for Claude too.
5. **Test accounts:** Jarmo said "Mitte praegu" to test keys and accounts (26 October). So there is no Claude Free reproduction now, and nobody may create macOS users or change system settings for it.
6. **The plan lines ship. The refusal card's final words** wait for the reproduction, so the card lands only once it is done, in 2.1 if it comes in time and otherwise in the next release. Its words are never guessed.
7. **OpenCode's test run** uses what needs no new key: a keyless provider if the bundled OpenCode offers one, or the local Ollama model on this Mac (installed for the local-model test, 26 October). Say plainly what couldn't be run.

**A shared path:** Sprint 140 builds the host's "open a visible chat with this request in this AI" path, because the ready request needs it. The refusal card's Use ChatGPT reuses it. Where the plan says "Sprint 138" for the ready request, read Sprint 140.

**Privacy:** the counts must not ship before ritemark-web's privacy page lists them. The manager sends the plan's lines to the Inbound Traffic manager.

