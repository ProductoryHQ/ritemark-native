# Sprint 57 Addendum — Sign-In UX Unification

Date: 2026-05-02
Status: Active (release blocker for v1.6.1)

## Why this addendum

Sprint 57 introduced "truthful Claude auth + terminal-free sign-in UX" (commit `54443d0`). That work landed only on the **Settings** surface. Two other surfaces still ship the old / broken / missing sign-in experiences and Jarmo found both during v1.6.1 Gate 1 testing:

1. **Claude in the AI sidebar** still calls `openClaudeLoginTerminal()` — the Sprint-57-replaced terminal flow. It does not open the Claude.ai sign-in browser, so a logged-out user has no path forward from the AI sidebar.
2. **Codex in the AI sidebar** shows the empty conversation state ("Codex Agent / Type a message to start.") even when the user is signed out of ChatGPT. There is no sign-in CTA, even though `CodexSetupView` exists and is wired into `AISidebar.tsx` — the gating condition `codexStatus.state === 'ready'` is reporting `ready` for a user who has no active Codex session.

Both must be fixed before v1.6.1 can ship — half-working auth flows are worse than a single broken one because a non-technical user cannot tell which surface to trust.

## Scope

In scope:
- Migrate AI sidebar Claude login to the same terminal-free subprocess flow Settings uses. After fix, both surfaces share one execution path (single source of truth in `agent/installer.ts`), so future fixes do not have to be applied twice.
- Diagnose why `_getCodexSidebarStatus` returns `state: 'ready'` for an unauthenticated user. Fix detection at the source so `CodexSetupView` is shown the moment the panel opens to a signed-out user.
- Re-test Gate 1 against a clean signed-out state for both Claude and Codex.

Explicitly **not** in scope (defer to a separate sprint or v1.6.2):
- Onboarding-wizard-level changes that present Claude + Codex sign-in side by side.
- ChatGPT plan / quota indicators on the AI sidebar.
- Refactoring the AI sidebar message protocol (`agent-setup:*` vs `claude:*` vs `codex:*`) — only the handlers change, not the message types.

## Bug A — Claude AI sidebar login

### Current behavior (broken)

`extensions/ritemark/src/views/UnifiedViewProvider.ts:1527` `_handleClaudeLogin()`:

```ts
setClaudeLoginInProgress(true);
this._startClaudeLoginPolling();
emitClaudeStatusInvalidated('login-started');
openClaudeLoginTerminal(status.binaryPath);   // ← old flow
```

`openClaudeLoginTerminal` opens a VS Code terminal, runs `claude /login`, and expects the user to follow CLI instructions. Sprint 57 explicitly moved away from this because non-technical Windows users can't deal with it. Settings now uses `startClaudeLoginSubprocess(binaryPath, callbacks)` which spawns `claude /login` headless and surfaces lifecycle events through callbacks — no terminal, no shell prompts, just an automatic browser hand-off.

### Target behavior

