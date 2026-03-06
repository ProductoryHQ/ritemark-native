# Architecture Decisions - Sprint 36

## Date
2026-02-14

## Summary

This document captures the key architectural decisions for integrating Codex CLI with ChatGPT credentials into Ritemark Native.

---

## Decision 1: App Server Protocol vs SDK

### Context
Codex provides two integration paths:
1. **App Server Protocol** - JSON-RPC 2.0 over stdio (used by VS Code extension, JetBrains, macOS app)
2. **Codex SDK** - TypeScript package `@openai/codex-sdk` (simpler, less control)

### Decision
Use **hybrid approach**:
- **Agent Panel**: App Server Protocol (full control over streaming, approvals, auth flows)
- **Flow Node**: Codex SDK (simpler, thread-based execution)

### Rationale
- Agent panel needs fine-grained control (approval dialogs, streaming tokens, progress events)
- Flow nodes benefit from simplicity (SDK auto-handles auth, cleaner async interface)
- Both paths are officially supported by OpenAI
- SDK is ~337 versions published, stable and actively maintained

### Trade-offs
- Adds both dependencies (binary + npm package)
- More surface area to maintain
- **Benefit**: Each integration path uses the best tool for its use case

---

## Decision 2: Binary Distribution Strategy (Deferred)

### Context
Three options for getting `codex` binary to users:
1. **Bundle with app** - Increases app size by ~15MB
2. **Require separate install** - Users run `npm i -g @openai/codex` or `brew install --cask codex`
3. **Auto-download on first use** - Download binary when feature is enabled (like VS Code language servers)

### Decision
**Deferred to separate sprint**. For Sprint 36:
- Feature flag defaults to **disabled**
- Manual install documented in settings page
- Detection shows clear error message with install instructions if binary not found

### Rationale
- Need to test integration first before committing to bundling
- Binary size is non-trivial (~15MB per platform)
- Auto-download adds complexity (security, mirrors, progress UI)
- Manual install is acceptable for experimental feature

### Next Steps
- Sprint 37 or 38 can tackle distribution after integration is validated
- Consider Homebrew cask for macOS (already on wishlist)
- Windows: chocolatey or direct npm install
- Linux: npm or distro packages

---

## Decision 3: Authentication Flow

### Decision
Use **OAuth via system browser** (default Codex behavior).

Codex provides two auth methods:
1. `codex login` - Opens system browser, PKCE OAuth flow
2. `codex login --device-auth` - Device code flow (in-terminal)

We use **Method 1** (browser-based).

### Implementation
```typescript
// Settings page webview button triggers:
extensionApi.postMessage({ type: 'codex:startLogin' });

// Extension calls:
await codexAppServer.rpc('auth/startLogin', {});
// → Codex opens browser to localhost:9119
// → Redirects to ChatGPT OAuth
// → User signs in
// → Token stored in OS keyring by Codex
// → Event: auth/statusChanged emitted
```

### Rationale
- Browser-based is most familiar to users (same as GitHub OAuth, Google OAuth, etc.)
- Codex handles all OAuth complexity (PKCE, token refresh, storage)
- We just trigger `auth/startLogin` RPC and listen for `auth/statusChanged` event
- Device code auth is fallback if needed (headless/SSH environments)

### Security
- Credentials stored in OS keyring (macOS Keychain, Windows Credential Manager, Linux libsecret)
- Ritemark never sees the access token (Codex manages it)
- Token refresh handled by Codex automatically

---

## Decision 4: Approval Dialog Implementation

### Context
Codex requires user approval for:
- Shell commands (`shell` tool)
- File edits (`apply_patch` tool)

The App Server protocol provides:
- `approve/command` RPC method
- `approve/fileChange` RPC method

### Decision
Implement **modal dialogs** using existing Dialog component.

**Shell Approval:**
```
┌─────────────────────────────────────┐
│  Codex wants to run a command       │
│─────────────────────────────────────│
│  $ npm install lodash               │
│                                     │
│  Working directory:                 │
│  /Users/jarmo/project               │
│                                     │
│  [Reject]            [Approve]      │
└─────────────────────────────────────┘
```

**File Edit Approval:**
```
┌─────────────────────────────────────┐
│  Codex wants to edit a file         │
│─────────────────────────────────────│
│  src/auth/login.ts                  │
│                                     │
│  @@ -40,3 +40,5 @@                  │
│  + if (!token) {                    │
│  +   throw new AuthError();         │
│  + }                                │
│                                     │
│  [Reject]            [Approve]      │
└─────────────────────────────────────┘
```

### Rationale
- Reuses existing Dialog component (consistent UI)
- Blocking modal prevents race conditions (only one approval at a time)
- Clear action buttons (Reject is safe default)
- Diff preview for file edits helps user understand change

### Future Enhancements (Out of Scope)
- "Always allow for this session" checkbox
- "Trust this directory" setting (bypass approvals for known projects)
- Approval history/log

---

## Decision 5: Feature Flag Strategy

