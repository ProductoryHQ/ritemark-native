---
date: '2026-07-15'
title: 'Ritemark v1.8.3 — Comments & AI Assignment'
author: Jarmo Tuisk
status: Released
sprints:
  - sprint-94
  - sprint-95
  - sprint-96
tags:
  - sprint-94
  - sprint-95
  - sprint-96
  - comments
  - margin-notes
  - ai-assignment
  - codex
  - gpt-5.6
  - chat-history
  - attachments
---

# Ritemark v1.8.3 — Comments & AI Assignment

**Type:** Patch (1.8.2 → 1.8.3) — full app release (DMG)
**Focus:** Giving Ritemark a real way to **talk about your document, inside your document**. This release debuts **Comments** — select any text, hit **Comment**, and a highlighted anchor plus a Google-Docs-style margin note appears. Type `///` for a quick standalone margin note, and mention `@claude`, `@codex`, or `@opencode` inside a comment to hand that exact passage to an AI agent. Comments round-trip through the Markdown file, so they persist. Alongside Comments, the bundled **Codex** runtime is upgraded so the new **GPT-5.6** models show up in the picker, chat **History** keeps your sessions separate again, and **attachment chips** are visible for text and Markdown files. Closes [#81](https://github.com/ProductoryHQ/ritemark-native/issues/81), [#135](https://github.com/ProductoryHQ/ritemark-native/issues/135), and [#103](https://github.com/ProductoryHQ/ritemark-native/issues/103); advances [#146](https://github.com/ProductoryHQ/ritemark-native/issues/146).

**Availability:** Fully cross-platform and live now — **macOS** (Apple Silicon + Intel, notarized) and **Windows** (x64, code-signed). Every platform gets v1.8.3 today, and the update feed serves it to macOS and Windows alike.

* * *

## Downloads

| Asset | Platform | URL |
|-------|----------|-----|
| Ritemark-arm64.dmg | macOS (Apple Silicon, arm64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.3/Ritemark-arm64.dmg |
| Ritemark-x64.dmg | macOS (Intel, x64) — notarized | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.3/Ritemark-x64.dmg |
| Ritemark-Setup.exe | Windows x64 — Authenticode-signed (Azure Trusted Signing) | https://github.com/jarmo-productory/ritemark-public/releases/download/v1.8.3/Ritemark-Setup.exe |

Both macOS downloads are signed and notarized by Apple — no Gatekeeper warnings. The Windows installer is Authenticode-signed via Azure Trusted Signing.

* * *

## Highlights

- **Comments arrive.** Select any text, click **Comment**, and get a highlighted anchor plus a margin note — the way you'd expect from a modern document editor.
- **Type `///` for a quick note.** Drop a standalone note in the right margin without selecting anything.
- **Hand a passage to an AI agent.** Mention `@claude`, `@codex`, or `@opencode` in a comment and a **Send to AI** button relays that exact commented context to the AI sidebar.
- **Comments persist.** They save into the Markdown file itself, so they're still there when you reopen the document.
- **GPT-5.6 is available in Codex.** The bundled Codex runtime is upgraded, so the newest `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` models now appear in the model picker.
- **Chat History behaves again.** Starting a new chat keeps your previous sessions as separate History entries instead of collapsing them into one.
- **Attachment chips show up** for `.md` and `.txt` files in the AI composer.

* * *

## Why This Release

Ritemark is a writing tool, and writing is rarely a solo, one-pass act — you leave yourself notes, you flag a paragraph to rework, you ask a question about a sentence you'll come back to. Until now Ritemark had no way to do any of that without cluttering the prose itself. v1.8.3 fixes that with **Comments**: a first-class way to annotate your document without touching the text, borrowing the margin model people already know from Google Docs.

Comments also become the natural bridge to Ritemark's AI. Instead of copying a paragraph into the sidebar and explaining what you want, you comment on the passage, mention an agent, and send it — the AI gets both your note and the exact surrounding context in one click. It turns "select, copy, switch panels, paste, describe" into "comment, mention, send".

The rest of the release clears out friction that had been building up. The bundled Codex runtime was old enough that the newest models simply didn't appear in the picker — now they do. New chats had started quietly merging into a single History entry, which made it hard to find an earlier conversation — that's fixed. And attaching a text or Markdown file to an AI message now shows a proper file chip, so you can see what you attached.

Sprint docs: `docs/development/sprints/sprint-94-comment-callouts/`, `docs/development/sprints/sprint-95-*`, and `docs/development/sprints/sprint-96-*`

* * *

## What's New

### Comments — annotate any passage, keep the prose clean (sprint-94)

Ritemark now has a full commenting system built into the editor:

- **Comment on a selection.** Select any text and click the **Comment** button in the toolbar. Ritemark highlights the selected passage as an anchor and opens a margin note next to it — the familiar Google-Docs-style margin model.
- **Quick standalone notes with `///`.** Type `///` anywhere to drop a standalone note straight into the right margin, no selection required. Good for a reminder or a question that isn't tied to one exact phrase.
- **Comments live in the file.** Every comment round-trips through the Markdown itself (stored as `<mark data-comment>` / HTML comments), so your notes are saved with the document and are still there when you reopen it — no separate sidecar file, no lost annotations.

This is the long-standing [#81](https://github.com/ProductoryHQ/ritemark-native/issues/81), and it's the headline of v1.8.3.

### Hand a commented passage to an AI agent (sprint-94)

Comments double as a hand-off to Ritemark's AI runtimes:

- **Mention an agent inside a comment.** Type `@claude`, `@codex`, or `@opencode` in a comment and a **Send to AI** button appears on that comment.
- **Send the context in one click.** Pressing **Send to AI** relays the commented passage and your note into the AI sidebar for the agent you mentioned — no copy-paste, no re-explaining. The agent gets both what you wrote and the exact text you were commenting on.

This turns a margin note into an actionable request without ever leaving your document.

### GPT-5.6 models in Codex (sprint-96)

The bundled Codex runtime is upgraded from 0.135.0 to 0.144.4. The practical result: the new **GPT-5.6** model family now shows up in the Codex model picker — the `gpt-5.6-sol` flagship plus `gpt-5.6-terra` and `gpt-5.6-luna`. Previously these newest models didn't appear at all, because the bundled runtime predated them. This advances [#146](https://github.com/ProductoryHQ/ritemark-native/issues/146).

* * *

## Fixes &amp; Polish

- **New chats stay as separate History sessions again (sprint-95, #135).** Starting a new chat had started folding previous conversations into a single History entry, making earlier sessions hard to find. Each chat is now correctly kept as its own separate entry in History. Closes [#135](https://github.com/ProductoryHQ/ritemark-native/issues/135).
- **Attachment chips are visible for text and Markdown files (sprint-95, #103).** Attaching a `.md` or `.txt` file in the AI composer used to produce an invisible chip — you couldn't tell the file had attached. The chip now renders clearly with a file icon and extension. Closes [#103](https://github.com/ProductoryHQ/ritemark-native/issues/103).
- **Seamless extension-update mechanism fixed (#142).** Behind-the-scenes plumbing so future lightweight in-app extension updates actually load. You won't see this directly — it's what makes the upcoming `1.8.3-ext.1` updates possible.

* * *

## Coming Next

A follow-up **`1.8.3-ext.1`** extension update will address two known Comments rough edges without a full reinstall:

- **Commenting across multiple bullet points** currently creates one comment per bullet instead of a single shared comment ([#150](https://github.com/ProductoryHQ/ritemark-native/issues/150)).
- **The Comment toolbar button label** is low-contrast on hover in dark theme ([#151](https://github.com/ProductoryHQ/ritemark-native/issues/151)).

* * *

## Known Issues &amp; Deferred

- **Multi-bullet comments split per bullet.** Selecting across several bullet points and commenting creates one comment per bullet rather than one shared comment ([#150](https://github.com/ProductoryHQ/ritemark-native/issues/150)). Fix ships in the fast-follow `1.8.3-ext.1`.
- **Comment button hover contrast in dark theme.** The Comment toolbar label is hard to read on hover in dark theme ([#151](https://github.com/ProductoryHQ/ritemark-native/issues/151)). Fix ships in the fast-follow `1.8.3-ext.1`.
