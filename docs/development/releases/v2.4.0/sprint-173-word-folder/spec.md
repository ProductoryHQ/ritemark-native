# Sprint 173 spec: Word folder, ready for any AI

The drawing is the source of truth for what people see: `product/design/experience/experiences/wordfolder/README.md` (Experience lead, 22 November 2026, experience 50). Sources are shown as words (way C, frame 7, Jarmo's choice). Where this spec and the drawing differ, the drawing wins and the difference is an open question in `sprint-plan.md`.

A "document" below is a `.docx`, a `.pdf` or a `.pptx` inside the project's folders. A "unit" is a PDF page or a slide. An "AI" is Claude (Claude Code), ChatGPT (Codex) or OpenCode.

## What ships

**R1. One reading tool for every AI.** Ritemark offers one tool, `read_document`, defined once in `src/runtime/ritemarkTools.ts` and handed to all three AIs through `RitemarkToolsInjector`. Same name, same input, same output text for all three. It is on whenever the window has a project folder. It is read-only.

**R2. What the tool returns.** Input: a path, and optionally a first and last unit. Output is Markdown and starts with one header line: the document's name, its kind, its number of units, and whether the text is whole or cut (and where).
- Word: headings as `#` headings, lists as lists, tables as Markdown tables.
- PDF: each page under `## Page N`, N as printed by the PDF viewer (1-based).
- PowerPoint: each slide under `## Slide N`, then its text, then `Notes:` and its speaker notes, or `Notes: none` when the slide has none.

**R3. Slide notes stay with their slide.** The notes belong to a slide by the slide's own relationship, never by counting notes files. A slide without notes says `Notes: none`; its neighbours' notes never move onto it.

**R4. What can't be read is said, never skipped.** For a password, a damaged file, an older format (`.doc`, `.ppt`), a file past the size limit, a file kept online only, and a PDF with no text (a scan), the tool answers in plain words: what happened and what the person can do (a password: open it in Word, or save a copy without the password). A cut text says where it was cut. The tool never answers with empty text or a silent part.

**R5. Only the project's documents.** The path must resolve (after symlinks, `..` and Windows drive and case rules) to a file inside one of the project's folders. Anything else is refused in words. The tool never writes, never downloads an online-only file and never uses the network.

**R6. Steps name documents, never commands** (drawing, decision 2). A step for a read shows "Read <document name>" with the document kind's icon; a look at a folder shows "Looked in <folder>: N Word documents". A step that couldn't read is a warning step: "Couldn't open <name> · it has a password". Commands and paths stay in the step's detail. The folded line after the answer says what was read: "Read 4 Word documents · 18 s". This holds for the tool and for an AI's own reads (Claude's Read, a shell command Codex runs): a shell command shows a neutral line, never the command.

**R7. The AI names its source in the sentence.** Each AI is told (Ritemark's capability text, same for all three) to read documents with `read_document` first, to name the source in the sentence as a person writing a report would ("the head of operations would start with…"), and to link that name to the passage it read, using the passage's own words. Never a number, a bracketed file name or a path.

**R8. A source name is a link to its passage.** The link carries the document, the unit (page or slide) and the quoted words. Drawn as ink with a soft accent underline, accent on hover. Hover shows the document's name, the page or slide, and the passage, with "Open at this passage". A click opens the document in a tab of its own, scrolled to the passage, which is marked for a moment as search marks a find (`find:open`). If the quoted words can't be found in the document, it opens at its top and the hover says so. The link works for Word, PDF and Markdown documents; a slide link opens the deck's preview on that slide.

**R9. Word's equations arrive as math** (#547). Wherever a Word document becomes text, its equations become LaTeX: `$…$` in a line, `$$…$$` on their own. This covers `read_document`'s output and the Word preview's Save as Markdown. An equation that can't be converted keeps its plain text between the marks and the tool's header line counts it ("2 equations approximate"). The converter is written in-house, with no new dependency.

**R10. No new words leave the machine.** The tool sends nothing outside the AI's own turn. Usage events carry counts and the kind only, never a name, path, words or model.

## What is a gate

**G1. The reading test, per AI.** Folder: the Fernhollow Bank review folder (`/Users/Shared/Ritemark/Fernhollow Bank review`: 9 Word documents, a text PDF, a scan), plus one password-protected Word document and one PowerPoint deck of at least 6 slides where slide 5 has no speaker notes. Each AI runs three times on Mac and three times on Windows. A **run passes** only when all of these hold:
1. Every document in the folder is read, or named in the answer as unread with its reason: 12 of 12 (the 11 files, the password document) plus the deck, so 13 of 13. A document neither read nor named counts as failed.
2. Every slide's notes stay with their slide: 0 misplaced notes; slide 5 is reported as having none.
3. Every step's visible label names a document or a folder: 0 steps that show a command or a path as their label.
4. Every source named in the answer links to its passage and the link opens it: 100% of links open the right document, and at least 90% land on a passage that contains the claim (checked by the person running the test).
5. The password document is reported with "it has a password" and the way forward.
6. The answer has no numbers as sources, no bracketed file names and no paths.

An **AI passes** on a platform when 3 of 3 runs pass there. Stricter than Sprint 140's spike (PDF 5 of 6): one failed run means the AI fixes the cause and runs three again. The record of each run (what was asked, the answer, the step labels, the links tried) goes in `research/reading-test.md`.

**G2. The starting points open per AI.** A Word document's or PDF's own starting points ("Summarise this in five points" and the two others) turn on for an AI once G1 passed for it on the Mac, and stay on only if it also passes on Windows at Gate 2. The code is `READ_KINDS_EVERY_AI_PASSED` in `src/guidance/startingPlace.ts`; this sprint makes it one entry per AI (see open question 1).

**G3. Release.** Gate 1 on the arm64 candidate and Gate 2 on x64 and Windows (the release plan). The reading test's Windows runs are Gate 2's.

## Not changing

Home keeps its card and its first request ("11 files: 9 Word documents and 2 PDFs"); the drawing confirms this. The AIs may still read a file their own way. The search index and its cache are untouched in what they find.

## Out of scope

The meaning layer (#591). Excel (#971). Reading `.xlsx`, `.doc`, `.ppt`, images or `.rtf`. Rendering a scan's pages as pictures inside the tool (open question 3). Suggestions or edits to a Word file.
