# Sprint 53 Designer Questions

Date: 2026-04-24  
Status: Corrected — reviewed against .pen source of truth and Sprint 52 handoff docs, then corrected by user clarification on 2026-04-24.

## User Clarification — 2026-04-24

The earlier interpretation that Sprint 53 should add or implement an Agents activity-bar slot was wrong.

Authoritative Sprint 53 scope:

- **Do not implement Agents / Agent Library in Sprint 53.** That is Sprint 54 Agent Curation scope.
- **Keep the right Agent Chat Panel as-is.** It remains the existing right-side auxiliary panel.
- **Preserve the existing Flow button.** Flow is already present in the activity bar; Sprint 53 should not treat it as a new feature.
- **Move the existing activity bar layout.** The current activity bar is horizontal over the sidebar top; the target design moves it to a vertical rail left of the sidebar.
- The attached target layout screenshot is the practical source for this chrome layout correction.

## Context

Sprint 53 applies the Sprint 52 design system to VS Code chrome: titlebar, activity rail, auxiliary rail, tabs, status bar, Explorer/tree states, and keyboard/focus behavior.

Available inputs:

- `docs-internal/design/ritemark-ui.pen` includes chrome frames for activity bar, sidebar, tab strip, and status bar.
- Sprint 52 `notes/icons-usage.md` makes Phosphor the only icon family and maps Activity Bar icons.
- Sprint 52 `notes/dark-mode-rebalance.md` makes neutral slate the dark-mode surface direction, with indigo reserved for accents.
- `.claude/skills/ritemark-design/references/vscode-core.md` maps many VS Code theme keys, but some dark examples are stale after the Sprint 52 rebalance.

## Resolved From .pen / Existing Docs

These questions had answers already present in the .pen source of truth or locked project invariants. Recorded here so the decisions are explicit.

### 1. Activity rail placement

**Corrected answer:** Sprint 53 moves the existing activity bar to the **left vertical rail**. It does not add an Agents feature slot. The right auxiliary panel contains the existing Agent Chat Panel ("RITEMARK AI") and stays unchanged. The existing Flow button remains in the activity bar.

**Sprint 54 note:** Agent Library / Agent Curation iconography and placement are deferred to Sprint 54.

### 2. Slot order

**Corrected answer:** The exact migrated order should be audited from the current app and attached target layout. Do not add Agents in Sprint 53. Preserve current buttons, including the existing Flow button.

| Position | Icon | Slot |
| --- | --- | --- |
| Top 1 | `folder-open` | Explorer (selected in .pen) |
| Top 2 | existing current button | Preserve current behavior |
| Top 3 | existing Flow button | Flow, already present |
| Top 4 | `magnifying-glass` | Search |
| Top 5 | `git-branch` | Source Control |
| Top 6 | `puzzle-piece` | Extensions |
| Bottom 1 | `user-circle` | Account |
| Bottom 2 | `gear` | Settings |

This table is no longer an implementation mandate for Agents. The Phase 1 audit must capture the current button set and map it into the vertical rail.

### 4. Flows icon

**Answer:** Preserve the existing Flow button in the migrated vertical activity bar. Use the Sprint 52 Phosphor mapping (`flow-arrow`) only if the current icon needs to be normalized during the chrome migration.

### 7. Dark chrome values

**Answer:** Already decided. `dark-mode-rebalance.md` is frozen spec: "surfaces and hairlines collapse onto a neutral slate ramp; indigo reserved for accents only." The .pen frame `P0bi1` renders the rebalanced palette. All chrome surfaces (status bar, activity rail, tabs, sidebar) use the neutral-slate tokens, not the older indigo-heavy values.

### 12. Titlebar controls

**Answer:** Locked CLAUDE.md layout invariant. The .pen dark titlebar (`7Srdi`) confirms exactly three controls: `sidebar-simple` (left sidebar toggle), `sidebar` (right sidebar toggle), `gear` (settings). No accounts icon, no panel toggle. No change needed.

## Questions For Designer

These genuinely need a design decision — the .pen does not specify these states.

### 3. Agents icon

Superseded by user clarification. Do not implement an Agents slot in Sprint 53.

**Default:** Keep the existing right Agent Chat Panel icon/entry behavior unchanged. Defer Agent Library iconography to Sprint 54.

### 5. Badge behavior

Superseded by user clarification. Do not add Agents badges in Sprint 53.

