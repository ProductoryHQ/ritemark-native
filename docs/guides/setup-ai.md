# Set Up AI Assistant

> Enable AI-powered text editing with your OpenAI API key.

RiteMark's AI assistant helps you rephrase text, make bulk replacements, and insert content. It requires an OpenAI API key to work.

---

## What You Need

- An OpenAI account
- An API key with available credits
- Internet connection

---

## Step 1: Get an API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign in or create an account
3. Navigate to **API Keys** (under your profile menu)
4. Click **Create new secret key**
5. Name it something like "RiteMark"
6. Copy the key (starts with `sk-`)

**Important:** You can only see the key once. Save it somewhere safe.

### API Credits

OpenAI requires prepaid credits:
- New accounts may include free credits
- Add payment method and credits at Billing section
- RiteMark uses GPT-4o-mini (cost-effective)

Typical usage costs pennies per session.

---

## Step 2: Add Key to RiteMark

1. Open RiteMark
2. Open Command Palette: **Cmd+Shift+P**
3. Type "Configure OpenAI"
4. Select **RiteMark: Configure OpenAI API Key**
5. Paste your API key
6. Press Enter

Your key is stored securely in macOS keychain.

---

## Step 3: Verify It Works

1. Open any markdown file
2. Look at the status bar (bottom)
3. You should see **AI Ready**

If you see **AI Offline**:
- Check your internet connection
- Verify the API key was entered correctly
- Make sure you have API credits

---

## Using the AI Assistant

Once set up:

1. Select some text in your document
2. Open the AI sidebar (right panel)
3. Type a request like "make this shorter"
4. AI modifies your selected text

See [AI Assistant](../features/ai-assistant.md) for full documentation.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "AI Offline" in status bar | Check internet connection |
| No response from AI | Verify API key and credits |
| "Invalid API key" error | Re-enter key via Command Palette |
| Slow responses | Normal for longer text; wait for completion |

### Re-enter Your API Key

If you need to update or fix your key:
1. **Cmd+Shift+P** → "Configure OpenAI API Key"
2. Enter the new key
3. Old key is replaced

### Check API Key Status

1. **Cmd+Shift+P**
2. Search for "Check API Key"
3. Select **RiteMark: Check API Key**
4. Shows whether key is valid

---

## Privacy Notes

- Your API key is stored in macOS Secure Storage
- Text is sent to OpenAI's servers for processing
- RiteMark doesn't store or transmit your data elsewhere
- See [OpenAI's usage policies](https://openai.com/policies/usage-policies)

---

## Without an API Key

RiteMark works fine without AI:
- All editing features work
- Export works
- CSV/Excel viewing works
- Only AI assistant is disabled

You can always add a key later.

---

## Related

- [AI Assistant](../features/ai-assistant.md) - How to use AI features
- [Getting Started](getting-started.md) - Basic setup
- [Common Issues](../troubleshooting/common-issues.md) - Troubleshooting
