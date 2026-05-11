---
name: ritemark-dev-smoke
description: Launch and validate the Ritemark desktop dev app with screenshots, logs, and Chrome DevTools Protocol. Use when asked to run dev, smoke-test Ritemark UI, verify browser/editor behavior, inspect local dev windows, or independently validate changes before handing them to the user.
---

# Ritemark Dev Smoke

Use this skill whenever a task requires validating Ritemark desktop behavior in a real dev instance instead of relying only on compile/test output.

## When To Use

- User asks to run dev, smoke test, validate UI, inspect Ritemark, or not return until tested.
- Browser/editor/webview behavior changed.
- A fix must be proven with screenshots/logs/CDP state.
- Previous behavior was flaky, visual, or only reproducible in the desktop app.

## Core Rule

Do not report “works” from code inspection alone. For UI/browser work, run the dev app, gather at least one objective signal, and report the exact validation path:

- command(s) run
- URL/file/command tested
- screenshot path or CDP/log evidence
- any remaining untested path

## Launch Clean Dev Instance

Prefer a fresh user-data dir for smoke tests to avoid stale windows and prior state:

```bash
pids=$(pgrep -f '/Users/jarmotuisk/Projects/ritemark-native/vscode/.build/electron/Ritemark.app' || true)
if [ -n "$pids" ]; then kill $pids || true; sleep 1; fi
pids=$(pgrep -f '/Users/jarmotuisk/Projects/ritemark-native/vscode/.build/electron/Ritemark.app' || true)
if [ -n "$pids" ]; then kill -9 $pids || true; fi

rm -rf /tmp/ritemark-dev-smoke

env \
  -u ELECTRON_RUN_AS_NODE \
  -u VSCODE_ESM_ENTRYPOINT \
  -u VSCODE_CRASH_REPORTER_PROCESS_TYPE \
  -u VSCODE_HANDLES_UNCAUGHT_ERRORS \
  -u VSCODE_NLS_CONFIG \
  -u VSCODE_IPC_HOOK \
  -u VSCODE_PID \
  -u VSCODE_CWD \
  -u VSCODE_L10N_BUNDLE_LOCATION \
  bash -lc 'source "$HOME/.nvm/nvm.sh" && nvm use 22.21.1 >/dev/null && ./vscode/scripts/code.sh --user-data-dir /tmp/ritemark-dev-smoke --disable-workspace-trust --disable-telemetry --remote-debugging-port=9223'
```

Run from repo root: `/Users/jarmotuisk/Projects/ritemark-native`.

### Why the env unsets matter

If `ELECTRON_RUN_AS_NODE` or VS Code extension-host env vars leak into the shell, Electron may start as Node and fail with misleading module/export errors. Always use the env-unset launch form above for dev smoke.

## Screenshots

Use macOS screenshot capture after significant UI state changes:

```bash
screencapture -x /tmp/ritemark-smoke.png
```

Then inspect with `view_image` when visual confirmation matters.

Known caveat: screenshots may capture the active Space/window, not necessarily the intended Ritemark window. If a screenshot is blank/wrong, use CDP state as objective evidence and capture again after bringing the target window forward.

## Chrome DevTools Protocol Checks

With `--remote-debugging-port=9223`, inspect targets:

```bash
curl -s http://127.0.0.1:9223/json/list | python3 -m json.tool
```

Useful target types:

- `page` with `workbench-dev.html` = Ritemark workbench UI.
- `page` with `https://...` or `file://...` = native Electron BrowserView page target.
- `iframe` with `vscode-webview://...` = extension webview frame.

### Minimal CDP pattern

Use Node's built-in `fetch` and `WebSocket` to evaluate state:

```bash
node - <<'NODE'
(async () => {
  const targets = await fetch('http://127.0.0.1:9223/json/list').then(r => r.json());
  const target = targets.find(t => t.type === 'page' && t.url.includes('workbench-dev'));
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  await new Promise(resolve => ws.onopen = resolve);
  async function send(method, params = {}) {
    const callId = ++id;
    ws.send(JSON.stringify({ id: callId, method, params }));
    return await new Promise(resolve => pending.set(callId, resolve));
  }
  const result = await send('Runtime.evaluate', {
    expression: 'document.title',
    returnByValue: true,
    awaitPromise: true,
  });
  console.log(JSON.stringify(result.result.result));
  ws.close();
})();
NODE
```

## Driving Command Palette

When no public API is available from the workbench page, drive keyboard events over CDP:

- Focus/escape current UI.
- `Meta+Shift+P` to open command palette.
- Insert command title text.
- Press Enter.
- Fill any input box.
- Press Enter.

For Sprint 65 browser smoke, the command title was:

```text
Ritemark Browser: Open URL in Ritemark Browser
```

## Browser Smoke Matrix

For in-app browser work, validate at minimum:

| Case | Expected evidence |
|---|---|
| `https://example.com` | title `Example Domain` and visible page screenshot |
| `https://google.com` | title `Google` / URL redirects to `https://www.google.com/` |
| `https://github.com` | GitHub title or expected auth/network state, not blank iframe |
| product site, e.g. `https://ritemark.app` | page title and real render |
| workspace `file://.../*.html` | local HTML renders as real browser page |
| relative local link | URL/title changes to target local file |
| `#anchor` | `location.hash` plus non-zero/expected `scrollY` |
| back/forward/reload | location/title transitions as expected |
| multiple tabs | tab labels show independent browser tabs |

Prefer checking native BrowserView page targets directly when possible:

```js
const browserTarget = targets.find(t => t.type === 'page' && (t.url.startsWith('http') || t.url.startsWith('file:')));
```

Then use `Page.navigate`, `Page.reload`, and `Runtime.evaluate` on that page target.

## Logs

Fresh dev logs with custom user-data dir are under:

```text
/tmp/ritemark-dev-smoke/logs/
```

Default dev logs are under:

```text
~/Library/Application Support/code-oss-dev/logs/
```

Check newest logs when a launch or UI smoke fails:

```bash
find /tmp/ritemark-dev-smoke/logs -maxdepth 4 -type f -name '*.log' -print | sort
```

## Known Pitfalls

- Stale killed dev windows can show “The window terminated unexpectedly”; kill old dev Ritemark processes and use fresh user-data dir.
- `osascript`/System Events may not have accessibility permissions; prefer CDP + screenshots over GUI automation.
- Production `/Applications/Ritemark.app` processes are not the same as repo dev app; avoid killing production unless explicitly needed.
- Extension webviews still produce normal `local-network-access` and sandbox warnings; do not confuse these with native BrowserView failures.
- If `node` is not `.nvmrc` version, source nvm and use `22.21.1` for project scripts.

## Validation Before Handoff

For substantial UI/browser changes, run:

```bash
cd extensions/ritemark && npm run compile
cd extensions/ritemark/webview && npm run build   # if webview changed
./scripts/validate-qa.sh
```

Then run the dev smoke and capture evidence. Report concise results and unresolved gaps; do not claim full smoke if any matrix item was skipped.
