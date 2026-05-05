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

## Claude Code

Claude Code is Anthropic's coding agent. As of v1.6.3, you sign in entirely from inside Ritemark — no terminal commands required.

For the authoritative agent overview, see [AI Agents](features/ai-agents.md).
For custom helpers and Launch Chat, see [Agent Library](features/agent-library.md).

### In-app sign-in (recommended)

1. Open Ritemark.
2. Either:
   - Open **Settings** (gear icon) and find the Claude row, **or**
   - Open the **AI sidebar** and switch the agent to Claude.
3. Click **Sign in**. Your system browser opens with the Anthropic OAuth flow.
4. Approve, return to Ritemark — Settings and the AI sidebar both update to "Connected".

If you'd rather paste a key instead of using OAuth, click **Use Anthropic API key** in the same flow and paste your key. Ritemark stores it in your system's secure credential store.

You can cancel an in-progress sign-in from the same UI; sign-in times out after 5 minutes.

### Learn more

For Claude usage instructions (slash commands, planning, agent skills), see Anthropic's official documentation:
**[Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)**

### Advanced / fallback — manual install

If you prefer to manage Claude yourself (or you want to use a globally installed Claude alongside Ritemark's bundled runtime):

```bash
# npm
npm install -g @anthropic-ai/claude-code

# Homebrew (macOS)
brew install claude-code
```

Then authenticate from a terminal:

```bash
claude auth
```

Ritemark detects globally installed Claude binaries and uses them when present.

---

## OpenAI Codex

Codex is OpenAI's coding agent. As of v1.6.3, sign-in is unified across Settings and the AI sidebar — both surfaces open your system browser instead of dropping you into a terminal, and they stay in sync.

For the authoritative agent overview, see [AI Agents](features/ai-agents.md).
For custom helpers and Launch Chat, see [Agent Library](features/agent-library.md).

### In-app sign-in (recommended)

1. Open Ritemark.
2. Either:
   - Open **Settings** (gear icon) and find the ChatGPT row, **or**
   - Open the **AI sidebar** and switch the agent to Codex, then click **Sign in with ChatGPT**.
3. Your system browser opens with the OpenAI OAuth flow.
4. Approve, return to Ritemark — both Settings and the AI sidebar update.

Signing out from one surface signs you out everywhere.

### Learn more

For Codex usage instructions, see OpenAI's official documentation:
**[Codex CLI Documentation](https://github.com/openai/codex)**

### Advanced / fallback — manual install

If you prefer to manage Codex yourself:

```bash
npm install -g @openai/codex
```

Set your API key (only needed for the standalone CLI, not for in-app sign-in):

```bash
export OPENAI_API_KEY='your-key-here'
```

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
