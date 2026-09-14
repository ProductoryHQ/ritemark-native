import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,layoutExpression,processList,writeEvidence} from './normal-tools.mjs';
const report={method:'Functional normal-mode startup, no extensionDevelopmentPath. Same audit code bytes independently staged into the synthetic profile extensions-dir. DOM state changes sampled about every 100 ms; not a cold-cache or Windows benchmark.',pid:session.pid,extensionExpected:session.extensionPath,samples:[]};
let c;
try{
 while(Date.now()-session.launchedAt<27000){
  if(!c){try{const t=(await targets()).find(t=>t.type==='page'&&t.url.includes('workbench'));if(t){c=await connectCdp(t.webSocketDebuggerUrl);report.workbench={id:t.id,url:t.url};}}catch{}}
  if(c){try{const state=(await c.send('Runtime.evaluate',{expression:layoutExpression,returnByValue:true})).result.value;if(state&&JSON.stringify(report.samples.at(-1)?.state)!==JSON.stringify(state)){report.samples.push({sinceLaunchMs:Date.now()-session.launchedAt,state});writeEvidence('normal-startup-probe.json',report);}}catch(e){c.close();c=undefined;}}
  await new Promise(r=>setTimeout(r,100));
 }
 report.hosts=await driver('/snapshots');
 assert.equal(report.hosts.length,1);
 assert.equal(report.hosts[0].driverMode,1);
 assert.equal(report.hosts[0].ritemark.path,session.extensionPath);
 assert.equal(report.hosts[0].ritemark.active,true);
 assert.ok(!session.args.some(a=>a.includes('extensionDevelopmentPath')));
 const all=processList(),own=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of all)if(own.has(p.ppid)&&!own.has(p.pid)){own.add(p.pid);changed=true;}}
 report.processes=all.filter(p=>own.has(p.pid));report.completed=true;writeEvidence('normal-startup-probe.json',report);console.log(JSON.stringify({completed:true,hosts:report.hosts,processes:report.processes.length}));
}catch(e){report.error=String(e.stack??e);writeEvidence('normal-startup-probe.json',report);throw e;}finally{c?.close();}
