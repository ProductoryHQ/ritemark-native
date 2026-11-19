# Sprint 169 tasks

Phase 3 starts only after Jarmo's approval, #850 merged, and the sprint branch exists.

## PR 1: the full set as data (High)
- [ ] Generator emits the path module and the search index
- [ ] `slideIcon` accepts any regular name or alias; the 24 and the aliases stay
- [ ] The page inlines exactly the used icons
- [ ] The DECKS rules list every name plus the aliases
- [ ] Bundle growth measured against the 1 MB budget and written in the PR
- [ ] Tests: generated names match `@phosphor-icons/core`, old decks read the same

## PR 2: every surface draws from the full set (High, after Sprint 167 PR 2)
- [ ] `SlideIconGlyph` used by the editor, strip, wall and presenter view
- [ ] Shots of `icon: truck` on all four, and the page offline, for the Experience lead

## PR 3: Search icons (Standard)
- [ ] Field, in-use first, then the 24, then results by name, tag and alias
- [ ] "No icons match"; "No icon" at the foot; Esc and outside click close as every popup does
- [ ] Shots before and after typing "truck", "people" and "mail"

## PR 4: the unknown name's tooltip (Standard, after #850 and PR 3)
- [ ] "No icon named “xyz”" and Choose an icon, opening the menu with the name in the search

## Sprint end
- [ ] Full chain once on each final head, output to a file
- [ ] `qa-validator` sign-off
- [ ] Update `docs/development/architecture.md` if the structure changed
