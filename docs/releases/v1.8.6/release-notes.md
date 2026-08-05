# Ritemark 1.8.6 — Clean Start

Ritemark 1.8.6 is about trust — the app now does what it shows, from the first
double-click to the model badge in the corner.

## Highlights

**Clean first open.** Double-click a markdown file on a brand-new install and
it opens straight in the Ritemark editor. No "do you trust the authors?"
dialog, no plain-text code view, no Restricted Mode banner. Profiles bitten by
the old bug self-heal on first launch.

**Home, first.** A persistent Home launcher is now the first thing in the
sidebar — New document, quick actions, and your recent documents (or recent
folders when nothing is open). One click back into your work.

**Truthful agent plans.** "Plan only" mode is enforced by the runtime — the
agent physically cannot edit files while planning, plans always appear for
review, and approval hands over to exactly the autonomy you chose (Manual or
Auto). If the model chooses to plan on its own, that is labeled too.

**The model you pick is the model that runs.** Model selection is pinned on
every path — chat, queued prompts, comment tasks, flows, scheduled agents. If
the runtime ever resolves something different, the conversation says so
out loud.

**Scheduled agents ask first.** A folder that defines scheduled AI agents gets
one clear question before anything is armed — and the decision is reversible
any time from the Agent Library. Folders already using scheduling keep working.

**Comments as a command center.** The toolbar shows the document's true
comment count; assigned comments (@claude / @codex / @opencode — anywhere in
the comment, not just the start) dispatch as ordered per-agent tasks through
the prompt queue, with live status dots in the margin.

**A queue you can see.** Up to 10 follow-up prompts per chat, visible and
editable, draining only when the agent is genuinely free.

**Reliable editing around agents.** When an agent updates a file on disk, the
editor shows the fresh content within seconds — and your own typing never
triggers false "file changed" alarms. Real conflicts (someone else wrote while
you have unsaved edits) still get a review banner.

**A calmer, more writerly shell.** One word — Folder — everywhere (no more
Workspace/Project confusion); a File menu that speaks Ritemark (New Document
⌘N, New Table); no Selection menu, no preview-tab surprises, chevron-free
folder tree with the selected file in indigo; horizontal rules with real
breathing room; Sofia Sans in every corner.

## Fixes

- Finder no longer shows "Ritemark.app (1.117.0)" — the bundle carries the real Ritemark version
- Chat links to workspace files (including `README.md:12` style) open in Ritemark
- The AI info banner shows until dismissed, then never again — verified across restarts
- Comment task prompts keep cross-agent references intact

## For the record

Sprint 102 (AI transparency), 103 (truthful plans), 104 (prompt queue),
105 (comments command center), 106 (Home launcher), 107 (Clean Start), plus
the 2026-08-05 live test-pass fixes. Full details: docs/CHANGELOG.md.
