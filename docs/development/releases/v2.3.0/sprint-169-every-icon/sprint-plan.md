# Sprint 169: Every Phosphor icon for boxes, found by searching

Track: SDD (auto-detected: five user-facing requirements, and a flow from the file through the host, the editor, the strip, the wall, the presenter view and the published page). Override with: "use plain full track".
Branch: sprint-169-every-icon
Release tier: extension (the recommended delivery below is all `out/**/*.js` and `media/webview.js`, so no full release is needed)
Status: Phase 2 (PLAN), waiting for Jarmo's approval

The parent release is v2.3.0, and its `release-plan.md` tracks this sprint. The spec is the decks README in the governance repo (`product/design/experience/experiences/decks/README.md`, section "Every Phosphor icon, found by searching", ritemark-dev commits 286af7c and c6f8477). Jarmo agreed it with the Experience lead on 19 November ("1. jah 2. ei, saada arendusse": yes to the full set with a search, no to icons of one's own). That sent it to planning. It is not his approval of this sprint.

## SDD Artifacts
- [spec.md](spec.md): the behaviour contract, which points at the README
- [scenarios.md](scenarios.md): examples that become the manual and test matrix
- [technical-plan.md](technical-plan.md): file pointers and the delivery options
- [tasks.md](tasks.md): the checklist
- [sprint-plan.md](sprint-plan.md): this file

## Goal
A box can carry any of Phosphor's 1,512 regular icons, found by typing in the icon menu, and every surface draws it, offline.

## Feature Flag Check
- Needs a new flag? No. Decks stays behind the existing `ritemark.features.decks`, and every PR lives inside it. Nothing new is added or turned off.

## Linked Issues
One GitHub issue per PR in milestone v2.3.0, to be created at the sprint's start.
- PR 1: to be created
- PR 2: to be created
- PR 3: to be created
- PR 4: to be created

## Pull requests
| PR | Branch | Content | Review tier |
|---|---|---|---|
| 1 | `sprint-169-every-icon-pr1` | The full set as data: a generated path module and search index, `slideIcon` widened to every name and alias, the page inlines exactly the used icons, the DECKS rules list the full set; includes the bundle measurement against the budget | High (file lookup, the published page, bundle size) |
| 2 | `sprint-169-every-icon-pr2` | The editor, strip, wall and presenter view draw a slide's icon from the full set, not through the chrome `Icon.tsx` | High (every surface; slide drawing) |
| 3 | `sprint-169-every-icon-pr3` | The icon menu's "Search icons" field: in-use icons, then the 24, then results; "No icons match" | Standard |
| 4 | `sprint-169-every-icon-pr4` | The unknown-name tooltip "No icon named “xyz”" with Choose an icon, which opens the menu with the name in the search | Standard |

## Order and overlap
- **Sprint 166 PR 9 (#850) lands first, and this sprint widens its list.** #850 owns the unknown-name look (`circle-dashed` in `--s-ph` on the badge's `--s-accs` ground) and its lookup point, with the 24 as the valid names. PR 1 here then widens the one list it checks. If it went the other way, this sprint would define the fallback and #850 would be left with nothing, and Jarmo's #850 decision would be built twice. PR 4 reuses #850's fallback and only adds the tooltip.
- **Sprint 167 PR 2 (Mark for Boxes, `OWN_MARK_LOOKS`) lands before PR 2 here.** Both change where a box decides to draw an icon and in which look (`slideRenderer.ts`, `slideDivView.ts`, `SlideCanvas.tsx`). PR 1 (data and lookup) and PR 3 (the menu) touch other files, so they may start once #850 has merged. PR 2 waits for 167 PR 2, so it moves the drawing once and not twice.
- **Within this sprint:** PR 1, then PR 2, then PR 3, then PR 4. PR 3 needs PR 1's index, PR 4 needs PR 3's search and #850's fallback.
- Each PR fills the template's Risk and How to revert, gets `REVIEW.md`'s review at its tier with every finding answered, and merges only after the Experience lead has looked at its shots, taken on synthetic decks only.

## Delivery of the drawings (recommended: path data in a generated module)
| Option | Webview bundle cost | Verdict |
|---|---|---|
| A. Path data in a generated module (what `pageIcons.ts` does for 35 icons) | About +0.9 MB raw for 1,512 icons on top of the ~7.6 MB bundle (an estimate from the package's SVG size, not yet measured; PR 1 measures it); the host bundle takes the same module | **Recommended.** One mechanism for the editor, strip, wall, presenter and page; works offline; extension-tier |
| B. The woff2 font by code point | About +40 KB (code point map and search index), nothing for drawings | The page and the strip's thumbnails are string SVG and would still need path data for the used icons, so it does not remove A. It also needs a font URL the webview may load, and the font lives in `producticons/`, outside the files an extension release ships. Not chosen |
| C. A lazy chunk | About 0 in the first load | The webview is one IIFE bundle (`media/webview.js`) and an extension release ships only that file, so a second chunk file would need a full release. Not chosen unless PR 1's measurement fails the budget |

PR 1 sets a budget: the webview bundle grows by at most 1 MB. If it grows more, PR 1 stops and asks Jarmo before choosing B or C, since C would make the sprint shell-tier. The search index (names, aliases, tags, about 150 KB) is a separate module so the menu can be measured on its own.

## Removals (HARD RULE #1)
None. A narrow look found nothing that goes. The chrome `Icon.tsx` keeps every import for the chrome. The 24 and the grid's aliases stay, as the pre-search view and as aliases. If a PR's author finds something that really goes, it is listed here and waits for Jarmo's yes by name before any code is deleted.

## Success Criteria
- [ ] The icon menu has "Search icons"; before typing it shows the deck's icons in use, then the 24; typing finds icons by name, Phosphor tag and alias.
- [ ] "truck", "people" and "mail" each give sensible results (mail finds envelope-simple); a nonsense word shows "No icons match"; "No icon" stays at the foot.
- [ ] A box with an icon outside the 24 shows it in the editor, on the strip, on the wall, in the presenter view and on the published page, offline.
- [ ] The file is unchanged: `icon: <name>`; any Phosphor regular name or alias is valid.
- [ ] An unknown name draws `circle-dashed` everywhere, and the editor's tooltip offers Choose an icon with the name already in the search.
- [ ] The page carries only the icons its deck uses.
- [ ] The webview bundle grew by no more than the budget, and the number is written in the PR.
- [ ] The Experience lead has seen each PR's shots before it merges.
- [ ] The full test chain ran once on each final head.
- [ ] `qa-validator` has signed off at the sprint's end.

## Release notes
One line per PR, in plain words for people, written with the `release-notes` skill:
- PR 1: a box's icon can be any of Phosphor's 1,500 icons, and the published page carries the ones a deck uses.
- PR 2: icons outside the first 24 look right in the editor, the strip, the wall and the presenter view.
- PR 3: search for a box's icon by what it is, such as "truck" or "people".
- PR 4: an icon name that doesn't exist shows a dashed circle, and one click opens the search to choose another.

## Risks
- The bundle grows with the data. The budget and the measurement in PR 1 are the guard.
- The unknown-name look must be the same on every surface, or the wall shows an empty badge where the editor shows a dashed circle.
- Phosphor's tags are English only; "mail" works through the aliases kept from today's grid.
- Search must not run a 1,512-icon render on every key. It filters names and draws only the visible results.

## Questions
- Jarmo: is a +1 MB budget on the webview bundle acceptable, with a stop-and-ask beyond it?
- Development manager: does #850 land before PR 1 can start, as the plan assumes?

## Approval
- [ ] Jarmo approved this sprint plan
