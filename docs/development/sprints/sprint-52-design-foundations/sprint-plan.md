# Sprint 52: Design Foundations

## Goal

Ship the Ritemark design system — tokens, dark theme, Tailwind aliases, shadcn primitives, icon family, visual regression harness — so every subsequent sprint (53–56) builds on one source of truth instead of reinventing polish rules per surface.

## Why This Sprint Exists

Ritemark has a palette (`extensions/ritemark/themes/ritemark-light.json`), a `ritemark-design` skill with `tokens.css`, and a handful of shadcn components that work. What it doesn't have: dark theme parity, Tailwind semantic aliases (so JSX stops hardcoding hexes), a shadcn primitive layer aligned to the skill (Badge / Pill / FilterChip live as spec, not as code), an icon-family rule (Lucide 1px stroke, with Phosphor / Material Symbols exceptions documented), and a visual regression harness that catches drift before it ships.

Without those, every downstream sprint's designer / engineer either reads six files to figure out the right token, or lands close-to-right and gets corrected in review. The cost compounds. This sprint ends that.

Strategic framing: `docs-internal/analysis/design-study/` — Option D (Indigo-current) was selected. `docs-internal/design/ritemark-ui.pen` — implementation roadmap (Sprint 52 is the hero card).

## Feature Flag Check

- [ ] Does this sprint need a feature flag? **NO.** Foundation work — tokens, theme, primitives — is shipped to all users by default. Dark mode is a theme selection, not a flag. No experimental surface introduced.

## Success Criteria

