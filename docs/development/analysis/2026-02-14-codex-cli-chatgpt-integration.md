# Codex CLI Integration with ChatGPT Credentials — Research Analysis

**Date:** 2026-02-14
**Goal:** Understand how to build the same thing we did for Claude Code under Ritemark AI, but for OpenAI's Codex CLI using ChatGPT login credentials.

---

## Executive Summary

OpenAI's **Codex CLI** is an open-source (Apache-2.0) coding agent that supports **dual authentication**: standard API keys AND ChatGPT login credentials (OAuth). This means ChatGPT Plus/Pro/Team/Business subscribers can use Codex CLI without a separate API key — usage is billed to their existing subscription.

The CLI is written in **Rust** and exposes a well-documented **App Server protocol** (JSON-RPC 2.0 over stdio) that IDE extensions use to embed Codex. This is the same protocol used by the official VS Code extension, JetBrains plugin, and the standalone macOS Codex App.

**Key finding:** Building a Codex integration in Ritemark is architecturally feasible and legally clean (Apache-2.0 license). The ChatGPT OAuth flow is the critical differentiator — users sign in with their existing ChatGPT account, no API key needed.

---

## Table of Contents

1. [How Codex CLI Works](#1-how-codex-cli-works)
2. [Authentication: ChatGPT OAuth vs API Keys](#2-authentication-chatgpt-oauth-vs-api-keys)
3. [App Server Protocol (How to Embed Codex)](#3-app-server-protocol-how-to-embed-codex)
4. [Codex SDK (TypeScript)](#4-codex-sdk-typescript)
5. [Comparison: Our Claude Code Integration vs Codex](#5-comparison-our-claude-code-integration-vs-codex)
6. [Implementation Strategy for Ritemark](#6-implementation-strategy-for-ritemark)
7. [Models Available](#7-models-available)
8. [Licensing & Legal](#8-licensing--legal)
9. [Open Questions & Risks](#9-open-questions--risks)
10. [Sources](#10-sources)

---

## 1. How Codex CLI Works

### Architecture Overview

```
User Prompt
    │
    ▼
┌─────────────────────────────────────────┐
│  Codex CLI (Rust binary, ~15MB)         │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ Agent Loop   │  │ Sandbox Engine   │  │
│  │              │  │ (Seatbelt/       │  │
│  │ prompt →     │  │  Landlock/       │  │
│  │ model call → │  │  seccomp)        │  │
│  │ tool exec →  │  │                  │  │
│  │ loop         │  │                  │  │
│  └──────┬───────┘  └──────────────────┘  │
│         │                                │
│  ┌──────▼───────────────────────────┐    │
│  │ Model Client                     │    │
│  │                                  │    │
│  │ ChatGPT Auth:                    │    │
│  │   chatgpt.com/backend-api/       │    │
│  │   codex/responses                │    │
│  │                                  │    │
│  │ API Key Auth:                    │    │
│  │   api.openai.com/v1/responses    │    │
│  └──────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Agent Loop (same pattern as Claude Code)

1. User provides a prompt
2. System assembles context: instructions + tools + conversation history
3. Sends to model via **Responses API** (`POST /v1/responses`)
4. Model returns text OR tool calls (`shell`, `apply_patch`, `web_search`)
5. If tool call → execute in sandbox → feed result back → loop
6. If final text → return to user

### Built-in Tools

| Tool | Purpose | Equivalent in Claude Code |
|------|---------|--------------------------|
| `shell` | Execute shell commands | `Bash` tool |
| `apply_patch` | Edit files (custom diff format) | `Edit` tool |
| `web_search` | Search the web | `WebSearch` tool |
| `update_plan` | Track progress (todo list) | `TodoWrite` tool |

### Key Stats

- **Language:** 96% Rust (rewritten from TypeScript in late 2025)
- **GitHub Stars:** 60,300+
- **Contributors:** 365+
- **Current Version:** v0.101.0 (Feb 12, 2026)
- **Install:** `npm i -g @openai/codex` or `brew install --cask codex`
- **Platforms:** macOS (arm64, x86_64), Linux (x86_64, arm64), Windows (experimental)

---

## 2. Authentication: ChatGPT OAuth vs API Keys

This is the most important section for our use case.

### Method 1: ChatGPT OAuth Login (What We Want)

```
codex login
→ Opens browser to localhost:9119
→ Redirects to ChatGPT OAuth (PKCE flow)
→ User signs in with existing ChatGPT account
→ Receives access token
→ All API calls go to: chatgpt.com/backend-api/codex/responses
→ Usage billed to ChatGPT subscription (Plus=$20/mo, Pro=$200/mo)
```

**Key details:**
- Uses **PKCE OAuth flow** (browser-based, no client secret needed)
- Creates an auto-generated API key tied to the ChatGPT subscription
- ChatGPT Plus users get **$5/month** in API credits included
- ChatGPT Pro users get **$50/month** in API credits included
- Hits a **private, privileged endpoint**: `chatgpt.com/backend-api/codex/responses`
- Device code auth also available for headless environments: `codex login --device-auth`

### Method 2: Standard API Key

```
export OPENAI_API_KEY=sk-...
codex login --with-api-key
→ All API calls go to: api.openai.com/v1/responses
→ Usage billed at standard API rates
```

### Credential Storage

Configurable via `cli_auth_credentials_store` in `config.toml`:

| Value | Storage |
|-------|---------|
| `"auto"` (default) | OS keyring when available, fallback to file |
| `"keyring"` | OS-native: macOS Keychain, Linux libsecret, Windows Credential Manager |
| `"file"` | `~/.codex/auth.json` |

### Enterprise Controls

Admins can enforce authentication restrictions:
- `forced_login_method = "chatgpt"` — only allow ChatGPT credentials
- `forced_login_method = "api"` — only allow API keys
- `forced_chatgpt_workspace_id` — lock to specific org workspace

---

## 3. App Server Protocol (How to Embed Codex)

This is how the VS Code extension, JetBrains plugin, and macOS app all integrate with Codex CLI. **This is the path we'd use for Ritemark.**

### Overview

```
┌─────────────────────┐     JSON-RPC 2.0      ┌──────────────────┐
│  Ritemark Extension  │ ◄──── stdio ────────► │  codex app-server│
│  (TypeScript)        │     (JSONL)           │  (Rust binary)   │
└─────────────────────┘                        └──────────────────┘
```

The `codex app-server` binary is spawned as a child process. Communication is **bidirectional JSON-RPC 2.0 over stdin/stdout** using JSONL (newline-delimited JSON).

### Protocol Methods (Client → Server)

| Method | Purpose |
|--------|---------|
| `initialize` | Set up session, capabilities negotiation |
| `auth/getStatus` | Check current auth state |
| `auth/startLogin` | Trigger OAuth or API key login |
| `auth/logout` | Clear credentials |
| `thread/create` | Start new conversation |
| `turn/start` | Send user message, begin agent loop |
| `turn/interrupt` | Cancel current operation |
| `approve/command` | Approve a pending shell command |
| `approve/fileChange` | Approve a pending file edit |

### Protocol Events (Server → Client)

| Event | Purpose |
|-------|---------|
| `item/started` | Tool execution beginning |
| `item/completed` | Tool execution finished |
| `item/agentMessage/delta` | Streaming text token |
| `turn/completed` | Agent turn finished |
| `auth/statusChanged` | Authentication state changed |

### Type Generation

Codex can auto-generate TypeScript types from the protocol:
```bash
codex app-server generate-ts > codex-protocol.d.ts
codex app-server generate-json-schema > codex-schema.json
```

### Existing Client Implementations

Client libraries exist in: **Go, Python, TypeScript, Swift, Kotlin**

The TypeScript one is what we'd use, or write our own thin wrapper.

---

## 4. Codex SDK (TypeScript)

An alternative to the raw App Server protocol — simpler but less control.

```typescript
import { Codex, Thread } from "@openai/codex-sdk";

// Create instance
const codex = new Codex();

// Create conversation thread
const thread = codex.createThread({ workingDir: "/path/to/repo" });

// Run with streaming
for await (const event of thread.runStreamed("Fix the failing tests")) {
  switch (event.type) {
    case "response_delta":
      // Streaming text
      break;
    case "tool_call":
      // Tool being executed
      break;
    case "file_change":
      // File was modified
      break;
  }
}
```

**npm package:** `@openai/codex-sdk`
**Stats:** 337 versions published, 60 dependents

### SDK vs App Server

| Feature | Codex SDK | App Server Protocol |
|---------|-----------|-------------------|
| Complexity | Simple | Full-featured |
| Auth handling | Automatic | Manual (auth/* methods) |
| Approval UI | Callback-based | Full RPC surface |
| Streaming | Async generator | JSONL events |
| Type safety | Built-in | Generated from schema |
| Best for | Scripts, CI/CD, simple integrations | IDE-grade integrations |

**For Ritemark, the App Server protocol gives us more control** (approval UI, auth flows, streaming rendering). The SDK is good for simpler integrations like Flow nodes.

---

## 5. Comparison: Our Claude Code Integration vs Codex

### What We Currently Have (Claude Code in Ritemark)

Based on the codebase analysis:

| Component | Implementation |
|-----------|---------------|
| **API Client** | `openAIClient.ts` — calls OpenAI Chat Completions / Responses API |
| **Auth** | `apiKeyManager.ts` — stores OpenAI API key in VS Code SecretStorage |
| **Models** | `modelConfig.ts` — GPT-5.x, GPT-4o, Gemini models |
| **AI Features** | Text editing (rephrase, find-replace, insert), RAG search, Flows |
| **Settings** | `RitemarkSettings.tsx` — API key input, test, model selection |
| **Connectivity** | `connectivity.ts` — pings OpenAI API every 30s |
| **Flows** | LLM nodes, Image nodes, Claude Code nodes, Save File nodes |

### What a Codex Integration Would Add

| Feature | Value |
|---------|-------|
| **ChatGPT login** | No API key needed — sign in with existing ChatGPT account |
| **Full coding agent** | Read/edit/run code autonomously (like Claude Code in terminal) |
| **Sandboxed execution** | Safe command execution with approval UI |
| **Included with ChatGPT Plus** | $20/mo covers everything, no separate API billing |
| **Latest Codex models** | GPT-5.3-Codex (most capable), Codex-Spark (fastest) |
| **MCP support** | Connect to external tools/servers |
| **Apache-2.0 license** | Freely embeddable, no legal risk |

### Architecture Mapping

| Ritemark Concept | Claude Code Equivalent | Codex CLI Equivalent |
|-----------------|----------------------|---------------------|
| AI Assistant sidebar | Claude Agent SDK `query()` | Codex App Server `turn/start` |
| Text editing tools | OpenAI function calling | `apply_patch` tool |
| Command execution | Bash tool | `shell` tool |
| API key entry | SecretStorage + settings UI | `auth/startLogin` (OAuth) |
| Flow LLM nodes | Direct API calls | Codex SDK `thread.run()` |
| Streaming | SSE from API | JSONL from App Server |

---

## 6. Implementation Strategy for Ritemark

### Phase 1: Authentication (ChatGPT OAuth)

Add ChatGPT login alongside existing API key auth:

```
Settings Page:
┌─────────────────────────────────────────┐
│  AI Provider: [OpenAI ▼]                │
│                                         │
│  Authentication:                        │
│  ○ API Key (current)                    │
│  ● ChatGPT Account (new!)              │
│                                         │
│  [Sign in with ChatGPT]                │
│  Status: ✓ Signed in as jarmo@...      │
│  Plan: ChatGPT Pro ($200/mo)           │
│                                         │
│  Model: [GPT-5.3-Codex ▼]             │
└─────────────────────────────────────────┘
```

**Implementation approach:**
1. Bundle or require `codex` binary
2. Use `auth/startLogin` RPC to trigger OAuth flow
3. Codex handles the entire OAuth dance (browser popup, PKCE, token exchange)
4. Store auth status — Codex manages credentials in its own keyring/file
5. All subsequent API calls route through Codex (which uses the ChatGPT backend endpoint)

### Phase 2: Coding Agent Integration

Add a "Codex Agent" panel (like the existing AI Assistant but more powerful):

```
┌─────────────────────────────────────┐
│  Codex Agent                    [×] │
│─────────────────────────────────────│
│  > Fix the authentication bug in    │
│    src/auth/login.ts                │
│                                     │
│  ┌─ Reading src/auth/login.ts ────┐ │
│  │ Found issue on line 42:        │ │
│  │ Missing null check on token    │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ Editing src/auth/login.ts ────┐ │
│  │ @@ -40,3 +40,5 @@              │ │
│  │ + if (!token) {                │ │
│  │ +   throw new AuthError();     │ │
│  │ + }                            │ │
│  │ [Approve] [Reject]             │ │
│  └────────────────────────────────┘ │
│                                     │
│  [Type a message...]                │
└─────────────────────────────────────┘
```

**Implementation:**
1. Spawn `codex app-server` as child process from extension
2. Communicate via JSON-RPC over stdio
3. Render streaming responses in webview
4. Show approval dialogs for shell commands and file edits
5. Apply approved edits to the VS Code editor

### Phase 3: Flow Integration

Add Codex as a Flow node type (alongside existing LLM/Image nodes):

```
┌──────────┐     ┌───────────────┐     ┌────────────┐
│  Input   │────►│  Codex Agent  │────►│  Save File │
│  (prompt)│     │  (full agent) │     │  (output)  │
└──────────┘     └───────────────┘     └────────────┘
```

**Implementation:**
- Use `@openai/codex-sdk` for simpler integration in Flow executor
- Thread-based: create thread, run prompt, collect results
- Supports structured output (JSON schema)

### Required New Files

```
extensions/ritemark/src/
├── codex/
│   ├── codexManager.ts          # Manages codex binary lifecycle
│   ├── codexAppServer.ts        # App Server JSON-RPC client
│   ├── codexAuth.ts             # ChatGPT OAuth integration
│   ├── codexAgentProvider.ts    # VS Code webview for agent panel
│   └── codexProtocol.d.ts       # Generated TypeScript types
├── flows/nodes/
│   └── CodexNodeExecutor.ts     # Flow node using Codex SDK
└── settings/
    └── (update RitemarkSettingsProvider for ChatGPT auth)
```

---

## 7. Models Available

### Via ChatGPT Login (included in subscription)

| Model | Speed | Best For |
|-------|-------|---------|
| **GPT-5.3-Codex** | Medium | Most capable, complex tasks |
| **GPT-5.3-Codex-Spark** | Very fast (>1000 tok/s) | Real-time interactive (Pro only) |
| **GPT-5.2-Codex** | Medium | Strong reasoning, context compaction |
| **GPT-5.1-Codex** | Medium | Complex tasks |
| **GPT-5.1-Codex-Mini** | Fast | Lighter tasks |
| **GPT-5-Codex** | Medium | General coding |

### Via API Key (pay-per-token)

All of the above plus:
- GPT-5, GPT-5-Mini, GPT-5-Nano
- GPT-4o, GPT-4o-mini
- o3, o4-mini
- codex-mini-latest (fine-tuned o4-mini)

---

## 8. Licensing & Legal

### Codex CLI: Apache-2.0

- **Fully permissive** open source license
- Can fork, modify, redistribute, and use commercially
- Includes **explicit patent grant** (better than MIT)
- No copyleft obligations
- We can bundle the binary with Ritemark

### Comparison with Claude Code

| Aspect | Codex CLI | Claude Code |
|--------|-----------|-------------|
| License | Apache-2.0 | Proprietary (BUSL) |
| Can fork/modify | Yes | No |
| Can redistribute | Yes | No |
| Can embed binary | Yes | No (use Agent SDK instead) |
| SDK license | Apache-2.0 | Open source |

**This is a major advantage.** We can ship Codex binary with Ritemark. For Claude Code, we must use the Agent SDK as an intermediary.

### ChatGPT API Endpoint

The private endpoint `chatgpt.com/backend-api/codex/responses` is accessed through the official Codex CLI binary. We are NOT reverse-engineering anything — we're using their open-source tool as designed. This is explicitly supported.

---

## 9. Open Questions & Risks

### Questions to Resolve

1. **Binary distribution:** Bundle codex binary (~15MB) with Ritemark, or require separate install?
   - Bundling is cleaner UX but increases app size
   - Separate install keeps us decoupled from Codex release cycle
   - Could auto-download on first use (like how VS Code downloads language servers)

2. **Auth UX flow:** The OAuth popup opens a browser. How does this work inside Ritemark?
   - Standard: Opens system browser, redirects back to localhost
   - Alternative: Use device code auth (`--device-auth`) for in-app flow
   - Could embed a webview for the OAuth flow

3. **Approval UI:** Codex requires user approval for destructive operations.
   - Need to build approval dialogs in the webview
   - Map to our existing dialog component system

4. **Dual agent support:** Can users have both Claude Code and Codex active?
   - Different providers for different tasks
   - Let user choose default, allow switching per-session

5. **Windows/Linux support:** Codex CLI supports all platforms, but sandboxing differs.
   - macOS: Seatbelt (same as our current target)
   - Linux: Landlock + seccomp
   - Windows: AppContainer (experimental)

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Private API endpoint changes | Medium | We use official binary, not custom API calls. Updates come from Codex releases. |
| ChatGPT subscription limits | Low | Rate limits are generous for Plus/Pro users |
| Binary size increase | Low | ~15MB for Codex binary, acceptable |
| Auth token expiry | Low | Codex handles refresh internally |
| Breaking protocol changes | Medium | Pin to specific Codex version, test before updating |

---

## 10. Sources

### Official Documentation
- [Codex CLI GitHub](https://github.com/openai/codex) — Apache-2.0, 60.3k stars
- [Codex CLI Docs](https://developers.openai.com/codex/cli)
- [Codex CLI Reference](https://developers.openai.com/codex/cli/reference/)
- [Codex Authentication](https://developers.openai.com/codex/auth/)
- [Codex Models](https://developers.openai.com/codex/models/)
- [Codex App Server](https://developers.openai.com/codex/app-server/)
- [Codex SDK](https://developers.openai.com/codex/sdk/)
- [Codex Configuration](https://developers.openai.com/codex/config-reference/)
- [Codex MCP](https://developers.openai.com/codex/mcp/)
- [Codex Security](https://developers.openai.com/codex/security/)

### OpenAI API
- [Responses API Reference](https://platform.openai.com/docs/api-reference/responses)
- [Responses vs Chat Completions](https://platform.openai.com/docs/guides/responses-vs-chat-completions)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [Unlocking the Codex Harness](https://openai.com/index/unlocking-the-codex-harness/)

### Comparison & Community
- [Claude Code vs Codex - Composio](https://composio.dev/blog/claude-code-vs-openai-codex)
- [Claude Code vs Codex - Northflank](https://northflank.com/blog/claude-code-vs-openai-codex)
- [Simon Willison: Reverse Engineering Codex CLI](https://simonwillison.net/2025/Nov/9/gpt-5-codex-mini/)
- [InfoQ: Codex Agent Loop Internals](https://www.infoq.com/news/2026/02/codex-agent-loop/)

---

## TL;DR — What To Build

| Step | What | How |
|------|------|-----|
| 1 | ChatGPT OAuth login | Use `codex app-server` `auth/startLogin` RPC method |
| 2 | Agent panel in sidebar | Spawn `codex app-server`, render streaming via webview |
| 3 | Approval dialogs | Map `approve/command` and `approve/fileChange` to Dialog component |
| 4 | Flow node | Use `@openai/codex-sdk` for thread-based agent runs |
| 5 | Settings page update | Add ChatGPT account section alongside API key |

**Bottom line:** This is very doable. The architecture mirrors what we already built for Claude Code, but with better licensing (Apache-2.0) and a killer auth feature (ChatGPT login = no API key hassle).
