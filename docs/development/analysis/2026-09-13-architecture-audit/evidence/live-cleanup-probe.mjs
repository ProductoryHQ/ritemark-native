import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,writeEvidence,evidence} from './live-tools.mjs';
const report={method:'Stop only the PID/profile created for the synthetic audit run. Capture its actual descendants before close and verify termination. Preserve synthetic driver events. Other Ritemark app instances are not targeted.',at:Date.now(),pid:session.pid,profile:session.profile,host:await driver()};
const list=()=>execFileSync('/bin/ps',['-axo','pid=,ppid=,command='],{encoding:'utf8'}).trim().split('\n').map(l=>{const m=l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);return m?{pid:+m[1],ppid:+m[2],command:m[3]}:null;}).filter(Boolean);
const before=list(),main=before.find(p=>p.pid===session.pid);assert.ok(main?.command.includes(session.profile));
const ids=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of before)if(ids.has(p.ppid)&&!ids.has(p.pid)){ids.add(p.pid);changed=true;}}
report.before=before.filter(p=>ids.has(p.pid));writeEvidence('live-cleanup-probe.json',report);
const c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
try{await c.send('Browser.close');report.closeResponse='accepted';}catch(e){report.closeResponse=String(e);}finally{c.close();}
const start=Date.now();let remaining;
do{const now=list();remaining=report.before.filter(old=>now.some(p=>p.pid===old.pid&&p.command===old.command));if(!remaining.length)break;await new Promise(r=>setTimeout(r,200));}while(Date.now()-start<6000);
report.remaining=remaining;
if(remaining.length){report.completed=false;writeEvidence('live-cleanup-probe.json',report);throw new Error('Known audit processes remain; inspect before further action');}
try{await targets();report.cdpPortClosed=false;}catch{report.cdpPortClosed=true;}
fs.copyFileSync(path.join(session.runDir,'driver-events.jsonl'),path.join(evidence,'live-driver-events.jsonl'));
report.completed=true;writeEvidence('live-cleanup-probe.json',report);console.log(JSON.stringify({completed:true,verifiedStoppedPids:report.before.map(p=>p.pid),cdpPortClosed:report.cdpPortClosed}));
