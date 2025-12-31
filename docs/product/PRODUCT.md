# RiteMark Native - Product Overview

**Tagline:** The text editor that speaks AI fluently.

---

## The Problem

I work with Claude Code every day. It's transformed how I write software—an AI that understands my codebase, edits files, and thinks alongside me.

But when I switched to writing text documents—blog posts, documentation, product specs—I hit a wall.

The tools don't match:
- **Word processors** are bloated, proprietary, and AI-hostile
- **Plain text editors** lack formatting and feel primitive
- **Notion/Google Docs** are online-only and own your data
- **Markdown editors** are either too minimal or too technical

What I wanted was simple: **Claude Code, but for writing.**

Not code—text. Reports. Specs. Blog posts. Meeting notes.

An editor where I can:
1. Describe what a document should do, and have AI generate it
2. Work locally (my files, my machine)
3. Run Claude Code right in the terminal
4. Write in Markdown without seeing the syntax

---

## The Insight

**Companies need dual-use knowledge management.**

A document must work for both humans AND AI. The same file needs to be readable by people and processable by agents. This is the new requirement that changes everything.

The old formats fail this test:

| Format | Human | AI | Problem |
|--------|-------|-----|---------|
| **DOCX** | OK | Bad | Complex, full of hidden formatting. "Half the info gets lost or distorted" when given to AI. |
| **PDF** | OK | Terrible | Essentially a print format. Layout over structure. |
| **Markdown** | Great | Great | Human-readable, machine-readable, version-control compatible. |

**Markdown is the only dual-use text format.**

It's been around for 20 years. Developers use it constantly. But it never broke through to "normal" users—until now.

AI is the reason that changes. Not "markdown is better" as a technical preference, but "markdown is the only format that works with our new tools" as a practical necessity.

> *"This is no longer a technical preference. It's a practical need."*

---

## What RiteMark Native Is

A standalone desktop app for writing in Markdown, with AI built-in.

**Not a VS Code extension.** A complete, branded application built on VS Code's proven foundation—with everything code-focused stripped away.

### Core Capabilities

| Feature | What It Does |
|---------|--------------|
| **WYSIWYG Editor** | Write in rich text, save as Markdown |
| **Local-First** | Your files live on your machine |
| **Built-in Terminal** | Run Claude Code right inside the app |
| **AI Assistant** | Rephrase, expand, edit with AI help |
| **Document Properties** | Visual metadata (dates, tags, status) |
| **Offline Mode** | Works without internet |
| **Autosave** | Never lose work |

### What We Removed

Everything that distracts from writing:
- Code navigation menus
- Extension marketplace
- Debugging tools
- Language servers
- Git UI clutter

What remains is a clean, focused writing environment.

---

## Target Users

1. **Knowledge workers** who write documentation, specs, blog posts
2. **Claude Code users** who want the same workflow for text
3. **Markdown enthusiasts** who want a native desktop app
4. **Privacy-conscious writers** who don't want cloud-only tools

---

## The Vision

**Phase 1 (Now):** A beautiful Markdown editor with AI assistance
**Phase 2:** Deep Claude Code integration (sub-agents, skills, memories)
**Phase 3:** The standard interface for AI-assisted writing

We're building for a future where:
- Documents are plain text (Markdown)
- AI is a collaborator, not a novelty
- Local-first is the default
- The editor is invisible—just you and your words

---

## Why "Native"?

- **Native app** - Not Electron bloat, real desktop performance
- **Native Markdown** - Files are real .md, not proprietary
- **Native AI** - Claude isn't bolted on, it's built in
- **Native workflow** - Terminal, files, AI in one window

---

## Technical Foundation

Built on VS Code OSS (the same open-source base as Cursor, Codium, and others), which gives us:
- Battle-tested editor infrastructure
- Cross-platform (macOS now, Windows/Linux planned)
- Terminal integration
- File explorer
- Extension architecture (for our own features)

We maintain this as a **submodule with patches**, not a fork—so we can easily pull upstream improvements while keeping our customizations clean.

---

## Current Status

**MVP Complete** (Sprints 1-13)

- WYSIWYG Markdown editor with TipTap
- AI assistant panel
- Document properties (YAML front-matter)
- Task list checkboxes
- Word count & reading time
- macOS DMG installer
- Full offline support

**Next:** User feedback, iteration, Windows/Linux builds

---

## The Bet

Two predictions for 2026:

### 1. Claude Code comes to the office

Today you open Word, write text by hand. Tomorrow you describe to an agent what the document should do, and AI generates it. You don't create documents—you describe their purpose.

This is a big shift in thinking. And it requires a new kind of tool: something between Claude Code (for developers) and Claude Artifacts (a demo). Something simple enough for a secretary, powerful enough that a developer doesn't feel limited.

**RiteMark Native is that tool.**

### 2. Markdown becomes the standard

At least one Fortune 500 company will announce transition to markdown-based internal documentation in 2026.

Why? Because consultants will drive it. When McKinsey delivers a report in Markdown because their AI processes it better, clients start using Markdown too. Consultants have always been carriers of "best practices"—this time it'll actually be useful.

The spread mechanism:
1. Tech companies adopt first
2. Consultants pick it up
3. Traditional enterprises follow

---

## Why This Matters

RiteMark Native exists because the tools haven't caught up to the shift.

Word, Notion, Confluence—they were built for humans writing alone. We need tools built for humans writing with AI.

Markdown is the bridge. RiteMark Native is the editor.

---

*"Write in Markdown. Think with AI. Own your words."*
