# Comments

> Annotate any passage without touching the prose.

Select text, drop a note in the right margin, and keep your writing clean — the familiar Google-Docs-style margin model, now in Ritemark.

---

## What You Can Do

- **Anchor a comment on selected text** — select any passage and click **Comment** in the bubble menu; Ritemark highlights the text and opens a note beside it in the right margin
- **Drop a quick standalone note** — type `///` anywhere to add a margin note that isn't tied to a specific passage
- **Hand a passage to an AI agent** — mention `@claude`, `@codex`, or `@opencode` inside a comment and a **Send to AI** button appears; one click sends your note and the commented text straight to the AI sidebar
- **Notes that persist** — comments save into the Markdown file itself; they are still there when you reopen the document

---

## How It Works

### Anchored comments

1. Select any text in your document
2. Click **Comment** in the bubble menu that appears
3. Ritemark highlights the selected passage and opens a note card in the right margin
4. Type your note in the card

The highlighted anchor and the margin note stay linked — hover the margin to see the note at any time.

### Standalone margin notes

Type `///` anywhere in your document and press Enter (or Space) to insert a standalone margin note. No text selection needed. Good for reminders or questions that aren't tied to one specific phrase.

### Editing and deleting comments

- **Edit** — click the margin marker to open the note; edit the text directly
- **Delete** — hover the margin marker and click the trash icon; the margin note is removed and the highlighted anchor returns to plain text

### AI hand-off

Mention an agent alias inside a comment note:

| Alias | Agent |
|-------|-------|
| `@claude` | Claude (Anthropic) |
| `@codex` | Codex (OpenAI) |
| `@opencode` | OpenCode (bring-your-own-key) |

A **Send to AI** button appears on the comment card. Pressing it opens the AI sidebar for the mentioned agent and sends:
- your note text (with the mention stripped)
- the exact commented passage as context

This replaces the "select → copy → switch panels → paste → describe" flow with a single click from the margin.

---

## Persistence

Comments are stored directly in the Markdown file using `<mark data-comment>` attributes (anchored) and HTML comment nodes (standalone). They survive saves, reopens, and round-trips through Ritemark's Markdown converter. No sidecar file is created.

> **Note:** Comments are Ritemark-specific HTML embedded in Markdown. They are invisible when the file is opened in a plain-text editor, but do appear in the raw source.

---

## Known Limitations

- **Multi-bullet selections** — selecting across several bullet points and commenting creates one comment anchor per bullet rather than a single shared comment. This will be addressed in an upcoming update.

---

## Related

- [Core Editor](editor.md) — basic editing, slash commands
- [Text Formatting](formatting.md) — bubble menu, bold, italic, links
- [AI Agents](ai-agents.md) — Claude, Codex, and OpenCode in the sidebar
- [Keyboard Shortcuts](keyboard-shortcuts.md) — shortcut reference
