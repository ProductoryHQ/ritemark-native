# v1.7.1 Release Screenshots

Captured 2026-05-13 from Ritemark dev mode (`ritemark-demo` workspace) using the `ritemark-automation` skill.

## Captured (autonomous via CDP)

| File | Shows | Used for |
|------|-------|----------|
| `1-7-1-browser-context-chip.png` | Integrated browser displaying ritemark.app + AI sidebar with `Browser: ...` chip in composer | Sprint 67 baseline that Sprint 69 builds on — proves the read-context is in place before introducing control |
| `1-7-1-html-fixture-direct-render.png` | Clicked an `.html` file from the Explorer → rendered directly in the Browser tab. No text-tab in sight. | Sprint 69 flicker fix — workbench-level editor resolver replaces the old reactive listener |
| `1-7-1-browser-use-consent-dialog.png` | **"Allow AI to control this browser tab?"** dialog — the new Sprint 69 hero shot, distinct from the Sprint 67 read-share prompt | Sprint 69 marquee — proves the dedicated control consent gate fires before any tool call |

## Optional follow-ups (not blocking v1.7.1)

These require interaction inside the AI sidebar webview, which is sandboxed from CDP and cannot be driven via `agent-browser`. They need a live agent session:

| File | Shows | How to capture |
|------|-------|----------------|
| `agent-prompt-typed.png` | Composer with prompt typed but not yet sent | Open AI sidebar → type a prompt → screenshot before pressing Enter |
| `agent-navigated-result.png` | After agent accepted consent: browser tab loaded target page + AI transcript showing `ritemark_browser_navigate` tool call expanded | Click "Allow Control" on consent dialog → wait for agent to complete navigation → screenshot |
| `codex-browser-control.png` | Same as above but with Codex runtime (`ritemark_browser_*` dynamic tools via Codex App Server) | Switch runtime to Codex → repeat the navigate flow |
| `multi-tab-reuse.png` | Two browser tabs open → ask agent to navigate → agent reuses the first tab rather than opening a new one | Illustrates the URL-reuse logic in patch 010 |

## Notes for marketing copy

The shipped screenshots tell two complementary stories:

1. **AI Browser Control (Sprint 69, marquee feature)** — `1-7-1-browser-context-chip.png` for setup, `1-7-1-browser-use-consent-dialog.png` for the consent gate. The hero is the consent dialog: it is what the user sees the first time the AI tries to act on a tab.
2. **HTML opens cleanly in browser (Sprint 69, quality of life)** — `1-7-1-html-fixture-direct-render.png`. The zero-flicker improvement; users on v1.7.0 saw a brief text-editor flash that's now gone.

Sprint 68 carry-over (clipboard, chat history, settings cleanup) is covered in the release notes prose but has no shipped screenshot in v1.7.1.
