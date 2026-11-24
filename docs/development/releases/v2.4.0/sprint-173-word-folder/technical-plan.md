# Sprint 173 technical plan

Everything lives in `extensions/ritemark/` (paths below are under it unless they start at the root). Nothing is a patch, a binary, a workflow or a build script.

## What exists, and what it lacks

| Exists | Where | What it gives | What it lacks for this sprint |
| --- | --- | --- | --- |
| The readers | `src/search/worker/readers/index.ts` (`readDocument`, `formatOf`, `documentName`), `docx.ts` (`readDocx`, `documentXmlPassages`), `pdf.ts` (`readPdf`), `types.ts` (`ReadOutcome`, `Passage`, `PassageSink`, reasons `protected`, `scanned`, `unreadable`, `too-large`) | Word text by paragraph and cell, PDF text by page, the reasons a file can't be read, the package checks (`officePreview/officePackageCheck.ts`: `checkOfficePackage`, `readZipDirectory`, `readZipEntry`) | **The drawing says search keeps "headings, lists and tables as Markdown". It does not**: a Word passage is one flat paragraph or cell (`block` index only), with no heading level, list marker or table shape, and no equations. There is no `.pptx` reader at all (`formatOf` has no `.pptx`, `DocumentFormat` is `markdown | csv | docx | pdf`). So `read_document` needs a reading mode of its own beside the passage mode, built on the same zip and PDF code. |
| The worker | `src/search/worker/searchWorker.ts`, `SearchHost.ts` (`passages`, `map`), `searchWorkerClient.ts`, `protocol.ts` (`HostToWorkerMessage`) | A worker with a 512 MB heap cap where documents are read, a cache (`textCache.ts`) outside the project | Search only runs when project search is enabled and stops at limits (`DEFAULT_SEARCH_LIMITS`: 50 MB per Word or PDF). `read_document` must not depend on the index being ready. |
| The tools registry | `src/runtime/ritemarkTools.ts` (`RitemarkTool`, `RitemarkToolGroup`, `ToolGroupId = 'browser' \| 'board' \| 'deck'`, `toolGroupsFor`, `toolGroupById`, `runTool`), `src/runtime/RitemarkToolsInjector.ts` | One definition, three wirings (Claude in-process MCP, Codex dynamic tools, OpenCode via `browser/browserMcpAdapter.ts`) | A `documents` group. |
| The capability text | `src/ai/capabilityContext.ts` (`CapabilityDescriptor`, `capabilityDescriptorFor`, `renderCapabilityContext`, `CAPABILITY_CONTEXT_VERSION = 5`) | The one text each runtime receives about Ritemark's tools | Reading and naming-sources instructions. |
| Open at a passage | `src/search/findAtPassage.ts` (`FindOpenMessage`, `findOpenMessage`, `FindRequests`, `findRequests`), handled by `ritemarkEditor.ts`, `pdfEditorProvider.ts`, `officePreview/officePreviewProvider.ts`; page side `webview/src/utils/findRequest.ts`, `DOCXViewer.tsx`, `PDFViewer.tsx` | `find:open` with text, occurrence and (PDF) page | It takes a `SearchResult`; a chat link has none. Slides have no find. |
| Chat links | `webview/src/components/ai-sidebar/chatLinks.ts` (`classifyChatHref`, `rewriteCodexCitations`, `chatLinkMenu`), `RenderedMarkdown` | A path link opens the file at its top; Codex citations become links | A passage on a link, a hover card. |
| Steps | `webview/src/components/ai-sidebar/ActivityCard.tsx`, `store.ts`, `types.ts`, `backgroundWork.ts` | Icons by tool name (`Bash` terminal icon) | Names by document. |
| Starting points | `src/guidance/startingPlace.ts` (`READ_KINDS_EVERY_AI_PASSED = { word: false, pdf: false }`, `startingPlaceOf`), `readyRequest.ts`, `folderCounts.ts` | The gate and the place a Word or PDF in front gets | One flag for all AIs. |
| Word to Markdown | Preview: `webview/src/components/viewers/DOCXViewer.tsx` (mammoth `convertToHtml`), `webview/src/utils/turndownService.ts`, `src/export/saveAsMarkdown.ts` (`saveAsMarkdownHandler`). Equations seen: `webview/src/components/viewers/docx/docxXml.ts` (`m:oMath` detection only). Markdown to Word: `src/export/v2/mathToWord.ts` + `fixtures/mathCorpus.ts` | The other direction and its corpus | No OMML to LaTeX anywhere. mammoth drops OMML. |
| Search readers' pdf and docx limits | `officePreview/officePackageCheck.ts` (`OFFICE_PREVIEW_LIMITS`) | Bomb and size checks | Reused unchanged. |

