# Token Reference

Every Ritemark surface reads from `tokens.css`. Never hardcode colors, font sizes, radii, shadows, or spacing values in component code — resolve them to tokens.

This file is the full token catalog + rules for which tokens to use where. If you're picking a value and it's not listed here, the token doesn't exist yet; add it to `tokens.css` and document it here before shipping.

## Two layers

The token system has two layers:

1. **Raw tokens** (`--ritemark-*`) — hard hex values. Pulled from `themes/ritemark-light.json` + Ritemark dark spec. Don't touch these from components.
2. **Role tokens** (`--r-*`) — semantic aliases. These are what components use. Role tokens flip between light and dark automatically when `.ritemark-dark` / `[data-theme="dark"]` is set on the scope root.

Always use role tokens in components. Raw tokens are for defining role tokens only.

## Colors — role tokens (the ones you use)

### Surfaces

| Token | Light → Dark | Use |
|---|---|---|
| `--r-surface` | `#FFFFFF` → `#1E1B4B` | Primary surface (editor, dialog body, card). |
| `--r-surface-muted` | `#F8FAFC` → `#191635` | Chrome (sidebar, titlebar, status bar, dialog header). |
| `--r-surface-soft` | `#F1F5F9` → `#251F5C` | Hover states, code blocks, secondary button. |
| `--r-hairline` | `#E2E8F0` → `#3730A3` | Every border. Use once per edge; never double up. |
| `--r-hairline-strong` | `#CBD5E1` → `#4338CA` | Input borders, emphasized dividers. |

### Ink (text) ladder

| Token | Light → Dark | Use |
|---|---|---|
| `--r-ink-strong` | `#1E1B4B` → `#F8FAFC` | Body copy, H1–H3, primary labels. |
| `--r-ink-body` | `#475569` → `#C7D2FE` | Paragraph body on light, warmth on dark. |
| `--r-ink-muted` | `#64748B` → `#94A3B8` | Meta, captions, sidebar items not active. |
| `--r-ink-faint` | `#94A3B8` → `#64748B` | Placeholders, counts, inactive glyphs. |
| `--r-ink-disabled` | `#CBD5E1` → `#475569` | Full-disabled states. |

Never pick a grey outside this ladder. If you feel you need a fifth step, you're overdrawing hierarchy.

### Accent (indigo — the only one)

| Token | Light → Dark | Use |
|---|---|---|
| `--r-accent` | `#4338CA` → `#818CF8` | Primary buttons, cursor, focus, active indicator. |
| `--r-accent-deep` | `#3730A3` → `#6366F1` | Hover state of primary. |
| `--r-accent-darker` | `#312E81` → `#4F46E5` | Pressed / active. |
| `--r-accent-soft` | `#E0E7FF` → `rgba(129,140,248,0.16)` | Active row background, soft pills. |
| `--r-accent-fainter` | `#C7D2FE` → `rgba(129,140,248,0.28)` | Selection highlight, soft indicator. |
| `--r-ring-color` | `rgba(67,56,202,0.10)` → `rgba(129,140,248,0.25)` | Focus ring (4px). |

Dark-mode accent is Indigo-400 (`#818CF8`), not the same indigo as light. Light `#4338CA` on dark `#1E1B4B` does not pass AA contrast for focus purposes. Always let role tokens do the switching.

### Semantic (functional color, used sparingly)

Raw tokens — use directly (no role-token indirection; semantic meaning is stable across themes):

| Token | Value | Use |
|---|---|---|
| `--ritemark-success` / `-soft` | `#22C55E` / `#DCFCE7` | "Passed check," "synced," "saved." Dark variant: `-dark-success` / `-dark-success-soft`. |
| `--ritemark-warning` / `-soft` | `#F59E0B` / `#FEF3C7` | "Stale," "unsaved," "caution before proceeding." |
| `--ritemark-error` / `-soft` | `#EF4444` / `#FEE2E2` | Destructive actions, genuine error states, broken-frontmatter badges. |
| `--ritemark-info` / `-soft` | indigo aliases | "Info" always resolves to the accent. No separate info blue. |

### Semantic rules

- **Success is never the primary CTA color.** "Save" is indigo. "Confirm destructive op" is red. There is no green "Save" button anywhere in Ritemark.
- **Warning is not an emphasis color.** If something needs attention without being wrong, use `--r-accent-soft` or the indigo left-border pattern.
- **Error is not a secondary color.** `#EF4444` appears only on destructive buttons and broken-state badges. Not on "wrong password" errors — those use the normal input invalid state with indigo focus and `--ritemark-error` text only in the helper.

## Typography

### Families

| Token | Family | Use |
|---|---|---|
| `--ritemark-font-ui` | Sofia Sans | Everything in-chrome, all body copy, marketing body, release notes. |
| `--ritemark-font-display` | Space Grotesk | Welcome screen titles, marketing H1–H2, slide covers. **Not** in-chrome headings. |
| `--ritemark-font-mono` | System mono | `<code>`, `<pre>`, file paths, JSON, terminal-flavored surfaces. |

### Sizes