### Decision
Create **single master flag** `codex-integration` that controls:
- Settings page ChatGPT section
- Agent panel UI
- Flow node availability
- All Codex-related commands

When flag is **disabled**:
- No UI elements visible
- No binary spawn attempts
- No performance impact

When flag is **enabled**:
- Settings page shows ChatGPT login option
- Activity bar shows Codex icon (if authenticated)
- Flow palette shows Codex node

### Implementation
```typescript
// src/features/flags.ts
export const FLAGS = {
  // ...
  'codex-integration': {
    id: 'codex-integration',
    name: 'Codex CLI Integration',
    description: 'ChatGPT-authenticated coding agent',
    defaultEnabled: false,
    platforms: ['darwin', 'win32', 'linux'],
    category: 'experimental',
  },
};
```

```json
// package.json
"contributes": {
  "configuration": {
    "properties": {
      "ritemark.experimental.codexIntegration": {
        "type": "boolean",
        "default": false,
        "description": "Enable Codex CLI integration (requires codex binary installed)"
      }
    }
  }
}
```

### Rationale
- Allows beta testing without affecting all users
- Easy kill-switch if issues arise
- Follows existing feature flag pattern from Sprint 1
- Setting in package.json makes it discoverable (VS Code settings UI)

---

## Decision 6: Model Configuration

### Context
Codex supports different models based on auth method:

**ChatGPT Login:**
- GPT-5.3-Codex (most capable)
- GPT-5.3-Codex-Spark (fastest, Pro only)
- GPT-5.2-Codex
- GPT-5.1-Codex
- GPT-5.1-Codex-Mini
- GPT-5-Codex

**API Key:**
All of the above plus GPT-4o, o3, etc.

### Decision
Use **Codex-determined defaults** for Sprint 36.

When user is authenticated via ChatGPT, Codex selects model based on plan:
- Plus → GPT-5.3-Codex
- Pro → GPT-5.3-Codex-Spark (when speed needed) or GPT-5.3-Codex

We **do not** add model selector in Sprint 36. Future sprint can add:
- Model dropdown in Agent panel
- Model selection in Flow node config
- Default model preference in settings

### Rationale
- Keeps scope manageable
- Codex defaults are good (OpenAI knows their models best)
- Users can always change in `~/.codex/config.toml` if needed
- Model selector is UI polish, not critical for MVP

---

## Decision 7: Error Handling Philosophy

### Decision
**Fail gracefully with actionable user messaging.**

Error categories:

| Error | User Message | Action |
|-------|--------------|--------|
| Binary not found | "Codex CLI is not installed. [Install Guide]" | Link to docs with install instructions |
| Auth not started | "Sign in with ChatGPT to use Codex agents." | Button to start OAuth |
| Auth expired | "Your ChatGPT session expired. Please sign in again." | Auto-trigger re-auth |
| Rate limit | "Usage limit reached. Resets at [time]." | Show quota info from plan |
| Spawn failure | "Failed to start Codex. Check installation." | Link to troubleshooting |
| Tool timeout | "Agent task timed out. Please try again." | Retry button |

### Rationale
- Users shouldn't see technical error messages
- Always provide next action (install, sign in, retry)
- Link to docs for complex issues
- No silent failures

---

## Decision 8: Process Lifecycle

### Decision
**Lazy spawn** - Only start `codex app-server` when needed.

```typescript
class CodexManager {
  private process: ChildProcess | null = null;

  async ensureRunning() {
    if (this.process && !this.process.killed) {
      return; // Already running
    }
    await this.spawn();
  }

  async spawn() {
    this.process = spawn('codex', ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // Set up JSONL parsers, event handlers
  }

  dispose() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
```

**Lifecycle:**
1. Extension activates → CodexManager created (no spawn yet)
2. User opens Agent panel OR runs Codex Flow → `ensureRunning()` called → spawn
3. Process stays alive while extension is active
4. Extension deactivates → `dispose()` called → SIGTERM

### Rationale
- Don't waste resources if user doesn't use Codex
- Keep process alive for fast response (no spawn delay on each request)
- Clean shutdown on extension deactivate
- Single process for entire session (App Server supports multiple threads)

---

## Open Questions (To Be Resolved During Implementation)

1. **Progress rendering** - How to show `item/agentMessage/delta` tokens? Stream word-by-word or buffer sentences?
2. **Approval queue** - Can multiple approvals be pending? Need queue system?
3. **Tool visibility** - Show which tools were used (shell, apply_patch, web_search) in agent panel?
4. **Thread persistence** - Should agent panel support multiple conversation threads? Or single thread per session?
5. **Working directory** - Agent panel should default to current workspace root or let user choose?

These will be addressed in implementation phases as we build the UI.

---

## References

- **Analysis doc**: `/home/user/ritemark-native/docs/analysis/2026-02-14-codex-cli-chatgpt-integration.md`
- **Codex App Server docs**: https://developers.openai.com/codex/app-server/
- **Codex SDK docs**: https://developers.openai.com/codex/sdk/
- **Feature flags skill**: `.claude/skills/feature-flags/SKILL.md`
