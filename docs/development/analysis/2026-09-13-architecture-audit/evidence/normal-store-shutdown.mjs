import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,processList,writeEvidence,evidence} from './normal-store-tools.mjs';
export async function stop(file){
 assert.ok(/^normal-store-[a-z-]+\.json$/.test(file));
 const report={method:'Close only the exact isolated store-audit app/profile via CDP, verify all captured owned processes and port have stopped, and preserve only this launch host logs. Restore the observer filesystem delegates before closing.',at:Date.now(),pid:session.pid,hosts:await driver('/snapshots')};
 await Promise.all(report.hosts.map(h=>driver('/store-audit',{operation:'reset-observer'},h.hostPid)));
 const all=processList();assert.ok(all.find(p=>p.pid===session.pid)?.command.includes(session.profile));
 const owned=new Set([session.pid]);let added=true;
 while(added){added=false;for(const p of all)if(owned.has(p.ppid)&&!owned.has(p.pid)){owned.add(p.pid);added=true;}}
 report.before=all.filter(p=>owned.has(p.pid));writeEvidence(file,report);
 const c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 try{await c.send('Browser.close');report.closeResponse='accepted';}catch(e){report.closeResponse=String(e);}finally{c.close();}
 const start=Date.now();let remaining;
 do{const now=processList();remaining=report.before.filter(old=>now.some(p=>p.pid===old.pid&&p.command===old.command));if(!remaining.length)break;await new Promise(r=>setTimeout(r,200));}while(Date.now()-start<8000);
 report.remaining=remaining;writeEvidence(file,report);
 if(remaining.length)throw new Error('Captured audit processes remain; inspect before restarting');
 try{await targets();report.cdpPortClosed=false;}catch{report.cdpPortClosed=true;}
 assert.ok(report.cdpPortClosed);
 report.eventFiles=[];
 for(const h of report.hosts){const name='normal-store-driver-events-'+h.hostPid+'.jsonl';fs.copyFileSync(path.join(session.runDir,'events',h.hostPid+'.jsonl'),path.join(evidence,name));report.eventFiles.push(name);}
 const store=path.join(session.profile,'User/globalStorage/ritemark.ritemark/conversations/v1');
 report.recordAfterStop=JSON.parse(fs.readFileSync(path.join(store,'records/00000000-0000-4000-8000-a00600000004.json'),'utf8'));
 report.completed=true;writeEvidence(file,report);
 console.log(JSON.stringify({completed:true,file,stoppedProcesses:report.before.length,cdpPortClosed:report.cdpPortClosed}));
}
