# In-app Browser

> Available since v1.7.0

Ritemark includes a built-in browser that lets you open local `.html` files, `localhost` development servers, and external websites directly inside the editor — in the same tab bar as your markdown files.

---

## Opening pages

**Local HTML files:** click any `.html` file in the Explorer and it opens as a rendered page. To edit the HTML source instead, right-click the file and choose **Open as Text**.

**Localhost:** `Cmd+click` (macOS) or `Ctrl+click` (Windows/Linux) on any `localhost:*` link in the terminal opens it in the integrated browser instead of your system browser.

**Any URL:** use **File → Open URL** or the address bar at the top of an open browser tab.

---

## Browser controls

The browser toolbar (visible inside a browser tab) provides:

| Control | What it does |
|---------|--------------|
| Back / Forward | Navigate page history |
| Reload | Reload the current page |
| Address bar | Shows the current URL; click to type a new one |
| DevTools | Opens Chromium DevTools for the current page |
| Camera icon | Toggle annotation mode — adds a viewport screenshot to the next AI turn |

---

## Browser tabs

Browser tabs behave like editor tabs:

- Drag to reorder or move between editor groups
- Split with the usual split-editor commands
- Close with `Cmd+W` / `Ctrl+W`
- Multiple browser tabs can be open at once

---

## AI and the browser

When a browser tab is active and the AI sidebar is open, the AI can read the page you're looking at.

### Consent

The first time per session that you ask a question with a browser tab in context, Ritemark shows a **"Share with Agent?"** prompt.

- **Allow** — page URL, title, and a compact ARIA outline (headings, buttons, links, form labels, visible text) flow to the AI on every turn while the tab is shared.
- **Decline** — nothing about the page reaches the AI: not the URL, not the title, not the DOM.

Check **Don't ask again** to skip the prompt for future tabs in the same session.

### The browser chip

When a browser tab is sharing context with the AI, a chip appears in the chat composer:

- **Gray chip** — the AI receives the page's text summary (ARIA outline, ~12k characters).
- **Indigo chip** — annotation mode is on; the AI additionally receives a viewport screenshot.

Click the **×** on the chip to drop browser context for the next message only. The chip reappears on the following turn.

### Annotation mode

Toggle the **camera icon** in the browser toolbar to include a viewport screenshot in the next AI turn. Use this for visual questions:

- "Why is the layout broken at this width?"
- "What does the schematic show at these slider values?"
- "Is the contrast on this badge sufficient?"

Annotation resets after each turn — you toggle it on for the questions that need it.

### What the AI does not do (by default)

- The AI reads the page. It does not click, type, or navigate on your behalf — unless you explicitly opt in to **AI Browser Control** (see below).
- Context is current-tab, current-turn. Switching tabs stops sharing the previous tab's content.
- Very long pages are summarized from the top (~12k characters normal, ~24k with annotation). For deep content, scroll to the relevant section and ask again, or use annotation to include a screenshot.

---

## AI Browser Control

> Available since v1.7.1 — **experimental, opt-in, macOS only.**

The AI sidebar can also *act* on the integrated browser, not just read it. Five tools — `browser_navigate`, `browser_click`, `browser_fill`, `browser_type`, `browser_scroll` — let the AI drive the active browser tab while you watch.

This is **off by default.** The whole feature is gated by a feature flag, by a dedicated per-tab consent dialog, and by an ARIA-first action layer that always operates on the visible, focused browser tab — there is no headless mode, no off-screen browser, and no shadow tab.

### Turning it on

Open Settings (Cmd+,) → **Open Settings (JSON)** and add:

```json
{
  "ritemark.features.browser-agent-control": true
}
```

Then restart Ritemark. The AI sidebar reads feature flags only at session creation time.

The feature is currently macOS-only. Windows and Linux are not supported in v1.7.1.

### The control consent dialog

The first time the AI tries to act on a browser tab, Ritemark shows a dialog distinct from the read-share prompt:

