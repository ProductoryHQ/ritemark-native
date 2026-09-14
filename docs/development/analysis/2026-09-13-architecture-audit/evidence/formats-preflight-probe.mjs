import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {session,driver,waitFor,findWebview,targets,connectCdp,processList,writeEvidence,evidence} from './formats-tools.mjs';
const report={method:'Verify actual normal-mode audit extension and open the synthetic draw.io SVG through its real custom editor.',pid:session.pid,expectedExtensionPath:session.extensionPath};
let view,main;
try{
 report.host=await waitFor(async()=>{const hosts=await driver('/snapshots');return hosts.length===1&&hosts[0].ritemark?.active?hosts[0]:null;},30000);
 assert.equal(report.host.driverMode,1);assert.equal(report.host.ritemark.path,session.extensionPath);
 assert.ok(!session.args.some(a=>a.includes('extensionDevelopmentPath')));
 report.openRequestedAt=Date.now();await driver('/open',{file:'diagram.drawio.svg'});
 view=await findWebview('!!window.__rmBridge && window.__rmBridge.events.includes("drawio:load")',25000);
 report.drawioReadyAt=Date.now();
 report.view={targetId:view.targetId,contextId:view.contextId,...await view.evaluate(`(()=>({text:document.body.innerText,bridge:window.__rmBridge,editable:[...document.querySelectorAll('[contenteditable]')].map(e=>({tag:e.tagName,role:e.getAttribute('role'),classes:e.className})),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/drawio/')).map(e=>({name:e.name,decodedBodySize:e.decodedBodySize,duration:e.duration}))}))()`)};
 assert.ok(report.view.text.includes('AUDIT BASE'));
 report.hostAfter=await driver();
 const t=(await targets()).find(t=>t.type==='page'&&t.url.includes('workbench'));main=await connectCdp(t.webSocketDebuggerUrl);
 fs.writeFileSync(path.join(evidence,'formats-drawio-base.png'),Buffer.from((await main.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 const all=processList(),own=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of all)if(own.has(p.ppid)&&!own.has(p.pid)){own.add(p.pid);changed=true;}}
 report.processes=all.filter(p=>own.has(p.pid));report.completed=true;
 console.log(JSON.stringify({completed:true,hostPid:report.host.hostPid,view:{targetId:view.targetId,contextId:view.contextId,text:report.view.text.slice(0,2300)},processes:report.processes.length}));
}catch(e){report.error=String(e.stack??e);throw e;}finally{writeEvidence('formats-preflight-probe.json',report);view?.close();main?.close();}
