#!/usr/bin/env node
// #513, one bubble at a time: what is under the pointer when an option of the
// mention list is clicked, where the focus goes, and whether anything scrolls.
import fs from 'node:fs';
import path from 'node:path';
import { lib, freshProfile, sleep } from './cdp-lib.mjs';

const argv = process.argv.slice(2);
const option = (n, f) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : f; };
const REPO = option('repo'); const PORT = Number(option('port', '9363')); const PROFILE = option('profile', '/private/tmp/claude-501/r143-c');
const WS = option('ws', '/private/tmp/r143-ws3'); const OUT = option('out');
const c = lib(PORT);
const report = { runs: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
fs.mkdirSync(WS, { recursive: true });
const DOC = path.join(WS, 'Mention test.md');
fs.writeFileSync(DOC, '# Mention test\n\nThe first paragraph needs warmth.\n\nThe second paragraph needs an example.\n\nThe third paragraph is fine.\n');
freshProfile(PROFILE, { 'files.autoSave': 'afterDelay', 'files.autoSaveDelay': 500 });
await c.launch({ repo: REPO, profile: PROFILE, args: [WS, DOC], log: path.join(PROFILE, 'launch.log') });
const EDITOR = "d.querySelector('.ProseMirror')";
const STATE = "const t=d.querySelector('textarea[aria-label=\"Comment text\"]'); const a=d.activeElement; const sc=[...d.querySelectorAll('*')].filter(e=>e.scrollTop>0).map(e=>(e.className&&String(e.className).slice(0,30))+':'+e.scrollTop); return {value:t?t.value:null, active:a?(a.tagName+'.'+String(a.className).slice(0,30)):null, docScroll:(d.scrollingElement||{}).scrollTop, scrolled:sc, bubbles:d.querySelectorAll('textarea[aria-label=\"Comment text\"]').length, lists:d.querySelectorAll('[role=listbox][aria-label=\"Assign an agent\"]').length};";
try {
  report.editorReady = Boolean(await c.waitFor(EDITOR, 'return true', 60));
  await sleep(1500);
  for (const [i, how] of ['mouse', 'mouse-slow', 'mouse'].entries()) {
    const para = how === 'mouse-slow' ? 2 : (i === 0 ? 1 : 3);
    const run = { how, para, steps: [] };
    const word = await c.rectIn(EDITOR, `(function(){const p=[...d.querySelectorAll('.ProseMirror p')][${para - 1}]; const t=p.firstChild; const r=d.createRange(); const i=t.textContent.indexOf('paragraph'); r.setStart(t,i); r.setEnd(t,i+9); return r;})()`);
    await c.mouse(word.x, word.y, 2); await sleep(900);
    await c.clickIn(EDITOR, "d.querySelector('button[title=\"Add comment\"]')"); await sleep(1000);
    run.steps.push({ at: 'bubble', ...(await c.inFrame(EDITOR, STATE)) });
    await c.insertText('@'); await sleep(700);
    run.steps.push({ at: 'after @', ...(await c.inFrame(EDITOR, STATE)) });
    const opt = await c.rectIn(EDITOR, "[...d.querySelectorAll('.rm-mention-opt')].find(o=>o.innerText.startsWith('@claude'))");
    const under = await c.inFrame(EDITOR, `const o=[...d.querySelectorAll('.rm-mention-opt')].find(o=>o.innerText.startsWith('@claude')); const r=o.getBoundingClientRect(); const x=r.x+r.width/2, y=r.y+r.height/2; const e=d.elementFromPoint(x,y); return {x,y, top:r.top, under: e? (e.tagName+'.'+String(e.className).slice(0,40)) : null, isOption: !!(e&&e.closest('.rm-mention-opt'))};`);
    run.steps.push({ at: 'option', opt, under });
    // move first, as a hand does, then look again before pressing
    const cl = await c.connect((await c.page()).webSocketDebuggerUrl);
    await cl.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: opt.x, y: opt.y, button: 'none' });
    await sleep(how === 'mouse-slow' ? 800 : 30);
    const afterMove = await c.inFrame(EDITOR, `const o=[...d.querySelectorAll('.rm-mention-opt')].find(o=>o.innerText.startsWith('@claude')); const r=o.getBoundingClientRect(); return {top:r.top, under:(function(){const e=d.elementFromPoint(${under?.x ?? 0},${under?.y ?? 0}); return e?(e.tagName+'.'+String(e.className).slice(0,40)):null;})()};`);
    run.steps.push({ at: 'after move', afterMove, ...(await c.inFrame(EDITOR, STATE)) });
    await cl.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: opt.x, y: opt.y, button: 'left', clickCount: 1 });
    await cl.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: opt.x, y: opt.y, button: 'left', clickCount: 1 });
    cl.close();
    await sleep(600);
    run.steps.push({ at: 'after click', ...(await c.inFrame(EDITOR, STATE)) });
    await c.insertText('Make this warmer'); await sleep(500);
    run.steps.push({ at: 'after text', ...(await c.inFrame(EDITOR, STATE)) });
    await c.screenshot(path.join(path.dirname(OUT), `r143-513b-${i + 1}.png`));
    // close this bubble without saving
    await c.clickIn(EDITOR, "[...d.querySelectorAll('button')].find(b=>b.innerText.trim()==='Cancel')"); await sleep(800);
    run.after = await c.inFrame(EDITOR, STATE);
    report.runs.push(run); save();
    console.log(JSON.stringify(run));
  }
} catch (error) { report.error = String(error?.stack ?? error); console.log('ERROR', report.error); }
finally { save(); await c.quit(); }