| Token | Value | Use |
|---|---|---|
| `--ritemark-size-xs` | 11px | Eyebrows, dense meta, tag pills. |
| `--ritemark-size-sm` | 12px | Secondary meta, small captions, footer text. |
| `--ritemark-size-base` | 13px | **Default body UI.** Sidebar items, Library table rows, input values. |
| `--ritemark-size-md` | 14px | Body copy in dialogs, comfortable text. |
| `--ritemark-size-lg` | 16px | Dialog titles, settings section headers. |
| `--ritemark-size-xl` | 20px | Settings page headings, panel section titles. |
| `--ritemark-size-2xl`+ | 24px and up | Welcome + marketing only. |

In-chrome type rarely goes above `--ritemark-size-lg`. If your dialog has a 28px title, you're designing a landing page by mistake.

### Line-heights

| Token | Value | Use |
|---|---|---|
| `--ritemark-leading-tight` | 1.15 | Marketing display heads, slide titles. |
| `--ritemark-leading-snug` | 1.3 | In-chrome headings, compact layouts. |
| `--ritemark-leading-normal` | 1.55 | Body UI, body copy. |
| `--ritemark-leading-relaxed` | 1.7 | Long-form body in the editor, release notes. |

## Spacing — 4pt grid

| Token | Value | Typical use |
|---|---|---|
| `--ritemark-space-1` | 4px | Between icon + label in a pill |
| `--ritemark-space-2` | 8px | Tight inline gap |
| `--ritemark-space-3` | 12px | Between sidebar items |
| `--ritemark-space-4` | 16px | Dialog body padding, card padding (dense) |
| `--ritemark-space-5` | 20px | Dialog header padding |
| `--ritemark-space-6` | 24px | Card padding (comfortable), section top margin |
| `--ritemark-space-8` | 32px | Large section gap |
| `--ritemark-space-12+` | 48px+ | Marketing / welcome scale only |

Rule of thumb: if your in-chrome component uses a spacing value above `--ritemark-space-8`, you're not in chrome anymore, you're in marketing.

## Radii

| Token | Value | Use |
|---|---|---|
| `--ritemark-radius-xs` | 3px | Tag pills, status dots in dense tables |
| `--ritemark-radius-sm` | 4px | Sidebar items, tight chips |
| `--ritemark-radius-md` | 6px | Inputs, default buttons |
| `--ritemark-radius-lg` | 10px | Dialogs, cards, CTAs |
| `--ritemark-radius-xl` | 16px | Marketing cards (only) |
| `--ritemark-radius-pill` | 999px | Marketing CTAs (only — not in-chrome) |

The 16px and pill radii are marketing-only. The moment you use them in-chrome, the UI starts looking like a landing page.

## Shadows

| Token | Use |
|---|---|
| `--ritemark-shadow-xs` | Faint resting lift. Rarely used. |
| `--ritemark-shadow-sm` | Default card / elevated surface. |
| `--ritemark-shadow-md` | Dropdown, popover, hover elevation. |
| `--ritemark-shadow-lg` | Dialog. |
| `--ritemark-shadow-xl` | Large modal, marketing hero card. |
| `--ritemark-shadow-2xl` | Full-screen takeover modal. |
| **`--ritemark-shadow-indigo-sm`** | **Primary CTA (the signature).** |
| `--ritemark-shadow-indigo-md` | Marketing primary CTA (larger scale). |
| `--ritemark-shadow-indigo-lg` | Hero-scale CTA in marketing only. |

The indigo drop-shadow is part of brand identity. Don't swap it for a neutral shadow on a primary button. If a button has the indigo shadow, readers register it as "the Ritemark button."

## Motion

| Token | Value | Use |
|---|---|---|
| `--ritemark-dur-fast` | 120ms | Icon-button hovers, tab transitions. |
| `--ritemark-dur-base` | 200ms | Default UI transitions, dialog open/close. |
| `--ritemark-dur-slow` | 360ms | Editorial reveals on marketing / welcome. |
| `--ritemark-ease-editorial` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Marketing reveals. |
| `--ritemark-ease-quick` | `cubic-bezier(0.4, 0, 0.2, 1)` | All in-chrome transitions. |
| `--ritemark-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **Button press only.** Nothing else. No springing panels, no bouncing toasts. |

Ritemark motion is restrained. Fades and 4–8px Y-translates. No parallax, no loop animations in chrome, no icon spinning (except actual loaders).

## When tokens don't fit

If the token catalog doesn't have what you need:

1. Check twice. The 4-step ink ladder covers almost every text hierarchy problem — you probably don't need a fifth.
2. If it really doesn't fit, **extend the catalog** in `tokens.css` with a clear name, then document the addition here. Add a rationale comment in `tokens.css` so future readers understand why.
3. Never hardcode a value that "almost" matches a token. Drift compounds.

If you're tempted to hardcode `#3A335E` because it's a little softer than `#1E1B4B` for a particular case — that's the signal to either (a) use `--r-ink-body` instead and be more careful about surface contrast, or (b) add a proper `--ritemark-ink-strong-alt` token to the catalog.
