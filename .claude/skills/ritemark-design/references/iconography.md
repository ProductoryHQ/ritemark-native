# Iconography

Ritemark uses **Lucide** icons, 1px stroke, inherited text color.

## Why Lucide

- Geometric-humane lines that pair cleanly with Space Grotesk's geometry and Sofia Sans's humanist warmth.
- Already installed as a dependency (`lucide-react`) in the webview — no new cost.
- Actively maintained, broad coverage, predictable sizing.
- Lightweight SVG output when tree-shaken.

No mixing. Don't introduce Phosphor, Heroicons, Tabler, or any other icon set. If Lucide is missing something, custom-draw it in the Lucide visual language (1px stroke, matched cap style, same grid) rather than pulling from a second set.

## Stroke width

**1px stroke on all Lucide icons in Ritemark.** This is already configured in `extensions/ritemark/webview/src/index.css`:

```css
svg.lucide {
  stroke-width: 1px !important;
}
```

Lucide's default is 2px. 1px makes the icons sit more quietly next to Sofia Sans body copy (which is relatively light-weight). Do not override this per-icon — consistency matters more than any one pictogram.

On marketing / slide surfaces, you may bump to 1.5px for icons at 32px+ where 1px looks too thin. Don't go to 2px even on marketing; that starts to feel cartoonish against the type.

## Sizes

| Size | Use |
|---|---|
| **16px** | Dense UI. Table rows, dialog headers, input prefixes, dropdown menu items, status bar. |
| **20px** | Comfortable UI. Button prefixes, sidebar navigation, settings section markers. |
| **24px** | Moment UI. Welcome screen mark, marketing feature tiles, slide bullet markers. |
| **32px+** | Marketing hero, slide cover, decorative. |

Don't use sizes in-between (14px, 18px, 22px). Four sizes is enough.

## Color

Icons inherit the current text color via `stroke: currentColor` (Lucide's default behavior). That means:

- An icon inside `--r-ink-body` body text is that body color.
- An icon inside `--r-ink-muted` caption is that muted tone.
- An icon inside `--r-accent`-colored text is indigo.

Don't hardcode `stroke` on individual icons — let them inherit. The exception is semantic dot-dot-dot chips where a green "check" needs to be literally green; there, use the role token explicitly:

```jsx
<Check className="lucide" stroke="var(--ritemark-success)" />
```

## When to use an icon

Use one when the **label alone is ambiguous** or the action is frequent enough to benefit from pictographic recognition. Don't decorate.

- ✓ Gear icon next to "Settings" — the pictogram is how users find settings at a glance.
- ✓ Lock icon on a read-only file — the pictogram is the status.
- ✗ Rocket emoji-esque icon next to "Get started" button — decorative, not functional. Delete.
- ✗ Icons on every heading in a settings page — visual clutter, not information.

## Logo mark vs. icon

The Ritemark logo mark (`R` in a rounded indigo square) is **not** a Lucide icon. It's a brand asset. It lives in `assets/logos/` and has specific sizing rules. Never replace it with a text-R or a Lucide letter icon.

## Emoji

**Zero emoji in Ritemark UI, marketing, slides, release notes, or changelog.**

This includes:
- ❌ Unicode emoji in toast messages, commit messages you're drafting for Ritemark, release notes.
- ❌ Flag emoji for language/country.
- ❌ ✓ ✗ unicode glyphs — use Lucide `Check` / `X` instead so stroke weight stays consistent.
- ❌ → ★ unicode glyphs in body text — use Lucide `ArrowRight` / `Star`.

Bullets in marketing: Lucide `Dot` at 16px, or a 4px × 4px indigo square, or just a regular `•` (that's not an emoji, it's a bullet character). Never 🔹 or 🟢.

## Lucide icons you'll reach for most

For reference, these are the icons that come up constantly in Ritemark UI. Import from `lucide-react`:

- File surfaces: `FileText`, `FilePlus`, `Folder`, `FolderOpen`, `FolderPlus`
- Navigation: `ChevronRight`, `ChevronLeft`, `ChevronDown`, `ChevronUp`, `ArrowRight`, `ArrowLeft`
- Actions: `X` (close), `Check` (confirm), `Trash2`, `Archive`, `Copy`, `Save`, `Settings`, `Search`, `Plus`, `Edit3`, `ExternalLink`
- Status: `Circle` (dot), `CircleCheck`, `CircleAlert`, `CircleX`, `Info`, `TriangleAlert`, `Clock`, `Star`, `Lock`
- Library-specific (Sprint 52): `Library`, `Users`, `Bot`, `Sparkles`, `FileCheck`, `FileWarning`, `GitCompare` (for diff view), `History`

## Implementation snippet

```jsx
import { Settings, X } from 'lucide-react'

// Default — 16px inherited color (dense UI)
<Settings className="lucide" />  // lucide-react adds .lucide class automatically

// Larger (comfortable UI — sidebar, button prefix)
<Settings size={20} />

// Explicitly sized (moment UI)
<Settings size={24} />

// Color override (only for semantic status)
<Check size={16} stroke="var(--ritemark-success)" />
```

In non-React contexts (preview HTMLs, slide templates), use inline SVG from `lucide.dev` with `stroke-width="1"` and `stroke="currentColor"`.
