# G1 folder reading test

Generate the workspace with `python3 scripts/qa/reading-test-folder.py <out-dir>`. Open the resulting `Fernhollow Bank review` folder. Keep the sibling `facts.json` and the run evidence outside the workspace. The confidential appendix is a Word OOXML package encrypted with the free `msoffcrypto-tool` package. Its randomly generated password appears only on the fixture builder's stderr. Keep the fixture locked during the test.

## Fixed question

> Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.

## Running and scoring

Use a test-channel dev build with the Sprint 173 reading and source-link changes. On Mac, use a fresh temporary test profile for each run. For example, for Claude:

```bash
RITEMARK_BUILD_CHANNEL=test RITEMARK_TEST_PROFILE=/private/tmp/rm-reading-claude-1 \
  scripts/qa/with-test-keys.sh --require anthropic -- \
  node scripts/qa/reading-test-run.mjs --ai claude --folder "<workspace>" --out "<evidence-dir>" \
  --user-data-dir=/private/tmp/rm-reading-claude-1
```

For ChatGPT, use `--require openai` with `--ai chatgpt`. For OpenCode, use `--require gemini` with `--ai opencode`. The runner selects a Google model for this run. The existing launcher and vault wrapper are Mac-only. Windows needs the Gate 2 isolated launcher and vault wrapper before its scripted runs. Paste the generated Markdown into the matching run below. Keep the JSON with the evidence.

Use `--question "<text>"` to run the three S38 prompts. For these runs, criteria 1, 2, 4 and 5 are marked `n/a`. The runner checks step labels and source style and records any links the answer includes. Judge each S38 answer against its requested scope. Regenerate older fixtures to pick up the additional accepted facts for criterion 1.

1. All 13 documents have a matching fact or an explicit, valid unread reason. The fixture has two known unread cases (the scan and the confidential appendix).
2. The notes belong to their own slides and slide 5 is explicitly reported as having none.
3. Every visible step label names a document or folder. Commands and paths fail this check.
4. All source links must open the right document, and at least 90% of all source links must land on a passage or slide that supports the claim. The runner reports how many opened the right document and how many include a passage target. A link without a passage counts as a no. For links with passage targets, record a yes or no for each after checking the passage or slide yourself. A find match alone does not establish that the passage supports the claim. A link lands on the claim when the passage it opens supports the claim the link is attached to. An added detail from the same document is fine. An added detail from another document makes it a no.
5. The confidential appendix is named, described as having a password, and accompanied by a way forward.
6. The visible answer has no numbered sources, bracketed filenames or paths.

For fixed-question runs, fill all six criteria with pass or fail. Each AI needs three passing runs out of three on each platform. After a failure, retain its evidence and start a fresh set after the fix. G2 opens the Word and PDF starting points per AI after it passes on Mac and keeps them on if Windows also passes at Gate 2.

## Run records

### Claude on Mac

First set — **1 of 3 on `ab50cad1`**. Runs 1 and 3 failed on runner strictness (see `claude-mac-records.md` in the gate evidence). The recorded verdict stands. A fresh set follows after the runner fix.

Set 2 — **0 of 3 on `be4866cd`** on 26 November 2026 due to runner strictness (see `claude-mac-records.md` in the gate evidence). The recorded verdict stands. A fresh set follows after the runner fix.

Set 3 — **PASS, 3 of 3 on `11819457`** (26 November 2026), the runner from #1085 and #1086. Criterion 4: every link opened the right document with a passage target; 17 of 18, 17 of 17 and 15 of 16 landed on the claim under the written rule (each "no" is a clause about €18.40 against €3.10 that comes from the head of operations' interview, not the Findings draft). G2: Claude's Word and PDF starting points open on the Mac (`READ_KINDS_PASSED['claude-code'].darwin`). Windows follows at Gate 2.

#### Run 1

- Date — 2026-11-26T03:22:05.968Z
- Build — 2.3.0 dev (1181945702f69f3a1885b7df0b001c30affdda36)
- Model — Claude · Sonnet 5.5
- Duration — Read 9 Word documents, 1 PDF, 1 PowerPoint deck · 26s (read fold; the answer arrived within about 40 s of the question)
- Question — Fixed question above
- Password document's line — Confidential appendix: it is password-protected. Open it in Word with the password, or save a copy without the password, and I can read it.

