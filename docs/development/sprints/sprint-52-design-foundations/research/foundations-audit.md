# Sprint 52 Foundations Audit

Date: 2026-04-24  
Branch: `feat/sprint-52-design-foundations`

## Summary

Sprint 52 is implementable. The critical corrections are path/wiring accuracy, dark-theme bootstrapping, and keeping the first implementation pass scoped to foundations instead of a blind webview-wide color replacement.

## Repo/path corrections

- Theme files live under `extensions/ritemark/themes/`, not repo-root `themes/`.
- The existing light theme is `extensions/ritemark/themes/ritemark-light.json`.
- The dark theme should be contributed from `extensions/ritemark/package.json` as `ritemark-dark` with `uiTheme: vs-dark`.
- Default theme bootstrap has three active locations:
  - `extensions/ritemark/package.json` configuration defaults
  - `branding/product.json` and `vscode/product.json` product defaults
  - `extensions/ritemark/src/extension.ts` upgrade-time branding settings
- `patches/vscode/001-ritemark-branding.patch` only covers VS Code submodule changes. Product defaults and extension contribution wiring are outside that patch.

## Design-skill boundary

- `.claude/skills/ritemark-design/` exists and is useful as the current design reference.
- AGENTS.md says Claude-owned assets under `.claude/**` must remain unchanged unless explicitly requested.
- This sprint should read that skill, but write Codex sprint evidence under `docs/development/sprints/sprint-52-design-foundations/` unless Jarmo explicitly requests Claude skill edits.
- The icon reference file already exists as `references/iconography.md`; do not create a parallel `references/icons.md` unless the skill is deliberately renamed.

## Webview styling inventory

Current scan after the first token/primitives pass:

| Item | Count | Notes |
| --- | ---: | --- |
| Raw hex occurrences in `webview/src/**/*.{ts,tsx,css}` | 174 | Many are legitimate fallbacks or third-party renderer variables; classify before replacing. |
| `var(--vscode-*)` occurrences in webview source | 858 | Menus, scrollbars, context-like surfaces may stay VS Code-backed; owned surfaces should move to `--r-*`. |
| Inline style objects | 99 | Highest-risk migration area because token use is not centralized. |
| Lucide imports | 65 | Lucide is already the default webview icon family. |
| Phosphor imports | 0 | No webview Phosphor dependency found. |
| Material Symbols/CSS mentions | 0 | Needs per-surface review before any exception is documented. |

## Implementation decisions already made

- Add `extensions/ritemark/themes/ritemark-dark.json` beside the light theme.
- Add `extensions/ritemark/themes/dark_plus.json` so dark syntax token colors have a local include target, matching the existing local `light_plus.json` pattern.
- Set `workbench.preferredDarkColorTheme` to `ritemark-dark` and `window.autoDetectColorScheme` to `true` in product/extension defaults.
- Stop the extension upgrade hook from forcing `workbench.colorTheme = ritemark-light`; keep preferred light/dark themes and icon theme instead.
- Rebase shadcn semantic vars in `index.css` to Ritemark `--r-*` role tokens first.
- Keep VS Code variables as deliberate fallbacks for truly VS Code-native surfaces, not as owned surface defaults.

## Open risks

1. Full webview-wide replacement is too broad for one pass. Migrate owned surfaces in slices and keep renderer/editor exceptions documented.
2. Visual regression still needs Playwright dependency/script decisions; do not make it blocking until baselines exist.
3. VS Code submodule changes must be represented in patch files; otherwise local changes disappear on a clean checkout.
4. Runtime dark-mode switching needs manual smoke testing in the app because webviews receive theme changes through VS Code body classes.

## Next recommended slices

1. Validate compile/build for extension + webview.
2. Smoke test Ritemark Light and Ritemark Dark in the app.
3. Migrate Welcome and Settings surfaces first; leave editor/renderers for a classified follow-up slice.
4. Add visual-regression harness once the first primitive fixture is stable.
