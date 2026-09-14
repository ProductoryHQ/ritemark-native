import {targets,connectCdp,writeEvidence} from './normal-performance-tools.mjs';
const results=[];
for(const t of(await targets()).filter(t=>t.type==='iframe')){
 const c=await connectCdp(t.webSocketDebuggerUrl),contexts=[];c.on('Runtime.executionContextCreated',p=>contexts.push(p.context));
 try{await c.send('Runtime.enable');for(const ctx of contexts){const r=await c.send('Runtime.evaluate',{contextId:ctx.id,returnByValue:true,expression:`({ready:document.readyState,body:document.body?.innerText?.slice(0,1500),root:document.querySelector('#root')?.dataset,editables:[...document.querySelectorAll('[contenteditable]')].map(e=>({tag:e.tagName,classes:e.className,value:e.getAttribute('contenteditable')})),resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('webview.js')).map(r=>({name:r.name,duration:r.duration})),observer:globalThis.__auditPerf??null})`});results.push({target:t.id,context:ctx,value:r.result?.value,error:r.exceptionDetails});}}
 finally{c.close();}
}
writeEvidence('normal-performance-diagnostic-probe.json',results);console.log(JSON.stringify(results));
