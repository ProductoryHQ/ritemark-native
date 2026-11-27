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

Use `--question "<text>"` to run the three S38 prompts. For these runs, criteria 1, 2, 4 and 5 are marked `n/a`. The runner checks step labels and source style and records any links the answer includes. Judge each S38 answer against its requested scope. Use the fixture’s listed facts for automatic coverage checks.

1. Check coverage for all 13 documents. The runner accepts a title after an optional leading “The” or “the” and still accepts unique title prefixes. A title with a matching listed fact is `read`. A document named with a valid unread reason is `unread`. A title with neither is `to check`. A document with no matching title or valid unread entry is `missing`. For each `to check` row, judge whether the bullet gives a concrete finding from that document and quote the document’s supporting sentence, as in the criterion 4 person check. The runner reports `pass` when all rows are `read` or `unread`, `fail` when any row is `missing`, and `to check` otherwise.
2. The notes belong to their own slides and slide 5 is explicitly reported as having none.
3. Every visible step label names a document or folder. Commands and paths fail this check.
4. All source links must open the right document, and at least 90% of all source links must land on a passage or slide that supports the claim. The runner reports how many opened the right document and how many include a passage target. A link without a passage counts as a no. For links with passage targets, record a yes or no for each after checking the passage or slide yourself. A find match alone does not establish that the passage supports the claim. A link lands on the claim when the passage it opens supports the claim the link is attached to. An added detail from the same document is fine. An added detail from another document makes it a no.
5. The confidential appendix is named, described as having a password, and accompanied by a way forward.
6. The visible answer has no numbered sources, bracketed filenames or paths.

For fixed-question runs, resolve the pending person checks and record pass or fail for all six criteria. Each AI needs three passing runs out of three on each platform. After a failure, retain its evidence and start a fresh set after the fix. G2 opens the Word and PDF starting points per AI after it passes on Mac and keeps them on if Windows also passes at Gate 2.

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

Set 1 (26 November 2026) — **0 of 3 on 1848bc80**. All three failed criterion 3 on generic command rows and a trailing empty Thinking row. Criterion 1 also failed as originally scored. Run 1 gave the Engagement brief’s March 2027 deadline, which was outside the fact list. Run 2 paraphrased the Findings draft’s point about older customers getting app help in branches. Run 3 used “The” before eight titles and paraphrased the Findings draft. Set 1 retains its original verdict. A fresh set follows.

Set 2 on `62554ef6` — the harness stopped during run 1 after the command palette failed to open. No result.

Set 3 on `62554ef6` — **0 of 3**. Criterion 3 failed in every run with one or two “Ran a command” rows before the first read. A traced run identified these two folder listings:

```sh
ls -la; find . -type d \( -name '.*' -o -name node_modules \) ! -name . -prune -o -type f -print
find . -type f \( -name '*.docx' -o -name '*.pdf' -o -name '*.pptx' \)
```

Criterion 5 produced false negatives in run 2. Criteria 1 and 4 are to check. Set 3 retains its verdict. A fresh set follows after the fixes.

Set 4 on `fbcfd642`: **fail**. Runs 1 and 2 passed criterion 3: every step named a document or the project folder. Run 3 had two "Ran a command" rows. The runner's `badCommands` gave the folder listings piped through a filter:

```sh
/bin/bash -lc "ls -la; find . -type f | grep -v '/\\.'"
/bin/bash -lc "find . -type f | grep -v '/\\.'"
```

Criteria 1 and 4 were not judged by hand, because run 3 already fails. Criterion 5 passed in all three runs. Set 4 retains its verdict. The next fix makes the rule general: a listing piped only through filters that read their input (`grep`, `sort`, `uniq`, `head`, `tail`, `wc`, `cut`, `tr`) is a folder step. A fresh set follows.

Set 5 on `7960b92b`: **3 of 3 pass**. Build 7960b92b (2.3.0 dev), model ChatGPT · GPT-6.2 Sol, 26 November 2026. Criteria 1 and 4 judged by hand: each link's claim beside the passage it targets, and each document finding beside the document's own sentence. Links to the two unread documents (Confidential appendix, Branch visit form scan) are counted for the right document but not judged for passage.

#### Run 1

- Date — 2026-11-26T16:51:42.775Z
- Build — 2.3.0 dev (7960b92b17e4933d9540cd1fca128448b9b99e00)
- Model — ChatGPT · GPT-6.2 Sol
- Question — Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.
- Completed read fold — None recorded.
- Password document's line — Confidential appendix — Password-protected. Open it in Word with the password, or save a separate copy without the password if you’re authorized to do so.

**Answer (verbatim)**

