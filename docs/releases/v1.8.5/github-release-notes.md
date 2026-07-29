Ritemark v1.8.5 — parallel agent chats, updated AI runtimes, and a safer update system.

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.5/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.5/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — code-signed (arriving shortly) | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.5/Ritemark-Setup.exe |

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings.

## Highlights

- **Parallel agent chats.** Run several AI conversations at once — each thread gets its own session, visible in the new thread rail on the right edge of the AI sidebar. Switch threads freely while agents keep working; history restores per thread.
- **Updated AI runtimes.** Bundled Claude Code and OpenCode agents upgraded (Claude Code 2.1.217, OpenCode 1.18.4), validated against parallel sessions with a per-runtime compatibility matrix (#146).
- **Claude Opus 5 in the model picker.** The model catalog now includes Anthropic's newest Opus-tier model, alongside Sonnet 5, Fable 5, and Haiku 4.5. Existing installs pick it up automatically via the live model-catalog feed.
- **Agents that know their surroundings.** Agents now receive a capability context describing the Ritemark environment (editor, integrated browser, tools), so they act like Ritemark assistants rather than generic CLIs (#154).
- **Safer update system.** A shell-level watchdog now quarantines a broken extension update and falls back to the built-in copy automatically — the failure mode behind July's `1.8.3-ext.1` incident can no longer strand an installation. In-app extension updates stay disabled until the full lane re-opens.

## Fixes

- **"AI Offline" badge has a "Check again" link** — re-test connectivity on demand instead of waiting for the 30-second poll or restarting (#125).
- **Voice dictation defaults to 5-second chunks**, noticeably improving accuracy for Estonian and other smaller languages; 3s/10s remain selectable (#136).
- **Thread rail icons now use Ritemark's brand indigo** in both light and dark themes.
- *Retro-credit:* chat composer now shows visual feedback when a text/markdown file is attached (#103) — this shipped silently in v1.8.4; release-notes tooling has been fixed so agent-delivered fixes are always credited.

## Notes

- Windows: the v1.8.5 installer is being prepared and will be added to this release; until then the update feed keeps Windows on v1.8.4.
- The `-ext.N` fast-lane for extension-only updates remains closed (#142) until a deliberately trivial extension update passes end-to-end in production on top of this release's safeguards.