## Design

### 1. `read_document` (R1 to R5)
- New group `documents` in `ritemarkTools.ts` (`ToolGroupId` gains `'documents'`, `createDocumentToolGroup(host)`, `toolGroupById` and `toolGroupsFor` learn it). It is available when the window has a project folder, like the deck tools (`setDocumentToolHost`, set by the search host or `extension.ts`). No runtime-specific code: Claude's `claudeAllowName`, Codex's `codexToolName`, OpenCode's adapter all come from the one definition. Test: `ritemarkTools.test.ts` gets the same assertion the other groups have (the three wirings list the same tool with the same schema).
- Input (zod): `path: string`, `from?: number`, `to?: number`. Output: `ToolResult.text` (Markdown, R2); a refusal or an unreadable file is `text` in plain words with `isError` false for a document-level reason (so the AI answers from the rest) and true only for a refused path or bad input.
- Path check (R5): a pure helper `resolveProjectDocument(path, roots)` in a new `src/documents/projectPath.ts`: realpath, root containment, Windows case and drive rules. Never reads before it passes. Reuse `workspaceFileLinks.ts` if it already resolves links against the project (it handles chat file links; the PR reads it first and extends it rather than writing a second resolver).
- Reading mode: a new `src/documents/readAsMarkdown.ts` (pure over bytes, no `vscode` import, run in the search worker so the extension host's heap stays small). It reuses `checkOfficePackage` / `readZipDirectory` / `readZipEntry` and `readPdf`'s page loop. New message `{ type: 'read'; requestId; path; from?; to? }` in `protocol.ts` / `searchWorkerClient.ts` / `searchWorker.ts`, answered even when the index isn't built (the worker reads the file itself). It leaves `READER_VERSION` and the passage cache alone: the reading mode is not cached on disk, only held in memory by path and modification time.
  - Word: a Markdown writer over `word/document.xml` (heading levels from `w:pStyle` `Heading1…`, lists from `w:numPr`, tables from `w:tbl`). A document that styles headings by hand (bold text) reads as plain paragraphs; that is acceptable and stated.
  - PDF: page by page with the existing `pause` hook; same `scanned` rule as search (almost no text).
  - PowerPoint (R3): `ppt/presentation.xml` gives the slide order (`p:sldId` with `r:id`), `ppt/_rels/presentation.xml.rels` gives each slide's part, `ppt/slides/_rels/slideN.xml.rels` gives that slide's `notesSlide` relationship if any. Notes text comes from the related part only. This is the structural cure for the 23 November failure; counting `notesSlideN` files is never used. Slide text: title and body shapes in reading order, tables as Markdown.
- Limits: 50 MB for Word and PDF (the search limits), the same for `.pptx`; output capped (about 400 000 characters per call, with `from`/`to` to continue) and cut with a sentence naming where.
- Not read: online-only files are detected the way the search walker does (`search/worker/walk.ts`, the `online-only` reason) and named, not downloaded.

### 2. Equations (R9, #547)
- New pure module `src/documents/ommlToLatex.ts`, written in-house (OMML's elements: `m:f`, `m:rad`, `m:sSup`/`m:sSub`/`m:sSubSup`, `m:nary`, `m:d`, `m:m`, `m:func`, `m:acc`, `m:bar`, `m:eqArr`, `m:r`/`m:t`, with a table of Greek and operator symbols). No dependency, so no esbuild external and no shell-tier cost. Tests run against a corpus built from `src/export/v2/fixtures/mathCorpus.ts` through `mathToWord.ts` (round trip, S36) plus hand-made Word-authored samples.
- Two callers, one converter: `readAsMarkdown.ts` (worker) and the Word preview's Save as Markdown. The preview side is webview code (mammoth to turndown); mammoth drops `m:oMath`, so the webview pre-pass substitutes each equation with a placeholder token that turndown then writes as `$…$`. The module is pure TypeScript with no Node or `vscode` imports so both bundles can import it (the PR confirms how `webview/` reaches `src/` modules today, as `docxXml.ts` shows its own copy of XML helpers; if it cannot, the module is placed under `webview/src/…` and imported by the host through the shared path the build already allows).
- An unknown element keeps its text between `$` marks and is counted for the header (R9).

### 3. Steps (R6)
- Names come from the tool call, not from parsing a command. For `read_document` and, for Claude, `Read`/`Glob`/`LS` on a project document, the sidebar store labels the step with the document's name (`documentName` from `search/worker/readers/index.ts`'s rule) and the icon of its kind. For a shell command (Codex's `commandExecution`, OpenCode's terminal tool) the label is "Reading documents" if the command's arguments name project documents, else the existing label with the command moved to the step's detail. Implementation: `webview/src/components/ai-sidebar/ActivityCard.tsx`, `store.ts`, `types.ts` plus a pure `stepLabel.ts` with tests. The three runtimes already normalise to one step shape (`AgentRuntime` events); if any does not carry the arguments the label needs, the PR adds them in that runtime's event mapper, behind the same interface.
- Unreadable: the tool result carries a machine-readable `reason` the step shows as a warning (the plain words in R4 are the same text).
- The folded line ("Read 4 Word documents · 18 s") is drawn from the same steps.

### 4. Sources as words (R7, R8)
- **Instruction:** a new section in `capabilityContext.ts` read by every runtime, `CAPABILITY_CONTEXT_VERSION` bumped to 6. One text; nothing runtime-specific.
- **Link form:** an ordinary Markdown link: `[the head of operations](Interviews/Head%20of%20operations.docx#p=4&q=<words>)`, where `p` is the page or slide and `q` the percent-encoded words (at most 200 characters, `MAX_FIND_TEXT`). The fragment keeps every runtime's Markdown valid and keeps the link working as a plain file link in any other viewer. `classifyChatHref` parses the fragment (its scheme-less branch today treats the whole href as a path) and returns `{ kind: 'file', path, passage?: { text, page? } }`. Codex's `:codex-file-citation` has no passage and keeps opening at the top (S29).
- **Open:** the webview sends the host `{ path, passage }` over the existing chat file-link message; the host checks the path against the project (the same `resolveProjectDocument`), reads the unit's text through the worker `read` message to find the occurrence of the quoted words (normalised the way both previews' find does), then builds a `FindOpenMessage` and calls `findRequests.request(uriKey, message)`. `findOpenMessage(result)` takes a `SearchResult`, so the PR adds a sibling `findOpenForPassage(text, occurrence, page)` and keeps `findOpenMessage` as it is (search must not change). A deck's slide link posts the slide number to the deck preview's existing message for going to a slide (the PR names it; if none exists it adds one in the pptx provider, `officePreview/officePreviewProvider.ts`).
- **Hover card (PR 5, Experience 50):** Radix anchors the card to the source link, constrains it to the conversation column with 12 px collision padding, and flips it above the link when needed. The head shows the file icon, extensionless name, and kind with page or slide. A found quote comes from the host and has a keyboard-focusable “Open at this passage” link action. For a missing quote, the card draws the link’s own words in muted ink and says “These words aren't in the document.” Its action opens the page or slide cited by the link, or opens the document when there is no page. Outside click and Esc dismiss the card.
- **"The 4 in the answer is filled"** of frame 4 is for way A and is not built; for way C the link in the answer takes the current-link style while its tab is in front, if the Experience lead keeps that (open question 4).