```markdown
## Steering group overview

Branch visits are falling, but the remaining demand points toward advice and help with the app. [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits) records 2.1 million visits, down from 2.6 million in 2024. [Findings, draft 2](04%20Drafts/Findings%20draft%20v2.docx#q=Visits%20are%20falling) says the visits that remain are longer and more often about advice.

**Recommended next decisions**

1. **Confirm the board’s decision before committing funds.** [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board) makes Phase 2 conditional on board approval. Confirm the outcome of the scheduled 18 November meeting before committing to the €79,000 plus VAT in [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT).
2. **If approved, choose two app-desk pilot branches and agree success measures before launch.** Track whether customers resolve their app issues, whether queues improve, and whether access to advice is maintained. [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=test%20an%20app%20desk%20in%20two%20branches) sets the two-site scope; [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days) calls for a review after 17 days.
3. **Confirm the December staff briefing and defer decisions on individual branches.** Check that branch-level costs are available, and weigh them alongside customer access and pilot results before recommending changes. [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Staff%20are%20told%20about%20the%20review%20in%20December) records the staff briefing and requests cost per visit by branch.

## Findings by document

- [Engagement brief: branch network review](01%20Brief/Engagement%20brief.docx#q=A%20target%20model%20for%20branches%20in%20three%20sizes) calls for a model with three branch sizes and a phased plan with costs and actions for the first 90 days.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day) reports about 140 visits a day, roughly half from older customers paying bills.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled) reports that card-dispute calls doubled after the May app change, and that branch staff handle escalations without access to call notes.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit) puts the cost at €18.40 per branch visit versus €3.10 per call.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=Both%20tellers%20say%20the%20busiest%20hour%20is%20lunchtime) identifies lunchtime as the busiest hour and says most questions are about the app.
- [Workshop notes, 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door) records nine votes for an app desk at the door, the most of any idea.
- [Findings, draft 2](04%20Drafts/Findings%20draft%20v2.docx#q=Older%20customers%20rely%20on%20branches%20for%20help%20with%20the%20app) identifies branch support with the app as something older customers rely on.
- [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase) proposes 12 weeks to design three branch sizes with staff, pilot an app desk in two branches, and plan the first moves.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve) calls for a €6,200 pilot reserve.
- [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=At%20year%20end%20the%20bank%20ran%2042%20branches) reports 42 branches and 118 cash machines at year-end.
- [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Actions) assigns Operations to provide cost per visit by branch by 4 November.

## Presentation, slide by slide

- Slide 1 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) says to start with three branch types. Speaker notes: Use the amber ledger for the pilot register.
- Slide 2 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays) says to reserve the quiet room on Tuesdays. Speaker notes: Test the queue buzzer before opening.
- Slide 3 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open) says to keep the west entrance open. Speaker notes: Place the folding ramp by the side door.
- Slide 4 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first) says to train eight advisers first. Speaker notes: Use the mock till during rehearsal.
- Slide 5 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve) says to keep €6,200 in reserve. Speaker notes: none
- Slide 6 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days) says to review the pilot after 17 days. Speaker notes: Bring the blue tally sheet to the review.

## Documents I could not read

- [Confidential appendix](04%20Drafts/Confidential%20appendix.docx) — Password-protected. Open it in Word with the password, or save a separate copy without the password if you’re authorized to do so.
- [Branch visit form, Riverside (scan)](Reference/Branch%20visit%20form%2C%20Riverside%20%28scan%29.pdf#p=1) — A one-page scan with no readable text. Open it in the PDF viewer to read the page visually.

No files were changed.
```

**Step labels**

- Looked in the project folder
- Read Workshop notes 14 October
- Couldn't open Confidential appendix · it has a password
- Read Proposal phase 2 v3
- Read Interview – branch manager, Riverside
- Read Findings draft v2
- Read Interview – head of operations
- Read Interview – customer service lead
- Read Decision briefing · 6 slides
- Read Interview – two tellers, Harbour Street
- Read Engagement brief
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page

**Document findings to check**

- Findings draft v2

**Links tried**

- Opened the right document — 26/26 (100.0%)
- Include a passage target — 25/26 (96.2%)
- Confirmed to land on the claim — 0/26 (0.0%)

- Annual report 2025, branch section — `Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings, draft 2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Visits%20are%20falling` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=test%20an%20app%20desk%20in%20two%20branches` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Staff%20are%20told%20about%20the%20review%20in%20December` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Engagement brief: branch network review — `01%20Brief/Engagement%20brief.docx#q=A%20target%20model%20for%20branches%20in%20three%20sizes` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – branch manager, Riverside — `02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day` — opened 02 Interviews/Interview – branch manager, Riverside.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=Both%20tellers%20say%20the%20busiest%20hour%20is%20lunchtime` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Workshop notes, 14 October — `03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door` — opened 03 Workshop/Workshop notes 14 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings, draft 2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Older%20customers%20rely%20on%20branches%20for%20help%20with%20the%20app` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Annual report 2025, branch section — `Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=At%20year%20end%20the%20bank%20ran%2042%20branches` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Actions` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Confidential appendix — `04%20Drafts/Confidential%20appendix.docx` — opened 04 Drafts/Confidential appendix.docx — opens the right document yes — find marked a passage yes — lands on the claim no
- Branch visit form, Riverside (scan) — `Reference/Branch%20visit%20form%2C%20Riverside%20%28scan%29.pdf#p=1` — opened Reference/Branch visit form, Riverside (scan).pdf — opens the right document yes — find marked a passage yes — lands on the claim to check

**Judged by hand**

- Password document's line — Confidential appendix — Password-protected. Open it in Word with the password, or save a separate copy without the password if you're authorized to do so.

**C4 counts** — opens the right document 26/26; with a passage target 24/24 judged links (the two unread links are not judged); lands on the claim 23/24 (95.8%). Nos: 1.

No — Steering group minutes, 21 October: claim "assigns Operations to provide cost per visit by branch by 4 November". Link `#q=Actions` opens only the heading "Actions". The supporting line ("Operations: cost per visit by branch, by 4 November") sits under it, but the passage the link finds is the single word. Counted as no, strictly. Without it, 24/24.

Partial claims whose extra detail is from the same document (yes): Findings draft, "longer and more often about advice" (same sentence); Minutes, cost per visit by branch (same document); Brief, "phased plan with costs and actions for the first 90 days" (same list); Riverside, older customers paying bills (same sentence); Customer service lead, no call notes (same passage); Annual report, 118 cash machines (same sentence).

**C1 to check**

- Findings draft v2 — pass. Bullet: "identifies branch support with the app as something older customers rely on." Document: "Older customers rely on branches for help with the app".

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — pass (23/24, 95.8%)
5. Password notice and way forward — pass
6. Source style — pass

Run verdict — PASS

#### Run 2

- Date — 2026-11-26T16:52:34.147Z
- Build — 2.3.0 dev (7960b92b17e4933d9540cd1fca128448b9b99e00)
- Model — ChatGPT · GPT-6.2 Sol
- Question — Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.
- Completed read fold — None recorded.
- Password document's line — Confidential appendix — Password-protected. Open it in Word with the password and, if authorised, save a separate unprotected copy for review.

