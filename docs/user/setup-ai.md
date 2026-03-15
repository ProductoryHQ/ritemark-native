# Set Up AI

> Configure Ritemark's built-in AI and optional terminal AI tools.

Ritemark works great without any AI features. But if you want AI-powered editing, here's how to set everything up.

---

## Built-in AI Assistant (OpenAI)

Ritemark's built-in AI assistant helps you rephrase text, make bulk replacements, and insert content. It requires an OpenAI API key.

### Step 1: Get an API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to **API Keys** (under your profile menu)
4. Click **Create new secret key**
5. Name it something like "Ritemark"
6. Copy the key (starts with `sk-`)

**Important:** You can only see the key once. Save it somewhere safe.

#### API Credits

OpenAI requires prepaid credits:
- New accounts may include free credits
- Add payment method and credits at the Billing section
- Typical usage costs pennies per session

### Step 2: Add Key to Ritemark

1. Open Ritemark
2. Click the **gear icon** to open Settings
3. Paste your API key in the OpenAI field
4. Your key is stored securely in your system's credential store

### Step 3: Verify It Works

1. Open any markdown file
2. Look at the status bar (bottom)
3. You should see **AI Ready**

If you see **AI Offline**, check your internet connection, verify the API key, and make sure you have API credits.

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "AI Offline" in status bar | Check internet connection |
| No response from AI | Verify API key and credits |
| "Invalid API key" error | Re-enter key in Settings |
| Slow responses | Normal for longer text; wait for completion |

---

## Claude Code (Terminal AI)

Claude Code is Anthropic's CLI tool for AI-powered editing directly in the terminal. Ritemark v1.5+ can also install Claude automatically from Settings.

### Install

**Option A — From Ritemark Settings:**
Open Settings (gear icon) and click **Install Claude**.

**Option B — Manual install:**

```bash
# npm
npm install -g @anthropic-ai/claude-code

# Homebrew (macOS)
brew install claude-code
```

Then authenticate:

```bash
claude auth
```

### Learn More

For full usage instructions, see Anthropic's official documentation:
**[Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**

---

## OpenAI Codex (Terminal AI)

Codex is OpenAI's CLI agent for terminal-based editing.

### Install

```bash
npm install -g @openai/codex
```

Set your API key:

```bash
export OPENAI_API_KEY='your-key-here'
```

### Learn More

For full usage instructions, see OpenAI's official documentation:
**[Codex CLI Documentation](https://github.com/openai/codex)**

---

## Privacy Notes

- API keys are stored in your system's secure credential store
- Text is sent to the respective AI provider's servers for processing
- Ritemark doesn't store or transmit your data elsewhere
- See each provider's usage policies for details

---

## Without AI

Ritemark works perfectly without any AI configured:
- All editing features work
- Export works
- CSV/Excel viewing works

You can always add AI later.

---

## Related

- [AI Assistant](../features/ai-assistant.md) - How to use AI features
- [AI Agents](../features/ai-agents.md) - Built-in Claude, Codex, and Ritemark Agent
- [Getting Started](getting-started.md) - Basic setup
