# Sprint 140: The first day ends with something made, and a door to tell us

Track: SDD (16 user-facing requirements across Home, the AI's sheet, the agent tools and a shell dialog; a spike that decides two of them)
Override with: "use plain full track"
Branch: `sprint-140-first-day`, created from `origin/main` after Jarmo approves this plan. The plan itself is on `plan/sprint-140-first-day`.
Release tier: shell (patch 015 for Help ▸ Send feedback, patch 018 for the sheet over the window). Merge 1 is extension-tier only.
Status: **Approved (Phase 2 → 3), 26 October 2026,** by the Development manager under Jarmo's delegation. The sprint branch is created before the first code edit.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R16 and E1–E6, the drawn-but-not-changed table, and the open questions.
- [scenarios.md](scenarios.md): S1–S72, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, the spike and its decision rule, the audits, workstreams W1–W11, two merges, risks.
- [tasks.md](tasks.md): the implementation checklist by phase.
- This file: intent, decisions, status.

The release is 2.1.0, a cross-repo release. Its shape is `ritemark-dev`'s `releases/v2.1.0/shape.md`, items 2 and 5, approved by Jarmo on 21 October 2026 with all eight recommendations; this repo has no `docs/development/releases/v2.1.0/release-plan.md` yet, and this plan does not write one (the Development manager's release plan follows the shape). The designs are the Experience lead's experience 35 (`product/design/experience/experiences/firstday/`, commit 02b9d50), experience 34 (`experiences/feedback/`, 2a60b62) and experience 29 (`experiences/empty/`).

## Goal

A newcomer's first day in a project ends with something made: Home offers one ready request that fits the project, sent with the AI they chose; the AI's empty sheet offers a few things to ask about what is open; each empty place says what it is for. And anyone can tell us what they think: Send feedback in the status bar and in Help, one sheet, their own e-mail app when they want an answer or report an AI issue, and one question on Home once per release. It works the same with Claude, ChatGPT and OpenCode, and three counts tell whether it helps people come back.

## Linked Issues

