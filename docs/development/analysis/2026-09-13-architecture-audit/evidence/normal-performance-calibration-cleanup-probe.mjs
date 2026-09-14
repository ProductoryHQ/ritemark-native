import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,processList,writeEvidence,evidence} from './normal-performance-tools.mjs';
const file='normal-performance-calibration-cleanup-probe.json';
const report={method:'Close only recorded isolated performance profile through CDP; verify captured process tree, port, unchanged fixture and product artifacts.',at:Date.now(),pid:session.pid,hosts:await driver('/snapshots')};
assert.equal(report.hosts.length,1);assert.ok(report.hosts[0].documents.every(d=>!d.dirty));
const all=processList();assert.ok(all.find(p=>p.pid===session.pid)?.command.includes(session.profile));
const owned=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of all)if(owned.has(p.ppid)&&!owned.has(p.pid)){owned.add(p.pid);changed=true;}}
report.before=all.filter(p=>owned.has(p.pid));writeEvidence(file,report);
const c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
try{await c.send('Browser.close');report.closeResponse='accepted';}catch(e){report.closeResponse=String(e);}finally{c.close();}
const start=Date.now();let remaining;do{const now=processList();remaining=report.before.filter(old=>now.some(p=>p.pid===old.pid&&p.command===old.command));if(!remaining.length)break;await new Promise(r=>setTimeout(r,200));}while(Date.now()-start<8000);
report.remaining=remaining;writeEvidence(file,report);assert.equal(remaining.length,0);
try{await targets();report.cdpPortClosed=false;}catch{report.cdpPortClosed=true;}assert.ok(report.cdpPortClosed);
report.eventFiles=[];for(const h of report.hosts){const name='normal-performance-driver-events-'+h.hostPid+'.jsonl';fs.copyFileSync(path.join(session.runDir,'events',h.hostPid+'.jsonl'),path.join(evidence,name));report.eventFiles.push(name);}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
report.productHashes=Object.fromEntries(Object.entries(session.files).map(([rel,expected])=>{const actual=hash(path.join(session.extensionPath,rel));assert.equal(actual,expected.sha256);return [rel,actual];}));
report.fixtureHash=hash(path.join(session.workspace,session.fixture.name));assert.equal(report.fixtureHash,session.fixture.sha256);
report.observerHash=hash(path.join(session.driverPath,'index.cjs'));assert.equal(report.observerHash,hash(path.join(evidence,'normal-driver/index.cjs')));
report.completed=true;writeEvidence(file,report);console.log(JSON.stringify({completed:true,file,pid:report.pid,stoppedProcesses:report.before.length,cdpPortClosed:report.cdpPortClosed}));
