---
date: '2026-05-11'
title: 'Ritemark v1.7.0 — Markdown for Text. HTML for Where It Clicks. AI for Both.'
author: Jarmo Tuisk
tags:
  - browser
  - in-app-browser
  - browser-aware-chat
  - html-artifacts
  - technical-writing
  - claude
  - codex
  - runtime
  - feature
draft: true
---

# Ritemark v1.7.0 — Markdown for Text. HTML for Where It Clicks. AI for Both.

**Status:** Draft — awaiting build + Jarmo approval
**Type:** Feature release
**Focus:** Markdown is great for prose. But complex ideas — schematics, parameter spaces, "expand this part," visual comparisons — eventually want to live in HTML. v1.7.0 brings the browser inside the editor, so a folder of markdown and a folder of HTML artifacts become one workspace, and the AI can read both.

* * *

## Downloads

| Platform | Download |
| --- | --- |
| macOS Apple Silicon (M1/M2/M3) | [Ritemark-arm64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-arm64.dmg) |
| macOS Intel | [Ritemark-x64.dmg](https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-x64.dmg) |

> Windows: coming as a follow-up asset on the v1.7.0 release.

* * *

## Why This Release

Markdown is, and remains, the right tool for text documents. It is also quietly the new `.docx` for almost everything that used to live in Word — documentation, technical writing, AI prompts, agent instructions, runbooks, design notes. Diffs are readable, agents read and write it, version control is sane.

Ritemark is already best-in-class here: prose, structure, code blocks, and **Mermaid diagrams rendered inline inside the markdown editor** all live in one `.md` file. You do not leave the editor to draw a sequence diagram, a flowchart, or an architecture sketch — and the AI sidebar reads all of it as part of the same document. For 90% of technical writing, this is the whole answer.

The remaining 10% is where ideas genuinely *need* more than static text + a static diagram. A transformer schematic where the reader moves a slider and sees what changes. An SVG that animates with parameters. A side-by-side comparison built as tabs. An "expand for the full derivation" block. These concepts don't compress to ASCII or to a fixed-image Mermaid render — they want to be **executable**.

Technical writers have been quietly working around this for a while: write the prose in `.md`, build a small **HTML artifact** next to it for the interactive part, and ship both. The reader actually gets it. As one Ritemark user put it: *"HTML has become my new PowerPoint, except this time it's executable."*

That two-artifact workflow used to mean two apps: a markdown editor for the text, a separate browser for the artifact, and the AI on the side, blind to the artifact unless you copy-pasted into chat. v1.7.0 collapses it. The browser is an editor pane, the `.html` next to the `.md` opens with one click, and the AI sidebar reads what's in the browser tab the same way it already reads the markdown file you're editing.

**Markdown stays the text language. Mermaid stays the inline-diagram language. HTML is where the complex thing finally clicks.** One app holds all three.

Sprint 65 brought the browser in. Sprint 67 taught the AI to read it. Sprint 66 hardened the runtime underneath. v1.7.1 will build on this with HTML mini-apps generated *inside* Ritemark; v1.7.0 is the foundation that makes that next step coherent.

> Credit where credit is due: the concrete final push for this shape came from a Ritemark user, Dmitri Gridin, asking the right question at the right time — *"does Ritemark support HTML?"*. The use case he described — building interactive HTML artifacts (transformer schematics, parameter sliders, "expand for explanation" blocks) alongside markdown documentation — is exactly the 10% that v1.7.0 makes first-class.

* * *

## What's New

### The Browser Comes In

The web is now part of Ritemark. Open `https://ritemark.app`, your local dev server at `http://localhost:3000`, a `.html` fixture from disk, or a documentation page from a friend — and it renders in a tab next to your markdown, not in a separate window you have to alt-tab back from.

This is not an iframe preview. It's a real Electron `WebContentsView` with its own back/forward/reload history, its own cookies, its own DevTools. External sites that block iframe embedding (Google, GitHub, most banks) just render. Local development at `localhost:*` renders. Workspace `.html` files render with their styles and scripts.

