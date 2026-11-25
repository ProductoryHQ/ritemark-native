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

For ChatGPT, use `--require openai` with `--ai chatgpt`. For OpenCode, use `--require gemini` with `--ai opencode`. The existing launcher and vault wrapper are Mac-only. Windows needs the Gate 2 isolated launcher and vault wrapper before its scripted runs. Paste the generated Markdown into the matching run below. Keep the JSON with the evidence.

1. All 13 documents have a matching fact or an explicit, valid unread reason. The fixture has two known unread cases (the scan and the confidential appendix).
2. The notes belong to their own slides and slide 5 is explicitly reported as having none.
3. Every visible step label names a document or folder. Commands and paths fail this check.
4. All source links open the right document and at least 90% land on the passage supporting the claim. Check the passage or slide yourself and record a yes or no for each link. A find match alone does not establish that the passage supports the claim.
5. The confidential appendix is named, described as having a password, and accompanied by a way forward.
6. The visible answer has no numbered sources, bracketed filenames or paths.

Fill all six criteria with pass or fail. Each AI needs three passing runs out of three on each platform. After a failure, retain its evidence and start a fresh set after the fix. G2 opens the Word and PDF starting points per AI after it passes on Mac and keeps them on if Windows also passes at Gate 2.

## Run records

### Claude on Mac

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