**Default:** Preserve existing badges only. Do not add new Agent badge behavior.

### 8. Tab focus states

Active focused tabs have the 2px indigo top border (visible in .pen `0jl6j`). The .pen does not show the unfocused active tab state. Should unfocused active tabs:
- (a) Keep an indigo top border at lower opacity (e.g. 40%) to maintain brand presence, or
- (b) Fall back to a hairline grey border to make editor-group focus instantly clear?

**Default if no answer:** Option (b) — hairline grey for unfocused active tabs. Focus distinction is more important than brand presence on a secondary state.

### 9. Status bar semantic states

The .pen only shows the normal status bar state. Should warning/error/debug status bar items use:
- (a) Full semantic fills (red/yellow background segments), or
- (b) Ritemark's quieter pattern (neutral background with semantic icon/text color only), except for blocking errors which get full fills?

**Default if no answer:** Option (b) — quiet semantic treatment. Full fills only for blocking errors. Consistent with Ritemark's editorial restraint.

### 11. Keyboard/focus visuals

Should chrome focus rings use the standard Ritemark 4px 10% indigo glow where VS Code theme keys permit it, or should native VS Code focus outlines remain for core surfaces to avoid patching risk?

**Default if no answer:** Use VS Code's native `focusBorder` theme key (already set to `$--r-accent` / `#818CF8`) rather than patching custom glow CSS. The indigo color is correct; the glow spread is a webview refinement that doesn't need to carry into VS Code core chrome.

## Engineering Notes

These items were originally listed as designer questions but are engineering/QA concerns.

### 6. Selected state in VS Code trees

The .pen sidebar tree (`57gPj`, row `qcxaQ`) specifies: 2px left accent border + `$--r-accent-soft` fill. VS Code theme keys cannot reliably render a left-border treatment on tree rows. **Engineering decision:** implement the closest match using `list.activeSelectionBackground` (accent-soft fill) + `list.focusAndSelectionOutline` (accent border). If the visual gap is noticeable, escalate to the designer with a side-by-side screenshot before attempting a CSS patch.

### 10. Visual regression source frames

Canonical .pen frame IDs for Sprint 53 baselines:
- `vcb9R` — activityBar (light)
- `2ILFu` — activityBar (dark, inside `P0bi1`)
- `57gPj` — sidebarTree
- `0jl6j` — tabStrip
- `3Aro0` — statusBar (light)
- `rHDFj` — statusBar (dark, inside `P0bi1`)
- `P0bi1` — full dark default view

## New Questions (Identified During Review)

These gaps were found by inspecting the .pen frames. No existing spec covers them.

### 13. Activity bar hover state

Neither light nor dark .pen frames show what happens when hovering over an unselected activity bar icon. Should the hover use a `surface-soft` fill behind the icon (matching sidebar tree hover rows), or just a color shift on the icon itself?

**Default if no answer:** Subtle `surface-soft` background fill on hover, matching the sidebar tree hover treatment.

### 14. Activity bar collapsed state

What happens when the sidebar is collapsed and the activity bar icons remain visible? Does the selected indicator (2px left border) remain? Do icons get tooltips? The .pen only shows the expanded state.

**Default if no answer:** Selected indicator remains; icons show tooltips on hover. Standard VS Code behavior, no custom work needed.

### 15. Auxiliary bar activity strip

Superseded by user clarification. The right Agent Chat Panel stays as-is in Sprint 53. Do not redesign or add a new auxiliary activity strip as part of this sprint.

**Default:** Preserve existing right-side behavior and focus styling unless the vertical activity-bar migration accidentally regresses it.

## Proposed Defaults Summary

If no designer input arrives before Phase 3:

- Follow the attached target layout for the Sprint 53 chrome layout: current activity bar becomes vertical left of sidebar.
- Do not implement Agents / Agent Library in Sprint 53.
- Preserve the existing Flow button and existing right Agent Chat Panel.
- Preserve existing badge behavior only; do not add Agent badges.
- Unfocused active tabs fall back to hairline grey (focus clarity over brand).
- Status bar uses quiet semantic treatment (icon/text color, not full fills) except blocking errors.
- Chrome focus uses VS Code's native `focusBorder` (already indigo) without custom glow patches.
- Tree selected state uses theme keys only; escalate to designer if approximation looks wrong.
- Activity bar hover gets subtle `surface-soft` background fill.
- Right Agent Chat Panel stays unchanged; no auxiliary strip redesign.
