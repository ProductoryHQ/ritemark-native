# Icons usage spec

**Status:** Authoritative text mirror of the design source of truth.
**Source of truth:** `docs-internal/design/ritemark-ui.pen` → frame `yq4P8` (Icon Usage Guide). If this doc and the `.pen` disagree, the `.pen` wins.
**Rulings:**
- 2026-04-24 — Jarmo confirmed `.pen` is always source of truth. This supersedes the earlier sprint-52 lockdown on Lucide.
- **2026-05-02 — Default icon weight reset from 100 (thin) to 400 (regular).** Applied to chrome (patches/vscode/001 + producticons/) and webview (`Icon.tsx`). The `.pen` `yq4P8` token still reads 100 — TODO for Jarmo to bump in Pencil. Until then, treat this 2026-05-02 ruling as authoritative when the `.pen` weight conflicts.

## Library

Ritemark uses **Phosphor Icons** and only Phosphor Icons. No Lucide, no Material Symbols, no Heroicons, no Tabler, no Feather.

- Extension / VS Code patches: Phosphor web font.
- Webview (React): `@phosphor-icons/react` (replaces `lucide-react`; removal is part of the migration in the deliverables below).
- Design (`.pen`): `iconFontFamily: "phosphor"` — all `icon_font` nodes.

## Tokens

All icon properties are driven by tokens defined in `docs-internal/design/ritemark-ui.pen` and mirrored into webview CSS vars.

| Token | Value | Use |
| --- | --- | --- |
| `$icon-family` | `phosphor` | Only library. No mixing. |
| `$icon-weight-default` | `400` (regular) | Locked. Do not override per-icon. |
| `$icon-size-xs` | `12` | Dense chips, metadata, inline indicators. |
| `$icon-size-sm` | `14` | Tree rows, tabs, dropdown items. |
| `$icon-size-md` | `16` | Toolbar, titlebar, dialog headers, form-field prefixes. |
| `$icon-size-lg` | `20` | Activity bar, section markers, settings headers. |
| `$icon-color-muted` | `$--r-ink-muted` (#64748B) | Idle / default tone. |
| `$icon-color-active` | `$--r-accent` (#4338CA) | Selected / active item. |
| `$icon-color-disabled` | `$--r-ink-disabled` (#CBD5E1) | Disabled / read-only. |

No off-spec sizes. No `13`, `15`, `18`, `22`. No Thin / Light / Bold / Fill / Duotone weights.

## Component API

One wrapper component. Always these props.

```tsx
<Icon
  name="folder-open"        // Phosphor kebab-case name
  size={16}                 // 12 | 14 | 16 | 20 — no other values
  weight={400}              // default; do not override
  tone="muted"              // 'muted' | 'active' | 'disabled'
  aria-hidden               // or aria-label for action icons
/>
```

Rules:

1. Use one `Icon` wrapper everywhere; do not import `PhFolderOpen` directly at call sites.
2. `name` must be a Phosphor icon name, typed as a union / enum to stop typos at compile time.
3. Decorative icons get `aria-hidden`. Icons that carry meaning (buttons without text, status indicators) get `aria-label`.
4. Active state is signaled with **color** (`tone="active"`), not with an icon swap.

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

New surface additions must reuse names already present in this list when semantically equivalent (e.g. a new "add file" affordance uses `file-plus`, not `plus-circle`).

## Lucide → Phosphor migration (webview)

Webview currently has ~65 Lucide call sites. The renames below are the ones that change at migration time. Names not listed are unchanged (Phosphor has the same kebab-case name).

| Lucide | Phosphor |
| --- | --- |
| `chevron-right` | `caret-right` |
| `chevron-down` | `caret-down` |
| `chevron-left` | `caret-left` |
| `chevron-up` | `caret-up` |
| `search` | `magnifying-glass` |
| `bot` | `robot` |
| `workflow` | `flow-arrow` |
| `settings` | `gear` |
| `trash-2` | `trash` |
| `external-link` | `arrow-square-out` |
| `lock` | `lock-simple` |
| `edit-3` | `pencil-simple` |

Unchanged names (keep as-is, only the import source changes): `file-text`, `folder`, `folder-open`, `files`, `x`, `plus`, `check`, `star`, `dots-three`, `info`, `warning`, `list-checks`, `file-plus`, `folder-plus`, `file-csv`, `file-doc`, `file-pdf`, `file-png`, `file-ts`, `at`, `paperclip`, `microphone`, `download`, `arrow-up`, `git-branch`, `puzzle-piece`, `user-circle`, `robot` (when present), `play`, `play-circle`.

Migration steps for the webview:

1. Add dependency: `@phosphor-icons/react`.
2. Create `components/ui/Icon.tsx` wrapper per the API above.
3. Replace every `lucide-react` import with the `Icon` wrapper, renaming per the table.
4. Remove the 1-px stroke CSS override from `extensions/ritemark/webview/src/index.css` (`svg.lucide { stroke-width: 1px !important; }`) — Phosphor regular weight provides the stroke styling natively.
5. Remove `lucide-react` from `webview/package.json`.
6. Run visual-regression against `.pen` surface frames to confirm parity.

## Forbidden

- **Other icon libraries.** Lucide, Material Symbols, Heroicons, Tabler, Feather — all banned. No partial mixing for "this one icon that's missing."
- **Off-spec sizes.** Only 12/14/16/20. Marketing surfaces extend through the `$icon-size` tokens, not ad-hoc pixels.
- **Off-spec weights.** Weight stays 100. Duotone / Bold / Fill variants are not part of the Ritemark system.
- **Emoji in UI.** No 🚀 ✅ ⚠️ 🔧 in webview, dialogs, toasts, activity bar, settings, welcome, marketing, slides, release notes. Use Phosphor equivalents (`rocket`, `check`, `warning`, `wrench`) via the `Icon` wrapper.
- **Unicode glyph fallbacks.** No `→` `★` `✓` `✗` in body copy. Use Phosphor `arrow-right`, `star`, `check`, `x`.

## Exceptions

None by default. If a surface genuinely needs something Phosphor does not provide, raise it with Jarmo before drawing a custom SVG. Custom icons, if approved, must match Phosphor regular-weight (400) visual language: ~1.5px-equivalent stroke, rounded caps, 24×24 grid.

## How this doc stays current

This file is derived from the `.pen`. When `yq4P8` changes (new token, renamed size, added surface), update this file in the same commit. The `.pen` wins on any disagreement.
