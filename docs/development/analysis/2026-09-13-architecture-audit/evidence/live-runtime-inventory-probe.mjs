import fs from 'node:fs';
import path from 'node:path';
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {driver,session,writeEvidence,targets,connectCdp,evidence} from './live-tools.mjs';
const root=path.resolve(evidence,'../../../../..');
const report={method:'Late functional-session snapshot of own app descendants and actual webview resource entries. Version/help invocations use the manifest validationArgs and independently provisioned audit binaries. No model prompt or tool execution is sent. RSS is not unique physical memory; resource durations are not JS evaluation CPU.',at:Date.now(),host:await driver(),webviews:[],native:[]};
const raw=execFileSync('/bin/ps',['-axo','pid=,ppid=,rss=,command='],{encoding:'utf8'});
const processes=raw.trim().split('\n').map(line=>{const m=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],ppid:+m[2],rssKiB:+m[3],command:m[4]}:null;}).filter(Boolean);
const own=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of processes)if(own.has(p.ppid)&&!own.has(p.pid)){own.add(p.pid);changed=true;}}
const main=processes.find(p=>p.pid===session.pid);if(!main?.command.includes(session.profile))throw new Error('Own app PID/profile no longer match');
report.processes=processes.filter(p=>own.has(p.pid));
for(const t of(await targets()).filter(t=>t.type==='iframe')){
 const c=await connectCdp(t.webSocketDebuggerUrl),contexts=[];
 try{
  c.on('Runtime.executionContextCreated',p=>contexts.push(p.context));await c.send('Runtime.enable');
  for(const context of contexts){
   const r=await c.send('Runtime.evaluate',{contextId:context.id,expression:"(()=>{const scripts=[...document.scripts].map(e=>e.src).filter(Boolean);if(!scripts.some(s=>s.includes('webview.js')))return null;return {url:location.href,title:document.title,scripts,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,initiatorType:e.initiatorType,startTime:e.startTime,duration:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize})),dom:{elements:document.querySelectorAll('*').length,editor:!!document.querySelector('.ProseMirror'),cells:document.querySelectorAll('td').length,buttons:[...document.querySelectorAll('button')].slice(0,8).map(e=>e.title||e.getAttribute('aria-label')||e.textContent.trim())}}})()",returnByValue:true});
   if(r.result?.value)report.webviews.push({targetId:t.id,contextId:context.id,...r.result.value});
  }
 }finally{c.close();}
}
writeEvidence('live-runtime-inventory-probe.json',report);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extensions/ritemark/binaries/agents/manifest.json'),'utf8'));
const exec=promisify(execFile);
const results=await Promise.allSettled(manifest.runtimes.filter(r=>r.platform==='darwin'&&r.arch==='arm64').map(async r=>{
 const file=path.join(root,'extensions/ritemark/binaries/agents/darwin-arm64',r.installName);
 const start=Date.now();const out=await exec(file,r.validationArgs,{cwd:session.workspace,timeout:15000,maxBuffer:32768});
 const signed=await exec('/usr/bin/codesign',['--verify','--strict',file],{timeout:15000,maxBuffer:32768});
 return {name:r.installName,args:r.validationArgs,expectedVersion:r.version,exit:0,stdout:out.stdout,stderr:out.stderr,durationMs:Date.now()-start,signatureVerification:{exit:0,stdout:signed.stdout,stderr:signed.stderr}};
}));
report.native=results.map(r=>r.status==='fulfilled'?r.value:{error:String(r.reason?.stack??r.reason)});
report.completed=true;writeEvidence('live-runtime-inventory-probe.json',report);
console.log(JSON.stringify({completed:true,processes:report.processes.length,webviewContexts:report.webviews.length,native:report.native.map(n=>({name:n.name,exit:n.exit,stdout:n.stdout?.slice(0,250),error:n.error}))}));
