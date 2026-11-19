# Sprint 168: Quotes, prompts and heading levels on a slide

Track: SDD (auto-detected: three user-facing requirements, a view-to-editor-to-renderer-to-published-page flow, and editor-command edge cases). Override with: "use plain full track".
Branch: sprint-168-quotes-headings
Release tier: extension
Status: **Approved** by Jarmo on 19 November 2026: "jah kõigile kolmele" (yes to all three). Phase 3 (DEVELOP).

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint. The spec is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`, section "Quotes, prompts and heading levels on a slide", ritemark-dev commit 1d0f3f6), with the sketch in `quote-on-slide.html` beside it. Jarmo agreed it with the Experience lead ("jah, saada arendusse"). That sent it to planning. It is not his approval of this sprint.

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract, which points at the README
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): file pointers
- [tasks.md](tasks.md): the checklist
- [sprint-plan.md](sprint-plan.md): this file

## Goal
Make a quote look like a quote on every surface, let a prompt leave a quote as a code block, and give the slide's headings the same order as the document: H1 above H2 above H3.

## Feature Flag Check
- Needs a new flag? No. Decks stays behind the existing `ritemark.features.decks`, and every PR lives inside it. Nothing new is added or turned off.

## Linked Issues
One GitHub issue per PR in milestone v2.3.0, to be created by the manager when the sprint starts.
- PR 1: [#863](https://github.com/ProductoryHQ/ritemark-native/issues/863)
- PR 2: [#864](https://github.com/ProductoryHQ/ritemark-native/issues/864)
- PR 3: [#865](https://github.com/ProductoryHQ/ritemark-native/issues/865)

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 1 | `sprint-168-quotes-headings-pr1` | R1: the quote's look, with the attribution line, on every surface | High (slide.css on every surface, the published page) |
| 2 | `sprint-168-quotes-headings-pr2` | R2: Code block on words inside a quote takes them out of it, in one undo step | High (editor behaviour, document edit) |
| 3 | `sprint-168-quotes-headings-pr3` | R3: H1 > H2 > H3 on the slide, and the / menu's Heading 1, 2 and 3 | High (slide.css on every surface, the fit) |

## Order and overlap
- **Can start now: PR 2 (R2).** It changes what one command does in the slide editor (`slideCommands.ts`, `SlideEditor.tsx`), apart from the CSS the other two change. Sprint 166 PR 8 (#848, the Button's words) and Sprint 167 PR 5 (the item handle) may touch nearby code. If they merge first, PR 2 rebases onto them. If they have not, the author checks the diff against theirs before the first edit.
- **Waits for Sprint 166 PR 5 (#841): PR 1 (R1).** #841 fixes the quote's leaked look, and R1 builds the new look on that fix, in the same `blockquote` rules in `slide.css`. Starting earlier only builds merge conflicts.
- **Waits for Sprint 164 PR 3 (the Label block): PR 3 (R3).** That PR changes the slide's / menu and the heading rules in `slide.css`, which R3 changes too.
- **Within this sprint:** PR 1 and PR 3 both edit `slide.css`, in different rules (the quote, the headings), so they may run side by side once their own gates clear, with the second to merge rebasing. PR 2 is apart from both.
- Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots, taken on synthetic decks only, never on Jarmo's real decks.

## Removals (HARD RULE #1)
- **"Title" and "Heading" leave the slide's / menu.** This is a rename, so the function stays: "Title" becomes Heading 1 (`#`, h1), and "Heading" (h2) becomes Heading 2 (`##`). A new Heading 3 (`###`) is added. Nothing that could be typed or chosen before is lost: the same two blocks, the same shortcuts and the old hidden words (h1, pealkiri, h2, subheading, alapealkiri) still find them. My reading: this is not a real removal and needs no yes by name. One word changes owner: "heading" finds Heading 3 now, where it found h2 before. If Jarmo reads that as a removal, it waits for his yes by name. (The Experience lead on #889, 19 November: "heading" is no item's own word in the end; all three names start with it, so /heading lists them in order and Enter gives Heading 1, as in the Text editor.)
- **Code block inside a quote on a slide.** Today it nests the code inside the quote. It will take the words out instead. This changes a behaviour, but removes nothing: the quote, the code block and the command (`toggleCodeBlock`) all stay, no button is added or dropped, and a code block outside a quote is unchanged. The nesting was the defect Jarmo hit, so I do not count it as a removal.
- If a PR's author finds something else that really goes, it is listed here and waits for Jarmo's yes by name before any code is deleted.

## Success Criteria
- [ ] A quote has no fill, a 3 px accent bar, and the words in the heading colour; a last line that starts with "— " or "– " is drawn as the attribution; it looks the same on the editor, wall, presenter view, strip and page, on dark and on Paper.
- [ ] Code block on words inside a quote takes them out as one code block with Copy and ↗, removes a quote left empty, and is one undo step.
- [ ] H1, H2 and H3 are ordered by size and weight on the slide; an h2 directly after the h1 keeps the title's line; a box's h3 is unchanged.
- [ ] The / menu offers Heading 1, 2 and 3 with the hidden words from the README; the bubble keeps H1/H2/H3.
- [ ] One realistic synthetic deck with an h2 mid-slide is checked through the fit.
- [ ] The Experience lead has seen each PR's shots before it merges.
- [ ] The full test chain ran once on each final head.
- [ ] `qa-validator` has signed off at the sprint's end.

## Release notes
One line per PR, in plain words for people, written with the `release-notes` skill:
- PR 1: a quote on a slide has its own look, with a line for who said it.
- PR 2: a prompt you wrote inside a quote comes out as a code block you can copy.
- PR 3: headings on a slide go in order, big, medium, small, like in the document.

## Risks
- R3 makes every existing h2 bigger and bolder, so some decks that fit today may need the fit to step their words down. The proof checks one realistic synthetic deck.
- R1 and R3 touch every surface, including the published page; a deck with no quote and no h2 must read as today.
- R2 edits the document across a quote's boundary; the undo step and the empty quote are the edge cases.
- Waiting for #841 and Sprint 164 PR 3 leaves two PRs unable to start. The order above is the cost of not colliding.

## Questions
- Jarmo: does "heading" moving from the old Heading (h2) to Heading 3 count as a removal (see Removals)? I read it as a rename.
- Experience lead: the attribution rule says a last paragraph starting with "— " or "– ". Should a quote with only that one line be drawn as an attribution, or as words? The plan assumes words (an attribution needs words above it).

## Approval
- [x] Jarmo approved this sprint plan (19 November 2026)
