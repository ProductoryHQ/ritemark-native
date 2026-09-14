import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {session,driver,targets,connectCdp,processList,writeEvidence,evidence} from './normal-browser-tools.mjs';
const file='normal-browser-cleanup-probe.json';
const report={method:'Close only the exact isolated browser-audit profile via CDP, verify all captured owned processes and port, preserve this host log and restore original observer. No user-profile process is targeted.',at:Date.now(),pid:session.pid,hosts:await driver('/snapshots'),inspection:await driver('/browser-audit',{operation:'inspect'})};
assert.equal(report.inspection.runtimeSessionCount,0);assert.equal(report.inspection.acpManagerStarted,false);assert.ok(report.inspection.jobs.every(j=>j.status!=='running'));
const all=processList();assert.ok(all.find(p=>p.pid===session.pid)?.command.includes(session.profile));
const owned=new Set([session.pid]);let added=true;while(added){added=false;for(const p of all)if(owned.has(p.ppid)&&!owned.has(p.pid)){owned.add(p.pid);added=true;}}
report.before=all.filter(p=>owned.has(p.pid));writeEvidence(file,report);
const c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
try{await c.send('Browser.close');report.closeResponse='accepted';}catch(e){report.closeResponse=String(e);}finally{c.close();}
const start=Date.now();let remaining;do{const now=processList();remaining=report.before.filter(old=>now.some(p=>p.pid===old.pid&&p.command===old.command));if(!remaining.length)break;await new Promise(r=>setTimeout(r,200));}while(Date.now()-start<8000);
report.remaining=remaining;writeEvidence(file,report);assert.equal(remaining.length,0,'Captured audit process remains');
try{await targets();report.cdpPortClosed=false;}catch{report.cdpPortClosed=true;}assert.ok(report.cdpPortClosed);
report.eventFiles=[];for(const h of report.hosts){const name='normal-browser-driver-events-'+h.hostPid+'.jsonl';fs.copyFileSync(path.join(session.runDir,'events',h.hostPid+'.jsonl'),path.join(evidence,name));report.eventFiles.push(name);}
const original=path.join(evidence,'normal-driver/index.cjs'),dest=path.join(session.driverPath,'index.cjs');fs.copyFileSync(original,dest);fs.unlinkSync(path.join(session.driverPath,'browser-audit-api.cjs'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert.equal(hash(original),hash(dest));
report.observerRestored={path:dest,sha256:hash(dest),temporaryHelperRemoved:!fs.existsSync(path.join(session.driverPath,'browser-audit-api.cjs'))};
report.productHashes=Object.fromEntries(Object.entries(session.files).map(([rel,expected])=>{const actual=hash(path.join(session.extensionPath,rel));assert.equal(actual,expected.sha256);return [rel,actual];}));
report.completed=true;writeEvidence(file,report);console.log(JSON.stringify({completed:true,file,stoppedProcesses:report.before.length,cdpPortClosed:report.cdpPortClosed,observerRestored:true}));
