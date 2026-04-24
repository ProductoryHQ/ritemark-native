# Sprint 52: Design Foundations

## Goal

Ship the Ritemark design system — tokens, dark theme, Tailwind aliases, shadcn primitives, icon family, visual regression harness — so every subsequent sprint (53–56) builds on one source of truth instead of reinventing polish rules per surface.

## Why This Sprint Exists

Ritemark has a palette (`themes/ritemark-light.json`), a `ritemark-design` skill with `tokens.css`, and a handful of shadcn components that work. What it doesn't have: dark theme parity, Tailwind semantic aliases (so JSX stops hardcoding hexes), a shadcn primitive layer aligned to the skill (Badge / Pill / FilterChip live as spec, not as code), an icon-family rule (Lucide 1px stroke, with Phosphor / Material Symbols exceptions documented), and a visual regression harness that catches drift before it ships.

Without those, every downstream sprint's designer / engineer either reads six files to figure out the right token, or lands close-to-right and gets corrected in review. The cost compounds. This sprint ends that.

Strategic framing: `docs-internal/analysis/design-study/` — Option D (Indigo-current) was selected. `docs-internal/design/ritemark-ui.pen` — implementation roadmap (Sprint 52 is the hero card).

## Feature Flag Check

- [ ] Does this sprint need a feature flag? **NO.** Foundation work — tokens, theme, primitives — is shipped to all users by default. Dark mode is a theme selection, not a flag. No experimental surface introduced.

## Success Criteria

- [ ] `ritemark-design` skill at `.claude/skills/ritemark-design/` is complete: `SKILL.md`, `tokens.css`, `references/components.md`, `references/webview-ui.md`, `references/typography.md`, `references/vscode-core.md`, `references/audit-current.md`, `preview/*.html`, optional `slides/*`
- [ ] `themes/ritemark-dark.json` exists and is wired through patch 001 so VS Code defaults to it on dark-mode systems; looks unmistakably Ritemark (Deep Space surfaces, indigo hairlines, not VS Code charcoal)
- [ ] `extensions/ritemark/webview/src/index.css` semantic vars (`--background`, `--primary`, `--foreground`, etc.) resolve to `--r-*` Ritemark tokens first; `--vscode-*` fallback only for scrollbar / context-menu surfaces
- [ ] `extensions/ritemark/webview/tailwind.config.ts` exposes semantic aliases (`text-ink-muted`, `bg-surface-soft`, `border-hairline`, `bg-accent`, `bg-accent-soft`, `text-accent-deep`, etc.); each alias maps to a `--r-*` role token; no component needs to write raw hexes or `--vscode-*` class utilities
- [ ] `components/ui/badge.tsx`, `components/ui/pill.tsx`, `components/ui/filter-chip.tsx` implemented per spec in `.claude/skills/ritemark-design/references/components.md`
- [ ] `components/ui/button.tsx` matches spec (indigo shadow on primary, 10px radius, scale-on-press); existing call sites unchanged
- [ ] `components/ui/dialog.tsx` backdrop is Deep Space tint (`rgba(30, 27, 75, 0.45)` + 6px blur), not default black
- [ ] Lucide is the default icon family (1px stroke, 14–18px sizes); Phosphor + Material Symbols usage is inventoried and documented with per-surface rationale in `references/icons.md`
- [ ] Visual regression harness (Playwright) captures baseline screenshots for: Dialog, Button (primary / secondary / ghost), FilterChip (idle / selected), Badge, Pill, Card, Input (idle / focus / error), sidebar item (idle / hover / active)
- [ ] `webview/src/components/welcome/**` and `webview/src/components/settings/**` pass visual regression against the skill's `preview/` references with zero diffs
- [ ] QA gate: `qa-validator` passes; no regression in Settings, Welcome, ChatView, AgentSelector, Flows, Dialog interactions

## Deliverables

