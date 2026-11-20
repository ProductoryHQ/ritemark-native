# Sprint 170 tasks

Nothing starts until the plan is approved (Development manager with the Experience lead, on Jarmo's delegation).

## PR 0: spike (docs only)
- [ ] Issue created in milestone v2.3.0
- [ ] Try the three print paths in `technical-plan.md`; write the answer and the tier it implies in `research/`
- [ ] One small PDF from a synthetic deck as proof; fonts embedded, links live, offline
- [ ] Update this plan's tier line and the release plan row

## PR 1: the split button and Slides and handout (#881)
- [x] The split button: Publish stays the main part, a separate ▾ with its own hover and focus, tooltips, outside-click and Esc close
- [x] The item names the view's kind (R2), including under 600 px
- [x] The print of the published page into A4 portrait (R4), skipped slides out, comments and notes never in, Copy and ↗ not drawn
- [x] The save dialog in the deck's folder, the file name, the system's Replace question, cancel writes nothing
- [x] "Saved as <name>.pdf" with Show in folder on the bar
- [x] Tests for each scenario they can cover; shots of the button, the menu and the PDF's first pages
- [ ] Risk and How to revert in the PR; Review record; the lead's look at the shots; release-notes line

## PR 2: Slides (#885)
- [x] One 16:9 page a slide from the wall's renderer; chosen tab and every reveal shown
- [x] Tests and shots; the menu's item for Slide only works
- [ ] Issue, Review record, the lead's look, release-notes line

## PR 3: Handout
- [ ] A4 portrait, the text alone, each part under its number and heading, no slide pictures
- [ ] Tests and shots; the menu's item for Handout only works
- [ ] Issue, Review record, the lead's look, release-notes line

## Sprint end
- [ ] The full test chain once on each final head
- [ ] `qa-validator` at the sprint's end
- [ ] `docs/development/architecture.md` updated if the export structure changed
- [ ] Release plan row set to Done