**Answer (verbatim)**

```markdown
## Steering group overview

Branch visits are falling, but the visits that remain are longer and more often about advice, according to [Findings, draft 2](04%20Drafts/Findings%20draft%20v2.docx#q=Visits%20are%20falling%20but%20the%20visits%20that%20remain%20are%20longer%20and%20about%20advice). The [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million) records 2.1 million visits, down from 2.6 million in 2024. The evidence supports testing a different branch model before committing to moves or closures.

## Recommended next decisions

1. **Confirm the board’s decision before authorising phase 2.** [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board%27s%20decision) made phase 2 conditional on the board’s decision; the folder does not record the outcome. If approved, decide whether to commit the €79,000 plus VAT quoted in [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT) before the quote expires on 31 December 2026.
2. **Agree the pilot scope and success measures.** [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) calls for three branch types, while [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=test%20an%20app%20desk%20in%20two%20branches) budgets for app desks in two branches. Confirm whether the two app desks are part of a broader three-type pilot, and agree how to measure wait times, app queries resolved and access to advice.
3. **Confirm who will brief staff in December.** [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Staff%20are%20told%20about%20the%20review%20in%20December) sets the timing, and [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=They%20worry%20the%20review%20means%20closures) explains why it matters. Say what the pilot will test and what has not been decided.

## Document findings

- [Engagement brief: branch network review](01%20Brief/Engagement%20brief.docx#q=Visits%20fell%2031%25%20in%20three%20years) records a 31% fall in branch visits over three years while call volumes rose.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled) reports that card-dispute calls doubled after the May app change and that branch staff handle escalations without access to call notes.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit) puts the cost at €18.40 per branch visit versus €3.10 per call.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day) reports about 140 visits a day, roughly half from older customers paying bills.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=Most%20questions%20are%20about%20the%20app) says most questions are about the app; both tellers want an app desk near the entrance.
- [Workshop notes, 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door) records nine votes for an app desk at the door, the most of any idea listed.
- [Findings, draft 2](04%20Drafts/Findings%20draft%20v2.docx#q=Older%20customers%20rely%20on%20branches%20for%20help%20with%20the%20app) identifies older customers’ reliance on branches for help with the app.
- [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase) proposes 12 weeks to design three branch sizes with staff, test app desks and plan the first moves.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) calls for starting with three branch types.
- [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=At%20year%20end%20the%20bank%20ran%2042%20branches) records 42 branches and 118 cash machines at year end.
- [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=The%20findings%20go%20to%20the%20board%20on%2018%20November) scheduled the findings for the 18 November board meeting and put phase 2 on hold pending the board’s decision.

## Decision briefing, slide by slide

- Slide 1 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) calls for three branch types. Speaker notes: Use the amber ledger for the pilot register.
- Slide 2 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays) reserves the quiet room on Tuesdays. Speaker notes: Test the queue buzzer before opening.
- Slide 3 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open) calls for keeping the west entrance open. Speaker notes: Place the folding ramp by the side door.
- Slide 4 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first) calls for training eight advisers first. Speaker notes: Use the mock till during rehearsal.
- Slide 5 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve) sets aside €6,200 in reserve. Speaker notes: none
- Slide 6 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days) calls for reviewing the pilot after 17 days. Speaker notes: Bring the blue tally sheet to the review.

## Documents I couldn’t read

[Confidential appendix](04%20Drafts/Confidential%20appendix.docx) — Password-protected. Open it in Word with the password and, if authorised, save a separate unprotected copy for review.

[Branch visit form, Riverside (scan)](Reference/Branch%20visit%20form%2C%20Riverside%20%28scan%29.pdf#p=1) — The single page is an image with no readable text. Open it in the PDF viewer to read it visually.
```

**Step labels**

- Looked in the project folder
- Couldn't open Confidential appendix · it has a password
- Read Workshop notes 14 October
- Read Decision briefing · 6 slides
- Read Interview – customer service lead
- Read Interview – head of operations
- Read Proposal phase 2 v3
- Read Findings draft v2
- Read Interview – branch manager, Riverside
- Read Interview – two tellers, Harbour Street
- Read Steering group minutes 21 October
- Read Engagement brief
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Read Annual report 2025, branch section · 1 page

**Document findings to check**

- Interview – two tellers, Harbour Street
- Findings draft v2

**Links tried**

- Opened the right document — 27/27 (100.0%)
- Include a passage target — 26/27 (96.3%)
- Confirmed to land on the claim — 0/27 (0.0%)

- Findings, draft 2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Visits%20are%20falling%20but%20the%20visits%20that%20remain%20are%20longer%20and%20about%20advice` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Annual report 2025, branch section — `Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board%27s%20decision` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=test%20an%20app%20desk%20in%20two%20branches` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Staff%20are%20told%20about%20the%20review%20in%20December` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=They%20worry%20the%20review%20means%20closures` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Engagement brief: branch network review — `01%20Brief/Engagement%20brief.docx#q=Visits%20fell%2031%25%20in%20three%20years` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – branch manager, Riverside — `02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day` — opened 02 Interviews/Interview – branch manager, Riverside.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=Most%20questions%20are%20about%20the%20app` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Workshop notes, 14 October — `03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door` — opened 03 Workshop/Workshop notes 14 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings, draft 2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Older%20customers%20rely%20on%20branches%20for%20help%20with%20the%20app` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Annual report 2025, branch section — `Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=At%20year%20end%20the%20bank%20ran%2042%20branches` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=The%20findings%20go%20to%20the%20board%20on%2018%20November` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room%20on%20Tuesdays` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Confidential appendix — `04%20Drafts/Confidential%20appendix.docx` — opened 04 Drafts/Confidential appendix.docx — opens the right document yes — find marked a passage yes — lands on the claim no
- Branch visit form, Riverside (scan) — `Reference/Branch%20visit%20form%2C%20Riverside%20%28scan%29.pdf#p=1` — opened Reference/Branch visit form, Riverside (scan).pdf — opens the right document yes — find marked a passage yes — lands on the claim to check