| Deliverable | Description | Phase | Status |
| --- | --- | --- | --- |
| Skill audit + gap list | Inventory `.claude/skills/ritemark-design/`: what's written, what's missing, what drifted from current code | 1 | TODO |
| Webview styling audit | Map every place the webview currently writes raw hex, uses `--vscode-*` on surfaces we own, or relies on shadcn defaults | 1 | TODO |
| Icon usage audit | Count Lucide / Phosphor / Material Symbols usage across webview + VS Code patches; recommend rules | 1 | TODO |
| Ritemark dark theme spec | Finalize `themes/ritemark-dark.json` shape + patch 001 bootstrap wiring | 2 | TODO |
| Tailwind alias spec | Final list of semantic aliases + `--r-*` mappings for `tailwind.config.ts` | 2 | TODO |
| Primitive component spec confirmation | Badge / Pill / FilterChip implementation spec frozen in `references/components.md` (FilterChip already spec'd) | 2 | TODO |
| **Approval gate** | Jarmo approves audit + specs before Phase 3 starts | 2→3 | BLOCKING |
| Skill completion | Missing files added (`references/audit-current.md`, `references/icons.md`, any skill-preview gaps) | 3 | TODO |
| Dark theme implementation | `themes/ritemark-dark.json` + patch 001 updates + bootstrap default-theme logic | 3 | TODO |
| Tailwind aliases | `tailwind.config.ts` updated; existing JSX migrated off raw hexes / `--vscode-*` classes on owned surfaces | 3 | TODO |
| `index.css` rebase | Semantic vars chain `--r-*` first, `--vscode-*` fallback | 3 | TODO |
| Primitive implementations | `badge.tsx`, `pill.tsx`, `filter-chip.tsx` added; `button.tsx` + `dialog.tsx` audited + corrected | 4 | TODO |
| Existing-surface migration | Welcome screen + Settings page + AgentSelector + Flows sidebar render through new primitives (no visual change expected) | 4 | TODO |
| Icon family lockdown | Migrations away from mixed icon families per audit; `references/icons.md` documents exceptions | 4 | TODO |
| Visual regression harness | Playwright screenshot capture script + baseline images committed | 5 | TODO |
| Docs | `references/audit-current.md` (checklist), `references/icons.md` (rules + exceptions) | 5 | TODO |
| Validation | Build, tests, QA, manual smoke tests across light + dark, regression harness green | 6 | TODO |

## Scope

### In Scope

- `.claude/skills/ritemark-design/` (full skill — finish missing references, ensure preview matches live)
- `themes/ritemark-dark.json` (new)
- `patches/vscode/001-ritemark-branding.patch` (dark-theme bootstrap)
- `extensions/ritemark/webview/src/index.css` (semantic var rebase)
- `extensions/ritemark/webview/tailwind.config.ts` (semantic aliases)
- `extensions/ritemark/webview/src/components/ui/` (primitive audit + additions)
- `extensions/ritemark/webview/src/components/welcome/**` (migration to primitives — no redesign)
- `extensions/ritemark/webview/src/components/settings/**` (migration to primitives — no redesign)
- `extensions/ritemark/webview/src/components/chat/**` (migration to primitives — no redesign)
- `extensions/ritemark/webview/src/components/flows/**` (migration to primitives — no redesign)
- Visual regression harness at `extensions/ritemark/webview/tests/visual-regression/`
- Pen file updates: bring `docs-internal/design/ritemark-ui.pen` Tokens frame into sync with any tokens.css additions

### Out of Scope

- Activity bar / titlebar / tabs / status bar redesign (Sprint 53)
- Agent Library surface (Sprint 54)
- Flows sidebar elevation to activity bar (Sprint 55)
- Settings page redesign beyond primitive migration (Sprint 56)
- Marketing surfaces production (landing page, social-share images)
- New feature flags or runtime-toggled design variants
- Removing VS Code's dark mode entirely (we ship Ritemark Dark as a theme; VS Code's own dark themes remain available for users who want them)

## Implementation Checklist

### Phase 1: Audit

- [ ] Walk `.claude/skills/ritemark-design/` file by file — flag every gap, drift, or TODO
- [ ] Inventory `webview/src/**/*.{ts,tsx,css}` for: raw hex colors, `--vscode-*` on owned surfaces, shadcn defaults without Ritemark override, inline styles that should be token refs
- [ ] Inventory icon imports: `lucide-react`, `@phosphor-icons/react`, Material Symbols CSS — count usages, note surfaces
- [ ] Confirm `tokens.css` palette matches the pen file Tokens frame (`docs-internal/design/ritemark-ui.pen` bi8Au) — done in Sprint 54 prep; re-verify
- [ ] Produce `research/foundations-audit.md`

