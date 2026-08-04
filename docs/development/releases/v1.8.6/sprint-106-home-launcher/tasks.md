# Sprint 106 Tasks — branch sprint-106-home-launcher

- [x] `home-launcher` flag (experimental kill-switch, default ON via `ritemark.features.home-launcher` config default)
- [x] Activity Bar container `ritemark-home` + `ritemark.homeView` webview view + home icon
- [x] `HomeViewProvider` (self-contained HTML, Indigo-Editorial tones, command allow-list, disabled-notice kill-switch path, no-folder state)
- [x] Recent documents from workspace mtimes (no new persistence)
- [x] Live validation: tab visible, CTA creates+opens .md, quick actions present, recents real; screenshot captured
- [x] Found+fixed: when-clause with hyphenated config key never matches (view stayed hidden via hideIfEmpty) → unconditional view + provider-side kill-switch; experimental flags need a package.json config default to be ON
- [ ] Jarmo Gate walk (incl. no-folder state + placement acceptability — first-position pinning deliberately not patched)