- [ ] `ritemark-design` skill at `.claude/skills/ritemark-design/` is complete: `SKILL.md`, `tokens.css`, `references/components.md`, `references/webview-ui.md`, `references/typography.md`, `references/vscode-core.md`, `references/audit-current.md`, `preview/*.html`, optional `slides/*`
- [ ] `extensions/ritemark/themes/ritemark-dark.json` exists and is wired through patch 001 so VS Code defaults to it on dark-mode systems; looks unmistakably Ritemark — neutral slate surfaces (slate-950 chrome, slate-900 editor body, slate-800 elevated) with indigo retained ONLY as accent (active tab top rail, selected-row left bar, focus borders, primary buttons, accent badges), not VS Code charcoal
- [ ] `extensions/ritemark/webview/src/index.css` semantic vars (`--background`, `--primary`, `--foreground`, etc.) resolve to `--r-*` Ritemark tokens first; `--vscode-*` fallback only for scrollbar / context-menu surfaces
- [ ] `extensions/ritemark/webview/tailwind.config.ts` exposes semantic aliases (`text-ink-muted`, `bg-surface-soft`, `border-hairline`, `bg-accent`, `bg-accent-soft`, `text-accent-deep`, etc.); each alias maps to a `--r-*` role token; no component needs to write raw hexes or `--vscode-*` class utilities
- [ ] `components/ui/badge.tsx`, `components/ui/pill.tsx`, `components/ui/filter-chip.tsx` implemented per spec in `.claude/skills/ritemark-design/references/components.md`
- [ ] `components/ui/button.tsx` matches spec (indigo shadow on primary, 10px radius, scale-on-press); existing call sites unchanged
- [ ] `components/ui/dialog.tsx` backdrop is Deep Space tint (`rgba(30, 27, 75, 0.45)` + 6px blur), not default black
- [x] **Phosphor** is the default icon family (weight 100 / thin, 12/14/16/20px sizes); rules, tokens, and the Lucide→Phosphor migration plan are recorded in `notes/icons-usage.md` and mirrored in `docs-internal/design/ritemark-ui.pen` → `yq4P8` Icon Usage Guide (source of truth)
- [ ] Surface-state reference locked — `references/vscode-core.md` contains the state-mapping tables (Explorer / Search / Outline rows, Tabs, Activity Bar, Status Bar, Menus, Inputs) and `docs-internal/design/ritemark-ui.pen` "VS Code surface states" frame renders each state with its theme keys; the two are 1:1
- [ ] Visual regression harness (Playwright) captures baseline screenshots for: Dialog, Button (primary / secondary / ghost), FilterChip (idle / selected), Badge, Pill, Card, Input (idle / focus / error), sidebar item (idle / hover / active); Chrome migration in Sprint 53 must pass visual check against the "VS Code surface states" pen frame
- [ ] `webview/src/components/welcome/**` and `webview/src/components/settings/**` pass visual regression against the skill's `preview/` references with zero diffs
- [ ] QA gate: `qa-validator` passes; no regression in Settings, Welcome, ChatView, AgentSelector, Flows, Dialog interactions

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| Skill audit + gap list | Inventory `.claude/skills/ritemark-design/`: what's written, what's missing, what drifted from current code | 1 | DONE |
| Webview styling audit | Map every place the webview currently writes raw hex, uses `--vscode-*` on surfaces we own, or relies on shadcn defaults | 1 | DONE |
| Icon usage audit | Count Lucide / Phosphor / Material Symbols usage across webview + VS Code patches; recommend rules | 1 | SUPERSEDED |
| Ritemark dark theme spec | Finalize `extensions/ritemark/themes/ritemark-dark.json` shape + package/product/default bootstrap wiring | 2 | DONE |
| Tailwind alias spec | Final list of semantic aliases + `--r-*` mappings for `tailwind.config.ts` | 2 | DONE |
| Primitive component spec confirmation | Badge / Pill / FilterChip implementation spec frozen in `references/components.md` (FilterChip already spec'd) | 2 | TODO |
| Surface-state reference | `references/vscode-core.md` state-mapping tables + `docs-internal/design/ritemark-ui.pen` "VS Code surface states" frame (Explorer rows, Tabs, Activity Bar) — bridges the webview CSS-class spec to VS Code core theme-key spec so core surfaces actually render the tokens | 2 | DONE |
| Implementation checkpoint | Jarmo has authorized proceeding; ask only if a design/runtime choice is unclear | 2→3 | ACTIVE |
| Skill completion | Missing files added (`references/audit-current.md`, `references/iconography.md`, any skill-preview gaps) | 3 | TODO |
| Dark theme implementation | `extensions/ritemark/themes/ritemark-dark.json` exists; visual tuning complete — Jarmo accepted on 2026-04-24 | 3 | DONE |
| Dark theme rebalance handoff | Token-by-token mapping from over-indigo prototype to neutral slate (see notes/dark-mode-rebalance.md) | 3 | DONE |
| Tailwind aliases | `tailwind.config.ts` — semantic aliases (accent, surface, ink, hairline, ritemark) mapped to `--r-*` | 3 | DONE |
| `index.css` rebase | Semantic vars chain `--r-*` first, dark mode flip via `body.vscode-dark` | 3 | DONE |
| Primitive implementations | `badge.tsx`, `pill.tsx`, `filter-chip.tsx` added; `button.tsx` + `dialog.tsx` audited + corrected | 4 | DONE |
| Explorer tree styling | Row height 28px, inset accent bar, hidden indent guides, vertical centering; patch 002 updated | 4 | DONE |
| Existing-surface migration | `--vscode-*` → `--r-*` token migration across 81 webview files (156→2 remaining, both in var() fallbacks) | 4 | DONE |
| Icon family lockdown | **REVERSED 2026-04-24 after design audit.** Phosphor is sole family (weight 100, 12/14/16/20 sizes). `.pen` Icon Usage Guide (yq4P8) is source of truth; text mirror in `notes/icons-usage.md`. `references/iconography.md` is OUT OF DATE — rewrite queued below. | 4 | DONE (family) / STALE DOC |
| Icons usage text spec | `notes/icons-usage.md` mirrors yq4P8: tokens, API, surface→icon mapping, Lucide→Phosphor migration table, forbidden rules | 4 | DONE |
| Icon Usage Guide (.pen) expansion | `yq4P8` extended with Dev Contract section (tokens table, Component API, migration table, forbidden card) + Visual Reference section (sizes, weights, states) | 4 | DONE |
| Rewrite `references/iconography.md` | Replace Lucide-default content with Phosphor rules from `notes/icons-usage.md` so the skill is not actively misleading | 5 | DONE — Codex applied the drafted content on 2026-04-24. |
| Webview Lucide → Phosphor migration | Add `@phosphor-icons/react`; create `components/ui/Icon.tsx` wrapper; replace 67 `lucide-react` call sites per rename table; drop 1px-stroke CSS override; remove `lucide-react` dep. Detailed sub-plan: `notes/icon-migration-plan.md`. VS Code chrome/activity-bar icon patch work is explicitly deferred to Sprint 53. | 5+ | DONE (webview) / CHROME DEFERRED |
| Visual regression harness | Playwright screenshot capture script + baseline images committed | 5 | DEFERRED |
| Docs | `references/audit-current.md` (checklist), `references/iconography.md` (Phosphor rules — done by Codex), `notes/icons-usage.md` (authoritative text). audit-current.md §8–9 Phosphor patch drafted at `notes/audit-current-phosphor-patch.md` — Jarmo/Codex applies. | 5 | DONE (iconography.md) / PATCH DRAFTED (audit-current.md) |
| Validation | TS clean, Vite build clean, QA validator PASS, patches applied | 6 | DONE |

## Scope

### In Scope

-   `.claude/skills/ritemark-design/` (reference source; do not modify Claude-owned assets unless explicitly requested)
    
-   `extensions/ritemark/themes/ritemark-dark.json` (new)
    
-   `patches/vscode/001-ritemark-branding.patch` (dark-theme bootstrap)
    
-   `extensions/ritemark/webview/src/index.css` (semantic var rebase)
    
-   `extensions/ritemark/webview/tailwind.config.ts` (semantic aliases)
    
-   `extensions/ritemark/webview/src/components/ui/` (primitive audit + additions)
    
-   `extensions/ritemark/webview/src/components/welcome/**` (migration to primitives — no redesign)
    
-   `extensions/ritemark/webview/src/components/settings/**` (migration to primitives — no redesign)
    
-   `extensions/ritemark/webview/src/components/chat/**` (migration to primitives — no redesign)
    
-   `extensions/ritemark/webview/src/components/flows/**` (migration to primitives — no redesign)
    
-   Visual regression harness at `extensions/ritemark/webview/tests/visual-regression/`
    
-   Pen file updates: bring `docs-internal/design/ritemark-ui.pen` Tokens frame into sync with any tokens.css additions
    

### Out of Scope

-   Activity bar / titlebar / tabs / status bar redesign (Sprint 53)
    
-   Agent Library surface (Sprint 54)
    
-   Flows sidebar elevation to activity bar (Sprint 55)
    
-   Settings page redesign beyond primitive migration (Sprint 56)
    
-   Marketing surfaces production (landing page, social-share images)
    
-   New feature flags or runtime-toggled design variants
    
-   Removing VS Code's dark mode entirely (we ship Ritemark Dark as a theme; VS Code's own dark themes remain available for users who want them)
    

