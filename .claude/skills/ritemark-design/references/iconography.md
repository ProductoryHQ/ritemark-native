# Iconography

Ritemark uses **Phosphor Icons** and only Phosphor Icons. Weight 400 (regular), rendered through a single typed wrapper. One weight across chrome and webview — no two-tier hierarchy.

> **Source of truth:** `docs-internal/design/ritemark-ui.pen` frame `yq4P8` (Icon Usage Guide). Text mirror: `docs/development/sprints/sprint-52-design-foundations/notes/icons-usage.md`. If this doc disagrees with the `.pen`, the `.pen` wins.  
> Rulings:
> - 2026-04-24 — Jarmo confirmed `.pen` is always source of truth. This doc supersedes the earlier Lucide-default iconography.
> - **2026-05-02 — Weight reset from 100 (thin) to 400 (regular)**, applied to both chrome (patches/vscode/001 + producticons/) and webview (`Icon.tsx` `weight="regular"`). Sprint 52's thin-weight aesthetic was too faint at viewing distance and created an inconsistent two-tier feel between chrome and webview. The `.pen` Icon Usage Guide (`yq4P8`) needs the same weight bump — TODO for Jarmo when next in Pencil.

## Library

-   Extension / VS Code patches: Phosphor web font.
    
-   Webview (React): `@phosphor-icons/react` via `extensions/ritemark/webview/src/components/ui/Icon.tsx`.
    
-   Design (`.pen`): `iconFontFamily: "phosphor"` — all `icon_font` nodes.
    

No Lucide, no Material Symbols, no Heroicons, no Tabler, no Feather. No partial mixing for "this one icon that's missing." If Phosphor doesn't have it, raise with Jarmo before drawing custom SVG (see Exceptions).

## Tokens

All icon properties are driven by tokens defined in `docs-internal/design/ritemark-ui.pen` and mirrored in webview CSS vars.

