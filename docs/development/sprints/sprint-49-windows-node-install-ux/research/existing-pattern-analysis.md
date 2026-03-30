# Research: Windows Node.js Install UX — Existing Pattern Analysis

## Goal

Understand the existing Git-for-Windows install prompt pattern so we can replicate it exactly for Node.js.

## Files Involved

| File | Role |
|------|------|
| `extensions/ritemark/src/agent/setup.ts` | Detects environment, returns `recommendedAction` |
| `extensions/ritemark/src/agent/types.ts` | `AgentEnvironmentRecommendedAction` union type (extension side) |
| `extensions/ritemark/webview/src/components/ai-sidebar/types.ts` | Same union, mirrored for webview |
| `extensions/ritemark/webview/src/components/ai-sidebar/store.ts` | Zustand store — actions, message dispatch |
| `extensions/ritemark/webview/src/components/ai-sidebar/SetupWizard.tsx` | Renders install buttons, reads store |
| `extensions/ritemark/webview/src/components/ai-sidebar/EnvironmentStatusNotice.tsx` | Shows diagnostic text and contextual hints |
| `extensions/ritemark/src/views/UnifiedViewProvider.ts` | Receives webview messages, opens URLs |

## How Git-for-Windows Works (the template)

### 1. Detection (`setup.ts`)

`checkCommandAvailable('git')` → stored as `gitInstalled` in `AgentEnvironmentStatus`.

`recommendedEnvironmentAction()` returns `'install-git'` when:
- `platform === 'win32'` AND
- `!gitInstalled` AND
- `!restartRequired`

### 2. Type definition (`types.ts` + webview `types.ts`)

```typescript
export type AgentEnvironmentRecommendedAction = 'install-git' | 'reload' | null;
```

Both files contain this identical union.

### 3. Diagnostic message (`setup.ts` line 431–432)

```typescript
if (platform === 'win32' && !gitInstalled) {
  diagnostics.push('Git for Windows not detected. Claude on Windows may require Git Bash.');
}
```

The `EnvironmentStatusNotice` renders all `diagnostics` strings. No per-item changes needed there for the diagnostic text.

### 4. Contextual hint (`EnvironmentStatusNotice.tsx`)

```tsx
{environmentStatus.recommendedAction === 'install-git' && (
  <div className="mt-2 text-xs opacity-80">
    Install Git for Windows first, then retry setup.
  </div>
)}
```

### 5. Action button (`SetupWizard.tsx`)

```tsx
const missingGit = environmentStatus?.platform === 'win32' && !environmentStatus?.gitInstalled;
const installBlockedByEnvironment = installOrRepairStep && (missingGit || missingPowerShell);

{installOrRepairStep && missingGit && (
  <SecondaryButton onClick={openGitDownload}>
    <Wrench className="h-3.5 w-3.5" />
    Get Git for Windows
  </SecondaryButton>
)}
```

The `installBlockedByEnvironment` flag also hides the "Install Claude" button when Git is missing.

### 6. Store action (`store.ts`)

```typescript
openGitDownload: () => {
  vscode.postMessage({ type: 'agent-setup:open-git-download' });
},
```

### 7. Message handler (`UnifiedViewProvider.ts`)

```typescript
case 'agent-setup:open-git-download':
  await vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/download/win'));
  break;
```

## Node.js Equivalent Plan

| Step | Change |
|------|--------|
| `setup.ts` `recommendedEnvironmentAction` | Add `nodeInstalled` param; return `'install-node'` when win32 + !nodeInstalled + !restartRequired (after git check) |
| `types.ts` | Add `'install-node'` to union |
| `webview/types.ts` | Add `'install-node'` to union |
| `EnvironmentStatusNotice.tsx` | Add hint for `recommendedAction === 'install-node'` |
| `SetupWizard.tsx` | Add `missingNode`, add to `installBlockedByEnvironment`, add "Get Node.js" button |
| `store.ts` | Add `openNodeDownload` action |
| `UnifiedViewProvider.ts` | Handle `agent-setup:open-node-download`, open `https://nodejs.org/en/download` |

## Priority / Blocking Logic

Node.js is required to run Claude (it is an npm package). Git is also required. The question is: should we block on Node *before* Git, *after* Git, or check both independently?

Looking at `installBlockedByEnvironment`:
```typescript
const installBlockedByEnvironment = installOrRepairStep && (missingGit || missingPowerShell);
```

Node.js should be added to this same gate. Both buttons should show simultaneously if both are missing. The `recommendedAction` in that case needs a priority; returning `'install-node'` when Node is missing (and Git is present) is the clearest UX — if both are missing, Git takes priority (existing behavior already handles that).

## Node.js Download URL

`https://nodejs.org/en/download` — the official download page, platform-agnostic so Windows users see the Windows installer.

## Test Scope

- Unit test: `setup.test.ts` — add test for `recommendedEnvironmentAction` returning `'install-node'`
- Manual: simulate `nodeInstalled: false` in dev to verify button renders and link opens
