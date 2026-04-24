# Dark Mode Rebalance — Implementation Handoff

**Date:** 2026-04-24
**Status:** Spec frozen in `docs-internal/design/ritemark-ui.pen` (frame `P0bi1` "Next-gen — Default view (Dark)"). Code follow-up still TODO.
**Owner:** Phase 3 implementer.

## Why

The first dark-mode prototype shipped in `extensions/ritemark/themes/ritemark-dark.json` and `.claude/skills/ritemark-design/tokens.css` uses Deep Space `#1E1B4B` for the editor body and indigo-deep `#3730A3` for hairlines. Jarmo flagged it as "too indigo, not usable" — large indigo blocks dominate the surface and indigo body ink (`#C7D2FE`) tints every paragraph.

The fix: surfaces and hairlines collapse onto a neutral slate ramp; indigo is reserved for accents only (active-tab top rail, selected-row left bar, focus borders, primary buttons, badge / progress highlights). The pen file `P0bi1` frame is the canonical rendering — every code change in this doc maps 1:1 to it.

## Rebalanced palette

| Token | Old hex | New hex | Tailwind reference |
| --- | --- | --- | --- |
| `--r-dark-surface` | `#1E1B4B` (indigo-950) | `#0F172A` | slate-900 |
| `--r-dark-surface-muted` | `#191635` | `#020617` | slate-950 |
| `--r-dark-surface-soft` | `#251F5C` | `#1E293B` | slate-800 |
| `--r-dark-hairline` | `#3730A3` (indigo-800) | `#1E293B` | slate-800 |
| `--r-dark-hairline-strong` | `#4338CA` (indigo-700) | `#334155` | slate-700 |
| `--r-dark-ink-body` | `#C7D2FE` (indigo-200) | `#CBD5E1` | slate-300 |

**Unchanged (do NOT edit):**

| Token | Hex | Role |
| --- | --- | --- |
| `--r-dark-ink-strong` | `#F8FAFC` | slate-50 |
| `--r-dark-ink-muted` | `#94A3B8` | slate-400 |
| `--r-dark-ink-faint` | `#64748B` | slate-500 |
| `--r-dark-ink-disabled` | `#475569` | slate-600 |
| `--r-dark-accent` (`indigo`) | `#818CF8` | indigo-400 |
| `--r-dark-accent-deep` | `#6366F1` | indigo-500 |
| `--r-dark-accent-darker` | `#4F46E5` | indigo-600 |
| `--r-dark-indigo-soft` | `rgba(129, 140, 248, 0.16)` | accent overlay |
| `--r-dark-indigo-fainter` | `rgba(129, 140, 248, 0.28)` | accent overlay |
| `--r-dark-success` / `-warning` / `-error` | `#4ADE80` / `#FBBF24` / `#F87171` | semantic |

**Removed / repurposed:**

- `#312E81` (was `--ritemark-indigo-darker` "pressed", currently bound to `button.secondaryHoverBackground`) → remap to `#334155` so the pressed state on slate buttons reads as a slate lift, not an indigo dive.

## File edits

### 1. `extensions/ritemark/themes/ritemark-dark.json` (REWRITE — primary deliverable)

The theme file is hand-authored hexes (no token references), so every old surface / hairline / body-ink hex must be swapped. Run these search/replace passes IN ORDER (case-insensitive on hex):

| Find | Replace | Hits to expect |
| --- | --- | --- |
| `#1e1b4b` | `#0F172A` | ~15 (editor.background, sideBar/panel backgrounds, dropdown / input / menu / quickInput, tab.activeBackground, peekViewResult, settings.dropdown, checkbox, notifications) |
| `#191635` | `#020617` | ~12 (activityBar, activityBarTop, sideBar, statusBar, titleBar, panel, editorGroupHeader.tabsBackground, tab.inactiveBackground, textBlockQuote, textCodeBlock, welcomePage.tileBackground) |
| `#251f5c` | `#1E293B` | ~5 (badge.background, button.secondary, list.hoverBackground, tab.hoverBackground, textPreformat.background, tree.inactiveIndentGuidesStroke, activityBarTop.activeBackground) |
| `#3730a3` | `#1E293B` | ~25 (every `*.border` / `*.separator` / `tree.indentGuidesStroke` / pickerGroup / settings.* borders / textSeparator) |
| `#4338ca` | `#334155` | 2 (checkbox.border, input.border) |
| `#312e81` | `#334155` | 1 (button.secondaryHoverBackground) |
| `#c7d2fe` | `#CBD5E1` | 3 (icon.foreground, sideBar.foreground, statusBar.foreground, list.inactiveSelectionForeground) |

**Do NOT touch any of these:**

- `#818cf8` (focusBorder, activityBar.activeBorder / .foreground, tab.activeBorderTop, breadcrumb.focusForeground, terminalCursor, list.highlightForeground, statusBar.focusBorder, links, progressBar, line-number active, etc.) — these are the indigo accent moments the design preserves.
- `#4f46e5` (button.background, statusBarItem.remoteBackground, activityBarBadge.background, menu.selectionBackground) — primary indigo.
- `#6366f1` (button.border, button.hoverBackground, list.focusHighlightForeground) — indigo-deep.
- `#818cf829`, `#818cf847`, `#818cf81f`, `#818cf840` (selection / focus alphas) — accent overlays.
- `#f87171`, `#4ade80`, `#fbbf24`, `#f8fafc`, `#94a3b8`, `#64748b`, `#475569` — semantic / neutral ink unchanged.
- `activityBarBadge.foreground: #1e1b4b` is text rendered on top of `#4F46E5` indigo. Remap to `#0F172A` so the foreground tracks the new surface; visual contrast is unchanged.

