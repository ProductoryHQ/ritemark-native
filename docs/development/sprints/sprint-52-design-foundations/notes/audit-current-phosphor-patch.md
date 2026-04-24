# DRAFT — patch `.claude/skills/ritemark-design/references/audit-current.md`

**Why this file exists:** tooling permission hook denies direct writes to `.claude/skills/ritemark-design/`. Only sections 8 and 9 need changes; rest of the file is still accurate after the Phosphor migration.

Once applied, delete this draft.

---

## Patch

**Find** (current sections 8–9):

```markdown
## 8. Emoji / unicode glyphs

```bash
grep -P '[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|★|→|↑|↓|✓|✗' extensions/ritemark/webview/src --include='*.tsx' -r
```

Each hit is either an emoji or a unicode glyph that should be a Lucide icon. Replace.

## 9. Icon stroke weight

`webview/src/index.css` already forces `stroke-width: 1px` on `svg.lucide`. Confirm:

1. The rule is still present (not removed by an unrelated patch).
2. No component overrides with `strokeWidth={1.5}` or `strokeWidth={2}` except for the deliberate moment-surface case at 32px+.

```bash
grep -rE 'strokeWidth=\{[0-9]' extensions/ritemark/webview/src/components --include='*.tsx'
```
```

**Replace with**:

```markdown
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
Icon sizes are locked to `12 | 14 | 16 | 20`. The `Icon` component's `size` prop is typed so off-spec values fail at compile time — but legacy `w-N h-N` tailwind pairs on nearby elements can still leak.
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
Phosphor icons inside the `<Icon>` wrapper receive a `color` prop driven by `tone` (`muted` / `active` / `disabled`). A `text-*` color className on an `<Icon>` is dead — the color prop overrides it. Flag these so they are either converted to `tone` or consciously removed:
```bash
grep -rE "<Icon[^>]*className=\"[^\"]*text-(red|green|yellow|blue|indigo|slate|ink-)" \
  extensions/ritemark/webview/src/components --include='*.tsx'
```
```

## Summary of changes

- §8: "Lucide icon" → "Phosphor icon via `<Icon>`", with concrete name examples.
- §9: Renamed from "Icon stroke weight" to "Icon usage". Replaced the obsolete Lucide stroke check with five Phosphor invariants (9a–9e): no direct Phosphor imports, no Lucide imports, no off-spec sizes, no stale `svg.lucide` override, color via `tone` not className.

All other sections (1–7, 10, "Priority scoring", "Not in scope of audit") are still accurate.
