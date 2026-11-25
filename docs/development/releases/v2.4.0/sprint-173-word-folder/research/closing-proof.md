# Sprint 173 closing proof so far

Evidence from the PRs merged into main, as of 25 November 2026. Test paths are
relative to `extensions/ritemark/`. The rows cite existing automated checks
and the recorded PR test window. Native Windows behavior and live AI answers
still need their own runs.

| Scenario | Status | Evidence and limits |
| --- | --- | --- |
| S1 · Same Word Markdown for each AI | pass (test: `src/runtime/ritemarkTools.test.ts`, `src/documents/readAsMarkdown.test.ts`) | Three runtime adapters return the same fixture result. The reader test checks the header, headings, lists and table against a generated Word file. |
| S2 · Whole PDF | pass (test: `src/documents/readAsMarkdown.test.ts`) | Twelve page headings and a twelve-page header. |
| S3 · PDF page range | pass (test: `src/documents/readAsMarkdown.test.ts`) | Pages 3–4 only and a range in the header, including through the bundled worker. |
| S4 · No project folder | pass (test: `src/runtime/ritemarkTools.test.ts`) | The shared registry omits the documents group when unavailable. |
| S5 · Slide 5 has no notes | pass (test: `src/documents/powerpointMarkdown.test.ts`) | Adjacent slides keep their own notes. |
| S6 · Out-of-order notes parts | pass (test: `src/documents/powerpointMarkdown.test.ts`) | Notes follow the slide relationships. |
| S7 · Deck without notes | pass (test: `src/documents/powerpointMarkdown.test.ts`) | Every slide reports no notes. |
| S8 · Password refusal and continued answer | not run: live AI runs await test keys | `src/documents/readAsMarkdown.test.ts` checks the reader’s password message and advice. The AI’s answer and use of the other files remain unverified. |
| S9 · Damaged Word and older format | pass (test: `src/documents/readAsMarkdown.test.ts`) | Cut package and legacy Word fixtures return reasons. |
| S10 · Oversized file | pass (test: `src/documents/readAsMarkdown.test.ts`) | Oversized PDF receives the 50 MB limit message. |
| S11 · Scanned PDF | pass (test: `src/documents/readAsMarkdown.test.ts`) | Scan message includes the page count. |
| S12 · Online-only files | pass (test: `src/documents/readAsMarkdown.test.ts`) | Simulated macOS placeholder and Windows OneDrive refusal. |
| S13 · Text limit | pass (test: `src/documents/readAsMarkdown.test.ts`) | Header and final line name the last returned page or block. |
| S14 · Paths outside the project | pass (test: `src/documents/projectPath.test.ts`, `src/documents/readAsMarkdown.test.ts`) | Traversal, absolute paths and escaping symlinks are refused. |
| S15 · Windows path spelling | pass (test: `src/documents/projectPath.test.ts`) | Simulated Windows paths cover case and slash variants. Native Windows runs remain pending. |
| S16 · Folder and Markdown inputs | pass (test: `src/documents/readAsMarkdown.test.ts`) | Reader names the supported formats and directs Markdown to the editor. |
| S17 · Named Word steps and folded summary | not run: PR 3 is an unshipped draft awaiting test keys | Draft #1000. |
| S18 · Neutral label for shell reads | not run: PR 3 is an unshipped draft awaiting test keys | Draft #1000. |
| S19 · Password warning step | not run: PR 3 is an unshipped draft awaiting test keys | Draft #1000. |
| S20 · Folder step and document count | not run: PR 3 is an unshipped draft awaiting test keys | Draft #1000. |
| S21 · Shared source instructions | pass (test: `src/ai/capabilityContext.test.ts`) | All three runtimes get the same source instructions. |
| S22 · Existing conversation picks up new instructions | pass (test: `src/runtime/continuation.test.ts`) | Older capability versions invalidate saved runtime continuation for all three runtimes. |
| S23 · Hover shows the source passage | pass (test window: PR 5) | Merge commit `20a0f6bb` names the Word and PDF card screenshots. `webview/src/components/ai-sidebar/SourcePassageCard.test.ts` checks the card contents and action. |
| S24 · Word source opens at the marked passage and shows as current | not run: full UI result lacks a recorded check | `src/views/openSourcePassage.test.ts` verifies the host opens the file and requests passage navigation. The preview mark and current-link state together are unverified. |
| S25 · PDF page and marked quote | pass (test: `src/documents/readAsMarkdown.test.ts`, `src/views/openSourcePassage.test.ts`) | Tests cover lookup on the cited page and navigation to the matching page when the words moved. PR 5 changed the original expectation that the cited page still opens. |
| S26 · Link to slide 5 | pass (test: `src/views/openSourcePassage.test.ts`) | The host opens the deck and sends a slide 5 navigation request. |
| S27 · Missing quote and fallback | pass (test: `webview/src/components/ai-sidebar/SourcePassageCard.test.ts`, `src/views/openSourcePassage.test.ts`) | Tests check the missing-quote card, its cited-location action and the direct Word link’s top fallback. |
| S28 · Outside files, unsupported schemes and rejected quotes | pass (test: `src/views/openSourcePassage.test.ts`, `webview/src/components/ai-sidebar/chatLinks.test.ts`) | Tests check the project boundary, blocked schemes and discarded invalid quote fragments. |
| S29 · Existing Codex citation | pass (test: `webview/src/components/ai-sidebar/chatLinks.test.ts`) | The rewritten citation stays a plain file link with no passage request. |
| S30 · Dismiss the card | pass (test: `webview/src/components/ai-sidebar/SourcePassageCard.test.ts`) | The card delegates outside click and Escape to the controlled popover’s tested close callback. |
| S31 · Word equations convert and draw in the editor | not run: the full editor display check lacks a recorded run | `src/documents/ommlToLatex.test.ts` checks conversion. `src/documents/readAsMarkdown.test.ts` checks the Markdown output. |
| S32 · Standalone equation | pass (test: `src/documents/readAsMarkdown.test.ts`) | The Word fixture checks display math delimiters. |
| S33 · Approximate equation | pass (test: `src/documents/readAsMarkdown.test.ts`) | The fixture checks the preserved text and the reader’s approximation count. |
| S34 · Word without equations | pass (test: `src/documents/readAsMarkdown.test.ts`, `src/export/saveAsMarkdown.test.ts`) | Exact Markdown expectations for the equation-free reader and preview fixtures. |
| S35 · Markdown copy matches the reader | pass (test: `src/export/saveAsMarkdown.test.ts`, `src/documents/readAsMarkdown.test.ts`) | Both paths compare with the same expected equation Markdown. The save test checks the written file. |
| S36 · Export and read back the math corpus | not run: literal source equality lacks proof | `src/documents/ommlToLatex.test.ts` verifies the expected converted LaTeX and checks that KaTeX accepts it. The expected LaTeX can differ in spelling from the original. |
| S37 · Usage contains no document details | pass (test: `src/runtime/ritemarkTools.test.ts`) | Exact event properties contain only the feature and kind. Each event counts one use. |
| S38 · Reading test across all three AIs | not run: live Mac and Windows runs await test keys | PR 7 merged the harness. The [run record](reading-test.md) has no completed runs. ChatGPT needs its isolated key wiring, and Windows needs the Gate 2 launcher and vault wrapper. |
| S39 · Starting points unlock per AI | not run: unshipped gate PRs 8–10 await passing Mac runs with test keys | The shared Word and PDF starting-point switches are still false. |
| S40 · Starting points respect Windows Gate 2 | not run: Windows Gate 2 awaits test keys and Windows runner setup | The per-AI, per-platform gate is unshipped. |
