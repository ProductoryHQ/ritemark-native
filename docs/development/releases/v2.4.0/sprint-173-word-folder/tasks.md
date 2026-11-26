# Sprint 173 tasks

Nothing starts until Jarmo approves the plan. After that, the first action is the branch for the first PR (`sprint-173-word-folder-pr1`, from `main`); each PR has its own branch, an issue in milestone v2.4.0, and the template's Risk and How to revert. One PR at a time. Order matters: each PR is usable on its own and removes nothing.

Standard-tier PRs get `/code-review` at medium, one round. Proof is one screenshot or one log line, plus the tests named. The Experience lead sees the shots of PRs 3, 4 and 5 before they merge.

## PR 1: `read_document` for Word and PDF (R1, R2, R4, R5, R10)
- [ ] `src/documents/projectPath.ts`: the project-path check (reads `workspaceFileLinks.ts` first, extends it if it fits)
- [ ] `src/documents/readAsMarkdown.ts`: Word (headings, lists, tables) and PDF pages; reasons in plain words; cut text says where
- [ ] Worker message `read` (`protocol.ts`, `searchWorkerClient.ts`, `searchWorker.ts`), answered without the index
- [ ] `documents` group in `ritemarkTools.ts`; `toolGroupsFor`, `toolGroupById`; the injector and the OpenCode adapter pick it up from the registry
- [ ] Usage event with counts and kind only
- [ ] Tests: S1 to S4, S8 to S16, S37; the three-wirings assertion in `ritemarkTools.test.ts`
- Proof: one log line per AI of the same tool result for the same document; the refusals of S14 shown

## PR 2: PowerPoint reading with notes kept to their slide (R2, R3)
- [ ] `.pptx` in the reading mode: slide order from `presentation.xml`, notes by the slide's relationship
- [ ] Fixture decks: slide 5 without notes; notes parts out of order; no notes at all
- [ ] Tests: S5 to S7
- Proof: the same deck read by Claude, which on 2.3 gave slide 5's notes to slide 4: now `Notes: none`

## PR 3: steps name documents (R6)
- [ ] `stepLabel.ts` and the tests: tool, Claude's Read/Glob/LS, shell commands
- [ ] `ActivityCard.tsx`, `store.ts`, `types.ts`: Word, PDF and deck icons; warning step; folded "Read N … · N s"
- [ ] A runtime's event mapper carries the arguments the label needs, if one does not
- [ ] Tests: S17 to S20
- Proof: one shot of the four-interview run for each AI; the Experience lead's look (frame 2 and 5)

## PR 4: a link opens its passage (R8, part 1)
- [ ] `classifyChatHref`: the `#p=…&q=…` form; `chatLinks.test.ts`
- [ ] Host: `findOpenForPassage`, the lookup through the worker `read` message, `findRequests` (no edit to `ritemarkEditor.ts`)
- [ ] Slide links to the deck preview
- [ ] Tests: S24 to S29
- Proof: a click opens a Word, a PDF and a deck at the passage on the Mac; Windows path checks (drive letters, case) on one Windows run

## PR 5: the AI names its sources; the hover card (R7, R8, part 2)
- [ ] `capabilityContext.ts` text, version 6; the same text for all three
- [ ] The hover card (from `components/ui/`; outside click and Esc close it); the current-link style if kept (open question 4)
- [ ] Tests: S21, S22, S23, S30
- Proof: one shot of the answer with sources as words and one of the open card; the Experience lead's look (frames 3, 4 and 7)

## PR 6: Word's equations as math (R9, #547)
- [ ] `src/documents/ommlToLatex.ts` with the corpus tests (S31 to S34, S36)
- [ ] Wired into `readAsMarkdown.ts`
- [ ] Wired into the Word preview's Save as Markdown (S35)
- Proof: one document with fractions, a root, a sum and a matrix through both paths; the Markdown editor draws them

## PR 7: the reading test harness and fixtures (G1)
- [ ] Script that builds the folder, the protected document and the deck from synthetic text (scrubbed metadata)
- [ ] `research/reading-test.md` template: the six criteria per run
- [ ] A scripted run per AI (isolated AI homes, test keys from the vault, mock keychain)
- Proof: the first complete set of runs for one AI

## PR 8, 9, 10: the gate, one AI at a time (G2)
- [x] `startingPlace.ts` per-AI, per-platform shape with every entry still `false`; tests S39, S40 (a PR of its own, merged with PR 5 or before the runs)
- [ ] Then one tiny PR per AI that has 3 of 3 on the Mac: its entry becomes `true`, the run record linked in the PR
- [ ] Windows: three runs per AI at Gate 2; an AI that fails there has its entry false for Windows (open question 1)

## Sprint end
- [ ] The full test chain once on each final head, output to a file
- [ ] `docs/development/architecture.md` updated: documents tool group, reading mode in the worker
- [ ] `qa-validator` at the end; each PR's Review record on the PR
- [ ] Release plan row set to Done; release notes line written with the `release-notes` skill (plain words: ChatGPT, Claude and OpenCode read your Word folder with you, and name where each answer came from)
