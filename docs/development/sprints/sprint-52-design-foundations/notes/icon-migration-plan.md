# Sprint 52 — Lucide → Phosphor Icon Migration (detailed sub-plan)

**Scope decision (Jarmo, 2026-04-24):** Folded into Sprint 52. No separate 52.5 sprint. Ships on `feat/sprint-52-design-foundations` alongside the other Sprint 52 foundation work. Validation: manual QA per phase via hot-copy.

**Audit update (2026-04-24):** Webview React migration is complete and built. VS Code chrome/activity-bar icons are intentionally not covered by this plan; they still use the existing VS Code patch/static SVG path and move to Sprint 53.

## Goal

Replace every `lucide-react` import in the webview with a single typed `<Icon>` wrapper backed by `@phosphor-icons/react`, then remove the Lucide dependency and its 1px-stroke CSS override — so Sprint 53 (Chrome) can land on a Phosphor-only baseline.

## Why This Migration Exists

Sprint 52 locked the icon rules: Phosphor only, weight 100, sizes 12/14/16/20, one wrapper, typed `name` union. The rules are written. The code has not been migrated. 67 files (64 `.tsx`, 2 `.ts` in webview, 1 in extensions) still import from `lucide-react`.

Sprint 53 adds Agents and Flows to the activity bar and reskins the chrome. Every icon in those surfaces must come from Phosphor. If Lucide is still present when Sprint 53 starts, every new chrome component has two valid import paths and the rule silently breaks on the first busy morning. This migration eliminates that surface before it exists.

It also closes the one open Sprint 52 action: `references/iconography.md` is still Lucide-default content. This migration rewrites it.

## Branch

`feat/sprint-52-design-foundations` (same branch as the rest of Sprint 52). Phased commits (A–F) per the checklist below so individual phases can be reverted if needed.

## Feature Flag Check

- [ ] Does this sprint need a feature flag? **NO.** Icon migration is a pure implementation swap with zero user-visible behavior change. The icon images change (Lucide → Phosphor thin-weight), but every icon already displays correctly. No kill-switch required. No experimental surface. Not premium or platform-specific.

## Success Criteria

- [x] `extensions/ritemark/webview/src/components/ui/Icon.tsx` exists; exports a single `<Icon name size tone />` component
- [x] `PhosphorIconName` union type is derived from the bounded runtime icon map — not a superset of all Phosphor icons
- [x] Zero `import ... from 'lucide-react'` lines remain in `extensions/ritemark/webview/src/`
- [x] Zero `import ... from 'lucide-react'` lines remain in `extensions/ritemark/src/`
- [x] `svg.lucide { stroke-width: 1px !important; }` block removed from `webview/src/index.css` lines 22–26
- [x] `lucide-react` removed from `extensions/ritemark/webview/package.json`
- [x] `@phosphor-icons/react` added to `extensions/ritemark/webview/package.json`
- [x] `references/iconography.md` rewritten from `notes/icons-usage.md` (no Lucide-default content)
- [x] TypeScript compiles clean: `npx tsc --noEmit` in `extensions/ritemark/`
- [x] Vite build clean: `npm run build` in `extensions/ritemark/webview/`
- [ ] Manual QA: Jarmo eyeballs each high-traffic surface after each phase commit; no layout shift, no blank-icon areas
- [x] QA validator passes

## Deliverables

| Deliverable | Description | Phase | Status |
|---|---|---|---|
| Phosphor dep + Icon wrapper | `@phosphor-icons/react` added; `components/ui/Icon.tsx` created with typed `name` union, default props, aria handling | A | DONE |
| `ui/` primitive migration | `ui/select.tsx` and `ui/dialog.tsx` migrated — canary for import-safety inside other primitives | B | DONE |
| AI sidebar migration | ~35 files under `components/ai-sidebar/` migrated to `<Icon>` | C | DONE |
| Flows migration | ~14 files under `components/flows/` migrated | D | DONE |
| Header / properties / misc migration | ~15 remaining files migrated | E | DONE |
| Cleanup | `lucide-react` dep removed, `svg.lucide` CSS override removed, `references/iconography.md` rewritten | F | DONE (webview) |
| Validation | Build, QA validator, manual eyeball per surface | 6 | DONE (automated); manual visual QA remains human-only |

