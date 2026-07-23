# Components

The specific patterns Ritemark uses. These are the polish rules the design study validated — the things that take the app from "shadcn on indigo fallback" to "Ritemark." When building a new component, pick the closest pattern from this file and stay inside its rules.

## Anatomy of the signature CTA

Every primary action in Ritemark follows this exact recipe. It's the most important piece of vocabulary in the system — the moment that tells a screenshot viewer "this is Ritemark."

```css
.ritemark-cta-primary {
  background: var(--r-accent);
  color: #FFFFFF;
  font-family: var(--ritemark-font-ui);
  font-weight: 600;
  font-size: var(--ritemark-size-base);   /* 13px in-chrome, 15px in marketing */
  padding: 10px 18px;
  border: 0;
  border-radius: var(--ritemark-radius-lg); /* 10px */
  cursor: pointer;
  box-shadow: var(--ritemark-shadow-indigo-sm);
  transition: background var(--ritemark-dur-base) var(--ritemark-ease-quick),
              box-shadow var(--ritemark-dur-base) var(--ritemark-ease-quick),
              transform var(--ritemark-dur-fast) var(--ritemark-ease-spring);
}
.ritemark-cta-primary:hover  { background: var(--r-accent-deep); box-shadow: var(--ritemark-shadow-indigo-md); }
.ritemark-cta-primary:active { background: var(--r-accent-darker); transform: scale(0.98); }
.ritemark-cta-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
```

Non-negotiables:

- **The indigo shadow** is not decorative. It's the element the whole brand lives in.
- **10px radius.** Not 4, not 12, not pill. 10 is deliberate — paired with the 13px/15px body sizes, it reads as a *tool button* not a *marketing button*.
- **Scale on press, not on hover.** Hover changes color + shadow; press adds a subtle `scale(0.98)`. No bouncing.

In marketing, the same CTA uses `--ritemark-size-md` (14px)+`padding: 12px 22px`, and the `--ritemark-shadow-indigo-md` or `-lg` variants for weight. Pill radius (`999px`) is acceptable on *marketing* CTAs only.

## Secondary button

```css
.ritemark-cta-secondary {
  background: var(--r-surface-soft);
  color: var(--r-ink-strong);
  border: 0;
  border-radius: var(--ritemark-radius-lg);
  padding: 10px 18px;
  font-weight: 500;
}
.ritemark-cta-secondary:hover { background: var(--r-hairline); }
```

- No indigo shadow on secondary. The shadow belongs to the primary.
- Background is surface-soft (not surface-muted) so it has enough contrast against the dialog body.

## Ghost button

For row-level actions in dense UI (Library table, settings rows, sidebar items), don't use filled buttons at all:

```css
.ritemark-btn-ghost {
  background: transparent;
  color: var(--r-ink-body);
  border: 0;
  padding: 6px 10px;
  border-radius: var(--ritemark-radius-sm);
  font-size: var(--ritemark-size-base);
}
.ritemark-btn-ghost:hover { background: var(--r-surface-soft); color: var(--r-ink-strong); }
.ritemark-btn-ghost:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--ritemark-ring-width) var(--r-ring-color);
}
```

Ghost buttons are how you get from "a table row has 4 actions" to a readable row without accruing visual weight.

## Focus ring — always the same

```css
element:focus-visible {
  outline: none;
  border-color: var(--r-accent);           /* for border-first elements (inputs) */
  box-shadow: 0 0 0 4px var(--r-ring-color); /* 4px at 10% indigo */
}
```

This is the *only* focus pattern in Ritemark. Never reach for `outline: 2px dashed`, native browser focus, or Tailwind's `ring-2 ring-primary`. The 4px-at-10%-indigo glow is part of the system.

## Sidebar — the active-row pattern

The Library view, the agent sidebar, the settings sidebar — every sidebar in Ritemark uses the same active-row treatment:

```css
.ritemark-sidebar-item {
  padding: 6px 10px;
  border-radius: var(--ritemark-radius-sm);   /* 4px */
  font-size: var(--ritemark-size-base);       /* 13px */
  color: var(--r-ink-body);
  cursor: pointer;
  transition: background var(--ritemark-dur-fast) var(--ritemark-ease-quick);
}
.ritemark-sidebar-item:hover { background: var(--r-surface-soft); }
.ritemark-sidebar-item.is-active {
  background: var(--r-accent-soft);
  color: var(--r-ink-strong);
  font-weight: 500;
  padding-left: 8px;                     /* room for the left-border to not shift content */
  border-left: 2px solid var(--r-accent);
}
```

The **2px indigo left-border + accent-soft background + 500 weight** is the full treatment. Missing any of the three makes the row feel less-than-active.

Non-negotiable: **the border does not shift content.** If the left-padding changes between active and inactive states, the row jumps as you scroll through a list. Always reserve the border space; toggle the border color, not the border presence.

## Sidebar group headers

```css
.ritemark-sidebar-group {
  padding: 14px 10px 4px;
  font-size: var(--ritemark-size-xs);   /* 11px */
  font-weight: 600;
  color: var(--r-ink-strong);           /* yes — strong, not muted */
  letter-spacing: var(--ritemark-tracking-wide);
  text-transform: uppercase;
}
```

Group headers are *strong ink* with uppercase. They earn the emphasis because there are fewer of them than rows. Using `--r-ink-muted` for group headers is a common shadcn default — override it.

## Input — the default

```css
.ritemark-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--r-hairline-strong);
  border-radius: var(--ritemark-radius-md);   /* 6px */
  background: var(--r-surface);
  color: var(--r-ink-strong);
  font-family: var(--ritemark-font-ui);
  font-size: var(--ritemark-size-md);          /* 14px */
  transition: border-color var(--ritemark-dur-fast) var(--ritemark-ease-quick),
              box-shadow var(--ritemark-dur-base) var(--ritemark-ease-quick);
}
.ritemark-input::placeholder { color: var(--r-ink-faint); }
.ritemark-input:focus {
  outline: none;
  border-color: var(--r-accent);
  box-shadow: 0 0 0 var(--ritemark-ring-width) var(--r-ring-color);
}
.ritemark-input[aria-invalid="true"] {
  border-color: var(--ritemark-error);
  box-shadow: 0 0 0 var(--ritemark-ring-width) var(--ritemark-error-soft);
}
```

- **1px border, not 2px.** 2px inputs are a shadcn-default tic; they look too heavy next to the CTA. Thin border + strong focus-ring does the job.
- **6px radius, not 10px.** Inputs are slightly tighter than buttons so text lines up against the dialog's 20px padding.

## Labels

```css
.ritemark-label {
  display: block;
  font-size: var(--ritemark-size-sm);   /* 12px */
  font-weight: 500;
  color: var(--r-ink-body);
  margin-bottom: 6px;
}
```

Sentence case. Never uppercase-spaced eyebrow style — save that for marketing contexts.

## Dialog

Dialogs follow the existing `components/ui/dialog.tsx` shape but with Ritemark polish. Structure:

```
┌─────────────────────────────────────┐
│  [icon] Title                   [×] │  ← dialog-head  (16px 20px, border-bottom)
├─────────────────────────────────────┤
│                                     │
│  Body — labels + inputs + copy      │  ← dialog-body  (20px, scrollable)
│                                     │
├─────────────────────────────────────┤
│                 [Cancel] [Save]     │  ← dialog-foot  (14px 20px, border-top)
└─────────────────────────────────────┘
```

