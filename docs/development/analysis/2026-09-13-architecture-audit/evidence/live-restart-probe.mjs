import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {driver,findWebview,waitFor,session,writeEvidence,targets,connectCdp,layoutExpression,evidence} from './live-tools.mjs';
const report={method:'Recovery probe in the synthetic profile: append a unique unsaved marker, request CDP Browser.close, require the exact own app PID to terminate, then launch the same profile/extension and inspect recovered VS Code and webview state. This shutdown trigger is distinct from OS crash, power loss and the native menu Quit path.',steps:[],samples:[]};
const record=(stage,data)=>{report.steps.push({stage,at:Date.now(),...data});writeEvidence('live-restart-probe.json',report);};
const pidExists=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}};
const file=path.join(session.workspace,'note.md'),marker=' RECOVERY '+Date.now();
let v,c;
try{
 const command=execFileSync('/bin/ps',['-p',String(session.pid),'-o','command='],{encoding:'utf8'});assert.ok(command.includes(session.profile));
 await driver('/open',{file:'note.md'});
 v=await findWebview("document.querySelector('.ProseMirror')?.innerText.includes('EXTERNAL_CONFLICT paragraph')");
 await v.evaluate("(()=>{const e=document.querySelector('.ProseMirror');e.focus();const r=document.createRange();r.selectNodeContents(e);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);})()");
 await v.cdp.send('Input.insertText',{text:marker});
 await waitFor(async()=>(await driver()).documents.find(d=>d.file==='note.md')?.text.includes(marker));
 assert.ok(!fs.readFileSync(file,'utf8').includes(marker));
 record('unsaved-before-close',{host:await driver(),disk:fs.readFileSync(file,'utf8'),marker,pid:session.pid});
 await new Promise(r=>setTimeout(r,1500));
 v.close();v=undefined;
 c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 try{await c.send('Browser.close');record('close-request',{accepted:true});}catch(e){record('close-request',{responseError:String(e)});}
 c.close();c=undefined;
 await waitFor(()=>!pidExists(session.pid),10000);
 record('old-pid-terminated',{pid:session.pid,exists:pidExists(session.pid)});
 try{await targets();throw new Error('CDP still occupied after old PID exit');}catch(e){if(e.message==='CDP still occupied after old PID exit')throw e;}
 const shared='/Users/jarmotuisk/.ritemark/extensions';
 const candidates=fs.existsSync(shared)?fs.readdirSync(shared,{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name.startsWith('ritemark-')):[];
 assert.equal(candidates.length,0);
 fs.copyFileSync(path.join(evidence,'live-session.json'),path.join(evidence,'live-session-first-launch.json'));
 const env={...process.env,RITEMARK_AUDIT_RUN_DIR:session.runDir};
 for(const k of ['ELECTRON_RUN_AS_NODE','VSCODE_ESM_ENTRYPOINT','VSCODE_CRASH_REPORTER_PROCESS_TYPE','VSCODE_HANDLES_UNCAUGHT_ERRORS','VSCODE_NLS_CONFIG','VSCODE_IPC_HOOK','VSCODE_PID','VSCODE_CWD','VSCODE_L10N_BUNDLE_LOCATION'])delete env[k];
 const fd=fs.openSync(path.join(session.runDir,'app.log'),'a'),start=Date.now();
 const child=spawn(session.args[0],session.args.slice(1),{env,stdio:['ignore',fd,fd],detached:true});fs.closeSync(fd);child.unref();
 const previousPid=session.pid;Object.assign(session,{pid:child.pid,previousPid,launchedAt:start});writeEvidence('live-session.json',session);
 record('restarted',{pid:session.pid,previousPid,start});
 while(Date.now()-start<25000){
  if(!c){try{const t=(await targets()).find(t=>t.type==='page'&&t.url.includes('workbench'));if(t)c=await connectCdp(t.webSocketDebuggerUrl);}catch{}}
  if(c){try{const state=(await c.send('Runtime.evaluate',{expression:layoutExpression,returnByValue:true})).result.value;if(state&&JSON.stringify(report.samples.at(-1)?.state)!==JSON.stringify(state))report.samples.push({sinceLaunchMs:Date.now()-start,state});}catch(e){c.close();c=undefined;}}
  await new Promise(r=>setTimeout(r,100));
 }
 const restored=await driver();
 record('restored-host',{host:restored,disk:fs.readFileSync(file,'utf8')});
 const doc=restored.documents.find(d=>d.file==='note.md');report.unsavedHostRecovered=!!doc?.dirty&&doc.text.includes(marker);report.diskUnchanged=!fs.readFileSync(file,'utf8').includes(marker);
 if(report.unsavedHostRecovered){await driver('/open',{file:'note.md'});v=await findWebview('document.querySelector(".ProseMirror")?.innerText.includes('+JSON.stringify(marker.trim())+')');report.unsavedViewRecovered=true;record('restored-view',{visible:await v.evaluate("document.querySelector('.ProseMirror').innerText")});}
 report.completed=true;writeEvidence('live-restart-probe.json',report);console.log(JSON.stringify({completed:true,pid:session.pid,unsavedHostRecovered:report.unsavedHostRecovered,unsavedViewRecovered:report.unsavedViewRecovered??false,diskUnchanged:report.diskUnchanged}));
}catch(e){record('error',{error:String(e.stack??e)});throw e;}finally{v?.close();c?.close();}
