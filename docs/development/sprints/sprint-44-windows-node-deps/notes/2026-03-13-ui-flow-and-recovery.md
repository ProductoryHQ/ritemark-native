# 2026-03-13 UI Flow And Recovery Pass

## What Changed

- Claude setup now suppresses misleading install/repair actions when Windows prerequisites are already known to be missing.
- Claude sign-in is no longer offered when `powershell.exe` is unavailable on Windows; the API key path remains available.
- Claude setup adds a direct Git-for-Windows recovery action when Git is the detected blocker.
- Codex setup now exposes reload whenever the shared environment status says a reload is required.
- The AI sidebar can open the Git for Windows download page through the extension host.

## Why

The shared `AgentEnvironmentStatus` was already flowing into the webview, but the setup surfaces were still mostly passive. Users could still click generic install or sign-in actions and only then learn that Git or PowerShell was the real blocker.

This pass makes the setup UI react to the shared environment state earlier so the first visible action better matches the detected blocker.

## Verification

- `npm run compile` in `extensions/ritemark`
- `npm run build` in `extensions/ritemark/webview`
- `node --import=tsx src/agent/setup.test.ts`
- `node --import=tsx src/agent/installer.test.ts`

## Remaining Gaps

- The shared environment model still only recommends a narrow set of actions (`install-git`, `reload`).
- PowerShell recovery is still manual guidance rather than a first-class automated action.
- Codex-specific recovery guidance still needs a fuller pass for Windows-native bootstrap cases beyond reload visibility.
