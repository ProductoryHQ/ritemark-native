import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {driver,findWebview,waitFor,session,writeEvidence,targets,connectCdp,evidence} from './live-tools.mjs';

const fileName='second.md';
const file=path.join(session.workspace,fileName);
const marker=String(Date.now());
const report={method:'Actual audit extension in installed compatible macOS shell. Synthetic file; CDP Input.insertText simulates editor typing, Node fs writes simulate another actor. Driver reads actual VS Code document state.',steps:[]};
function record(stage,details){report.steps.push({stage,at:Date.now(),...details});writeEvidence('live-markdown-probe.json',report);}
let view;
try {
  await driver('/open',{file:fileName});
  view=await findWebview("document.querySelector('.ProseMirror')?.innerText.includes('Independent document')");
  await view.evaluate("window.__auditDocumentMessages=[];window.addEventListener('message',e=>{if(e.data?.type?.startsWith('document:')){window.__auditDocumentMessages.push(e.data);if(window.__auditDocumentMessages.length>200)window.__auditDocumentMessages.shift();}})");
  record('initial',{host:await driver(),visible:await view.evaluate("document.querySelector('.ProseMirror').innerText"),disk:fs.readFileSync(file,'utf8')});
  const cleanLabel='EXTERNAL CLEAN '+marker;
  const externalClean='# Audit note\n\n'+cleanLabel+' paragraph.\n\nStable selection area.\n';
  const t1=Date.now();fs.writeFileSync(file,externalClean);
  await waitFor(async()=>{const host=await driver();const doc=host.documents.find(d=>d.file===fileName);return doc?.text===externalClean&&!doc.dirty&&(await view.evaluate("document.querySelector('.ProseMirror').innerText")).includes(cleanLabel);});
  record('clean-external-update',{visibleAfterMs:Date.now()-t1,host:await driver(),visible:await view.evaluate("document.querySelector('.ProseMirror').innerText")});
  await view.evaluate("(()=>{const e=document.querySelector('.ProseMirror');e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);return document.activeElement.className;})()");
  await view.cdp.send('Input.insertText',{text:' HUMAN UNSAVED'});
  const dirty=await waitFor(async()=>{const s=await driver();const d=s.documents.find(d=>d.file===fileName);return d?.dirty&&d.text.includes('HUMAN UNSAVED')?s:false;});
  assert.equal(fs.readFileSync(file,'utf8'),externalClean);
  record('human-unsaved',{host:dirty,visible:await view.evaluate("document.querySelector('.ProseMirror').innerText"),disk:fs.readFileSync(file,'utf8')});
  const conflictLabel='EXTERNAL CONFLICT '+marker;
  const externalConflict='# Audit note\n\n'+conflictLabel+' paragraph.\n\nStable selection area.\n';
  fs.writeFileSync(file,externalConflict);
  const conflictHash=crypto.createHash('sha256').update(externalConflict).digest('hex');
  await waitFor(()=>view.evaluate("window.__auditDocumentMessages.some(e=>e.type==='document:conflict'&&e.diskHash==="+JSON.stringify(conflictHash)+")&&[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Review changes')"));
  const conflict=await driver();assert.ok(conflict.documents.find(d=>d.file===fileName).text.includes('HUMAN UNSAVED'));
  assert.equal(fs.readFileSync(file,'utf8'),externalConflict);
  record('conflict-preserves-both',{host:conflict,disk:fs.readFileSync(file,'utf8'),visible:await view.evaluate("document.body.innerText")});
  await view.evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Review changes').click()");
  await waitFor(()=>view.evaluate("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Use disk version')"));
  record('conflict-dialog',{visible:await view.evaluate("document.body.innerText")});
  const wb=(await targets()).find(t=>t.type==='page'&&t.url.includes('workbench'));const shell=await connectCdp(wb.webSocketDebuggerUrl);
  const screenshot=await shell.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'live-markdown-conflict.png'),Buffer.from(screenshot.data,'base64'));shell.close();
  await view.evaluate("[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Use disk version').click()");
  await waitFor(async()=>(await view.evaluate("document.querySelector('.ProseMirror').innerText")).includes(conflictLabel));
  record('use-disk',{host:await driver(),disk:fs.readFileSync(file,'utf8'),visible:await view.evaluate("document.querySelector('.ProseMirror').innerText")});
  await view.evaluate("document.querySelector('.ProseMirror').focus()");
  await view.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',modifiers:4,windowsVirtualKeyCode:90,nativeVirtualKeyCode:90});
  await view.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'z',code:'KeyZ',modifiers:4,windowsVirtualKeyCode:90,nativeVirtualKeyCode:90});
  await waitFor(async()=>(await view.evaluate("document.querySelector('.ProseMirror').innerText")).includes('HUMAN UNSAVED'));
  assert.equal(fs.readFileSync(file,'utf8'),externalConflict);
  record('undo-retains-prior-local',{host:await driver(),disk:fs.readFileSync(file,'utf8'),visible:await view.evaluate("document.querySelector('.ProseMirror').innerText")});
  report.documentMessages=await view.evaluate('window.__auditDocumentMessages');
  report.completed=true;writeEvidence('live-markdown-probe.json',report);
  console.log(JSON.stringify({completed:true,stages:report.steps.map(s=>s.stage)},null,2));
} catch(error){record('error',{error:String(error?.stack??error)});throw error;}
finally {view?.close();}
