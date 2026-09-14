import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectCdp,targets} from './cdp-client.mjs';
export {connectCdp,targets,layoutExpression} from './cdp-client.mjs';
export const evidence=path.dirname(fileURLToPath(import.meta.url));
export const session=JSON.parse(fs.readFileSync(path.join(evidence,'live-session.json'),'utf8'));
export async function driver(route='/snapshot',body) {
  const endpoint=JSON.parse(fs.readFileSync(path.join(session.runDir,'driver-endpoint.json'),'utf8'));
  const response=await fetch(`http://127.0.0.1:${endpoint.port}${route}`,{
    method:body===undefined?'GET':'POST',headers:{authorization:`Bearer ${endpoint.token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000),
  });
  const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));return result;
}
export function writeEvidence(name,value) {
  fs.writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2)+'\n');
}
export async function findWebview(predicate,timeoutMs=12000) {
  const start=Date.now();
  while(Date.now()-start<timeoutMs){
    for(const t of (await targets()).filter(t=>t.type==='iframe')){
      const c=await connectCdp(t.webSocketDebuggerUrl);const contexts=[];
      c.on('Runtime.executionContextCreated',p=>contexts.push(p.context));
      await c.send('Runtime.enable');
      for(const context of contexts){
        try {
          const result=await c.send('Runtime.evaluate',{contextId:context.id,expression:predicate,returnByValue:true});
          if(result.result?.value)return {cdp:c,targetId:t.id,contextId:context.id,async evaluate(expression){const r=await c.send('Runtime.evaluate',{contextId:context.id,expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;},close(){c.close();}};
        }catch{}
      }
      c.close();
    }
    await new Promise(r=>setTimeout(r,150));
  }
  throw new Error('Matching webview not found: '+predicate);
}
export async function waitFor(check,timeoutMs=8000) {
  const start=Date.now();let result;
  while(Date.now()-start<timeoutMs){result=await check();if(result)return result;await new Promise(r=>setTimeout(r,100));}
  throw new Error('Condition not reached within '+timeoutMs+' ms; last value '+JSON.stringify(result));
}
