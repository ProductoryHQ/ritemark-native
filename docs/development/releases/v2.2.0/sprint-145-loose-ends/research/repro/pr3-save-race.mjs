#!/usr/bin/env node
// Sprint 145 PR 3, review round 1 (R4, #571): an edit made while the host writes the flow is written too.
//
//   node pr3-save-race.mjs [--runs 3] [--answer-after 600] [--chrome <path>]
//
// Opens Sprint 144's flow harness (the committed media/webview.js as the Flow editor, a stand-in host) in a headless
// Chromium over raw CDP (Node 22's WebSocket, no npm packages). The stand-in answers each flow:save with flow:saved
// --answer-after ms later, as a slow write would. The run types a step's label ("First"), waits for the autosave to
// send it, types again ("Second") while that write is still unanswered, and records every flow:save and the label it
// carried. Before the fix the answer marked "Second" clean and nothing wrote it (a later click used to, until R4 made
// a click a look); after it, a second flow:save carries "Second". Nothing opens on screen.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const harness = path.resolve(here, '../../../../v2.1.0/sprint-144-release-harness/research/repro/flow-step-panel/harness.html');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const runs = Number(opt('runs', 3));
const answerAfter = Number(opt('answer-after', 600));
// Wrap the stand-in's API: record each flow:save's label and answer it late
const SLOW_HOST = `(() => {
  let real;
  window.__saves = [];
  Object.defineProperty(window, 'acquireVsCodeApi', {
    configurable: true,
    set(value) { real = value; },
    get() {
      return real && function () {
        const api = real();
        return Object.freeze({
          getState: api.getState,
          setState: api.setState,
          postMessage(message) {
            api.postMessage(message);
            if (message && message.type === 'flow:save') {
              const step = (message.flow.nodes || []).find((n) => n.id === 'llm-1');
              window.__saves.push({ t: Math.round(performance.now()), label: step && step.data.label });
              setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'flow:saved' } })), ${answerAfter});
            }
          },
        });
      };
    },
  });
})();`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const explicit = opt('chrome', process.env.CHROME);
  if (explicit) return explicit;
  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (fs.existsSync(cache)) {
    for (const d of fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
      const bin = path.join(cache, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
      if (fs.existsSync(bin)) return bin;
    }
  }
  throw new Error('no headless Chromium found: pass --chrome <path>');
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pr3-race-'));
const proc = spawn(findChrome(), ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
  '--no-default-browser-check', '--allow-file-access-from-files', '--window-size=800,900'], { stdio: 'ignore' });
const portFile = path.join(profile, 'DevToolsActivePort');
for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await sleep(100);
const [port, wsPath] = fs.readFileSync(portFile, 'utf8').trim().split('\n');
const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const msgId = ++id;
  pending.set(msgId, { resolve, reject });
  ws.send(JSON.stringify({ id: msgId, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const page = (method, params) => send(method, params, sessionId);
const evaluate = async (expression) => {
  const res = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
};
await page('Page.enable');
await page('Runtime.enable');
await page('Page.addScriptToEvaluateOnNewDocument', { source: SLOW_HOST });

const TYPE = (text) => `(() => {
  const panel = document.querySelector('.rm-flow-props');
  const label = panel && [...panel.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Label');
  const input = label && label.parentElement.querySelector('input');
  if (!input) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(text)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

const results = [];
try {
  for (let run = 1; run <= runs; run++) {
    await page('Emulation.setDeviceMetricsOverride', { width: 784, height: 824, deviceScaleFactor: 1, mobile: false });
    await page('Page.navigate', { url: pathToFileURL(harness).href + '?selectAt=400&replyFix=1' });
    // The harness clicks the step 400 ms after load: wait for its panel
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) { await sleep(50); ready = await evaluate(TYPE('First')).catch(() => false); }
    // The autosave sends "First" 500 ms later; while its answer is pending, type "Second"
    for (let i = 0; i < 60 && (await evaluate('window.__saves.length')) === 0; i++) await sleep(25);
    await sleep(100);
    const typedSecond = await evaluate(TYPE('Second'));
    await sleep(answerAfter + 1500);
    const saves = await evaluate('window.__saves');
    results.push({ run, typedSecond, saves: saves.map((s) => s.label), secondWritten: saves.some((s) => s.label === 'Second') });
  }
} finally {
  try { ws.close(); } catch {}
  proc.kill();
  await sleep(500);
  try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
console.log(JSON.stringify({ answerAfterMs: answerAfter, results }));
