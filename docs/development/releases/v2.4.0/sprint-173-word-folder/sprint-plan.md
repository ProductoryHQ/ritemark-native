# Sprint 173: Word folder, ready for any AI

Track: SDD (auto-detected: ten numbered requirements, edge-case-heavy path and link handling, a flow across the webview, the host, a worker and three AI runtimes). Override with: "use plain full track".
Branch: `sprint-173-word-folder-prN` for each PR (this plan is on `docs-sprint-173-word-folder`)
Release tier: extension (no path on `CLAUDE.md`'s shell-tier list; see technical-plan.md)
Status: **Phase 2 (PLAN), awaiting Jarmo's approval.** No code until he approves in his own words.

The parent release is v2.4.0 (`../release-plan.md`, milestone 20; thesis approved 22 November). The drawing: experience 50, `product/design/experience/experiences/wordfolder/README.md`. The shape: `releases/v2.4.0/shape.md`, item 1.

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract (R1 to R10) and the gates (G1 to G3)
- [scenarios.md](scenarios.md): examples that become the tests and the manual matrix
- [technical-plan.md](technical-plan.md): what exists, files, tiers
- [tasks.md](tasks.md): the PRs in order, each with its proof
- [sprint-plan.md](sprint-plan.md): this file
- [research/issue-497.md](research/issue-497.md), [research/issue-547.md](research/issue-547.md): the issues as saved

## Goal
ChatGPT, Claude and OpenCode read a folder of Word documents, PDFs and decks the same way, show documents instead of commands as they read, name where each claim came from in the sentence, and link that name to the passage; once an AI passes the reading test, a Word document or PDF in front gets its own starting points for it.

## Feature Flag Check
No new flag. The feature is not platform-specific, experimental, a large download or premium, and a kill-switch isn't needed: the tool is read-only and an AI may still read a file its own way. The starting points are gated by the per-AI reading-test constant, as today (`READ_KINDS_EVERY_AI_PASSED`).

## Linked Issues
- #497: can every AI read a folder of Word files (the reading test, the gate)
- #547: Word's equations as LaTeX
- One issue per PR, created at approval, in milestone v2.4.0

## MVP Scope
One tool for all three AIs (`read_document`: Word, PDF, PowerPoint, with notes kept to their slide); steps named by document; sources as words with passage links and a hover card; equations as math; the reading test harness and the runs; the starting-point gate per AI. Eight to ten small PRs (tasks.md).

## Out of scope
- The meaning layer (#591), out of 2.4 (Jarmo, 22 November: "tähenduskiht hilisemaks").
- Excel charts and colour rules (#971): a separate sprint.
- `.xlsx`, `.doc`, `.ppt`, images, `.rtf`; editing or suggesting changes to a Word file.
- Sources as numbers, chips or a line of sources (frames 3, 6 and 8: not chosen).
- Rendering a scan's pages as pictures inside the tool (open question 3).
- Changing Home's card or first request (the drawing keeps it).

## Product Decisions
- **2026-11-22:** Sources are words in the answer, way C. Jarmo: "C kuigi D on hea. Siis C aitab meil võrrelda end Notebook LMiga".
- **2026-11-22:** Every AI reads through one Ritemark tool, `read_document` (drawing, decision 1); steps name documents (decision 2); what can't be read is said (decision 4).

## Success Criteria
- [ ] Every AI uses the same `read_document` from one definition; no runtime-specific copy.
- [ ] A PowerPoint slide without speaker notes says so, and no slide gets a neighbour's notes (0 misplaced).
- [ ] A password, a damaged file, an older format, a too-large file, an online-only file and a scan are each said in plain words in the step and in the answer.
- [ ] Steps name documents and folders; 0 shell commands or paths as a step's label.
- [ ] A source name in an answer opens its document at the passage; an unfound quote opens the top and says so.
- [ ] Word equations arrive as LaTeX through `read_document` and Save as Markdown.
- [ ] G1: each AI has 3 of 3 passing runs on the Mac (and on Windows at Gate 2), recorded in `research/reading-test.md`.
- [ ] Each PR has `REVIEW.md`'s review at its tier with every finding answered; the Experience lead has seen PRs 3 to 5's shots.
- [ ] The full test chain ran once on each final head; `qa-validator` signed off at the sprint's end.

## Risks
- **A reading test that never fully passes** for one AI (OpenCode depends on the model behind its key, ChatGPT's turns on its own tools). Mitigation: the per-AI gate means the others still ship; a failing AI gets its cause fixed, then three new runs.
- **AIs ignoring the instruction** to link with the passage's words or to use the tool first. The instruction is one text; criterion 4 and 6 measure it; the fallback is the link at the document's top, which already works.
- **The drawing's premise differs from the code**: search keeps flat passages, not Markdown (technical-plan.md). Plan PR 1 accordingly: a reading mode, more than "hand over the cache".
- **Passage matching** across Word, PDF and the preview's find (quotes, hyphenation at line ends, tables).
- **Windows**: paths, OneDrive, speed, and the Windows runs only at Gate 2.
- **Test keys and signed-in AIs** for the runs (the manager's vault; Claude Code signed in on the test Mac). A run is a scripted test run, not a Codex job.
- **PDF without a page's own label** (a PDF whose printed page numbers differ from its index): links use the viewer's page index.
- **Fixture hygiene:** Office files carry the saver's name; scrub before commit.
- The release is shell-tier for other reasons; this sprint is not, so a late fix can still ride an extension release.

## Open questions for Jarmo
1. **Does the starting-point gate open per AI, or only when every AI has passed?** The task and the code's name say "every AI"; the drawing (decision 5) says per AI. *Recommendation: per AI, on 3 of 3 on the Mac, and kept for Windows only if it also passes there at Gate 2.* The column shows the chosen AI's own state, so nobody is offered something their AI hasn't passed.
2. **What does "pass" ask?** *Recommendation: 3 of 3 runs, all six criteria in spec G1 (a fourth run of repairs counts as a new set of three), stricter than the spike's PDF 5 of 6.*
3. **A scan: read as a picture, or named?** The drawing says a scan is read as a picture where the AI can see pictures. Doing it inside the tool means rendering PDF pages to images in the host, which each runtime takes differently (Claude and ChatGPT accept images in tool results, OpenCode depends on its model) and that is a runtime-specific path. *Recommendation: not in 2.4. The tool says "a scan with no text" and the AI may open the file itself as an image; frame 5's "read as a picture" stays true where an AI does it on its own. Revisit with the reading test's numbers.*
4. **Frame 4's filled number is for way A.** For way C, should the link in the answer show as current while its document's tab is in front? *Recommendation: yes, a small accent style on that one link, nothing else; ask the Experience lead to confirm in PR 5's shot.*
5. **Equations: write the converter or take a library?** Triage left this open. *Recommendation: write it in-house (a small, finite set of OMML elements, no licence question, no esbuild external, tested against Ritemark's own math corpus). An equation it can't convert keeps its plain text between `$` marks, counted in the tool's header.*
6. **What if an AI's quote isn't in the document?** *Recommendation: open the document at its top and say so in the hover card (spec R8), never a wrong passage and never an error.*
7. **Slides in links.** The drawing shows Word and PDF; a deck's slide has no find. *Recommendation: a slide link opens the deck's preview on that slide, without a marked passage.*
8. **Windows runs at Gate 2 only.** The reading test names Mac and Windows. *Recommendation: Mac runs gate each AI's flip before the merge; Windows's three runs per AI happen on the release candidate at Gate 2 (as `REVIEW.md` says), and a Windows failure turns that AI's starting points off on Windows only.*

## Approval
- [ ] Jarmo approved this sprint plan (his own words; nobody else's relay is approval)