## Scope

### In Scope

- `extensions/ritemark/webview/src/components/ui/Icon.tsx` (new)
- `extensions/ritemark/webview/src/` — all `.tsx` and `.ts` files importing `lucide-react`
- `extensions/ritemark/src/` — any `.ts` files importing `lucide-react`
- `extensions/ritemark/webview/package.json` (dep swap)
- `extensions/ritemark/webview/src/index.css` (remove Lucide stroke override, lines 22–26)
- `.claude/skills/ritemark-design/references/iconography.md` (rewrite from `notes/icons-usage.md`)

### Out of Scope

- Adding icons not already in the `notes/icons-usage.md` surface→icon mapping table
- Changing any icon's semantic meaning or surface placement (migration only)
- Dark theme implementation (Sprint 52 deferred; not touched here)
- VS Code patches / chrome (Sprint 53)
- Visual regression Playwright harness (Sprint 52 deferred; not built here — manual QA only)
- Flows or AI sidebar feature changes (layout unchanged; icon source only)

## Implementation Checklist

### Phase A: Wrapper + Types + Dependency

- [ ] Add `@phosphor-icons/react` to `extensions/ritemark/webview/package.json`
- [ ] Run `npm install` in `extensions/ritemark/webview/`
- [ ] Create `extensions/ritemark/webview/src/components/ui/Icon.tsx`:
  - `PhosphorIconName` union derived from the `notes/icons-usage.md` surface→icon mapping table (static list, not `keyof typeof phosphor`)
  - Props: `name: PhosphorIconName`, `size?: 12 | 14 | 16 | 20` (default `16`), `weight?: 100` (default `100`), `tone?: 'muted' | 'active' | 'disabled'` (default `'muted'`)
  - Tone maps to CSS color vars: `muted` → `var(--r-ink-muted)`, `active` → `var(--r-accent)`, `disabled` → `var(--r-ink-disabled)`
  - `aria-hidden` by default; caller passes `aria-label` to override
  - Internally maps `name` to the Phosphor component via a static switch/map — tree-shakeable; no dynamic string import
  - Lives at `@/components/ui/Icon` (aliased import path)
- [ ] Audit for orphaned icons: walk every `lucide-react` import across all 67 files; flag any icon name not yet in the `notes/icons-usage.md` table; add to surface→icon mapping before proceeding to Phase B
- [ ] `npx tsc --noEmit` clean in `extensions/ritemark/`
- [ ] Commit: `feat(icons): add Icon wrapper + PhosphorIconName union (Phase A)`

### Phase B: ui/ Primitives (canary)

- [ ] Migrate `extensions/ritemark/webview/src/components/ui/select.tsx` — replace `lucide-react` imports with `<Icon>`; apply rename table where needed
- [ ] Migrate `extensions/ritemark/webview/src/components/ui/dialog.tsx` — same
- [ ] Verify both compile and render correctly (hot-copy to production app; Jarmo eyeballs)
- [ ] `npx tsc --noEmit` clean
- [ ] Commit: `feat(icons): migrate ui/ primitives to Icon wrapper (Phase B)`

### Phase C: AI Sidebar (~35 files)

- [ ] Migrate all files under `extensions/ritemark/webview/src/components/ai-sidebar/`
- [ ] Apply rename table: `chevron-*` → `caret-*`, `search` → `magnifying-glass`, `bot` → `robot`, `workflow` → `flow-arrow`, `settings` → `gear`, `trash-2` → `trash`, `external-link` → `arrow-square-out`, `lock` → `lock-simple`, `edit-3` → `pencil-simple`
- [ ] Hot-copy to running app; Jarmo eyeballs AI sidebar: no blank icons, no layout shift
- [ ] `npx tsc --noEmit` clean
- [ ] Commit: `feat(icons): migrate ai-sidebar to Icon wrapper (Phase C)`