Tokens:
- Dialog container: `background: var(--r-surface)`, `border-radius: var(--ritemark-radius-lg)` (10px), `box-shadow: var(--ritemark-shadow-lg)`, max-width `480px` default.
- Head: padding `16px 20px`, `border-bottom: 1px solid var(--r-hairline)`, title font `var(--ritemark-size-lg)` (16px) `var(--ritemark-font-ui)` (Sofia Sans, not Space Grotesk — this is chrome).
- Body: padding `20px`.
- Foot: padding `14px 20px`, `border-top: 1px solid var(--r-hairline)`, buttons right-aligned, gap `10px`.
- Backdrop: `rgba(30, 27, 75, 0.45)` + `backdrop-filter: blur(6px)`. Deep Space tint, not neutral black.

## Card

```css
.ritemark-card {
  background: var(--r-surface);
  border: 1px solid var(--r-hairline);
  border-radius: var(--ritemark-radius-lg);     /* 10px */
  padding: 20px;
  box-shadow: var(--ritemark-shadow-xs);
}
.ritemark-card.is-interactive:hover {
  box-shadow: var(--ritemark-shadow-md);
  border-color: var(--r-hairline-strong);
  cursor: pointer;
}
```

A card on `--r-surface-muted` background needs a visible border — hairline does that. On `--r-surface` background, the border is almost invisible but still does shape work.

## Badge / pill

Two shapes:

**Soft pill** — for counts, tags, vendor badges in dense rows.

```css
.ritemark-pill-soft {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--ritemark-radius-xs);    /* 3px */
  font-size: var(--ritemark-size-xs);          /* 11px */
  font-weight: 500;
  background: var(--r-surface-soft);
  color: var(--r-ink-body);
}
/* Variants: .is-accent uses --r-accent-soft + --r-accent-deep color */
```

**Dot badge** — for status indicators where a word is overkill.

```css
.ritemark-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--ritemark-success); /* or warning/error as needed */
  flex-shrink: 0;
}
.ritemark-dot.is-pulse { box-shadow: 0 0 0 3px var(--ritemark-success-soft); }
```

Prefer dots + labels over colored pills where possible. A green dot next to "Active" reads cleaner than a full green pill saying "Active."

## FilterChip — interactive filter rail

Used in dense power-user UIs (Library filter rail, Agents filter bar, Search scope pickers). Unlike `ritemark-pill-soft` (which is informational), FilterChip is a **two-state interactive control**: idle vs selected. Multiple chips behave as a toggle-group within one facet.

```css
.ritemark-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  height: 24px;
  border: 1px solid var(--r-hairline);
  border-radius: var(--ritemark-radius-sm);    /* 4px — same as sidebar item */
  background: var(--r-surface);
  color: var(--r-ink-body);
  font-family: var(--ritemark-font-ui);
  font-size: var(--ritemark-size-sm);           /* 12px */
  font-weight: 500;
  cursor: pointer;
  transition: background var(--ritemark-dur-fast) var(--ritemark-ease-quick),
              border-color var(--ritemark-dur-fast) var(--ritemark-ease-quick),
              color var(--ritemark-dur-fast) var(--ritemark-ease-quick);
}
.ritemark-filter-chip:hover {
  background: var(--r-surface-soft);
  color: var(--r-ink-strong);
}
.ritemark-filter-chip.is-selected {
  background: var(--r-accent-soft);
  border-color: var(--r-accent);
  color: var(--r-accent-deep);
}
.ritemark-filter-chip.is-selected:hover {
  background: var(--r-accent-fainter);
}
.ritemark-filter-chip:focus-visible {
  outline: none;
  box-shadow: 0 0 0 var(--ritemark-ring-width) var(--r-ring-color);
}
.ritemark-filter-chip[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
}
```

Optional affordances:

- **Count suffix**: `<span class="ritemark-filter-chip__count">12</span>` — `font-variant-numeric: tabular-nums`, `color: var(--r-ink-muted)` in idle state, `color: var(--r-accent-deep)` when selected. Never bold; the count is secondary.
- **Dismiss X**: when the chip represents an applied filter (not a picker), include a trailing `×` button that removes it. `14px` lucide `x` icon, ghost-colored.
- **Leading dot**: for status facets (broken/stale/duplicated), a 6px colored dot can precede the label — reuse `.ritemark-dot` sizing but inline.

