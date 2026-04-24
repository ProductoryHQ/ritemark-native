# Audit Current

This is the checklist for improving existing Ritemark components against the skill's standards. Use it when:

- A Sprint-52-style sprint is about to add new UI and you want the *existing* components around it to not look stale next to the new ones.
- A component feels off and you want a structured way to diagnose what's drifting from the system.
- You're onboarding to the codebase and want to understand which components are "source of truth" vs "legacy."

This is not a migration plan. It's a diagnostic. Sprint-level work decides what actually gets refactored.

## How to use this file

Walk through each component class below. For each existing component, compare against the checklist. Missed items get tracked in a sprint-scoped migration list (e.g., `notes/ui-audit.md` in the relevant sprint folder), not here.

Do not refactor in-place while reading this file. Audit first, then propose changes with Jarmo's sign-off. Drive-by refactors break invariants.

## 1. Dialog components

Files to audit: `extensions/ritemark/webview/src/components/**/*Modal.tsx`, `**/*Dialog.tsx`, `components/ui/dialog.tsx`.

| Check | Target | Common drift |
|---|---|---|
| Container radius | `var(--ritemark-radius-lg)` (10px) via `rounded-[10px]` or inline style | `rounded-xl` (12px), `rounded-lg` (8px) |
| Container shadow | `var(--ritemark-shadow-lg)` | `shadow-[0_8px_32px_rgba(0,0,0,0.24)]` (neutral black, 24%) |
| Backdrop | `rgba(30, 27, 75, 0.45)` + `backdrop-blur-sm` | `bg-black/40`, `bg-black/50` |
| Header padding | `16px 20px` | `24px`, `p-6` |
| Header border-bottom | `1px solid var(--r-hairline)` | none, `border-b-2` |
| Header title | Sofia Sans, `var(--ritemark-size-lg)` (16px), weight 600 | Space Grotesk, 20–24px |
| Body padding | `20px` (`p-5`) | `p-6` (24px), `p-4` (16px) |
| Footer padding | `14px 20px` | `16px 24px`, symmetric paddings |
| Footer buttons | gap `10px`, right-aligned | gap `8px`, `16px`; left-aligned |
| Primary button | Indigo + `--ritemark-shadow-indigo-sm` | Plain indigo fill, no shadow |
| Close button (X) | Top-right, ghost-style, 28×28px, 6px radius | Varies wildly |

## 2. Sidebar / list components

Files to audit: `components/ai-sidebar/`, `components/settings/`, `components/agent-library/` (once created), any `components/**/List*.tsx`.

| Check | Target | Common drift |
|---|---|---|
| Row height | 28–32px min-height (dense), 36px (comfortable) | `h-10` (40px), auto-height |
| Row padding | `px-2.5 py-1.5` (10px / 6px) | `px-3 py-2`, `p-2` |
| Row radius | `var(--ritemark-radius-sm)` (4px) | `rounded-md` (6px), `rounded-lg` (8px) |
| Font size | 13px (`var(--ritemark-size-base)`) | 14px, 16px |
| Default ink | `var(--r-ink-body)` | `var(--r-ink-strong)` — too heavy for inactive rows |
| Hover bg | `var(--r-surface-soft)` | VS Code `--vscode-list-hoverBackground` |
| **Active row (critical)** | All 3: `bg: var(--r-accent-soft)` + `border-left: 2px solid var(--r-accent)` + `color: var(--r-ink-strong)` + `font-weight: 500` | Often just `bg-accent` with no border, which reads like "hover stuck on" |
| Group header | Strong ink, weight 600, uppercase, 11px, `tracking-wide` | Muted ink (drifts into "row that needs attention"), no uppercase |

## 3. Inputs / form controls

Files to audit: `components/ui/input.tsx`, `components/ui/select.tsx`, `components/ui/switch.tsx`, `components/settings/**`.

