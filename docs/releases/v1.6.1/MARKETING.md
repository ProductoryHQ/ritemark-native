# v1.6.1 Marketing — Foundation + Polish

**Status:** Released

## One-liner

Ritemark v1.6.1 upgrades to VS Code 1.117.0, makes Mermaid diagrams properly readable, and gives Claude / Codex a terminal-free sign-in flow.

## Social post (short)

Ritemark v1.6.1 is here. VS Code engine jumps to 1.117.0, Mermaid diagrams now render full-width with Copy / Download / Expand-and-zoom, and Claude / Codex sign-in works without ever touching a terminal. Icons got a weight bump for better legibility in light theme. Plus the usual bag of fixes.

![Mermaid diagram with the new toolbar](../screenshots/1-6-1-mermaid-diagram-action-buttons.png)

## Social post (longer thread version)

1/ Ritemark v1.6.1 is out. Three meaningful improvements + a stack of fixes. 🧵

2/ The VS Code engine under the hood jumps from 1.109.5 to 1.117.0 — eight upstream releases rolled up. Better editor performance, updated Electron. All Ritemark patches rebased clean on the new base.

3/ Mermaid diagrams got a real overhaul. Full content-width rendering (no more 680px cap), reduced margins, horizontal scroll for big diagrams, and a new toolbar: Copy image, Download (real OS Save As), and Expand — full-screen with cursor-anchored Cmd/Ctrl+Scroll zoom.

![Mermaid diagram with the new toolbar](../screenshots/1-6-1-mermaid-diagram-action-buttons.png)

4/ Claude / Codex onboarding is friendlier. Sign-in opens your system browser as a background subprocess — no terminal needed. There's a "Use Anthropic API key" alternative if you'd rather paste a key. And the Settings page now reports your auth state truthfully instead of trusting an env var.

5/ Codex sign-in is now unified too — clicking "Sign in with ChatGPT" in the AI sidebar opens your browser instead of dropping you into a terminal. Sign in/out from the AI sidebar or from Settings; both surfaces stay in sync.

![Settings showing both Claude and ChatGPT signed in via the unified browser flow](../screenshots/1-6-1-codex-claude-login-settings.png)

6/ Copilot has been removed. VS Code 1.117 added a Microsoft Copilot first-run wizard that crashed Ritemark prod boot — we patched it out and dropped the bundled Copilot Chat extension entirely. Ritemark uses Claude / Codex / Ritemark Agent. Copilot won't appear anywhere.

7/ Visual refresh: chrome icons (titlebar, sidebar, toolbars, activity bar) bumped from Phosphor weight 100 (thin) to weight 400 (regular). Way more legible in light theme — the hairline-thin strokes no longer wash out.

![Activity bar close-up showing Phosphor 400 weight](../screenshots/1-6-1-activity-bar-closeup.png)

8/ Bug fixes: text selection now visible inside code blocks and table cells, gitignored Explorer entries (`docs-internal/`, `node_modules/`) readable in both light and dark themes, AI Flow file writes route through the proper workspace API, explorer auto-refreshes after agent writes. GH #39 (spdlog x86_64) and GH #41 (JSON LSP startFailed) both fixed.

## Changelog entry

### v1.6.1

- Upgraded VS Code engine from 1.109.5 to 1.117.0 (8 upstream releases)
- Mermaid diagrams now render at full content width with horizontal scroll for oversized diagrams
- Mermaid toolbar: Copy image, Download (OS Save As), Expand with cursor-anchored Cmd/Ctrl+Scroll zoom (0.25×–4×)
- Bundled agent runtime — Claude / Codex CLIs can now ship inside the extension
- Claude sign-in via system browser instead of terminal; Cancel button + 5-min timeout
- Codex sign-in unified — "Sign in with ChatGPT" in AI sidebar opens browser instead of terminal; sidebar and Settings stay in sync
- "Use Anthropic API key" alternative sign-in path with secret storage
- Truthful Claude auth detection (CLI-first, env var demoted to fallback)
- Workspace trust prompt removed at first launch
- Phosphor icon weight bumped from 100 (thin) to 400 (regular) for chrome icons — much better legibility in light theme
- Removed bundled GitHub Copilot Chat extension and patched out the VS Code 1.117 Copilot first-run wizard that crashed prod boot
- Fixed text selection visibility in code blocks and table cells
- Fixed gitignored Explorer entries unreadable in light + dark themes
- Fixed AI Flow file writes by routing through `vscode.workspace.fs`
- Added file explorer auto-refresh after agent writes + manual refresh button
- Fixed `document-header` sentinel hook misfires (replaced with `ai-sidebar`)
- Fixed GH #39 — spdlog x86_64 native module breaking Apple Silicon startup after submodule bump
- Fixed GH #41 — JSON LSP `startFailed` due to stale CJS-compiled `out/` in language-features extensions after upstream ESM flip
- Activity bar: 6px vertical spacing between icons
- Restored Sprint 54 (Agent Library) contributions dropped during patch 002 rebase
- Rebased all 6 Ritemark patches on new VS Code base
