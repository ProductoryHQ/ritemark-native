Ritemark v1.8.3 — Comments arrive, plus AI assignment and GPT-5.6.

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.3/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.3/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — code-signed (arriving shortly) | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.3/Ritemark-Setup.exe |

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings.

## Comments
- **Select any text → Comment** for a highlighted anchor plus a Google-Docs-style margin note.
- **Type `///`** for a quick standalone note in the right margin.
- **Mention `@claude`, `@codex`, or `@opencode`** in a comment, then hit **Send to AI** to relay that exact passage to the AI sidebar.
- Comments save into the Markdown file itself, so they persist.

## AI & models
- **GPT-5.6 is now in the Codex model picker** (`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`) — the bundled Codex runtime was upgraded.

## Fixes
- New chats stay as separate History sessions again, instead of collapsing into one (#135).
- Attachment chips are now visible for `.md` / `.txt` files in the AI composer (#103).

## Notes
- **macOS builds (Apple Silicon + Intel) are published now; the Windows installer follows shortly.** Until it lands, Windows stays on the previous version.
- A fast-follow `1.8.3-ext.1` update will fix multi-bullet comments splitting per bullet (#150) and the low-contrast Comment button on hover in dark theme (#151).