> **Allow AI to control this browser tab?**
>
> The AI agent will be able to navigate, click elements, fill forms, and scroll in this browser tab. You will always see actions happening in real time.
>
> Grant control only for tabs where you trust the AI's actions.
>
> **[Allow Control]    [Cancel]**

- **Allow Control** — the AI can drive this tab for the rest of the session. Subsequent tool calls execute silently without re-prompting.
- **Cancel** — subsequent tool calls return a typed error to the agent. The next call does **not** re-prompt. Read context (URL, title, summary, screenshot) is unaffected.

Read consent and control consent are tracked separately. Revoking the read-share for a tab also revokes its control consent — you cannot end up in a state where the AI acts on a page it cannot see.

### What the tools do

| Tool | What it does |
|------|--------------|
| `browser_navigate` | Go to a URL, or back / forward / reload. If no browser tab is open, auto-creates one; if a tab exists, reuses the first one rather than opening a new tab for every navigation. |
| `browser_click` | Click an element identified by ARIA reference or CSS selector. |
| `browser_fill` | Set the value of a form input. |
| `browser_type` | Send raw keystrokes or key combinations to the focused element (for rich-text editors, hotkey flows, search-as-you-type). |
| `browser_scroll` | Scroll the page to bring a target region into view. |

Every tool returns the updated ARIA page summary after acting, so the AI sees the result of its own action without spending another round-trip asking what changed.

### How each runtime sees the tools

Same five capabilities, two protocols:

- **Claude Code SDK** — tools appear as `mcp__ritemark_browser__browser_navigate`, `mcp__ritemark_browser__browser_click`, etc. Implemented as an in-process MCP server.
- **Codex App Server** — tools appear as the bare names `ritemark_browser_navigate`, `ritemark_browser_click`, etc., attached via the experimental `dynamicTools` parameter on `thread/start`. Cold-start can take up to 120 seconds for Codex when dynamic tools are active.

The consent dialog, the Playwright action layer, and the page-summary readback are identical across both runtimes.

### What AI Browser Control is *not*

The v1.7.1 release is intentionally narrow. The following are **not** supported and are not planned for the initial release:

- **Cross-origin iframes** — embedded YouTube, Stripe Checkout, OAuth popups inside an iframe.
- **Drag-and-drop** — gesture-based file uploads, sortable lists.
- **Raw script execution** — no `run_playwright_code` / general `eval` escape hatch.
- **File upload picker handling** — `<input type="file">` interactions.
- **Multi-tab orchestration** — the AI drives a single active tab at a time.
- **Persistent recording / replay** — actions are not recorded for later re-execution.
- **Coordinate-based or vision-only clicking** — control is ARIA-first.

These are tracked as candidates for future sprints.

### When the AI cannot act

- **No active browser tab** — the AI receives a typed error ("No active integrated browser tab.") and reports it to you. No crash.
- **Feature flag off** — the tools are not registered with either runtime. The AI doesn't know they exist.
- **Control consent declined** — subsequent tool calls fail with a "Browser control consent was not granted" error until you grant consent for that tab.
- **Read consent revoked** — control consent is revoked too. The agent will be prompted again on its next action.

---

## Privacy

- Nothing about the page reaches the AI until you accept "Share with Agent?"
- Annotation (screenshot) is a separate, explicit opt-in — the camera icon must be toggled on.
- **AI Browser Control** is off by default. Enabling the `browser-agent-control` flag is the first opt-in; the per-tab "Allow AI to control this browser tab?" dialog is the second.
- Read consent and control consent are tracked separately. Revoking read consent for a tab also revokes its control consent automatically.
- Consent is per-tab, per-session. It does not persist across Ritemark restarts.

---

## Related

- [AI Agents](ai-agents.md) — Claude, Codex, and how to switch between them
- [Set Up AI](../setup-ai.md) — configure AI and agent runtimes
