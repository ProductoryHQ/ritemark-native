import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,findWebview,waitFor,processList,writeEvidence,evidence} from './normal-speech-tools.mjs';
const report={method:'Actual registered speech JobManager/SessionStore and globalState in two normal-mode extension hosts. Only the synthetic audio transcription boundary is held/released; production prepareAudio, peaks, jobs, persistence and UI remain active. No whisper/model/cloud request; this is an ownership/recovery test, not transcription fidelity.',startedAt:Date.now(),stages:[]};
const save=()=>writeEvidence('normal-speech-recovery-observed-probe.json',report);
const stage=(name,value)=>{report.stages.push({name,at:Date.now(),value});save();console.log(JSON.stringify({stage:name}));};
const api=(pid,operation,extra={})=>driver('/speech-audit',{operation,...extra},pid);
const inspect=pid=>api(pid,'inspect');
let controlView,panelA,panelB,c;
try{
 const prior=JSON.parse(fs.readFileSync(path.join(evidence,'normal-speech-recovery-probe.json'),'utf8'));
 const pidA=prior.pidA,first=await driver('/snapshot',undefined,pidA);report.pidA=pidA;
 const previous=await inspect(pidA);assert.equal(previous.jobs.find(j=>j.id===prior.pendingJobId)?.state,'failed');assert.equal(previous.heldEngines.length,0);stage('previous-job-authoritatively-terminal',previous);
 const pending=await api(pidA,'enqueue',{file:'pending.wav'});report.pendingJobId=pending.id;
 const current=await waitFor(async()=>{const i=await inspect(pidA);return i.jobs.find(j=>j.id===pending.id)?.state==='transcribing'&&i.heldEngines.length?i:false;});stage('new-ownership-job-running',current);
 await api(pidA,'open-panel');panelA=await findWebview("document.querySelector('#root')?.dataset.editorType==='transcribe-panel'&&document.body.innerText.includes('pending.wav')");await panelA.evaluate("window.__auditSpeechPanel='A'");stage('a-running-visible',{targetId:panelA.targetId,text:await panelA.evaluate('document.body.innerText')});
 const beforeTargets=await targets();const args=[...session.args];args[args.length-1]=path.join(session.runDir,'second.code-workspace');
 assert.ok(processList().find(p=>p.pid===session.pid)?.command.includes(session.profile));
 const env={...process.env,RITEMARK_AUDIT_NORMAL_RUN_DIR:session.runDir};for(const k of ['ELECTRON_RUN_AS_NODE','VSCODE_ESM_ENTRYPOINT','VSCODE_CRASH_REPORTER_PROCESS_TYPE','VSCODE_HANDLES_UNCAUGHT_ERRORS','VSCODE_NLS_CONFIG','VSCODE_IPC_HOOK','VSCODE_PID','VSCODE_CWD','VSCODE_L10N_BUNDLE_LOCATION'])delete env[k];
 const fd=fs.openSync(path.join(session.runDir,'speech-app.log'),'a');const child=spawn(args[0],args.slice(1),{env,stdio:['ignore',fd,fd],detached:true});fs.closeSync(fd);child.unref();stage('second-window-requested',{mainPid:session.pid,cliPid:child.pid,args});
 const hosts=await waitFor(async()=>{const h=await driver('/snapshots');return h.length===2&&h.every(x=>x.ritemark?.active)?h:false;},25000);
 const second=hosts.find(h=>h.hostPid!==pidA),pidB=second.hostPid;report.pidB=pidB;
 assert.equal(first.globalStorageRoot,second.globalStorageRoot);assert.deepEqual(first.workspaceFolders,second.workspaceFolders);assert.notEqual(first.workspaceFile,second.workspaceFile);
 const aStill=await inspect(pidA),b=await inspect(pidB);assert.equal(aStill.baseDir,b.baseDir);assert.equal(aStill.jobs.find(j=>j.id===pending.id)?.state,'transcribing');assert.ok(aStill.heldEngines.some(h=>h.sourcePath.endsWith('/pending.wav')));assert.equal(b.jobs.find(j=>j.id===pending.id)?.state,'interrupted');assert.equal(b.inflight.length,0);stage('b-recovered-live-a-job',{hosts,a:aStill,b});
 await api(pidB,'open-panel');panelB=await findWebview("window.__auditSpeechPanel!=='A'&&document.querySelector('#root')?.dataset.editorType==='transcribe-panel'&&document.body.innerText.includes('pending.wav')");await panelB.evaluate("window.__auditSpeechPanel='B'");
 stage('both-panels-disagree',{a:{targetId:panelA.targetId,text:await panelA.evaluate('document.body.innerText')},b:{targetId:panelB.targetId,text:await panelB.evaluate('document.body.innerText')}});
 const newWorkbench=(await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')&&!beforeTargets.some(old=>old.id===t.id));if(newWorkbench){c=await connectCdp(newWorkbench.webSocketDebuggerUrl);const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'normal-speech-false-interrupted.png'),Buffer.from(shot.data,'base64'));c.close();c=null;}
 await api(pidA,'release-engine',{file:'pending.wav'});
 const finished=await waitFor(async()=>{const i=await inspect(pidA);return i.jobs.find(j=>j.id===pending.id)?.state==='done'&&!i.heldEngines.length?i:false;});
 const persisted=await api(pidB,'read',{file:'pending.wav'});assert.match(persisted.segments[0].text,/AUDIT SYNTHETIC TRANSCRIPT pending.wav/);stage('a-completes-after-b-called-it-interrupted',{a:finished,b:await inspect(pidB),savedViaB:persisted,aUi:await panelA.evaluate('document.body.innerText'),bUi:await panelB.evaluate('document.body.innerText')});
 report.completed=true;
}catch(e){report.error=String(e.stack??e);throw e;}finally{report.finishedAt=Date.now();save();controlView?.close();panelA?.close();panelB?.close();c?.close();}
