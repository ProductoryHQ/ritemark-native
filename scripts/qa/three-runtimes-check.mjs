#!/usr/bin/env node
/**
 * Sprint 139 (R12, S51–S53): one AI's run, end to end, on a dev instance.
 *
 * One fresh test profile, two launches (the scenario needs a restart), both
 * hidden, each quit with ⌘Q. Usage data goes to a local PostHog stand-in this
 * script runs, never to a real key. It uses the sign-in the AI already has on
 * this computer and never signs in or out: an AI whose welcome card offers
 * Sign in is reported as not run.
 *
 *   1. the welcome's step-1 cards and their plan lines; Continue with the AI;
 *      the project is opened through the welcome's Open a folder…
 *   2. a first message and its reply; first_message_sent, agent_used and
 *      first_reply at the stand-in, with only their listed properties
 *   3. another model picked and a message sent on it
 *   4. a new chat on a model the AI refuses: one card, no "Failed", and the
 *      card's switch changes the model without resending
 *   5. ⌘Q, a second launch, the first chat opened from All conversations:
 *      its own model, and the next message continues the AI's own thread
 *
 * Usage (from the repository root, with the dev tree built: vscode/.build and
 * extensions/ritemark/out):
 *   node scripts/qa/three-runtimes-check.mjs --ai chatgpt \
 *     --workspace /private/tmp/ritemark-s116-rundev-workspace \
 *     --default-model "GPT-6.1 Sol" --other-model "GPT-6-Luna" --refused-model "GPT-5.4 Mini" \
 *     --profile /private/tmp/claude-501/r139-run --evidence <dir>
 *
 * A ChatGPT run should use a folder Codex already trusts, or Codex adds the
 * folder to ~/.codex/config.toml. Each ChatGPT turn also writes Codex's own
 * session record under ~/.codex/sessions, as any Codex client does.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// ── options ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : fallback;
};
const AI = option('ai', 'chatgpt');
const AI_NAME = { chatgpt: 'ChatGPT', claude: 'Claude', opencode: 'OpenCode' }[AI];
if (!AI_NAME) throw new Error(`--ai must be chatgpt, claude or opencode, not ${AI}`);
/** How the composer's runtime button names the AI ("Claude Code, Sonnet 5.5, thinking effort Auto"). */
const COMPOSER_NAME = { chatgpt: 'ChatGPT', claude: 'Claude Code', opencode: 'OpenCode' }[AI];
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKSPACE = option('workspace');
const OTHER_MODEL = option('other-model');
const REFUSED_MODEL = option('refused-model');
/** The AI's default model's label, picked when the project's chat doesn't open on this AI. */
const DEFAULT_MODEL = option('default-model');
const PORT = Number(option('port', '9234'));
const STANDIN_PORT = PORT + 1;
const PROFILE = option('profile', '/private/tmp/claude-501/r139-run');
const EVIDENCE = option('evidence', path.join(PROFILE, 'evidence'));
if (!WORKSPACE || !OTHER_MODEL || !REFUSED_MODEL) {
  throw new Error('--workspace, --other-model and --refused-model are required');
}

