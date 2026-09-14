// Launch this audit's disposable profile; collect functional startup evidence.
// This is not a low-end Windows performance benchmark.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {connectCdp,targets,layoutExpression} from './cdp-client.mjs';

const evidence=path.dirname(fileURLToPath(import.meta.url));
const sessionFile=path.join(evidence,'live-session.json');
const config=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
if(!config.preparedOnly)throw new Error('Session already launched; inspect its state instead of restarting');
if(!config.runDir.startsWith('/private/tmp/ritemark-audit-live-'))throw new Error('Wrong run directory');
// The source updater uses a fixed home directory even with --user-data-dir.
const sharedExtensions='/Users/jarmotuisk/.ritemark/extensions';
const removable=fs.existsSync(sharedExtensions)?fs.readdirSync(sharedExtensions,{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name.startsWith('ritemark-')).map(e=>e.name):[];
if(removable.length)throw new Error('Shared installed versions now exist; isolate cleanup before launching');
try {await targets();throw new Error('CDP port already occupied');}catch(error){if(error.message==='CDP port already occupied')throw error;}

const env={...process.env,RITEMARK_AUDIT_RUN_DIR:config.runDir};
for(const key of ['ELECTRON_RUN_AS_NODE','VSCODE_ESM_ENTRYPOINT','VSCODE_CRASH_REPORTER_PROCESS_TYPE','VSCODE_HANDLES_UNCAUGHT_ERRORS','VSCODE_NLS_CONFIG','VSCODE_IPC_HOOK','VSCODE_PID','VSCODE_CWD','VSCODE_L10N_BUNDLE_LOCATION'])delete env[key];
const logFd=fs.openSync(path.join(config.runDir,'app.log'),'a');
const start=Date.now();
const child=spawn(config.args[0],config.args.slice(1),{env,stdio:['ignore',logFd,logFd],detached:true});
fs.closeSync(logFd);child.unref();
Object.assign(config,{preparedOnly:false,pid:child.pid,launchedAt:start,sharedExtensionRemovalCandidatesAtLaunch:removable});
fs.writeFileSync(sessionFile,JSON.stringify(config,null,2)+'\n');
const samples=[];let cdp;let workbench;
child.once('exit',(code,signal)=>fs.writeFileSync(path.join(config.runDir,'app-exit.json'),JSON.stringify({at:Date.now(),code,signal})));
try {
  while(Date.now()-start<25000){
    if(!cdp){
      try {
        const list=await targets();
        workbench=list.find(t=>t.type==='page'&&t.url.includes('workbench'));
        if(workbench){cdp=await connectCdp(workbench.webSocketDebuggerUrl);await cdp.send('Runtime.enable');}
      }catch{}
    }
    if(cdp){
      try {
        const result=await cdp.send('Runtime.evaluate',{expression:layoutExpression,returnByValue:true});
        const state=result.result?.value;
        if(state&&JSON.stringify(samples.at(-1)?.state)!==JSON.stringify(state))samples.push({at:Date.now(),sinceLaunchMs:Date.now()-start,state});
      }catch(error){samples.push({sinceLaunchMs:Date.now()-start,error:String(error)});cdp.close();cdp=undefined;}
    }
    await new Promise(r=>setTimeout(r,100));
  }
  const endpoint=path.join(config.runDir,'driver-endpoint.json');
  let driver=null;
  if(fs.existsSync(endpoint)){
    const d=JSON.parse(fs.readFileSync(endpoint,'utf8'));
    driver=await fetch(`http://127.0.0.1:${d.port}/snapshot`,{headers:{authorization:`Bearer ${d.token}`}}).then(r=>r.json());
  }
  const ps=execFileSync('/bin/ps',['-axo','pid=,ppid=,rss=,comm='],{encoding:'utf8'}).trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],ppid:+m[2],rssKiB:+m[3],command:m[4]}:null;}).filter(Boolean);
  const ids=new Set([child.pid]);let changed=true;
  while(changed){changed=false;for(const p of ps)if(ids.has(p.ppid)&&!ids.has(p.pid)){ids.add(p.pid);changed=true;}}
  const report={method:'Functional macOS startup with isolated profile, synthetic workspace, actual audit extension and observational driver; DOM sampled about every 100 ms. Launch wall clock includes automation and driver overhead. RSS is per-process resident set, not unique physical memory or Windows baseline.',runDir:config.runDir,appPid:child.pid,workbench:workbench?{id:workbench.id,url:workbench.url}:null,samples,driver,processes:ps.filter(p=>ids.has(p.pid))};
  fs.writeFileSync(path.join(evidence,'live-startup.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({appPid:child.pid,runDir:config.runDir,states:samples.length,driverLoaded:!!driver,ritemark:driver?.ritemark,processes:report.processes.length},null,2));
} finally {cdp?.close();}