After editing, verify the file still parses (`jq . extensions/ritemark/themes/ritemark-dark.json > /dev/null`).

### 2. `.claude/skills/ritemark-design/tokens.css` (GATED — needs explicit Jarmo approval)

Sprint 52 scope marks the `ritemark-design` skill as read-only. The dark-token block (lines 64–93) holds the same over-indigo values as the theme JSON. To keep one source of truth, the skill must mirror the rebalance, but only after Jarmo says "yes update the skill" — do not touch it on your own.

When approved, edit the `RAW TOKENS — Dark` block:

```css
--ritemark-dark-surface:       #0F172A;  /* was #1E1B4B */
--ritemark-dark-surface-muted: #020617;  /* was #191635 */
--ritemark-dark-surface-soft:  #1E293B;  /* was #251F5C */
--ritemark-dark-hairline:      #1E293B;  /* was #3730A3 */
--ritemark-dark-hairline-strong: #334155; /* was #4338CA */
--ritemark-dark-ink-body:      #CBD5E1;  /* was #C7D2FE */
```

Indigo accents (`--ritemark-dark-indigo*`), semantic colors, and alpha overlays stay as-is. Comment in the file should drop the "Deep Space becomes the page" / "indigo-deep — keeps the brand in the borders" framing — those lines no longer describe the palette.

The semantic mapping at lines 226–246 (`.ritemark-dark` / `[data-theme="dark"]`) does not change — only the raw token values move.

### 3. `extensions/ritemark/webview/src/index.css` (corrected after dev-mode visual check)

Phase 3 already rebased semantic vars onto `--r-*` tokens, but the raw `--ritemark-dark-*` values still held the old over-indigo palette. After the first dev-mode visual check showed a light editor canvas under dark chrome, the webview dark raw tokens were updated to match the slate rebalance and the webview entrypoint now applies `ritemark-dark` when VS Code reports a dark editor background.

### 4. `docs-internal/design/ritemark-ui.pen` (already updated)

The pen file is the canonical reference; the rebalanced variables are already saved (verified via `mcp__pencil__get_variables`). Do not re-edit. The `Tokens` frame `bi8Au` may still display the old swatches — bring it into sync as a separate small pen edit when convenient (sprint invariant #6).

## VS Code theme key spot-checks

After the JSON rewrite, eyeball these surfaces in dev mode (`./scripts/code.sh`) and confirm they look like the pen frame `P0bi1`:

- **Activity bar** — slate-950 background, slate-400 inactive icons, indigo-400 active icon + active-border indicator (2px). No indigo block fill.
- **Side bar (Explorer)** — slate-900 background, ink-body filenames, slate-500 chevrons, slate-800 hover row, indigo-400 left rail on the active file, slate-50 section headers.
- **Tabs** — slate-950 strip background, slate-900 active tab with indigo-400 top border, slate-400 inactive tab text. Hover lifts to slate-800.
- **Editor** — slate-900 body, slate-50 prose, slate-300 secondary prose, indigo-400 cursor and selection accents.
- **Status bar** — slate-950 background, slate-300 text, slate-800 top border. Indigo-400 only on focus / Remote chip.
- **Title bar** — slate-950 background, slate-50 active title, slate-500 inactive.
- **Inputs / dropdowns / menus** — slate-900 surface, slate-700 stroke (`#334155`), slate-50 ink, indigo-400 focus ring.
- **Buttons** — primary stays indigo (`#4F46E5` bg, `#6366F1` border, white text). Secondary is slate-800 → slate-700 on hover.

## Verification checklist (run after the theme JSON ships)

- [x] `jq . extensions/ritemark/themes/ritemark-dark.json > /dev/null` — parses
- [x] `grep -E '#1e1b4b|#191635|#251f5c|#3730a3|#4338ca|#312e81|#c7d2fe' extensions/ritemark/themes/ritemark-dark.json` — returns nothing
- [x] Webview dark tokens in `extensions/ritemark/webview/src/index.css` match the slate rebalance
- [x] `npm run build` in `extensions/ritemark/webview` regenerates `extensions/ritemark/media/webview.js`
- [ ] Build dev mode (`./scripts/code.sh`), switch theme to "Ritemark Dark"
- [ ] Spot-check every surface in the list above against pen frame `P0bi1`
- [ ] Settings page (`RitemarkSettings.tsx`) renders cleanly in dark — confirm ≥400 lines untouched
- [ ] Welcome screen, Chat panel, Flows sidebar — no indigo block backgrounds, indigo only on accents
- [ ] Toggle light ↔ dark at runtime — no flash, no leftover indigo, no unstyled regions
- [x] Run `./scripts/validate-qa.sh` before commit

## Out of scope for this rebalance

- Activity bar / titlebar / tabs / status bar redesign — Sprint 53.
- Updating other Ritemark-owned themes (`ritemark-light.json`) — light palette is unchanged.
- New tokens or new CSS variables — this is a value-only swap.
- Changing the indigo accent ramp itself — accents stay exactly as they are.

## Reference

- Pen file: `docs-internal/design/ritemark-ui.pen`, frame `P0bi1` (Next-gen — Default view (Dark)).
- Sprint plan: `docs/development/sprints/sprint-52-design-foundations/sprint-plan.md` (Phase 3 dark-theme deliverable).
- Skill source (gated): `.claude/skills/ritemark-design/tokens.css` lines 64–93.
- Theme file: `extensions/ritemark/themes/ritemark-dark.json`.
