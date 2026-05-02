# Ritemark v1.6.1 — Under the Hood

VS Code engine upgrade (1.109.5 -> 1.117.0) and bug fixes. No new features — just a better foundation.

## Highlights

- **VS Code 1.117.0** — 8 upstream releases rolled up. All 6 Ritemark patches rebased and validated.
- **Text selection fix** — selection background in code blocks and table cells now clearly visible.
- **AI file-write reliability** — Flow file writes route through `vscode.workspace.fs`; explorer auto-refreshes after agent writes.
- **Explorer refresh button** — manual refresh in the explorer toolbar for cases where auto-refresh misses.

## Sprints rolled up

- Sprint 55 — VS Code 1.109.5 -> 1.117.0 upgrade + bug bundle

## Downloads

| Platform | File |
|----------|------|
| macOS Apple Silicon (M1/M2/M3) | `Ritemark-arm64.dmg` |
| macOS Intel | `Ritemark-x64.dmg` |
| Windows | `Ritemark-1.6.1-win32-x64-setup.exe` |

## Checksums (SHA-256)

```
TBD  Ritemark-arm64.dmg
TBD  Ritemark-x64.dmg
```

## Notarization

Both macOS DMGs are signed with a Developer ID certificate and notarized + stapled by Apple.

## Technical

- Base: VS Code OSS 1.117.0 (up from 1.109.5)
- No new extension-host runtime dependencies

## Full release notes

See `docs/releases/v1.6.1/release-notes.md` in the source repo.

---

**Full Changelog:** https://github.com/jarmo-productory/ritemark-public/compare/v1.6.0...v1.6.1
