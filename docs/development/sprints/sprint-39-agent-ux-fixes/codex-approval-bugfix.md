# Codex Approval Dialog Bug Fix

**Date:** 2026-03-13
**Severity:** Critical — all Codex approvals were silently denied

## Bug Description

Codex approval dialogs never appeared in the UI. When Codex needed user permission to run a shell command or modify files, the request was silently auto-denied and the user never saw the approval dialog.

### Symptoms
- Codex reports "the system rejected the escalated command confirmation"
- Codex suggests running commands manually in terminal
- Approval dialog UI exists but is never rendered

## Root Cause

**Method name mismatch** between what Codex app-server sends and what our handler expected.

| What Codex sends | What we checked for |
|---|---|
| `item/commandExecution/requestApproval` | `execCommandApproval` |
| `item/fileChange/requestApproval` | `applyPatchApproval` |

All incoming approval requests fell through to the `else` branch in `UnifiedViewProvider.ts:993-1013` which auto-denied them with `sendApprovalResponse(id, 'denied')`.

### Secondary issue: missing `approvalPolicy`

`threadStart` was called without `approvalPolicy` parameter, defaulting to Codex's internal default (`on-failure`). This meant Codex only asked for approval on sandbox failures, not proactively.

### Third issue: missing `sandbox` parameter — read-only filesystem

`threadStart` was also missing the `sandbox` parameter, defaulting to Codex's `"read-only"` mode. This meant **Codex could not write files at all** — even if the approval dialog had worked, file writes would have been blocked by the sandbox.

Confirmed by user's debug session where Codex reported:
- `sandbox_mode` is `read-only`
- `apply_patch` returned `patch rejected by user`
- `exec_command` returned `Rejected("rejected by user")`

The full failure chain: sandbox blocks write → Codex escalates → our handler doesn't recognize method name → auto-denies → Codex sees "rejected by user".

## Fix

### 1. Extracted `routeApprovalRequest()` (testable, correct method names)

New file: `src/codex/codexApproval.ts`
- Maps real Codex method names to internal approval types
- Handles `command` param as both array and string
- Handles `fileChanges` and legacy `changes` key

### 2. Updated `UnifiedViewProvider.ts`
- Uses `routeApprovalRequest()` instead of hardcoded method name checks
- Added `console.warn` for unknown methods (visibility for future protocol changes)

### 3. Added `approvalPolicy` + `sandboxMode` settings
- New setting: `ritemark.codex.approvalPolicy` (on-request | on-failure | never), default: `on-request`
- New setting: `ritemark.codex.sandboxMode` (read-only | workspace-write | danger-full-access), default: `workspace-write`
- Both passed to `threadStart()` call

### 4. Repro tests

`src/codex/codexApproval.test.ts` — 7 tests covering:
1. Real command approval method name recognized
2. Real file change approval method name recognized
3. Old (wrong) method names correctly denied
4. Unknown methods denied
5. Command as string (not array)
6. Legacy `changes` key for file approvals
7. Method name constants match protocol spec

## Files Changed

| File | Change |
|---|---|
| `src/codex/codexApproval.ts` | NEW — approval routing logic |
| `src/codex/codexApproval.test.ts` | NEW — 7 repro/regression tests |
| `src/codex/index.ts` | Added export |
| `src/views/UnifiedViewProvider.ts` | Fixed routing + added approvalPolicy + sandbox |
| `package.json` | Added `ritemark.codex.approvalPolicy` + `sandboxMode` settings |