const report = { ai: AI, started: new Date().toISOString(), steps: [], events: [] };
const step = (name, result) => {
  report.steps.push({ name, ...result });
  console.log(`${result.ok ? 'PASS' : result.notRun ? 'NOT RUN' : 'FAIL'}  ${name}${result.detail ? ` — ${JSON.stringify(result.detail)}` : ''}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── the PostHog stand-in ───────────────────────────────────────────────────

function startStandIn() {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        let body = Buffer.concat(chunks);
        if (body[0] === 0x1f && body[1] === 0x8b) body = zlib.gunzipSync(body);
        const json = JSON.parse(body.toString('utf8') || '{}');
        const batch = Array.isArray(json) ? json : Array.isArray(json.batch) ? json.batch : [json];
        for (const event of batch) if (event?.event) report.events.push({ event: event.event, properties: event.properties ?? {} });
      } catch { /* not an event */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"status":1}');
    });
  });
  server.listen(STANDIN_PORT, '127.0.0.1');
  return server;
}

/** The event's own properties, without the shared ones every event carries. */
function own(properties) {
  return Object.fromEntries(Object.entries(properties).filter(([key]) => !key.startsWith('$') && !['product_area', 'app_version', 'build_channel'].includes(key)));
}

// ── raw CDP ────────────────────────────────────────────────────────────────

async function targets() {
  return (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
}

async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.error) waiter.reject(new Error(JSON.stringify(data.error)));
    else waiter.resolve(data.result);
  };
  return {
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const messageId = ++id;
      pending.set(messageId, { resolve, reject });
      ws.send(JSON.stringify({ id: messageId, method, params }));
    }),
    close: () => ws.close(),
  };
}

async function evaluate(url, expression) {
  const client = await connect(url);
  try {
    const result = await client.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  } finally {
    client.close();
  }
}

async function page() {
  const target = (await targets()).find((candidate) => candidate.type === 'page' && candidate.url.startsWith('vscode-file://'));
  if (!target) throw new Error('no workbench page');
  return target;
}

async function webview(probe) {
  for (const target of (await targets()).filter((candidate) => candidate.type === 'iframe' && candidate.url.startsWith('vscode-webview://'))) {
    const ok = await evaluate(target.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); if(!af||!af.contentWindow) return false; const w=af.contentWindow, d=af.contentDocument; return Boolean(${probe});})()`).catch(() => false);
    if (ok) return target;
  }
  return null;
}

async function inFrame(probe, body) {
  const target = await webview(probe);
  if (!target) return null;
  return evaluate(target.webSocketDebuggerUrl, `(async function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; ${body}})()`);
}

async function waitFor(probe, body, seconds) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const value = await inFrame(probe, body).catch(() => null);
    if (value) return value;
    await sleep(1500);
  }
  return null;
}

async function mouse(x, y, types = ['mouseMoved', 'mousePressed', 'mouseReleased']) {
  const client = await connect((await page()).webSocketDebuggerUrl);
  try {
    for (const type of types) await client.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
  } finally {
    client.close();
  }
}

