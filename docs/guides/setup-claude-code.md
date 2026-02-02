# Set Up Claude Code

> Use Anthropic's Claude directly in Ritemark's terminal for powerful document editing.

Claude Code is Anthropic's official CLI tool. It works exceptionally well with Ritemark because it can read and edit markdown files directly.

---

## What You'll Get

After setup, you can:
- Ask Claude to edit your documents in natural language
- Restructure, expand, or rewrite entire sections
- Have Claude work on multiple files at once
- See changes appear live in your editor

---

## Installation

### Step 1: Install Claude Code

Open Ritemark's terminal (View → Terminal or Ctrl+`) and run:

```bash
npm install -g @anthropic-ai/claude-code
```

Or if you use Homebrew:

```bash
brew install claude-code
```

### Step 2: Configure API Key

Get your API key from [Anthropic Console](https://console.anthropic.com/):

1. Create an account or sign in
2. Go to API Keys
3. Create a new key
4. Copy the key (starts with `sk-ant-`)

Set the key in your terminal:

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

To make it permanent, add to your `~/.zshrc`:

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-your-key-here"' >> ~/.zshrc
source ~/.zshrc
```

### Step 3: Verify

```bash
claude --version
```

Should show the installed version.

---

## Basic Usage

### Edit Current Document

With a document open in Ritemark:

```bash
claude "make this document more concise"
```

Claude Code detects the current file and edits it.

### Edit Specific File

```bash
claude "in notes.md, add a summary section at the top"
```

### Multiple Operations

```bash
claude "reorganize proposal.md: move conclusions to the end, add an executive summary"
```

---

## Practical Examples

### Polish Writing

```bash
claude "review draft.md and improve the writing style. Make it more professional."
```

### Expand Content

```bash
claude "in blog-post.md, expand the 'Benefits' section with 3 more bullet points"
```

### Restructure

```bash
claude "convert meeting-notes.md from paragraphs into a structured outline with headers"
```

### Add Sections

```bash
claude "add a FAQ section to readme.md based on the content"
```

### Fix Formatting

```bash
claude "clean up the markdown formatting in report.md"
```

---

## Tips for Best Results

### Be Specific

| Instead of | Say |
|------------|-----|
| "improve this" | "make the introduction more engaging" |
| "fix it" | "fix the bullet point formatting in the Features section" |
| "make it better" | "simplify the language for a non-technical audience" |

### Reference the File

Always include the filename when you have multiple files open:

```bash
claude "in project-plan.md, add timeline estimates"
```

### Review Before Committing

Claude Code can make significant changes. Review the diff before moving on:

```bash
git diff  # if using version control
```

### Use Version Control

Git is your safety net:

```bash
git add .
git commit -m "before AI edits"
# run claude commands
git diff  # review changes
git commit -m "AI: improved writing"  # or git checkout . to undo
```

---

## Common Workflows

### Writing a Document

1. Create rough outline manually
2. Ask Claude to expand sections
3. Use built-in AI assistant for fine-tuning
4. Manual polish and review

### Editing Existing Work

1. Commit current version (git)
2. Ask Claude for improvements
3. Review changes
4. Iterate or revert

### Converting Formats

```bash
# Notes to blog post
claude "convert notes.md into a blog post format with introduction and conclusion"

# Meeting notes to action items
claude "extract action items from meeting.md into a task list"

# Draft to email
claude "convert this draft into a professional email format"
```

---

## Troubleshooting

### "Command not found: claude"

```bash
# Check installation
which claude

# Reinstall if needed
npm install -g @anthropic-ai/claude-code
```

### "Invalid API key"

```bash
# Check your key is set
echo $ANTHROPIC_API_KEY

# Reset if needed
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

### "Rate limit exceeded"

Wait a few minutes and try again. Consider upgrading your Anthropic plan for higher limits.

### Changes Not Appearing

1. Save the file in Ritemark (Cmd+S)
2. Or wait for auto-reload (1 second)
3. Or reload window (Cmd+Shift+P → Reload Window)

---

## Comparison with Built-in AI

| Task | Best Tool |
|------|-----------|
| Quick rephrase | Built-in AI Assistant |
| Full document rewrite | Claude Code |
| Add new section | Claude Code |
| Fix single paragraph | Built-in AI Assistant |
| Structural changes | Claude Code |
| Grammar fixes | Built-in AI Assistant |

Use both! They complement each other.

---

## Cost

Claude Code uses your Anthropic API credits. Costs depend on:
- Document length (input tokens)
- Response length (output tokens)
- Model used (Claude 3.5 Sonnet default)

Typical document edit: $0.01-0.10

Check usage at [Anthropic Console](https://console.anthropic.com/).

---

## Related

- [Terminal AI Integration](../features/terminal-ai.md) - Overview of terminal AI
- [AI Assistant](../features/ai-assistant.md) - Built-in chat sidebar
- [Getting Started](getting-started.md) - Ritemark basics
