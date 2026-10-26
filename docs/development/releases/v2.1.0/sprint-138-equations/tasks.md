# Sprint 138 Tasks

Nothing here starts before Jarmo approves the sprint plan. Tick a box only when the change is on the sprint branch. W numbers are workstreams and A numbers audits in [technical-plan.md](technical-plan.md), R and E numbers are requirements in [spec.md](spec.md), and S numbers are scenarios in [scenarios.md](scenarios.md). `E` = `extensions/ritemark/`.

## Phase 0: Branch and starting tree

- [ ] Jarmo's approval recorded in `sprint-plan.md`, with his answers to the seven decisions
- [ ] `git checkout -b sprint-138-equations` from `origin/main`; `git branch --show-current` shows it
- [ ] `notes/bundle.md`: `media/webview.js` and `out/extension.js` sizes before; KaTeX copies in `webview.js` (one, 0.16.47) (E2, A6)
- [ ] The Experience lead asked, through the Development manager, for a short drawing of an equation's states: typeset, editing inline, editing a block, a typo, empty (decision for Jarmo 6). Behaviour work does not wait for it; the look does

## Phase 1: Audits first

- [ ] A1 `research/editor-roundtrip-audit.md`: today's probe repeated through the real editor (TipTap included) on a dev instance; what changes on an untouched save and on a one-word save
- [ ] A2 `research/katex-assets-audit.md`: a hand-copied `media/katex/` loads by `<link>` in a dev instance, in a production build, on the Mac and on Windows; the woff2 faces arrive through the service worker; or plan B (the host sends `data:` faces) is chosen
- [ ] A3 `research/export-images-audit.md`: plan A's pictures for 30 equations (sharp at 200%, baselines, KaTeX's fonts, 100 equations under 3 s); or plan B (MathJax 4 from `media/drawio/math4/`) is chosen
- [ ] A4 `research/word-equations-audit.md`: the 40-formula corpus through KaTeX's MathML, `mathml2omml` and docx 8.5.0's `ImportedXmlComponent`, in Word for Mac, Word for Windows, LibreOffice, Pages and a Google Docs import; pass or fail against the bar in `research/word-equations.md`
- [ ] A5 `research/google-docs-audit.md`, on a test account: an inline image at an inline placeholder; #408's first line, border and padding in a real Doc
- [ ] Where an audit changes a requirement, `spec.md` changes first (Mid-Sprint Scope Change Protocol)

## Phase 2: Markdown in and out (W1; R1, R2)

- [ ] `E/webview/src/extensions/math/mathSyntax.ts` + `mathSyntax.test.ts`: `scanInlineMath`, `scanBlockMath`, `literalMathPairs`; every R1 case, "not math" first
- [ ] `mathMarkedExtension.ts`: `mathBlock` (no `start`), `mathInline`, `literalDollar`; registered always on `editorMarked` in `Editor.tsx`
- [ ] `MathInline.ts`, `MathBlock.ts`, `LiteralDollar.ts`: attributes, `parseHTML`, `renderHTML`, `renderText`, `leafText` through `extendNodeSchema`; added to `Editor.tsx`'s extensions
- [ ] `mathTurndownRules.ts` and `escapeLiteralDollars` in `createTurndownService()` (`E/webview/src/utils/turndownService.ts`)
- [ ] Fixtures in `E/webview/src/extensions/math/fixtures/`: `analyst-report.md`, `forms.md`, `prose-dollars.md`, `edge-cases.md`
- [ ] `mathRoundTrip.test.ts`: every fixture byte for byte through load and save; the escaper's cases; added to the `test` chain in `E/package.json`
- [ ] S1–S14 on a dev instance; the list-item and soft-break cases marked as waiting for Sprint 137 if it has not merged

## Phase 3: Typesetting (W2; R3)

- [ ] `"katex": "0.16.47"` exact in `E/webview/package.json`; the lockfile still has one `katex`
- [ ] `main.tsx`: `webview.js`'s own URL captured at start
- [ ] `mathRender.ts`: `loadKatex`, `ensureKatexStylesheet` (with the `unavailable` state), `typeset` with the options in W2
- [ ] `MathInlineView.tsx`, `MathBlockView.tsx`: typeset, source fallback when the stylesheet is unavailable
- [ ] The editor's style rules for inline, block, error and editing states
- [ ] S15–S19; A1's 200-equation timing recorded, and the view type decided

## Phase 4: Editing, writing, copy and paste (W3, W4; R4–R7)