/** Click an element in a webview: its rect in the frame plus the frame's rect in the workbench. */
async function clickIn(probe, elementExpression) {
  const target = await webview(probe);
  if (!target) return false;
  const rect = await evaluate(target.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; const el=(${elementExpression}); if(!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if (!rect) return false;
  const id = /[?&]id=([^&]+)/.exec(target.url)?.[1] ?? '';
  const frame = await evaluate((await page()).webSocketDebuggerUrl, `(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
  if (!frame) return false;
  await mouse(frame.x + rect.x, frame.y + rect.y);
  return true;
}

async function insertText(text) {
  const client = await connect((await page()).webSocketDebuggerUrl);
  try { await client.send('Input.insertText', { text }); } finally { client.close(); }
}

async function press(key, code, keyCode, modifiers = 0) {
  const client = await connect((await page()).webSocketDebuggerUrl);
  try {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode, modifiers });
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode, modifiers });
  } finally {
    client.close();
  }
}

async function screenshot(name, clip) {
  const client = await connect((await page()).webSocketDebuggerUrl);
  try {
    const { data } = await client.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    fs.writeFileSync(path.join(EVIDENCE, name), Buffer.from(data, 'base64'));
  } finally {
    client.close();
  }
}

/** An element's rect in the workbench: its rect in the webview's frame plus the frame's. */
async function rectIn(probe, elementExpression) {
  const target = await webview(probe);
  if (!target) return null;
  const rect = await evaluate(target.webSocketDebuggerUrl, `(function(){const af=document.getElementById('active-frame'); const w=af.contentWindow, d=af.contentDocument; const el=(${elementExpression}); if(!el) return null; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  if (!rect) return null;
  const id = /[?&]id=([^&]+)/.exec(target.url)?.[1] ?? '';
  const frame = await evaluate((await page()).webSocketDebuggerUrl, `(function(){const f=[...document.querySelectorAll('iframe')].find(i=>i.src.includes(${JSON.stringify(id)})); if(!f) return null; const r=f.getBoundingClientRect(); return {x:r.x,y:r.y};})()`);
  return frame ? { x: frame.x + rect.x, y: frame.y + rect.y, width: rect.width, height: rect.height } : null;
}

// ── the instance ───────────────────────────────────────────────────────────

function portBusy() {
  return spawnSync('lsof', ['-i', `:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout.trim().length > 0;
}

async function launch(folder, log) {
  const app = path.join(REPO, 'vscode/.build/electron/Ritemark.app');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  execFileSync('open', [
    '-n', '-g', '-j', '-a', app,
    '--env', 'NODE_ENV=development', '--env', 'VSCODE_DEV=1', '--env', 'VSCODE_CLI=1',
    '--env', 'RITEMARK_BUILD_CHANNEL=test',
    '--env', 'RITEMARK_POSTHOG_PROJECT_KEY=standin-three-runtimes',
    '--env', `RITEMARK_POSTHOG_HOST=http://127.0.0.1:${STANDIN_PORT}`,
    '--stdout', log, '--stderr', log,
    '--args', path.join(REPO, 'vscode'), ...(folder ? [folder] : []),
    '--disable-extension=vscode.vscode-api-tests',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(PROFILE, 'ud')}`,
    `--extensions-dir=${path.join(PROFILE, 'ext')}`,
    `--shared-data-dir=${path.join(PROFILE, 'shared')}`,
    '--use-mock-keychain',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling',
  ], { env });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await fetch(`http://127.0.0.1:${PORT}/json/version`).then(() => true, () => false)) return;
    await sleep(1000);
  }
  throw new Error('the dev instance did not answer on CDP');
}

async function quit() {
  await mouse(291, 26); // the tab row: the workbench, not a webview, takes ⌘Q
  await press('q', 'KeyQ', 81, 4);
  for (let attempt = 0; attempt < 30 && portBusy(); attempt += 1) await sleep(1000);
}

// ── the AI sheet ───────────────────────────────────────────────────────────

const SHEET = "d.querySelector('textarea')";
const TRACE = `if(!w.__rmRun){w.__rmRun=[]; w.addEventListener('message',(e)=>{const m=e.data; if(m&&typeof m.type==='string'&&/codex-result|agent-result|continuation-state|canonical-id/.test(m.type)) w.__rmRun.push(JSON.parse(JSON.stringify(m)));});} return true;`;

async function send(text) {
  await inFrame(SHEET, TRACE); // the sheet may have been reloaded since
  const before = await resultCount();
  await clickIn(SHEET, "d.querySelector('textarea')");
  await insertText(text);
  await sleep(700); // let the composer take the text before Enter reads it
  await press('Enter', 'Enter', 13);
  await sleep(1200);
  // Enter can land before the composer is ready; the Send button then sends what is in the box.
  if (await inFrame(SHEET, "return Boolean(d.querySelector('textarea').value.trim())")) {
    await clickIn(SHEET, "d.querySelector('button[aria-label=\"Send\"]')");
  }
  return waitFor(SHEET, `const r=(w.__rmRun||[]).filter(m=>/result/.test(m.type)); return r.length>${before}? r[r.length-1]: null`, 180);
}

async function resultCount() {
  return inFrame(SHEET, "return (w.__rmRun||[]).filter(m=>/result/.test(m.type)).length");
}

async function currentModel() {
  return inFrame(SHEET, `const a=[...d.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').find(t=>t.startsWith(${JSON.stringify(`${COMPOSER_NAME}, `)})); return a? a.split(', ')[1]: null`);
}

async function pickModel(label) {
  // The model button shows the label that the composer's "<AI>, <model>, thinking effort …" button names.
  const now = await inFrame(SHEET, "const a=[...d.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').find(t=>/, thinking effort /.test(t)); return a? a.split(', ').slice(-2, -1)[0]: null");
  await clickIn(SHEET, `[...d.querySelectorAll('button')].find(b=>b.innerText.trim()===${JSON.stringify(now)})`);
  await waitFor("d.querySelector('[role=option]')", "return d.querySelectorAll('[role=option]').length", 10);
  await clickIn("d.querySelector('[role=option]')", `[...d.querySelectorAll('[role=option]')].find(o=>o.innerText.split('\\n')[0].replace(/ \\*$/,'').trim()===${JSON.stringify(label)})`);
  await sleep(1000);
  return currentModel();
}

// ── the run ────────────────────────────────────────────────────────────────

async function run() {
  if (portBusy()) throw new Error(`port ${PORT} is in use: not this run's instance`);
  // A fresh profile every run, and only ever under a temporary folder.
  const tmpRoots = ['/private/tmp/', '/tmp/', os.tmpdir() + path.sep];
  if (!tmpRoots.some((root) => path.resolve(PROFILE).startsWith(root)) || path.resolve(PROFILE).split(path.sep).length < 5) {
    throw new Error(`--profile must be a folder of its own under a temporary folder, not ${PROFILE}`);
  }
  fs.rmSync(PROFILE, { recursive: true, force: true });
  fs.mkdirSync(path.join(PROFILE, 'ud', 'User'), { recursive: true });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(PROFILE, 'ud/User/settings.json'), JSON.stringify({
    'window.confirmBeforeClose': 'never',
    'files.simpleDialog.enable': true,
    // A dev tree's product.json can name an older version, so the update notice would cover the sheet's corner.
    'ritemark.updates.enabled': false,
  }, null, 2));
  const standIn = startStandIn();
  try {
    // 1. The welcome.
    await launch(null, path.join(PROFILE, 'launch1.log'));
    const WELCOME = "d.body.innerText.includes('Which AI do you use?')";
    const cards = await waitFor(WELCOME, "const c=[...d.querySelectorAll('.rw-choice')].map(c=>c.innerText.replace(/\\n+/g,' | ')); return c.length && !c.some(t=>t.includes('Checking'))? c: null", 60);
    // Every card keeps its line, signed in or not; the button row says the state.
    const PLAN_LINES = {
      ChatGPT: 'Any plan works, free included.',
      Claude: 'Needs a paid plan, such as Pro or Max.',
      OpenCode: 'Open models, with an API key of your own.',
    };
    step('S1 every step-1 card says which plans work, signed in or not, never Codex', {
      ok: Boolean(cards) && !JSON.stringify(cards).match(/codex/i)
        && Object.entries(PLAN_LINES).every(([name, line]) => cards.some((card) => card.startsWith(name) && card.includes(line)))
        && cards.every((card) => /Signed in|Sign in|Set up/.test(card)),
      detail: cards,
    });
    await screenshot(`${AI}-1-welcome.png`);
    const signedIn = cards?.some((card) => card.startsWith(AI_NAME) && card.includes('Continue'));
    if (!signedIn) {
      step(`S5x ${AI_NAME}'s in-app turns`, { notRun: true, detail: `${AI_NAME} is not set up on this computer; this run never signs in` });
      await quit();
      return;
    }
    await clickIn(WELCOME, `[...d.querySelectorAll('.rw-choice')].find(c=>c.querySelector('.name').innerText===${JSON.stringify(AI_NAME)}).querySelector('button')`);
    await waitFor("d.body.innerText.includes('Where is your work?')", 'return true', 20);
    await clickIn("d.body.innerText.includes('Where is your work?')", "[...d.querySelectorAll('button')].find(b=>b.innerText.includes('Open a folder'))");
    await sleep(1500);
    const pageUrl = (await page()).webSocketDebuggerUrl;
    await evaluate(pageUrl, "(function(){const i=document.querySelector('.quick-input-widget input'); i.focus(); i.select(); return true;})()");
    await insertText(`${WORKSPACE.replace(/\/$/, '')}/`);
    const open = await evaluate(pageUrl, "(function(){const b=[...document.querySelectorAll('.quick-input-widget .monaco-button')].find(x=>x.textContent==='Open'); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    await mouse(open.x, open.y);

    // 2. The first message, once the window has reloaded into the project.
    const folderName = path.basename(WORKSPACE.replace(/\/$/, ''));
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const title = await page().then((target) => evaluate(target.webSocketDebuggerUrl, 'document.title')).catch(() => '');
      if (String(title).includes(folderName)) break;
      await sleep(1000);
    }
    await sleep(3000);
    await waitFor(SHEET, TRACE, 90);
    // The welcome's landing opens a chat with the AI it was finished with. If the chat opened on another AI
    // (seen once in four runs, not root-caused), pick this AI the way a person would.
    if (!(await currentModel()) && DEFAULT_MODEL) {
      step('the project opened its chat on another AI', { ok: true, detail: 'picked this AI from the model menu' });
      await pickModel(DEFAULT_MODEL);
    }
    const first = await send('In one short sentence: what is in this folder?');
    await sleep(2000); // the counts leave the host just after the turn's result
    const firstReply = report.events.find((event) => event.event === 'first_reply');
    step('S43 the first message arrives, with first_message_sent, agent_used and first_reply', {
      ok: first?.status === 'completed' && Boolean(firstReply),
      detail: report.events.filter((event) => /first_|agent_used/.test(event.event)).map((event) => ({ [event.event]: own(event.properties) })),
    });

    // 3. Another model.
    const picked = await pickModel(OTHER_MODEL);
    const second = await send('Reply with one word: ready.');
    step(`S33 a message on ${OTHER_MODEL}`, { ok: picked === OTHER_MODEL && second?.status === 'completed', detail: { picked } });

    // 4. A refused model, in a new chat.
    await clickIn(SHEET, "d.querySelector('button[aria-label=\"New conversation\"]')");
    await sleep(1500);
    await waitFor(SHEET, TRACE, 10);
    await pickModel(REFUSED_MODEL);
    const refused = await send('Say hi.');
    const card = await waitFor(SHEET, "const c=d.querySelector('[data-turn-failure=\"model\"]'); return c? {text:c.innerText, buttons:[...c.querySelectorAll('button')].map(b=>b.innerText.trim()), statusLine:(d.querySelector('[data-activity-state]')||{}).innerText||null, header:(d.querySelector('header[aria-label=\"Current conversation\"] [role=status]')||{}).innerText||null}: null", 20);
    await screenshot(`${AI}-4-model-card.png`);
    step('S25 a refused model shows one card, and nothing on the status line or in the header', {
      ok: refused?.errorKind === 'model' && Boolean(card?.buttons?.length) && !card?.statusLine && !card?.header,
      detail: { result: refused, card },
    });
    // The provider's raw words are kept in the turn's activity row, labelled as theirs.
    const theirWords = await inFrame(SHEET, "return [...d.querySelectorAll('button')].map(b=>b.innerText.trim()).find(t=>/ said$/.test(t))||null");
    step(`the activity row that holds the raw words reads "What ${AI_NAME} said"`, { ok: theirWords === `What ${AI_NAME} said`, detail: theirWords });
    const before = await resultCount();
    if (card?.buttons?.[0]) await clickIn(SHEET, `[...d.querySelectorAll('[data-turn-failure] button')][0]`);
    const switched = await waitFor(SHEET, "const c=d.querySelector('[data-turn-failure=\"model\"]'); return c&&c.innerText.includes('Now using')? {text:c.innerText, done:Boolean(c.querySelector('[role=status]')), buttons:c.querySelectorAll('button').length}: null", 10);
    await screenshot(`${AI}-4b-switched.png`);
    step("S25 the card's switch changes the model and resends nothing; the card says Now using, with the check", {
      ok: Boolean(switched?.done) && switched.buttons === 0 && !/couldn't|\u2014/.test(switched.text) && (await resultCount()) === before,
      detail: switched,
    });
    await sleep(1500);
    const modelEvent = report.events.filter((event) => event.event === 'agent_used').at(-1);
    step('S40/R8 the refused turn is counted with outcome model', { ok: modelEvent?.properties.outcome === 'model', detail: modelEvent && own(modelEvent.properties) });

    // 5. A restart. The first chat is the rail's recent one; its title is the AI's by now.
    const firstTitle = await inFrame(SHEET, "const t=[...d.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||'').find(t=>t.endsWith(' — Recent')); return t? t.slice(0, -' — Recent'.length): null");
    await quit();
    await launch(WORKSPACE, path.join(PROFILE, 'launch2.log'));
    await waitFor(SHEET, TRACE, 90);
    // The refused chat, as the restart left it: the card says the switch was taken (it may open first).
    const RESTORED = "const c=d.querySelector('[data-turn-failure=\"model\"]'); return c&&c.innerText.includes('Now using')? {text:c.innerText, buttons:c.querySelectorAll('button').length, statusLine:(d.querySelector('[data-activity-state]')||{}).innerText||null, header:(d.querySelector('header[aria-label=\"Current conversation\"] [role=status]')||{}).innerText||null}: null";
    let restoredCard = await waitFor(SHEET, RESTORED, 8);
    if (restoredCard) await screenshot(`${AI}-6-restored-card.png`);
    await clickIn(SHEET, "d.querySelector('button[aria-label=\"All conversations\"]')");
    await waitFor(`d.body.innerText.includes(${JSON.stringify(firstTitle)})`, 'return true', 20);
    await clickIn(`d.body.innerText.includes(${JSON.stringify(firstTitle)})`, `[...d.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()===${JSON.stringify(firstTitle)})`);
    await sleep(2000);
    await waitFor(SHEET, TRACE, 10);
    const restoredModel = await currentModel();
    step('S33/S36 after a restart the chat comes back on its own model', { ok: restoredModel === OTHER_MODEL, detail: { restoredModel } });
    const again = await send('What was the one word you replied with before?');
    const continuation = await inFrame(SHEET, "return (w.__rmRun||[]).filter(m=>m.type==='conversation/continuation-state').map(m=>m.state.mode)");
    step("S33 the next message continues the AI's own thread", { ok: again?.status === 'completed' && continuation?.includes('native-restored'), detail: { continuation } });
    await screenshot(`${AI}-5-after-restart.png`);
    if (!restoredCard) {
      await clickIn(SHEET, "[...d.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||'').endsWith(' — Recent'))");
      await sleep(2000);
      restoredCard = await waitFor(SHEET, RESTORED, 10);
      if (restoredCard) await screenshot(`${AI}-6-restored-card.png`);
    }
    step('S36 after a restart the refused chat says Now using, with no button, nothing on the status line and just the title in the header', {
      ok: Boolean(restoredCard) && restoredCard.buttons === 0 && !restoredCard.statusLine && !restoredCard.header,
      detail: restoredCard,
    });

    // 6. Settings: the same plan lines (a signed-in AI shows its account, so its line is not drawn there).
    // ⌘⇧P from the desk, then the palette row itself (Enter there is not reliable over CDP).
    await mouse(700, 900);
    await press('p', 'KeyP', 80, 12);
    await sleep(800);
    await insertText('AI Settings');
    await sleep(1200);
    const paletteRow = await evaluate((await page()).webSocketDebuggerUrl, "(function(){const r=[...document.querySelectorAll('.quick-input-list .monaco-list-row')].find(r=>(r.getAttribute('aria-label')||'').startsWith('AI Settings')); if(!r) return null; const b=r.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2};})()");
    if (paletteRow) await mouse(paletteRow.x, paletteRow.y);
    const SETTINGS = "d.body.innerText.includes('Claude Account')";
    const settingsLines = await waitFor(SETTINGS, `const t=d.body.innerText; return t.includes('Ritemark')? {claude:t.includes(${JSON.stringify(PLAN_LINES.Claude)}), opencode:t.includes(${JSON.stringify(PLAN_LINES.OpenCode)}), chatgpt:t.includes(${JSON.stringify(PLAN_LINES.ChatGPT)})}: null`, 30);
    // Only Claude's card is captured: the ChatGPT card beside it names the signed-in account.
    const claudeCard = "[...d.querySelectorAll('p')].find(p=>p.innerText.startsWith('Needs a paid plan'))?.closest('.rounded-lg')";
    const cardText = await inFrame(SETTINGS, `const el=${claudeCard}; return el? el.innerText: null`);
    const clip = cardText && !cardText.includes('@') ? await rectIn(SETTINGS, claudeCard) : null;
    if (clip) await screenshot(`${AI}-7-settings-claude.png`, clip);
    step('S4 Settings: the signed-out cards lead with the same plan lines', {
      ok: Boolean(settingsLines?.claude && settingsLines?.opencode) && Boolean(clip),
      detail: { settingsLines, cardText },
    });
    await quit();

    // The counts carry only their listed properties (S56).
    const allowed = { agent_used: ['agent', 'source', 'outcome'], first_reply: ['provider', 'outcome'], first_message_sent: ['provider'] };
    const extra = report.events.filter((event) => allowed[event.event]).flatMap((event) => Object.keys(own(event.properties)).filter((key) => !allowed[event.event].includes(key)));
    step('S56 nothing beyond the listed properties', { ok: extra.length === 0, detail: extra });
  } finally {
    standIn.close();
    report.finished = new Date().toISOString();
    fs.writeFileSync(path.join(EVIDENCE, `${AI}-report.json`), JSON.stringify(report, null, 2));
    if (portBusy()) console.log(`The instance on ${PORT} is still running: quit it from its window, or stop the process whose command line names ${PROFILE}.`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
