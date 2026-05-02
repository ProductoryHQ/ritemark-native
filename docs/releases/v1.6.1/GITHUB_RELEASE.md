# Ritemark v1.6.1 — Foundation + Polish

VS Code engine upgrade (1.109.5 → 1.117.0), nicer Mermaid diagrams, friendlier Claude/Codex onboarding, and a stack of bug fixes.

## Highlights

- **VS Code 1.117.0** — 8 upstream releases rolled up. All 6 Ritemark patches rebased and validated.
- **Mermaid diagrams** — full-width rendering, reduced margins, horizontal scroll for oversized diagrams. New toolbar: Copy image, Download (OS Save As), and Expand with cursor-anchored Cmd/Ctrl+Scroll zoom.
- **Claude / Codex onboarding** — bundled agent runtime, truthful auth state, terminal-free sign-in via system browser, "Use Anthropic API key" alternative path. Workspace trust prompt removed.
- **Theme fix** — gitignored Explorer entries (e.g. `docs-internal/`, `node_modules/`) now readable in both light and dark themes.
- **Editor fixes** — text selection visible in code blocks and table cells, AI Flow file writes route through `vscode.workspace.fs`, explorer auto-refresh after agent writes plus a manual refresh button.

## Sprints rolled up

- Sprint 55 — VS Code 1.109.5 → 1.117.0 upgrade + bug bundle
- Sprint 56 — Mermaid diagram fixes
- Sprint 57 — Windows onboarding (bundled agent runtime + truthful Claude auth)

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
TBD  Ritemark-1.6.1-win32-x64-setup.exe
```

## Notarization

Both macOS DMGs are signed with a Developer ID certificate and notarized + stapled by Apple.

## Technical

- Base: VS Code OSS 1.117.0 (up from 1.109.5)
- No breaking changes; no new extension-host runtime dependencies

## Full release notes

See `docs/releases/v1.6.1/release-notes.md` in the source repo.

---

**Full Changelog:** https://github.com/jarmo-productory/ritemark-public/compare/v1.6.0...v1.6.1
