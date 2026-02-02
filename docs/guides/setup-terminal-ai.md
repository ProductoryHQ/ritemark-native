# Set Up Terminal AI

> Get Claude Code, OpenAI Codex, or Google Gemini working with Ritemark.

Terminal-based AIs work alongside Ritemark to help you write. They can read your documents, make edits, and understand your full project context.

---

## Claude Code (Recommended)

Claude Code is the best terminal AI for writing with Ritemark. It understands markdown, makes precise edits, and handles long documents well.

### Install Claude Code

1. **Install via Homebrew:**
   ```bash
   brew install claude-code
   ```

2. **Or via npm:**
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

3. **Authenticate:**
   ```bash
   claude auth
   ```
   Follow the prompts to sign in with your Anthropic account.

### Using Claude Code with Ritemark

1. Open your document in Ritemark
2. Open the terminal: **View** → **Terminal** or `Ctrl+``
3. Navigate to your document folder:
   ```bash
   cd /path/to/your/documents
   ```
4. Start Claude:
   ```bash
   claude
   ```
5. Ask Claude to help:
   ```
   Read my-document.md and suggest improvements
   ```

### Example Prompts

- "Make the introduction more engaging"
- "Restructure this document with better headings"
- "Summarize the key points at the top"
- "Make section 3 more concise"
- "Add examples to illustrate each concept"

---

## OpenAI Codex

Good for technical documentation and code-related writing.

### Install

1. **Install OpenAI CLI:**
   ```bash
   pip install openai
   ```

2. **Set API key:**
   ```bash
   export OPENAI_API_KEY='your-key-here'
   ```

   Or add to your shell profile (~/.zshrc):
   ```bash
   echo 'export OPENAI_API_KEY="your-key"' >> ~/.zshrc
   ```

### Using with Ritemark

Codex CLI usage varies by tool. Refer to OpenAI documentation for current CLI options.

---

## Google Gemini

Fast for quick edits and brainstorming.

### Install

1. **Install Gemini CLI:**
   ```bash
   pip install google-generativeai
   ```

2. **Configure API key:**
   ```bash
   export GOOGLE_API_KEY='your-key-here'
   ```

### Using with Ritemark

Refer to Google's Gemini CLI documentation for current usage.

---

## Tips for All Terminal AIs

### Navigate to Your Files First

Always start in the right directory:
```bash
cd ~/Documents/my-project
```

This helps the AI understand your project structure.

### Be Specific About Files

Tell the AI which file to work on:
- "Edit introduction.md"
- "Read chapters/chapter-1.md and improve it"

### Work Section by Section

Don't ask for everything at once:
1. "Improve the opening paragraph"
2. "Now make section 2 clearer"
3. "Add a conclusion"

### Give Context

Tell the AI what you're writing:
- "This is a blog post for developers"
- "This is a user manual for beginners"
- "This is a sales proposal"

---

## Comparison

| AI | Strengths | Best For |
|----|-----------|----------|
| **Claude Code** | Context understanding, nuanced writing, markdown expertise | Most writing tasks |
| **OpenAI Codex** | Technical accuracy, code integration | Technical docs |
| **Google Gemini** | Speed, quick iterations | Brainstorming, drafts |

---

## Troubleshooting

### "Command not found"

The AI CLI isn't installed or isn't in your PATH. Reinstall following the instructions above.

### Authentication errors

Re-authenticate with your API provider:
- Claude: `claude auth`
- OpenAI: Check your API key
- Gemini: Check your API key

### AI can't see my file

Make sure you're in the correct directory:
```bash
pwd  # shows current directory
ls   # lists files here
```

### Changes don't appear in Ritemark

1. Ritemark should auto-detect file changes
2. If not, reload: Cmd+Shift+P → "Reload Window"

---

## Related

- [Terminal AI Feature](../features/terminal-ai.md) - How terminal AI integration works
- [AI Assistant](../features/ai-assistant.md) - Built-in AI sidebar
- [Set Up Built-in AI](setup-ai.md) - Configure the sidebar AI
