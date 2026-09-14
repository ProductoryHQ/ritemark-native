import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {connectCdp,layoutExpression} from './cdp-client.mjs';
export {connectCdp,layoutExpression};
export const evidence=path.dirname(fileURLToPath(import.meta.url));
export const session=JSON.parse(fs.readFileSync(path.join(evidence,'normal-speech-session.json'),'utf8'));
export const writeEvidence=(name,value)=>fs.writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2)+'\n');
export async function targets(){return (await fetch('http://127.0.0.1:9242/json/list',{signal:AbortSignal.timeout(1500)})).json();}
export function processList(){return execFileSync('/bin/ps',['-axo','pid=,ppid=,rss=,command='],{encoding:'utf8'}).trim().split('\n').map(l=>{const m=l.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],ppid:+m[2],rssKiB:+m[3],command:m[4]}:null;}).filter(Boolean);}
export async function driver(route='/snapshot',body,hostPid){
 const endpoints=fs.readdirSync(path.join(session.runDir,'endpoints')).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(fs.readFileSync(path.join(session.runDir,'endpoints',n),'utf8'))).filter(e=>!hostPid||e.hostPid===hostPid);
 const live=[];
 for(const e of endpoints){try{const r=await fetch(`http://127.0.0.1:${e.port}/snapshot`,{headers:{authorization:`Bearer ${e.token}`},signal:AbortSignal.timeout(1500)});if(r.ok)live.push({endpoint:e,snapshot:await r.json()});}catch{}}
 if(route==='/snapshots'&&body===undefined)return live.map(r=>r.snapshot);
 if(live.length!==1)throw new Error('Expected one live driver (specify hostPid for multiple windows), got '+live.length);
 if(route==='/snapshot'&&body===undefined)return live[0].snapshot;
 const e=live[0].endpoint;
 const r=await fetch(`http://127.0.0.1:${e.port}${route}`,{method:'POST',headers:{authorization:`Bearer ${e.token}`,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const out=await r.json();if(!r.ok)throw new Error(JSON.stringify(out));return out;
}
export async function waitFor(check,timeout=12000){const start=Date.now();let last;while(Date.now()-start<timeout){last=await check();if(last)return last;await new Promise(r=>setTimeout(r,100));}throw new Error('Condition not reached within '+timeout+' ms; last '+JSON.stringify(last));}
export async function findWebview(predicate,timeout=15000){
 const start=Date.now();while(Date.now()-start<timeout){
  for(const t of(await targets()).filter(t=>t.type==='iframe')){
   const c=await connectCdp(t.webSocketDebuggerUrl),contexts=[];c.on('Runtime.executionContextCreated',p=>contexts.push(p.context));await c.send('Runtime.enable');
   for(const context of contexts){try{const r=await c.send('Runtime.evaluate',{contextId:context.id,expression:predicate,returnByValue:true});if(r.result?.value)return {targetId:t.id,contextId:context.id,cdp:c,async evaluate(expression){const r=await c.send('Runtime.evaluate',{contextId:context.id,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;},close(){c.close();}};}catch{}}
   c.close();
  }
  await new Promise(r=>setTimeout(r,100));
 }
 throw new Error('Matching normal-mode webview not found: '+predicate);
}
export async function launch(){
 if(!session.runDir.startsWith('/private/tmp/ritemark-audit-normal-'))throw new Error('Wrong run directory');
 if(session.pid&&processList().some(p=>p.pid===session.pid))throw new Error('Previous app PID still exists; do not restart');
 try{await targets();throw new Error('Audit CDP port occupied');}catch(e){if(e.message==='Audit CDP port occupied')throw e;}
 const shared='/Users/jarmotuisk/.ritemark/extensions';
 if(fs.existsSync(shared)&&fs.readdirSync(shared,{withFileTypes:true}).some(e=>e.isDirectory()&&e.name.startsWith('ritemark-')))throw new Error('Shared update cleanup could affect installed versions');
 if(!fs.existsSync('/Users/jarmotuisk/.ritemark/starter-pack-seeded')&&(!fs.existsSync('/Users/jarmotuisk/.claude/skills')||!fs.readdirSync('/Users/jarmotuisk/.claude/skills').length))throw new Error('Starter seeding would affect user library');
 const env={...process.env,RITEMARK_AUDIT_NORMAL_RUN_DIR:session.runDir};
 for(const k of ['ELECTRON_RUN_AS_NODE','VSCODE_ESM_ENTRYPOINT','VSCODE_CRASH_REPORTER_PROCESS_TYPE','VSCODE_HANDLES_UNCAUGHT_ERRORS','VSCODE_NLS_CONFIG','VSCODE_IPC_HOOK','VSCODE_PID','VSCODE_CWD','VSCODE_L10N_BUNDLE_LOCATION','RITEMARK_AUDIT_RUN_DIR'])delete env[k];
 const fd=fs.openSync(path.join(session.runDir,'speech-app.log'),'a'),at=Date.now();
 const child=spawn(session.args[0],session.args.slice(1),{env,stdio:['ignore',fd,fd],detached:true});fs.closeSync(fd);child.unref();
 (session.launches??=[]).push({pid:child.pid,at});Object.assign(session,{pid:child.pid,launchedAt:at,preparedOnly:false});writeEvidence('normal-speech-session.json',session);
 return {pid:session.pid,launchedAt:at,runDir:session.runDir};
}