### Phase D: Flows (~14 files)

- [ ] Migrate all files under `extensions/ritemark/webview/src/components/flows/`
- [ ] Apply rename table where needed
- [ ] Hot-copy; Jarmo eyeballs Flows panel
- [ ] `npx tsc --noEmit` clean
- [ ] Commit: `feat(icons): migrate flows to Icon wrapper (Phase D)`

### Phase E: Header / Properties / Misc (~15 files)

- [ ] Migrate remaining files: `Editor.tsx`, `FindBar.tsx`, `FormattingBubbleMenu.tsx`, `ResizableImage.tsx`, `SpreadsheetViewer.tsx`, `TableOverlayControls.tsx`, `TablePicker.tsx`, `VoiceDictationButton.tsx`, `DataTable.tsx`, `InlineTableOfContents.tsx`, and any remaining files
- [ ] Also migrate the one file in `extensions/ritemark/src/` (non-webview)
- [ ] Hot-copy; Jarmo eyeballs editor toolbar, find bar, spreadsheet viewer, image controls
- [ ] `npx tsc --noEmit` clean
- [ ] Confirm zero `lucide-react` imports remain: `grep -r "lucide-react" extensions/ritemark/` must return empty
- [ ] Commit: `feat(icons): migrate remaining surfaces to Icon wrapper (Phase E)`

### Phase F: Cleanup

- [ ] Remove `lucide-react` from `extensions/ritemark/webview/package.json` `dependencies`
- [ ] Run `npm install` to update lockfile
- [ ] Remove `svg.lucide { stroke-width: 1px !important; }` block from `extensions/ritemark/webview/src/index.css` (lines 22–26)
- [ ] Rewrite `.claude/skills/ritemark-design/references/iconography.md` from `notes/icons-usage.md` — replace all Lucide-default content with Phosphor rules, tokens, API, surface→icon mapping, migration table, forbidden card
- [ ] `npm run build` in `extensions/ritemark/webview/` — clean build, check bundle size delta (Phosphor must tree-shake comparably to Lucide)
- [ ] Commit: `chore(icons): remove lucide-react, drop 1px-stroke override, rewrite iconography.md (Phase F)`

### Phase 6: Validation

- [ ] `npx tsc --noEmit` in `extensions/ritemark/` — zero errors
- [ ] `npm run build` in `extensions/ritemark/webview/` — zero errors; check bundle size is not significantly larger
- [ ] `./scripts/validate-qa.sh` — all green
- [ ] Manual QA: Jarmo opens Settings, Welcome, Chat, Flows, AI sidebar — confirms icons render correctly in all surfaces
- [ ] Manual QA: no emoji, no Unicode glyphs, no `→` `★` `✓` `✗` in UI body copy (confirm Forbidden rules hold)
- [ ] `grep -r "lucide-react" extensions/ritemark/` returns empty
- [ ] Produce `notes/validation-log.md`

## Validation Strategy

No Playwright visual regression harness exists (deferred from Sprint 52). Three options:

| Option | Description | Verdict |
|---|---|---|
| (a) Manual QA per phase | Jarmo eyeballs each high-traffic surface after each phase commit, using hot-copy deploy | **Recommended** |
| (b) Build Playwright harness first | Adds scope; deferred from Sprint 52 for a reason | Rejected — scope creep |
| (c) `.pen` yq4P8 frame as reference | Frame shows expected icon sizes/weights; good for design check but not runtime regression | Supplemental |

Hot-copy command (no full rebuild needed — extension-only change):
```
cp -R extensions/ritemark/out/* "VSCode-darwin-arm64/Ritemark Native.app/Contents/Resources/app/extensions/ritemark/out/"
```

**Question for Jarmo (Q3):** Confirming you're comfortable with manual QA per phase (no automated visual regression for this sprint). If you want the Playwright harness built here, say so and we'll add it to Phase A.

## Invariants This Sprint Must Uphold

