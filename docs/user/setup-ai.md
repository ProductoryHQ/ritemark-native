# Set Up AI

> Configure Ritemark's built-in AI and optional terminal AI tools.

Ritemark works great without any AI features. But if you want AI-powered editing, here's how to set everything up.

Ritemark's AI sidebar runs three agents — **Claude Code**, **ChatGPT**, and **OpenCode**. The welcome
asks which you use the first time you open Ritemark. To set one up later, open **Settings**: **You**
at the top right ▸ **Settings**, or Cmd+, (Ctrl+, on Windows). If you use **Flows**, you'll also need an
OpenAI API key (see [OpenAI API Key for Flows](#openai-api-key-for-flows)).

> **New in v1.7.3:** **OpenCode** joins Claude Code and ChatGPT as a third, bring-your-own-key chat
> runtime. Where Claude and ChatGPT use their own sign-in, OpenCode points at any provider you already
> have an API key for. See [OpenCode (bring your own key)](#opencode-bring-your-own-key) below.

> **Changed in v1.7.2:** The earlier built-in "Ritemark Agent" — a direct OpenAI chat assistant with
> rephrase / find-and-replace / insert tools and document search — has been removed. The OpenAI API
> key is no longer used by a chat agent; it now only powers Flows LLM and Image nodes.

---

## Claude Code

Claude Code is Anthropic's coding agent. As of v1.6.3, you sign in entirely from inside Ritemark — no terminal commands required.

For the authoritative agent overview, see [AI Agents](features/ai-agents.md).
For custom helpers and Launch Chat, see [Agents](features/agent-library.md).

### In-app sign-in (recommended)

1. Open Ritemark.
2. Either:
   - Choose **Claude** on the welcome, **or**
   - Open **Settings** (**You** ▸ Settings, or Cmd+,) and find the **Claude Account** card under **API Keys**, **or**
   - In the **AI sidebar**, pick Claude in the message box's picker.
3. Click **Sign in with Claude.ai**. Your system browser opens with the Anthropic OAuth flow.
4. Approve, return to Ritemark — Settings and the AI sidebar both update to "Connected".

If you'd rather paste a key instead of using OAuth, click **Use Anthropic API key** in Settings (or **API keys** on the welcome) and paste your key. Ritemark stores it in your system's secure credential store.

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

Ritemark keeps using the Claude that ships with the app until you set **Settings → Agent Runtime → Runtime preference** to **Use system install**. It then uses your global install when it finds one, and falls back to the bundled copy when it does not.

---

## ChatGPT

ChatGPT works in Ritemark with your ChatGPT account; any plan works, Free included. Ritemark runs it through Codex, OpenAI's agent program, which ships with the app. Sign-in is the same in Settings and the AI sidebar — both open your system browser instead of dropping you into a terminal, and they stay in sync.

For the authoritative agent overview, see [AI Agents](features/ai-agents.md).
For custom helpers and Launch Chat, see [Agents](features/agent-library.md).

### In-app sign-in (recommended)

1. Open Ritemark.
2. Either:
   - Choose **ChatGPT** on the welcome, **or**
   - Open **Settings** (**You** ▸ Settings, or Cmd+,) and find the **ChatGPT Account** card under **API Keys**, **or**
   - In the **AI sidebar**, pick ChatGPT in the message box's picker, then click **Sign in with ChatGPT**.
3. Your system browser opens with the OpenAI OAuth flow.
4. Approve, return to Ritemark — both Settings and the AI sidebar update.

Signing out from one surface signs you out everywhere.

### Learn more

For the program behind ChatGPT in Ritemark, see OpenAI's documentation:
**[Codex CLI Documentation](https://github.com/openai/codex)**

### Advanced / fallback — manual install

If you prefer to manage the program yourself:

```bash
npm install -g @openai/codex
```

Then set **Settings → Agent Runtime → Runtime preference** to **Use system install**. Until you do, Ritemark keeps using the copy that ships with the app.

Set your API key (only needed for the standalone CLI, not for in-app sign-in):

```bash
export OPENAI_API_KEY='your-key-here'
```

---

## OpenCode (bring your own key)

> Added in v1.7.3.

OpenCode is a third AI chat runtime, alongside Claude Code and ChatGPT, integrated over the **Agent
Client Protocol (ACP)**. Unlike Claude and ChatGPT, OpenCode has no sign-in of its own — it is
**bring-your-own-key**. You point it at any provider you already have an API key for and pick from
that provider's models.

The OpenCode runtime ships bundled with Ritemark; there is nothing to install.

### Step 1: Add a provider API key

1. Choose **OpenCode** on the welcome, or open **Settings** (**You** ▸ Settings, or Cmd+,).
2. Find the API-key fields under **API Keys** and paste a key for any provider you want OpenCode to use:
   - **OpenAI** — GPT models
   - **Google AI** — Gemini models
   - **Anthropic** — Claude models
   - **OpenRouter** — a wide range of models from many providers (new in v1.7.3)
3. Keys are stored securely in your system's credential store.

![Settings showing the bring-your-own-key provider fields used by OpenCode](../releases/v1.7.3/screenshots/1.7.3-full-screen-BYOK-settings-open-code.png)

You can configure more than one provider. Only providers with a saved key become available in
OpenCode.

### Step 2: Pick an OpenCode model

1. In the **AI sidebar**, click the AI and model name under the message box to open the model picker.
2. Scroll to the **OpenCode** group (it appears after ChatGPT).
3. The group lists models only from providers whose key you've configured — add a Google AI key and
   Gemini models appear, add OpenAI and GPT models appear, and so on. With no keys configured, the
   group prompts you to open Settings.

![OpenCode running a Gemini model in the AI sidebar](../releases/v1.7.3/screenshots/1-7-3-full-screen-open-code-gemini.png)

> The OpenCode group refreshes the moment you save or remove a provider key — no window reload
> needed (fixed in v1.7.3).

### File edits and approval

When OpenCode wants to edit a file you have open, Ritemark shows a single **File Change Approval**
card with the target path. The file on disk is **untouched until you Approve**. Writes outside your
workspace are rejected automatically.

For hands-free runs, Settings → OpenCode has an **Auto-approve edits & tool calls** toggle. Even
with auto-approve on, out-of-workspace writes stay blocked.

### Learn more

For OpenCode usage and provider details, see the project's documentation:
**[OpenCode](https://opencode.ai)**

---

## OpenAI API Key for Flows

[Flows](features/flows.md) use an OpenAI API key for their **LLM Prompt** and **Image Generation**
steps. This key is not needed for the Claude or ChatGPT sidebar agents — only for running Flows.

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
2. Open **Settings** (**You** ▸ Settings, or Cmd+,)
3. Paste your API key in the OpenAI field under **API Keys**
4. Your key is stored securely in your system's credential store

Each LLM and Image step chooses its own model; see [Flows → Requirements](features/flows.md#requirements).

---

## Agent Runtime (v1.7.0+)

By default, Ritemark ships its own bundled Claude Code and Codex (the program behind ChatGPT). If you prefer to use your own system-installed versions:

1. Open **Settings** (**You** ▸ Settings, or Cmd+,).
2. Find the **Agent Runtime** section.
3. Set **Runtime preference** from **Bundled** to **Use system install**.

**Currently active**, below it, tells you which copy Ritemark is actually running for Claude and for ChatGPT: **Bundled with app** or **System installation** — useful for verifying your system install is being picked up. **This computer's tools**, in the same section, says whether Git and Node.js are installed.

**When to use System runtime:**
- You want to use a specific version of Claude Code or Codex you've installed yourself.
- You're testing a newer Codex or Claude CLI release before it ships bundled with Ritemark.

**When to use Bundled (default):**
- You haven't installed Claude Code or Codex manually.
- You want the exact version Ritemark has tested against.

---

## Privacy Notes

- API keys are stored in your system's secure credential store
- Text is sent to the respective AI provider's servers for processing
- Ritemark doesn't store or transmit your data elsewhere
- Browser page content is only shared with the AI after you choose **Share this page** in the question on the AI sidebar
- See each provider's usage policies for details

---

## Without AI

Ritemark works perfectly without any AI configured. Choose **Skip for now** on the welcome:
- All editing features work
- Share works
- CSV/Excel viewing works

You can always add AI later.

---

## Related

- [AI Agents](features/ai-agents.md) - Built-in Claude, ChatGPT, and OpenCode agents
- [Flows](features/flows.md) - Visual AI workflows (use the OpenAI key)
- [Getting Started](getting-started.md) - Basic setup
