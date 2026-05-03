# Ritemark v1.6.1 — Foundation + Polish

> Archived copy of the release body as published on GitHub on 2026-05-02. Edit only if the live release body is also being edited.

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

> Windows: coming soon — the installer will be added as a follow-up asset on this release.

## Checksums (SHA-256)

```
8bba403437106da990ab49c9e994960d3079da3f1a2ee25dda8b6777cf6cf483  Ritemark-arm64.dmg
7a86c1693e64d6c2880fe437c29bae657333f4c9d7d2a2bc77e62d12d7890a43  Ritemark-x64.dmg
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
