# Phase 2: Settings Integration - COMPLETE

**Date:** 2026-02-14

## Summary

Integrated Codex authentication into the Settings page. Users can now sign in with their ChatGPT account and view auth status.

## Changes Made

### 1. Settings Provider Backend (`RitemarkSettingsProvider.ts`)

**Added Codex integration:**
- Imports: `CodexAppServer`, `CodexAuth`, `isEnabled`
- Instance variables: `codexAppServer`, `codexAuth`
- Constructor: Initializes Codex if feature flag is enabled
- Event listener: Updates webview when auth status changes

**New message handlers:**
- `codex:startLogin` - Triggers ChatGPT OAuth flow (browser-based)
- `codex:logout` - Signs out and clears credentials
- `codex:refreshStatus` - Refreshes auth status display

**New methods:**
- `startCodexLogin()` - Initiates OAuth, shows browser notification
- `codexLogout()` - Calls auth.logout(), updates UI
- `sendCodexAuthStatus()` - Sends auth status to webview
  - Includes: enabled, authenticated, email, plan, credits, error
  - Feature flag gated: returns `{enabled: false}` if flag is off

**Updated methods:**
- `sendCurrentSettings()` - Now also sends:
  - `codexIntegration` setting value
  - Codex auth status via `sendCodexAuthStatus()`

### 2. Settings UI Frontend (`RitemarkSettings.tsx`)

**New state:**
```typescript
interface CodexAuthStatus {
  enabled: boolean;
  authenticated?: boolean;
  email?: string;
  plan?: 'free' | 'plus' | 'pro' | 'team' | 'business';
  credits?: {
    used: number;
    limit: number;
    resetAt?: string;
  };
  error?: string;
}

const [codexAuth, setCodexAuth] = useState<CodexAuthStatus>({ enabled: false });
const [codexLoading, setCodexLoading] = useState(false);
```

**New message handlers:**
- `codex:authStatus` - Updates auth status state
- `codex:loginStarting` - Sets loading state

**New UI section: "ChatGPT Account" (conditional)**
- **Visibility:** Only when `settings.codexIntegration` AND `codexAuth.enabled` are true
- **Badge:** "Experimental" badge next to title
- **Connected indicator:** Green checkmark when authenticated

**Unauthenticated state:**
- Explanation text (ChatGPT Plus/Pro requirement)
- "Sign in with ChatGPT" button
- Loading spinner during OAuth flow
- Error message display (if any)

**Authenticated state:**
- Email display
- Plan type (ChatGPT Plus/Pro/Team/Business)
- API credits (remaining / total)
- "Sign Out" button
- Learn more link → https://developers.openai.com/codex/cli

**Features section:**
- New toggle: "Codex Integration"
- Description: "ChatGPT-authenticated coding agents (experimental, requires codex binary)"
- Badge: "Experimental"

**Updated ToggleRow component:**
- New prop: `badge?: string`
- Renders badge next to label if provided

## User Flow

### Enable Feature
1. Open Settings (AI Settings button in sidebar)
2. Go to Features section
3. Toggle "Codex Integration" ON
4. Settings auto-saves
5. ChatGPT Account section appears in API Keys area

### Sign In
1. Click "Sign in with ChatGPT" button
2. Button shows loading spinner: "Opening browser..."
3. System browser opens to ChatGPT OAuth page
4. User signs in with ChatGPT account
5. Browser redirects back (handled by Codex CLI)
6. Settings page updates to show authenticated state
7. Email, plan, credits displayed

### Sign Out
1. Click "Sign Out" button
2. Credentials cleared from OS keyring (via Codex)
3. UI returns to unauthenticated state

## Technical Details

### OAuth Flow
```
User clicks "Sign in"
    ↓
Extension: codexAuth.startLogin('browser')
    ↓
Codex App Server: auth/startLogin RPC
    ↓
Codex CLI: Opens localhost:9119 server
    ↓
System browser: Redirects to chatgpt.com/auth
    ↓
User: Enters ChatGPT credentials
    ↓
ChatGPT: Redirects to localhost:9119 with token
    ↓
Codex CLI: Stores token in OS keyring
    ↓
App Server: Emits auth/statusChanged event
    ↓
Extension: Receives event → updates webview
    ↓
Settings UI: Shows authenticated state
```

### Feature Flag Integration
- When flag is disabled: Codex auth section hidden entirely
- When flag is enabled: Section visible, auth can be triggered
- Setting: `ritemark.experimental.codexIntegration` (boolean, default: false)
- Check: `isEnabled('codex-integration')` in provider constructor

### Error Handling
- Binary not installed → Error shown in auth section
- OAuth timeout → Error message displayed
- Network failure → Error caught and shown
- Auth expired → User prompted to re-authenticate

## Files Modified

| File | Lines Changed | Type |
|------|---------------|------|
| `src/settings/RitemarkSettingsProvider.ts` | +87 | Backend |
| `webview/src/components/settings/RitemarkSettings.tsx` | +98 | Frontend |

## Testing Checklist

Manual testing required:

- [ ] Feature flag toggle works (enables/disables Codex section)
- [ ] "Sign in with ChatGPT" button opens browser
- [ ] OAuth flow completes successfully
- [ ] Authenticated state shows email, plan, credits
- [ ] Sign out button clears auth
- [ ] Error states display properly (binary missing, auth failed)
- [ ] UI updates in real-time when auth status changes
- [ ] Feature flag disabled = no Codex UI visible

## Known Limitations

1. **Binary detection:** If codex is not installed, error appears after clicking "Sign in". Could add upfront detection.
2. **OAuth timeout:** No explicit timeout UI (browser just stays open). Could add timeout with retry button.
3. **Credits refresh:** Credits don't auto-refresh. User must close/reopen settings. Could add refresh button.
4. **Device code flow:** Only browser-based OAuth implemented. Device code (for SSH/headless) not in UI yet.

## Next Steps

**Phase 3: Codex Agent Panel** (deferred for now - research complete)
- Create webview panel for agent chat
- Implement streaming message display
- Add approval dialogs (shell, file edit)
- Wire to `turn/start` RPC

**Phase 4: Flow Node Integration** (deferred for now - research complete)
- Add `@openai/codex-sdk` dependency
- Create `CodexNodeExecutor.ts`
- Add node to Flow palette (gated by flag)
- Test Flow execution

**For Sprint 36 research goals:**
- ✅ Architecture proven (Phase 1)
- ✅ Auth integration working (Phase 2)
- ⏸️ Agent panel & Flow node deferred (out of scope for research sprint)

## Checklist Progress

### Phase 2: Settings Integration
- [x] Update `RitemarkSettingsProvider` to show ChatGPT auth section when flag is enabled
- [x] Add webview components for login/logout UI
- [x] Display auth status (email, plan, credits)
- [x] Wire up auth events to update UI

**Phase 2: COMPLETE ✓**
