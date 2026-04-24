# Sprint 53: Chrome & Activity Bar

## Goal

Give Ritemark's shell its full Indigo-Editorial shape — activity bar with proper slots (Agents + Flows), unified titlebar, tabs + status bar restyled through the palette, Explorer sidebar aligned to the design skill's active-row rule, and a keyboard-first navigation audit covering every chrome surface.

## Why This Sprint Exists

Sprint 52 ships the token layer and primitives. Sprint 53 applies them to the VS Code chrome — the surfaces that live outside the webview, driven by theme JSON + VS Code patches. Today those surfaces are partially adapted (Explorer has Ritemark colors, titlebar has custom layout-controls) and partially default VS Code (status bar is VS Code blue, tabs don't match hairlines, activity bar has no explicit Agents / Flows plan).

Without this sprint, every downstream sprint's sidebar (Sprint 54 Agents, Sprint 55 Flows, Sprint 56 Settings) has to paper over chrome drift. With this sprint, every primary surface reaches through the same activity bar, with the same selected-row rule, against chrome that reads as Ritemark.

Strategic framing: `docs-internal/design/ritemark-ui.pen` implementation-roadmap frame — this is card 02.

## Feature Flag Check

- [ ] Does this sprint need a feature flag? **NO.** Chrome changes ship to all users by default. Activity-bar slots for Agents and Flows are permanent design decisions, not experimental toggles.

## Success Criteria

- [ ] Activity bar (left rail) — confirmed slots, selected-row indicator is 2px indigo left-border via `activityBar.activeBorder` theme key; matches the pen file's sidebar-variants frame
- [ ] Auxiliary bar (right rail) — Ritemark Agents slot, Ritemark Flows slot, Terminal slot (existing), all with icons that pass the Sprint 52 icon-family rule
- [ ] Titlebar — layout-controls menu contains exactly three items (left sidebar toggle, right sidebar toggle, settings gear); no drift; no accounts icon; no panel-toggle icon
- [ ] Tabs — active tab has a 2px indigo top border; inactive tabs use `--r-ink-muted` text on `--r-surface-muted` background; hairline divider matches `--r-hairline`
- [ ] Status bar — background `--r-surface-muted`, foreground `--r-ink-body`, interactive segments (item hover, warning / error) use Ritemark semantic colors; not VS Code blue
- [ ] Explorer sidebar — active row matches `ritemark-sidebar-item.is-active` rule (2px indigo left-border, accent-soft background, 500 weight, no content shift)
- [ ] Keyboard navigation — every activity-bar slot, titlebar control, tab action reachable via keyboard alone; documented in `notes/keyboard-map.md`
- [ ] Color contrast — all chrome text meets WCAG AA (4.5:1 for body, 3:1 for large text); verified against light + dark
- [ ] Visual regression harness (from Sprint 52) captures new chrome screenshots; subsequent chrome changes fail loud
- [ ] QA gate: `qa-validator` passes; no regression in Explorer interactions, tab drag / close, activity-bar switching, layout-controls menu

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| Chrome audit | Inventory current state of titlebar, tabs, status bar, activity bar, Explorer sidebar vs design skill rules | 1 | TODO |
| Patch delta plan | Which of patches 001, 002, 003 get extended; no new patch numbers | 2 | TODO |
| Theme JSON delta | Keys added / changed in `themes/ritemark-light.json` + `themes/ritemark-dark.json` | 2 | TODO |
| Activity-bar slot plan | Where Agents + Flows sit on the auxiliary bar; icon choices; context-menu entries | 2 | TODO |
| Keyboard-map draft | Proposed navigation paths before implementation | 2 | TODO |
| **Approval gate** | Jarmo approves audit + plan before Phase 3 starts | 2→3 | BLOCKING |
| Theme JSON updates | Status bar, tabs, activity bar theme keys landed | 3 | TODO |
| Patch 002 updates | Activity-bar slot wiring, auxiliary-bar slot confirmation | 3 | TODO |
| Patch 001 updates | Any branding extensions needed for new chrome | 3 | TODO |
| Sidebar item migration | Explorer sidebar uses the skill's active-row rule | 4 | TODO |
| Keyboard audit execution | Walk the proposed keyboard map; fix any gap | 4 | TODO |
| Accessibility sweep | Contrast ratios verified; focus rings visible on every chrome control | 5 | TODO |
| Keyboard-map doc | `notes/keyboard-map.md` published | 5 | TODO |
| Chrome visual regression | Sprint 52's Playwright harness extended with chrome baselines | 5 | TODO |
| Validation | Build, tests, QA, manual smoke tests | 6 | TODO |

## Scope

### In Scope

- `themes/ritemark-light.json` (extend with `tab.*`, `statusBar.*`, `activityBar.activeBorder`)
- `themes/ritemark-dark.json` (same keys, dark values)
- `patches/vscode/001-ritemark-branding.patch` (theme bootstrap if dark activityBar default changes)
- `patches/vscode/002-ritemark-ui-layout.patch` (activity-bar slot wiring, auxiliary-bar slot confirmation)
- `patches/vscode/003-ritemark-menu-cleanup.patch` (confirm nothing regressed here)
- Any VS Code core CSS that needs token alignment (inside patches only; never edit vscode/ directly)
- `extensions/ritemark/package.json` (Ritemark Agents view container, Ritemark Flows view container)
- `extensions/ritemark/src/views/*Provider.ts` (register view containers, selected-state wiring)
- `extensions/ritemark/webview/tests/visual-regression/` (chrome baselines)
- `docs/development/sprints/sprint-53-chrome-activity-bar/notes/keyboard-map.md` (new)

### Out of Scope

- Editor area redesign (design missing — future sprint will spec)
- Breadcrumbs redesign beyond patch 001 state
- Command palette restyle (defers to upstream VS Code)
- Webview content of Agents or Flows sidebars (Sprint 54, Sprint 55)
- Settings page redesign (Sprint 56)
- New view containers beyond Agents, Flows, Terminal (Terminal already exists)
- New feature flags or runtime-toggled chrome variants

## Implementation Checklist

### Phase 1: Audit

- [ ] Screenshot every chrome surface in light + dark; compare against `.claude/skills/ritemark-design/preview/`
- [ ] Walk `themes/ritemark-light.json` and list every `tab.*`, `statusBar.*`, `activityBar.*`, `sideBar.*` key currently set; flag gaps vs skill rules
- [ ] Inspect patch 002: what's already wired for activity bar / auxiliary bar / titlebar; what's drift-prone
- [ ] Inventory current activity-bar + auxiliary-bar view containers (extension package.json `contributes.viewsContainers`)
- [ ] Keyboard-navigate the full chrome today; document failures (dead ends, missing tab stops, invisible focus)
- [ ] Contrast-check current chrome colors against WCAG AA
- [ ] Produce `research/chrome-audit.md`

### Phase 2: Plan — GATE BEFORE PHASE 3

- [ ] Decide exact theme key deltas (add / change / leave) for `tab.*`, `statusBar.*`, `activityBar.*`
- [ ] Decide activity-bar slot plan: Agents icon (`people` or similar Lucide), Flows icon (`workflow` or similar); confirm positions; confirm context-menu entries
- [ ] Decide patch delta: which patches get extended, in what order; ensure no new patch numbers
- [ ] Draft `notes/keyboard-map.md` with proposed paths
- [ ] **APPROVAL GATE**: Jarmo reviews audit + plan. Explicit "approved" required. No patch changes until then.

### Phase 3: Theme + Patch Updates

- [ ] Update `themes/ritemark-light.json` with new theme keys per plan
- [ ] Update `themes/ritemark-dark.json` with dark variants
- [ ] Extend patch 002 for activity-bar + auxiliary-bar slot wiring
- [ ] Regenerate patches (`./scripts/apply-patches.sh --dry-run` must show Already applied after)
- [ ] Register Ritemark Agents + Ritemark Flows view containers in `extensions/ritemark/package.json`
- [ ] Wire selected-state routing in view providers

### Phase 4: Sidebar Migration + Keyboard Audit

- [ ] Explorer sidebar item treatment — migrate to skill's `ritemark-sidebar-item.is-active` rule
- [ ] Walk the proposed `notes/keyboard-map.md` paths; fix any dead ends or invisible focus
- [ ] Verify activity-bar + auxiliary-bar tab stops are keyboard-reachable in order

### Phase 5: Accessibility + Docs + Visual Regression

- [ ] Contrast check every chrome surface against WCAG AA (light + dark)
- [ ] Verify focus ring visible on every chrome control (including patched surfaces)
- [ ] Publish `notes/keyboard-map.md` as user-facing shortcut reference
- [ ] Extend Sprint 52's Playwright harness to capture chrome baselines: activity bar (idle / selected), auxiliary bar (idle / selected), tab (active / inactive), status bar (idle / warning / error), Explorer sidebar row (idle / hover / active)
- [ ] Commit baseline screenshots

### Phase 6: Validation

- [ ] `./scripts/apply-patches.sh --dry-run` — all Already applied
- [ ] Full production build per CLAUDE.md steps
- [ ] `cd extensions/ritemark && npm run compile`
- [ ] `cd extensions/ritemark/webview && npm run build`
- [ ] Visual regression harness — all green
- [ ] `./scripts/validate-qa.sh`
- [ ] Manual QA: switch activity-bar slots (Explorer → Agents → Flows → Terminal → Settings); confirm selected-state visual
- [ ] Manual QA: drag-reorder tabs; confirm active indicator follows; confirm no layout shift
- [ ] Manual QA: switch light ↔ dark; confirm status bar, tabs, activity bar all track theme
- [ ] Manual QA: keyboard-only navigation per `notes/keyboard-map.md`
- [ ] Produce `notes/validation-log.md` + `handover.md` for Sprint 54

## Invariants This Sprint Must Uphold

1. **Never stub or disable existing features** — Explorer, Terminal, Search (keyboard-accessible via Cmd+F per sprint 47), Git (if present) all remain fully functional
2. **Layout invariants from CLAUDE.md** — Ritemark AI panel stays on auxiliary bar, Terminal stays on auxiliary bar, titlebar stays at three items (left sidebar, right sidebar, settings gear), accounts icon stays hidden, panel toggle stays hidden
3. **Patch discipline** — no new patch numbers; all changes land inside patches 001-006
4. **Unused-import hygiene** — VS Code build is strict; any patch line that removes a call must also remove the import
5. **Theme switch is runtime-safe** — light ↔ dark at runtime works with no reload required
6. **Keyboard accessibility is a ship blocker** — if `notes/keyboard-map.md` has a dead end, sprint is not done

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Patch 002 extension breaks 22-minute build | HIGH | Always run `./scripts/apply-patches.sh --dry-run` after extending; unused-import hygiene enforced; apply patch, compile, check before rebuilding full |
| Activity-bar slot wiring regresses existing Ritemark AI panel position | HIGH | CLAUDE.md invariant says AI stays on auxiliary bar — test after every patch edit |
| Theme JSON edit changes VS Code's own dark theme | MEDIUM | All changes isolated to `ritemark-light.json` / `ritemark-dark.json`; default-theme bootstrap already gates Ritemark themes |
| Tab active-indicator color clashes with status bar interactive segments | LOW | Both use `--r-accent` — consistent by design |
| Keyboard map has hidden gaps | MEDIUM | Phase 1 manual walk; Phase 4 keyboard audit; Phase 6 manual QA; three independent passes |
| Contrast sweep finds WCAG AA failures in existing tokens | MEDIUM | If found, Sprint 52 tokens are re-evaluated; fallback is to darken foreground on affected surfaces |
| Agents + Flows slots conflict with future Agent Library (Sprint 54) | LOW | Library lives inside the Agents slot; this sprint just reserves the activity-bar entry |

## Key Research

- `docs-internal/design/ritemark-ui.pen` — sidebar-variants frame (`8Y0ct`), implementation-roadmap frame (`pNQWS` card 02)
- `.claude/skills/ritemark-design/references/components.md` — sidebar active-row rule, FilterChip, Badge, Pill
- `.claude/skills/ritemark-design/references/vscode-core.md` — theme key patterns
- Sprint 52 handover (`notes/validation-log.md`) — token / primitive / dark-theme baseline
- CLAUDE.md Layout Invariants section

## Key Files

| File | Purpose |
| --- | --- |
| `themes/ritemark-light.json` | EXTEND — tab, statusBar, activityBar keys |
| `themes/ritemark-dark.json` | EXTEND — same keys, dark values |
| `patches/vscode/001-ritemark-branding.patch` | EXTEND — default-theme tweaks if needed |
| `patches/vscode/002-ritemark-ui-layout.patch` | EXTEND — activity-bar slot wiring |
| `extensions/ritemark/package.json` | EXTEND — view container registration for Agents + Flows |
| `extensions/ritemark/src/views/*Provider.ts` | EXTEND — selected-state wiring |
| `extensions/ritemark/webview/tests/visual-regression/` | EXTEND — chrome baselines |
| `docs/development/sprints/sprint-53-chrome-activity-bar/notes/keyboard-map.md` | NEW |

## Status

**Current Phase:** Not started — blocked on Sprint 52 completion
**Current Branch:** TBD (proposed: `feat/sprint-53-chrome-activity-bar`)
**Next Gate:** Sprint 52 handover → Phase 1 chrome audit
