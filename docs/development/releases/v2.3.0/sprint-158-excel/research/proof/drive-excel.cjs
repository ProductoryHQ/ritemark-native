#!/usr/bin/env node
/**
 * Sprint 158 proof driver: drive an Excel editor in a Ritemark dev instance over CDP, as a person would.
 *
 *   NODE_PATH=<checkout>/vscode/node_modules node drive-excel.cjs <port> shot <out.png>
 *   NODE_PATH=… node drive-excel.cjs <port> edit <row> <col> <text>     row and col 0-based, as the grid shows them
 *   NODE_PATH=… node drive-excel.cjs <port> save
 *   NODE_PATH=… node drive-excel.cjs <port> cell <ref> [2]              choose a sheet-grid cell (A27) by a click; 2 double-clicks to edit it
 *   NODE_PATH=… node drive-excel.cjs <port> eval <expression>          run in the Excel webview's own document
 *
 * Mouse and keyboard go through the workbench page (Input.dispatch*), at the cell's place on screen: the webview's
 * frame in the workbench, plus its #active-frame, plus the cell in it.
 */
const WebSocket = require('ws');

const [port, action, ...rest] = process.argv.slice(2);

async function targets() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return res.json();
}

function session(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false });
    let id = 0;
    const waiting = new Map();
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && waiting.has(msg.id)) {
        const { ok, fail } = waiting.get(msg.id);
        waiting.delete(msg.id);
        msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
      }
    });
    ws.on('open', () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((ok, fail) => {
            const n = ++id;
            waiting.set(n, { ok, fail });
            ws.send(JSON.stringify({ id: n, method, params }));
          }),
        close: () => ws.close(),
      }),
    );
    ws.on('error', reject);
  });
}

async function evaluate(s, expression) {
  const r = await s.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
}

async function workbench() {
  const t = (await targets()).find((x) => x.type === 'page' && /workbench/.test(x.url));
  if (!t) throw new Error('no workbench page');
  return session(t.webSocketDebuggerUrl);
}

/** The editor webview that holds the spreadsheet toolbar. */
async function excelWebview() {
  for (const t of await targets()) {
    if (t.type !== 'iframe' || !/^vscode-webview:/.test(t.url) || /purpose=webviewView/.test(t.url)) continue;
    const s = await session(t.webSocketDebuggerUrl);
    const has = await evaluate(s, `(() => { const af = document.getElementById('active-frame'); return !!(af && af.contentDocument && af.contentDocument.querySelector('.spreadsheet-toolbar')); })()`).catch(() => false);
    if (has) return s;
    s.close();
  }
  throw new Error('no Excel webview');
}

const inFrame = (body) => `(() => { const af = document.getElementById('active-frame'); const d = af.contentDocument; const w = af.contentWindow; ${body} })()`;

