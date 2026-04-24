# Sprint 53: Chrome & Activity Bar

The second altitude of Ritemark's Indigo-Editorial rollout. Sprint 52 ships the token layer; Sprint 53 gives the shell its full shape — every primary surface reachable, every token earned.

## Why this sprint exists

Ritemark currently ships a custom titlebar, a truncated layout-controls menu, hidden accounts icon, Explorer sidebar with Ritemark polish, and an Auxiliary Bar reserved for AI. What it doesn't ship: a coherent activity bar plan (slots for Agents + Flows on the right-hand rail), a selected-row indicator rule (2px indigo left-border — spec'd in Sprint 52, not yet applied to VS Code core surfaces), unified tab styling that reads as Ritemark rather than VS Code, a status bar that respects the palette instead of defaulting to VS Code blue, and a keyboard-first navigation audit that confirms every chrome surface responds to keyboard without mouse.

Sprint 52 gives us the vocabulary (tokens, primitives, dark theme). Sprint 53 writes the sentence (the chrome you live inside).

## In scope

- Activity bar (`workbench.parts.activitybar.*` via patch 002) — add explicit slots for Ritemark Agents and Ritemark Flows, each with a defined position, icon, and selected-row indicator (2px indigo left-border per skill spec)
- Titlebar — confirm layout-controls menu is exactly three items (left sidebar toggle, right sidebar toggle, settings gear); account for any drift since patch 002
- Tabs — restyle through `tab.*` theme keys to match Ritemark hairlines + active-indicator color; active tab indicator becomes indigo (top border, 2px)
- Status bar — restyle through `statusBar.*` theme keys; no more VS Code blue; reads as Ritemark (surface-muted background, ink-body text, indigo for interactive segments)
- Explorer sidebar — confirm active-row treatment matches the skill's sidebar-item rule (2px indigo left-border, accent-soft background, 500 weight; border reserves space so content doesn't shift)
- Keyboard-first navigation audit — every activity-bar slot, every titlebar control, every tab action reachable via keyboard alone; publish a `notes/keyboard-map.md` for users
- Accessibility sweep — color contrast ratios on all chrome surfaces (light + dark), focus-ring visibility, screen-reader landmark roles

## Out of scope

- Editor area redesign (future sprint — design is currently missing per the pen file roadmap card discussion)
- Agent Library surface (Sprint 54)
- Flows sidebar content (Sprint 55 promotes Flows from experimental to activity-bar; this sprint only reserves the slot and wires the icon)
- Settings page redesign (Sprint 56)
- New patches beyond the existing 001-006 set; changes to chrome land inside the existing domain-grouped patches

## Dependencies

**Hard dependency on Sprint 52.** This sprint assumes the dark theme ships, Tailwind aliases are live, primitives are in place, and the visual regression harness exists. Without those, every chrome change here introduces drift that can't be caught.

## Success signal

- A new user opens Ritemark Native cold and the chrome reads as *a product*, not *a VS Code variant*
- Every primary surface (Explorer, Agents, Flows, Settings, Terminal, AI) reachable via a single activity-bar click with a visible selected state
- Dark mode + light mode chrome both respect the palette; status bar is never VS Code blue
- Keyboard users can navigate the full chrome without touching the mouse; `notes/keyboard-map.md` documents the path
- Visual regression harness (from Sprint 52) captures new chrome baselines and catches future drift

## Status

**Current Phase:** Not started — blocked on Sprint 52 completion
**Current Branch:** TBD
**Next Gate:** Sprint 52 handover → Sprint 53 Phase 1 audit