- [#497](https://github.com/ProductoryHQ/ritemark-native/issues/497): the spike, first: can ChatGPT and OpenCode (and Claude, per Jarmo's 21 October comment) read a folder of Word files? (R1)
- [#498](https://github.com/ProductoryHQ/ritemark-native/issues/498): experience 35: the ready request on Home, Home's order, the starting points; experience 29's empty places (R2–R9, R15)
- [#466](https://github.com/ProductoryHQ/ritemark-native/issues/466): experience 34: the feedback door (R10–R14)
- Watched: [#496](https://github.com/ProductoryHQ/ritemark-native/issues/496) (which plans work, Claude's refusal card) and [#479](https://github.com/ProductoryHQ/ritemark-native/issues/479) / [#473](https://github.com/ProductoryHQ/ritemark-native/issues/473) (AI chat counts), built by item 4's sprint; [#107](https://github.com/ProductoryHQ/ritemark-native/issues/107) (the bundle), measured.

## MVP Scope

| Area | Requirements | Tier |
|---|---|---|
| The Word spike, and what each AI can read: Ritemark's Markdown of a Word file as one tool, or "read what you can and say what you skipped" | R1 | extension |
| Home's order: Waiting for you, then one guidance card (What moved, the ready request, the feedback card) | R2 | extension |
| The ready request card, its three kinds and words, the counts line | R3 | extension |
| Ask with: the AI on the card, Sign in and Set up through the welcome's flows | R4 | extension |
| What it does: send in a new chat in front, fill the box, or run the sample's card | R5 | extension |
| When it shows and goes: met first, answered, a chat of one's own, its ×; no timer | R6 | extension |
| The answer's two offers as cards, if the spike's part B passes | R7 | extension |
| The AI's empty sheet: at most three starting points by what is open, the same for every AI | R8 | extension |
| Empty places: Tasks, the chats, Transcribe | R9 | extension |
| Send feedback: the status bar, Help, AI information, All commands | R10 | shell (Help: 015) |
| One sheet, two routes: straight from Ritemark, or the person's e-mail app | R11 | shell (018) |
| Report an AI issue, with the last answer when ticked | R12 | shell (018) |
| After pressing: sent, handed to e-mail, or not gone, honestly | R13 | shell (018) |
| The feedback card on Home, once per release | R14 | extension |
| Day-one counts and the door's count | R15 | extension |
| Nothing lost | R16 | both |
| The same for every AI; nothing in the folder; tests; bundles; builds; docs and the Store | E1–E6 | |

**Not in this sprint:**
- which plans work and Claude's refusal card (#496, experience 35 frame 6), and counting AI chat turns and the first reply's outcome (#479, #473): item 4's sprint;
- a microphone in the message box (with #411, if wanted);
- renaming 2.0's surfaces ("All conversations", the AI status item, command names): the post-2.0 redraws are out of 2.1;
- anything the drawings show that 2.0 already draws differently, among them the composer, which the drawing kit shows as designed, not as 2.0 shipped it. Spec, *What the drawings show that 2.0 draws differently*, lists each; this sprint plans against 2.0's shipped composer.

## The spike first (#497)

The spike runs before the ready request and the Word-or-PDF starting points are built. On the installed 2.0.1, on the Mac and on Windows, each AI gets the drawn first look on a fictional folder of 20 Word documents and 10 PDFs, each with a planted fact only reading it gives. **An AI passes a kind of file** when, in at least 5 of 6 runs in Auto, it reads every one of the newest files of that kind, with no approval asked, no error and no stall.

- **All three pass:** nothing more is built for that kind; the request stays as drawn.
- **Any fails Word documents:** Ritemark's own Markdown of a Word file (the Make an editable copy conversion, moved to the host) is tried as one tool given to all three AIs. If the failing AI then passes, that tool is built, for all three.
- **Still failing, or failing PDFs:** PDFs join the tool only if the host PDF converter fixes it within 3 MB of bundle; whatever is left gets "read what you can open and say what you skipped" in the sent request, and the card's note promises no more than the weakest AI does. A Word-or-PDF starting point is offered only for a kind every AI can read.

Part B of the same runs checks whether all three AIs reliably offer two next steps through a Ritemark tool, which frame 2's offer cards need. The full protocol is in [technical-plan.md](technical-plan.md), *Phase 1*.

## Every AI the same

Each piece is tried with Claude, ChatGPT and OpenCode (scenarios marked "each AI"). The card's words change only the AI's name. The sample runs through the board's own Give, which already serves all three. The starting points replace Claude's and OpenCode's three examples and give ChatGPT's empty chat the same set; ChatGPT's compatibility notice stays. A Word tool, if built, is defined once in Ritemark's tool registry (locked decision, Sprint 130). No runtime-specific path beyond the one place each runtime already sends a turn.

## Analytics and privacy

- **Four new events** inside 2.0's usage-data contract (nothing before the welcome is left, nothing with usage data off, no location, `build_channel`): `ready_request_used` (which kind, which AI), `starting_point_used` (which kind of place, edited or not, which AI), `made_something` (a new document, an export or a publish, and whether a ready request came first in the session) and `feedback_opened` (from which door). None carries words, names, paths, file counts or addresses (R15).
- **The 7-day return** of people who used a ready request against those who did not is read in PostHog from these events, aiming at twice the rate (the shape, §6). The insight is drafted with the User lead before merge 1.
- **Feedback** goes as 2.0's `feedback_sent`, the person's own send, with usage data off too. The Home card's send adds `asked: 'made_this_week'` (D11).
- **Guidance writes nothing in the person's folder.** Its state is on this computer (E2).
- **Privacy page:** one line per new event and property, to the Development manager for `ritemark-web`, merged with 2.1.

## Windows

- **Before merge 1:** the extension side through the test overlay on the latest Windows build from main (S71).
- **After merge 2:** a Windows build from main for the door, the sheet and Help (S72).
- The spike runs on Windows too, through the Development manager's Windows session.

## Tests and the production build

- Unit tests for every pure rule: the guidance order, the ready request's kind and lifetime, the counts line, the saved days, the starting place and points, the sheet's route and words, the report with the last answer, the events; the Word tool and the offers if built.
- VS Code unit tests for the sheet (018) and Help (015).
- CDP checks and screenshots beside experience 35's and 34's frames, Light and Dark.
- After merge 2: a production build from a clean-room worktree at the merged commit, every patch applied on the pin and a second run clean, the stacking check, and a Windows build from main.

## Product Decisions

- **2026-10-19 (Jarmo):** "We should plan it for 2.1 release" and "Send feedback in status bar in very bottom" (#466).
- **2026-10-21 (Jarmo, the shape):** items 2 and 5 with all eight recommendations: one shell release; feedback and AI reports to info@productory.eu; no tours, coach marks or tips; nothing runtime-specific; the Word spike before the first look is promised.
- **2026-10-21 (the Experience lead, experience 35 and #498's comment):** the empty project's start is typed (no microphone in 2.0's box); What moved moves under Waiting for you; a refused or failed request leaves the card on Home.
- **2026-09-15 (Jarmo):** a report may carry the output the person reviewed.
- **2026-10-15 (Jarmo):** nothing asks the AI to make tasks in a chat.
- **2026-10-26 (engineering, in this plan):**
  - the ready request's sample is the project holding the sample's card `m4d7r2`, which every copy since 2.0 has;
  - guidance state lives in one global-state key; nothing is written in the project's folder;
  - the sheet is drawn by the workbench through VS Code's dialog (`renderBody`), with its words passed from the extension, so they can change without an app release;
  - All commands' "Send Feedback" keeps its command id, so patch 003's palette policy does not change;
  - the status bar's door sits at priority 97, immediately left of the bell;
  - two merges: the first day's guidance first (extension only), then the door (shell).

## Decisions for Jarmo

Each has a recommendation; approving the plan accepts them unless Jarmo says otherwise.

1. **Shell pieces in 2.1 (J1).** The sheet over the whole window, as drawn, needs a small workbench dialog in patch 018, and Help ▸ Send feedback needs patch 015. **Recommended: yes.** 2.1 is a shell release anyway. Without it, the sheet would sit inside the AI column, not as drawn.
2. **The four reactions (J2).** All commands' "Send Feedback" today asks for a reaction (love it, good, okay, needs work), then optional words. **Recommended: it opens the new sheet, and the four reactions retire**, as experience 34 decides (only a message: reactions without words told us little). It is a change to an existing feature, so it needs your word.
3. **The answer's offer cards (J3).** Frame 2 shows the AI's two offers as cards. That needs a new Ritemark tool all three AIs call, which the shape did not name. **Recommended: test it in the spike, build it only if all three AIs pass**; otherwise the offers stay in the answer's words and the Experience lead redraws frame 2.
4. **Tasks' empty place (J4).** Experience 29's Tasks frame first lists "Ask Claude for something that changes documents: it becomes a task.", which 2.0 does not do and your 15 October rule rules out, and its README leaves it out. The shape also says "a sentence" where the drawings have a little more. **Recommended: build experience 29's frames without that line**, with Transcribe's words from the Experience lead. Empty places stay the first cut after #408 if time runs short.
5. **The spike's rule.** Approving this plan approves the decision rule above, including adding Ritemark's own Word reading as one agent tool (Mammoth in the extension host; its minified browser build is about 0.6 MB, and the host bundle is measured before and after) if an AI needs it, and PDFs only within a 3 MB bound.

The design questions (D1–D11 in [spec.md](spec.md#open-questions)) go to the Experience lead through the Development manager, who may answer them.

## Feature Flag Check

No new feature flag. 2.1 ships as one release from main, as 2.0 did, and every piece is on by default (HARD RULE #2). The existing `analytics` kill switch already stops the new events and the feedback sends. The Word tool, if built, can be gated by a kill-switch flag in one line if Jarmo wants one; this plan does not add it.

## Success Criteria

- [ ] The spike's decision is recorded per kind of file, and the first look reads the newest documents with every AI, or says plainly what it skipped (R1).
- [ ] Home draws Waiting for you first and at most one guidance card under it, in the drawn order (R2).
- [ ] A new project's Home shows the card of its kind, as drawn, with the counts line; a 1.x project never does (R3, R6).
- [ ] The card's AI can be chosen, signed in or set up from Ask with (R4).
- [ ] Each kind's button does what is drawn, with each AI (R5).
- [ ] The card goes when answered, when a chat is started, or on its ×, and stays when refused or failed (R6).
- [ ] The offers are cards with every AI, or recorded as not built with frame 2 redrawn (R7).
- [ ] The empty chat offers at most three starting points by what is open, the same for every AI, and a click only fills the box (R8).
- [ ] Tasks, the chats and Transcribe say what they are for when empty (R9).
- [ ] Send feedback is in the status bar before the bell and in Help; AI information's Report an AI issue opens the same sheet (R10).
- [ ] The sheet's two routes work as drawn, Ritemark says sent only when it sent, and the e-mail route never claims delivery (R11–R13).
- [ ] The feedback card shows once per release from the third saved day (R14).
- [ ] The four events arrive after a yes with exactly their properties, and none before (R15).
- [ ] Every row of R16's table works from its 2.1 home (R16).
- [ ] Nothing in a project's folder is written by the guidance (E2).
- [ ] A clean-room production build after merge 2 succeeds; the Windows rounds pass (E5).

## Risks

| Risk | Retirement |
|---|---|
| An AI reads neither Word files nor Ritemark's tool | The rule's last step: the request and the note say plainly what is read |
| The offers are not called reliably | Part B decides first; not built, and frame 2 redrawn |
| VS Code's dialog cannot carry the sheet as drawn | The sheet audit first; the AI-column fallback only with the Experience lead's agreement |
| Ritemark cannot prove a straight send arrived | The delivery audit; the toast's words claim no more than is known |
| Counting a synced folder downloads online-only files | Names only; checked on OneDrive, SharePoint and Google Drive, Mac and Windows |
| Replacing the status bar's "Report AI issue" reads to a Store reviewer as removing the report path | AI information's labelled link stays, the door's tooltip names AI issues, and the 2.1 certification notes describe the path exactly |
| The 7-day comparison cannot be read from personless events | The insight is drafted with the User lead before merge 1 |
| A sync client's new files count as "made something" | Only Ritemark's own creates, successful exports and publishes, and files written during an AI turn count |
| Appetite runs out | The shape's cut order: #408 first (another sprint), then R9; R3–R8 stay |
| Small numbers | Read over the release, not week by week |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **2.0.1 on main** (`b1ac84a7`): Home, the project list, the board's Give, the welcome's sign-in entry points, the consent gate, Sprint 126's report transport.
- **The installed 2.0.1** on the Mac and on a Windows PC, and test keys for OpenCode from the Development manager's registry, for the spike.
- **The Experience lead's answers** to D1–D11, J4's design part and Transcribe's words, before Phases 6 and 8.
- **Item 4's sprint** for Claude's refusal card. This sprint keeps the ready request's card on a refused request either way; the two meet in S25.

## Pre-Implementation Gate

- This plan gets the usual review, and Jarmo's approval gates Phase 0.
- Phase 1's spike and audits come before any code of Workstreams 4–6 and 8. When one changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" and "ja muud asjad ka sh worktreede kustutamine" (ritemark-dev `decisions/log.md`, 26 October). Until 2.1's Gate 1 RC, the manager's word counts for plan approval, sprint start and admin merge of 2.1 work. Release approval (Gate 1, Gate 2, publish) stays Jarmo's.

**The plan's questions, decided:**
- **J1. The shell pieces:** yes. Patch 015 adds Help ▸ Send feedback, and patch 018 adds the whole-window sheet. 2.1 is a shell release.
- **J2. The four reactions:** the command opens the new sheet, and the reactions retire. This is experience 34's decision 2, part of the shape Jarmo approved on 21 October (item 5, "#466 as experience 34 draws it"). Nothing is stubbed: the sheet replaces them in the same change.
- **J3. Frame 2's offer cards:** built only if the spike's part B passes for all three AIs. Otherwise the Experience lead redraws frame 2 with the offers written into the answer.
- **J4. Tasks' empty place:** experience 29 without the "becomes a task" line, by Jarmo's 15 October rule. Transcribe's words are the Experience lead's (below).
- **J5. The spike rule:** approved as written, including Mammoth in the extension host if an AI needs it (check its licence; free software only), and PDFs only within the 3 MB bound.

**The Experience lead's answers** (26 October; READMEs of experiences 29, 34 and 35, ritemark-dev commit a86d5c1):
- **D1:** agreed. The ready request comes back in the same visit, as soon as Send or Not now ends the feedback card.
- **D2:** agreed. The sentence shows always, as long as it is true of that AI. If the spike shows an AI reads less, the sentence says only what that AI reads.
- **D3:** agreed. The card's main part keeps the request's words and opens Ask with, with the tooltip "Sign in to an AI first".
- **D4:** agreed. The starting points step aside without moving the box, and come back when it is empty.
- **D5:** "It didn't go. Your message is still here: try again, or open it in e-mail.", with Try again and Open in e-mail.
- **D6:** the words depend on what Ritemark knows. No check mark and no exclamation mark.
  - When the service accepted the message: "Thank you. It's with the people who make Ritemark."
  - When Ritemark only knows the message left the computer: "Thank you. Your message is on its way."
  - When a message is held for later and the hold survives a restart and sends itself: "Thank you. It goes when you're back online."
  - Any other held message is not sent: use D5's line.
- **D7:** agreed. The Help menu reads Getting started, Support, Send feedback.
- **D8:** agreed. One word per panel: the Conversations panel's empty words say "conversation".
- **D9:** confirmed. The composer, "AI Ready", Waiting for you's empty words and the "new" and "sample" tags stay as 2.0 shipped them.
- **D10:** agreed, with three details:
  - cut at a sentence end and mark "[shortened]" in both the quote and the e-mail;
  - put a muted line under the quote: "Shortened to fit an e-mail. Copy takes the whole answer.";
  - Copy carries the whole answer.
- **D11:** agreed. The privacy page says "which question you were answering (the first-week card)".
- **Transcribe's empty words,** under Recordings, centred:
  - With Record: "No recordings yet." in ink, then in muted ink "Transcribe turns a meeting, an interview or a call into text you and the AI can work with. Record one, or transcribe a file you have.", then the file types as today.
  - Without Record: the same two sentences, then "Transcribe a file you have to start."
  - With recordings in other projects, or no project open: today's words.
  - Never "on this computer" and never "who said what".

**This sprint builds the shared path:** the host's "open a visible chat with this request in this AI". Sprint 139's refusal card reuses it.

