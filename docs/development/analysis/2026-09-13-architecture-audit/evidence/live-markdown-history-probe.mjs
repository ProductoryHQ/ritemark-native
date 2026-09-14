import fs from 'node:fs';
import path from 'node:path';
import {driver,findWebview,waitFor,session,writeEvidence} from './live-tools.mjs';
const name='second.md', file=path.join(session.workspace,name);
const marker=' UNDO CONTROL '+Date.now();
const report={method:'Follow-up to the completed use-disk step. Uses actual editor keyboard input, with an independent append/undo control to distinguish shortcut delivery from conflict-history semantics.',steps:[]};
const record=(stage,data)=>{report.steps.push({stage,at:Date.now(),...data});writeEvidence('live-markdown-history-probe.json',report);};
let v;
try {
  await driver('/open',{file:name});
  v=await findWebview("document.querySelector('.ProseMirror')?.innerText.includes('EXTERNAL CONFLICT 1789293524852')");
  const visible=()=>v.evaluate("document.querySelector('.ProseMirror').innerText");
  const key=async()=>{for(const type of ['keyDown','keyUp'])await v.cdp.send('Input.dispatchKeyEvent',{type,key:'z',code:'KeyZ',modifiers:4,windowsVirtualKeyCode:90});};
  record('before',{host:await driver(),visible:await visible(),disk:fs.readFileSync(file,'utf8')});
  await v.evaluate("(()=>{const e=document.querySelector('.ProseMirror');e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);})()");
  await v.cdp.send('Input.insertText',{text:marker});
  await waitFor(async()=>(await driver()).documents.find(d=>d.file===name)?.text.includes(marker));
  record('control-insertion',{host:await driver(),visible:await visible()});
  await key();
  try{await waitFor(async()=>!(await visible()).includes(marker),3000);report.controlUndoWorked=true;}catch{report.controlUndoWorked=false;}
  record('control-undo',{host:await driver(),visible:await visible()});
  await key();
  await new Promise(r=>setTimeout(r,500));
  report.priorConflictLocalTextRestored=(await visible()).includes('HUMAN UNSAVED');
  record('second-undo',{host:await driver(),visible:await visible(),disk:fs.readFileSync(file,'utf8')});
  report.completed=true;writeEvidence('live-markdown-history-probe.json',report);
  console.log(JSON.stringify({completed:true,controlUndoWorked:report.controlUndoWorked,priorConflictLocalTextRestored:report.priorConflictLocalTextRestored}));
}catch(e){record('error',{error:String(e.stack??e)});throw e;}finally{v?.close();}
