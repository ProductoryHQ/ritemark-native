# Sprint 140 Tasks

Nothing here starts before Jarmo approves the sprint plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md).

## Phase 0: Branch and starting tree

- [ ] `git checkout -b sprint-140-first-day` from `origin/main`; `git branch --show-current` shows it
- [ ] VS Code at the pin with every patch applied from reset + clean + apply (copy-on-write clone for the worktree)
- [ ] `media/webview.js` and `out/extension.js` sizes recorded in `notes/bundle.md` (E4)
- [ ] Patch 015's and 018's file lists and hunk counts recorded in `notes/patches-before.md`
- [ ] The Experience lead's answers to D1–D11 and J4's design part asked for through the Development manager, with Transcribe's empty words (R9)

## Phase 1: The spike and the audits

- [ ] The spike's fixture: Training work, fictional, Office metadata scrubbed, its generator script kept with the note (technical plan, *Part A*)
- [ ] Part A's runs on the installed 2.0.1, Mac and Windows, each AI: the first look in Auto ×3, in Manual ×1, the Word file in front ×1, the PDF-only folder ×3 (Windows through the Development manager's Windows session)
- [ ] If an AI failed Word documents: R1a's prototype on a spike branch, and that AI re-run; if an AI failed PDFs: the host PDF converter tried, and `out/extension.js`'s growth measured against the 3 MB bound
- [ ] Part B: the `offer_next_steps` prototype; six first looks and five ordinary chats per AI; how offers persist across a reload
- [ ] `research/word-spike.md`: the runs, the numbers, the decision per kind (R1a, R1b) and R7's pass or fail
- [ ] `spec.md` updated first: R1 gains R1a and/or R1b; R7 marked built or not built; R8's Word-or-PDF row per kind
- [ ] `research/feedback-sheet-audit.md` (R10–R13): the dialog with `renderBody`, the live route words, the keys, the screen readers, the dimming, Windows; the internal command; Help's route; the fallback
- [ ] `research/feedback-delivery-audit.md` (R13, D6): what a send can know it delivered, usage data on and off
- [ ] `research/confirmations.md`: the empty places' sentences true; saves that count; `m4d7r2` in every sample copy and Give when it is not in To do; "a chat started here" from the index; counting names on synced folders (Mac, Windows) hydrates nothing; where "made something" comes from
- [ ] *What the spike and the audits changed* written in `technical-plan.md`; where a requirement changed, `spec.md` first

## Phase 2: Guidance state and Home's order (W1)

- [ ] `guidance/guidanceState.ts` + test: the one card due, in the drawn order, with R14's day rule (R2)
- [ ] `guidance/readyRequest.ts` + test: kind, due, words with the AI's name; R1b's words if decided (R3, R6)
- [ ] `guidance/folderCounts.ts` + test, and the host's name listing (R3, E2)
- [ ] `guidance/savedDays.ts` + test (R14)
- [ ] `guidance/guidanceStore.ts`: `ritemark.guidance.v1` in global state only (E2)
- [ ] `projects/protocol.ts`: `HomeState.guidance` and `ais`; the new `home/*` requests with exact-field decoders, tests (E3)
- [ ] `HomePanel.ts`: the guidance card computed on each push; the ready request's lifetime from the conversation store and the board's hand-off record (R6)
- [ ] `HomePage.tsx`: Waiting for you, then the one card, then Start something; What moved under Waiting for you (R2)

## Phase 3: The ready request (W2, W3)

- [ ] `ReadyRequestCard.tsx`: the card's shape and the three kinds as drawn, Light and Dark (R3)
- [ ] The split button with Ask with: the AIs, their states and icons, choosing (R4)
- [ ] Sign in and Set up from Home through the welcome's entry points; OpenCode's keys sheet shared between the welcome and Home (R4)
- [ ] `UnifiedViewProvider.startChat` and `chat/start`; the store's handling (reuse the blank chat, in front, fill or send for each runtime); `origin` on `agent-execute` (R5)
- [ ] The sample's button runs `m4d7r2` through the board controller's `give` (R5)
- [ ] The × and "Hide this in <project>" (R6)

## Phase 4: Word reading and the offers, per the spike (W4, W5)

- [ ] The honesty line in `capabilityContext.ts`, + test (R1)
- [ ] If R1a: `documents/docxToMarkdown.ts` with Mammoth and the shared Turndown rules (Make an editable copy uses the same module); the package check first; + test
- [ ] If R1a: the `documents` group and `read_document` in `ritemarkTools.ts`; the project root's setter; `ToolGroupId`, `toolGroupsFor`, `toolGroupById`; the OpenCode permission check; `ritemarkTools.test.ts`
- [ ] If R1a: the `documents` capability section and the active file's line for a .docx
- [ ] If R1b: the request's added words in `guidance/readyRequest.ts`, as the Experience lead gives them
- [ ] If R7 passed: the `offers` group, `OfferCards.tsx`, persistence as part B decided, tests

