#!/usr/bin/env node
// Evaluate a JS expression in any CDP target (page, iframe/webview) and print
// the result. Used for debugging INSIDE VS Code webviews, where agent-browser
// only drives the top-level workbench page.
//
// Usage:
//   NODE_PATH=/Users/jarmotuisk/Projects/ritemark-native/vscode/node_modules \
//     node cdp-eval.js [--await] <webSocketDebuggerUrl> <expression>
//
//   --await  : awaitPromise (expression may return a Promise)
//
// Get target websocket URLs from: curl -s http://localhost:9224/json/list
// NODE_PATH must be ABSOLUTE — 'ws' is resolved from vscode/node_modules.
const args = process.argv.slice(2);
const awaitPromise = args[0] === '--await';
if (awaitPromise) args.shift();
const [wsUrl, expr] = args;
if (!wsUrl || !expr) {
  console.error('usage: cdp-eval.js [--await] <wsUrl> <expression>');
  process.exit(2);
}
const WebSocket = require('ws');
const ws = new WebSocket(wsUrl);
let id = 0;
ws.on('open', () => {
  ws.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
  ws.send(JSON.stringify({
    id: ++id,
    method: 'Runtime.evaluate',
    params: { expression: expr, returnByValue: true, awaitPromise }
  }));
});
ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 2) {
    console.log(JSON.stringify(msg.result, null, 2).slice(0, 4000));
    ws.close();
    process.exit(0);
  }
});
ws.on('error', (e) => { console.error('ws error:', e.message); process.exit(1); });
setTimeout(() => { console.error('timeout'); process.exit(1); }, 15000);
