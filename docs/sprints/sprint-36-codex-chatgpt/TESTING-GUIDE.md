# Testing Guide - Sprint 36: Codex Integration

**Purpose:** Verify the Codex CLI integration works correctly before merging to main.

**Prerequisites:**
- Ritemark Native development build
- ChatGPT Plus or Pro subscription (for OAuth testing)
- macOS (initial platform support)

---

## Quick Test Checklist

### Level 1: Feature Flag (No Codex Required)

**Goal:** Verify feature flag system works

- [ ] 1. Open Ritemark Native
- [ ] 2. Open Settings (Click AI Settings icon in sidebar)
- [ ] 3. Go to Features section
- [ ] 4. **Verify:** "Codex Integration" toggle is present with "Experimental" badge
- [ ] 5. **Verify:** Toggle is OFF by default
- [ ] 6. **Verify:** ChatGPT Account section is NOT visible (flag is off)
- [ ] 7. Toggle "Codex Integration" ON
- [ ] 8. **Verify:** ChatGPT Account section appears in API Keys area
- [ ] 9. **Verify:** Section shows "Sign in with ChatGPT" button
- [ ] 10. Toggle "Codex Integration" OFF
- [ ] 11. **Verify:** ChatGPT Account section disappears immediately

**Expected result:** Feature flag controls UI visibility. No crashes.

---

### Level 2: Binary Detection (Requires Codex Installed)

**Goal:** Verify binary detection and error messaging

**Setup:**
```bash
# Install Codex CLI
npm install -g @openai/codex

# Verify installation
which codex
codex --version
```

