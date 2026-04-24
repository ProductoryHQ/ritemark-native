# Sprint 52: Design Foundations

The first altitude of Ritemark's Indigo-Editorial rollout. This sprint ships the design system that every subsequent sprint (53 Chrome, 54 Agents, 55 Flows, 56 Settings) builds on top of. Nothing else ships until this is locked — that's the whole point of putting it first.

## Why this sprint exists

Today Ritemark reads as "VS Code with an indigo accent." The design study (`docs-internal/analysis/design-study/`) validated **Option D — Indigo-current** as the direction: keep the existing `themes/ritemark-light.json` palette (Deep Space `#1E1B4B`, Slate neutrals, Indigo `#4338CA`) and build the missing pieces — a matching Ritemark dark theme, a `ritemark-design` skill that codifies the polish, Tailwind semantic aliases so the webview stops reaching for `--vscode-*` vars on surfaces we own, and a proper shadcn/ui primitive layer (Badge, Pill, FilterChip) that doesn't get overwritten by shadcn defaults on every refactor.

Without this sprint, every downstream sprint reinvents the polish rules and drifts. With this sprint, Sprint 53+ designers and engineers pull from one source of truth.

## In scope

- `ritemark-design` skill at `.claude/skills/ritemark-design/` — promote from "prep work" to an installed, used, and referenced skill; fill in the remaining gaps (`references/audit-current.md`, icon-family rules, Space Grotesk vs Sofia Sans matrix)
- `themes/ritemark-dark.json` — ship the Deep-Space-on-deep-indigo dark theme (tokens already spec'd in `tokens.css`; this sprint wires them into the VS Code theme file + patch 001 so the default bootstrap picks it up)
- `extensions/ritemark/webview/src/index.css` — rebase semantic CSS vars so `--background`, `--primary`, `--foreground` etc. resolve to Ritemark `--r-*` role tokens first, `--vscode-*` only for scrollbar / context-menu surfaces
- `extensions/ritemark/webview/tailwind.config.ts` — add semantic aliases (`text-ink-muted`, `bg-surface-soft`, `border-hairline`, `bg-accent-soft`, `text-accent-deep`, etc.) mapping to `--r-*` tokens
- `extensions/ritemark/webview/src/components/ui/` — audit existing shadcn primitives (`button.tsx`, `dialog.tsx`); add missing: `badge.tsx`, `pill.tsx`, `filter-chip.tsx` per the spec in `.claude/skills/ritemark-design/references/components.md`
- Icon family lockdown — Lucide 1px stroke as default; document the handful of places Phosphor / Material Symbols are allowed and why
- Visual regression harness — Playwright screenshot baseline of Dialog, Button (primary/secondary/ghost), FilterChip, Badge, Pill, Card, Input against the ritemark-design skill's `preview/` references

## Out of scope

- Anything behind the chrome (Sprint 53 — titlebar, tabs, activity bar, status bar)
- The Agent Curation Library surface (Sprint 54)
- Flows sidebar (Sprint 55)
- Settings page refactor (Sprint 56)
- Marketing surfaces (landing page, social-share images) — the skill has the tokens for these; actual production rolls up in release sprints
- New feature flags

## Dependencies

None. This is the foundation sprint. Sprints 53–56 depend on it.

## Success signal

- Opening any webview surface shows Ritemark tokens everywhere (no unstyled shadcn defaults, no `--vscode-*` leakage on surfaces we own)
- `.claude/skills/ritemark-design/preview/` screenshots match the live app 1:1
- Dark mode is unmistakably Ritemark (Deep Space, not VS Code charcoal)
- A new component built by an engineer reading the skill's `references/` lands on token the first time, no review cycle needed

## Status

**Current Phase:** Not started — sits upstream of Sprint 54 prep work already in `claude/research-agent-management-ux-Xkewf`
**Current Branch:** TBD
**Next Gate:** Sprint-manager opens Phase 1 (audit current webview styling, inventory shadcn usage, list tokens.css gaps) when Jarmo signals go