- [ ] Editing state in both views: open by click and Enter; commit on Escape, Tab, click away and arrows (inline); one undo step; empty deletes; inline trimming and `\$`
- [ ] The input rule for inline math, with `undoInputRule`
- [ ] `$$` and Enter in an empty paragraph
- [ ] **Equation** in `blockItems.ts`, the slash executor and the block menu's; its icon added to `ui/Icon.tsx`
- [ ] `mathErrors.ts` + test: KaTeX's common errors in one plain sentence each; the warning mark with `ui/tooltip.tsx`
- [ ] `parseHTML` rules for KaTeX and MathML with a TeX annotation; the paste rule for plain `$…$`
- [ ] S20–S31; S27 through the bridge trace for Claude, ChatGPT and OpenCode

## Phase 5: Export pictures and the PDF (W5, W6; R8, R12)

- [ ] `E/webview/src/lib/mathExport.ts` + test (the HTML rewrite, with the typesetting and drawing injected as in `mermaidExport.ts`'s test pattern): typeset, measure, draw at 4× with embedded faces, MathML for Word, the export form, `data-status="error"`
- [ ] `App.tsx`: `prepareMathForExport` in `handleExportPDF`, `handleExportWord`, `handlePublishGoogleDocs`
- [ ] `E/src/export/v2/pdfInlineLayout.ts` + `pdfInlineLayout.test.ts`
- [ ] `pdfHtmlExporter.ts`: paragraphs, headings, quotes, list items and table cells through `layoutRuns` (R12); display blocks centred and scaled; typo sources in Courier
- [ ] The message after an export counts equations shown as source (decision for Jarmo 5)
- [ ] S32–S35

## Phase 6: Word (W7; R9)

- [ ] `"mathml2omml": "0.5.0"` exact in `E/package.json`; `external` in `E/esbuild.config.mjs`; `check-bundled-extension-complete.sh` passes
- [ ] `E/src/export/v2/mathToWord.ts` + `mathToWord.test.ts`: the loader, the wrapper, the checks, the picture fallback, the typo case
- [ ] `wordHtmlExporter.ts`: the inline math case, display paragraphs centred, the header row through `collectInlineRuns`
- [ ] S36–S38, Word for Windows through the Development manager's Windows session

## Phase 7: Google Docs (W8; R10, R11)

- [ ] `mapper.ts`: math blocks as centred image blocks; inline placeholders and `insertInlineImage` with `objectSize`; table cells as source with a note; typo sources
- [ ] `mapper.ts` `case 'quote'`: `indentFirstLine`, 0.5 pt border, `fields` (#408)
- [ ] `GoogleDocsPublisher.ts`: the change hash without math pictures
- [ ] `GoogleDocsController.ts`: the one-sentence note for equations published as source
- [ ] `mapper.test.ts` and `GoogleDocsPublisher.test.ts` cases
- [ ] S39–S41 on a test account

## Phase 8: Delivery and weight (W9; R13)

- [ ] The Vite plugin: `media/katex/` (woff2-only stylesheet, 20 faces, licence); the one-KaTeX build check
- [ ] `media/katex/` committed
- [ ] `scripts/validate-build-output.sh`: the KaTeX files and `node_modules/mathml2omml` in the built app
- [ ] `branding/ATTRIBUTION.md`: KaTeX (MIT) and `mathml2omml` (LGPL-3.0-or-later, with the GPL text)
- [ ] `notes/bundle.md` after: `webview.js` growth at most 40 KB, one KaTeX, `media/katex/` size, `out/extension.js` (S42)

## Phase 9: QA and closeout

- [ ] The full `npm test` chain and `npm run compile` green; the pre-commit hook passes
- [ ] S1–S45 walked; *Windows* scenarios on a Windows build from the branch; the 2.0.1 regression set (S45)
- [ ] Screenshots of the editor's math states and the PDF and Word outputs to the Experience lead before the merge
- [ ] `docs/user/features/`: equations in `formatting.md` or `blocks.md`, rows in `export.md` (PDF, Word, known limits), `google-docs.md` (equations, quotes), `keyboard-shortcuts.md` (`$$` and Enter, Enter on an equation)
- [ ] `docs/development/architecture.md`: the math nodes, the export path, the external, the `media/katex/` files, a Version History row (Sprint Architecture Gate)
- [ ] `docs/CHANGELOG.md`, and lines for 2.1's release notes leading with equations
- [ ] Issues filed: the PDF's help gaps (checkboxes, header, page numbers); the Word preview drawing equations; math in the AI's sheet if decision for Jarmo 7 is "later"; Word equations into Markdown
- [ ] #481 and #408 updated; the PR opened, smoke-tested on `/rundev`, and its number given to Jarmo for the merge
- [ ] After the merge: a production build from a clean-room worktree at the merged commit, S43, the drift check (E5)
- [ ] The reply for jarmo-productory/ritemark-public#2 drafted for release day, posted with Jarmo's word (E6)
- [ ] S46 on the release candidate, before the film is captured (E3)
