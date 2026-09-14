import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {session,driver,findWebview,waitFor,targets,connectCdp,writeEvidence,evidence} from './formats-tools.mjs';
const report={method:'Actual PDF/DOCX viewers with two-page synthetic heading/text/table fixtures. Observe real host fileChanged/fileDeleted messages after local external writes; use visible DOCX Refresh and ordinary close/reopen controls. No forged load/refresh host messages.',formats:[],completed:false};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let v,c;
const save=()=>writeEvidence('formats-preview-probe.json',report);
const observe=async()=>v.evaluate(`(()=>{window.__auditFormatMessages=[];window.addEventListener('message',e=>{const m=e.data;if(m&&['load','fileChanged','fileDeleted'].includes(m.type))window.__auditFormatMessages.push({at:Date.now(),type:m.type,filename:m.filename,contentLength:typeof m.content==='string'?m.content.length:null});});return true;})()`);
const snapshot=async()=>v.evaluate(`(()=>({text:document.body.innerText,messages:window.__auditFormatMessages??[],buttons:[...document.querySelectorAll('button')].map(e=>({text:e.innerText,title:e.title,disabled:e.disabled})),docxPages:document.querySelectorAll('section.docx').length,pdfPages:document.querySelectorAll('.react-pdf__Page').length,tableCells:[...document.querySelectorAll('section.docx td')].map(e=>e.innerText),canvases:[...document.querySelectorAll('canvas')].map(e=>({width:e.width,height:e.height})),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('webview.js')||e.name.includes('pdf.worker')).map(e=>({name:e.name,decodedBodySize:e.decodedBodySize,duration:e.duration}))}))()`);
const screenshot=async name=>fs.writeFileSync(path.join(evidence,name),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
try{
 c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 // Positive draw.io control: the actual autosave export retains editable XML.
 await driver('/command',{command:'workbench.action.closeActiveEditor'});
 await driver('/open',{file:'diagram.drawio.svg'});
 v=await findWebview('!!window.__rmBridge && document.body.innerText.includes("LOCAL EDIT AFTER EXTERNAL")');
 report.drawioReopen={host:await driver(),bridge:await v.evaluate('window.__rmBridge'),localLabelPresent:true};
 v.close();v=undefined;await driver('/command',{command:'workbench.action.closeActiveEditor'});
 for(const ext of ['pdf','docx']){
  const file=path.join(session.workspace,'sample.'+ext),record={format:ext,baselineSha256:hash(file),steps:[]};report.formats.push(record);save();
  const base='AUDIT '+ext.toUpperCase()+' BASE',external='AUDIT '+ext.toUpperCase()+' EXTERNAL';
  await driver('/open',{file:'sample.'+ext});
  v=await findWebview('document.body.innerText.includes('+JSON.stringify(base)+')',25000);
  await observe();record.steps.push({stage:'baseline',at:Date.now(),view:await snapshot(),host:await driver()});save();
  if(ext==='docx'){
   assert.ok(record.steps.at(-1).view.text.includes('Eesti õäöü – väärtus 42.'));
   assert.deepEqual(record.steps.at(-1).view.tableCells,['Name','Value','Alpha','42','Beta','84']);
   assert.equal(record.steps.at(-1).view.docxPages,2);
  }else assert.ok(record.steps.at(-1).view.canvases.some(canvas=>canvas.width>0&&canvas.height>0));
  await screenshot('formats-'+ext+'-baseline.png');
  fs.copyFileSync(path.join(session.runDir,'variants/external.'+ext),file);record.externalSha256=hash(file);
  await waitFor(()=>v.evaluate("window.__auditFormatMessages.some(m=>m.type==='fileChanged')"));
  await new Promise(r=>setTimeout(r,1500));
  const changed=await snapshot();record.steps.push({stage:'external-change',at:Date.now(),view:changed});save();
  assert.ok(changed.text.includes(base));assert.ok(!changed.text.includes(external));
  record.staleDespiteDeliveredChange=true;
  await screenshot('formats-'+ext+'-after-external.png');
  if(ext==='docx'){
   await v.evaluate("document.querySelector('button[title=Refresh]').click()");
   await waitFor(()=>v.evaluate('document.body.innerText.includes('+JSON.stringify(external)+')'));
   record.manualRefreshWorked=true;
  }else{
   record.hasRefreshButton=changed.buttons.some(b=>/refresh/i.test(b.title+' '+b.text));assert.equal(record.hasRefreshButton,false);
   await driver('/command',{command:'workbench.action.closeActiveEditor'});v.close();v=undefined;
   await driver('/open',{file:'sample.pdf'});v=await findWebview('document.body.innerText.includes('+JSON.stringify(external)+')');await observe();
   record.reopenLoadedExternal=true;
  }
  record.steps.push({stage:'explicit-current-version',at:Date.now(),view:await snapshot()});save();
  fs.unlinkSync(file);
  await waitFor(()=>v.evaluate("window.__auditFormatMessages.some(m=>m.type==='fileDeleted')"));
  await new Promise(r=>setTimeout(r,500));
  record.steps.push({stage:'deleted-on-disk',at:Date.now(),fileExists:fs.existsSync(file),view:await snapshot()});save();
  assert.equal(fs.existsSync(file),false);assert.ok(record.steps.at(-1).view.text.includes(external));
  record.cachedAfterDeletion=true;
  // Restore only this synthetic document before closing the viewer.
  fs.copyFileSync(path.join(session.runDir,'variants/external.'+ext),file);
  await driver('/command',{command:'workbench.action.closeActiveEditor'});v.close();v=undefined;
  record.completed=true;save();
 }
 report.targetsAfter=(await targets()).map(t=>({id:t.id,type:t.type,url:t.url,title:t.title}));
 report.completed=true;save();console.log(JSON.stringify({completed:true,drawioReopened:true,formats:report.formats.map(f=>({format:f.format,staleDespiteDeliveredChange:f.staleDespiteDeliveredChange,manualRefreshWorked:f.manualRefreshWorked,reopenLoadedExternal:f.reopenLoadedExternal,cachedAfterDeletion:f.cachedAfterDeletion}))}));
}catch(e){report.error=String(e.stack??e);save();throw e;}finally{v?.close();c?.close();}
