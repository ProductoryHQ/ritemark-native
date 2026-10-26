#!/usr/bin/env node
// #513 (mention pick) and #507 (⌘⇧P on Home) reproducers, one hidden launch.
//   node repro-513-507.mjs --repo <wt> --port 9353 --profile /private/tmp/claude-501/r143-b --ws /private/tmp/r143-ws2 --out <json> [--only 513|507]
import fs from 'node:fs';
import path from 'node:path';
import { lib, freshProfile, sleep } from './cdp-lib.mjs';

const argv = process.argv.slice(2);
const option = (n, f) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : f; };
const REPO = option('repo'); const PORT = Number(option('port', '9353')); const PROFILE = option('profile', '/private/tmp/claude-501/r143-b');
const WS = option('ws', '/private/tmp/r143-ws2'); const OUT = option('out'); const ONLY = option('only', 'both');
const c = lib(PORT);
const report = { started: new Date().toISOString(), m513: [], m507: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 1));

fs.mkdirSync(WS, { recursive: true });
const DOC = path.join(WS, 'Comment test.md');
const BASE = '# Comment test\n\nThe opening paragraph needs warmth.\n\nThe second paragraph needs an example.\n\nThe third paragraph is fine.\n\nThe fourth paragraph is also fine.\n';
fs.writeFileSync(DOC, BASE);
freshProfile(PROFILE, { 'files.autoSave': 'afterDelay', 'files.autoSaveDelay': 500 });
if (c.portBusy()) throw new Error('port busy');
await c.launch({ repo: REPO, profile: PROFILE, args: [WS], log: path.join(PROFILE, 'launch.log') });

const HOME = "d.querySelector('.rh-line') || d.querySelector('[aria-label=\"Bring work in\"]')";
const paletteOpen = () => c.workbench("(function(){const q=document.querySelector('.quick-input-widget'); return !!q && getComputedStyle(q).display!=='none' && q.offsetHeight>0;})()");
const activeEl = () => c.workbench("(function(){const a=document.activeElement; return a? (a.tagName+'.'+String(a.className).slice(0,60)) : null;})()");
const homeFocus = () => c.inFrame(HOME, "const a=d.activeElement; return {hasFocus: d.hasFocus(), active: a? (a.tagName+'.'+String(a.className).slice(0,40)+(a.getAttribute('aria-label')? ' ['+a.getAttribute('aria-label').slice(0,40)+']':'')) : null};");
async function cmdShiftP(label) {
  const before = { workbench: await activeEl(), home: await homeFocus().catch(() => null) };
  await c.press('P', 'KeyP', 80, 4 | 8);
  await sleep(900);
  const opened = await paletteOpen();
  report.m507.push({ label, opened, before });
  console.log('507', label, opened, JSON.stringify(before));
  if (opened) { await c.press('Escape', 'Escape', 27); await sleep(500); }
  save();
}

