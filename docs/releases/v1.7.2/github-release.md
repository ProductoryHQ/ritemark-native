# Ritemark v1.7.2 — Link any file, restructure from the outline, leaner AI runtime

v1.7.2 sharpens the everyday Markdown loop and tidies the AI sidebar. Type `@` to link any file in your workspace, Cmd-click to follow those links, and change heading levels straight from the Table of Contents — all without leaving the keyboard. The AI sidebar now shows clearer model and runtime information, and a round of cleanup removed two unused subsystems so the app is leaner.

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |

> **Windows:** The Windows installer is **coming shortly** and will be added to this same release page as a follow-up asset (no version bump, no new tag). The macOS Apple Silicon build is notarized and ready to install.

## What's new

**Type `@` to link any local file.** Anywhere in a document, type `@` and a search picker opens at the cursor. Filter by filename, press Enter, and Ritemark inserts a Markdown link with the correct relative path. The Add Link dialog (Cmd+K) understands the same `@`-syntax.

**Cmd-click to follow links.** Cmd-click (Ctrl-click on Windows/Linux) an internal Markdown link to open it as a Ritemark document. PDFs, images, CSVs, and source files open through VS Code's default opener; external URLs open in your browser. Links that point outside the workspace, or to missing files, surface a non-blocking notification instead of failing silently.

**Heading levels from the Table of Contents.** Right-click any TOC row for an H1–H6 menu, or press `⌥⌘1-6` (`Ctrl+Alt+1-6` on Windows/Linux). The change is a single undo step and your scroll position stays put.

**Clearer AI model and runtime info.** The model picker shows real available models as readable two-line rows with a proper scrollbar; Settings reports the actual Claude (CLI + SDK) and Codex runtime versions instead of guessing from a manifest.

## Cleanup

Pure subtraction — Claude Code, Codex, Flows, API-key config, and saved conversations are untouched.

- **Legacy Agent runtime removed.** The deprecated direct-OpenAI/Gemini chat runtime is gone; the selector now offers only Claude Code and Codex. Previously saved Legacy Agent conversations still open read-only.
- **Document search (RAG) removed**, along with its `@orama/orama` dependency — it was no longer a product feature but still shipped with every build.
- **Windows packaging fix.** Unused AI SDK peer dependencies that had leaked into the production tree are now stubbed, so the Windows installer build packages cleanly again. This is what makes the forthcoming Windows asset possible.

## Upgrade

Auto-update will offer v1.7.2 to existing macOS users on next launch, or download the DMG directly above. No settings migration is required.

---

Full release notes: see `docs/releases/v1.7.2/release-notes.md` in the repo. Per-platform test checklist: `docs/releases/v1.7.2/TEST-CHECKLIST.md`.

Closes #79 (TOC heading-level changes) and #80 (`@`-mention local file links). Defers #81 (Markdown comment callouts).