| Token | Value | Use |
| --- | --- | --- |
| `$icon-family` | `phosphor` | Only library. No mixing. |
| `$icon-weight-default` | `400` (regular) | Locked. Do not override per-icon. |
| `$icon-size-xs` | `12` | Dense chips, metadata, inline indicators. |
| `$icon-size-sm` | `14` | Tree rows, tabs, dropdown items. |
| `$icon-size-md` | `16` | Toolbar, titlebar, dialog headers, form-field prefixes. |
| `$icon-size-lg` | `20` | Activity bar, section markers, settings headers. |
| `$icon-color-muted` | `var(--r-ink-muted)` (#64748B) | Idle / default tone. |
| `$icon-color-active` | `var(--r-accent)` (#4338CA) | Selected / active item. |
| `$icon-color-disabled` | `var(--r-ink-disabled)` (#CBD5E1) | Disabled / read-only. |

No off-spec sizes. No 13, 15, 18, 22. No Thin / Light / Bold / Fill / Duotone weights. On marketing surfaces, extend through the `$icon-size-*` tokens — not ad-hoc pixels.

## Component API

One wrapper component. Always these props.

```tsx
import { Icon } from '@/components/ui/Icon'

<Icon
  name="folder-open"        // Phosphor kebab-case name (typed union)
  size={16}                 // 12 | 14 | 16 | 20 — no other values
  tone="muted"              // 'muted' | 'active' | 'disabled' — defaults to 'muted'
  aria-hidden               // default true; pass aria-label for action icons
/>
```

Rules:

1.  Import `Icon` from `@/components/ui/Icon` (or the relative path equivalent). Never import a `Ph*` component directly at a call site.
    
2.  `name` is typed as `PhosphorIconName` — a bounded union derived from `iconMap` in `Icon.tsx`. Typos fail at compile time.
    
3.  Decorative icons get `aria-hidden` (the wrapper default). Icons that carry meaning (action buttons without text, status indicators) get `aria-label`.
    
4.  Active state is signaled with **color** (`tone="active"`), not with an icon swap.
    
5.  Weight is always 400 (regular) internally. There is no prop to override.
    
6.  `className` is passed through for structural utilities (`opacity-*`, `animate-spin`, positioning). Icon color is driven by `tone`; avoid `text-*` color classes on icons — they will be overridden by the wrapper's color prop.
    

## Surface → icon mapping

Concrete uses that must stay consistent across webview and VS Code patches.

| Surface | Icons |
| --- | --- |
| Navigation tree (sidebar, file tree) | `sidebar-simple`, `folder`, `folder-open`, `caret-right`, `caret-down`, `file-text`, `file-csv`, `file-doc`, `file-pdf`, `file-png`, `file-ts`, `file-plus`, `folder-plus` |
| Search / filter | `magnifying-glass`, `x`, `funnel`, `file-text` |
| Toolbar / actions | `plus`, `download`, `gear`, `dots-three`, `arrows-clockwise`, `arrows-counter-clockwise`, `arrows-out` |
| AI sidebar / agent input | `robot`, `paperclip`, `at`, `star-four`, `arrow-up`, `microphone`, `divide`, `x-circle`, `play`, `play-circle`, `git-branch`, `bezier-curve`, `warning` |
| Titlebar | `sidebar-simple`, `sidebar`, `gear` |
| Activity bar | `folder-open`, `magnifying-glass`, `robot`, `flow-arrow`, `git-branch`, `puzzle-piece`, `gear`, `user-circle` |
| Status / meta | `info`, `warning`, `x-circle`, `check`, `star`, `lock-simple`, `clock-counter-clockwise`, `list`, `package` |

New surface additions must reuse names already present in this list when semantically equivalent (e.g. a new "add file" affordance uses `file-plus`, not `plus-circle`). New names must be added to `iconMap` in `Icon.tsx` AND to this table in the same change.

## When to use an icon

Use one when the **label alone is ambiguous** or the action is frequent enough to benefit from pictographic recognition. Don't decorate.

-   Gear icon next to "Settings" — the pictogram is how users find settings at a glance. Use.
    
-   `lock-simple` on a read-only file — the pictogram is the status. Use.
    
-   `rocket` next to a "Get started" button — decorative, not functional. Delete.
    
-   Icons on every heading in a settings page — visual clutter, not information. Delete.
    

## Logo mark vs. icon

The Ritemark logo mark (`R` in a rounded indigo square) is **not** a Phosphor icon. It's a brand asset. It lives in `assets/logos/` and has specific sizing rules. Never replace it with a text-R or a Phosphor letter icon.

## Forbidden

-   **Other icon libraries.** Lucide, Material Symbols, Heroicons, Tabler, Feather — all banned. No partial mixing.
    
-   **Off-spec sizes.** Only 12 / 14 / 16 / 20.
    
-   **Off-spec weights.** Weight stays 400 (regular). Thin / Light / Bold / Fill / Duotone variants are not part of the Ritemark system.
    
-   **Emoji in UI.** No rocket, check, warning, or wrench emoji in webview, dialogs, toasts, activity bar, settings, welcome, marketing, slides, release notes. Use Phosphor equivalents (`rocket`, `check`, `warning`, `wrench`) via the `Icon` wrapper.
    
-   **Unicode glyph fallbacks.** No right-arrow, star, check, or x unicode characters in body copy. Use Phosphor `arrow-right`, `star`, `check`, `x`.
    
-   **Direct** `Ph*` **imports.** Never `import { FolderOpen } from '@phosphor-icons/react'` at a call site. All icon usage flows through `<Icon>`.
    

## Exceptions

None by default. If a surface genuinely needs something Phosphor does not provide, raise it with Jarmo before drawing a custom SVG. Custom icons, if approved, must match Phosphor regular-weight (400) visual language: ~1.5px-equivalent stroke, rounded caps, 24x24 grid.

## Migrating from Lucide (historic)

Ritemark previously used Lucide. The full migration map from Lucide PascalCase to Phosphor kebab-case is at `docs/development/sprints/sprint-52-design-foundations/notes/icon-migration-mapping.md`. Key renames:

| Lucide | Phosphor |
| --- | --- |
| `chevron-*` | `caret-*` |
| `search` | `magnifying-glass` |
| `bot` | `robot` |
| `workflow` | `flow-arrow` |
| `settings` | `gear` |
| `trash-2` | `trash` |
| `external-link` | `arrow-square-out` |
| `lock` | `lock-simple` |
| `edit-3` / `pencil` | `pencil-simple` |

The 1px stroke CSS override (`svg.lucide { stroke-width: 1px !important }`) was removed. Phosphor's regular weight provides the stroke styling natively (no per-icon CSS needed).

## How this doc stays current

This file is derived from `docs/development/sprints/sprint-52-design-foundations/notes/icons-usage.md`, which mirrors the `.pen` `yq4P8` Icon Usage Guide. When the `.pen` changes, update `notes/icons-usage.md` and this file in the same commit. The `.pen` wins on any disagreement.

**Open `.pen` follow-up (as of 2026-05-02):** the weight 100 → 400 reset was applied to code (`Icon.tsx`) and patches but not yet to `.pen` `yq4P8`. Until the `.pen` is updated, treat the 2026-05-02 ruling above as the authoritative version and ignore the older `.pen` weight token where it conflicts.