### 5. The gate (G2)
`READ_KINDS_EVERY_AI_PASSED` becomes `READ_KINDS_PASSED: Readonly<Record<AgentId, { word: boolean; pdf: boolean }>>` and `startingPlaceOf` takes the chosen AI. Values stay `false` until a recorded pass in `research/reading-test.md`; one flip per AI is one tiny PR. The `starting_point_used` place names are unchanged.

### 6. The test harness (G1)
Fixtures built by a script in `scripts/` (Standard tier) into a temp folder from the Fernhollow generator the 2.3 picture run used, plus the protected `.docx` (an encrypted OOXML package, made with a free tool, recorded in the research note) and the 6-slide `.pptx` with no notes on slide 5. The runs need launched apps and live AIs: a scripted test run (isolated AI homes, test keys from the manager's vault, `--use-mock-keychain`), not a Codex job.

## Tiers (`REVIEW.md`)

No path in this sprint is on `CLAUDE.md`'s shell-tier list: no `patches/`, `vscode`, `branding/product.json`, `binaries/`, build or signing script, workflow or installer. **Release tier: extension.** (2.4 is a shell release for other reasons, so everything ships with it; an extension release alone would also carry these files, which are all `out/**/*.js`, `media/webview.js` and `package.json`.) No new dependency and no new esbuild external. The worker's bundle already exists; the new modules join it.

| Path | Tier |
| --- | --- |
| `src/runtime/ritemarkTools.ts`, `src/documents/*`, `src/search/*` | Standard |
| `src/ai/capabilityContext.ts` | Standard |
| `webview/src/components/ai-sidebar/*`, `webview/src/components/viewers/*` | Standard, and a change to how a surface looks goes to the Experience lead with its shot |
| `src/guidance/startingPlace.ts` | Standard |
| `src/export/saveAsMarkdown.ts` | Standard. It is not on the High list (`src/editorSync/`, `ritemarkEditor.ts`, document sync files). If a PR touches `src/ritemarkEditor.ts` for `find:open`, it is High (saving and merging a person's documents) and gets `/code-review` at high plus `/security-review`; PR 4 is written to avoid it by reusing the existing `findRequests` and page handlers without editing the editor provider. |
| `docs/`, research notes | Light |

Nothing here writes, merges or deletes a person's document, touches an approval gate, a key, analytics consent or `modelConfig.ts`. The tool is a read; its path check (R5) is the security-relevant piece, so PR 1 asks for a security look from the reviewer even at Standard (path traversal and symlinks), and the proof shows the refusals.

## Invariants kept
- One tool registry, no runtime-specific copy (`CLAUDE.md`; `REVIEW.md` failure list). Approval: read-only tools run through the same allowed-tools wiring as the deck group; no new approval message.
- No model ID outside `modelConfig.ts`: none is added.
- Bundle-safe host code: no `__dirname` depth; the worker entry exists.
- HARD RULE #1: nothing is removed or stubbed; the search readers stay as they are.
- Feature flag: none needed (not experimental, not platform-specific, not premium). The reading test gate is a per-AI constant, not a flag, as `READ_KINDS_EVERY_AI_PASSED` is today.
- `docs/development/architecture.md` is updated at the sprint's end (new `documents` tool group, reading mode in the worker).

## Risks in the design
- **Quoted words that don't match.** An AI quotes from a Markdown rendering, a smart quote becomes straight, a table row becomes a line. Mitigation: find normalises case, quotes and white space the way the tool's own text is written; unmatched quotes open at the top and say so (S27). The reading test measures it (criterion 4).
- **Headings by hand in Word.** Documents that don't use heading styles read as plain text. The AI still reads them; only the structure is thinner.
- **Large PDFs.** The worker reads page by page with `pause`; the tool's cap and `from`/`to` keep one call bounded.
- **Windows.** Path rules, OneDrive (`oneDriveRoots` in `WorkerConfig`), Defender's file-system speed.
- **OpenCode.** Its tools arrive through the stdio MCP adapter; the adapter's process has no search worker, so the adapter forwards the call to the host over its existing IPC like the browser tools do.
