# Sprint 173 scenarios

Given/when/then, one group per requirement. They become the tests and the manual matrix. Fixtures are synthetic (the Fernhollow folder plus the two made for G1); a fixture carries no real name (scrub `cp:lastModifiedBy`).

## R1, R2: the tool, the same for every AI
- **S1.** Given a project with `Interview – head of operations.docx`, when Claude, ChatGPT or OpenCode asks `read_document` for it, then each gets the same Markdown, headings as `#`, a list as a list, a table as a table, and the same header line.
- **S2.** Given a 12-page PDF, when the tool reads it, then the text has `## Page 1` to `## Page 12` and the header says "12 pages".
- **S3.** Given a PDF and the input "pages 3 to 4", then only those two pages come back and the header says so.
- **S4.** Given a window with no project folder, then the tool is not offered to any AI.

## R3: slide notes
- **S5.** Given a 6-slide deck where slides 1 to 4 and 6 have notes and slide 5 has none, when it is read, then `## Slide 5` ends with `Notes: none`, slide 4 holds only slide 4's notes and slide 6 only slide 6's.
- **S6.** Given a deck whose notes parts are numbered out of order (notesSlide2 belongs to slide 6), then each slide still gets its own notes.
- **S7.** Given a deck with no notes at all, then every slide says `Notes: none`.

## R4: what can't be read
- **S8.** Given a password-protected Word document, then the tool says "it has a password" and "open it in Word, or save a copy without the password"; the AI's answer says the same in its words and still answers from the others.
- **S9.** Given a damaged `.docx` (a cut zip), then the tool says it is damaged. Given a `.doc`, then it says it is an older format.
- **S10.** Given a file over the size limit (50 MB for Word and PDF), then the tool says it is too big, never an empty text.
- **S11.** Given a scan (a PDF with almost no text), then the tool says "a scan with no text" and the page count.
- **S12.** Given a file kept online only (OneDrive, iCloud), then the tool says so and does not download it.
- **S13.** Given a text cut at the limit, then the header and the end of the text say where ("cut after page 140 of 212").

## R5: only the project's documents
- **S14.** Given `../../secret.docx`, an absolute path outside the project, or a symlink inside the project that points outside, then the tool refuses in words and reads nothing.
- **S15.** Given a Windows path with another case or the other slash (`reference\Annual Report.pdf`), then it resolves to the same file inside the project.
- **S16.** Given a path that is a folder or a `.md`, then the tool says what it reads and where a `.md` can be read.

## R6: steps
- **S17.** Given Claude reads four interviews with the tool, then the steps read "Read Interview – branch manager, Riverside" and so on, each with the Word icon, and after the answer one line "Read 4 Word documents · 18 s".
- **S18.** Given ChatGPT runs `textutil -convert txt …` itself, then its step reads "Reading documents" and the command is in the step's detail, never in its label.
- **S19.** Given the password document, then its step is a warning: "Couldn't open Contract 2025, signed · it has a password".
- **S20.** Given a look at a folder, then the step reads "Looked in Reference: 3 Word documents".

## R7: the AI's instructions
- **S21.** Given a question about four documents, then the capability text each AI receives is word for word the same on this point and says: read with `read_document` first, name the source in the sentence, link the name, no numbers, no brackets, no paths.
- **S22.** Given the capability text version changes, then a conversation started before re-reads it (as `CAPABILITY_CONTEXT_VERSION` does today).

## R8: links
- **S23.** Given "the head of operations would start with…" linked to the interview with the quoted words and page, when the person hovers, then a card shows the document's name, the page and the passage, and "Open at this passage".
- **S24.** Given that link, when clicked, then the Word preview opens in a tab of its own scrolled to the passage, marked for a moment; the link in the answer shows as the current one.
- **S25.** Given a PDF link with page 4, then the PDF preview opens on page 4 with the words marked; if the words moved, page 4 still opens.
- **S26.** Given a slide link ("the deck's slide 5"), then the deck's preview opens on slide 5.
- **S27.** Given quoted words missing from the document, the hover card shows those words in muted ink and says “These words aren't in the document.” Its action opens the cited page or slide, or opens the document if the link gives no page. Clicking the source link itself keeps the existing fallback to the top in Word and PDF.
- **S28.** Given a link to a file outside the project, to `javascript:` or `command:`, or with quoted words over 200 characters or with control characters, then it opens nothing at a passage; an outside file is explained as today, and quoted words are dropped.
- **S29.** Given Codex cites a file with `:codex-file-citation{path=…}` (no passage), then it still opens the file at its top as today.
- **S30.** Given the person clicks away or presses Esc while the hover card is open, then it closes (REVIEW.md: popups close on outside click and Esc).

## R9: equations
- **S31.** Given a Word document with the fraction a over b, a square root, a sum with limits and a matrix, then the Markdown has `$\frac{a}{b}$`, `$\sqrt{x}$`, `$\sum_{i=1}^{n}$` and a matrix in LaTeX, and the Markdown editor draws them.
- **S32.** Given an equation on its own line (`m:oMathPara`), then it is written as `$$…$$`.
- **S33.** Given an equation the converter doesn't know, then its plain text stays between `$` marks and the header counts "1 equation approximate".
- **S34.** Given a Word document with no equations, then its Markdown is byte-for-byte what it was before the converter.
- **S35.** Given the Word preview's Save as Markdown on a document with equations, then the saved file has the same LaTeX as `read_document` gave.
- **S36.** Round trip: a document exported by Ritemark (Sprint 138's `mathToWord`) and read back gives the original LaTeX for every equation in `src/export/v2/fixtures/mathCorpus.ts` that has a LaTeX form.

## R10: privacy
- **S37.** Given a read, then the usage event holds the kind and a count only; a test fails if it holds a name, a path, a word or a model.

## G1: the reading test, one run
- **S38.** Given the Fernhollow folder, the password document and the deck, when the person asks "What do the four interviews say about starting a customer visit?" (and in a second run "What is in this folder?", in a third "Summarise the deck's speaker notes"), then the run is judged by the six criteria in the spec and recorded in `research/reading-test.md`.

## G2: starting points
- **S39.** Given Claude has passed and ChatGPT has not, when a Word document is in front and Claude is chosen, then the AI column offers the Word document's three starting points; when ChatGPT is chosen it offers the project's.
- **S40.** Given an AI that passed on the Mac and failed on Windows at Gate 2, then its Word starting points are off on Windows and on on the Mac (open question 1).
