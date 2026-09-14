// Continue the already-finished storage interleavings; do not reseed or repeat writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {driver,targets,connectCdp,findWebview,waitFor,writeEvidence,evidence} from './normal-store-tools.mjs';
const previous=JSON.parse(fs.readFileSync(path.join(evidence,'normal-store-probe.json'),'utf8'));
assert.ok(previous.steps.some(s=>s.name==='both-real-controllers-read-lost-result'));
const pids=previous.steps.find(s=>s.name==='two-hosts-same-authority').inspectors.map(h=>h.hostPid);
const conversationId='00000000-0000-4000-8000-a00600000004';
const report={method:'Complete only the UI observation after the storage experiment. The first attempt sent the projection during initial AI-view hydration and did not observe it; re-reading the same unchanged stored transcript after the view is ready succeeds. No storage race or seed is rerun.',at:Date.now(),hostPids:pids,views:[]};
const api=(pid,operation)=>driver('/store-audit',{operation,...(operation==='inspect'?{}:{conversationId})},pid);
const open=[];
try{
 const hosts=await driver('/snapshots');assert.ok(pids.every(pid=>hosts.some(h=>h.hostPid===pid)));
 for(const pid of pids)await driver('/command',{command:'ritemark.unifiedView.focus'},pid);
 for(let i=0;i<pids.length;i++){
  const v=await findWebview("window.__auditStoreCandidate===undefined && !!document.querySelector('textarea[aria-label=\"Message\"]')");
  open.push(v);
  await v.evaluate('window.__auditStoreCandidate='+i);
  await v.evaluate('window.__auditStoreReceived=[];window.addEventListener("message",e=>{if(e.data?.type==="conversation/result")window.__auditStoreReceived.push({requestId:e.data.requestId,operation:e.data.operation});})');
 }
 for(const pid of pids){
  // Map a host by the unique projection response ID observed in its message listener.
  const sent=await api(pid,'show');
  const requestId=sent.response.requestId;
  const v=await waitFor(async()=>{for(const candidate of open)if(await candidate.evaluate('window.__auditStoreReceived.some(e=>e.requestId==='+JSON.stringify(requestId)+')'))return candidate;return false;},3000);
  await waitFor(()=>v.evaluate("document.body.innerText.includes('Synthetic shared-store audit request; no native dispatch.')"));
  await v.evaluate('window.__auditStoreHostPid='+pid);
  const state=await v.evaluate(`({userPromptVisible:document.body.innerText.includes('Synthetic shared-store audit request; no native dispatch.'),assistantResultVisible:document.body.innerText.includes('AUDIT SAVED ASSISTANT RESULT'),markdownContents:[...document.querySelectorAll('.rendered-markdown')].map(e=>e.textContent),activityTexts:[...document.querySelectorAll('[role="status"]')].map(e=>e.textContent),composerExists:!!document.querySelector('textarea[aria-label="Message"]')})`);
  assert.equal(state.userPromptVisible,true);assert.equal(state.assistantResultVisible,false);
  report.views.push({hostPid:pid,targetId:v.targetId,receivedRequestId:requestId,record:sent.response.data.conversation,...state});
 }
 const shell=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 try{const shot=await shell.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'normal-store-lost-result.png'),Buffer.from(shot.data,'base64'));}finally{shell.close();}
 report.endInspectors=await Promise.all(pids.map(pid=>api(pid,'inspect')));
 assert.ok(report.endInspectors.every(h=>h.runtimeSessionCount===0));
 report.completed=true;
}catch(e){report.error=String(e.stack??e);throw e;}
finally{open.forEach(v=>v.close());writeEvidence('normal-store-view-finish-probe.json',report);}
console.log(JSON.stringify({completed:report.completed,hostPids:pids,views:report.views.length}));