async function key(wb, keyName, code, keyCode, modifiers = 0, text, commands) {
  await wb.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers, text, commands });
  await wb.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: keyCode, modifiers });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const wb = await workbench();
  if (action === 'shot') {
    const r = await wb.send('Page.captureScreenshot', { format: 'png' });
    require('fs').writeFileSync(rest[0], Buffer.from(r.data, 'base64'));
    console.log('wrote', rest[0]);
  } else if (action === 'eval') {
    const web = await excelWebview();
    console.log(JSON.stringify(await evaluate(web, inFrame(`return (${rest.join(' ')});`)), null, 1));
    web.close();
  } else if (action === 'edit') {
    const [row, col, text] = [Number(rest[0]), Number(rest[1]), rest.slice(2).join(' ')];
    const web = await excelWebview();
    // where the webview's frame is in the workbench
    const outer = await evaluate(wb, `(() => { const all = [...document.querySelectorAll('iframe.webview')].filter(f => f.getBoundingClientRect().width > 0); const f = all.find(f => f.parentElement.classList.contains('ritemark-desk-webview')) || all.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
    const inner = await evaluate(web, inFrame(`
      const af2 = document.getElementById('active-frame').getBoundingClientRect();
      const tr = d.querySelector('tr[data-index="${row}"]');
      if (!tr) return null;
      tr.scrollIntoView({ block: 'center' });
      const td = tr.querySelectorAll('td')[${col} + 1];
      const r = td.getBoundingClientRect();
      return { x: af2.left + r.left + r.width / 2, y: af2.top + r.top + r.height / 2 };`));
    if (!inner) throw new Error(`row ${row} isn't drawn`);
    const x = outer.x + inner.x;
    const y = outer.y + inner.y;
    for (const clickCount of [1, 2]) {
      await wb.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount });
      await wb.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount });
    }
    await sleep(300);
    await key(wb, 'a', 'KeyA', 65, 4, undefined, ['selectAll']); // select what the cell holds, so the typing replaces it
    await wb.send('Input.insertText', { text });
    await sleep(200);
    await key(wb, 'Enter', 'Enter', 13, 0, '\r');
    await sleep(500);
    console.log('edited', row, col, '→', text);
    web.close();
  } else if (action === 'click') {
    // a click (or a double click) at a point of the window, in CSS pixels
    const [x, y, count] = [Number(rest[0]), Number(rest[1]), Number(rest[2] ?? 1)];
    for (let n = 1; n <= count; n++) {
      await wb.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: n });
      await wb.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: n });
    }
    await sleep(400);
    console.log('clicked', x, y, count);
  } else if (action === 'cell') {
    // a click on a sheet-grid cell by its reference (A27), where its column letter and row number meet
    const [, letters, digits] = /^([A-Z]+)(\d+)$/.exec(rest[0]);
    const web = await excelWebview();
    const outer = await evaluate(wb, `(() => { const all = [...document.querySelectorAll('iframe.webview')].filter(f => f.getBoundingClientRect().width > 0); const f = all.find(f => f.parentElement.classList.contains('ritemark-desk-webview')) || all.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
    const inner = await evaluate(web, inFrame(`
      const af2 = document.getElementById('active-frame').getBoundingClientRect();
      const heads = [...d.querySelectorAll('.sg-head')];
      const col = heads.find((e) => e.classList.contains('sg-col-head') && e.textContent.trim() === ${JSON.stringify(letters)});
      const row = heads.find((e) => !e.classList.contains('sg-col-head') && e.textContent.trim() === ${JSON.stringify(digits)});
      if (!col || !row) return null;
      const cx = col.getBoundingClientRect(), ry = row.getBoundingClientRect();
      return { x: af2.left + cx.left + cx.width / 2, y: af2.top + ry.top + ry.height / 2 };`));
    if (!inner) throw new Error(`${rest[0]} isn't drawn`);
    const x = outer.x + inner.x;
    const y = outer.y + inner.y;
    // `cell A27 2`: a double click, which opens the cell's editor for `type`
    for (let n = 1; n <= Number(rest[1] ?? 1); n++) {
      await wb.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: n });
      await wb.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: n });
    }
    await sleep(400);
    console.log('chose', rest[0]);
    web.close();
  } else if (action === 'type') {
    await wb.send('Input.insertText', { text: rest.join(' ') });
    await sleep(200);
    console.log('typed');
  } else if (action === 'press') {
    const keys = { Enter: ['Enter', 13, '\r'], Escape: ['Escape', 27], Tab: ['Tab', 9], ArrowDown: ['ArrowDown', 40], ArrowRight: ['ArrowRight', 39] };
    const [code, keyCode, text] = keys[rest[0]];
    await key(wb, rest[0], code, keyCode, 0, text);
    await sleep(400);
    console.log('pressed', rest[0]);
  } else if (action === 'tab') {
    // the editor tab whose label holds the text (a workbook's file name)
    const at = await evaluate(wb, `(() => { const t = [...document.querySelectorAll('.tab')].find(t => (t.getAttribute('aria-label') || t.textContent || '').includes(${JSON.stringify(rest.join(' '))})); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (!at) throw new Error('no tab ' + rest.join(' '));
    await wb.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await wb.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await sleep(1500);
    console.log('tab', rest.join(' '));
  } else if (action === 'sheet') {
    // a sheet tab under the grid, by its name
    const web = await excelWebview();
    const outer = await evaluate(wb, `(() => { const all = [...document.querySelectorAll('iframe.webview')].filter(f => f.getBoundingClientRect().width > 0); const f = all.find(f => f.parentElement.classList.contains('ritemark-desk-webview')) || all.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]; const r = f.getBoundingClientRect(); return { x: r.left, y: r.top }; })()`);
    const inner = await evaluate(web, inFrame(`const af2 = document.getElementById('active-frame').getBoundingClientRect(); const b = [...d.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(rest.join(' '))}); if (!b) return null; const r = b.getBoundingClientRect(); return { x: af2.left + r.left + r.width / 2, y: af2.top + r.top + r.height / 2 };`));
    if (!inner) throw new Error('no sheet ' + rest.join(' '));
    const x = outer.x + inner.x;
    const y = outer.y + inner.y;
    await wb.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await wb.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await sleep(800);
    console.log('sheet', rest.join(' '));
    web.close();
  } else if (action === 'save') {
    await key(wb, 's', 'KeyS', 83, 4);
    await sleep(1500);
    console.log('saved');
  } else {
    throw new Error('unknown action ' + action);
  }
  wb.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
