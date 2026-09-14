import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {driver,findWebview,waitFor,session,writeEvidence,targets,connectCdp,evidence} from './live-tools.mjs';
const require=createRequire(import.meta.url);
const xlsx=require('../../../../../extensions/ritemark/node_modules/xlsx');
const file=path.join(session.workspace,'book.xlsx');
const readValue=()=>xlsx.readFile(file).Sheets.Sheet1.B2.v;
const report={method:'Actual Excel custom provider and React DataTable in the audit extension. Synthetic XLSX, real cell edit through DOM mouse event + CDP text/key input, external SheetJS file replacement, then normal VS Code Save command. No direct mutation of provider buffers.',steps:[]};
function record(stage,details){report.steps.push({stage,at:Date.now(),...details});writeEvidence('live-excel-probe.json',report);}
let view,shell;
try {
  await driver('/open',{file:'book.xlsx'});
  view=await findWebview("!!document.querySelector('td[title=\"baseline\"]')");
  record('initial',{host:await driver(),diskValue:readValue(),cells:await view.evaluate("[...document.querySelectorAll('td[title]')].map(e=>e.title)")});
  assert.equal(readValue(),'baseline');
  await view.evaluate("document.querySelector('td[title=\"baseline\"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,detail:2}))");
  await waitFor(()=>view.evaluate("!!document.querySelector('td textarea')"));
  await view.evaluate("(()=>{const e=document.querySelector('td textarea');e.focus();e.select();})()");
  await view.cdp.send('Input.insertText',{text:'HUMAN EDIT'});
  await view.cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  await view.cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13});
  const dirty=await waitFor(async()=>{const s=await driver();return s.tabs.some(g=>g.tabs.some(t=>t.label==='book.xlsx'&&t.dirty))?s:false;});
  assert.equal(readValue(),'baseline');
  assert.ok(await view.evaluate("!!document.querySelector('td[title=\"HUMAN EDIT\"]')"));
  record('human-unsaved',{host:dirty,diskValue:readValue(),visible:await view.evaluate('document.body.innerText')});
  const external=xlsx.readFile(file);external.Sheets.Sheet1.B2={t:'s',v:'EXTERNAL SAVED'};xlsx.writeFile(external,file);
  assert.equal(readValue(),'EXTERNAL SAVED');
  await new Promise(r=>setTimeout(r,1200));
  record('external-replacement',{host:await driver(),diskValue:readValue(),visible:await view.evaluate('document.body.innerText')});
  let saveResult;
  const save=driver('/command',{command:'workbench.action.files.save'}).then(r=>saveResult={ok:true,host:r},e=>saveResult={ok:false,error:String(e)});
  const started=Date.now();
  while(Date.now()-started<2500&&readValue()!=='HUMAN EDIT')await new Promise(r=>setTimeout(r,100));
  await Promise.race([save,new Promise(r=>setTimeout(r,1000))]);
  const wb=(await targets()).find(t=>t.type==='page'&&t.url.includes('workbench'));shell=await connectCdp(wb.webSocketDebuggerUrl);
  const dialogs=(await shell.send('Runtime.evaluate',{expression:"[...document.querySelectorAll('.monaco-dialog-box,[role=dialog]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.innerText)",returnByValue:true})).result?.value;
  const shot=await shell.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'live-excel-after-save.png'),Buffer.from(shot.data,'base64'));
  record('save-after-external-replacement',{host:await driver(),saveResult:saveResult??'not-settled',diskValue:readValue(),visible:await view.evaluate('document.body.innerText'),dialogs});
  report.externalValueOverwritten=readValue()==='HUMAN EDIT';
  report.saveCompleted=saveResult?.ok===true;
  report.anyDialogRoleObserved=Array.isArray(dialogs)&&dialogs.length>0;
  report.completed=true;writeEvidence('live-excel-probe.json',report);
  console.log(JSON.stringify({completed:true,externalValueOverwritten:report.externalValueOverwritten,saveCompleted:report.saveCompleted,anyDialogRoleObserved:report.anyDialogRoleObserved},null,2));
}catch(error){record('error',{error:String(error?.stack??error)});throw error;}
finally {view?.close();shell?.close();}