| Check | Target | Common drift |
|---|---|---|
| Input border | `1px solid var(--r-hairline-strong)` | `2px solid var(--r-hairline)` (too heavy, shadcn default) |
| Input radius | `var(--ritemark-radius-md)` (6px) | 8px, 10px |
| Input font size | 14px | 13px (too small for actual editing) |
| Input padding | `10px 12px` | `8px 14px`, `12px 16px` |
| Focus state | `border-color: var(--r-accent)` + `box-shadow: 0 0 0 4px var(--r-ring-color)` | 2px solid ring, native outline, 3px ring |
| Placeholder color | `var(--r-ink-faint)` | hardcoded Slate 400, or too-strong muted |
| Invalid state | Red border + 4px red-soft ring | Red border alone (misses the ring signal) |

## 4. Button components

File: `components/ui/button.tsx` + any direct `<button>` uses in components.

| Check | Target | Common drift |
|---|---|---|
| Default variant bg | `var(--r-accent)` via `bg-primary` | OK — the token chain works if `--primary` → `--r-accent` in `index.css` |
| **Default variant shadow** | `var(--ritemark-shadow-indigo-sm)` | Missing entirely. This is the most common drift. |
| Default variant press | `active:scale-[0.98]` | Missing; no press feedback |
| Default variant hover | `--r-accent-deep` bg + `--ritemark-shadow-indigo-md` | Just `bg-primary/90` (washes the indigo to grey-ish) |
| Secondary variant | `var(--r-surface-soft)` bg + `var(--r-ink-strong)` text | Matches shadcn default — check if tokens chain through |
| Outline variant | 1px `var(--r-hairline-strong)` border | `border` (1px) on `border-input` — usually fine |
| Ghost variant | Transparent + `var(--r-surface-soft)` hover + `var(--r-ink-strong)` on hover | OK typically |
| Size — default | h-9 (36px), px-4 (16px) | OK — matches shadcn |
| Size — sm | h-8, px-3 | OK |

## 5. Color usage in components

Grep for hardcoded hex values in `extensions/ritemark/webview/src/**/*.{ts,tsx,css}`:

```bash
grep -rE '#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}' extensions/ritemark/webview/src --include='*.ts' --include='*.tsx' --include='*.css' | grep -v 'vscode-' | grep -v 'tokens.css'
```

Every hardcoded color outside `tokens.css` and VS Code fallback defaults is a drift point. Flag them all. Replace with role tokens in a follow-up sprint.

Specific common offenders to catch:

- `#888`, `#8c8c8c`, `#666` as text colors — replace with `var(--r-ink-muted)` or `var(--r-ink-body)`.
- `#ddd`, `#ccc`, `#eee` as border/divider — `var(--r-hairline)` or `var(--r-hairline-strong)`.
- `rgba(90, 93, 94, 0.31)` and similar VS Code-style greys — Ritemark uses `var(--r-surface-soft)` for hover, nothing else for that shade.

## 6. VS Code variable leaks

On components that are *Ritemark-owned* (new dialogs, Library, settings), grep for `var(--vscode-`:

```bash
grep -rE 'var\(--vscode-' extensions/ritemark/webview/src/components --include='*.tsx'
```

Each instance is a leak where a Ritemark surface is inheriting VS Code's look. Triage:

- On surfaces we own → replace with `var(--r-*)` role token. This is the main source of "VS Code feeling" Jarmo wants to move away from.
- On surfaces VS Code owns (scrollbars, embedded native dialogs) → fine, keep it.

## 7. Font usage

In-chrome components should never use Space Grotesk. Search:

```bash
grep -rE 'Space Grotesk|font-display|ritemark-font-display' extensions/ritemark/webview/src/components --include='*.tsx' --include='*.css'
```

Each in-chrome hit is a moment-tone leak into chrome. Should only appear in:
- Welcome screen (if one exists)
- Marketing-ish surfaces
- Slide-style content

Everything else should use `font-sans` / Sofia Sans / `var(--ritemark-font-ui)`.

## 8. Emoji / unicode glyphs

```bash
grep -P '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|★|→|↑|↓|✓|✗' extensions/ritemark/webview/src --include='*.tsx' -r
```

Each hit is either an emoji or a unicode glyph that should be a Phosphor icon via `<Icon>`. Replace with the corresponding `PhosphorIconName` (`check`, `x`, `arrow-right`, `star`, `arrow-up`, `arrow-down`, etc.) — see `references/iconography.md`.

