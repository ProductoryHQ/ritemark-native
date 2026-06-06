# Social Media Copy — Ritemark v1.7.3

## Twitter/X — short post

Your AI agents used to be invisible — config buried in hidden folders, edited as raw YAML.

Ritemark v1.7.3 makes them first-class. Browse them in the Agent Library, configure them in a visual panel (no YAML), and bring your own key with a third runtime, OpenCode.

Agents you can finally see.

---

## Twitter/X — thread

1/ This is an AI release.

For a while now, your AI agents have been real but invisible — markdown files in `.claude/agents/`, configured by hand-editing a block of YAML you had to remember the shape of.

Ritemark v1.7.3 makes agents something you can see, organize, and choose between.

---

2/ The Agent Library (robot icon, left sidebar) puts everything AI-related in one place:

Instructions (CLAUDE.md / AGENTS.md) · Agents · Skills · Commands · Flows

Collapsible sections, Project/User scope, search, sort, create, and full row actions. Keep open only what you actually work with.

---

3/ Open an agent and the Agent Configurator opens beside it.

Description, Model, a Tools allow-list (least privilege by design), Skills, and Advanced — all editable visually. It's built on the real Claude Code agent format, so what you configure is exactly what the runtime reads. Zero YAML.

---

4/ New: a third AI runtime — OpenCode, bring-your-own-key.

Claude Code and Codex use their own sign-in. OpenCode points at any provider you already have a key for — add a Google AI key and Gemini shows up, add OpenAI and you get GPT, and so on. New OpenRouter key field in Settings too.

---

5/ When OpenCode wants to edit a file, you get a single File Change Approval card with the target path. The file on disk is untouched until you Approve. Out-of-workspace writes are rejected automatically. Want it hands-free? Flip Auto-approve in Settings → OpenCode.

---

6/ Agents can now re-observe the browser.

New `browser_snapshot` tool returns the current page's accessibility outline — without re-navigating and losing page state. Read-only and consent-aware: it only works on tabs you've shared, and an unshared tab leaks nothing. Works for both Claude Code and Codex.

---

7/ And when annotation mode is on, the composer shows a live screenshot thumbnail of the page — not a misleading URL chip. It previews exactly what the AI will see, and refreshes as you scroll.

---

8/ Two daily-friction fixes:

- The composer no longer locks mid-run. Type a follow-up while the agent works and it queues, then auto-sends.
- Plan approval actually works now — the card shows the full plan and the Approve button does what it says.

---

9/ Plus polish: the Edit Link dialog can finally change a link's text (not just its URL), and short code blocks no longer show a phantom horizontal scrollbar.

---

10/ Ritemark v1.7.3 — out now on macOS (Apple Silicon + Intel, notarized) and Windows.

Agents you can see, configure without YAML, and pick a runtime for. Plus browser eyes.

---

## LinkedIn

**Ritemark v1.7.3: your AI agents are finally something you can see.**

Ritemark has had custom AI agents for a while — but they were effectively invisible: markdown files tucked into hidden `.claude/` folders, configured by hand-editing a block of YAML. Powerful, but not something you'd browse or reason about.

v1.7.3 changes that. This release is about making AI agents first-class.

**The Agent Library** (robot icon in the left sidebar) gathers everything AI-related — Instructions (CLAUDE.md / AGENTS.md), Agents, Skills, Commands, and Flows — into one place, with collapsible sections, Project/User scope, search, and sort.

**The Agent Configurator** opens beside any agent file: edit the Description, Model, a Tools allow-list (least privilege by design), Skills, and advanced options visually. It's built on the real Claude Code agent format, so what you configure is exactly what the runtime reads — no YAML required.

**A third runtime — OpenCode, bring-your-own-key.** Alongside Claude Code and Codex, OpenCode lets you point at any provider you already have a key for and pick that provider's models. Add a Google AI key and Gemini appears; add OpenAI and you get GPT. There's a new OpenRouter key field too, and a File Change Approval card so the AI never touches a file on disk until you approve.

**Browser eyes for agents.** A new `browser_snapshot` tool lets the AI re-observe a page's accessibility outline without re-navigating — read-only and consent-aware. And when annotation mode is on, the composer shows a live screenshot thumbnail of exactly what the AI will see.

Two friction fixes round it out: the composer no longer locks while an agent runs (your next prompt queues and auto-sends), and plan approval reliably shows the full plan and actually approves.

Out now on macOS (Apple Silicon + Intel, notarized) and Windows.

Agents you can see, configure without YAML, and choose a runtime for.

---

## Hashtags

#Ritemark #Markdown #AIAgents #AITools #ClaudeCode #Codex #OpenCode #Writing #Productivity
