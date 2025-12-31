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

An editor that:
1. Works locally (my files, my machine)
2. Understands Markdown natively
3. Has a terminal built-in for Claude Code
4. Gets out of the way and lets me write

---

## The Insight

**Markdown is the future of text.**

Not because it's perfect, but because it's:
- **Plain text** - Works everywhere, forever
- **Human readable** - No proprietary format lock-in
- **AI-native** - Every LLM speaks Markdown fluently
- **Version control friendly** - Git just works
- **Convertible** - Export to PDF, DOCX, HTML, anything

When you write in Markdown, you're writing in the lingua franca of AI systems. Your documents become first-class citizens in the Claude Code workflow.

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

Markdown will become the default format for AI-era documents.

Not because anyone mandates it, but because:
1. AI systems read and write it fluently
2. It's the only format that works in terminals, browsers, and apps equally
3. Plain text survives format wars

RiteMark Native is the editor built for this future.

---

*"Write in Markdown. Think with AI. Own your words."*