try {
  if (ONLY !== '513') {
    const ready = await c.waitFor(HOME, 'return true', 60);
    report.homeReady = Boolean(ready);
    await sleep(2500);
    for (let round = 1; round <= 3; round += 1) {
      // a: a click on Home's heading text
      await c.clickIn(HOME, "d.querySelector('h1, .rh-title, h2')"); await sleep(400);
      await cmdShiftP(`r${round} a: click on Home's heading`);
      // b: Tab moves the focus to a control inside Home
      await c.clickIn(HOME, "d.querySelector('h1, .rh-title, h2')"); await sleep(300);
      await c.press('Tab', 'Tab', 9); await sleep(300);
      await cmdShiftP(`r${round} b: Tab to a control on Home`);
      // c: the line's input has the focus
      if (await c.clickIn(HOME, "d.querySelector('.rh-line')")) {
        await sleep(500);
        await cmdShiftP(`r${round} c: the line input focused`);
        await c.press('Escape', 'Escape', 27); await sleep(300);
      }
      // d: Home redraws (a project file changes) while focused
      await c.clickIn(HOME, "d.querySelector('h1, .rh-title, h2')"); await sleep(300);
      fs.writeFileSync(path.join(WS, `note-${round}.md`), `# Note ${round}\n`);
      await sleep(2500);
      await cmdShiftP(`r${round} d: after Home redrew`);
      // e: another tab, then Home's tab again by its tab
      await c.workbench("(function(){const t=[...document.querySelectorAll('.tab')].find(x=>/Task board|Tasks/.test(x.getAttribute('aria-label')||x.textContent)); if(t){t.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); return true;} return false;})()");
      await sleep(1200);
      const homeTab = await c.workbench("(function(){const t=[...document.querySelectorAll('.tab')].find(x=>/^Home/.test(x.getAttribute('aria-label')||x.textContent)); if(!t) return null; const r=t.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
      if (homeTab) { await c.mouse(homeTab.x, homeTab.y); await sleep(1200); }
      await cmdShiftP(`r${round} e: back on Home by its tab (no click inside)`);
      await c.clickIn(HOME, "d.querySelector('h1, .rh-title, h2')"); await sleep(400);
      await cmdShiftP(`r${round} f: back on Home, then a click inside`);
    }
    await c.screenshot(path.join(path.dirname(OUT), 'r143-507-home.png'));
  }

  if (ONLY !== '507') {
    // #513: open the document through Quick Open (⌘P), then comment four ways.
    await c.press('p', 'KeyP', 80, 4); await sleep(800);
    await c.insertText('Comment test.md'); await sleep(1200);
    await c.press('Enter', 'Enter', 13); await sleep(4000);
    const EDITOR = "d.querySelector('.ProseMirror')";
    report.editorReady = Boolean(await c.waitFor(EDITOR, 'return true', 40));
    const variants = [
      { name: 'A mouse pick, then text', para: 1, steps: ['@', 'pick-mouse', 'Make this warmer'] },
      { name: 'B keyboard pick (Enter), then text', para: 2, steps: ['@', 'pick-enter', 'Add an example'] },
      { name: 'C typed by hand', para: 3, steps: ['@claude Make this typed'] },
      { name: 'D text, then @ at the end, mouse pick', para: 4, steps: ['Please look ', '@', 'pick-mouse'] },
    ];
    for (const v of variants) {
      const word = await c.rectIn(EDITOR, `(function(){const p=[...d.querySelectorAll('.ProseMirror p')][${v.para - 1}]; if(!p) return null; const t=p.firstChild; const r=d.createRange(); const i=t.textContent.indexOf('paragraph'); r.setStart(t,i); r.setEnd(t,i+9); return r;})()`);
      if (!word) { report.m513.push({ variant: v.name, error: 'no word' }); continue; }
      await c.mouse(word.x, word.y, 2); await sleep(900);
      const commented = await c.clickIn(EDITOR, "d.querySelector('button[title=\"Add comment\"]')");
      await sleep(900);
      const box = await c.waitFor("d.querySelector('textarea[aria-label=\"Comment text\"]')", 'return true', 8);
      const steps = [];
      for (const s of v.steps) {
        if (s === 'pick-mouse') {
          const list = await c.waitFor("d.querySelector('[role=listbox][aria-label=\"Assign an agent\"]')", "return [...d.querySelectorAll('[role=option]')].map(o=>o.innerText.replace(/\\n/g,' '))", 5);
          const p = await c.rectIn(EDITOR, "[...d.querySelectorAll('.rm-mention-opt')].find(o=>o.innerText.startsWith('@claude'))");
          if (p) await c.mouse(p.x, p.y);
          steps.push({ pick: 'mouse', list, clicked: Boolean(p) });
        } else if (s === 'pick-enter') {
          const list = await c.waitFor("d.querySelector('[role=listbox][aria-label=\"Assign an agent\"]')", "return [...d.querySelectorAll('[role=option]')].map(o=>o.innerText.replace(/\\n/g,' '))", 5);
          await c.press('Enter', 'Enter', 13);
          steps.push({ pick: 'enter', list });
        } else {
          await c.insertText(s);
        }
        await sleep(500);
        steps.push({ after: s, box: await c.inFrame(EDITOR, "const t=d.querySelector('textarea[aria-label=\"Comment text\"]'); return t? {value:t.value, pill:(d.querySelector('.rm-agent-pill')||{}).innerText||null}: null") });
      }
      await c.press('Enter', 'Enter', 13); await sleep(2500);
      const file = fs.readFileSync(DOC, 'utf8');
      const marks = [...file.matchAll(/<mark data-comment="([^"]*)"([^>]*)>/g)].map((m) => ({ note: m[1], attrs: m[2].trim() }));
      report.m513.push({ variant: v.name, commented, box: Boolean(box), steps, marks });
      console.log('513', v.name, JSON.stringify(marks));
      save();
      await c.press('Escape', 'Escape', 27); await sleep(500);
    }
    await c.screenshot(path.join(path.dirname(OUT), 'r143-513-editor.png'));
    report.file = fs.readFileSync(DOC, 'utf8');
  }
} catch (error) {
  report.error = String(error?.stack ?? error);
  console.log('ERROR', report.error);
} finally {
  save();
  await c.quit();
}