**Test Steps:**
- [ ] 1. Enable "Codex Integration" feature flag in Settings
- [ ] 2. Click "Sign in with ChatGPT" button
- [ ] 3. **Verify:** Button shows "Opening browser..." loading state
- [ ] 4. **Verify:** System browser opens to ChatGPT OAuth page
- [ ] 5. (Don't sign in yet) Close browser
- [ ] 6. **Verify:** Settings page returns to unauthenticated state

**Test without binary:**
- [ ] 1. Uninstall codex: `npm uninstall -g @openai/codex`
- [ ] 2. Enable feature flag in Settings
- [ ] 3. Click "Sign in with ChatGPT"
- [ ] 4. **Verify:** Error message appears:
   - Text: "Codex CLI is not installed..."
   - Suggests install command: `npm install -g @openai/codex` or `brew install --cask codex`
- [ ] 5. Reinstall codex: `npm install -g @openai/codex`
- [ ] 6. Refresh Settings page (close and reopen)
- [ ] 7. Click "Sign in with ChatGPT" again
- [ ] 8. **Verify:** Browser opens (no error)

**Expected result:** Clear error messages when binary is missing. Success when installed.

---

### Level 3: OAuth Flow (Requires ChatGPT Plus/Pro)

**Goal:** Complete full authentication flow

**Prerequisites:**
- ChatGPT Plus ($20/mo) or Pro ($200/mo) subscription
- Active internet connection

**Test Steps:**
- [ ] 1. Enable "Codex Integration" in Settings
- [ ] 2. Click "Sign in with ChatGPT" button
- [ ] 3. **Verify:** Browser opens to ChatGPT OAuth page
- [ ] 4. Sign in with ChatGPT credentials
- [ ] 5. **Verify:** Browser shows "Authentication successful" or redirects
- [ ] 6. Return to Ritemark Settings page
- [ ] 7. **Verify:** ChatGPT Account section shows authenticated state:
   - Green checkmark with "Connected" badge
   - Email address displayed
   - Plan type (e.g., "ChatGPT Plus")
   - API credits (e.g., "$5.00 / $5.00 remaining")
   - "Sign Out" button visible
- [ ] 8. Close and reopen Settings page
- [ ] 9. **Verify:** Auth state persists (still shows as authenticated)

**Test Sign Out:**
- [ ] 1. Click "Sign Out" button
- [ ] 2. **Verify:** Section returns to unauthenticated state:
   - "Sign in with ChatGPT" button reappears
   - Email, plan, credits no longer shown
- [ ] 3. **Verify:** VS Code shows notification: "Signed out from ChatGPT"

**Test Auth Persistence:**
- [ ] 1. Sign in again
- [ ] 2. Close Ritemark Native completely
- [ ] 3. Reopen Ritemark Native
- [ ] 4. Open Settings
- [ ] 5. **Verify:** Still authenticated (credentials stored in OS keyring)

**Expected result:** OAuth flow completes successfully. Auth state persists across sessions.

---

### Level 4: Edge Cases

**Test 1: OAuth Timeout**
- [ ] 1. Click "Sign in with ChatGPT"
- [ ] 2. Wait for browser to open
- [ ] 3. Wait 5 minutes without signing in
- [ ] 4. **Verify:** No crash, Settings page still responsive
- [ ] 5. Click "Sign in with ChatGPT" again
- [ ] 6. **Verify:** New OAuth flow starts

**Test 2: Network Failure**
- [ ] 1. Disconnect from internet
- [ ] 2. Click "Sign in with ChatGPT"
- [ ] 3. **Verify:** Error message appears (network-related)
- [ ] 4. Reconnect to internet
- [ ] 5. Retry
- [ ] 6. **Verify:** OAuth works

**Test 3: Multiple Settings Windows**
- [ ] 1. Open Settings (Window A)
- [ ] 2. Sign in with ChatGPT
- [ ] 3. Open Settings again (Window B)
- [ ] 4. **Verify:** Both windows show authenticated state
- [ ] 5. Sign out from Window A
- [ ] 6. **Verify:** Window B also updates to unauthenticated state

**Test 4: Feature Flag Toggle While Authenticated**
- [ ] 1. Sign in with ChatGPT
- [ ] 2. Toggle "Codex Integration" OFF
- [ ] 3. **Verify:** ChatGPT Account section disappears
- [ ] 4. Toggle "Codex Integration" ON
- [ ] 5. **Verify:** Section reappears with authenticated state (credentials not lost)

**Test 5: Invalid Credentials (Manual)**
This requires deliberately corrupting credentials in OS keyring (advanced).
- [ ] Expected behavior: Auth status shows "authenticated: false", user can re-sign in

---

## Developer Testing

**Compile Extension:**
```bash
cd /home/user/ritemark-native/extensions/ritemark
npm run compile
```

**Check for TypeScript Errors:**
```bash
cd /home/user/ritemark-native/extensions/ritemark
npx tsc --noEmit
```

**Expected:** No compilation errors.

**Verify Feature Gate:**
```typescript
// In browser console (after opening Settings):
// Check if feature is enabled
const enabled = vscode.postMessage({ type: 'getSetting', key: 'experimental.codexIntegration' });
```

**Check Codex Process:**
```bash
# While Settings page is open and authenticated:
ps aux | grep codex

# Expected output:
# codex app-server (if binary is spawned)
```

**Check Logs:**
```bash
# In VS Code Extension Host output:
# Should see:
# - Codex app-server spawned
# - RPC requests/responses (if debug logging enabled)
# - Auth status changed events
```

---

## Regression Testing (Existing Features)

**Goal:** Ensure Codex integration doesn't break existing functionality

**Test OpenAI API Key (Existing):**
- [ ] 1. Enter OpenAI API key in Settings
- [ ] 2. Click "Save"
- [ ] 3. Click "Test"
- [ ] 4. **Verify:** Test succeeds (green checkmark)
- [ ] 5. Use AI Assistant (sidebar)
- [ ] 6. **Verify:** AI features work normally

**Test Google AI Key (Existing):**
- [ ] 1. Enter Google AI API key
- [ ] 2. Save and test
- [ ] 3. **Verify:** Works as before

**Test Other Features:**
- [ ] Voice Dictation toggle (doesn't affect Codex)
- [ ] Ritemark Flows toggle
- [ ] Updates toggle
- [ ] AI Model selector

**Expected result:** All existing features work unchanged. No interference from Codex code.

---

## Performance Testing

**Goal:** Ensure feature flag = OFF has zero performance impact

**Test 1: Extension Startup Time**
- [ ] 1. Disable "Codex Integration" in Settings
- [ ] 2. Close Ritemark Native
- [ ] 3. Measure extension activation time (Extension Host output)
- [ ] 4. Enable "Codex Integration"
- [ ] 5. Close and reopen
- [ ] 6. Measure again
- [ ] **Verify:** No significant difference (< 10ms)

**Test 2: Memory Usage**
- [ ] 1. Open Task Manager / Activity Monitor
- [ ] 2. Check Ritemark memory usage (flag OFF)
- [ ] 3. Enable flag (but don't sign in)
- [ ] 4. Check memory again
- [ ] **Verify:** Minimal increase (< 5MB)

**Test 3: Settings Page Load Time**
- [ ] 1. Open Settings (flag OFF)
- [ ] 2. Note load time
- [ ] 3. Enable flag
- [ ] 4. Close and reopen Settings
- [ ] 5. Note load time
- [ ] **Verify:** No perceptible slowdown

---

## Platform-Specific Testing

### macOS (Primary Target)
- [ ] macOS 13+ (Ventura)
- [ ] macOS 14+ (Sonoma)
- [ ] macOS 15+ (Sequoia)
- [ ] Apple Silicon (arm64)
- [ ] Intel (x86_64)

**All tests above should pass on macOS.**

### Windows (Deferred)
- [ ] Codex installation works (`npm install -g @openai/codex`)
- [ ] Binary detection works (`which codex` equivalent)
- [ ] OAuth browser launch works
- [ ] Credentials stored in Windows Credential Manager

**Note:** Windows support is not tested in this sprint. Document issues if tested.

### Linux (Deferred)
- [ ] Codex installation works
- [ ] libsecret available for credential storage
- [ ] Browser launch works

**Note:** Linux support is not tested in this sprint.

---

## Known Issues (Document if Found)

| Issue | Platform | Severity | Workaround |
|-------|----------|----------|------------|
| (Example) Browser doesn't open | macOS | Medium | Manually visit localhost:9119 |
| | | | |

---

## Approval Criteria

**Minimum for merge to main:**
- [x] Level 1 tests pass (Feature Flag)
- [ ] Level 2 tests pass (Binary Detection) *(requires Codex installed)*
- [ ] Level 3 tests pass (OAuth Flow) *(requires ChatGPT Plus/Pro)*
- [x] No regressions (existing features work)
- [x] No TypeScript errors
- [x] Code compiles successfully

**For full release (future sprint):**
- [ ] All edge cases handled
- [ ] Windows testing complete
- [ ] Linux testing complete
- [ ] Performance benchmarks documented
- [ ] User documentation written
- [ ] Beta testing with real users

---

## Test Results Template

```markdown
## Test Results - Sprint 36

**Tester:** [Name]
**Date:** [YYYY-MM-DD]
**Platform:** macOS [version] / Windows [version] / Linux [distro]
**Architecture:** arm64 / x86_64
**Codex Version:** [output of `codex --version`]
**ChatGPT Plan:** Plus / Pro / Free

### Level 1: Feature Flag
- [ ] Pass / [ ] Fail
- Notes:

### Level 2: Binary Detection
- [ ] Pass / [ ] Fail / [ ] Not Tested
- Notes:

### Level 3: OAuth Flow
- [ ] Pass / [ ] Fail / [ ] Not Tested
- Notes:

### Level 4: Edge Cases
- [ ] Pass / [ ] Fail / [ ] Not Tested
- Notes:

### Regressions
- [ ] None detected / [ ] Issues found (list below)
- Notes:

### Issues Found
1. [Issue description]
   - Severity: Low / Medium / High / Critical
   - Steps to reproduce:
   - Expected:
   - Actual:
```

---

## Debugging Tips

### If binary doesn't spawn:
```bash
# Check PATH
echo $PATH | tr ':' '\n' | grep -i codex

# Check permissions
ls -la $(which codex)

# Test manual spawn
codex app-server
# Should start and wait for JSON-RPC input
```

### If OAuth doesn't work:
```bash
# Check Codex config
cat ~/.codex/config.toml

# Check keyring access (macOS)
security find-generic-password -s "codex"

# Try device-code auth instead
codex login --device-auth
```

### If Settings page doesn't update:
1. Open VS Code Developer Tools (Help → Toggle Developer Tools)
2. Check Console for errors
3. Check Network tab for failed requests
4. Check Extension Host output

### If RPC fails:
1. Add debug logging to `CodexAppServer.ts`:
   ```typescript
   private handleStdout(data: string): void {
     console.log('[CODEX STDOUT]', data); // <-- Add this
     // ...
   }
   ```
2. Recompile: `npm run compile`
3. Check Extension Host output for RPC messages

---

**Last Updated:** 2026-02-14
**Sprint:** 36 - Codex CLI Integration
**Testing Phase:** Pre-merge validation
