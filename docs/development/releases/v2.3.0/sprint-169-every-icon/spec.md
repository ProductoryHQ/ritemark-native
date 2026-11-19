# Sprint 169 spec: every Phosphor icon, found by searching

The behaviour contract is the decks README in the governance repo, `product/design/experience/experiences/decks/README.md`, section "Every Phosphor icon, found by searching" (ritemark-dev 286af7c, with c6f8477 on unknown names). It wins on any disagreement.

- **R1 The menu:** a box's icon menu has a "Search icons" field. Before typing: the deck's icons in use, then the 24. Typing searches all regular icons by name and Phosphor's English tags, and keeps the grid's aliases. "No icons match" when nothing does. "No icon" stays at the foot.
- **R2 One family:** Phosphor regular only. No uploaded SVGs. The theme's colours reach every icon as today.
- **R3 The file:** `icon: <name>`, where any Phosphor regular name or alias is valid. Claude's deck-writing tool names icons the same way.
- **R4 Content, not chrome:** the editor, the strip, the wall and the presenter view draw a slide's icon from the full set. The published page inlines exactly the icons its deck uses.
- **R5 Unknown names:** `circle-dashed` in `--s-ph` on the badge's `--s-accs` ground, everywhere (Sprint 166 #850). In the editor a tooltip says "No icon named “xyz”" and offers "Choose an icon", which opens the menu with the name in its search.
- **R6 The DECKS rules** list the 24 until this sprint lands, then every regular name plus the aliases.