Non-negotiables:

- **Selected state uses accent-soft + accent border + accent-deep text.** The brand-indigo left-border pattern from sidebar items does not apply — these chips are horizontal tokens in a rail, not vertical list rows.
- **4px radius.** Not pill, not 10px. Pill chips read as marketing tags; 4px reads as a tool control and harmonizes with sidebar items.
- **1px border always present** — idle uses `--r-hairline`, selected uses `--r-accent`. Do not toggle `border: none` to `border: 1px` between states; the chip will shift by a pixel.
- **12px font, 24px height.** Chips sit inside filter rails and must not compete with the data they filter.

Arrangement:

- A filter rail is a horizontal flex container with `gap: 8px`, wrapping disabled by default. Long rails scroll horizontally with a subtle fade mask rather than wrapping.
- Facet labels (e.g. "Scope", "Vendor") live as `ritemark-label` (12px, 500, ink-body) above their chip group, separated by `12px` vertical gap.
- Clear-all appears as the rightmost chip when any filter is active: `ritemark-btn-ghost` styling, label "Clear filters · N".

## Table rows (Library-style)

```
Name                    Scope        Vendor     Last run    Source
├──────────────────────┼────────────┼──────────┼───────────┼──────────┤
code-reviewer         │ project    │ Claude   │ 3d ago    │ .claude… │
```

Row rules:
- Row height: `36px` min. No taller — this is a dense table.
- Cell padding: `0 12px`.
- Divider: `border-bottom: 1px solid var(--r-hairline)` on each row (not the table — individual `border-bottom` per row handles empty-state + adding-rows better).
- Active/selected row: `background: var(--r-accent-soft)`. No left-border here — the row is already the full width.
- Hover row: `background: var(--r-surface-soft)`.
- Column headers: `--r-ink-muted`, `font-size: var(--ritemark-size-sm)` (12px), `font-weight: 500`, uppercase with `letter-spacing: 0.5px`.
- Row text: 13px, `--r-ink-strong` for primary column (Name), `--r-ink-body` for everything else.

## Toast / notification

Toast sits on the bottom-right of the viewport (inside the editor area, not in VS Code's native notification area — the webview owns its own toasts).

- Shape: `border-radius: var(--ritemark-radius-lg)`, `padding: 12px 16px`, `background: var(--r-surface)`, `box-shadow: var(--ritemark-shadow-lg)`, `border: 1px solid var(--r-hairline)`.
- Status via a 3px left-border, not a full background tint:
  - `border-left: 3px solid var(--r-accent)` — info
  - `border-left: 3px solid var(--ritemark-success)` — success
  - `border-left: 3px solid var(--ritemark-warning)` — warning
  - `border-left: 3px solid var(--ritemark-error)` — error

A tinted-background toast (e.g., full green `--ritemark-success-soft`) is too loud for chrome. Left-border does the job at a quarter of the weight.

## Exceptions

When Jarmo approves a component that violates a rule above, document it here with the date and rationale. No backfill — just forward-looking exceptions.

### Comment-callout yellow (2026-07-15, Sprint 94, #81)

**Rule broken:** "indigo is the only chromatic signal; semantic colour only for genuinely semantic states."

**Exception:** editor-only comments use a functional **soft-yellow** — highlight `#FEF3C7` (light) / `rgba(251,191,36,0.20)` (dark) on the anchored text, marker accent `#F59E0B`. Indigo is reserved for the accent (mentions, Send-to-AI, focus), so comments needed a distinct, non-alarming signal that reads as "annotation" rather than "warning" (amber's usual semantic). Jarmo-requested during the Sprint 94 UI review. The `@agent` mention chip inside a comment stays indigo (`--ritemark-indigo-soft`) — that IS the accent. Scope: the comment highlight + gutter marker only; no other surface adopts yellow.