## Implementation Checklist

### Phase 1: Audit

- [ ] Walk `.claude/skills/ritemark-design/` file by file — flag every gap, drift, or TODO
- [ ] Inventory `webview/src/**/*.{ts,tsx,css}` for: raw hex colors, `--vscode-*` on owned surfaces, shadcn defaults without Ritemark override, inline styles that should be token refs
- [ ] Inventory icon imports: `lucide-react`, `@phosphor-icons/react`, Material Symbols CSS — count usages, note surfaces
- [ ] Confirm `tokens.css` palette matches the pen file Tokens frame (`docs-internal/design/ritemark-ui.pen` bi8Au) — done in Sprint 54 prep; re-verify
- [x] Produce `research/foundations-audit.md`

### Phase 2: Specs — GATE BEFORE PHASE 3

- [ ] Finalize `extensions/ritemark/themes/ritemark-dark.json` shape: every VS Code color key mapped to a Ritemark dark token
- [ ] Finalize Tailwind alias list: exhaustive map of semantic name → `--r-*` var
- [x] Finalize icon rules: Phosphor is the default family; tokens, sizes, weights, migration captured in `notes/icons-usage.md` + `.pen` yq4P8 (source of truth). `references/iconography.md` rewrite deferred to Sprint 53.
- [x] Surface-state mapping tables in `references/vscode-core.md` (Explorer / Tabs / Activity Bar / Status Bar / Menus / Inputs) + matching "VS Code surface states" pen frame
- [ ] Visual regression scope: which components capture baselines, what breakpoints, what light / dark combinations
- [ ] `references/audit-current.md` outline — the checklist engineers will run before merging new components
- [x] Implementation authorization received: proceed on `feat/sprint-52-design-foundations`; ask Jarmo only if a design/runtime choice is unclear.

