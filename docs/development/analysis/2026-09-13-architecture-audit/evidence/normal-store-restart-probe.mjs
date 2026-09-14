import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {session,driver,waitFor,findWebview,writeEvidence,evidence} from './normal-store-tools.mjs';
const stopped=JSON.parse(fs.readFileSync(path.join(evidence,'normal-store-stop-before-restart.json'),'utf8'));
assert.ok(stopped.completed&&stopped.cdpPortClosed&&stopped.remaining.length===0);
assert.notEqual(session.pid,stopped.pid);
const report={method:'Fresh normal-mode app process after verified closure of both writers. Read the same on-disk fixtures through actual newly constructed controllers; no seed, race, preference or completion operation is replayed.',at:Date.now(),pid:session.pid,previousPid:stopped.pid};
try{
 const hosts=await waitFor(async()=>{const h=await driver('/snapshots');return h.length&&h.every(x=>x.ritemark?.active)?h:false;},20000);
 report.hosts=hosts;report.readbacks=[];report.artifacts={};
 for(const rel of ['out/extension.js','media/webview.js','package.json']){
  const buf=fs.readFileSync(path.join(session.extensionPath,rel));const sha256=crypto.createHash('sha256').update(buf).digest('hex');assert.equal(sha256,session.files[rel].sha256);report.artifacts[rel]={bytes:buf.length,sha256};
 }
 for(const h of hosts){
  const inspector=await driver('/store-audit',{operation:'inspect'},h.hostPid);
  assert.equal(inspector.runtimeSessionCount,0);assert.equal(inspector.interception,null);
  const records=[];
  for(const n of [1,2,3,4]){
   const response=await driver('/store-audit',{operation:'get',conversationId:'00000000-0000-4000-8000-a0060000000'+n},h.hostPid);
   assert.equal(response.response.ok,true);records.push(response.response.data.conversation);
  }
  assert.deepEqual(records[0].composerPreferences.thinkingEffortByRuntime,{codex:'high','claude-code':'low'});
  assert.deepEqual(records[1].composerPreferences.thinkingEffortByRuntime,{codex:'high','claude-code':'low'});
  assert.deepEqual(records[2].composerPreferences.thinkingEffortByRuntime,{'claude-code':'low'});
  assert.equal(records[3].events.some(e=>e.kind==='assistant-message'),false);
  report.readbacks.push({hostPid:h.hostPid,inspector,records});
 }
 // A real postMessage reload in the now-ready AI view of the first host.
 const h=hosts[0];await driver('/command',{command:'ritemark.unifiedView.focus'},h.hostPid);
 const v=await findWebview('!!document.querySelector(\'textarea[aria-label="Message"]\')');
 try{
  await driver('/store-audit',{operation:'show',conversationId:'00000000-0000-4000-8000-a00600000004'},h.hostPid);
  await waitFor(()=>v.evaluate("document.body.innerText.includes('Synthetic shared-store audit request; no native dispatch.')"));
  report.view=await v.evaluate(`({userPromptVisible:document.body.innerText.includes('Synthetic shared-store audit request; no native dispatch.'),assistantResultVisible:document.body.innerText.includes('AUDIT SAVED ASSISTANT RESULT'),workingVisible:document.body.innerText.includes('Working...')})`);
  assert.ok(report.view.userPromptVisible&&!report.view.assistantResultVisible);
 }finally{v.close();}
 report.completed=true;
}catch(e){report.error=String(e.stack??e);throw e;}
finally{writeEvidence('normal-store-restart-probe.json',report);}
console.log(JSON.stringify({completed:report.completed,hostPids:report.hosts?.map(h=>h.hostPid),savedResultStillAbsent:!report.view?.assistantResultVisible}));
