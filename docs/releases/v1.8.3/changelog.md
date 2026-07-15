## [1.8.3] - 2026-07-15

### Added
- **Comments — annotate any passage without touching the prose (Sprint 94, #81).** Select text and click **Comment** to get a highlighted anchor plus a Google-Docs-style margin note; type `///` for a quick standalone right-margin note. Comments round-trip through the Markdown file (stored as `<mark data-comment>` / HTML comments), so they persist across saves and reopens
- **Assign a commented passage to an AI agent (Sprint 94, #81).** Mention `@claude`, `@codex`, or `@opencode` inside a comment and a **Send to AI** button appears that relays the commented context and your note into the AI sidebar for that runtime
- **GPT-5.6 models now available in Codex (Sprint 96, #146).** Bundled Codex runtime upgraded 0.135.0 → 0.144.4, so the new `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` models appear in the Codex model picker; previously the newest models didn't show because the bundled runtime predated them

### Fixed
- **New chats stay as separate History sessions again (Sprint 95, #135).** Starting a new chat had collapsed previous conversations into a single History entry; each chat is now correctly kept as its own separate History entry
- **Attachment chips are visible for text/Markdown files (Sprint 95, #103).** Attaching a `.md` or `.txt` file in the AI composer used to render an invisible chip; it now shows a clear file chip with icon and extension
- **Seamless extension-update mechanism fixed (#142).** Repaired the in-app extension-update path so future lightweight updates actually load; infrastructure only, not user-visible, and the enabler for the upcoming `1.8.3-ext.1` updates

### Notes
- Fully cross-platform and live: macOS (Apple Silicon + Intel, Apple-notarized) and Windows (x64, Authenticode-signed via Azure Trusted Signing). The update feed serves v1.8.3 to both macOS and Windows.
- A fast-follow `1.8.3-ext.1` extension update will address two known Comments issues without a full reinstall: multi-bullet comments splitting per bullet (#150) and the low-contrast Comment button label on hover in dark theme (#151).