-   **`.html` files open in the browser by default.** Click an `.html` file in the Explorer, in the terminal as a `Cmd+click` on `localhost:5173/...`, or via "Open File…" — it opens as a rendered page. The `Open as Text` command in the file context menu is the escape hatch when you need to edit the markup.

-   **Tabs feel native.** Multiple browser tabs sit in the same tab bar as your markdown files. You can drag them between editor groups, split them, close them with `Cmd+W`. Browser state — URL, scroll, focus — is preserved per tab.

-   **Address bar, back/forward, reload, DevTools.** All the things you'd expect, in the same toolbar style as the rest of the editor. Right-click the page for the usual Chromium context menu.

-   **Terminal `localhost:*` links route to the integrated browser.** `echo http://localhost:3000` and `Cmd+click` opens the URL in a Ritemark browser tab, not your system browser. The dev loop stays inside one app.

The underlying browser stack was already inside VS Code (an experimental feature shipped upstream); v1.7.0 wires it up as a first-class Ritemark editor, removes the older extension-webview iframe path, and brings the Open-in-Browser and "Open as Text" affordances to where you'd expect them.

### AI That Reads What You Read

Open any browser tab. Open the AI sidebar. The chat now has a third context source — *the page you're looking at* — alongside the active markdown file and any path chips you've added.

Ask **"summarize this article,"** **"what does that button do?"**, **"why is the spacing around the title so narrow?"** — and Claude or Codex answers from the page itself, not from a guess at the URL.

How this works:

-   **The first time you focus a browser tab and the AI sidebar is visible, Ritemark asks for consent.** A standard "Share with Agent?" dialog appears. Check **Don't ask again** and future tabs in the session share silently; decline and the AI sees nothing about the page — not even the URL.

-   **A chip appears in the composer.** When a browser tab is in scope, you'll see a globe-icon chip — `Browser: <page title>` — sitting next to the active-file chip. Click the **×** to drop the browser context from a single turn without affecting the next one.

    Two modes are reflected in the chip:

    -   **Normal (gray chip).** The AI receives the page's compact ARIA outline — headings, buttons, links, form labels, visible text — capped at ~12k characters. Good for content questions: "what does this article say?", "what are the links on this page?", "draft a reply to the form."

    -   **Annotation / `· Annotation` (indigo chip).** The AI additionally receives a viewport screenshot. Toggle this on from the **camera icon** in the browser's toolbar, right next to DevTools. Good for visual questions: "is this layout broken on mobile?", "why is the contrast on the badge so low?", "describe the hero image."

-   **Per-turn dismiss.** The chip's × removes browser context for the next message only. The next turn shows the chip again. Useful when one question in a thread is about the document and the next is about the page.

-   **Annotation auto-resets after share.** Toggling annotation enables the screenshot for the active tab; toggling it off drops back to summary-only. Annotation does not silently follow you from tab to tab.

-   **Claude and Codex both see the context.** Same chip, same controls, same prompt block injected into each runtime's turn. (The deprecated "Ritemark Document Agent" runtime is excluded — see Sprint 67 decisions for why.)

#### What this is not (yet)

-   **No autonomous browser control.** The AI reads the page; it does not click, type, or navigate. That stays under your control.
-   **No persistent page history sent to the AI.** Context is current-tab, current-turn. Switch tabs, the previous tab's content stops being shared.
-   **Large pages get truncated.** The summary is capped (12k normal, 24k annotation). Very long documentation pages may be summarized from the top; if the AI asks for more specific content, switch annotation on and ask the question with the visual context included.

### Codex Got Sturdier

The Codex runtime in v1.6.3 worked, but a few edges showed up once people started using it in earnest. v1.7.0 closes those:

-   **System-installed Codex no longer trips the "Some agent features are unavailable" banner.** The compatibility probe used to assume Codex supported a flag that the latest Rust binary had renamed. We now try both shapes and fail safe, so an up-to-date system Codex install reports `Ready` without nag.

