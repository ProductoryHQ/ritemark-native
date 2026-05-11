# v1.7.0 Marketing — Markdown for Text. HTML for Where It Clicks. AI for Both.

**Status:** Draft

## One-liner

Ritemark v1.7.0: still the best markdown editor for technical writing — with Mermaid rendered inline — and now, when an idea genuinely needs an interactive surface, your local HTML artifact opens as an editor pane next to the markdown, and the AI reads both.

## Positioning

Markdown is the right tool for text. It is the new `.docx` for documentation, technical writing, AI prompts, runbooks — and Ritemark is already best-in-class for it: prose, structure, code, and **Mermaid diagrams rendered inline inside the markdown editor** all live in one `.md` file the AI reads as one document. For 90% of technical writing, this is the whole answer.

The remaining 10% is where ideas genuinely *need* an interactive surface. A schematic with a parameter slider. An SVG that animates. A tab view comparing two states. An "expand for the full derivation" block. These don't compress to ASCII or to a static image — they want to be **executable**.

Technical writers have been quietly working around this for a while: write the prose in `.md`, build a small **HTML artifact** next to it for the interactive part, and ship both. As one Ritemark user put it: *"HTML has become my new PowerPoint, except this time it's executable."*

That two-artifact workflow used to mean two apps — markdown editor and a separate browser, with the AI blind to the artifact unless you copy-pasted into chat. v1.7.0 collapses it. The browser is an editor pane. The `.html` next to the `.md` opens with one click. The AI reads both. v1.7.1 will bring HTML mini-apps generated *inside* Ritemark; v1.7.0 is the foundation.

**Markdown stays the text language. Mermaid stays the inline-diagram language. HTML is where the complex thing finally clicks.** One app - Ritemark - holds all three.

**Why this matters now:**

-   The 10% case is happening more often: individual technical writers are already manually building executable HTML alongside their markdown. v1.7.0 makes the workflow first-class instead of a workaround.
    
-   Writing apps don't know what's on your screen. Ritemark does — and it asks consent before sharing the page with the model.
    
-   Agentic workflows already touch the browser (Claude Computer Use, Codex CLI sessions). Ritemark gives them a first-class, consented, read-aware surface inside the same app you write in.
    
-   "Ask AI about this page" used to mean copy-paste-into-chat. v1.7.0 makes it a chip in the composer.
    

The concrete final push came from a friend, **Dmitri Gridin**, asking directly: *"does Ritemark support HTML?"*. The screenshot below is one of his HTML artifacts — an interactive transformer schematic with parameter sliders, sitting alongside markdown documentation. v1.7.0 enables exactly this workflow natively.

![](./images/image-1778509144989.png)

## Social post (short)

Ritemark v1.7.0: still the best markdown editor for technical writing — Mermaid renders inline, structure stays in `.md` — and when you genuinely need an interactive surface, your local `.html` artifact opens next to it and the AI reads both.

## Social post (thread)

1/ Ritemark v1.7.0 ships today. The headline: markdown stays the right answer for text — Mermaid still renders inline in the editor — and when you need an interactive surface, HTML now opens as an editor pane next to it.

2/ This started with one observation from a real user: technical writers are already manually building HTML artifacts alongside their markdown docs. Interactive schematics, parameter sliders, SVG diagrams — *"HTML has become my new PowerPoint, except executable."*

3/ Most technical writing doesn't need this. Prose + Mermaid in one `.md` file is genuinely the right answer for 90% of cases — and Ritemark has been best-in-class there since v1.0.

4/ The 10% is the cases where an idea wants to be *clickable*: move a slider, toggle a tab, expand a derivation, watch an SVG animate. That's HTML. v1.7.0 makes the HTML next to your markdown a first-class editor pane.

5/ Bigger change: the AI now reads the page in the browser tab. Open a tab, open the chat, ask anything about the artifact. Claude or Codex answers from the actual content YOU just authored, not from a guess at the filename.

6/ Consent stays explicit. First time per session, "Share with Agent?" prompt fires. Decline = nothing leaks (not even the URL). Allow = compact page summary flows to the next turn.

7/ Screenshot is opt-in. Camera icon in the browser toolbar adds a viewport screenshot for visual questions ("why is this layout broken?", "what colour is the badge?", "describe the schematic state at these slider values").

8/ One chip in the composer. Globe icon, page title, × to drop context for one turn. Indigo when annotation (screenshot) is on.

9/ The browser comes from Sprint 65. The AI reading it comes from Sprint 67. Sprint 66 hardened Codex underneath both — system-runtime preference for power users.

10/ Next stop, v1.7.1: HTML mini-apps generated *inside* Ritemark — artifacts the AI builds for you, sitting in the same browser surface. v1.7.0 is the foundation.

## Influencer angle / pitch lines

-   *"Markdown for text. Mermaid for diagrams in the markdown. HTML for where the complex thing finally clicks. v1.7.0 puts all three in one editor."*
    
-   *"Still the best markdown editor for technical writing — and now it also opens the HTML artifact next to your* `.md` *as a real editor pane."*
    
-   *"Mermaid handles the static diagrams. HTML handles the parameter sliders. v1.7.0 makes neither one a separate app."*
    
-   *"Technical writers have been building executable HTML alongside their markdown. Ritemark just made that one app."*
    
-   *"Your local HTML artifacts are now first-class. And the AI can read them."*
    
-   *"Stop copy-pasting URLs into ChatGPT. Open the page, ask the question."*
    
-   *"Claude Computer Use sees the screen. Ritemark sees the markdown AND the HTML artifact YOU just authored. Different problem, cleaner solution."*
    

## Changelog bullets

-   Markdown + local HTML artifact workflow in one editor — `.html` files open as rendered pages alongside `.md` files in the same tab bar
    
-   In-app browser (Electron BrowserView) — external sites, localhost, workspace `.html`, with back/forward, reload, DevTools, history
    
-   Terminal `localhost:*` links route to the integrated browser
    
-   `.html` opens in the browser by default; "Open as Text" remains an explicit option
    
-   Browser-aware AI chat: Claude + Codex receive page URL/title + ARIA summary on every turn (when shared)
    
-   Per-turn dismiss chip in the composer
    
-   Annotation toggle (camera icon) adds viewport screenshot for visual questions
    
-   Consent boundary: nothing leaks until the user accepts "Share with Agent?"
    
-   Codex runtime hardening: system-runtime preference, compatibility probe fix, manifest bump
    
-   Settings page cleanup: orphaned dropdowns and dead toggles removed; Codex Integration promoted to `stable`
    
-   Agent Library: branded casing preserved (UX Expert, PR Reviewer, QA Validator, VS Code Expert)
    
-   Cross-platform pre-commit validator (Linux + macOS)
    

## Screenshots to capture

-   **Hero shot:** a `.md` document open side-by-side with a local `.html` artifact (e.g. interactive schematic, parameter playground) — the "markdown for text, HTML for where it clicks" workflow in one app
    
-   AI sidebar answering a content question about the active HTML artifact (chip visible)
    
-   Browser toolbar with the camera (annotation) icon highlighted
    
-   Indigo chip showing `Browser: <title> · Annotation`
    
-   Browser tab open at `https://ritemark.app/en/`
    
-   Settings page "Agent Runtime" dropdown
    
-   `Share with Agent?` consent prompt