AI sidebar `_handleClaudeLogin()` calls the same subprocess factory that Settings uses, with AI-sidebar-targeted callbacks (post `agent-setup:progress` + `agent-setup:complete` instead of Settings' message types).

### Implementation steps

1. Add a `claudeLoginSubprocess: ClaudeLoginSubprocessHandle | null` field on `UnifiedViewProvider` (mirror of the Settings provider's field).
2. Replace `_handleClaudeLogin()` body with the subprocess flow:
   - Reuse `getSetupStatus` / `getAgentEnvironmentStatus` checks (already there).
   - Kill any existing `this.claudeLoginSubprocess` before starting.
   - Call `startClaudeLoginSubprocess(status.binaryPath, { onSuccess, onCancel, onError })`.
   - Map the three callbacks to the AI sidebar's existing `agent-setup:progress` / `agent-setup:complete` / `agent-setup:error` messages so the React store doesn't change.
   - Keep the existing `_startClaudeLoginPolling` — it watches keychain and updates the auth method independently.
3. Add a `claude:cancelLogin`-equivalent message on the AI sidebar for parity, wired to kill the subprocess when the user dismisses the wizard (same as Settings has). Match the existing UI: SetupWizard already has `dismissWelcome`, can reuse the dismiss path for cancellation.
4. Remove the now-unused `openClaudeLoginTerminal` import from `UnifiedViewProvider.ts` (memory rule: VS Code build is strict on unused imports). Keep the function in `agent/installer.ts` for now — Settings doesn't use it but the export is referenced from `agent/index.ts` and removing exports has wider blast radius. Tag with a deprecation comment.
5. Optional cleanup: extract the shared "start Claude login" body (status validation + subprocess spawn + lifecycle wiring) into a `agent/claudeLoginFlow.ts` helper that takes a `messageEmitter` callback. Both `RitemarkSettingsProvider` and `UnifiedViewProvider` call it. Decide during implementation — if it shrinks the duplication meaningfully, do it; otherwise inline copy is fine for two callers.

### Verification

- Sign out via `claude logout` (or via Settings UI) so the OS keychain is empty.
- Open AI sidebar Claude tab — it shows the SetupWizard with the "Sign in with Claude.ai" button.
- Click the button — browser opens to the Claude.ai sign-in page within ~2s. **No terminal opens.**
- Complete sign-in in browser — the AI sidebar updates to "ready" without a window reload.
- Repeat from Settings — same behavior. Both surfaces stay in sync because they call the same subprocess and the same polling already drives status updates.

## Bug B — Codex AI sidebar shows "ready" for signed-out user

### Current behavior (broken)

`AISidebar.tsx:124`: `const showCodexSetup = isCodex && codexStatus.state !== 'ready';`

`UnifiedViewProvider.ts:806` `_getCodexSidebarStatus()` returns `state: 'ready'` whenever `codexAuth.getStatus()` resolves with `authenticated: true`. If we are seeing `ready` for a logged-out user, one of three things is happening:

1. The Codex app-server's `getAccount` response keeps an `account` object even after the user has logged out from another surface, so `account.account !== null` stays true on stale state.
2. The webview loaded its first `codexStatus` snapshot when the user *was* authenticated, and the panel never received a refresh after the user signed out somewhere else.
3. The status snapshot was cached at extension boot from a stale `~/.codex/auth.json` that lingered after a half-finished sign-out elsewhere.

### Diagnostic steps (to run before implementing the fix)

1. With user logged out, hit the AI sidebar Codex tab and capture three things:
   - The exact value of `codexStatus.state` arriving in the webview store (add a temporary `console.log` or use the existing `[Ritemark]` log surface).
   - The result of `await this._codexAuth!.getStatus()` server-side (existing `console.error` already logs failures; add a `console.info` for the success path during diagnosis).
   - Whether `~/.codex/auth.json` exists and what it contains.
2. Repeat from Settings for the same logged-out account — Settings shows "Sign in with ChatGPT" correctly, so its status query must be diverging from the AI sidebar's.

### Likely fix shape

If app-server status is stale: invalidate Codex auth cache on every panel open, plus on `agent-setup:check` / panel-visibility-change events. The AI sidebar already calls `_postCodexSidebarStatus(...)` on visibility changes — verify the path runs `getStatus` fresh and not a cached value.

If the webview holds stale state: have the AI sidebar trigger a `codex:refreshStatus` (or `_postCodexSidebarStatus` from extension side) every time the user switches the agent dropdown to Codex. Mirrors the Claude side, where `agent-setup:check` runs on visibility change.

If `~/.codex/auth.json` is the source of truth and contains stale data, harden `codexAuth.getStatus()` to treat a missing/empty account as `authenticated: false` even if app-server returns a phantom record.

### Implementation steps (refined after diagnostic)

1. Pick the right narrowing from the three options above based on what the diagnostic shows. Do not bypass detection at the UI layer (i.e. do not add `&& codexConversation.length > 0` or similar — that hides the bug, not the fix).
2. Apply the fix to `UnifiedViewProvider._getCodexSidebarStatus()` or `codexAuth.getStatus()` whichever is the actual source. Verify the fix shows up in both surfaces (Settings and AI sidebar) without surface-level changes.
3. Confirm `_postCodexSidebarStatus` is called on:
   - Agent selector change to Codex (already a panel event).
   - Initial AI sidebar show.
   - The same intervals Settings uses (so both surfaces drift together).

### Verification

- Sign out via `codex logout` so `~/.codex/auth.json` is in the post-logout state.
- Open AI sidebar Codex tab — it shows `CodexSetupView` with the "Sign in with ChatGPT" button. The audit / compatibility notice continues to render (that's independent state).
- Click "Sign in with ChatGPT" — browser opens to the ChatGPT sign-in. Existing `_handleCodexLogin` already drives this; no changes needed.
- Complete sign-in — AI sidebar transitions to the empty `CodexView` ("Type a message to start") within a few seconds.
- Sign out again from Settings — both surfaces update to the signed-out state on next visibility change. No ghost "ready" state.

## Build + release plan

After both bugs are fixed and locally verified:

1. Commit message: `fix(sprint-57): unify Claude AI sidebar + Codex AI sidebar sign-in flows`. Reference this addendum.
2. Re-run Phase C of the v1.6.1 release process: build-prod.sh → codesign-app.sh → create-dmg.sh → notarize-dmg.sh.
3. Update `docs/releases/v1.6.1/release-notes.md` with the additional fix line so it doesn't read like a clean Sprint 56 + 57 release.
4. Hand off the new arm64 DMG + SHA256 to Jarmo for Gate 1 retry. Test surfaces explicitly:
   - Claude AI sidebar sign-out + sign-in via the side panel button.
   - Codex AI sidebar sign-out + sign-in via the side panel button.
   - Same flows still work via Settings (no regression there).
5. Once Gate 1 passes for both surfaces: tag, push, CI Windows + x64, Gate 2.

## Risks

- The `_handleClaudeLogin` migration touches a file (`UnifiedViewProvider.ts`) that has wide responsibilities (the entire AI sidebar). Keep the diff narrow — only the login function and its imports.
- The Codex bug may have a deeper root cause than the three diagnostic options listed (e.g. an app-server protocol regression after the upstream Sprint 55 VS Code 1.117 bump). If the diagnostic shows something outside the three options, stop and re-plan instead of guessing.
- We are now ~3 commits and one full release cycle away from a clean v1.6.1 ship. Each retry burns ~10–25 minutes of build + notarize time. Verify locally with the unsigned `VSCode-darwin-arm64/Ritemark.app` (per Jarmo's earlier diagnostic flow) before re-signing — sign + DMG + notarize should be the last steps, not retry-loop steps.