1. **Never stub or disable existing features** — icon migration is a visual-source swap; every component remains fully functional with zero behavior change
2. **Settings page full implementation** — `RitemarkSettings.tsx` stays ≥400 lines; this sprint does not touch it
3. **Features ON by default** — no icons hidden, no surfaces gated
4. **Typed `name` union is bounded** — `PhosphorIconName` covers only the icons in the surface→icon mapping table; it is not `string` and not the full Phosphor catalog
5. **No direct Phosphor imports at call sites** — all consumers go through `<Icon>`; `PhFolderOpen` style imports are forbidden outside `Icon.tsx` itself
6. **Tone maps to CSS vars, not hardcoded hex** — `tone="active"` → `var(--r-accent)`, never `#4338CA` inline

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Icon name typo at a call site compiles but renders blank | HIGH | `PhosphorIconName` union catches unknown names at compile time; `tsc --noEmit` is mandatory after every phase |
| Phosphor thin-weight SVGs have different bounding boxes than Lucide; toolbar layouts shift | MEDIUM | Wrapper normalizes to size tokens (12/14/16/20px); caller controls container sizing; Jarmo eyeballs each surface after each phase before next phase starts |
| Bundle size grows unexpectedly (Phosphor not tree-shaking) | MEDIUM | Phase F build check; `Icon.tsx` must use static import map (not dynamic), which enables tree-shaking; if bundle grows >10% investigate before merging |
| Orphaned icons — a call site uses a Lucide icon not yet in the surface→icon mapping table | MEDIUM | Phase A audit walks every `lucide-react` import and resolves against the table before any call site is touched; table is updated as needed |
| `ui/select.tsx` or `ui/dialog.tsx` breaks a surface that depends on them | MEDIUM | Phase B is the canary: these are migrated first, hot-copied, and Jarmo confirms before Phase C starts |
| Sprint 52 is not yet committed when this sprint needs to start | LOW | Blocked by design: branch sequence requires Sprint 52 commit first; this is Q2 above |
| `references/iconography.md` rewrite introduces inaccuracies vs `.pen` yq4P8 | LOW | Rewrite is direct transcription from `notes/icons-usage.md` which is already the authoritative text mirror; `.pen` wins on any disagreement per 2026-04-24 ruling |

## Key Research

- `docs/development/sprints/sprint-52-design-foundations/notes/icons-usage.md` — authoritative text mirror; source of `PhosphorIconName` union values and rename table
- `docs-internal/design/ritemark-ui.pen` frame `yq4P8` — Icon Usage Guide (source of truth; wins over all text docs)
- `extensions/ritemark/webview/src/index.css` lines 22–26 — the Lucide stroke override to remove
- Sprint 52 plan section "Icon family lockdown" and "Webview Lucide → Phosphor migration" rows

## Key Files

| File | Purpose |
|---|---|
| `extensions/ritemark/webview/src/components/ui/Icon.tsx` | NEW — the only Phosphor import point for all call sites |
| `extensions/ritemark/webview/package.json` | MODIFY — add `@phosphor-icons/react`, remove `lucide-react` |
| `extensions/ritemark/webview/src/index.css` | MODIFY — remove `svg.lucide` block (lines 22–26) |
| `extensions/ritemark/webview/src/components/ui/select.tsx` | MIGRATE — Phase B canary |
| `extensions/ritemark/webview/src/components/ui/dialog.tsx` | MIGRATE — Phase B canary |
| `extensions/ritemark/webview/src/components/ai-sidebar/` | MIGRATE — Phase C (~35 files) |
| `extensions/ritemark/webview/src/components/flows/` | MIGRATE — Phase D (~14 files) |
| `extensions/ritemark/webview/src/components/*.tsx` (misc) | MIGRATE — Phase E (~15 files) |
| `extensions/ritemark/src/` (one file) | MIGRATE — Phase E |
| `.claude/skills/ritemark-design/references/iconography.md` | REWRITE — Phase F |

## Status

**Current Phase:** Complete for webview React surfaces; VS Code chrome/activity-bar deferred to Sprint 53  
**Current Branch:** `feat/sprint-52-design-foundations`  
**Approved:** Jarmo, 2026-04-24 ("incl in 52 sprint and continu")
