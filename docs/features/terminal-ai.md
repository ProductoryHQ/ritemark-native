# Terminal AI Integration

> Use Claude Code, OpenAI Codex, or Google Gemini directly in your writing workflow.

RiteMark is built on VS Code, which means it has a full integrated terminal. This lets you run AI assistants like Claude Code right alongside your documents.

---

## What You Can Do

- **Run Claude Code** in the terminal while editing documents
- **Ask AI to edit your files** directly (not just chat)
- **Use any terminal-based AI** - Claude Code, Codex CLI, Gemini CLI
- **See changes appear live** in your editor as AI writes

This is different from the [built-in AI Assistant](ai-assistant.md), which is a chat sidebar. Terminal AI can directly read and edit your files.

---

## Why Terminal AI?

| Built-in AI Assistant | Terminal AI (Claude Code, etc.) |
|-----------------------|--------------------------------|
| Chat-based | Command-based |
| Works on selected text | Works on entire files |
| Good for quick edits | Good for complex tasks |
| No setup beyond API key | Requires CLI installation |
| Limited to predefined tools | Full AI capabilities |

**Best of both:** Use the built-in assistant for quick rephrasing, terminal AI for heavy lifting.

---

## Supported Terminal AI Tools

### Claude Code (Recommended)

Anthropic's official CLI for Claude. Works exceptionally well with RiteMark.

**Why Claude Code?**
- Can read and edit your markdown files directly
- Understands document context
- Can restructure, expand, or rewrite entire sections
- Natural language commands

**Example commands:**
```
claude "make this document more concise"
claude "add a summary section at the top"
claude "restructure this into bullet points"
claude "expand the introduction with more context"
```

[Setup Guide →](../guides/setup-claude-code.md)

### OpenAI Codex CLI

OpenAI's command-line interface for GPT models.

**Use for:**
- Code-heavy documents
- Technical writing
- API documentation

### Google Gemini CLI

Google's Gemini models via command line.

**Use for:**
- Research-heavy documents
- Multi-language content
- Documents needing web research

---

## How It Works

1. **Open Terminal** in RiteMark (View → Terminal or Ctrl+\`)
2. **Navigate to your document** (usually already there)
3. **Run AI commands** that reference your file
4. **Watch changes** appear in the editor automatically

The terminal AI reads your file, makes changes, and saves. RiteMark's auto-reload shows the updates instantly.

---

## Workflow Example

**Scenario:** You have a rough draft and want to polish it.

```bash
# Open terminal in RiteMark
# Navigate to document folder (if needed)

# Ask Claude Code to improve it
claude "review my-document.md and make the writing more professional"

# Or be specific
claude "in my-document.md, expand the 'Benefits' section with 3 more bullet points"

# Or restructure
claude "reorganize my-document.md with an executive summary at the top"
```

The document updates in real-time as Claude Code works.

---

## Tips

### For Best Results

- **Be specific** - "Make the intro shorter" beats "improve this"
- **Reference the file** - Include the filename in your command
- **Review changes** - Terminal AI can make big changes; review before saving
- **Use version control** - Git helps if you want to undo AI changes

### Combining Both AIs

1. Use **terminal AI** for big structural changes
2. Use **built-in AI assistant** for fine-tuning specific paragraphs
3. Use **manual editing** for final polish

### Performance

- Terminal AI commands can take 10-60 seconds
- Watch the terminal for progress
- Large documents take longer

---

## Comparison

| Task | Best Tool |
|------|-----------|
| Rephrase a paragraph | Built-in AI Assistant |
| Restructure entire document | Terminal AI (Claude Code) |
| Add new section | Terminal AI |
| Make text shorter/longer | Built-in AI Assistant |
| Research and expand | Terminal AI |
| Fix grammar | Built-in AI Assistant |
| Convert format (e.g., list to prose) | Either |

---

## Security Notes

- Terminal AI tools use your own API keys
- Your documents stay local (not uploaded to any service beyond the AI API)
- API calls are encrypted
- No data stored on external servers beyond normal AI processing

---

## Related

- [Setup Claude Code](../guides/setup-claude-code.md) - Installation guide
- [AI Assistant](ai-assistant.md) - Built-in chat sidebar
- [Getting Started](../guides/getting-started.md) - First-run setup
