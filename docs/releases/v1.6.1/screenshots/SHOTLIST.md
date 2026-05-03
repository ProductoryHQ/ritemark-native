# v1.6.1 Screenshot Shot List

Date: 2026-05-03  
Purpose: All v1.6.0 screenshots are now visually stale because v1.6.1 ships **Phosphor icon weight 400 (regular)** instead of 100 (thin). Every screenshot showing chrome icons (titlebar, sidebar, toolbars, activity bar, status bar) needs a re-shoot. Plus several new flows (terminal-free sign-in, Codex setup wizard) need first-time captures.

## File naming convention

`v1-6-1-{surface}-{state}.png` (Light theme implied — Dark variants from v1.6.0 are still good)

Examples:

*   `v1-6-1-welcome-page.png`
*   `v1-6-1-ai-sidebar-claude-needs-auth.png`
*   `v1-6-1-mermaid-block.png`

**Theme scope:** Light theme only. Dark theme shots from v1.6.0 are still visually current — Phosphor weight bump is most visible on light theme; dark theme contrast hides the change. Skip Dark re-shoots.

Resolution: 2560×1664 retina (2× of 1280×832) for the landing page; 1440×900 (1× or 2×) for in-doc screenshots. Keep window chrome consistent — same window size across shots so tile layouts read uniformly.

## Setup (do this once before shooting)

1.  Quit any running v1.6.0 Ritemark + dev mode instances.
2.  Install the v1.6.1 arm64 DMG from `dist/Ritemark-1.6.1-darwin-arm64.dmg`.
3.  Theme: pick Ritemark Light by default. Re-do priority shots in Ritemark Dark.
4.  Workspace: open a small repo with realistic file tree depth (the Ritemark Native repo itself works well — has `.md` files, folders, sprint docs).
5.  Disable any third-party extensions you have personally installed (`pencildev`, etc.) to avoid leaking irrelevant UI into shots.
6.  Sign out of both Claude and Codex globally (`claude logout`, `codex logout`) so the "needs-auth" wizard shots can be captured cleanly.

## Priority 1 — Required for landing page + release notes

These are the public-facing visuals. Stale Phosphor weight is most obvious here.

| # | Shot | File name | Why |
| --- | --- | --- | --- |
| 1 | **Welcome page** | `v1-6-1-welcome-page.png` | First thing a user sees on launch. Shows Phosphor 400 in titlebar, activity bar, sidebar tabs. |
| 2 | **Editor with .md file open** | `v1-6-1-editor-md.png` | Hero shot: titlebar + breadcrumbs + file tree + editor + bubble menu. The "writing in Ritemark" frame. |
| 3 | **Activity bar close-up** | `v1-6-1-activity-bar.png` | Verifies Copilot icon is GONE; shows new Phosphor 400 weight on Explorer / Search / Source Control / AI / Robot / Branch / Shield icons. Crop tightly — left strip only. |

## Priority 2 — Required for AI agent docs (`docs/user/features/ai-agents.md`)

Sprint 57 added a unified terminal-free sign-in flow. The doc currently has no screenshots; v1.6.1 is the right moment to add them.

| # | Shot | File name | State to set up |
| --- | --- | --- | --- |
| 4 | **AI sidebar — Claude Setup Wizard (needs-auth)** | `v1-6-1-ai-sidebar-claude-needs-auth.png` | After `claude logout`. Shows "Sign in with Claude.ai" + "Use API key instead" buttons. |
| 5 | **AI sidebar — Claude sign-in progress** | `v1-6-1-ai-sidebar-claude-auth-in-progress.png` | Captured 1-2s after clicking "Sign in" — should show the spinner + "Finish sign-in in your browser" copy. (You may need fast hands or a slow connection.) |
| 6 | **AI sidebar — Claude ready / chat input** | `v1-6-1-ai-sidebar-claude-ready.png` | After successful sign-in. Empty conversation, "Ask Claude…" placeholder, model dropdown showing current model. |
| 7 | **AI sidebar — Codex Setup Wizard (needs-auth)** | `v1-6-1-ai-sidebar-codex-needs-auth.png` | After `codex logout`. Shows "Sign in with ChatGPT" + audited-version notice. New in v1.6.1 — wasn't captured before. |
| 8 | **AI sidebar — Codex chat empty state** | `v1-6-1-ai-sidebar-codex-ready.png` | After Codex sign-in. Shows "Codex Agent" empty state + compatibility notice if version is outside audited range. |
| 9 | **Settings — Claude account connected** | `v1-6-1-settings-claude-connected.png` | Claude.ai shown as auth method, "Sign Out" button visible. |
| 10 | **Settings — ChatGPT account connected** | `v1-6-1-settings-chatgpt-connected.png` | ChatGPT shown as auth method, plan info if available, "Sign Out" button. |

