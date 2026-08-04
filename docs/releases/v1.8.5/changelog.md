## [1.8.5] - 2026-07-29

### Added
- **Parallel agent chats (Sprint 99).** The AI sidebar now holds multiple independent conversations at once, each with its own session, laid out in a new **thread rail** on the right edge. Switch threads freely while agents keep working; responses land in the thread that asked and history restores per thread. A thread cap keeps resource use in check, and runtime (Claude/Codex/OpenCode) is selectable per thread
- **Claude Opus 5 in the model picker.** Anthropic's newest Opus-tier model now appears in the Claude section (between Sonnet 5 and Opus 4.8); existing installs pick it up automatically via the live model-catalog feed
- **Agent capability context (Sprint 101, #154).** Every agent run now starts with a short system description of the Ritemark environment (Markdown editor, integrated browser, available tools), so agents behave like Ritemark assistants instead of generic CLIs; prompt-injection safety is unchanged
- **`ritemark.updates.channel` setting (Sprint 98).** New update-channel setting (defaults to `stable`) plus a copy-then-overlay installer, laying groundwork for the lightweight update lane's return (#142)

### Changed
- **Bundled AI runtimes upgraded (Sprint 100, #146).** Claude Code → 2.1.217 and OpenCode → 1.18.4, re-validated specifically against parallel sessions with a per-runtime compatibility matrix
- **Voice dictation default chunk is now 5 seconds (#136).** Moved from 3s to 5s to improve transcription accuracy for Estonian and other smaller languages; 3s and 10s remain selectable in Dictation Settings

### Fixed
- **"AI Offline" badge now has a "Check again" link (#125).** Re-test connectivity on demand — a brief "Checking…" state — instead of waiting out the 30-second poll or restarting the app
- **Thread-rail robot icons use Ritemark's brand indigo** in both light and dark themes, instead of picking up per-runtime brand colors
- **Safe extension-update lane — shell watchdog (Sprint 98, patch 012, #142).** On activation failure, Ritemark quarantines a broken user-directory copy of the extension and falls back to the bundled built-in copy automatically, so a bad extension update can no longer strand an installation

### Notes
- Live on macOS (Apple Silicon + Intel, Apple-notarized). The Windows (x64, code-signed) installer is being prepared and will be added to this release shortly; until then the update feed keeps Windows on v1.8.4.
- The `-ext.N` fast-lane for extension-only updates stays closed (#142) until a deliberately trivial extension update passes end-to-end in production on top of this release's safeguards. Full app (DMG) updates are unaffected.
- Retro-credit: the chat composer's attachment-chip visual feedback (#103) shipped in v1.8.4 but was missed in that release's notes; recorded here.
