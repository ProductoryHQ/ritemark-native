# Sprint 53: Chrome & Activity Bar

## Goal

Give Ritemark's shell its full Indigo-Editorial shape — move the existing activity bar from the current horizontal-over-sidebar layout to the vertical rail left of the sidebar, preserve the existing Flow button, keep the right Agent Chat Panel unchanged, unify titlebar / tabs / status bar styling through the palette, align Explorer sidebar states to the design rules, and complete a keyboard-first navigation audit covering every chrome surface.

## Why This Sprint Exists

Sprint 52 ships the token layer and primitives. Sprint 53 applies them to the VS Code chrome — the surfaces that live outside the webview, driven by theme JSON + VS Code patches. Today those surfaces are partially adapted (Explorer has Ritemark colors, titlebar has custom layout-controls) and partially default VS Code (status bar is VS Code blue, tabs don't match hairlines, activity bar is still horizontal above the sidebar instead of the vertical rail shown in the target design).

Without this sprint, every downstream sprint's sidebar (Sprint 54 Agents, Sprint 55 Flows, Sprint 56 Settings) has to paper over chrome drift. With this sprint, existing primary chrome surfaces sit in the correct rail/sidebar architecture, with consistent selected-state rules, against chrome that reads as Ritemark.

Strategic framing: `docs-internal/design/ritemark-ui.pen` implementation-roadmap frame — this is card 02.

## Preparation Notes

- Sprint 52 handoff confirms the relevant theme files live under `extensions/ritemark/themes/`, not repo-root `themes/`.
- Sprint 52 changed the icon source of truth to Phosphor. Sprint 53 must not introduce new Lucide names or imports; any design frame that still says Lucide is interpreted through `notes/icons-usage.md`.
- Sprint 52 icon audit confirmed the webview migration is complete, but VS Code chrome still registers/copies the Lucide icon font through patch 001 and `scripts/apply-patches.sh`, and the current activity-bar view-container icons are static SVG assets. Sprint 53 owns that chrome-side cleanup.
- Sprint 52 also rebalanced dark mode from indigo-heavy surfaces to neutral slate. Sprint 53 must use the rebalanced dark tokens from `docs/development/sprints/sprint-52-design-foundations/notes/dark-mode-rebalance.md`, not the older indigo-wash examples in `.claude/skills/ritemark-design/references/vscode-core.md`.
- UI/design decisions are tracked in `docs/development/sprints/sprint-53-chrome-activity-bar/notes/designer-questions.md`. User clarification on 2026-04-24 overrides earlier ambiguous wording: Sprint 53 does **not** implement Agents or an Agent Library slot. The right Agent Chat Panel stays as-is. The existing Flow activity button remains; the main chrome change is moving the activity bar from horizontal-over-sidebar to the vertical rail left of the sidebar, matching the attached target layout.

## Feature Flag Check

- [ ] Does this sprint need a feature flag? **NO.** Chrome layout changes ship to all users by default. This sprint does not introduce the Sprint 54 Agents feature or any experimental Agent Library slot.

## Success Criteria

- [ ] Activity bar layout — existing activity controls move from horizontal-over-sidebar to a vertical rail left of the sidebar, matching the attached target layout
- [ ] Chrome icon system — VS Code chrome/activity-bar no longer registers or ships Lucide icon font assets; existing chrome icons and activity-bar static SVGs use the Sprint 52 Phosphor mapping
- [ ] Existing Flow button — preserved in the vertical activity bar; no new Flows feature work beyond keeping the existing button reachable and styled
- [ ] Right Agent Chat Panel — remains on the right auxiliary side exactly as-is; Sprint 53 must not implement Agent Library or move Agent Chat into the activity bar
- [x] Titlebar — layout-controls toolbar on the right side contains exactly two items (left sidebar toggle, right sidebar toggle); settings gear moved to ActivityBar bottom; no chat icon; no accounts icon; no panel-toggle icon. Inactive state uses ink-disabled token, active uses indigo accent with no background fill. See `notes/titlebar-actions-cleanup.md`.
- [ ] Tabs — active tab has a 2px indigo top border; inactive tabs use `--r-ink-muted` text on `--r-surface-muted` background; hairline divider matches `--r-hairline`
- [ ] Status bar — background `--r-surface-muted` in light and rebalanced neutral-slate muted surface in dark, foreground `--r-ink-body`, interactive segments (item hover, warning / error) use Ritemark semantic colors; not VS Code blue
- [ ] Explorer sidebar — active row uses the closest VS Code-supported mapping to `ritemark-sidebar-item.is-active`; no CSS hacks that fight tree rendering
- [ ] Keyboard navigation — every activity-bar slot, titlebar control, tab action reachable via keyboard alone; documented in `notes/keyboard-map.md`
- [ ] Color contrast — all chrome text meets WCAG AA (4.5:1 for body, 3:1 for large text); verified against light + dark
- [ ] Visual regression harness (from Sprint 52) captures new chrome screenshots; subsequent chrome changes fail loud
- [ ] QA gate: `qa-validator` passes; no regression in Explorer interactions, tab drag / close, activity-bar switching, layout-controls menu

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| Chrome audit | Inventory current state of titlebar, tabs, status bar, activity bar, Explorer sidebar vs design skill rules. Filed at `research/chrome-audit.md` (2026-04-24) covering patch baselines, 73 theme keys, 4 Lucide chrome footprints, 2 view containers, 5 SVG assets, titlebar invariant verification. | 1 | DONE |
| Patch delta plan | Which of patches 001, 002, 003 get extended; no new patch numbers | 2 | DONE — Phase 3 lands in package.json + patch 001 + asset-copy scripts; patch 002 remains validation-only unless live QA reveals a layout regression |
| Theme JSON delta | Keys added / changed in `extensions/ritemark/themes/ritemark-light.json` + `extensions/ritemark/themes/ritemark-dark.json` | 2 | DONE — current Sprint 52 chrome token set already covers Sprint 53 target keys; Phase 3 validates values rather than adding new theme-key families |
| Chrome icon migration plan | Current Lucide font registration, `lucide-static` dependency, `apply-patches.sh` font copy, and static activity-bar SVGs mapped to Phosphor replacements | 2 | DONE — Phosphor web font path chosen; static activity-bar SVGs remain in scope for normalization |
| Activity-bar layout plan | Move current horizontal activity bar to vertical rail left of sidebar; preserve existing buttons including Flow | 2 | DONE — use native left rail via `workbench.activityBar.location = "default"` and verify existing Flow button survives the move |
| Activity-bar bottom actions | Hide Accounts/User until login exists; wire bottom Settings to branded Ritemark Settings; normalize Settings/Product Icon font path | 3 | DONE — see `notes/activitybar-bottom-actions.md` |
| Chrome fast validation | Add a fast pre-compile guard for VS Code chrome patch/icon TypeScript drift | 3 | DONE — see `notes/chrome-fast-validation.md` |
| Titlebar action polish | Remove chat icon from titlebar (patch 003), restore action toolbar to right side (revert leftContent hunk in patch 002), restyle active/inactive states with Indigo-Editorial tokens (patch 002 CSS), trim CLAUDE.md Layout Invariants table | 3 | DONE — see `notes/titlebar-actions-cleanup.md` |
| Agent Chat invariant | Right Agent Chat Panel stays unchanged; no Sprint 54 Agent feature implementation in Sprint 53 | 2 | DONE — user clarified |
| Designer questions | UI decisions posted, resolved/defaulted, and corrected after user clarification | 2 | DONE — defaults accepted 2026-04-24 and Phase 3 approved by user instruction to proceed |
| Keyboard-map draft | Proposed navigation paths before implementation | 2 | TODO |
| **Approval gate** | Jarmo approves audit + plan, with designer questions resolved or explicitly deferred, before Phase 3 starts | 2→3 | DONE — satisfied by user instruction on 2026-04-24: “proceed with implementation of sprint-53” |
| Theme JSON updates | Status bar, tabs, activity bar theme keys landed | 3 | TODO |
| Chrome icon migration | Patch 001 and related asset-copy scripts updated away from Lucide; activity-bar static SVGs replaced with Phosphor-aligned assets; unused Lucide dependency removed if no longer needed | 3 | TODO |
| Patch 002 updates | Activity-bar placement/orientation migration, right Agent Chat Panel invariant confirmation | 3 | TODO |
| Patch 001 updates | Any branding extensions needed for new chrome | 3 | TODO |
| Sidebar item migration | Explorer sidebar uses the skill's active-row rule | 4 | TODO |
| Keyboard audit execution | Walk the proposed keyboard map; fix any gap | 4 | TODO |
| Accessibility sweep | Contrast ratios verified; focus rings visible on every chrome control | 5 | TODO |
| Keyboard-map doc | `notes/keyboard-map.md` published | 5 | TODO |
| Chrome visual regression | Sprint 52's Playwright harness extended with chrome baselines | 5 | TODO |
| Validation | Build, tests, QA, manual smoke tests | 6 | TODO |

## Scope

### In Scope

- `extensions/ritemark/themes/ritemark-light.json` (extend with `tab.*`, `statusBar.*`, `activityBar.activeBorder`)
- `extensions/ritemark/themes/ritemark-dark.json` (same keys, rebalanced dark values)
- `patches/vscode/001-ritemark-branding.patch` (theme bootstrap if dark activityBar default changes)
- `scripts/apply-patches.sh` (chrome icon font asset copy path; should stop copying Lucide once patch 001 no longer registers it)
- `patches/vscode/002-ritemark-ui-layout.patch` (activity-bar orientation/placement, auxiliary Agent Chat Panel invariant confirmation)
- `patches/vscode/003-ritemark-menu-cleanup.patch` (confirm nothing regressed here)
- Any VS Code core CSS that needs token alignment (inside patches only; never edit vscode/ directly)
- Existing view-container contribution points only as needed to preserve current buttons while changing activity-bar placement
- `extensions/ritemark/package.json` only if the existing view-container icon assets or `lucide-static` dependency need cleanup after chrome icon migration
- `extensions/ritemark/media/*-icon.svg` activity-bar assets, replacing Lucide-shaped SVGs with Phosphor-aligned SVGs when those assets remain static
- `extensions/ritemark/webview/tests/visual-regression/` (chrome baselines)
- `docs/development/sprints/sprint-53-chrome-activity-bar/notes/keyboard-map.md` (new)
- `docs/development/sprints/sprint-53-chrome-activity-bar/notes/designer-questions.md` (new)

### Out of Scope

- Editor area redesign (design missing — future sprint will spec)
- Breadcrumbs redesign beyond patch 001 state
- Command palette restyle (defers to upstream VS Code)
- Agent Library / Agents feature work (Sprint 54)
- Flows sidebar content (Sprint 55); Sprint 53 only preserves the existing Flow activity button while moving the bar
- Settings page redesign (Sprint 56)
- New Agent or Flow view containers
- New feature flags or runtime-toggled chrome variants

## Implementation Checklist

### Phase 1: Audit

- [ ] Screenshot every chrome surface in light + dark; compare against `.claude/skills/ritemark-design/preview/` (PARTIAL — preview HTMLs have no chrome surface; `chrome.html` preview is a new Phase 5 deliverable)
- [x] Walk `extensions/ritemark/themes/ritemark-light.json` and `extensions/ritemark/themes/ritemark-dark.json`; list every `tab.*`, `statusBar.*`, `activityBar.*`, `activityBarTop.*`, `sideBar.*`, `list.*`, and `tree.*` key currently set; flag gaps vs skill rules (73 keys, full light/dark symmetry — see `research/chrome-audit.md` §2)
- [x] Inspect patch 002: what's already wired for activity bar / auxiliary bar / titlebar; what's drift-prone (22 files; 8 chrome-relevant — see `research/chrome-audit.md` §1)
- [x] Inspect patch 001 + `scripts/apply-patches.sh`: list every Lucide font registration, `lucide.woff2` copy, `lucide-*` ThemeIcon, and static SVG activity-bar asset still in use (4 Lucide footprints: font-face CSS, iconRegistry.ts 20-icon registration, apply-patches.sh copy, lucide-static dep — see `research/chrome-audit.md` §3)
- [x] Inventory current activity-bar + auxiliary-bar view containers and identify the existing Flow button; do not add an Agents feature slot (2 view containers: `ritemark-flows` on activitybar, `ritemark-ai` on auxiliarybar — see `research/chrome-audit.md` §4)
- [ ] Compare attached target layout and `docs-internal/design/ritemark-ui.pen` chrome frame against the current app; document where the current horizontal activity bar must move (PENDING — needs live dev-mode walk)
- [ ] Keyboard-navigate the full chrome today; document failures (dead ends, missing tab stops, invisible focus) (DEFERRED to Phase 4 keyboard audit — live app needed)
- [ ] Contrast-check current chrome colors against WCAG AA (DEFERRED to Phase 5 accessibility sweep — mathematical check against theme JSONs)
- [x] Produce `research/chrome-audit.md`

### Phase 2: Plan — GATE BEFORE PHASE 3

- [ ] Decide exact theme key deltas (add / change / leave) for `tab.*`, `statusBar.*`, `activityBar.*`
- [x] Decide activity-bar layout direction: move current horizontal-over-sidebar activity bar to vertical rail left of sidebar
- [x] Decide exact migrated button order — Jarmo 2026-04-24: accept `designer-questions.md` Q2 table as proposed default; final lock deferred to Phase 4 live-app QA walk. Phase 3 proceeds with the Q2 proposed order; if Phase 4 QA reveals a mismatch, adjust and re-run Phase 3 theme/patch steps for button order only.
- [ ] Decide hover/selected/focus treatment for the vertical activity bar using current button set
- [x] Post `notes/designer-questions.md` questions and record answers / deferrals in this sprint folder
- [ ] Decide patch delta: which patches get extended, in what order; ensure no new patch numbers
- [x] Decide Phosphor replacement path for chrome icons — **OPTION (a) Phosphor web font** chosen by Jarmo 2026-04-24. Ship `phosphor.woff2` the same way `lucide.woff2` is currently registered (iconRegistry.ts font + codicon.css @font-face + apply-patches.sh copy). Rename 20 `lucide-*` ThemeIcons to `phosphor-*` equivalents via the Sprint 52 `notes/icons-usage.md` mapping.
- [ ] Draft `notes/keyboard-map.md` with proposed paths
- [ ] **APPROVAL GATE**: Jarmo reviews audit + plan, including designer answers / deferrals. Explicit "approved" required. No patch changes until then.

### Phase 3: Theme + Patch Updates

- [ ] Update `extensions/ritemark/themes/ritemark-light.json` with new theme keys per plan
- [ ] Update `extensions/ritemark/themes/ritemark-dark.json` with rebalanced dark variants
- [ ] Update patch 001 and `scripts/apply-patches.sh` so chrome no longer registers/copies Lucide font assets
- [ ] Replace existing static activity-bar SVGs with Phosphor-aligned assets, preserving current view-container IDs and button behavior
- [ ] Remove `lucide-static` from `extensions/ritemark/package.json` only after patch 001 and asset-copy scripts no longer need it
- [ ] Extend patch 002 for vertical activity-bar placement + auxiliary Agent Chat Panel invariant preservation
- [ ] Regenerate patches (`./scripts/apply-patches.sh --dry-run` must show Already applied after)
- [ ] Verify existing Flow button contribution still appears after the activity-bar placement change
- [ ] Verify no Sprint 54 Agents / Agent Library view container is added

### Phase 4: Sidebar Migration + Keyboard Audit

- [ ] Explorer sidebar item treatment — migrate to skill's `ritemark-sidebar-item.is-active` rule
- [ ] Walk the proposed `notes/keyboard-map.md` paths; fix any dead ends or invisible focus
- [ ] Verify migrated vertical activity-bar tab stops are keyboard-reachable in order
- [ ] Verify right Agent Chat Panel keyboard behavior is unchanged

### Phase 5: Accessibility + Docs + Visual Regression

- [ ] Contrast check every chrome surface against WCAG AA (light + dark)
- [ ] Verify focus ring visible on every chrome control (including patched surfaces)
- [ ] Publish `notes/keyboard-map.md` as user-facing shortcut reference
- [ ] Extend Sprint 52's Playwright harness to capture chrome baselines: vertical activity bar (idle / selected), right Agent Chat Panel unchanged, tab (active / inactive), status bar (idle / warning / error), Explorer sidebar row (idle / hover / active)
- [ ] Commit baseline screenshots

### Phase 6: Validation

- [ ] `./scripts/apply-patches.sh --dry-run` — all Already applied
- [ ] Full production build per CLAUDE.md steps
- [ ] `cd extensions/ritemark && npm run compile`
- [ ] `cd extensions/ritemark/webview && npm run build`
- [ ] Visual regression harness — all green
- [ ] `./scripts/validate-qa.sh`
- [ ] Manual QA: switch existing activity-bar buttons after vertical migration, including Flow; confirm selected-state visual and no new Agents entry
- [ ] Manual QA: confirm right Agent Chat Panel opens, renders, and behaves exactly as before
- [ ] Manual QA: drag-reorder tabs; confirm active indicator follows; confirm no layout shift
- [ ] Manual QA: switch light ↔ dark; confirm status bar, tabs, activity bar all track theme
- [ ] Manual QA: keyboard-only navigation per `notes/keyboard-map.md`
- [ ] Produce `notes/validation-log.md` + `handover.md` for Sprint 54

## Invariants This Sprint Must Uphold

1. **Never stub or disable existing features** — Explorer, Terminal, Search (keyboard-accessible via Cmd+F per sprint 47), Git (if present) all remain fully functional
2. **Layout invariants from CLAUDE.md** — Ritemark AI panel stays on auxiliary bar, Terminal stays on auxiliary bar, titlebar stays at two items (left sidebar toggle, right sidebar toggle), settings gear lives in ActivityBar bottom (not titlebar), accounts/chat/panel-toggle icons stay hidden
3. **Patch discipline** — no new patch numbers; all changes land inside patches 001-006
4. **Unused-import hygiene** — VS Code build is strict; any patch line that removes a call must also remove the import
5. **Theme switch is runtime-safe** — light ↔ dark at runtime works with no reload required
6. **Keyboard accessibility is a ship blocker** — if `notes/keyboard-map.md` has a dead end, sprint is not done

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Patch 002 extension breaks 22-minute build | HIGH | Always run `./scripts/apply-patches.sh --dry-run` after extending; unused-import hygiene enforced; apply patch, compile, check before rebuilding full |
| Activity-bar migration regresses existing right Agent Chat Panel | HIGH | User clarified the Agent Chat Panel stays as-is — test after every patch edit; do not implement Sprint 54 Agents |
| Theme JSON edit changes VS Code's own dark theme | MEDIUM | All changes isolated to `ritemark-light.json` / `ritemark-dark.json`; default-theme bootstrap already gates Ritemark themes |
| Sprint 53 starts from stale Sprint 52 dark-token docs | MEDIUM | Use Sprint 52 `dark-mode-rebalance.md` as the dark-token source until design skill mirrors are explicitly updated |
| Activity-bar design frame is misread as new Agent feature scope | HIGH | Treat Sprint 53 as layout/chrome only: verticalize existing activity bar, preserve Flow button, keep right Agent Chat Panel unchanged |
| Webview icon migration is mistaken for chrome migration | HIGH | Sprint 52 completed React/webview only. Sprint 53 must explicitly remove Lucide font registration/copy paths and static Lucide-shaped activity-bar SVGs from chrome. |
| Remaining designer defaults become wrong during implementation | MEDIUM | Keep defaults from `notes/designer-questions.md` visible in Phase 2; ask for explicit override only if screenshots reveal a mismatch |
| Tab active-indicator color clashes with status bar interactive segments | LOW | Both use `--r-accent` — consistent by design |
| Keyboard map has hidden gaps | MEDIUM | Phase 1 manual walk; Phase 4 keyboard audit; Phase 6 manual QA; three independent passes |
| Contrast sweep finds WCAG AA failures in existing tokens | MEDIUM | If found, Sprint 52 tokens are re-evaluated; fallback is to darken foreground on affected surfaces |
| Sprint 54 Agents work leaks into Sprint 53 | HIGH | Agent Library / Agents feature is explicitly out of scope; only preserve current Agent Chat Panel |
| SQLite `views.customizations` cache overrides new activity-bar layout | HIGH | VS Code caches view-container positions per-user in `views.customizations` (SQLite). Package.json is the default only; cached positions win. Mitigation: include a one-shot cache-clear in Phase 3 patch + document the manual developer reset (`rm ~/Library/Application\ Support/Ritemark/User/globalStorage/state.vscdb`); add cache-clear verification to Phase 6 manual QA. |
| Upstream VS Code submodule bump mid-sprint | MEDIUM | The 2026-03-22 patch-consolidation disaster was triggered during a bump. Freeze `vscode/` submodule at the current SHA (VS Code 1.109.5) for the full duration of Sprint 53. If an unavoidable security bump arrives, run `./scripts/apply-patches.sh --dry-run` + full compile + manual smoke test before any Sprint 53 chrome work resumes. Record the pre-sprint submodule SHA in `notes/validation-log.md` at Phase 6. |
| Patch 001/002 file count drifts silently (PATCH-RULES §8) | HIGH | Baseline recorded in `research/chrome-audit.md`: patch 001 = 14 files, patch 002 = 22 files, patch 003 = 14 files. Before and after each patch edit, re-run `grep '^diff --git' patches/vscode/NNN-*.patch \| wc -l` and record in `notes/validation-log.md`. Hard-fail if a patch silently loses files. |
| Lucide chrome residue not fully removed | HIGH | Chrome still has 4 Lucide footprints: font-face CSS block in patch 001, `iconRegistry.ts` 20-icon registration, `scripts/apply-patches.sh` font copy, `lucide-static` dep. All four must come out in Phase 3; Phase 6 grep `grep -r "lucide" patches/ scripts/ extensions/ritemark/package.json` must return empty. |

## Key Research

- `docs-internal/design/ritemark-ui.pen` — sidebar-variants frame (`8Y0ct`), implementation-roadmap frame (`pNQWS` card 02)
- `.claude/skills/ritemark-design/references/components.md` — sidebar active-row rule, FilterChip, Badge, Pill
- `.claude/skills/ritemark-design/references/vscode-core.md` — theme key patterns
- Sprint 52 handover (`notes/validation-log.md`) — token / primitive / dark-theme baseline
- Sprint 52 `notes/icons-usage.md` — Phosphor-only icon rule and activity-bar icon mapping
- Sprint 52 `notes/icon-migration-plan.md` and `notes/validation-log.md` — webview migration completed; chrome-side Lucide font/static SVG path deferred here
- Sprint 52 `notes/dark-mode-rebalance.md` — neutral slate dark-mode handoff
- User-provided target layout screenshot — activity bar vertical left of sidebar, right Agent Chat Panel unchanged
- CLAUDE.md Layout Invariants section

## Key Files

| File | Purpose |
| --- | --- |
| `extensions/ritemark/themes/ritemark-light.json` | EXTEND — tab, statusBar, activityBar keys |
| `extensions/ritemark/themes/ritemark-dark.json` | EXTEND — same keys, rebalanced dark values |
| `patches/vscode/001-ritemark-branding.patch` | EXTEND — default-theme tweaks if needed; migrate chrome icon font registration away from Lucide |
| `scripts/apply-patches.sh` | EXTEND — remove Lucide font copy path once patch 001 no longer needs it |
| `patches/vscode/002-ritemark-ui-layout.patch` | EXTEND — activity-bar placement/orientation |
| `extensions/ritemark/package.json` | REVIEW — existing Flow button wiring plus `lucide-static` dependency cleanup after chrome icon migration |
| `extensions/ritemark/media/*-icon.svg` | EXTEND — static activity-bar icons must match Phosphor visual language if retained |
| `extensions/ritemark/src/views/*Provider.ts` | REVIEW ONLY unless existing selected-state wiring needs preservation after layout move |
| `extensions/ritemark/webview/tests/visual-regression/` | EXTEND — chrome baselines |
| `docs/development/sprints/sprint-53-chrome-activity-bar/notes/keyboard-map.md` | NEW |
| `docs/development/sprints/sprint-53-chrome-activity-bar/notes/designer-questions.md` | NEW |

## Status

**Current Phase:** Closing — implementation complete, ready for commits per sprint procedure.
**Current Branch:** `feat/sprint-53-chrome-activity-bar` (branched from `main` @ `45863aa`)
**QA Status:** `qa-validator` PASS (2026-04-25) — all 6 patches apply cleanly, TypeScript clean, layout invariants intact, no unused-import build-breakers. `validate-chrome-fast.sh` PASS.

**Phase 3 decisions resolved 2026-04-24:**
- Lucide chrome migration path: **(a) Phosphor web font** (ship `phosphor.woff2`, rename 20 ThemeIcons).
- Activity-bar orientation: **`package.json:434` `"workbench.activityBar.location"` = `"default"`** (one-line change, no patch 002 work).
- Button order: **accept `designer-questions.md` Q2 proposed table as default**, lock in Phase 4 live-app QA.
- Designer Q8/Q9/Q11: **all three defaults accepted** (hairline-grey unfocused active tab, quiet status bar semantics, VS Code native `focusBorder` without custom glow).

**Final session 2026-04-25 — titlebar polish:**
- Settings gear removed from titlebar (already moved to ActivityBar bottom in patch 002 working-tree edits earlier in sprint; this session confirmed it via fresh dev build after stale-`out/` discovery).
- Chat icon (`codicon-chat-sparkle`) removed via patch 003 — neutralized two `MenuRegistry.appendMenuItem` blocks in `agentSessionsExperiments.contribution.ts`. Whack-a-mole pattern documented.
- Action toolbar restored to right side of titlebar — removed an unexplained `rightContent → leftContent` hunk from patch 002. Upstream `rightContent` behavior now preserved.
- Active/inactive button styling restyled in `titlebarpart.css` — inactive uses `--ritemark-ink-disabled`, active uses `--ritemark-indigo` foreground with no background fill.
- CLAUDE.md Layout Invariants table trimmed — over-specific icon-by-icon enumeration replaced with single rule pointing to patches 002+003 as canonical owners; chat-whack-a-mole warning added to upstream-sync notes.

**Deferred (out of this sprint, not blockers):**
- Keyboard map (`notes/keyboard-map.md`) — pending live-app keyboard audit.
- Visual regression harness chrome baselines.
- Phase 5 accessibility/contrast sweep.
