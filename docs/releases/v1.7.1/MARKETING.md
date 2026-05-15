# v1.7.1 Marketing — The AI Can Now Drive the Browser

**Status:** Draft

## One-liner

Ritemark v1.7.1: the AI no longer just reads the page. It can navigate, click, fill forms, and scroll — in the same browser tab you're watching, behind an explicit per-tab consent. v1.7.0 made the AI fluent in two languages at once: prose and rendered HTML. v1.7.1 lets it act on the second half.

## Positioning

**v1.7.0 gave the AI eyes inside the browser. v1.7.1 gives it hands.**

The integrated browser landed in v1.7.0 with a clear boundary: the AI could read the page in the active tab — URL, title, ARIA outline, optional viewport screenshot — but it could not click, type, or navigate. Reading is one consent decision. Acting is another. We deliberately split them across two releases so the consent gate for acting could be designed from scratch, not retrofitted onto the read prompt.

v1.7.1 ships that act layer. Five named tools, narrow on purpose:

-   **navigate** — go to a URL, back, forward, or reload.
-   **click** — by ARIA reference or CSS selector.
-   **fill** — set a form input's value.
-   **type** — send raw keystrokes for editors and hotkeys.
-   **scroll** — bring the next region into view.

The first time the AI tries to use any of them on a tab, a dedicated workbench dialog appears: **"Allow AI to control this browser tab?"** Different wording, different default button, different scope from the read-share prompt. Decline and subsequent tool calls fail safely without re-prompting. Accept and the agent drives the visible tab while you watch — every click, every keystroke, every page change is happening in front of you.

`[screenshot: 03-control-consent-dialog.png — TODO manual capture]`

Same five capabilities work in **Claude Code SDK** and **Codex App Server**. Same consent dialog. Same Playwright-driven action layer underneath. Same "tab stays visible while the agent works" invariant — no headless mode, no off-screen window, no shadow tab.

The feature ships as **experimental, opt-in, macOS only** behind a `browser-agent-control` flag. It is **off by default**. The whole sprint was designed around the assumption that "the AI can now type into your browser" is a sentence that should make a thoughtful person pause — so the default is paused, and turning it on takes an explicit edit to `settings.json`.

## Why this matters now

Agentic browser control isn't a Ritemark invention — it's the direction the whole AI tooling stack is moving. Claude Computer Use sees the screen. Codex CLI has its own browser-action tools. Playwright-driven agents are showing up across the ecosystem.

What's different in Ritemark v1.7.1 is *where* the agent is acting and *what* it can see while it's acting:

-   **The browser is an editor pane.** Not a separate window the agent screen-scrapes. Not a hidden Chromium spawn. The tab the AI controls is the tab you're looking at, in the same workbench that holds your markdown.
-   **The AI sees the page through ARIA, not pixels.** Tools click on what the page semantically *is*, not what it visually appears to be. That's a different, often more reliable, contract than vision-based control — and it pairs naturally with the read-side context the AI already has from Sprint 67.
-   **You see every action in real time.** No headless run, no off-screen replay. The browser tab is on your screen, focused, while the agent works. If something goes wrong, you see it go wrong.
-   **The consent gate is separate.** Reading the page and acting on the page are two distinct decisions. The dialog wording reflects that. You can grant one and not the other.
-   **It's off by default.** Feature flag, experimental status, darwin-only, explicit opt-in. The whole release is designed for users who *want* to try the AI driving their browser — not as a surprise upgrade.

## The two-artifact loop, closed

v1.7.0 made the case for the markdown + HTML workflow: prose in `.md`, executable artifact in `.html`, AI reads both. v1.7.1 closes that loop:

1.  Write the prose in markdown.
2.  Build (or ask the AI to build) an interactive HTML artifact next to it.
3.  Open both in Ritemark.
4.  Ask the AI to verify that the artifact behaves the way the prose claims it does — and let the AI *actually click the buttons and read the result* instead of guessing from the static DOM.

The "does this parameter slider actually do what the documentation says?" question, which used to require you to be the one clicking, is now a question the AI can answer by clicking.

## Who this is for

### Technical writers — proofs that proof themselves

Your `.md` describes how the parameter slider behaves at different values. Your `.html` is the slider. The AI can now read the prose, drive the slider through its range, observe what the page reports back at each step, and tell you whether the documentation matches the implementation. The doc and the demo verify each other.

### Designers — implementation matches spec, automatically

`button-spec.md` describes the component's hover, focus, and disabled states. `button-demo.html` renders the component. The AI can now hover, focus, and disable the demo on its own, observe each rendered state, and check it against the spec. Manual parity audits stop being manual.

### Developers — your localhost is a test surface

`localhost:3000` is already an editor pane in Ritemark. With v1.7.1, the AI can navigate that pane, click through your flows, fill your forms, scroll your lists, and report back what the page says at each step. "Why does the empty-state copy look wrong after I click 'Clear'?" stops being a question that requires you to click 'Clear' yourself.

