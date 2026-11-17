# Sprint 162: deck themes

Track: Full. Release tier: mostly **extension**, but the six bundled fonts (PR 3) are a **shell-tier** change, so they reach people only with the full 2.3 release (which 2.3 is anyway). Decks stays behind `ritemark.features.decks`.<br>
**Status:** **Approved** by Jarmo on 17 November 2026, in the Development manager session: "kinnitan" (I approve).<br>
**Why:** Jarmo, 17 November: "Hoopis olulisem on teemad" (themes matter much more), ahead of pasting from Gamma for 2.3.<br>
**Design:** experience 46 in ritemark-dev: `step-3-themes.md` (prototype v37), on top of the README's "Themes (15 November)" and frames 11–15, 18 and 19.<br>
**Already there before it:** a deck's front matter can name `Slide library/Themes/<Name>.theme.md`. The engine reads its colours, soft light, corners, boxes and font names (`src/decks/deckTheme.ts`), but only Sofia Sans renders, and there was no UI.

## What Jarmo can do after it
- Pick a deck's theme and look from one **Theme** button on the deck's bar ("Evening ▾"). Card | Borderless moves there from the slide's settings.
- Make a new theme, starting from the deck's own, Paper or Ember, and edit it in its own tab: four colours, soft light, fonts, logo, corners and boxes, previewed on six of the deck's slides, saved with Save.
- Ask Claude "make this deck look like our brand". Claude makes the theme from the folder's brand guide, logo or a `.pptx`, and offers See what changed and Undo.
- The wall and the published page show the theme with its fonts and logo. A page changes only with Update the page.

## PRs
| # | What | Tier |
|---|---|---|
| 1 | The Theme button and menu: LOOK (Card \| Borderless) and THEME (the project's themes with "N decks", the current one ticked). Picking a theme writes the deck's `theme:` line, with one Undo. The "This deck" section leaves the slide's settings popover. | High (it writes the deck file) |
| 2 | The theme's own tab: colours with hex, soft light, contrast line, corners, boxes, preview, draft and Save. Edit <Name> and New theme… in the Theme menu, from the deck's theme, Paper or Ember. Save as a new theme… | High (files) |
| 3 | **Fonts:** six SIL OFL fonts bundled (Sofia Sans, Inter, IBM Plex Sans, Space Grotesk, Source Serif 4, Fraunces), used on the slide, the strip, the wall and the page (the page embeds them), their licences in NOTICES. | **Shell** |
| 4 | Logo: top left, top right or bottom right; every slide or title slides only. | Standard |
| 5 | AI: the DECKS instructions teach the theme file, its fields, the six fonts, the contrast rule and "change the theme, not the slides". Claude makes a theme from a brand guide, logo or `.pptx`, with See what changed and Undo, and asks "this deck or all of them" when there are several. | High (the AI writes files) |
| 6 | Publish: the page keeps its theme until Update the page, and the chip says "Published · changed". | Standard |

Each PR gets the Experience lead's look before it merges. Builders run the targeted tests while they work and the full chain once on the final head.

## Order
PR 1 goes first, because it moves "This deck" and touches the bar. After it, PR 2 and PR 3 can run side by side. PR 4–6 follow.

## PR 1 as built
- **The Theme button** (`webview/src/components/decks/ThemeMenu.tsx`) sits on the deck's bar, on the right before Saved: the theme's colours as a small swatch, its name and ▾. Its menu is a Radix popover (it closes on a press outside and on Esc and gives the focus back to the button): LOOK, Card | Borderless, written by the same `setLook` as before; then THEME, the files in `Slide library/Themes/` and the built-in Evening when the project has no file for it, each with its swatch, its name and how many of the project's decks draw it, the current one ticked. The host lists them each time the menu opens (`deck/themes`, `deckPages.themesFor`, `deckTheme.themeEntries`).
- **Which theme a deck draws, for the tick and the count:** the file its `theme:` line names when the project has it; otherwise (no line, or a file that isn't there) the built-in theme, as the engine draws it.
- **A pick** writes the deck's `theme:` line, always naming the file's path (Evening's too, as New → Deck writes it), so a deck stays linked to the project's own Evening file once there is one. It is one step of the deck's Undo (`webview/src/components/decks/theme/themePick.ts`): a history step that leaves the document as it is and carries the line's value before and after, so Cmd+Z anywhere in the deck, and the bar notice's Undo, take it back, and Redo writes it again. The front matter changes only on that line, in the quotes it had (`editorSync/frontMatter.headWithPlainKeyChanges`), so one Undo gives the file back byte for byte. The bar says "This deck uses <Name> now." with Undo.
- **The slide settings popover** keeps only the slide's own settings. Its "This deck" section held only Card | Borderless, which is now in the Theme menu; the strip's Deck look… (for a deck with no slides) went with it, since the Theme button is there at any count.
- **Not in PR 1:** Edit <Name> and New theme… (they open the theme's tab: PR 2). Only Sofia Sans renders until PR 3.

## Not in the sprint
Charts, image styles, custom CSS, per-slide themes, type sizes per level, a library shared across projects, and Gamma import (a Gamma look comes via a PDF or screenshots).
