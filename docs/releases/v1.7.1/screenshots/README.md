# v1.7.1 Release Screenshots

Captured 2026-05-13 from Ritemark dev mode (`ritemark-demo` workspace) using the `ritemark-automation` skill.

## Captured (autonomous via CDP)

| File | Shows | Used for |
|------|-------|----------|
| `01-browser-context-chip.png` | Integrated browser displaying ritemark.app + AI sidebar with `Browser: ...` chip in composer | Sprint 67 baseline that Sprint 69 builds on — proves the read-context is in place before introducing control |
| `05-html-direct-render.png` | Clicked an `.html` file from the Explorer → rendered Launchpad Dashboard directly in Browser tab. No text-tab in sight. | Sprint 69 flicker fix — workbench-level editor resolver replaces the old reactive listener |
| `07-chat-history.png` | Chat History panel open showing empty state ("No conversations yet. Your chat history will appear here.") | Sprint 68 fix #65 — empty state renders correctly when no conversations exist (before, panel mis-displayed a stale "TODAY" entry) |
| `08-settings-top.png` | Top of Settings: Appearance, Agent Runtime, Claude API key | Context for next shot — to show what's there |
| `08-settings-no-browser-section.png` | Middle/bottom of Settings: Chat Appearance, Updates, Component Readiness. **No "Browser" section anywhere.** | Sprint 69 cleanup — the obsolete `htmlDefaultOpener` legacy dropdown removed; settings page is leaner |

## Missing — need manual capture

These three require interaction inside the AI sidebar webview, which is sandboxed from CDP and cannot be driven via `agent-browser`. They need a live agent session:

| File | Shows | How to capture |
|------|-------|----------------|
| `02-agent-prompt-typed.png` | Composer with prompt typed but not yet sent — e.g. *"Open browser and go to openai.com about Codex"* | Open AI sidebar → type the prompt → screenshot before pressing Enter |
| `03-control-consent-dialog.png` | **"Allow AI to control this browser tab?"** dialog — the new Sprint 69 hero shot | Make sure no browser tab has control consent yet (use a fresh user-data-dir or "Don't ask again" not yet checked) → send any browser-related prompt → dialog appears → screenshot |
| `04-agent-navigated-result.png` | After agent accepted consent: browser tab loaded target page + AI transcript showing "N actions completed" with the `ritemark_browser_navigate` tool call expanded | Click "Allow Control" on consent dialog → wait for agent to complete navigation → screenshot |

**Optional bonus:**

- `09-codex-browser-control.png` — same as #04 but with Codex runtime (showing `ritemark_browser_*` dynamic tools work with Codex App Server too)
- `10-multi-tab-reuse.png` — two browser tabs open → ask agent to navigate → agent reuses the first tab rather than opening a new one (illustrates the URL-reuse logic in patch 010)

## Notes for marketing copy

The screenshots tell three distinct stories:

1. **AI Browser Control (Sprint 69, marquee feature)** — shots 01 → 02 → 03 → 04. Setup → ask → consent → result. This is the v1.7.1 hero story.
2. **HTML opens cleanly in browser (Sprint 69, quality of life)** — shot 05. Mention the zero-flicker improvement; users on v1.7.0 saw a brief text-editor flash.
3. **Settings & chat-history polish (Sprint 68 carry-over)** — shots 07, 08. These were bundled into v1.7.1 since Sprint 68 never shipped as a separate release.

The "Browser is now properly default" (no more "Legacy: Browser default (disabled)" mislabelling) is also a quiet win — shot 08 confirms the legacy UI is gone.