### Anyone writing AI agent prompts or skills

Sprint 67 already made browser-aware AI a fixture of the sidebar. Sprint 69 lets you write prompts that *exercise* the browser as part of the answer. The next question isn't "can the AI see this page?" — it's "can the AI walk through this flow on my behalf?"

## Consent and privacy

The control consent is intentionally a separate decision from the read consent. Both prompts use distinct wording. Both default to declining. The dialog for control says, in full:

> **Allow AI to control this browser tab?**
>
> The AI agent will be able to navigate, click elements, fill forms, and scroll in this browser tab. You will always see actions happening in real time.
>
> Grant control only for tabs where you trust the AI's actions.

Decline → subsequent tool calls return a typed error without re-prompting. The agent can still *read* the page if read consent was granted.

Accept → control persists for the active tab for the current session. Revoking read consent for that tab automatically revokes control too: you cannot reach a state where the AI can act on a page it cannot see.

## What's also in this release

v1.7.1 bundles three v1.7.0 follow-ups that were originally planned as a Sprint 68 patch:

-   **Chat History shows every conversation.** The history panel was loading exactly once and never refreshing — older conversations were saved correctly but never appeared in the list. Fixed. Workspace scoping is unchanged: conversations from one project still never appear when working in another. `[screenshot: 07-chat-history.png]`
-   **Clipboard works inside the webview.** Copy on code blocks, "Copy as Markdown" in the export menu, and Cmd+C/Cmd+V in table cells were silently failing under the hardened sandbox. All clipboard operations now route through the extension host. Closes [#66](https://github.com/ProductoryHQ/ritemark-native/issues/66).
-   **HTML files open in the browser without flicker.** v1.7.0 opened a text editor and then closed it once a reactive listener noticed and redirected to the browser — visible as a brief flash on every `.html` click. v1.7.1 registers `.html` at the workbench level so the text editor never opens in the first place. Same-URL clicks reuse the existing tab; right-click → **Open as Text** still opens the source. Closes [#63](https://github.com/ProductoryHQ/ritemark-native/issues/63). `[screenshot: 05-html-direct-render.png]`

## What's deliberately *not* in v1.7.1

We shipped the smallest browser-control loop that proves the value. Deferred to follow-up sprints:

-   Cross-origin iframe interaction (Stripe Checkout, OAuth popups, embedded YouTube)
-   Drag-and-drop gestures
-   Raw `run_playwright_code` / general script eval
-   File upload picker handling
-   Multi-tab orchestration (one active tab at a time)
-   Persistent recording / replay
-   Vision-only or coordinate-based clicking — control is ARIA-first

## Social post (short)

Ritemark v1.7.0 let the AI read the page in your integrated browser.

v1.7.1 lets it click, type, and navigate — with a dedicated per-tab consent dialog and an opt-in flag.

The AI no longer just reads your work. It can drive it.

## Social post (thread)

1/ Ritemark v1.7.1 ships today.

v1.7.0 gave the AI eyes inside the integrated browser — read the page, summarize it, screenshot it for visual questions.

v1.7.1 gives it hands.

2/ Five tools, narrow on purpose:
- navigate (URL, back/forward/reload)
- click (by ARIA ref or selector)
- fill (form inputs)
- type (raw keystrokes / hotkeys)
- scroll

Each tool returns the updated page state. The AI sees the result of its own action without an extra read call.

3/ The first time the AI tries to act on a tab, a dedicated dialog appears:

"Allow AI to control this browser tab?"

Separate wording from the read-share prompt. Separate default. Separate scope. Reading the page and typing into the page are two different decisions, and v1.7.1 treats them that way.

4/ Decline → subsequent tool calls return a typed error. The agent can still read the page if you granted read consent. It just cannot act.

Accept → control persists per tab per session. Revoking read consent cascades: you cannot end up in a state where the AI acts on a page it cannot see.

5/ Same five tools work in Claude Code SDK AND Codex App Server.

Same consent dialog. Same Playwright action layer underneath. The tools surface to Claude as `mcp__ritemark_browser__*` (in-process MCP server) and to Codex as `ritemark_browser_*` (experimental `dynamicTools`).

6/ The browser tab the AI controls is the tab you're looking at.

Not a headless Chromium spawn. Not an off-screen window. Not a shadow tab. The agent's cursor moves, the inputs fill, the page changes — and it's all happening on your screen, in real time.

If something goes wrong, you see it go wrong.

7/ Off by default. Experimental flag, darwin-only. To try it, edit settings.json:

`"ritemark.features.browser-agent-control": true`

The whole release is designed for users who *want* to try the AI driving their browser, not as a surprise upgrade.

8/ The two-artifact loop closes here.

v1.7.0: prose in `.md`, executable artifact in `.html`, AI reads both.
v1.7.1: AI clicks the buttons, fills the inputs, walks through the flow, and reports back whether the artifact behaves the way the prose says it does.

The doc and the demo can now verify each other.

9/ Also shipping in v1.7.1:

- Chat History now lists every saved conversation (was showing only the latest)
- Clipboard works inside the webview (code-block copy, export, table cells)
- `.html` files open in the browser without the v1.7.0 text-tab flicker

10/ Ritemark v1.7.1 — out now.

v1.7.0 made the AI fluent in prose and rendered HTML. v1.7.1 takes the question that naturally asks — "if the AI can read the page, why can't it act on the page?" — and answers it carefully.

## Influencer angle / pitch lines

-   *"v1.7.0 gave the AI eyes in your browser. v1.7.1 gives it hands."*
-   *"The AI no longer just reads the page. It can drive the page."*
-   *"Reading the page and typing into the page are two different decisions. v1.7.1 treats them that way."*
-   *"The browser tab the AI controls is the tab you're looking at — not a headless spawn, not a shadow tab. You see every action in real time."*
-   *"Five tools, off by default, darwin-only, experimental. The whole release is designed for users who want this, not as a surprise upgrade."*
-   *"Your `.md` says what the parameter slider does. Your `.html` is the slider. The AI now drives the slider and tells you whether the doc matches reality."*
-   *"Claude Code SDK and Codex App Server. Same five tools. Same consent dialog. Same Playwright layer."*
-   *"Manual parity audits stop being manual. The AI hovers the demo, observes the rendered state, and checks it against your spec."*

## Changelog bullets

-   **AI Agent Browser Control (experimental, darwin-only, opt-in)** — five tools (navigate, click, fill, type, scroll) for both Claude Code SDK and Codex App Server, gated by a feature flag and a dedicated per-tab consent dialog distinct from the v1.7.0 read-share prompt
-   `browser-agent-control` feature flag — set `"ritemark.features.browser-agent-control": true` in `settings.json` to enable
-   Dedicated consent dialog: **"Allow AI to control this browser tab?"** — explicit "Allow Control" / "Cancel"; revoking read consent cascades to control consent
-   Updated ARIA page summary returned after every browser action — the AI sees the result of its own work without an extra read call
-   Claude SDK surfaces tools as `mcp__ritemark_browser__*` via in-process MCP server
-   Codex App Server surfaces tools as `ritemark_browser_*` via experimental `dynamicTools` on `thread/start` (timeout bumped 60s → 120s for the cold-start attach)
-   New VS Code patch: `patches/vscode/010-ritemark-browser-action-bridge.patch`
-   HTML files now open in the integrated browser at the workbench level (no more text-tab flicker on click) — `.html`/`.htm` resolver registered at `default` priority; right-click "Open as Text" preserved
-   Chat History panel now lists every saved conversation, not just the most recent
-   Clipboard operations (Copy button on code blocks, Export → Copy as Markdown, Cmd+C/Cmd+V in table cells) work inside the hardened webview sandbox
-   Removed misleading "Open HTML files in…" Settings dropdown (the wording never matched actual behaviour since Sprint 65)
-   Removed Features section in Settings (flag toggles temporarily move to `settings.json`)
-   Closes [#63](https://github.com/ProductoryHQ/ritemark-native/issues/63), [#65](https://github.com/ProductoryHQ/ritemark-native/issues/65), [#66](https://github.com/ProductoryHQ/ritemark-native/issues/66), [#67](https://github.com/ProductoryHQ/ritemark-native/issues/67)

## Screenshots

### Captured (`screenshots/`)

| File | Use |
| --- | --- |
| `01-browser-context-chip.png` | Sprint 67 baseline — read context working before introducing control. Useful as the "before" frame for the read → act narrative. |
| `05-html-direct-render.png` | HTML file rendering directly in the browser tab from the Explorer. Zero-flicker improvement over v1.7.0. |
| `07-chat-history.png` | Chat History panel empty state — proves the panel renders cleanly when there are no conversations. |
| `08-settings-top.png` | Top of Settings — Appearance, Agent Runtime, Claude API key. Context shot. |
| `08-settings-no-browser-section.png` | Middle/bottom of Settings — no Browser section anywhere. The legacy `htmlDefaultOpener` dropdown is gone. |

### Still to capture — manual (CDP can't reach the AI sidebar webview)

| File | What it shows |
| --- | --- |
| `02-agent-prompt-typed.png` | Composer with a browser-action prompt typed but not yet sent |
| `03-control-consent-dialog.png` | **Hero shot.** "Allow AI to control this browser tab?" dialog — the new Sprint 69 consent gate |
| `04-agent-navigated-result.png` | After accepting consent: browser shows the navigated page, AI transcript shows the tool calls expanded |

Optional bonus:

-   `09-codex-browser-control.png` — same as #04 but with Codex runtime active (proves `ritemark_browser_*` dynamic tools work with Codex App Server)
-   `10-multi-tab-reuse.png` — two browser tabs open; agent reuses the first tab on navigate instead of opening a new one