-   **"Use system runtime" is a real choice now.** A new **Agent Runtime** section in Settings lets you pick `bundled` (default — Ritemark ships its own Codex/Claude binaries) or `system` (use whatever's on your `PATH`). The Settings page shows the currently active path so you can verify which binary you're actually talking to.

-   **Bundled Codex bumped to the latest upstream stable.** New features, faster, fewer known sharp edges.

-   **Known upstream crash documented.** A `codex_core_skills::manager::ManagerError::Init` error that some users hit on certain repo shapes now has a Settings-side diagnostic note and a `docs/user/known-issues.md` entry explaining the workaround.

* * *

## What's Fixed

-   **Settings: orphaned "AI Model" dropdown removed.** It fed only the legacy Ritemark Document Agent runtime that was retired in v1.6.3. (Issue [#55](https://github.com/ProductoryHQ/ritemark-native/issues/55).)

-   **Settings: dead Features section removed.** Voice Dictation, Ritemark Flows, and Codex Integration toggles in Settings have been removed. The first two were `stable` flags whose toggles did nothing; **Codex Integration** is now promoted from `experimental` to `stable` so it stays on by default. The Codex auth card no longer points at a Features section that no longer exists. (Issue [#56](https://github.com/ProductoryHQ/ritemark-native/issues/56).)

-   **Agent Library: display-name casing preserved.** The library now respects branded casing for shipped agents — **UX Expert**, **PR Reviewer**, **QA Validator**, **VS Code Expert** — instead of lowercasing acronyms ("Ux Expert", "Pr Reviewer", etc.). Custom agents can opt in by adding `displayName:` to the frontmatter. (Issue [#50](https://github.com/ProductoryHQ/ritemark-native/issues/50).)

-   **AI sidebar: missing `globe` icon caused React error #130.** A Sprint 67 spike added the browser chip before the icon was registered. The chip now renders cleanly. (Caught in PR #64 review.)

-   **Browser-aware chat: URL/title no longer leak before consent.** The first version of the consent gate only blocked the page *summary*; URL and title still flowed. Now `buildTurnContext` returns null until `sharedWithAgent === true`, so nothing about the page reaches the AI before you Allow. (Codex review on PR #64.)

* * *

## What Didn't Change

Markdown editing, the file explorer, file watcher, conversation runtime model, agent library, dictation, Settings auth flow — everything outside the new browser surface and the Codex runtime hardening — behaves as in v1.6.3.

A handful of things were considered and deliberately deferred:

-   **AI browser control (click/type/navigate).** Sprint 67 is read + annotate. Drive-the-browser is a separate sprint after the read path settles in real use.
-   **HTML-based mini-apps inside the browser** — artifacts, containers, runtime hooks. Planned as v1.7.1.
-   **Persistent browser session history sent to the AI.** Current-tab, current-turn only.
-   **Per-tab annotation state across sessions.** Annotation resets per tab; not persisted yet.
-   **Windows-specific browser smoke beyond compile checks.** The macOS path is the canonical validation for v1.7.0.

* * *

## Upgrade

Auto-update will offer v1.7.0 to existing v1.6.3 users on next launch. You can also download the DMG directly from the release page. No settings migration is required.

Browser tabs are session-state — nothing is migrated from v1.6.3 (you didn't have any).

The first time you focus a browser tab with the AI sidebar visible, you'll see the **Share with Agent?** consent dialog. This is the same dialog used throughout VS Code's browser stack; **Don't ask again** is per-profile.

* * *

## Technical Notes

For developers and changelog readers.

**Sprints rolled up:**

-   [Sprint 65 — In-app Browser](../../development/sprints/sprint-65-in-app-browser/sprint-plan.md) (PR [#62](https://github.com/ProductoryHQ/ritemark-native/pull/62), merged 2026-05-10)
-   [Sprint 66 — Codex Runtime Hardening + System Runtime Preference](../../development/sprints/sprint-66-codex-runtime-hardening/sprint-plan.md) (commit `dc530ec`)
-   [Sprint 67 — Browser-aware AI Chat](../../development/sprints/sprint-67-browser-aware-ai-chat/sprint-plan.md) (PR [#64](https://github.com/ProductoryHQ/ritemark-native/pull/64), merged 2026-05-11)

**Highlights — In-app browser (Sprint 65):**

-   Pivot from extension-webview iframe to native VS Code `BrowserView` / `WebContentsView` stack already present upstream in `vscode/src/vs/platform/browserView/` and `vscode/src/vs/workbench/contrib/browserView/`.
-   `BrowserHtmlOpenRedirector` (extension-host) routes `*.html` opens into the integrated browser; the source editor stays accessible via the explicit **Open as Text** command.
-   `BrowserHistoryStore` and the `BrowserViewPanel` view (sidebar Recent) preserve cross-session history for re-opening tabs.
-   Terminal localhost link handler routes to `workbench.action.browser.open` instead of `vscode.env.openExternal`.
-   Workspace-scope and ephemeral storage scopes both work; default is workspace for dev tabs.
-   Known follow-up: `BrowserHtmlOpenRedirector` cold-start race tracked as [#63](https://github.com/ProductoryHQ/ritemark-native/issues/63); workaround is close + reopen.

**Highlights — Codex runtime hardening (Sprint 66):**

-   Compatibility probe in `inspectCompatibility` now tries both argv shapes and falls back to optimistic-default on probe failure (fix for #60).
-   Bundled Codex `manifest.json` bumped to latest upstream stable.
-   New config key `ritemark.agentRuntime.preference: 'bundled' | 'system'` — single global preference, wired through `findBinary` (Codex) and `getCandidateClaudePaths` (Claude).
-   Settings page "Agent Runtime" section with two-option dropdown + "Currently active:" path chip.
-   `docs/user/known-issues.md` entry for upstream `codex_core_skills::manager::ManagerError::Init`.

**Highlights — Browser-aware AI chat (Sprint 67):**

-   Workbench bridge (`patches/vscode/009-ritemark-browser-context-bridge.patch`, 401 lines): six new `Action2` commands expose active BrowserView metadata, page summary (via `IPlaywrightService.getSummary` with ARIA `mode: 'ai'`), viewport screenshot (via `BrowserViewModel.captureScreenshot`), and a `setSharedWithAgent` auto-trigger.
-   `IBrowserViewModel` gains a per-tab `annotationMode: boolean` distinct from `sharedWithAgent`, with its own context key and toolbar action ("Include Screenshot in AI Chat Context").
-   `BrowserContextStore` (`extensions/ritemark/src/browser/BrowserContextStore.ts`) tracks per-session `autoSharedPageIds` so the consent prompt fires at most once per tab per session; returns `null` from `buildTurnContext` when `sharedWithAgent === false` (consent boundary — closes the leak Codex review flagged on PR #64).
-   `UnifiedViewProvider` injects the per-turn prompt block into both `_handleAgentExecution` (Claude Code SDK) and `_handleCodexExecution` (Codex), with `skipBrowserContext` plumbing for the chip's × dismiss.
-   Polling for context state is visibility-gated on `webviewView.visible` and cleared on both view-dispose and provider-dispose to avoid stale-view IPC calls.
-   Locked decisions D1–D9 in the sprint plan: D8 (Option B — two-state) + D8 addendum (auto-share on chip-visibility) are the core UX contract.

**Upgrade notes:** No breaking changes. No new runtime dependencies. The `patches/vscode/009-…` patch applies cleanly on top of patches 001–008. Workbench `out/` requires re-transpile on first dev build after pulling v1.7.0 source.

* * *

## Sprints Rolled Up

-   **Sprint 65** — In-app Browser (user-facing)
-   **Sprint 66** — Codex Runtime Hardening + System Runtime Preference (user-facing)
-   **Sprint 67** — Browser-aware AI Chat (user-facing)

Plus a handful of housekeeping items from the deferred v1.6.4 draft: Settings cleanup ([#55](https://github.com/ProductoryHQ/ritemark-native/issues/55), [#56](https://github.com/ProductoryHQ/ritemark-native/issues/56)), agent display-name casing ([#50](https://github.com/ProductoryHQ/ritemark-native/issues/50)), cross-platform pre-commit validator.

* * *

The browser was always going to come in. The question was whether to ship it as a viewer or as something the AI could actually read. v1.7.0 ships it as both — and sets up v1.7.1, where the same surface starts hosting HTML-based mini-apps.