**Judged by hand**

- Password document's line — Confidential appendix — Password-protected. Open it in Word with the password and, if authorised, save a separate unprotected copy for review.

**C4 counts** — opens the right document 27/27; with a passage target 25/25 judged; lands on the claim 25/25 (100%). Nos: 0.

Partial claims whose extra detail is from the same document (yes): Minutes, 18 November board date plus "phase 2 on hold" (same Decisions list); Tellers, "explains why it matters" (worry about closures, asked to be told early, same sentence); Tellers, app desk near the entrance (same passage); Proposal, "test app desks" (same sentence).

**C1 to check**

- Interview – two tellers, Harbour Street — pass. Bullet: "says most questions are about the app; both tellers want an app desk near the entrance." Document: "Most questions are about the app. They would like an 'app desk' near the door."
- Findings draft v2 — pass. Bullet: "identifies older customers' reliance on branches for help with the app." Document: "Older customers rely on branches for help with the app".

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — pass (25/25, 100%)
5. Password notice and way forward — pass
6. Source style — pass

Run verdict — PASS

#### Run 3

- Date — 2026-11-26T16:53:22.950Z
- Build — 2.3.0 dev (7960b92b17e4933d9540cd1fca128448b9b99e00)
- Model — ChatGPT · GPT-6.2 Sol
- Question — Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.
- Completed read fold — None recorded.
- Password document's line — Confidential appendix could not be read because it is password-protected. To make it readable for review, unlock it in Word and save a separate copy without the password if you’re authorized to do so.

**Answer (verbatim)**

```markdown
## Steering group overview

Branch visits fell from 2.6 million in 2024 to 2.1 million in 2025, according to [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits). But the visits that remain are longer and more focused on advice, according to [Findings, draft 2](04%20Drafts/Findings%20draft%20v2.docx#q=Visits%20are%20falling). The evidence supports testing a different branch model before committing to closures.

## Next decisions

1. **Confirm the board’s decision before commissioning phase 2.** [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits) made phase 2 contingent on the board’s decision; no board decision was found in the readable documents. If approved, decide whether to accept the €79,000 plus VAT offer in [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total) before it expires on 31 December 2026.
2. **Agree on pilot sites and success measures.** Before launching the two-branch app-desk test in [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase), set baselines for waiting times, repeat visits for app help, and access to advice. Use the 17-day review in [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot) as an early checkpoint, not a rollout decision.
3. **Confirm the December staff briefing and assign ownership for the case-note problem.** [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=Staff%20are%20told) commits to telling staff in December. The case-note gap in [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=no%20access%20to%20the%20call%20notes) needs a separate owner because [Engagement brief: branch network review](01%20Brief/Engagement%20brief.docx#q=IT%20systems) excludes IT systems.

## Findings by document

- [Engagement brief: branch network review](01%20Brief/Engagement%20brief.docx#q=The%20board%20wants%20a%20plan) sets a March 2027 deadline for the network plan.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day) reports about 140 visits a day, half from older customers paying bills.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled) reports that card-dispute calls doubled after the May app change.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit) puts the cost at €18.40 per branch visit versus €3.10 per call.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=Both%20tellers%20say) identifies lunchtime as the busiest hour and the app as the subject of most questions.
- [Workshop notes, 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door) records nine votes for an app desk at the entrance, the most of any idea listed.
- [Findings, draft 2](04%20Drafts/Findings%20draft%20v2.docx#q=Older%20customers%20rely%20on%20branches) finds that older customers rely on branches for help with the app.
- [Proposal: phase 2](04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase) proposes 12 weeks to design three branch sizes with staff, test an app desk in two branches, and plan the first changes.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) sets the pilot scope at three branch types.
- [Annual report 2025, branch section](Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=At%20year%20end%20the%20bank%20ran) records 42 branches and 118 cash machines at year-end.
- [Steering group minutes, 21 October](Steering%20group%20minutes%2021%20October.docx#q=cost%20per%20visit%20by%20branch) assigned Operations to provide cost per visit by branch by 4 November.
- [Confidential appendix](04%20Drafts/Confidential%20appendix.docx) could not be read because it is password-protected. To make it readable for review, unlock it in Word and save a separate copy without the password if you’re authorized to do so.
- [Branch visit form, Riverside (scan)](Reference/Branch%20visit%20form%2C%20Riverside%20%28scan%29.pdf#p=1) could not be read because the scan has no readable text layer. Open it in the PDF viewer to read it visually.

## Presentation, slide by slide

- Slide 1 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types) starts the pilot with three branch types. Speaker notes: Use the amber ledger for the pilot register.
- Slide 2 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room) reserves the quiet room on Tuesdays. Speaker notes: Test the queue buzzer before opening.
- Slide 3 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open) keeps the west entrance open. Speaker notes: Place the folding ramp by the side door.
- Slide 4 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first) calls for training eight advisers first. Speaker notes: Use the mock till during rehearsal.
- Slide 5 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve) sets aside €6,200 in reserve. Speaker notes: none
- Slide 6 — [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days) schedules a pilot review after 17 days. Speaker notes: Bring the blue tally sheet to the review.
```

**Step labels**

- Looked in the project folder
- Read Findings draft v2
- Couldn't open Confidential appendix · it has a password
- Read Interview – customer service lead
- Read Interview – branch manager, Riverside
- Read Proposal phase 2 v3
- Read Decision briefing · 6 slides
- Read Interview – head of operations
- Read Workshop notes 14 October
- Read Interview – two tellers, Harbour Street
- Read Engagement brief
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page

**Document findings to check**

- Engagement brief
- Workshop notes 14 October

