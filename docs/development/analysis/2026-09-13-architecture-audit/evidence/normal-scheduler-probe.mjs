import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {session,driver,writeEvidence} from './normal-tools.mjs';
const id='audit-normal-schedule-'+Date.now(),now=new Date();
const folder=path.join(session.workspace,'.ritemark','flows'),file=path.join(folder,id+'.flow.json');
const outputFolder='audit-schedule-results-'+id,output=path.join(session.workspace,outputFolder);
const settingsFile=path.join(session.profile,'User','settings.json'),setting='ritemark.features.scheduled-flow-runs';
const originalSettings=JSON.parse(fs.readFileSync(settingsFile,'utf8'));
const flow={id,name:'Audit duplicate schedule',description:'Synthetic audit fixture: trigger to local Save File only; no agent, external service or user files.',version:1,created:now.toISOString(),modified:now.toISOString(),inputs:[],schedule:{enabled:true,type:'daily',time:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')},nodes:[{id:'trigger',type:'trigger',position:{x:0,y:0},data:{label:'Synthetic trigger',inputs:[]}},{id:'save',type:'save-file',position:{x:200,y:0},data:{label:'Audit local output',sourceNodeId:'trigger',format:'markdown',folder:outputFolder,filename:'audit-run-{{timestamp}}'}}],edges:[{id:'trigger-save',source:'trigger',target:'save'}]};
const report={method:'Actual FlowSchedulers in the two normal-mode extension hosts. A new daily schedule for the current local minute is within the ordinary five-minute grace window. Existing experimental flag enabled only in the synthetic profile for the probe, then restored. The only side effect is SaveFile of the trigger object to unique local timestamp files. Read actual VS Code workspaceState SQLite records read-only; no mocked scheduler clock, storage or executor.',flowPath:file,flow,steps:[]};
const record=(stage,data)=>{report.steps.push({stage,at:Date.now(),...data});writeEvidence('normal-scheduler-probe.json',report);};
const outputs=()=>fs.existsSync(output)?fs.readdirSync(output).map(n=>({name:n,content:fs.readFileSync(path.join(output,n),'utf8'),mtimeMs:fs.statSync(path.join(output,n)).mtimeMs})):[];
const states=()=>JSON.parse(execFileSync('/usr/bin/python3',['-c',`import json,sqlite3,sys
from pathlib import Path
root=Path(sys.argv[1])/'User/workspaceStorage';state_key='flowScheduleState:'+sys.argv[2];out=[]
for db in root.glob('*/state.vscdb'):
 try:
  con=sqlite3.connect(db.as_uri()+'?mode=ro',uri=True)
  rows=con.execute('SELECT key,value FROM ItemTable WHERE value LIKE ?',('%'+state_key+'%',)).fetchall()
  for key,value in rows:
   try:
    value=json.loads(value)
    if isinstance(value,dict) and state_key in value:out.append({'workspaceStorage':str(db.parent),'recordKey':key,'state':value[state_key]})
   except (ValueError,TypeError):pass
  con.close()
 except sqlite3.Error:pass
print(json.dumps(out))`,session.profile,file],{encoding:'utf8'}));
try{
 const hosts=await driver('/snapshots');assert.equal(hosts.length,2);assert.ok(hosts.every(h=>h.driverMode===1&&h.ritemark.path===session.extensionPath));
 fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(file,JSON.stringify(flow,null,2)+'\n');
 fs.writeFileSync(settingsFile,JSON.stringify({...originalSettings,[setting]:true},null,2)+'\n');
 record('enabled',{hosts,previousSetting:originalSettings[setting]});
 const start=Date.now();let found=[],runtime=[];
 while(Date.now()-start<45000){found=outputs();runtime=states();if(found.length>=2&&runtime.length===2&&runtime.every(r=>r.state.lastStatus==='success'))break;await new Promise(r=>setTimeout(r,500));}
 record('observed',{waitedMs:Date.now()-start,outputs:found,runtimeStates:runtime,hosts:await driver('/snapshots')});
 report.outputCount=found.length;report.stateCount=runtime.length;
 report.sameSlotInBothWindows=runtime.length===2&&runtime[0].state.lastScheduledFor===runtime[1].state.lastScheduledFor;
 report.bothSucceeded=runtime.length===2&&runtime.every(r=>r.state.lastStatus==='success');
 report.completed=true;
 console.log(JSON.stringify({completed:true,outputCount:report.outputCount,sameSlotInBothWindows:report.sameSlotInBothWindows,bothSucceeded:report.bothSucceeded}));
}catch(e){record('error',{error:String(e.stack??e)});throw e;}
finally{
 flow.schedule.enabled=false;if(fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(flow,null,2)+'\n');
 const current=JSON.parse(fs.readFileSync(settingsFile,'utf8'));if(Object.hasOwn(originalSettings,setting))current[setting]=originalSettings[setting];else delete current[setting];fs.writeFileSync(settingsFile,JSON.stringify(current,null,2)+'\n');
 report.fixtureScheduleDisabled=true;report.settingRestored=current[setting]===originalSettings[setting];writeEvidence('normal-scheduler-probe.json',report);
}
