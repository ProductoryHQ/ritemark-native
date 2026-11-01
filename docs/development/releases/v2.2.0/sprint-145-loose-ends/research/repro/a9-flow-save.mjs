#!/usr/bin/env node
// Sprint 145 A9 (R4, S27): does selecting a Flow step post flow:save?
//
//   node a9-flow-save.mjs [--runs 3] [--wait 2500] [--select-at 400|none] [--answer-save] [--chrome <path>]
//
// Opens Sprint 144's flow harness (the committed media/webview.js as the Flow editor, with a stand-in host)
// in a headless Chromium over raw CDP (Node 22's WebSocket, no npm packages). The harness clicks the LLM step
// --select-at ms after flow:load (default 400; `none` opens the flow and clicks nothing). This reads the
// harness's message timeline and prints, per run, every flow:save the webview posted, after flow:load and
// after the click. --answer-save makes the stand-in answer each flow:save with flow:saved, as the real host
// does (FlowEditorProvider.ts:120), so a later save can be told apart from the first. Nothing opens on screen.
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
const wait = Number(opt('wait', 2500));
const selectAt = opt('select-at', '400');
const answerSave = args.includes('--answer-save');
// The stand-in host never answers flow:save; the real one answers flow:saved. Wrap the stub's API to do so.
const ANSWER_SAVE = `(() => {
  let real;
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
              setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: { type: 'flow:saved' } })), 20);
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

async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'a9-harness-'));
  const proc = spawn(findChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files', '--window-size=800,900',
  ], { stdio: 'ignore' });
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
  await page('Page.enable');
  await page('Runtime.enable');
  if (answerSave) await page('Page.addScriptToEvaluateOnNewDocument', { source: ANSWER_SAVE });
  const close = async () => {
    try { ws.close(); } catch {}
    const exited = new Promise((resolve) => proc.once('exit', resolve));
    proc.kill();
    await Promise.race([exited, sleep(3000)]);
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
  };
  return { page, close };
}

async function evaluate(page, expression) {
  const res = await page('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result.value;
}

const { page, close } = await launch();
const results = [];
try {
  for (let run = 1; run <= runs; run++) {
    await page('Emulation.setDeviceMetricsOverride', { width: 784, height: 824, deviceScaleFactor: 1, mobile: false });
    await page('Page.navigate', { url: pathToFileURL(harness).href + '?selectAt=' + selectAt });
    let started = false;
    const marker = selectAt === 'none'
      ? "(window.__harnessLog||[]).some(e => e.what === 'host→webview' && /^flow:load/.test(e.detail))"
      : "(window.__harnessLog||[]).some(e => e.what === 'select' && /^click/.test(e.detail))";
    for (let i = 0; i < 200 && !started; i++) {
      await sleep(50);
      started = await evaluate(page, marker).catch(() => false);
    }
    await sleep(wait);
    const log = await evaluate(page, 'window.__harnessLog');
    const click = log.find((e) => e.what === 'select' && /^click/.test(e.detail));
    const saves = log.filter((e) => e.what === 'webview→host' && /^flow:save/.test(e.detail));
    const load = log.find((e) => e.what === 'host→webview' && /^flow:load/.test(e.detail));
    const savesBeforeClick = click ? saves.filter((e) => e.t < click.t) : saves;
    results.push({
      run,
      clickAt: click ? click.t : null,
      loadAt: load ? load.t : null,
      savesAfterLoadMs: load ? saves.map((e) => e.t - load.t) : [],
      savesAfterClickMs: click ? saves.filter((e) => e.t >= click.t).map((e) => e.t - click.t) : [],
      savesBeforeClickAfterLoadMs: load ? savesBeforeClick.map((e) => e.t - load.t) : [],
    });
  }
} finally {
  await close();
}
console.log(JSON.stringify({ harness: path.relative(process.cwd(), harness), selectAt, answerSave, waitMs: wait, results }));