**Links tried**

- Opened the right document — 28/28 (100.0%)
- Include a passage target — 27/28 (96.4%)
- Confirmed to land on the claim — 0/28 (0.0%)

- Annual report 2025, branch section — `Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=Branch%20visits` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings, draft 2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Visits%20are%20falling` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Staff%20are%20told` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=no%20access%20to%20the%20call%20notes` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Engagement brief: branch network review — `01%20Brief/Engagement%20brief.docx#q=IT%20systems` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Engagement brief: branch network review — `01%20Brief/Engagement%20brief.docx#q=The%20board%20wants%20a%20plan` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – branch manager, Riverside — `02%20Interviews/Interview%20%E2%80%93%20branch%20manager%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day` — opened 02 Interviews/Interview – branch manager, Riverside.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers%2C%20Harbour%20Street.docx#q=Both%20tellers%20say` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Workshop notes, 14 October — `03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door` — opened 03 Workshop/Workshop notes 14 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings, draft 2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Older%20customers%20rely%20on%20branches` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal: phase 2 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=A%20twelve-week%20phase` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Annual report 2025, branch section — `Reference/Annual%20report%202025%2C%20branch%20section.pdf#p=1&q=At%20year%20end%20the%20bank%20ran` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Steering group minutes, 21 October — `Steering%20group%20minutes%2021%20October.docx#q=cost%20per%20visit%20by%20branch` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Confidential appendix — `04%20Drafts/Confidential%20appendix.docx` — opened 04 Drafts/Confidential appendix.docx — opens the right document yes — find marked a passage yes — lands on the claim no
- Branch visit form, Riverside (scan) — `Reference/Branch%20visit%20form%2C%20Riverside%20%28scan%29.pdf#p=1` — opened Reference/Branch visit form, Riverside (scan).pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=2&q=Reserve%20the%20quiet%20room` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=3&q=Keep%20the%20west%20entrance%20open` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=4&q=Train%20eight%20advisers%20first` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=5&q=Keep%20%E2%82%AC6%2C200%20in%20reserve` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=6&q=Review%20the%20pilot%20after%2017%20days` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check

**Judged by hand**

- Password document's line — Confidential appendix could not be read because it is password-protected. To make it readable for review, unlock it in Word and save a separate copy without the password if you're authorized to do so.

**C4 counts** — opens the right document 28/28; with a passage target 26/26 judged; lands on the claim 26/26 (100%). Nos: 0.

Partial claims whose extra detail is from the same document (yes): Customer service lead, no access to call notes (same passage; the "separate owner because the brief excludes IT systems" part is supported by the brief's own link, "IT systems and the mortgage centre are out of scope"); Workshop, "entrance" for "door" (same row); Proposal, "first changes" for "first moves" (same sentence).

**C1 to check**

- Engagement brief — pass. Bullet: "sets a March 2027 deadline for the network plan." Document: "The board wants a plan for the network by March 2027." (The fact is in the document, not in `facts.json`'s word list, which is why the runner left it as to check.)
- Workshop notes 14 October — pass. Bullet: "records nine votes for an app desk at the entrance, the most of any idea listed." Document table: "App desk at the door | 9" (others 7 and 4).

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — pass (26/26, 100%)
5. Password notice and way forward — pass
6. Source style — pass

Run verdict — PASS

### Set verdict — 3 of 3 pass on 7960b92b.

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

Set 1 (26 November 2026) on main at `849aa667` — **0 of 3 pass** after re-scoring the saved answers with the corrected slide-row matcher. OpenCode used Gemini 3.5 Flash Lite because the test key’s prepaid Gemini balance was exhausted. OpenCode reported “You exceeded your current quota” for Gemini 3.1 Pro. Gemini 3.8 Flash stays silent through OpenCode (#1114). The 2.4 known issue “Ask OpenCode in chat” remains until a rerun on Gemini 3.8 Flash with a funded key.

#### Run 1

- Date — 2026-11-26T18:52:46.529Z
- Build — 2.3.0 dev (849aa6677255d522907342424d94449fb1aa3fcc)
- Model — OpenCode · Gemini 3.5 Flash Lite
- Question — Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.
- Completed read fold — None recorded.
- Password document's line — Confidential appendix.docx: Couldn't read Confidential appendix.docx: it has a password. Open it in Word, or save a copy without the password.

**Answer (verbatim)**

```markdown
Here is an overview of the findings from the review of the steering group folder, along with recommended decisions.

### Overview and Recommendations
The review shows a branch network facing declining transactions (visits fell 31% over three years as reported in [Engagement brief](01%20Brief/Engagement%20brief.docx)), high branch visit costs (€18.40 per visit vs. €3.10 for a call according to [Interview – head of operations](02%20Interviews/Interview%20–%20head%20of%20operations.docx)), and increasing app-related customer service calls. Key priorities include finalizing findings for the board on 18 November (noted in [Steering group minutes 21 October](Steering%20group%20minutes%2021%20October.docx)), deciding on Phase 2 proposals, and piloting new concepts such as app desks and shared branch managers.