### Phase 2: Specs — GATE BEFORE PHASE 3

- [ ] Finalize `themes/ritemark-dark.json` shape: every VS Code color key mapped to a Ritemark dark token
- [ ] Finalize Tailwind alias list: exhaustive map of semantic name → `--r-*` var
- [ ] Finalize icon rules in `references/icons.md`: Lucide default, documented exceptions, sizes, stroke widths
- [ ] Visual regression scope: which components capture baselines, what breakpoints, what light / dark combinations
- [ ] `references/audit-current.md` outline — the checklist engineers will run before merging new components
- [ ] **APPROVAL GATE**: Jarmo reviews audit + specs. Explicit "approved" required. No code changes until then.

### Phase 3: Theme + Tokens + Aliases

- [ ] Ship `themes/ritemark-dark.json`
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
- [ ] Lock icon family per `references/icons.md`

### Phase 5: Visual Regression + Docs

- [ ] Playwright harness: capture + commit baseline screenshots for every primitive + key surface
- [ ] Wire harness into `./scripts/validate-qa.sh` as a non-blocking first-run, blocking on regression
- [ ] Write `references/audit-current.md` (checklist for engineers)
- [ ] Write `references/icons.md` (icon rules + exceptions)
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

1. **Never stub or disable existing features** (CLAUDE.md HARD RULE #1) — migrating a component onto primitives must produce zero visible change; Welcome, Settings, Chat, Flows, AgentSelector all remain fully functional
2. **Settings page full implementation** — `RitemarkSettings.tsx` must remain ≥400 lines; token migration does not shrink it
3. **Features ON by default** — no disabled features, no hidden UI introduced
4. **VS Code fallback path preserved for unowned surfaces** — scrollbar, context menus, command palette continue to use `--vscode-*` vars
5. **Theme switch is runtime-safe** — no reload required to go light ↔ dark after the foundation lands
6. **Pen file stays in sync** — any token added must appear in the `Tokens` frame of `docs-internal/design/ritemark-ui.pen`

## Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| `--vscode-*` removal breaks a surface we thought we owned | HIGH | Phase 1 audit is exhaustive; visual regression harness catches drift; phased migration (commit per surface) |
| Dark theme drifts from Ritemark into "just another indigo dark" | HIGH | Ship alongside `preview/dark.html`; Jarmo approval gate on Phase 2 compares screenshots |
| Tailwind alias migration introduces subtle color shifts | MEDIUM | Baseline visual regression before alias work; diff after |
| shadcn primitive refactors break existing call sites | MEDIUM | Component API unchanged; only token references shift |
| Icon family change leaves orphans (imports that no longer resolve) | MEDIUM | Phase 1 icon audit; Phase 4 migration keeps imports tree-shake-clean |
| Sprint 53 + 54 blocked longer than expected | MEDIUM | Aggressive scope discipline — primitives and theme are the critical path; everything else can slip to Sprint 52.5 |
| Welcome / onboarding regression | LOW | Already uses shadcn; migration is alias swap, not redesign |

## Key Research

- `docs-internal/analysis/design-study/` — Option D (Indigo-current) selection
- `.claude/skills/ritemark-design/SKILL.md` — visual language source
- `.claude/skills/ritemark-design/tokens.css` — token layer
- `.claude/skills/ritemark-design/references/components.md` — component rules + FilterChip spec
- `docs-internal/design/ritemark-ui.pen` — visual reference (Tokens frame, sidebar-variants frame, roadmap frame)

## Key Files

| File | Purpose |
| --- | --- |
| `.claude/skills/ritemark-design/` | Skill (visual language source of truth) |
| `themes/ritemark-dark.json` | NEW — Ritemark Dark theme |
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

**Current Phase:** Not started
**Current Branch:** TBD (proposed: `feat/sprint-52-design-foundations`)
**Next Gate:** Phase 1 audit → Phase 2 specs → Jarmo approval → Phase 3 implementation