## 9. Icon usage

Icons are migrated to **Phosphor** and routed through a single wrapper: `extensions/ritemark/webview/src/components/ui/Icon.tsx`. Source of truth: `references/iconography.md` + `.pen` frame `yq4P8`. Confirm these invariants:

**9a. No direct Phosphor imports at call sites.**
```bash
grep -rE "from ['\"]@phosphor-icons/react['\"]" extensions/ritemark/webview/src \
  --include='*.ts' --include='*.tsx' | grep -v '/components/ui/Icon.tsx'
```
Result must be empty. The only file allowed to import from `@phosphor-icons/react` is `components/ui/Icon.tsx`.

**9b. No Lucide imports anywhere.**
```bash
grep -rE "lucide-react" extensions/ritemark/webview/src extensions/ritemark/src \
  --include='*.ts' --include='*.tsx'
```
Result must be empty. `lucide-react` is forbidden and should no longer be in `webview/package.json`.

**9c. No off-spec sizes.**
Icon sizes are locked to `12 | 14 | 16 | 20`. The `Icon` component's `size` prop is typed so off-spec values fail at compile time, but legacy `w-N h-N` tailwind pairs on nearby elements can still leak.
```bash
grep -rE "size=\{(10|13|15|17|18|22|24|28|32)\}" extensions/ritemark/webview/src/components --include='*.tsx' | grep -i icon
```
Snap any hits to the nearest of 12 / 14 / 16 / 20.

**9d. No stale Lucide stroke override.**
```bash
grep -n "svg.lucide" extensions/ritemark/webview/src/index.css
```
Result must be empty. The `svg.lucide { stroke-width: 1px !important }` rule was removed when Phosphor landed; Phosphor's thin weight handles stroke natively.

**9e. Color goes through `tone`, not className.**
Phosphor icons inside the `<Icon>` wrapper receive a `color` prop driven by `tone` (`muted` / `active` / `disabled`). A `text-*` color className on an `<Icon>` is dead; the color prop overrides it. Flag these so they are either converted to `tone` or consciously removed:
```bash
grep -rE "<Icon[^>]*className=\"[^\"]*text-(red|green|yellow|blue|indigo|slate|ink-)" \
  extensions/ritemark/webview/src/components --include='*.tsx'
```

## 10. Focus-visible states

Ritemark has one focus pattern: 4px at 10% indigo. Grep for drift:

```bash
grep -rE 'focus-visible:|:focus\b' extensions/ritemark/webview/src --include='*.tsx' --include='*.css'
```

Each focus style should resolve to:

```css
outline: none;
border-color: var(--r-accent);
box-shadow: 0 0 0 var(--ritemark-ring-width) var(--r-ring-color);
```

Or the equivalent Tailwind: `focus-visible:outline-none focus-visible:border-[var(--r-accent)] focus-visible:shadow-[0_0_0_4px_var(--r-ring-color)]`.

Drift to flag:
- `focus:ring-2` — wrong width.
- Dashed outlines.
- Browser-native outline (no override).

## Priority scoring for migration

When you've gathered drift items, score them for migration priority:

- **Priority 1** — Indigo shadow missing from primary buttons; sidebar active-row treatment incomplete; VS Code var leaks on surfaces we own. *These are the items that kill the Ritemark feel.*
- **Priority 2** — Hardcoded colors outside tokens; dialog/card radii off-system; unicode glyphs; emoji.
- **Priority 3** — Weight/size minor drift; focus ring width off by 1px; secondary-button hover bg slightly off.

Priority 1 first, even in unrelated sprints — the feel of one new dialog is undermined by one adjacent sidebar that still has the drift.

## Not in scope of audit

Don't audit:

- The TipTap editor surface (`ProseMirror` styles). That's a content surface, and its styling is governed by the editor's typography, not the skill.
- VS Code core surfaces themed by `themes/ritemark-light.json` (and the upcoming dark theme). Those get audited against `references/vscode-core.md`, not against this file.
- Generated content (toast bodies written by feature code, preview content in Library rows). Content rules live in `references/philosophy.md` and individual feature specs, not design audit.
