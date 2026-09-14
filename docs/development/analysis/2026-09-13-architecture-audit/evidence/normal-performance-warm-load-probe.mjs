import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {session,driver,targets,writeEvidence,evidence} from './normal-performance-tools.mjs';

// Flattened CDP sessions observe a newly created webview without pausing it.
// The capture start is checked against its subsequent product script request. Only this disposable profile is addressed, via its private CDP port.
const file='normal-performance-warm-load-probe.json';
const report={method:session.method,at:Date.now(),pid:session.pid,fixture:session.fixture,
  machine:{platform:os.platform(),arch:os.arch(),release:os.release(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemory:os.totalmem()},
  instrumentation:'Auto-attach without pausing new iframe, CPU throttle, Performance metrics, 1 ms CPU sampling and precise block coverage before the bundle request (checked against navigation/resource timestamps). Main-thread long tasks collected by buffered observer. All trials instrumented; timings are not uninstrumented production benchmarks.',trials:[],errors:[]};
const save=()=>writeEvidence(file,report);
report.hosts=await driver('/snapshots');assert.equal(report.hosts.length,1);
assert.equal(report.hosts[0].ritemark.path,session.extensionPath);
assert.equal(report.hosts[0].driverMode,1);
assert.ok(report.hosts[0].globalStorageRoot.startsWith(session.profile));
const version=await fetch('http://127.0.0.1:9243/json/version').then(r=>r.json());
report.browser=Object.fromEntries(Object.entries(version).filter(([key])=>key!=='webSocketDebuggerUrl'));
const ws=new WebSocket(version.webSocketDebuggerUrl),pending=new Map(),contexts=new Map(),attached=new Map();let nextId=0,activeTrial=null;
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{
 const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP observation timeout: '+method));},12000);
 pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
});}
const filter=[{type:'page'},{type:'iframe'},{exclude:true}];
const observer=`(()=>{if(globalThis.__auditPerf)return;globalThis.__auditPerf={installedAt:performance.now(),longTasks:[]};new PerformanceObserver(list=>{for(const e of list.getEntries())globalThis.__auditPerf.longTasks.push({startTime:e.startTime,duration:e.duration,name:e.name})}).observe({type:'longtask',buffered:true})})()`;
async function setupAttached(p){
 const item={sessionId:p.sessionId,targetId:p.targetInfo.targetId,type:p.targetInfo.type,url:p.targetInfo.url,waitingForDebugger:p.waitingForDebugger,trial:activeTrial?.index??null,setupAt:Date.now()};
 attached.set(p.sessionId,item);contexts.set(p.sessionId,new Map());
 try{
  await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true,filter},p.sessionId);
  await send('Runtime.enable',{},p.sessionId);
  if(activeTrial&&item.type==='iframe'){
   activeTrial.attached.push(item);
   await send('Emulation.setCPUThrottlingRate',{rate:activeTrial.rate},p.sessionId);
   await send('Performance.enable',{},p.sessionId);
   item.before=(await send('Performance.getMetrics',{},p.sessionId)).metrics;
   await send('Page.addScriptToEvaluateOnNewDocument',{source:observer},p.sessionId);
   for(const ctx of contexts.get(p.sessionId).values())if(ctx.auxData?.isDefault)await send('Runtime.evaluate',{expression:observer,contextId:ctx.id},p.sessionId);
   await send('Profiler.enable',{},p.sessionId);
   await send('Profiler.setSamplingInterval',{interval:1000},p.sessionId);
   await send('Profiler.startPreciseCoverage',{callCount:true,detailed:true},p.sessionId);
   await send('Profiler.start',{},p.sessionId);
   item.profileStartedAt=Date.now();
   item.instrumented=true;
  }
 }catch(e){item.setupError=String(e);report.errors.push({targetId:item.targetId,error:String(e)});}
 finally{try{await send('Runtime.runIfWaitingForDebugger',{},p.sessionId);item.resumedAt=Date.now();}catch(e){item.resumeError=String(e);}save();}
}
ws.onmessage=event=>{
 const m=JSON.parse(event.data);
 if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);return;}
 if(m.method==='Target.attachedToTarget')void setupAttached(m.params);
 if(m.method==='Runtime.executionContextCreated')contexts.get(m.sessionId)?.set(m.params.context.id,m.params.context);
 if(m.method==='Runtime.executionContextDestroyed')contexts.get(m.sessionId)?.delete(m.params.executionContextId);
 if(m.method==='Runtime.executionContextsCleared')contexts.get(m.sessionId)?.clear();
 if(m.method==='Target.detachedFromTarget'){const item=attached.get(m.params.sessionId);if(item)item.detachedAt=Date.now();contexts.delete(m.params.sessionId);}
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(sid,cid,expression){const r=await send('Runtime.evaluate',{contextId:cid,expression,returnByValue:true,awaitPromise:true},sid);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
function metrics(items){return Object.fromEntries(items.map(m=>[m.name,m.value]));}
try{
 await driver('/command',{command:'workbench.action.closeAllEditors'});
 await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true,filter});
 await sleep(700);
 // Alternate rates so a warm-up/order trend cannot be mistaken for throttling.
 for(const [index,rate] of [1,4,4,1,1,4].entries()){
  const trial={index:index+1,rate,attached:[],startedAt:Date.now()};report.trials.push(trial);activeTrial=trial;save();
  await driver('/open',{file:'note.md'});trial.openCommandReturnedAt=Date.now();
  let found;
  while(Date.now()-trial.startedAt<25000&&!found){
   for(const item of trial.attached.filter(i=>i.instrumented&&!i.detachedAt)){
    for(const ctx of contexts.get(item.sessionId)?.values()??[]){
     if(!ctx.auxData?.isDefault)continue;
     try{const value=await evaluate(item.sessionId,ctx.id,`(()=>{const e=document.querySelector('.tiptap[contenteditable="true"]');return e&&e.textContent.length>10?{text:e.innerText,html:e.innerHTML,now:performance.now(),timeOrigin:performance.timeOrigin,editorType:document.querySelector('#root')?.dataset.editorType??null}:null})()`);
      if(value){found={item,ctx,value};break;}
     }catch(e){trial.lastObservationError=String(e);}
    }if(found)break;
   }
   if(!found)await sleep(50);
  }
  assert.ok(found,'Actual Markdown editor not observed; this is an observation failure, not an app crash');
  assert.equal(found.item.waitingForDebugger,false,'No product startup paused');
  assert.ok(!found.item.setupError);
  const sid=found.item.sessionId,cid=found.ctx.id;
  trial.readyObservedAt=Date.now();trial.ready=found.value;trial.targetId=found.item.targetId;
  await evaluate(sid,cid,observer);
  trial.rendered=await evaluate(sid,cid,`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({at:performance.now(),text:document.querySelector('.tiptap')?.innerText,observer:globalThis.__auditPerf??null,resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('webview.js')).map(r=>({name:r.name,startTime:r.startTime,duration:r.duration,responseEnd:r.responseEnd,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize})),navigation:performance.getEntriesByType('navigation').map(n=>({startTime:n.startTime,domInteractive:n.domInteractive,domContentLoadedEventEnd:n.domContentLoadedEventEnd,loadEventEnd:n.loadEventEnd}))}))))`);
  assert.equal(trial.rendered.resources.length,1);
  trial.scriptRequestEpoch=found.value.timeOrigin+trial.rendered.resources[0].startTime;
  assert.ok(found.item.profileStartedAt<trial.scriptRequestEpoch,'Profiling must start before bundle fetch');
  trial.after=(await send('Performance.getMetrics',{},sid)).metrics;
  const cpu=(await send('Profiler.stop',{},sid)).profile;
  const coverage=await send('Profiler.takePreciseCoverage',{},sid);
  await send('Profiler.stopPreciseCoverage',{},sid);
  trial.profileFile=`normal-performance-warm-trial-${trial.index}.cpuprofile`;
  trial.coverageFile=`normal-performance-warm-trial-${trial.index}-coverage.json`;
  fs.writeFileSync(path.join(evidence,trial.profileFile),JSON.stringify(cpu)+'\n');
  fs.writeFileSync(path.join(evidence,trial.coverageFile),JSON.stringify(coverage)+'\n');
  const before=metrics(found.item.before),after=metrics(trial.after);
  trial.metricDelta=Object.fromEntries(['ScriptDuration','TaskDuration','LayoutDuration','RecalcStyleDuration','V8CompileDuration','JSHeapUsedSize','JSHeapTotalSize'].filter(k=>k in before&&k in after).map(k=>[k,after[k]-before[k]]));
  trial.elapsedOpenToObservedMs=trial.readyObservedAt-trial.startedAt;
  trial.elapsedResumeToObservedMs=trial.readyObservedAt-found.item.resumedAt;
  trial.completed=true;activeTrial=null;save();
  console.log(JSON.stringify({trial:trial.index,rate,elapsedMs:trial.elapsedOpenToObservedMs,metrics:trial.metricDelta,targetId:trial.targetId}));
  await send('Emulation.setCPUThrottlingRate',{rate:1},sid);
  await driver('/command',{command:'workbench.action.closeAllEditors'});
  const closeStarted=Date.now();while(!found.item.detachedAt&&Date.now()-closeStarted<5000)await sleep(50);
  assert.ok(found.item.detachedAt,'Closed view target must be destroyed before new trial');
 }
 assert.equal(new Set(report.trials.map(t=>t.targetId)).size,6);
 assert.equal(report.errors.length,0);
 report.completed=true;save();console.log(JSON.stringify({completed:true,trials:report.trials.length,file}));
}catch(e){report.error=String(e.stack??e);save();throw e;}
finally{
 activeTrial=null;
 for(const item of attached.values())if(!item.detachedAt){try{await send('Emulation.setCPUThrottlingRate',{rate:1},item.sessionId);await send('Runtime.runIfWaitingForDebugger',{},item.sessionId);}catch{}}
 try{await send('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:true});}catch{}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Audit observer disconnected'));}pending.clear();ws.close();
}
