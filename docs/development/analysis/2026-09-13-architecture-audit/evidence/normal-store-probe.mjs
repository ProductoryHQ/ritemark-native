import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {session,driver,targets,connectCdp,findWebview,waitFor,processList,writeEvidence,evidence} from './normal-store-tools.mjs';

const report={at:Date.now(),method:'Actual cached production ConversationController/ConversationStore objects in two no-folder Ritemark extension hosts. Only synthetic fixture IDs are seeded. The audit driver calls host controller entrypoints without native model dispatch. A bounded per-Store filesystem wrapper pauses fixture record renames after the production revision check; delegates all bytes and IO unchanged. This proves a reachable storage interleaving, not its natural frequency or ordinary UI input timing.',steps:[]};
const file='normal-store-probe.json';
const record=(name,data)=>{report.steps.push({name,at:Date.now(),...data});writeEvidence(file,report);};
const api=(pid,operation,conversationId,extra={})=>driver('/store-audit',{operation,...(conversationId?{conversationId}:{}),...extra},pid);
const id=n=>'00000000-0000-4000-8000-a0060000000'+n;
const preference=(pid,n,agentId,thinkingEffort)=>api(pid,'preference',id(n),{agentId,thinkingEffort});
let pids=[];
const connections=[];
try{
 const first=await driver('/snapshot');
 assert.equal(first.driverMode,1);assert.equal(first.ritemark.path,session.extensionPath);
 assert.deepEqual(first.workspaceFolders,[]);assert.equal(first.workspaceFile,null);
 assert.ok(processList().find(p=>p.pid===session.pid)?.command.includes(session.profile));
 const env={...process.env,RITEMARK_AUDIT_NORMAL_RUN_DIR:session.runDir};
 for(const key of ['ELECTRON_RUN_AS_NODE','VSCODE_ESM_ENTRYPOINT','VSCODE_CRASH_REPORTER_PROCESS_TYPE','VSCODE_HANDLES_UNCAUGHT_ERRORS','VSCODE_NLS_CONFIG','VSCODE_IPC_HOOK','VSCODE_PID','VSCODE_CWD','VSCODE_L10N_BUNDLE_LOCATION'])delete env[key];
 const fd=fs.openSync(path.join(session.runDir,'store-app.log'),'a');
 const child=spawn(session.args[0],session.args.slice(1),{env,stdio:['ignore',fd,fd],detached:true});fs.closeSync(fd);child.unref();
 record('second-empty-window-requested',{mainPid:session.pid,cliPid:child.pid,args:session.args});
 const hosts=await waitFor(async()=>{const h=await driver('/snapshots');return h.length===2&&h.every(x=>x.ritemark?.active)?h:false;},25000);
 pids=[first.hostPid,hosts.find(h=>h.hostPid!==first.hostPid).hostPid];
 const [a,b]=pids;
 const inspectors=await Promise.all(pids.map(pid=>api(pid,'inspect')));
 assert.deepEqual(inspectors[0].scope,inspectors[1].scope);
 assert.equal(inspectors[0].baseDir,inspectors[1].baseDir);
 assert.ok(inspectors.every(h=>h.productModuleCached&&h.runtimeSessionCount===0));
 const baseDir=inspectors[0].baseDir;
 const disk=n=>JSON.parse(fs.readFileSync(path.join(baseDir,'records',id(n)+'.json'),'utf8'));
 record('two-hosts-same-authority',{hosts,inspectors});

 // Sequential changes across hosts are a successful control.
 await api(a,'seed',id(1));
 const sequentialA=await preference(a,1,'codex','high');
 const sequentialB=await preference(b,1,'claude-code','low');
 assert.ok(sequentialA.response.ok&&sequentialB.response.ok);
 assert.deepEqual(disk(1).composerPreferences.thinkingEffortByRuntime,{codex:'high','claude-code':'low'});
 assert.equal(disk(1).revision,3);
 record('sequential-two-host-control',{responses:[sequentialA,sequentialB],disk:disk(1)});

 // Concurrent requests inside one Store serialize their reads and writes.
 await api(a,'seed',id(2));await api(a,'arm',id(2));
 const sameFirst=preference(a,2,'codex','high');
 await waitFor(async()=>{const s=await api(a,'inspect');return s.interception?.stage==='held'?s:false;});
 let secondSettled=false;
 const sameSecond=preference(a,2,'claude-code','low').then(r=>{secondSettled=true;return r;});
 await new Promise(r=>setTimeout(r,200));
 const sameHeld=await api(a,'inspect');
 record('one-host-first-write-held',{inspector:sameHeld,secondRequestSettled:secondSettled,disk:disk(2)});
 assert.equal(secondSettled,false);assert.equal(disk(2).revision,1);
 await api(a,'release');
 const sameResponses=await Promise.all([sameFirst,sameSecond]);
 assert.ok(sameResponses.every(r=>r.response.ok));
 assert.deepEqual(disk(2).composerPreferences.thinkingEffortByRuntime,{codex:'high','claude-code':'low'});
 assert.equal(disk(2).revision,3);await api(a,'reset-observer');
 record('one-host-concurrent-control',{responses:sameResponses,disk:disk(2)});

 // Cross-host preferences both read revision 1; each prepares revision 2.
 await api(a,'seed',id(3));
 await Promise.all(pids.map(pid=>api(pid,'arm',id(3))));
 const prefA=preference(a,3,'codex','high');
 const prefB=preference(b,3,'claude-code','low');
 const heldPreferences=await waitFor(async()=>{const s=await Promise.all(pids.map(pid=>api(pid,'inspect')));return s.every(h=>h.interception?.stage==='held')?s:false;});
 assert.ok(heldPreferences.every(h=>h.interception.candidate.revision===2));
 record('two-host-preferences-both-prepared',{inspectors:heldPreferences,disk:disk(3)});
 await api(a,'release');const ackA=await prefA;
 record('two-host-preference-a-acknowledged',{response:ackA,disk:disk(3)});
 await api(b,'release');const ackB=await prefB;
 assert.ok(ackA.response.ok&&ackB.response.ok);
 assert.equal(ackA.response.data.conversation.revision,2);assert.equal(ackB.response.data.conversation.revision,2);
 assert.deepEqual(disk(3).composerPreferences.thinkingEffortByRuntime,{'claude-code':'low'});
 record('two-host-preference-update-lost',{responses:[ackA,ackB],disk:disk(3)});
 await Promise.all(pids.map(pid=>api(pid,'reset-observer')));

 // Actual completion checkpoint acknowledged before another host's stale preference replaces it.
 await api(a,'seed',id(4));await Promise.all(pids.map(pid=>api(pid,'arm',id(4))));
 const completion=api(a,'complete',id(4));
 const concurrentPreference=preference(b,4,'codex','high');
 const heldCompletion=await waitFor(async()=>{const s=await Promise.all(pids.map(pid=>api(pid,'inspect')));return s.every(h=>h.interception?.stage==='held')?s:false;});
 assert.equal(heldCompletion[0].interception.candidate.events.length,2);
 assert.equal(heldCompletion[1].interception.candidate.events.length,1);
 record('completion-and-preference-both-prepared',{inspectors:heldCompletion,disk:disk(4)});
 await api(a,'release');const completionAck=await completion;
 assert.equal(completionAck.record.events.length,2);assert.equal(disk(4).events.length,2);
 assert.equal(disk(4).lifecycle.state,'idle');
 record('assistant-result-acknowledged-and-on-disk',{response:completionAck,disk:disk(4)});
 await api(b,'release');const stalePreferenceAck=await concurrentPreference;
 assert.equal(stalePreferenceAck.response.ok,true);
 assert.equal(disk(4).revision,2);assert.equal(disk(4).events.length,1);
 assert.equal(disk(4).lifecycle.state,'working');
 record('acknowledged-result-lost',{response:stalePreferenceAck,disk:disk(4)});
 await Promise.all(pids.map(pid=>api(pid,'reset-observer')));
 const readbacks=await Promise.all(pids.map(pid=>api(pid,'get',id(4))));
 assert.ok(readbacks.every(r=>r.response.ok&&r.response.data.conversation.events.length===1));
 record('both-real-controllers-read-lost-result',{readbacks});

 // Display through the actual host webview postMessage, then inspect the production UI.
 const views=[];
 for(const pid of pids){
  await driver('/command',{command:'ritemark.unifiedView.focus'},pid);
  await api(pid,'show',id(4));
  const view=await findWebview("!window.__auditStoreHostPid && document.body.innerText.includes('Synthetic shared-store audit request; no native dispatch.')");
  connections.push(view);
  await view.evaluate('window.__auditStoreHostPid='+pid);
  const state=await view.evaluate(`({userPromptVisible:document.body.innerText.includes('Synthetic shared-store audit request; no native dispatch.'),assistantResultVisible:document.body.innerText.includes('AUDIT SAVED ASSISTANT RESULT'),markdownContents:[...document.querySelectorAll('.rendered-markdown')].map(e=>e.textContent),activityTexts:[...document.querySelectorAll('[role="status"]')].map(e=>e.textContent),composerExists:!!document.querySelector('textarea[aria-label="Message"]')})`);
  assert.equal(state.userPromptVisible,true);assert.equal(state.assistantResultVisible,false);
  views.push({hostPid:pid,targetId:view.targetId,...state});
 }
 record('lost-result-reloaded-in-two-real-webviews',{views});
 const shell=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 try{const shot=await shell.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'normal-store-lost-result.png'),Buffer.from(shot.data,'base64'));}finally{shell.close();}
 report.hostPids=pids;report.baseDir=baseDir;
 report.endInspectors=await Promise.all(pids.map(pid=>api(pid,'inspect')));
 assert.ok(report.endInspectors.every(h=>h.runtimeSessionCount===0));
 report.completed=true;
 report.limits=['Record rename timing was deliberately controlled for at most 8 seconds; no natural failure-rate estimate.','Host controller entrypoints were invoked by a bounded audit observer; preference and runtime-completion were not produced by actual UI gestures or a live model.','Same-scope no-folder windows only; different workspace descriptors have different conversation scopes.','Both successful controls and the failed interleavings use actual production host objects and disk IO.','Restart persistence is a separate follow-up observation.'];
}catch(e){report.error=String(e.stack??e);throw e;}
finally{
 await Promise.allSettled(pids.map(pid=>api(pid,'reset-observer')));
 connections.forEach(c=>c.close());writeEvidence(file,report);
}
console.log(JSON.stringify({completed:report.completed,hostPids:pids,steps:report.steps.map(s=>s.name)}));
