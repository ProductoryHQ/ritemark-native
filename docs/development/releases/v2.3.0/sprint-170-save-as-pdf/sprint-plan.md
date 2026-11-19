# Sprint 170: Publish becomes a split button with Save as PDF

Track: SDD (auto-detected: three kinds of output with numbered requirements, a new export path, files the person keeps, and a webview to host to filesystem flow). Override with: "use plain full track".
Branch: sprint-170-save-as-pdf
Release tier: extension (provisional: shell if PR 0 finds the print path needs a patch; see the Tier section)
Status: **Approved** by Jarmo on 19 November 2026: "1 jah", "kinnitatud" (Jarmo) and "jah sa tee ise otsuseid" (Jarmo to the Experience lead): the Development manager and the Experience lead approve small plans tonight. Phase 3 (DEVELOP).

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint. The spec is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`, section "Save as PDF, from Publish (19 November)"). It comes from Jarmo's rule that "save sõltub kas kasutaja sel hetkel Slides (only) või Slides+Handouts või Handout" (the save depends on the view the person is in).

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract, which points at the README
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): file pointers and the open print-path question
- [tasks.md](tasks.md): the checklist
- [sprint-plan.md](sprint-plan.md): this file

## Goal
From a deck, Save as PDF writes the kind of PDF that matches the view the person is in, into a file they choose.

## Feature Flag Check
- Needs a new flag? No. Decks stays behind `ritemark.features.decks`, and every PR lives inside it. Nothing new is added or turned off.

## Linked Issues
One GitHub issue per PR in milestone v2.3.0.
- PR 0 (spike): to be created
- PR 1: [#881](https://github.com/ProductoryHQ/ritemark-native/issues/881)
- PR 2: [#884](https://github.com/ProductoryHQ/ritemark-native/issues/884)
- PR 3: [#881](https://github.com/ProductoryHQ/ritemark-native/issues/881)

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 0 | `sprint-170-save-as-pdf-pr0` | Spike, docs only: how the extension host turns a page into a PDF with fonts embedded, links live and offline; the answer decides the release tier | Standard |
| 1 | `sprint-170-save-as-pdf-pr1` | The split button (Publish stays the main part, a separate ▾ with its own hover and focus), the one menu item that names the view's kind, the save dialog, Replace, the "Saved as" note with Show in folder, and the first kind end to end: Slides and handout, the published page's print | High (writes a file the person keeps; the print path; the view-to-host flow) |
| 2 | `sprint-170-save-as-pdf-pr2` | Slides: one 16:9 page a slide, as on the wall | High (writes a file) |
| 3 | `sprint-170-save-as-pdf-pr3` | Handout: A4, the text alone | High (writes a file) |

## Order and overlap
- PR 0 first; PR 1 starts when its answer is written. No PR ships a menu item that does nothing: an item exists only in the PR that makes its kind work (HARD RULE #1 forbids a stub), so until PR 2 and PR 3 merge the ▾ lists only the kinds that exist and names the view's kind only when that kind is built. The Experience lead decides how the menu reads meanwhile; this is a question below.
- PR 2 and PR 3 can run side by side after PR 1. PR 2 uses the wall's renderer and PR 3 the handout's text; their files are apart.
- `DeckPublish.tsx` is also touched by Sprint 164 and 166 work in `DeckView.tsx`; rebase onto what has merged before PR 1.
- Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots, on synthetic decks only.

## Tier
PRs that write files are High. Release tier: the existing Export as PDF (`src/export/pdfExporter.ts`, `src/export/v2/pdfHtmlExporter.ts`) draws with pdfkit in the extension host, which cannot draw the published page's CSS, fonts or the wall's slides faithfully. A faithful print needs a browser engine. If it can be reached from extension code (an Electron or webview call that exists today, or a bundled dependency), this sprint is extension-tier. If it needs a new Electron print path in the VS Code core, that is a patch under `patches/` and **shell-tier**, and a new native or bundled dependency also changes the esbuild externals (an extension release ships only `out/**/*.js`, four media files and `package.json`). PR 0 answers this before any code, and this plan's tier line is updated by the answer. 2.3 is a shell release anyway (see the release plan), so the cost is gating, not shipping.

## Removals (HARD RULE #1)
None. The existing Export as PDF in Text documents is not touched.

## Success Criteria
- [ ] Publish stays the main part of the button; the ▾ is a separate small part with its own hover and focus; under 600 px the view is Slide only.
- [ ] The item names what the view will save and the file is that kind, with its file name.
- [ ] Skipped slides are left out; comments and notes never appear; links and Buttons stay clickable; Copy and ↗ are not drawn; fonts and pictures are embedded; it works offline.
- [ ] The save dialog starts in the deck's folder, an existing file gets the system's Replace question, and the bar says "Saved as <name>.pdf" with Show in folder.
- [ ] The Experience lead has seen each PR's shots before it merges.
- [ ] The full test chain ran once on each final head.
- [ ] `qa-validator` has signed off at the sprint's end.

## Release notes
One line per PR, in plain words, written with the `release-notes` skill:
- PR 1: save a deck as a PDF with its slides and handout from the Publish menu.
- PR 2: save just the slides as a PDF, one page a slide.
- PR 3: save just the handout as a PDF, the text alone.

## Risks
- The print path is the unknown (PR 0). Nothing else is built until it is answered.
- A file written to a person's folder: the Replace question must be the system's, and a cancelled dialog writes nothing.
- Fonts and pictures must be embedded, or a PDF opened offline differs from the screen.

## Questions
- Experience lead: while PR 2 and PR 3 are not merged, should the menu show only the kinds that exist, or is the sprint merged as one train at the end? The plan assumes the first.
- Development manager: if PR 0 finds a patch is needed, does the sprint stay in 2.3? It is shell-tier work in a shell release already.

## Approval
- [ ] The Development manager and the Experience lead approved this sprint plan (delegated by Jarmo; pending)

## The Experience lead's answers (19 November, with the approval)

Until PR 2 and PR 3 merge, the ▾ shows the kind that exists: "Save slides and handout as PDF…" in every view, naming truthfully what it saves; once all three kinds exist, the item follows the view. Never a menu that holds only Publish…, never a stub. If PR 0 finds the print path needs a patch, Sprint 170 stays in 2.3 (a shell release anyway). Shots for each PR before merge, synthetic decks only.
