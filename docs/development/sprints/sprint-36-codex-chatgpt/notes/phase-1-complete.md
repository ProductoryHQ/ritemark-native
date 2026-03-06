# Phase 1: Feature Flag & Architecture - COMPLETE

**Date:** 2026-02-14

## Summary

Core architecture files created. Feature flag system in place. Ready for integration into extension.

## Files Created

### 1. Feature Flag (`flags.ts`)
- Added `'codex-integration'` to `FlagId` type
- Added flag definition:
  - Status: `experimental`
  - Platforms: All (darwin, win32, linux)
  - Label: "Codex CLI Integration"
  - Description: "ChatGPT-authenticated coding agent using OpenAI Codex CLI"

### 2. Configuration (`package.json`)
- Added setting: `ritemark.experimental.codexIntegration`
  - Type: boolean
  - Default: false
  - Scope: application
  - Description: "Enable Codex CLI integration with ChatGPT authentication (experimental). Requires codex binary installed."

### 3. Protocol Types (`src/codex/codexProtocol.ts`)
Full TypeScript definitions for App Server protocol:
- JSON-RPC 2.0 base types (Request, Response, Notification, Error)
- RPC method params/results:
  - `initialize` - Session setup with capabilities
  - `auth/getStatus` - Get auth state
  - `auth/startLogin` - Trigger OAuth flow
  - `auth/logout` - Clear credentials
  - `thread/create` - New conversation thread
  - `turn/start` - Send user message, start agent loop
  - `turn/interrupt` - Cancel current operation
  - `approve/command` - Approve shell command
  - `approve/fileChange` - Approve file edit
- Server events:
  - `auth/statusChanged` - Auth state changed
  - `item/started` - Tool execution beginning
  - `item/completed` - Tool execution finished
  - `item/agentMessage/delta` - Streaming text token
  - `turn/completed` - Agent turn finished
  - `approval/commandRequired` - Shell command needs approval
  - `approval/fileChangeRequired` - File edit needs approval

### 4. Binary Manager (`src/codex/codexManager.ts`)
Handles Codex binary lifecycle:
- **Detection**: `isInstalled()` - checks if codex is in PATH
- **Version check**: `getVersion()` - gets version string
- **Lazy spawn**: `ensureRunning()` - only spawns when needed
- **Process management**: stdio pipes, event handlers
- **Graceful shutdown**: `dispose()` - SIGTERM on cleanup
- **Feature gate**: Checks `codex-integration` flag before spawning

Key design:
- Single process per session
- Stdio-based communication (stdin for send, stdout for receive)
- Error handling for missing binary (actionable user message)

### 5. App Server Client (`src/codex/codexAppServer.ts`)
JSON-RPC 2.0 client over stdio:
- **JSONL parser**: Newline-delimited JSON stream parsing
- **Request/response correlation**: Via numeric id
- **Event emitter**: Dispatches server notifications
- **Buffered reading**: Handles partial lines from stdout
- **RPC methods**: Type-safe wrappers for all protocol methods
- **Error handling**: Rejects pending requests on process exit

Key design:
- Extends EventEmitter for event-driven architecture
- Automatic initialization on first use
- Pending request tracking (Map<id, {resolve, reject}>)

### 6. Auth Manager (`src/codex/codexAuth.ts`)
Authentication state management:
- **OAuth trigger**: `startLogin()` - browser or device-code flow
- **Status tracking**: Listens for `auth/statusChanged` events
- **User info**: Email, plan type (Plus/Pro), API credits
- **Logout**: Clear credentials via app-server
- **Wait helper**: `waitForAuth()` - async wait for OAuth completion

Key design:
- Event-based (emits 'statusChanged' to listeners)
- Caches current status for sync checks
- Device code support (for SSH/headless environments)

### 7. Module Index (`src/codex/index.ts`)
Clean export surface:
```typescript
export { CodexManager } from './codexManager';
export { CodexAppServer } from './codexAppServer';
export { CodexAuth } from './codexAuth';
export * from './codexProtocol';
```

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  Extension (extension.ts)               │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  CodexAuth                        │  │
│  │  - startLogin()                   │  │
│  │  - getStatus()                    │  │
│  │  - logout()                       │  │
│  └───────────┬───────────────────────┘  │
│              │                          │
│  ┌───────────▼───────────────────────┐  │
│  │  CodexAppServer                   │  │
│  │  - rpc(method, params)            │  │
│  │  - emit(event)                    │  │
│  └───────────┬───────────────────────┘  │
│              │                          │
│  ┌───────────▼───────────────────────┐  │
│  │  CodexManager                     │  │
│  │  - spawn('codex app-server')      │  │
│  │  - send(jsonrpc)                  │  │
│  │  - dispose()                      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
              │
              │ stdio (JSONL)
              ▼
┌─────────────────────────────────────────┐
│  codex app-server (Rust binary)         │
│  - OAuth server                         │
│  - Thread management                    │
│  - Tool execution (shell, apply_patch)  │
│  - Approval flow                        │
└─────────────────────────────────────────┘
```

## Next Steps

**Phase 2: Settings Integration**
- Update `RitemarkSettingsProvider` to show ChatGPT auth section when flag is enabled
- Add webview components for login/logout UI
- Display auth status (email, plan, credits)
- Wire up auth events to update UI

## Testing Notes

To manually test Phase 1 (if needed):

```typescript
import { CodexAppServer, CodexAuth } from './codex';

const appServer = new CodexAppServer();
const auth = new CodexAuth(appServer);

// Check if binary is installed
const installed = await appServer.manager.isInstalled();
console.log('Codex installed:', installed);

// Get auth status
const status = await auth.getStatus();
console.log('Auth status:', status);

// Start OAuth login
await auth.startLogin('browser');
// → Opens browser to ChatGPT OAuth

// Wait for auth to complete
const authStatus = await auth.waitForAuth();
console.log('Authenticated:', authStatus);

// Cleanup
appServer.dispose();
```

## Checklist Progress

- [x] Create feature flag `codex-integration` in `src/features/flags.ts`
- [x] Add setting to `package.json`: `ritemark.experimental.codexIntegration`
- [x] Define TypeScript protocol types from spec
- [x] Create directory structure: `src/codex/*`
- [x] Document architecture (this file)
- [x] Create `CodexManager` - binary lifecycle
- [x] Create `CodexAppServer` - JSON-RPC client
- [x] Create `CodexAuth` - auth state management
- [x] Create module index for clean exports

**Phase 1: COMPLETE ✓**
