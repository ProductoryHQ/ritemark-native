# Sprint 169 tasks

Phase 3 starts only after Jarmo's approval, #850 merged, and the sprint branch exists.

## PR 1: the full set as data (High)
- [x] Generator emits the path module and the search index
- [x] `slideIcon` accepts any regular name or alias; the 24 and the aliases stay
- [x] The page inlines exactly the used icons
- [x] The DECKS rules list every name plus the aliases
- [x] Bundle growth measured against the 1 MB budget and written in the PR
- [x] Tests: generated names match `@phosphor-icons/core`, old decks read the same

## PR 2: every surface draws from the full set (High, after Sprint 167 PR 2)
- [x] One drawing on every surface: block slides through `boxIconBadge` (editor, strip, wall, presenter view, page), the old layout and the icon menu through `SlideIconGlyph` (its React twin), none through the chrome's `Icon`
- [ ] Shots of `icon: truck` on all four, and the page offline, for the Experience lead: the editor, strip, wall and page taken (PR 2's proof); the presenter view's own window not yet

## PR 3: Search icons (Standard)
- [x] Field, in-use first, then the 24, then results by name, tag and alias
- [x] "No icons match"; "No icon" at the foot; Esc and outside click close as every popup does
- [x] Shots before and after typing "truck", "people" and "mail" (`proof/pr3-search/`)

## PR 4: the unknown name's tooltip (Standard, after #850 and PR 3)
- [x] "No icon named “xyz”" and Choose an icon, opening the menu with the name in the search (and the names nearest a misspelt one; `proof/pr4-unknown-name/`)

## Sprint end
- [ ] Full chain once on each final head, output to a file
- [ ] `qa-validator` sign-off
- [ ] Update `docs/development/architecture.md` if the structure changed
