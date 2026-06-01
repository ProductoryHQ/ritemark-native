## [1.7.2] - 2026-06-01

### Added
- Type `@` anywhere in a Markdown document to open a file-search picker and insert a link to any file in the workspace, with the correct relative path and the basename as the visible text
- The Add Link dialog (Cmd+K) understands the same `@`-syntax, so inline and dialog link-insertion behave identically
- Cmd-click (Ctrl-click on Windows/Linux) follows internal links: Markdown targets open as Ritemark documents; PDFs, images, CSVs, and source files open via VS Code's default opener; external URLs open in the system browser
- Change a heading's level directly from the Table of Contents — right-click any TOC row for an H1–H6 menu, or press `⌥⌘1-6` (`Ctrl+Alt+1-6` on Windows/Linux); the change is a single undo step and scroll position is preserved
- A small `↗` open icon in the Edit Link dialog opens the current link target (internal or external) without dismissing the dialog

### Changed
- AI model picker now shows real available models as two-line rows (model/version + short purpose line), with a constrained height, a thin vertical scrollbar for long lists, and pointer-cursor rows
- Settings now reports real AI runtime versions: Claude shows CLI + SDK version in one chip; Codex reports its app-server version read from the runtime (`--version`) rather than from a manifest

### Removed
- The deprecated "Legacy Agent" chat runtime (direct OpenAI/Gemini) — the agent selector now offers only Claude Code and Codex; previously saved Legacy Agent conversations still open read-only
- The unused document-search (RAG / vector-index) subsystem and its `@orama/orama` dependency — no citation chips, re-index affordance, or index footer remain in the sidebar
- The unused header-dropdown Table of Contents variant (dead code since the Sprint 51 inline-TOC redesign)

### Fixed
- Windows installer build no longer fails during packaging (`EMFILE`) — unused AI SDK peer dependencies that had leaked into the production tree are now stubbed, so the Windows build packages cleanly
- `@`-picker search reaches all workspace files (an earlier allowlist had hidden source/config files such as `.js` from results); heavy/generated folders like `node_modules`, `.git`, `dist`, and build outputs remain excluded

### Notes
- macOS Apple Silicon (arm64) DMG is notarized and available. The Windows installer is coming shortly as a follow-up asset on the same release page (no version bump, no new tag).
