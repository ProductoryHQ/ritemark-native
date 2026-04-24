# Sprint 53: Chrome & Activity Bar

The second altitude of Ritemark's Indigo-Editorial rollout. Sprint 52 ships the token layer; Sprint 53 gives the shell its full shape — every primary surface reachable, every token earned.

## Why this sprint exists

Ritemark currently ships a custom titlebar, a truncated layout-controls menu, hidden accounts icon, Explorer sidebar with Ritemark polish, the existing Flow activity button, and a right-side Agent Chat Panel. What it doesn't ship yet is the target chrome layout: the activity bar should be vertical on the far left of the sidebar instead of horizontal above the sidebar. Sprint 53 also applies the selected-row rule, unified tab styling, status bar palette, and keyboard-first navigation audit across chrome surfaces.

Sprint 52 gives us the vocabulary (tokens, primitives, dark theme). Sprint 53 writes the sentence (the chrome you live inside).

## In scope

- Activity bar (`workbench.parts.activitybar.*` via patch 002) — move the existing horizontal-over-sidebar activity bar to the vertical rail left of the sidebar, matching the attached target layout
- Existing Flow button — preserve it in the migrated vertical activity bar
- Right Agent Chat Panel — keep it as-is; Sprint 53 does not implement the Sprint 54 Agent Library / Agents feature
- Titlebar — confirm layout-controls menu is exactly three items (left sidebar toggle, right sidebar toggle, settings gear); account for any drift since patch 002
- Tabs — restyle through `tab.*` theme keys to match Ritemark hairlines + active-indicator color; active tab indicator becomes indigo (top border, 2px)
- Status bar — restyle through `statusBar.*` theme keys; no more VS Code blue; reads as Ritemark (surface-muted background, ink-body text, indigo for interactive segments)
- Explorer sidebar — confirm active-row treatment matches the skill's sidebar-item rule (2px indigo left-border, accent-soft background, 500 weight; border reserves space so content doesn't shift)
- Keyboard-first navigation audit — every activity-bar slot, every titlebar control, every tab action reachable via keyboard alone; publish a `notes/keyboard-map.md` for users
- Accessibility sweep — color contrast ratios on all chrome surfaces (light + dark), focus-ring visibility, screen-reader landmark roles

## Out of scope

- Editor area redesign (future sprint — design is currently missing per the pen file roadmap card discussion)
- Agent Library / Agents feature surface (Sprint 54)
- Flows sidebar content (Sprint 55); Sprint 53 only preserves the existing Flow button while moving the activity bar
- Settings page redesign (Sprint 56)
- New patches beyond the existing 001-006 set; changes to chrome land inside the existing domain-grouped patches

## Dependencies

**Hard dependency on Sprint 52.** This sprint assumes the dark theme ships, Tailwind aliases are live, primitives are in place, and the visual regression harness exists. Without those, every chrome change here introduces drift that can't be caught.

## Success signal

- A new user opens Ritemark Native cold and the chrome reads as *a product*, not *a VS Code variant*
- Existing primary surfaces remain reachable after the activity bar moves vertical, including the current Flow button and the right Agent Chat Panel
- Dark mode + light mode chrome both respect the palette; status bar is never VS Code blue
- Keyboard users can navigate the full chrome without touching the mouse; `notes/keyboard-map.md` documents the path
- Visual regression harness (from Sprint 52) captures new chrome baselines and catches future drift

## Status

**Current Phase:** Preparation — user clarification applied; Sprint 53 is chrome layout, not Agents implementation
**Current Branch:** TBD
**Next Gate:** Sprint 53 Phase 1 chrome audit + remaining designer defaults confirmed or accepted

## Open UI Inputs

Designer answers and later user clarification are tracked in `notes/designer-questions.md`. The authoritative clarification: keep the right Agent Chat Panel as-is, do not implement Agents in Sprint 53, preserve the existing Flow button, and move the current activity bar from horizontal-over-sidebar to the vertical rail left of the sidebar.

Remaining defaulted items before Phase 3: migrated activity-bar hover/selected/focus treatment, collapsed activity-bar behavior, unfocused active-tab border, status bar semantic intensity, keyboard/focus visual treatment, and exact visual-regression baselines.