### Document Findings
- [Steering group minutes 21 October](Steering%20group%20minutes%2021%20October.docx): Findings go to the board on 18 November.
- [Annual report 2025, branch section](Reference/Annual%20report%202025,%20branch%20section.pdf): At year end the bank ran 42 branches and 118 cash machines.
- [Engagement brief](01%20Brief/Engagement%20brief.docx): Visits fell 31% in three years while call volumes rose.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20–%20two%20tellers,%20Harbour%20Street.docx): Both tellers say the busiest hour is lunchtime.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20–%20branch%20manager,%20Riverside.docx): Riverside sees about 140 visits a day, half of them older customers paying bills.
- [Interview – head of operations](02%20Interviews/Interview%20–%20head%20of%20operations.docx): Operations counts cost per visit at €18.40, against €3.10 for a call.
- [Interview – customer service lead](02%20Interviews/Interview%20–%20customer%20service%20lead.docx): Calls about card disputes doubled since the app change in May.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx): Slide 1 — Start with three branch types. Speaker notes: Use the amber ledger for the pilot register.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx): Slide 2 — Reserve the quiet room on Tuesdays. Speaker notes: Test the queue buzzer before opening.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx): Slide 3 — Keep the west entrance open. Speaker notes: Place the folding ramp by the side door.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx): Slide 4 — Train eight advisers first. Speaker notes: Use the mock till during rehearsal.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx): Slide 5 — Keep €6,200 in reserve. Speaker notes: none
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx): Slide 6 — Review the pilot after 17 days. Speaker notes: Bring the blue tally sheet to the review.
- [Findings draft v2](04%20Drafts/Findings%20draft%20v2.docx): Cost per visit is six times the cost per call.
- [Proposal phase 2 v3](04%20Drafts/Proposal%20phase%202%20v3.docx): A twelve-week phase to design the three branch sizes with staff, test an app desk in two branches, and plan the first moves.
- [Workshop notes 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx): Advice, not transactions, is why people still come.

### Unreadable Documents
- Confidential appendix.docx: Couldn't read Confidential appendix.docx: it has a password. Open it in Word, or save a copy without the password.
- Branch visit form, Riverside (scan).pdf: Branch visit form, Riverside (scan).pdf is a scan with no text (1 page). Open it in the PDF viewer.
```

**Step labels**

- Looked in the project folder: 10 Word documents, 2 PDFs, 1 PowerPoint deck
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Read Engagement brief
- Read Interview – two tellers, Harbour Street
- Read Interview – branch manager, Riverside
- Read Interview – head of operations
- Read Interview – customer service lead
- Read Decision briefing · 6 slides
- Read Findings draft v2
- Read Proposal phase 2 v3
- Couldn't open Confidential appendix · it has a password
- Read Workshop notes 14 October

**Links tried**

All 19 links opened the intended document, and none included a `#q` passage link.

- Opened the right document — 19/19 (100.0%)
- Include a passage target — 0/19 (0.0%)
- Confirmed to land on the claim — 0/19 (0.0%)

- Engagement brief — `01%20Brief/Engagement%20brief.docx` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Steering group minutes 21 October — `Steering%20group%20minutes%2021%20October.docx` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Steering group minutes 21 October — `Steering%20group%20minutes%2021%20October.docx` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Annual report 2025, branch section — `Reference/Annual%20report%202025,%20branch%20section.pdf` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage no — lands on the claim no
- Engagement brief — `01%20Brief/Engagement%20brief.docx` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers,%20Harbour%20Street.docx` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Interview – branch manager, Riverside — `02%20Interviews/Interview%20%E2%80%93%20branch%20manager,%20Riverside.docx` — opened 02 Interviews/Interview – branch manager, Riverside.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage no — lands on the claim no
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage no — lands on the claim no
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage no — lands on the claim no
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage no — lands on the claim no
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage no — lands on the claim no
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage no — lands on the claim no
- Findings draft v2 — `04%20Drafts/Findings%20draft%20v2.docx` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Proposal phase 2 v3 — `04%20Drafts/Proposal%20phase%202%20v3.docx` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage no — lands on the claim no
- Workshop notes 14 October — `03%20Workshop/Workshop%20notes%2014%20October.docx` — opened 03 Workshop/Workshop notes 14 October.docx — opens the right document yes — find marked a passage no — lands on the claim no

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — fail
5. Password notice and way forward — pass
6. Source style — pass

#### Run 2

- Date — 2026-11-26T18:53:41.219Z
- Build — 2.3.0 dev (849aa6677255d522907342424d94449fb1aa3fcc)
- Model — OpenCode · Gemini 3.5 Flash Lite
- Question — Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.
- Completed read fold — None recorded.
- Password document's line — Confidential appendix.docx: Could not be read because it has a password. Open it in Word or save a copy without the password.

**Answer (verbatim)**

```markdown
Here is an overview of the findings from the Fernhollow Bank review documents, along with recommendations for the steering group:

### Overview of Findings

The review highlights that branch visits fell 31% over three years while digital share reached 87%, yet remaining visits are longer and focused on advice rather than simple transactions. Key challenges include high branch visit costs (€18.40 vs €3.10 for calls), aging infrastructure, and disconnected communication systems between branches and the call centre. Phase 2 of the project proposes a 12-week design and pilot programme costing €79,000.

### Document Findings and Recommendations