## Phase 5: Starting points (W6)

- [ ] `guidance/startingPlace.ts` + test; `place` and `hasAbout` on `active-file-changed` (R8)
- [ ] `ai-sidebar/startingPoints.ts` + test: the table, at most three, the "…" fill (R8)
- [ ] `StartingPoints.tsx` in `AgentView` (replacing the examples) and in `CodexView` (under the compatibility notice); hidden while the box holds the person's words (R8, R16)
- [ ] The fill through the chat's draft with the cursor; `startingPoint` on `agent-execute` (R8, R15)

## Phase 6: Empty places (W7)

- [ ] Tasks: the Board view's empty state and the side bar's lines, with J4's ways (R9)
- [ ] Conversations: the empty panel's lines (R9)
- [ ] Transcribe: the empty library's words and actions (R9)

## Phase 7: Day-one counts and merge 1 (W10, W11)

- [ ] `events.ts`: `ready_request_used`, `starting_point_used`, `made_something`; `analytics.test.ts` (R15)
- [ ] `guidance/madeSomething.ts`: the session tracker; export and publish hooks on success (R15)
- [ ] The 7-day insight drafted with the User lead, readable from personless events (R15)
- [ ] CDP checks: Home's order, the card's kinds, each AI's empty chat by place; screenshots beside experience 35's frames, Light and Dark
- [ ] Manual QA on the Mac: S1–S46, S65–S67, S69, and S70's rows for merge 1; evidence in `qa-evidence.md`
- [ ] Windows overlay round: S71
- [ ] `notes/bundle.md` after merge 1's changes (E4)
- [ ] PR 1; `qa-validator`; the Development manager's smoke test; screenshots to the Experience lead; Jarmo's admin merge

## Phase 8: The feedback door (W8)

- [ ] `feedback/feedbackCopy.ts` + honesty test; `feedback/feedbackRoute.ts` + test (R11, R13)
- [ ] `composeReport`: the optional last answer and the kind, shortened to the bound; negative tests changed on purpose (R12)
- [ ] `feedback/feedbackSheet.ts`: `ritemark.feedback.open`, the last answer from the open chat's record, the straight route through `ConsentGate.sendFeedback`, the e-mail route through Sprint 126's transport, the outcome (R11–R13)
- [ ] `feedback/feedbackStatusBar.ts`: "Send feedback", right, priority 97, the tooltip; the report item retired (R10, R16)
- [ ] AI information: "Report an AI issue" opens the sheet ready for an AI issue; `ReportDialog` and the `report/*` messages retired once R16's rows pass (R10, R12, R16)
- [ ] `ritemark.reactions` opens the sheet (J2)
- [ ] Patch 018: `ritemarkFeedbackSheet.ts` (`_ritemark.feedbackSheet`), styles, its VS Code unit test (R11, R13, E5)
- [ ] Patch 015: Help ▸ Send feedback, its allowlist entry, the menu's test (R10, E5)
- [ ] Dry run, real apply from pristine, a second run clean; the stacking check; `compile-check-ts-native` green (E5)

## Phase 9: The feedback card (W9) and the door's count

- [ ] `FeedbackCard.tsx`; `home/feedback-send` and `home/feedback-not-now`; `asked: 'made_this_week'` (R14, D11)
- [ ] Saved days recorded on the saves the confirmation names (R14)
- [ ] `feedback_opened` from each door; `feedback_sent`'s `asked` (R15)

## Phase 10: QA, merge 2 and closeout

- [ ] CDP checks: the status bar's order, the sheet's two routes and the hand-off; screenshots beside experience 34's frames, Light and Dark
- [ ] Manual QA on the Mac: S47–S64, S68, and S70's remaining rows; evidence in `qa-evidence.md`
- [ ] `./scripts/validate-qa.sh`; the pre-commit validator run by hand on the worktree (`CLAUDE_PROJECT_DIR="$PWD"`)
- [ ] PR 2; `qa-validator`; the Development manager's smoke test; screenshots to the Experience lead; Jarmo's admin merge
- [ ] After merge 2: a production build from a clean-room worktree at the merged commit (E5)
- [ ] After merge 2: the Windows round from main, S72
- [ ] PostHog: the new events seen live on a production build after a yes; none before an answer or with usage data off; the feedback sends with usage data off
- [ ] The privacy lines for every new event and property, to the Development manager for `ritemark-web` (E6)
- [ ] The Store's 2.1 certification notes describe the feedback path exactly (E6)
- [ ] Docs: `architecture.md` (guidance, the feedback door, the starting points, the tool groups if built, the version-history row), `CLAUDE.md`'s rows for 015 and 018, the user docs, `docs/CHANGELOG.md`, the 2.1 notes draft (E6)
- [ ] Linked issues: #497 closed with the spike's note; #498 and #466 closed with evidence
- [ ] `node ./scripts/worktree-hygiene.mjs --report` (cleaning is Jarmo's call)