## Priority 3 — Mermaid diagrams (Sprint 56 polish)

Mermaid was the headliner of v1.6.0. v1.6.1 polished margins / toolbar / expand / Save As. Need fresh shots.

Test diagram (paste into a `.md` file):

```
graph TB
    A[Idea] --> B[Outline]
    B --> C[Draft]
    C --> D[Edit]
    D --> E[Publish]
```

| # | Shot | File name | Notes |
| --- | --- | --- | --- |
| 11 | **Mermaid block in editor** | `v1-6-1-mermaid-block.png` | Default rendering inside the editor. Shows the diagram + the new toolbar + correct margins. |
| 12 | **Mermaid expand view** | `v1-6-1-mermaid-expand.png` | Click the expand icon. Shows the diagram in full-width view with the close button. |
| 13 | **Mermaid Save As menu** | `v1-6-1-mermaid-save-as.png` | Toolbar Save As dropdown open, showing PNG / SVG (or whatever the v1.6.1 menu actually offers). Capture the menu, not just the diagram. |
| 14 | **Slash command popup with Mermaid option** | `v1-6-1-slash-mermaid.png` | In the editor, type `/` and capture the popup with the Mermaid entry highlighted. Shows the new Phosphor icon in the slash command list. |

## Priority 4 — Secondary surfaces (nice to refresh, not blocking)

| # | Shot | File name | Notes |
| --- | --- | --- | --- |
| 15 | **Properties side panel** | `v1-6-1-properties-side-panel.png` | Sprint 54 work. If anything visually changed in v1.6.1 (icon weights), refresh. |
| 16 | **Agent Library activity-bar entry** | `v1-6-1-agent-library.png` | Discovered agents from `.claude/` directory listed. New panel from sprint 54. |
| 17 | **File tree with file icons** | `v1-6-1-file-tree-icons.png` | Phosphor 400 weight visible on `file-text`, `folder`, `folder-open`, `file-pdf`, `file-png` etc. |
| 18 | **Settings — full page** | `v1-6-1-settings-full.png` | Full Settings panel scroll captured (2-3 stacked images may be needed). Shows the new "Connected" state + "Refresh Status" button. |
| 19 | **Dictation Settings dialog** | `v1-6-1-dictation-settings.png` | shadcn/ui dialog (sprint memory note about dialog system). Phosphor icons in header. |
| 20 | **Slash command popup (full)** | `v1-6-1-slash-popup-full.png` | Type `/` in editor, capture the entire popup with all entries visible. |

## Where the screenshots end up

*   **Marketing landing page:** copy P1 shots (1-6) and Mermaid expand (16) into `docs-internal/marketing/landing-page/images/v1.6.1/`. Use 2× resolution.
*   **Public release notes (GitHub):** P1 shot 1 (welcome) + P3 shot 14 (Mermaid) embedded inline in `docs/releases/v1.6.1/release-notes.md` — public-friendly subset only.
*   **In-app docs (**`**docs/user/features/ai-agents.md**`**):** P2 shots 7-13. Inline in the doc.
*   **Sprint 56 / Sprint 57 sprint summaries:** P3 shots in 56, P2 + P1 shots 5-6 in 57. Optional, internal record.

## Out of scope (do NOT re-shoot)

*   v1.6.0 marketing screenshots (`docs-internal/marketing/landing-page/images/v1.6.0/*.png`) — keep as historical record.
*   Sprint working-doc screenshots inside `docs/development/sprints/sprint-XX-*/images/`.
*   Anything Windows. Wait until the v1.6.1 Windows installer is built and tested before adding Windows shots to this list.

## Quick-shoot tips

*   macOS screenshot shortcut: `Cmd+Shift+4`, then `Space` to capture a single window with shadow. Hold `Option` while pressing `Space` to drop the shadow. Drop shadow off for landing-page hero; on for in-context shots.
*   Crop activity-bar close-ups to ~96px wide × full window height. This isolates the new icon weight clearly.
*   Keep the same content visible in P1 shots 1-6 if possible (same workspace, same selected file). The eye fixates on the icon weight change rather than content shuffles.
*   Capture at 2× retina, then export to 1× PNG with `sips -Z 1280` if you need a 1× variant. Keep both.

## When done

Save all PNGs into this folder (`docs/releases/v1.6.1/screenshots/`). Once a critical mass exists (P1 + P2 minimum), update:

*   `docs/releases/v1.6.1/release-notes.md` to embed the welcome + Mermaid hero.
*   `docs/user/features/ai-agents.md` to embed the Claude/Codex auth flow shots.
*   `docs-internal/marketing/landing-page/images/v1.6.1/` with the landing page subset.