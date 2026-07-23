Ritemark v1.8.4 — comment fixes + update-system repair.

> [!IMPORTANT]
> **Did your app break after an in-app update between July 17–20?** Installing v1.8.4 over your current app fixes it automatically — the broken update is superseded and cleaned up on first launch. Details: [issue #1](https://github.com/jarmo-productory/ritemark-public/issues/1).

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.4/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.4/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — code-signed (arriving shortly) | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.4/Ritemark-Setup.exe |

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings.

## Fixes

- **Commenting across multiple bullets or paragraphs now creates ONE comment** spanning the whole selection, instead of one per block (#150). Editing, deleting, and Send-to-AI act on the whole comment.
- **The Comment toolbar button is readable on hover in dark theme** (#151).
- **Update-system repair:** the faulty `1.8.3-ext.1` extension update (withdrawn) is automatically superseded and removed when v1.8.4 first launches. In-app extension updates remain disabled until the packaging fix and a shell-level safeguard ship.

## Notes

- Comments, AI assignment, and GPT-5.6 support arrived in [v1.8.3](https://github.com/jarmo-productory/ritemark-public/releases/tag/v1.8.3) — v1.8.4 is a small follow-up on top of it.