**Answer (verbatim)**

~~~markdown
The folder supports a clear story: visits are falling, branches are used for advice and help with the app, and each visit costs far more than a call. The open question is whether to commit to phase 2. I read 11 of 13 files. I could not open the confidential appendix or the scanned visit form.

## Overview and next decisions

- **Is phase 2 approved?** The [Steering group minutes](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board's%20decision) say phase 2 waits for the board's decision. The board was due to meet on 18 November, but the folder has no record of the outcome.
- **Fee validity:** the [Proposal phase 2 v3](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Valid%20until%2031%20December%202026) is valid only until 31 December 2026, so a decision is needed within about five weeks.
- **Staff communication:** the minutes set December for telling staff about the review. The tellers asked to hear early, so that date should be confirmed.
- **Missing inputs:**
  - The minutes call for final findings by 11 November, but the folder holds only a second draft.
  - The cost per visit by branch, due 4 November, is also absent.
  - The brief promises 12 interviews, and four are on file.
- **Pilot scope is unclear:** the proposal tests an app desk in two branches over four weeks. The deck mentions three branch types and a review after 17 days. These should be aligned before the board sees them.

## One bullet per document

- [Engagement brief](01%20Brief/Engagement%20brief.docx#q=Visits%20fell%2031%25%20in%20three%20years): Fernhollow runs 42 branches, visits fell 31% in three years, and the board wants a plan by March 2027.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=about%20140%20visits%20a%20day): Riverside sees about 140 visits a day, half from older customers paying bills.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled): card-dispute calls doubled since the May app change, and branch staff have no access to the call notes.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=%E2%82%AC18.40%2C%20against%20%E2%82%AC3.10%20for%20a%20call): a visit costs €18.40 against €3.10 for a call, and she would start with the six smallest branches in towns that have a post office.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=They%20would%20like%20an%20'app%20desk'%20near%20the%20door): the tellers want an app desk near the door and fear closures.
- [Workshop notes 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door): the app desk at the door got 9 votes, a shared manager for small branches 7, and weekly evening opening 4.
- [Findings draft v2](04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call): cost per visit is six times the cost per call, which matches 18.40 against 3.10.
- [Proposal phase 2 v3](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT): the twelve-week phase costs €79,000 plus VAT (€38,000, €22,000 and €19,000).
- [Steering group minutes 21 October](Steering%20group%20minutes%2021%20October.docx#q=The%20findings%20go%20to%20the%20board%20on%2018%20November): findings go to the board on 18 November and staff are told in December.
- [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million): visits were 2.1 million against 2.6 million in 2024, and 87% of payments are digital.

## Documents I could not read

Branch visit form, Riverside (scan): it is a scanned image with no text. Open it in the PDF viewer to read it.

Confidential appendix: it is password-protected. Open it in Word with the password, or save a copy without the password, and I can read it.

## Decision briefing, slide by slide

- [Slide 1](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types): start with three branch types. Speaker notes: use the amber ledger for the pilot register.
- [Slide 2](04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays): reserve the quiet room on Tuesdays. Speaker notes: test the queue buzzer before opening.
- [Slide 3](04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open): keep the west entrance open. Speaker notes: place the folding ramp by the side door.
- [Slide 4](04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first): train eight advisers first. Speaker notes: use the mock till during rehearsal.
- [Slide 5](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve): keep €6,200 in reserve. Speaker notes: none.
- [Slide 6](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days): review the pilot after 17 days. Speaker notes: bring the blue tally sheet to the review.

I changed no files.
~~~

**Step labels (exact)**

- Looked in the project folder: 10 Word documents, 2 PDFs, 1 PowerPoint deck
- Read Engagement brief
- Read Interview – branch manager, Riverside
- Read Interview – customer service lead
- Read Interview – head of operations
- Read Interview – two tellers, Harbour Street
- Read Workshop notes 14 October
- Read Findings draft v2
- Read Proposal phase 2 v3
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Couldn't open Confidential appendix · it has a password
- Read Decision briefing · 6 slides

**C4 counts** — opens the right document 18/18; with a passage target 18/18; lands on the claim 17/18 (94.4%). Nos: 1.

Partial claims whose extra detail is from the same document (yes): Steering minutes #1: 18 Nov / 'no record' (same doc, 18 Nov in minutes); Proposal valid-until: 'about five weeks' is arithmetic on the passage's own date; Head of operations: six smallest branches (same interview); Tellers: 'fear closures' (same interview); Workshop: 7 and 4 votes (same table); Proposal total: €38,000/22,000/19,000 (same fee table); Minutes 21 Oct: staff told in December (same minutes); Annual report: 87% digital (same page).

No — Findings draft v2: the clause 'which matches 18.40 against 3.10' comes from another document. Source: Interview – head of operations: 'Operations counts cost per visit at €18.40, against €3.10 for a call.' (the Findings draft v2 does not contain those figures)

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — pass
5. Password notice and way forward — pass
6. Source style — pass

Run verdict — PASS

#### Run 2

- Date — 2026-11-26T03:22:48.229Z
- Build — 2.3.0 dev (1181945702f69f3a1885b7df0b001c30affdda36)
- Model — Claude · Sonnet 5.5
- Duration — Read 9 Word documents, 1 PDF, 1 PowerPoint deck · 27s (read fold; the answer arrived within about 40 s of the question)
- Question — Fixed question above
- Password document's line — Confidential appendix It is password-protected. Open it in Word and save a copy without the password, or give me an unprotected copy.

**Answer (verbatim)**

~~~markdown
The review points to a clear case for phase 2: fewer visits, higher cost per visit, and staff and customers who still want advice and app help in branches. Two documents couldn't be opened (listed below), and the folder holds less evidence than the brief promised. I made no changes to any file.

## Overview

- **The case:** [the annual report](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million) shows visits down from 2.6 million to 2.1 million, and 87% of payments are digital.
- **The cost gap:** The head of operations puts a visit at €18.40 against €3.10 for a call, which is the "six times" in the findings draft.
- **Evidence gaps:** The brief promises 12 interviews and two workshops, but the folder has four interview notes and one workshop. The branch-by-branch cost per visit due on 4 November isn't here either.
- **Timing:** The proposal expires on 31 December 2026. The board date of 18 November has passed, and I found no board outcome in the folder.

## Recommended decisions

1. Confirm the board's outcome on phase 2, and extend the proposal's validity or approve it before 31 December.
2. Agree how to tell staff in December, since tellers asked to be told early.
3. Agree the pilot: the app desk (top workshop vote) and the choice of first branches.
4. Obtain the branch cost data and the missing interviews, so the case doesn't rest on four interviews.
5. Close the loop on interview summaries, which were promised back for checking within a week.

## Documents

- **Engagement brief:** [the brief](01%20Brief/Engagement%20brief.docx#q=Fernhollow%20Bank%20runs%2042%20branches) says visits fell 31% in three years, and puts IT systems and the mortgage centre out of scope.
- **Interview – branch manager, Riverside:** [the Riverside manager](02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day) reports about 140 visits a day and wants a quiet advice room with fewer counters.
- **Interview – customer service lead:** [the customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled) says card-dispute calls doubled since the May app change, and branch staff can't see call notes.
- **Interview – head of operations:** [the head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit) says cash machines average 11 years old, and she would start with the six smallest branches in towns that have a post office.
- **Interview – two tellers, Harbour Street:** [the Harbour Street tellers](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=They%20would%20like%20an%20'app%20desk') want an app desk near the door and fear closures.
- **Workshop notes 14 October:** [the workshop](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door) ranked the app desk first with 9 votes, then a shared manager for small branches with 7.
- **Findings draft v2:** [the findings draft](04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call) lists five findings, including that call centre and branches don't share case notes.
- **Proposal phase 2 v3:** [the proposal](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT) totals €79,000 plus VAT for twelve weeks, valid until 31 December 2026.
- **Steering group minutes 21 October:** [the minutes](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board's%20decision) record that phase 2 waits for the board and staff are told in December.
- **Annual report 2025, branch section:** [the annual report](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=42%20branches%20and%20118%20cash%20machines) shows 42 branches and 118 cash machines at year end.

## Could not read

Branch visit form, Riverside (scan)
It is a scan with no text layer. Open it in the PDF viewer, or share a text version.

Confidential appendix
It is password-protected. Open it in Word and save a copy without the password, or give me an unprotected copy.

## Presentation: Decision briefing

- Slide 1: [Pilot scope](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) says to start with three branch types. Speaker notes: use the amber ledger for the pilot register.
- Slide 2: [Advice](04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays) says to reserve the quiet room on Tuesdays. Speaker notes: test the queue buzzer before opening.
- Slide 3: [Access](04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open) says to keep the west entrance open. Speaker notes: place the folding ramp by the side door.
- Slide 4: [Staffing](04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first) says to train eight advisers first. Speaker notes: use the mock till during rehearsal.
- Slide 5: [Budget](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve) says to keep €6,200 in reserve. Speaker notes: none
- Slide 6: [Follow-up](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days) says to review the pilot after 17 days. Speaker notes: bring the blue tally sheet to the review.
~~~

**Step labels (exact)**

- Looked in the project folder: 10 Word documents, 2 PDFs, 1 PowerPoint deck
- Read Engagement brief
- Read Interview – branch manager, Riverside
- Read Interview – customer service lead
- Read Interview – head of operations
- Read Interview – two tellers, Harbour Street
- Read Workshop notes 14 October
- Read Findings draft v2
- Read Proposal phase 2 v3
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Couldn't open Confidential appendix · it has a password
- Read Decision briefing · 6 slides

**C4 counts** — opens the right document 17/17; with a passage target 17/17; lands on the claim 17/17 (100.0%). Nos: 0.

Partial claims whose extra detail is from the same document (yes): Annual report #1: 87% digital (same page); Brief: IT systems and mortgage centre out of scope (same doc); Head of operations: six smallest branches (same interview); Tellers: 'fear closures' (same interview); Workshop: 7 votes shared manager (same table); Findings draft: five findings incl. case notes (same doc); Proposal: twelve weeks (same doc); Minutes: staff told in December (same doc).

No nos.

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — pass
5. Password notice and way forward — pass
6. Source style — pass

Run verdict — PASS

#### Run 3

- Date — 2026-11-26T03:23:30.611Z
- Build — 2.3.0 dev (1181945702f69f3a1885b7df0b001c30affdda36)
- Model — Claude · Sonnet 5.5
- Duration — Read 9 Word documents, 1 PDF, 1 PowerPoint deck · 29s (read fold; the answer arrived within about 40 s of the question)
- Question — Fixed question above
- Password document's line — Confidential appendix: it is password-protected. Open it in Word, or save a copy without the password, and I can then read it.

**Answer (verbatim)**

~~~markdown
The review covers 13 documents. I couldn't read two of them (listed below), and I changed no files.

## Overview

The case for change is consistent across the documents. Visits are falling, the remaining visits are about advice, and cost per visit is far above cost per call. The papers also have gaps that the steering group should know about.

- **Timing:** the minutes said the findings would go to the board on 18 November, and today is 26 November. Nothing in the folder shows that happened.
- **Evidence base:** the brief promises 12 interviews and two workshops. The folder holds four interviews and one workshop.
- **Pilot scope:** the proposal pilots an app desk in two branches over four weeks. The decision briefing speaks of three branch types and a pilot review after 17 days.
- **Proposal validity:** the proposal expires on 31 December 2026.

## Recommended next decisions

1. Confirm whether the board has decided on phase 2. If not, set a date before the proposal's 31 December expiry.
2. Fix the pilot scope: two branches or three branch types, and four weeks or a 17-day review.
3. Confirm when and how staff are told. The tellers asked to hear early, and the minutes say December.
4. Get the cost-per-visit data by branch that Operations was due to supply on 4 November.
5. Decide whether the missing interviews and the second workshop are still coming.

## Documents

- [Engagement brief](01%20Brief/Engagement%20brief.docx#q=Visits%20fell%2031%25%20in%20three%20years): the bank runs 42 branches, visits fell 31% in three years, and the board wants a plan by March 2027.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day): about 140 visits a day, half from older customers paying bills, with staff spending about two hours a day on paperwork.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled%20since%20the%20app%20change%20in%20May): card-dispute calls doubled since the May app change, and branch staff can't see the call notes.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=cost%20per%20visit%20at%20%E2%82%AC18.40): a visit costs €18.40 against €3.10 for a call, and she would start with the six smallest branches in towns that have a post office.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=They%20would%20like%20an%20'app%20desk'%20near%20the%20door): lunchtime is busiest, most questions are about the app, and they fear closures and want to be told early.
- [Workshop notes 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door): the app desk at the door got 9 votes, a shared manager for small branches 7, and weekly evening opening 4.
- [Findings draft v2](04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call): five findings, including that cost per visit is six times the cost per call (€18.40 against €3.10 supports this).
- [Proposal phase 2 v3](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT): a twelve-week phase for €79,000 plus VAT, valid until 31 December 2026. The three parts add up to €79,000 and 12 weeks.
- [Steering group minutes 21 October](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board's%20decision): phase 2 waits for the board's decision, and staff are told about the review in December.
- [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million): visits were 2.1 million against 2.6 million the year before, and the digital share of payments is 87%.

## Documents I could not read

- Branch visit form, Riverside (scan): it is a scan with no text. Open it in the PDF viewer, or send me a text-searchable copy or the key figures.
- Confidential appendix: it is password-protected. Open it in Word, or save a copy without the password, and I can then read it.

## Presentation: Decision briefing

- Slide 1: [Decision briefing, slide 1](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) says to start with three branch types. Speaker notes: use the amber ledger for the pilot register.
- Slide 2: [Decision briefing, slide 2](04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays) says to reserve the quiet room on Tuesdays. Speaker notes: test the queue buzzer before opening.
- Slide 3: [Decision briefing, slide 3](04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open) says to keep the west entrance open. Speaker notes: place the folding ramp by the side door.
- Slide 4: [Decision briefing, slide 4](04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first) says to train eight advisers first. Speaker notes: use the mock till during rehearsal.
- Slide 5: [Decision briefing, slide 5](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve) says to keep €6,200 in reserve. Speaker notes: none.
- Slide 6: [Decision briefing, slide 6](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days) says to review the pilot after 17 days. Speaker notes: bring the blue tally sheet to the review.
~~~

**Step labels (exact)**

- Looked in the project folder: 10 Word documents, 2 PDFs, 1 PowerPoint deck
- Read Engagement brief
- Read Interview – branch manager, Riverside
- Read Interview – customer service lead
- Read Interview – head of operations
- Read Interview – two tellers, Harbour Street
- Read Workshop notes 14 October
- Read Findings draft v2
- Read Proposal phase 2 v3
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Couldn't open Confidential appendix · it has a password
- Read Decision briefing · 6 slides

**C4 counts** — opens the right document 16/16; with a passage target 16/16; lands on the claim 15/16 (93.8%). Nos: 1.

Partial claims whose extra detail is from the same document (yes): Riverside: two hours of paperwork (same interview); Head of operations: six smallest branches (same interview); Tellers: fear closures / told early (same interview); Workshop: 7 and 4 votes (same table); Proposal: parts add to €79,000 and 12 weeks (same fee table); Minutes: staff told in December (same doc); Annual report: 87% digital (same page).

No — Findings draft v2: the clause '(€18.40 against €3.10 supports this)' comes from another document. Source: Interview – head of operations: 'Operations counts cost per visit at €18.40, against €3.10 for a call.' (not in the Findings draft v2)

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — pass
5. Password notice and way forward — pass
6. Source style — pass

Run verdict — PASS

### Set verdict — 3 of 3 pass on 11819457.

### Claude on Windows

Verdict — pending (3 of 3 required).

#### Run 1

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 2

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 3

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

### ChatGPT on Mac

Verdict — pending (3 of 3 required).

#### Run 1

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 2

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 3

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

### ChatGPT on Windows

Verdict — pending (3 of 3 required).

#### Run 1

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 2

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 3

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

### OpenCode on Mac

Verdict — pending (3 of 3 required).

#### Run 1

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 2

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 3

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

### OpenCode on Windows

Verdict — pending (3 of 3 required).

#### Run 1

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 2

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail

#### Run 3

- Date —
- Build —
- Model —
- Question — Fixed question above
- Password document's line —

**Answer (verbatim)**

```markdown
```

**Step labels**

**Links tried**

| Source | href | Opened document | Opens the right document | Find marked a passage | Lands on the claim |
| --- | --- | --- | --- | --- | --- |
| | | | | | To check |

**Criteria**

1. Document coverage — pass / fail
2. Speaker notes — pass / fail
3. Step labels — pass / fail
4. Passage links — pass / fail
5. Password notice and way forward — pass / fail
6. Source style — pass / fail
