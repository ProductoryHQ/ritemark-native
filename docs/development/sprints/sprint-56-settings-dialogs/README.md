# Sprint 56: Settings & Dialogs (Marker)

Move every bespoke Ritemark UI surface (Settings page, Resize dialog, Dictation Settings dialog, Conflict dialog, onboarding / empty states, Welcome screen) onto the design system so nothing stays off-token.

## Why this sprint exists (placeholder)

Sprints 52–55 establish tokens, chrome, Agent Library, and Flows. Sprint 56 closes the loop — refactors Settings and the remaining dialogs to pull from the shadcn primitives (Badge, Pill, FilterChip, Button, Dialog) without visual regression, but with full token alignment. Welcome screen gets its final polish. Every empty state across the app speaks the same design language.

This sprint is **queued** — full sprint plan gets written when Sprint 52 hands over real primitive usage patterns from the Sprint 52 migration pass.

## Dependencies

- Sprint 52 (Foundations) — primitives, dark theme, visual regression harness
- Sprint 53 (Chrome) — keyboard-map extended to cover Settings navigation

## In scope (placeholder)

- `webview/src/components/settings/RitemarkSettings.tsx` — refactor onto primitives; ≥400 lines preserved (CLAUDE.md invariant)
- `webview/src/components/dialogs/Resize.tsx` — already on shadcn Dialog, confirm FilterChip / Badge usage
- Dictation Settings dialog — token migration pass
- Conflict dialog — token migration pass
- Onboarding + empty states across every sidebar (file-empty, agents-empty, flows-empty, search-empty)
- `webview/src/components/welcome/**` — final polish; consistency with skill's `preview/welcome.html`

## Out of scope (placeholder)

- New settings (no feature additions; migration only)
- New dialogs (migration only)
- Any changes to Settings persistence / schema

## Status

**Marker sprint — no detailed plan yet.**
Blocked on Sprint 52 completion. Can begin in parallel with Sprint 54 + 55 because none share scope.
Full sprint-plan.md gets written when sprint-manager opens Phase 1 audit.