### Phase 3: Theme + Tokens + Aliases

- [ ] Ship `extensions/ritemark/themes/ritemark-dark.json`
  - [ ] Replace over-indigo surface hexes with neutral slate per notes/dark-mode-rebalance.md (every #1E1B4B / #191635 / #251F5C surface and #3730A3 / #4338CA hairline must remap)
- [ ] Update `patches/vscode/001-ritemark-branding.patch` so dark-mode systems boot into Ritemark Dark by default (light remains the explicit default where Jarmo has already pinned it)
- [ ] Rebase `webview/src/index.css` semantic vars to `--r-*` first
- [ ] Add Tailwind aliases to `tailwind.config.ts`
- [ ] Close any `tokens.css` gaps surfaced in Phase 1

### Phase 4: Primitives + Migration

- [ ] `components/ui/badge.tsx` — soft pill per `references/components.md`
- [ ] `components/ui/pill.tsx` — variant coverage (info / success / warning / error / accent)
- [ ] `components/ui/filter-chip.tsx` — FilterChip per spec added in Sprint 54 prep
- [ ] Audit `components/ui/button.tsx` — indigo shadow, 10px radius, scale-on-press; fix any drift
- [ ] Audit `components/ui/dialog.tsx` — Deep Space backdrop tint + 6px blur
- [ ] Migrate Welcome, Settings, ChatView, Flows, AgentSelector call sites onto primitives + semantic aliases
- [ ] Lock icon family per `references/iconography.md`

### Phase 5: Visual Regression + Docs

- [ ] Playwright harness: capture + commit baseline screenshots for every primitive + key surface
- [ ] Wire harness into `./scripts/validate-qa.sh` as a non-blocking first-run, blocking on regression
- [ ] Write `references/audit-current.md` (checklist for engineers)
- [ ] Write `references/iconography.md` (icon rules + exceptions)
- [ ] Update `.claude/skills/ritemark-design/preview/*.html` with any new primitives so the skill preview stays accurate

### Phase 6: Validation

- [ ] `cd extensions/ritemark && npm run compile`
- [ ] `cd extensions/ritemark/webview && npm run build`
- [ ] Visual regression harness: `npx playwright test` — all green
- [ ] `./scripts/validate-qa.sh`
- [ ] Manual QA: open every primary surface in light + dark, confirm it reads as Ritemark, not VS Code
- [ ] Manual QA: switch between light and dark at runtime, confirm no flash-of-unstyled-content
- [ ] Manual QA: Settings page (`RitemarkSettings.tsx` must remain ≥400 lines; no regression)
- [ ] Manual QA: every shadcn-derived component on screen reads through semantic aliases (inspect in devtools)
- [ ] Produce `notes/validation-log.md` + `handover.md` for Sprint 53

## Invariants This Sprint Must Uphold

1.  **Never stub or disable existing features** (CLAUDE.md HARD RULE #1) — migrating a component onto primitives must produce zero visible change; Welcome, Settings, Chat, Flows, AgentSelector all remain fully functional
    
2.  **Settings page full implementation** — `RitemarkSettings.tsx` must remain ≥400 lines; token migration does not shrink it
    
3.  **Features ON by default** — no disabled features, no hidden UI introduced
    
4.  **VS Code fallback path preserved for unowned surfaces** — scrollbar, context menus, command palette continue to use `--vscode-*` vars
    
5.  **Theme switch is runtime-safe** — no reload required to go light ↔ dark after the foundation lands
    
6.  **Pen file stays in sync** — any token added must appear in the `Tokens` frame of `docs-internal/design/ritemark-ui.pen`
    

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| `--vscode-*` removal breaks a surface we thought we owned | HIGH | Phase 1 audit is exhaustive; visual regression harness catches drift; phased migration (commit per surface) |
| Dark theme drifts from Ritemark into "just another indigo dark" | HIGH | Rebalance done: surfaces are neutral slate, indigo budget is per-surface (accents only — active indicators, focus, primary buttons, badges). Canonical reference is the `Next-gen — Default view (Dark)` frame in `docs-internal/design/ritemark-ui.pen`; implementation must follow the token map in `notes/dark-mode-rebalance.md`. |
| Tailwind alias migration introduces subtle color shifts | MEDIUM | Baseline visual regression before alias work; diff after |
| shadcn primitive refactors break existing call sites | MEDIUM | Component API unchanged; only token references shift |
| Icon family change leaves orphans (imports that no longer resolve) | MEDIUM | Phase 1 icon audit; Phase 4 migration keeps imports tree-shake-clean |
| Sprint 53 + 54 blocked longer than expected | MEDIUM | Aggressive scope discipline — primitives and theme are the critical path; everything else can slip to Sprint 52.5 |
| Spec-to-theme-key gap — `components.md` speaks CSS classes but VS Code core speaks theme keys, and core surfaces silently drop tokens | HIGH | `references/vscode-core.md` state-mapping tables + "VS Code surface states" pen frame make the translation explicit; every core surface has its keys listed; audit checklist on the frame itself |
| Welcome / onboarding regression | LOW | Already uses shadcn; migration is alias swap, not redesign |

## Key Research

-   `!IMPORTANT! docs-internal/design/ritemark-ui.pen` **— visual reference (Tokens frame, sidebar-variants frame, roadmap frame)**
    
-   `docs-internal/analysis/design-study/` — Option D (Indigo-current) selection
    
-   `.claude/skills/ritemark-design/SKILL.md` — visual language source
    
-   `.claude/skills/ritemark-design/tokens.css` — token layer
    
-   `.claude/skills/ritemark-design/references/components.md` — component rules + FilterChip spec

-   `.claude/skills/ritemark-design/references/vscode-core.md` — surface-state mapping tables (Explorer / Tabs / Activity Bar / Status Bar / Menus / Inputs) — the bridge from spec to theme JSON

-   `docs-internal/design/ritemark-ui.pen` — "VS Code surface states" frame renders each state beside its theme keys
    

## Key Files

| File | Purpose |
| --- | --- |
| `.claude/skills/ritemark-design/` | Reference skill (read-only unless explicitly requested) |
| `extensions/ritemark/themes/ritemark-dark.json` | REWRITE — surfaces & hairlines remap to slate; accents stay indigo (see notes/dark-mode-rebalance.md) |
| `patches/vscode/001-ritemark-branding.patch` | EXTEND — dark theme bootstrap |
| `extensions/ritemark/webview/src/index.css` | EXTEND — semantic var rebase |
| `extensions/ritemark/webview/tailwind.config.ts` | EXTEND — semantic aliases |
| `extensions/ritemark/webview/src/components/ui/badge.tsx` | NEW |
| `extensions/ritemark/webview/src/components/ui/pill.tsx` | NEW |
| `extensions/ritemark/webview/src/components/ui/filter-chip.tsx` | NEW |
| `extensions/ritemark/webview/src/components/ui/button.tsx` | AUDIT |
| `extensions/ritemark/webview/src/components/ui/dialog.tsx` | AUDIT |
| `extensions/ritemark/webview/tests/visual-regression/` | NEW — Playwright harness |
| `docs-internal/design/ritemark-ui.pen` | KEEP IN SYNC |

## Status

**Current Phase:** Phase 6 complete — all deliverables landed.
**Current Branch:** `feat/sprint-52-design-foundations`
**Completed:** Token system, Tailwind aliases, primitives (badge/pill/filter-chip/button/dialog), explorer tree (28px rows, inset accent bar), surface migration (81 files, 156→2 --vscode-* remaining), Lucide → Phosphor webview migration (67 files, tsc+build+qa clean), dark theme visuals (Jarmo accepted 2026-04-24), iconography.md rewrite (Codex 2026-04-24), QA validation (all green).
**Deferred to Sprint 53+:** Visual regression Playwright harness, VS Code chrome/activity-bar icon patches (covered by Sprint 53 Chrome work), audit-current.md §8–9 Phosphor patch (drafted — Jarmo/Codex applies).
**Ready for:** Single commit `feat(sprint-52): design foundations + Phosphor icon migration`.
