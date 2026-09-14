import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,processList,writeEvidence,evidence} from './formats-tools.mjs';
const report={method:'Verify the exact synthetic formats-mode app PID/profile and descendants, close via CDP and verify every captured process plus its command has disappeared. Preserve only synthetic driver events; endpoint bearer tokens are not copied.',at:Date.now(),pid:session.pid,hosts:await driver('/snapshots')};
const all=processList(),main=all.find(p=>p.pid===session.pid);assert.ok(main?.command.includes(session.profile));
const own=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of all)if(own.has(p.ppid)&&!own.has(p.pid)){own.add(p.pid);changed=true;}}
report.before=all.filter(p=>own.has(p.pid));writeEvidence('formats-cleanup-probe.json',report);
const c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
try{await c.send('Browser.close');report.closeResponse='accepted';}catch(e){report.closeResponse=String(e);}finally{c.close();}
const start=Date.now();let remaining;
do{const now=processList();remaining=report.before.filter(old=>now.some(p=>p.pid===old.pid&&p.command===old.command));if(!remaining.length)break;await new Promise(r=>setTimeout(r,200));}while(Date.now()-start<8000);
report.remaining=remaining;
if(remaining.length){writeEvidence('formats-cleanup-probe.json',report);throw new Error('Known audit processes remain; inspect before any further action');}
try{await targets();report.cdpPortClosed=false;}catch{report.cdpPortClosed=true;}
const eventFiles=fs.readdirSync(path.join(session.runDir,'events')).filter(n=>n.endsWith('.jsonl'));
for(const n of eventFiles)fs.copyFileSync(path.join(session.runDir,'events',n),path.join(evidence,'formats-driver-events-'+n));
report.eventFiles=eventFiles.map(n=>'formats-driver-events-'+n);report.completed=true;writeEvidence('formats-cleanup-probe.json',report);console.log(JSON.stringify({completed:true,stoppedProcesses:report.before.length,cdpPortClosed:report.cdpPortClosed,eventFiles:report.eventFiles}));