- [Steering group minutes 21 October](Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board%27s%20decision): Phase 2 waits for the board's decision on 18 November.
- [Workshop notes 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door): Participants voted strongly in favour of an app desk at the door and sharing managers for small branches.
- [Findings draft v2](04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call): Cost per visit is six times the cost per call.
- [Proposal phase 2 v3](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%80%a879%2C000): The proposed Phase 2 fee is €79,000 plus VAT, valid until 31 December 2026.
- Confidential appendix.docx: Could not be read because it has a password. Open it in Word or save a copy without the password.
- [Engagement brief](01%20Brief/Engagement%20brief.docx#q=Fernhollow%20Bank%20runs%2042%20branches): Fernhollow Bank currently runs 42 branches.
- [Annual report 2025, branch section](Reference/Annual%20report%202025,%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million): Branch visits dropped to 2.1 million in 2025.
- Branch visit form, Riverside (scan).pdf: A scanned PDF with no text. Open it in the PDF viewer.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers,%20Harbour%20Street.docx#q=busiest%20hour%20is%20lunchtime): The busiest hour at Harbour Street branch is lunchtime.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager,%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day): Riverside sees about 140 visits a day, half of them older customers paying bills.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit%20at%20%E2%82%AC18.40): Operations counts cost per visit at €18.40 against €3.10 for a call.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled): Calls about card disputes doubled since the app change in May.

### Presentation Breakdown

- [Slide 1](04%20Drafts/Decision%20briefing.pptx#p=1&q=Pilot%20scope): Start with three branch types. Speaker notes: Use the amber ledger for the pilot register.
- [Slide 2](04%20Drafts/Decision%20briefing.pptx#p=2&q=Advice): Reserve the quiet room on Tuesdays. Speaker notes: Test the queue buzzer before opening.
- [Slide 3](04%20Drafts/Decision%20briefing.pptx#p=3&q=Access): Keep the west entrance open. Speaker notes: Place the folding ramp by the side door.
- [Slide 4](04%20Drafts/Decision%20briefing.pptx#p=4&q=Staffing): Train eight advisers first. Speaker notes: Use the mock till during rehearsal.
- [Slide 5](04%20Drafts/Decision%20briefing.pptx#p=5&q=Budget): Keep €6,200 in reserve. Speaker notes: none
- [Slide 6](04%20Drafts/Decision%20briefing.pptx#p=6&q=Follow-up): Review the pilot after 17 days. Speaker notes: Bring the blue tally sheet to the review.

### Recommended Next Decisions
1. Proceed with the board review on 18 November to approve Phase 2.
2. Request a password-free copy of the confidential appendix for complete visibility.
```

**Step labels**

- Looked in the project folder: 10 Word documents, 1 PowerPoint deck, 2 PDFs
- Read Steering group minutes 21 October
- Read Workshop notes 14 October
- Read Findings draft v2
- Read Proposal phase 2 v3
- Couldn't open Confidential appendix · it has a password
- Read Engagement brief
- Read Annual report 2025, branch section · 1 page
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Read Interview – two tellers, Harbour Street
- Read Interview – branch manager, Riverside
- Read Interview – head of operations
- Read Interview – customer service lead
- Read Decision briefing · 6 slides

**Document findings to check**

- Engagement brief

**Links tried**

The link for Interview – branch manager, Riverside targeted the wrong document path. An extra comma in the filename prevented it from opening.

- Opened the right document — 15/16 (93.8%)
- Include a passage target — 16/16 (100.0%)
- Confirmed to land on the claim — 0/16 (0.0%)

- Steering group minutes 21 October — `Steering%20group%20minutes%2021%20October.docx#q=Phase%202%20waits%20for%20the%20board%27s%20decision` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Workshop notes 14 October — `03%20Workshop/Workshop%20notes%2014%20October.docx#q=App%20desk%20at%20the%20door` — opened 03 Workshop/Workshop notes 14 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings draft v2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal phase 2 v3 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%80%a879%2C000` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Engagement brief — `01%20Brief/Engagement%20brief.docx#q=Fernhollow%20Bank%20runs%2042%20branches` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Annual report 2025, branch section — `Reference/Annual%20report%202025,%20branch%20section.pdf#p=1&q=Branch%20visits%3A%202.1%20million` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers,%20Harbour%20Street.docx#q=busiest%20hour%20is%20lunchtime` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – branch manager, Riverside — `02%20Interviews/Interview%20%E2%80%93%20branch%20manager,%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day` — opened none — opens the right document no — find marked a passage no — lands on the claim to check
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Operations%20counts%20cost%20per%20visit%20at%20%E2%82%AC18.40` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Slide 1 — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Pilot%20scope` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Slide 2 — `04%20Drafts/Decision%20briefing.pptx#p=2&q=Advice` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Slide 3 — `04%20Drafts/Decision%20briefing.pptx#p=3&q=Access` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Slide 4 — `04%20Drafts/Decision%20briefing.pptx#p=4&q=Staffing` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Slide 5 — `04%20Drafts/Decision%20briefing.pptx#p=5&q=Budget` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Slide 6 — `04%20Drafts/Decision%20briefing.pptx#p=6&q=Follow-up` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check

**Criteria**

1. Document coverage — to check
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — fail
5. Password notice and way forward — pass
6. Source style — pass

#### Run 3

- Date — 2026-11-26T18:54:12.810Z
- Build — 2.3.0 dev (849aa6677255d522907342424d94449fb1aa3fcc)
- Model — OpenCode · Gemini 3.5 Flash Lite
- Question — Review the whole folder, including its subfolders, for the steering group. Keep the files as they are. Give a short overview of the findings and recommend the next decisions. Include one bullet per document, using its title without the path or file extension, and give a concrete finding from each document. If you could not read a document, name it on its own line, explain why, and say how I can make it readable. For the presentation, add one bullet per slide beginning with “Slide” and its number. Give a fact from the slide, then write “Speaker notes:” followed by a fact from its notes on the same line, or say “Speaker notes: none” if it has none. In the answer, name each source in the sentence and link that name to the passage or slide supporting the claim. Use document titles in the link text and keep source numbers, bracketed filenames and visible file paths out of the answer.
- Completed read fold — None recorded.
- Password document's line — Confidential appendix.docx couldn't be read because it has a password. Open it in Word, or save a copy without the password.

**Answer (verbatim)**

```markdown
Here is a short overview of the findings from the review folder, along with recommended next decisions for the steering group.

### Overview and Recommendations
The review shows that while branch visits have declined significantly and digital payments have reached 87%, remaining branch visits are longer and focused on advice and help with digital services. However, operational silos—such as disconnected case notes between branches and call centers—and aging infrastructure create friction. We recommend approving the phase 2 proposal to design the new branch formats and test an app desk, while finalizing the board findings by 11 November.

### Document Findings
- [Steering group minutes 21 October](Steering%20group%20minutes%2021%20October.docx#q=final%20findings%20by%2011%20November) notes that Kestrel will deliver the final findings by 11 November.
- [Annual report 2025, branch section](Reference/Annual%20report%202025,%20branch%20section.pdf#p=1&q=Digital%20share%20of%20payments%3A%2087%25) states that the digital share of payments is 87%.
- Branch visit form, Riverside (scan).pdf is a scanned PDF with no readable text. Open it in the PDF viewer.
- [Engagement brief](01%20Brief/Engagement%20brief.docx#q=Visits%20fell%2031%25%20in%20three%20years) notes that visits fell 31% in three years while call volumes rose.
- [Interview – two tellers, Harbour Street](02%20Interviews/Interview%20%E2%80%93%20two%20tellers,%20Harbour%20Street.docx#q=busiest%20hour%20is%20lunchtime) states that the busiest hour for tellers is lunchtime.
- [Interview – branch manager, Riverside](02%20Interviews/Interview%20%E2%80%93%20branch%20manager,%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day) notes that Riverside sees about 140 visits a day, half of them older customers paying bills.
- [Interview – head of operations](02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Cost%20per%20visit%20is%20%E2%82%AC18.40) states that operations counts the cost per visit at €18.40 against €3.10 for a call.
- [Interview – customer service lead](02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled) notes that calls about card disputes doubled since the app change in May.
- Confidential appendix.docx couldn't be read because it has a password. Open it in Word, or save a copy without the password.
- [Workshop notes 14 October](03%20Workshop/Workshop%20notes%2014%20October.docx#q=Advice%2C%20not%20transactions) notes that advice, not transactions, is why people still come.
- [Findings draft v2](04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call) states that the cost per visit is six times the cost per call.
- [Proposal phase 2 v3](04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT) outlines a total fee of €79,000 plus VAT for the phase 2 proposal.
- [Decision briefing](04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types)
  - Slide 1: Start with three branch types. Speaker notes: Use the amber ledger for the pilot register.
  - Slide 2: Reserve the quiet room on Tuesdays. Speaker notes: Test the queue buzzer before opening.
  - Slide 3: Keep the west entrance open. Speaker notes: Place the folding ramp by the side door.
  - Slide 4: Train eight advisers first. Speaker notes: Use the mock till during rehearsal.
  - Slide 5: Keep €6,200 in reserve. Speaker notes: none
  - Slide 6: Review the pilot after 17 days. Speaker notes: Bring the blue tally sheet to the review.
```

**Step labels**

- Looked in the project folder: 10 Word documents, 2 PDFs, 1 PowerPoint deck
- Read Steering group minutes 21 October
- Read Annual report 2025, branch section · 1 page
- Couldn't open Branch visit form, Riverside (scan) · a scan with no text
- Read Engagement brief
- Read Interview – two tellers, Harbour Street
- Read Interview – branch manager, Riverside
- Read Interview – head of operations
- Read Interview – customer service lead
- Read Decision briefing · 6 slides
- Read Findings draft v2
- Read Proposal phase 2 v3
- Couldn't open Confidential appendix · it has a password
- Read Workshop notes 14 October

**Links tried**

The link for Interview – branch manager, Riverside targeted the wrong document path. An extra comma in the filename prevented it from opening.

- Opened the right document — 10/11 (90.9%)
- Include a passage target — 11/11 (100.0%)
- Confirmed to land on the claim — 0/11 (0.0%)

- Steering group minutes 21 October — `Steering%20group%20minutes%2021%20October.docx#q=final%20findings%20by%2011%20November` — opened Steering group minutes 21 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Annual report 2025, branch section — `Reference/Annual%20report%202025,%20branch%20section.pdf#p=1&q=Digital%20share%20of%20payments%3A%2087%25` — opened Reference/Annual report 2025, branch section.pdf — opens the right document yes — find marked a passage yes — lands on the claim to check
- Engagement brief — `01%20Brief/Engagement%20brief.docx#q=Visits%20fell%2031%25%20in%20three%20years` — opened 01 Brief/Engagement brief.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – two tellers, Harbour Street — `02%20Interviews/Interview%20%E2%80%93%20two%20tellers,%20Harbour%20Street.docx#q=busiest%20hour%20is%20lunchtime` — opened 02 Interviews/Interview – two tellers, Harbour Street.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – branch manager, Riverside — `02%20Interviews/Interview%20%E2%80%93%20branch%20manager,%2C%20Riverside.docx#q=Riverside%20sees%20about%20140%20visits%20a%20day` — opened none — opens the right document no — find marked a passage no — lands on the claim to check
- Interview – head of operations — `02%20Interviews/Interview%20%E2%80%93%20head%20of%20operations.docx#q=Cost%20per%20visit%20is%20%E2%82%AC18.40` — opened 02 Interviews/Interview – head of operations.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Interview – customer service lead — `02%20Interviews/Interview%20%E2%80%93%20customer%20service%20lead.docx#q=Calls%20about%20card%20disputes%20doubled` — opened 02 Interviews/Interview – customer service lead.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Workshop notes 14 October — `03%20Workshop/Workshop%20notes%2014%20October.docx#q=Advice%2C%20not%20transactions` — opened 03 Workshop/Workshop notes 14 October.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Findings draft v2 — `04%20Drafts/Findings%20draft%20v2.docx#q=Cost%20per%20visit%20is%20six%20times%20the%20cost%20per%20call` — opened 04 Drafts/Findings draft v2.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Proposal phase 2 v3 — `04%20Drafts/Proposal%20phase%202%20v3.docx#q=Total%3A%20%E2%82%AC79%2C000%20plus%20VAT` — opened 04 Drafts/Proposal phase 2 v3.docx — opens the right document yes — find marked a passage yes — lands on the claim to check
- Decision briefing — `04%20Drafts/Decision%20briefing.pptx#p=1&q=Start%20with%20three%20branch%20types` — opened 04 Drafts/Decision briefing.pptx — opens the right document yes — find marked a passage yes — lands on the claim to check

**Criteria**

1. Document coverage — pass
2. Speaker notes — pass
3. Step labels — pass
4. Passage links — fail
5. Password notice and way forward — pass
6. Source style — pass

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
