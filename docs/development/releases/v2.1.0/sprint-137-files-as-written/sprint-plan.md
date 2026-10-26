# Sprint 137: Files come back as written

Track: SDD (auto-detected: 11 user-facing requirements from two issues; the webview, the extension host and a VS Code patch; an edge-case-heavy format)
Override with: "use plain full track"
Branch: `sprint-137-files-as-written`, created from `origin/main` only after Jarmo approves this plan
Release tier: shell (`patches/vscode/014-ritemark-save-receipts.patch` gains one file for #454). The #270 work is extension-tier by path, and ships in 2.1.0's shell release (the shape's decision 1).
Status: **Phase 5 (cleanup), 26 October 2026.** Approved (Phase 2 → 3) that day by the Development manager under Jarmo's delegation; built on `sprint-137-files-as-written`; Phase 4 passed (QA, technical, after its two blockers were fixed); PR [#553](https://github.com/ProductoryHQ/ritemark-native/pull/553) waits for the manager's merge.

## SDD Artifacts

- [spec.md](spec.md): the behaviour contract, R1–R11 and E1–E6.
- [scenarios.md](scenarios.md): S1–S49, the manual QA matrix.
- [technical-plan.md](technical-plan.md): what exists today, workstreams W1–W8, two audits.
- [tasks.md](tasks.md): the implementation checklist by phase.
- [research/fidelity-pre-audit.md](research/fidelity-pre-audit.md): what open and save does to 1,296 real files today, and a measured prototype of the fix.
- This file: intent, decisions, status.

The release is [v2.1.0](../release-plan.md), item 1 of the shape (`ritemark-dev`: `releases/v2.1.0/shape.md` §3): "Your files come back as you left them".

## Goal

You open a Markdown document, change a word, save it, and the file changes only where you changed it:
- lists keep their marker, spacing and tightness;
- soft line breaks stay soft;
- no trailing spaces appear;
- no link, mark or image is lost.

When an agent changes a file you are editing, one question answers it: Ritemark's Review changes.

## Linked Issues

- [#270](https://github.com/ProductoryHQ/ritemark-native/issues/270): saving rewrites Markdown lists (3-space padding, tight to loose, trailing whitespace), and its second case, a soft break written back as a hard break (R1–R3, with R4–R9 from the corpus).
- [#454](https://github.com/ProductoryHQ/ritemark-native/issues/454): a file conflict shows VS Code's "content is newer" toast and Ritemark's Review changes together (R10, R11; shell-tier).
- [#499](https://github.com/ProductoryHQ/ritemark-native/issues/499): watched. Synced folders' saves without conflicts are R11's case, and S48 runs it.
- [#502](https://github.com/ProductoryHQ/ritemark-native/issues/502) and [#512](https://github.com/ProductoryHQ/ritemark-native/issues/512): in the milestone with no sprint. Question 7 asks whether they join this one.

## What the pre-audit found

Measured on 1,296 real files: the team's own docs, `ritemark-dev`'s documents, and 89 GitHub-style READMEs. Details in [research/fidelity-pre-audit.md](research/fidelity-pre-audit.md).
- **Today, 3–4% of files come back byte for byte after one open and save.**
  - Lists change in about four of five files.
  - Soft breaks are written as hard breaks in about half.
  - In about half of the team's files a table's delimiter row is rewritten, and any column alignment is lost.
- **Three bugs lose content, not just formatting:**
  - a link into a folder (`[report](notes/report.md)`) is deleted on save;
  - a link or bold around code is broken apart;
  - images in a row are joined onto one line, and the next save deletes all but the first.

  In the team's own files, 8–22% lose links after two saves.
- **Front matter is rewritten on every body save:** the blank line after it goes, dates become timestamps, comments are dropped.
- **A prototype of this plan's approach** brought byte-identical files to 38% and 51% in the team's two corpora. Lost links went from 87 files to 2, and from 31 to 0. It kept Turndown and `marked`, and the editor's look. What it left is outside the bound (HTML, setext headings, `_em_`, padded tables) or a gap this sprint closes.

## MVP Scope

| Area | Requirements |
|---|---|
| Lists: marker, spacing, tightness, nested indent (tabs too), a list right under a line, tasks and plain items in one list | R1 |
| Line breaks: soft stays soft, hard keeps its form, a new break with no trailing spaces | R2 |
| No whitespace at the end of a line | R3 |
| The other common forms: thematic breaks, bare and `<…>` addresses, escapes only where needed, tables' delimiter row, alignment and spacing | R4 |
| Front matter byte for byte when no property changed | R5 |
| Nothing lost: links into folders, links and marks around code, images in a row | R6 |
| The editor looks the same | R7 |
| New writing in one plain form, Save as Markdown and Copy as Markdown included | R8 |
| The corpus test: kept, known and cleanup sets; a second save; the one-word edit; CRLF and the BOM | R9 |
| One question for a conflict: Ritemark's Review changes, VS Code's notification only where Ritemark can't answer | R10 |
| No question where nothing is in conflict (a sync client touched the file) | R11 |
| Tests, patch 014, the bundle, docs, builds, the bound filed | E1–E6 |

**Not in this sprint:**
- a new serializer, or writing untouched blocks from their source text (decision 3);
- TipTap 3 (#243);
- any change to how the editor reads Markdown;
- the forms outside the bound, listed in [spec.md](spec.md#non-requirements) and filed as one issue;
- keeping YAML's form when a property is edited;
- equations (#481, Sprint 138);
- footnotes (#153).

## The approach in two paragraphs

**#270.** `marked` stays the parser and Turndown the serializer. The parse records how each list, line break, thematic break, bare link and table was written: `marked` renderer extensions read each token's raw text and put `data-md-*` attributes on the HTML. TipTap's nodes and marks carry those as data-only attributes, and new Turndown rules write by them. Where an attribute is absent, because the person typed something new, the rules write one plain form (R8).
- Front matter is kept byte for byte by the host whenever the properties are unchanged.
- The three losses are three small fixes:
  - the link mark's address check;
  - the code mark's `excludes`;
  - a block-image rule.
- The editor's load and save code moves out of `Editor.tsx` into one module, unchanged, so a corpus test can drive the editor's own code.

**#454.** Patch 014 already owns saving. It gains one hunk in VS Code's save-error handler. When a save is refused as "newer" for a document Ritemark's editor holds, the handler asks Ritemark first. Ritemark's document sync then answers it:
- Review changes when it is a real conflict;
- a quiet save when the disk text is unchanged (R11);
- a refreshed state when the disk already has the person's text.

VS Code's notification shows only when Ritemark doesn't answer.

## Product Decisions

- **2026-10-19 (Jarmo):** #270 is 2.1's first item.
- **2026-10-21 (Jarmo, the shape, "kinnitan soovitustega"):**
  - decision 1: one shell release, 2.1.0, on Mac and Windows;
  - decision 3: untouched lists and soft breaks written back as they were in the common forms, checked against a corpus of real files, with no new serializer and no TipTap 3.
- **2026-10-26 (engineering, in this plan):**
  - data-only attributes from the parse and rules that read them, measured in the pre-audit;
  - the editor's pipeline in one module, so the tests drive it;
  - #454's hunk in patch 014, not a new patch, since patches own one domain each (`PATCH-RULES.md` §1);
  - when Ritemark can't answer a refused save, VS Code's notification shows as today, so a conflict is never left without a question (R10);
  - the forms outside the bound are reformatted but never lost, pinned in the known set, and filed as one issue for after 2.1.

## Decisions for Jarmo

1. **The bound: lists, breaks and trailing spaces, plus what the corpus found next to them.** I recommend R1–R5 as written.
   - **Your bar:** lists, soft breaks and no trailing spaces.
   - **Plus the forms that sit in the same code and appear in a large share of real files:**
     - thematic breaks (`---` becomes `* * *` in 31% of the team's files);
     - bare web addresses;
     - escapes where nothing needed escaping (`snake\_case`, `\[1\]`, `## 1\. Background`);
     - tables' delimiter row, alignment and spacing;
     - front matter.
   - **Outside the bound, reformatted but never lost:** HTML, setext headings, `_em_`, reference links, padded table columns and the rest of [spec.md](spec.md#non-requirements), filed as one issue.
   - Without these forms, "files come back as written" would hold only for files that have none of them, and the team's own files would still change on every save.
2. **The three losses go into this sprint (R6).** I recommend yes.
   - Today a save deletes a link into a folder, breaks a link or bold around code, and deletes images in a row. That is worse than #270 itself, and each fix is small and in the same code.
   - They are the sprint's only visible change. A link, bold or image that disappears today will show in the editor, because the file has it.
3. **What a line break you type writes (R2, R8).** Shift+Enter today writes two trailing spaces, which is #270's complaint. I recommend a backslash at the end of the line (`line\`): a hard break on GitHub, in Obsidian and in every CommonMark reader, with no trailing spaces. Its cost is a visible `\` in plain text. The other choices:
   - a plain newline: the cleanest file, and it shows as a break in Ritemark and Obsidian, but GitHub joins the lines;
   - two spaces, as today.
4. **Files Ritemark saved before 2.1 (R3, R9's cleanup set).** Their lists keep `-   item` and their blank lines, as written. The four spaces Ritemark put on those blank lines go on the first save in 2.1, a one-time whitespace-only diff. I recommend accepting it and saying so in the notes. The alternative is a special case that keeps trailing whitespace in some files.
5. **Measure one folder of your own real files.** Decision 3 asks for real files; the corpora so far are the team's and GitHub's. I recommend yes. The harness runs on your Mac over one folder you pick (Word exports, Obsidian notes, client work) and records only the number of files per class. No file is copied and no text leaves the computer.
6. **Where 2.1's notes and the site promise this.** The Inbound Traffic manager's draft line is "Ritemark 2.1 keeps your Markdown exactly as you wrote it". I recommend "keeps your Markdown as you wrote it: lists, line breaks, tables and front matter come back unchanged when you save", so the promise matches the bound. The product marketer takes the final words from the release notes.
7. **#502 and #512 into this sprint.** Both are in the milestone with no sprint, and both sit in this sprint's code.
   - #502: editing a link's address does nothing, and Jarmo found it himself. It is in the link dialog that R6's fix touches.
   - #512: a false "Retry document update" after an AI edit. It is a false question in the same document sync as R10.

   I recommend taking both: #502 as a fix with its test, #512 as a reproducer first and a fix if it reproduces. If either grows beyond that, it moves to the release's next sprint and is not a reason to hold this one.

## Feature Flag Check

No feature flag.
- This is a fix to what is written, not a new feature. A switch back would bring back the rewrites and the lost links.
- Users can't toggle flags (Settings has no flag page), so a flag would not help anyone in the field.
- An extension-tier release can carry a fix for the webview part if one is needed.

HARD RULE #1 holds: nothing is removed. `tiptapTaskItem`'s rule is replaced by one list-item rule that writes the same task syntax and keeps line breaks.

## Success Criteria

- [ ] #270's own fixture, opened, edited at one word and saved, changes exactly one line (R1, R9; S1)
- [ ] Every file in the corpus's kept set is byte-identical after one and two saves, in the corpus test and in a dev build (R1–R5, R9; S2–S24, S37)
- [ ] A soft break stays soft; a typed break writes the form Jarmo chooses; `git diff --check` stays quiet (R2, R3; S10–S16)
- [ ] No link, mark or image is lost after two saves of any corpus file, the known set included (R6; S27–S31)
- [ ] The editor shows every corpus file as on `main`, apart from R6's listed exceptions, in Light and Dark (R7; S32, S33)
- [ ] The agent writes a file the person is editing, and only Ritemark's Review changes asks, on the Mac and on Windows; the next edit saves with no question (R10; S40–S44)
- [ ] VS Code's notification still shows where Ritemark can't answer (R10; S45, S46)
- [ ] A save in a synced folder shows no question when the text did not change elsewhere (R11; S47–S49)
- [ ] All patches apply on the pin, a second run is clean, the stacking check passes; a production build from a clean-room worktree succeeds after the merge; the drift is recorded (E2, E5)

## Risks

| Risk | Retirement |
|---|---|
| The bound grows into a new serializer | Decision 3's line, held by the corpus: a form joins only by the scope-change protocol, and only when the captures show it is common; everything else goes into the known set |
| A form the bound promises does not round-trip in some nesting | Phase 1 adds it to the corpus; the second-save check fails until it is fixed |
| The editor changes how it looks or behaves | Data-only attributes; the look baseline from `main`; S32 and S33 |
| Accepting more link addresses, or code no longer excluding marks, changes safety or editing | TipTap's own check first, dangerous protocols refused (S31); S33's editing checks; a narrower `excludes` if anything changes |
| The hand-over silences a conflict Ritemark can't answer | It hands over only for a document Ritemark's editor holds; anything but `true` shows VS Code's notification (S46) |
| Patch 014 drifts at the next VS Code update | One line at the top of `onSaveError` and one constructor parameter; the drift check at the merge |
| Sprint 138 changes the same pipeline at the same time | 137 merges first; 138 builds on `editorMarkdown.ts` and adds its fixtures to the corpus (release plan, *Sprints*) |
| Old files change once | Question 4; the notes say so |

The full list is in [technical-plan.md](technical-plan.md#risks-inside-the-sprint).

## Depends on

- **Jarmo's answers** to the seven questions above.
- **The Development manager's Windows session,** for the save-conflict audit on Windows and the Windows round after the merge.
- **The real-tool captures:** a Google Docs export and an Obsidian note can be made by the team. Jarmo's folder needs his yes (question 5).
- **Sprint 138's order:** this sprint's pipeline module is merged before Sprint 138 adds its math extension, or 138's extension moves with it.

## Pre-Implementation Gate

- This plan's PR, or the local branch, gets the usual review, and Jarmo's approval gates Phase 0. Plan approval is not start approval: the branch is created when Jarmo says to start (memory: Sprint 107).
- Phase 1's audits come before any code beyond the starting tree. When an audit changes a requirement, `spec.md` changes first.

## Approval

- [x] Approved on 26 October 2026 by the Development manager, under Jarmo's delegation of the same day: "ei sprindiplaanid kinnitad sina. midagi ei tohi minu taga oodata kuni Gate 1 RCini" and "ja muud asjad ka sh worktreede kustutamine" (ritemark-dev `decisions/log.md`, 26 October). Until 2.1's Gate 1 RC, the manager's word counts for plan approval, sprint start and admin merge of 2.1 work. Release approval (Gate 1, Gate 2, publish) stays Jarmo's.

**The plan's questions, decided:**
1. **The bound:** R1–R5 as written. The forms outside it are reformatted but never lost, and they are filed as one issue.
2. **The three losses (R6)** are in this sprint: links into folders, marks around code, images in a row. They are tracked as #539. Reproduce them in the app first.
3. **Shift+Enter** writes a backslash (`line\`): a real line break everywhere, with no trailing spaces.
4. **Files 2.0.1 saved:** the one-time cleanup of the four spaces on blank lines is accepted. 2.1's notes say so.
5. **One folder of Jarmo's own files** may be measured on this Mac, as numbers only. No content is copied, quoted or committed. The report names the folder by its size and kind only.
6. **The public wording:** "keeps your Markdown as you wrote it: lists, line breaks, tables and front matter come back unchanged".
7. **#502 and #512 are in this sprint.** Reproduce #512 first. Either moves out if it grows.

**Order:**
- 137 merges first. Sprint 138 waits for 137's extraction of the pipeline before it touches `Editor.tsx` or `turndownService.ts`.
- Merges are sequenced by the manager, because the webview bundles clash.

