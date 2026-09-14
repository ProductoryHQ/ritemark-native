import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import {driver,targets,connectCdp,findWebview,launch,evidence,writeEvidence} from './normal-speech-tools.mjs';
console.log('NORMAL_AUDIT_CLIENT_READY');
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of input){
 if(!line.trim())continue;let c;
 try{
  const q=JSON.parse(line);let result;
  if(q.action==='launch')result=await launch();
  else if(q.action==='driver')result=await driver(q.route,q.body,q.hostPid);
  else if(q.action==='targets')result=(await targets()).map(t=>({id:t.id,type:t.type,title:t.title,url:t.url}));
  else if(q.action==='find'){const v=await findWebview(q.predicate);result={targetId:v.targetId,contextId:v.contextId};v.close();}
  else if(['eval','cdp','screenshot'].includes(q.action)){
   const list=await targets(),t=q.targetId?list.find(t=>t.id===q.targetId):list.find(t=>t.type==='page'&&t.url.includes('workbench'));
   if(!t)throw new Error('Target no longer exists');c=await connectCdp(t.webSocketDebuggerUrl);
   if(q.action==='eval'){const r=await c.send('Runtime.evaluate',{expression:q.expression,contextId:q.contextId,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));result=r.result?.value;}
   else if(q.action==='cdp')result=await c.send(q.method,q.params??{});
   else{if(!/^normal-[a-z0-9-]+\.png$/.test(q.file))throw new Error('Invalid filename');const r=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,q.file),Buffer.from(r.data,'base64'));result={file:q.file};}
  }else if(q.action==='probe'){if(!/^normal-[a-z0-9-]+-probe\.mjs$/.test(q.file))throw new Error('Invalid probe filename');await import('./'+q.file+'?run='+Date.now());result={probe:q.file,finished:true};}
  else if(q.action==='exit'){input.close();break;}
  else throw new Error('Unknown action');
  if(q.evidence){if(!/^normal-[a-z0-9-]+\.json$/.test(q.evidence))throw new Error('Invalid evidence filename');writeEvidence(q.evidence,result);}
  console.log(JSON.stringify({id:q.id??null,ok:true,result}));
 }catch(e){console.log(JSON.stringify({ok:false,error:String(e.stack??e)}));}finally{c?.close();}
}
