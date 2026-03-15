# AI Assistant (Ritemark Agent)

> Rephrase, replace, and insert text with AI - right from your editor.

Ritemark includes a built-in AI assistant (the **Ritemark Agent**) that can help you rewrite text, make bulk changes, and add new content. It works with your selected text and understands your document context.

This is one of three AI agents available in Ritemark. See [AI Agents](ai-agents.md) for the full overview including Claude and Codex.

---

## What You Can Do

- **Rephrase text** - Make it shorter, longer, simpler, or more formal
- **Find and replace** - Replace all occurrences of a word or phrase
- **Insert text** - Add new content at specific positions
- **Chat naturally** - Ask in plain English, get results in your document

---

## Setup Required

The AI assistant requires an OpenAI API key. See [Set Up AI](../guides/setup-ai.md) for instructions.

Without an API key, the AI sidebar shows "AI Offline" and tools are disabled. Everything else in Ritemark works normally.

---

## The AI Sidebar

The AI assistant lives in a sidebar panel:
- **Location:** Right side of the window
- **Toggle:** Click the AI icon or use the View menu

### Sidebar Components

| Part | Description |
|------|-------------|
| Selection indicator | Shows what text is selected |
| Chat messages | Your requests and AI responses |
| Input field | Type your request here |
| Send button | Execute the request |

---

## AI Tools

### 1. Rephrase Text

Change how selected text is written.

**How to use:**
1. Select text in your document
2. Open the AI sidebar
3. Type a request like "make this shorter" or "more formal"
4. AI rewrites the selected text

**Style options:**
| Request | Result |
|---------|--------|
| "make this shorter" | Condenses text |
| "make this longer" | Expands with detail |
| "simpler" | Plain language |
| "more formal" | Professional tone |
| "casual" | Conversational tone |
| "professional" | Business appropriate |

**Examples:**
- "Rephrase this paragraph to be more concise"
- "Make this sound more professional"
- "Simplify this for a general audience"

### 2. Find and Replace All

Replace every occurrence of a word or phrase.

**How to use:**
1. Open the AI sidebar (no selection needed)
2. Type "replace X with Y" or "change all X to Y"
3. AI finds and replaces all matches

**Options:**
- **Case sensitive** - Match exact capitalization
- **Whole word** - Don't match partial words
- **Preserve case** - Keep original capitalization pattern

**Examples:**
- "Replace all 'user' with 'customer'"
- "Change 'app' to 'application' everywhere"
- "Find 'TODO' and replace with 'DONE'"

### 3. Insert Text

Add new content at a specific position.

**How to use:**
1. Open the AI sidebar
2. Describe what to add and where
3. AI inserts the content

**Position options:**
- **Start/End** - Beginning or end of document
- **Before/After** - Relative to specific text
- **At selection** - Where your cursor is

**Examples:**
- "Add a summary at the start"
- "Insert a bullet list after the introduction"
- "Add a conclusion paragraph at the end"

---

## Using the Assistant

### Basic Workflow

1. **Select text** (optional - depends on tool)
2. **Open sidebar** - Click the AI icon
3. **Type request** - Plain English
4. **Review changes** - AI modifies your document
5. **Undo if needed** - Cmd+Z works as expected

### Tips for Good Results

| Do | Don't |
|-----|-------|
| Be specific: "Make this paragraph shorter" | Be vague: "Fix this" |
| State the goal: "More professional tone" | Just describe the problem |
| Give context: "This is for a job application" | Assume AI knows context |

### Selection Indicator

When you select text, the sidebar shows:
- A pulsing dot indicator
- Preview of selected text
- This tells AI what to work with

---

## Offline Mode

If you lose internet connection:
- Status bar shows "AI Offline"
- AI tools are disabled
- All other features work normally
- Reconnects automatically when online

---

## Privacy

- Your text is sent to OpenAI's API for processing
- Your API key is stored securely on your machine
- No data is stored by Ritemark's servers (there are none)
- See OpenAI's privacy policy for their data handling

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "AI Offline" | Check internet connection |
| No response | Verify API key is set up |
| Wrong text changed | Make sure text is selected before requesting |
| Unexpected results | Be more specific in your request |

See [Common Issues](../troubleshooting/common-issues.md) for more help.

---

## Related

- [AI Agents](ai-agents.md) - Overview of all three agents (Ritemark, Claude, Codex)
- [Set Up AI](../setup-ai.md) - Configure your API key
- [Core Editor](editor.md) - Basic editing
- [Keyboard Shortcuts](keyboard-shortcuts.md) - All shortcuts
