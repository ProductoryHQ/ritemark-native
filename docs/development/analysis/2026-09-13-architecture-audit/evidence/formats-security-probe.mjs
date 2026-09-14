// Audit-only renderer-boundary experiment in an unchanged production webview.
// Synthetic host-shaped messages are delivered through MessageEvent via CDP.
// This is not a claim that untrusted content can forge the host bridge.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {session,driver,targets,connectCdp,findWebview,waitFor,processList,writeEvidence,evidence} from './formats-tools.mjs';

const output='formats-security-probe.json';
const report={at:Date.now(),method:'Actual production AI webview and CSP. CDP delivers synthetic conversation/get and approval messages through the existing MessageEvent listener. No model turn, native tool request or approval click. HTTPS audit.invalid images are intercepted and fulfilled with local PNG bytes before network; no external endpoint is contacted.',steps:[],interceptions:[],network:[]};
const record=(name,data)=>{report.steps.push({name,at:Date.now(),...data});writeEvidence(output,report);};
const host=await driver('/snapshot');
assert.equal(host.ritemark.path,session.extensionPath);
assert.equal(host.driverMode,1);
assert.ok(processList().find(p=>p.pid===session.pid)?.command.includes(session.profile));
report.host=host;
report.artifacts={};
for(const rel of ['out/extension.js','media/webview.js','package.json']){
 const bytes=fs.readFileSync(path.join(session.extensionPath,rel));
 const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha256,session.files[rel].sha256);
 report.artifacts[rel]={bytes:bytes.length,sha256};
}
const v=await findWebview('!!document.querySelector(\'textarea[aria-label="Message"]\')');
report.target={id:v.targetId,contextId:v.contextId};
const c=v.cdp;
let shell;
const pendingIntercepts=new Set();
const onePixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const conversationId='00000000-0000-4000-8000-00000000a008';
const userMarkup='<style id="audit-user-only-style">textarea { background-color: rgb(0,255,0) !important; }</style>';
const baselineContent='### Synthetic renderer audit\n\n**Rich Markdown control** with `inline code`.\n\n| Column | Value |\n| --- | --- |\n| Local | 42 |';
const payload='### Synthetic renderer audit\n\n<div id="audit-html-marker">AUDIT HTML STYLE PROBE</div>\n<style id="audit-style">button { outline: 4px solid rgb(235,0,200) !important; outline-offset: -4px !important; } textarea[aria-label="Message"] { background-color: rgb(255,235,160) !important; }</style>\n<img id="audit-https-image" src="https://audit.invalid/pixel.png?fixture=A08" onload="window.__auditInlineHandlerRan=true" alt="locally intercepted audit pixel">\n<img id="audit-broken-image" src="data:image/png;base64,broken" onerror="window.__auditInlineErrorRan=true" alt="deliberately invalid audit image">';
report.fixture={conversationId,userMarkup,baselineContent,payload,transport:'MessageEvent fixture at renderer listener; not real native-agent/host delivery'};
const projection=content=>({schemaVersion:1,conversationId,scopeId:'ps1-0000000000000000000000000000000000000000',scope:{kind:'single-root',workspaceFileUri:null,folderUris:['file://'+session.workspace]},title:'Synthetic renderer audit',identityColorSlot:0,createdAt:'2026-09-13T12:00:00.000Z',lastActivityAt:'2026-09-13T12:01:00.000Z',revision:4,bindingGeneration:0,lifecycle:{state:'working',activeTurnId:'audit-approval-turn'},runtimeSummary:['codex'],composerPreferences:{thinkingEffortByRuntime:{}},events:[
 {kind:'user-message',eventId:'audit-user',turnId:'audit-content-turn',sequence:0,occurredAt:'2026-09-13T12:00:00.000Z',runtimeId:'codex',text:'Escaped user-markup control: '+userMarkup,mode:'agent',attachments:[]},
 {kind:'assistant-message',eventId:'audit-assistant',turnId:'audit-content-turn',sequence:1,occurredAt:'2026-09-13T12:00:01.000Z',runtimeId:'codex',content,terminalStatus:'completed'},
 {kind:'user-message',eventId:'audit-approval-user',turnId:'audit-approval-turn',sequence:2,occurredAt:'2026-09-13T12:01:00.000Z',runtimeId:'codex',text:'Synthetic approval card. Nothing will be executed.',mode:'agent',attachments:[]},
]});
const send=message=>v.evaluate(`window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(message)}}))`);
async function project(content){
 await send({type:'conversation/result',requestId:'audit-renderer-fixture',operation:'conversation/get',ok:true,data:{conversation:projection(content)}});
 await send({type:'agent-approval-request',conversationId,requestId:'audit-display-only',agentId:'codex',kind:'shell-command',command:'AUDIT DISPLAY ONLY — no native request exists',workingDir:session.workspace});
}
const snapshotExpression=`(()=>{
 const describe=e=>{if(!e)return null;const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,text:e.textContent.trim(),background:s.backgroundColor,outline:s.outline,display:s.display,visible:r.width>0&&r.height>0,insideRenderedMarkdown:!!e.closest('.rendered-markdown')};};
 const buttons=[...document.querySelectorAll('button')];
 const img=document.querySelector('#audit-https-image');
 return {csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,stylesInContent:!!document.querySelector('.rendered-markdown #audit-style'),userStyleElementExists:!!document.querySelector('#audit-user-only-style'),userMarkupDisplayedAsText:document.body.innerText.includes('audit-user-only-style'),richMarkdown:{heading:!!document.querySelector('.rendered-markdown h3'),table:!!document.querySelector('.rendered-markdown table'),code:!!document.querySelector('.rendered-markdown code')},composer:describe(document.querySelector('textarea[aria-label="Message"]')),approve:describe(buttons.find(b=>b.textContent.trim()==='Approve')),reject:describe(buttons.find(b=>b.textContent.trim()==='Reject')),httpsImage:img?{complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,src:img.getAttribute('src'),onloadAttributePresent:img.hasAttribute('onload')}:null,inlineHandlerRan:window.__auditInlineHandlerRan===true,inlineErrorRan:window.__auditInlineErrorRan===true,violations:window.__auditSecurityViolations??[]};
})()`;
const shellSnapshot=async()=>{const r=await shell.send('Runtime.evaluate',{expression:`(()=>{const s=getComputedStyle(document.body);return {bodyBackground:s.backgroundColor,bodyOutline:s.outline,auditStyleElement:!!document.querySelector('#audit-style'),visibleButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0).slice(0,8).map(e=>({label:e.getAttribute('aria-label')??e.textContent.trim(),outline:getComputedStyle(e).outline}))};})()`,returnByValue:true});return r.result.value;};
const screenshot=async name=>{const r=await shell.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,name),Buffer.from(r.data,'base64'));return name;};
try{
 shell=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 await c.send('Network.enable');
 c.on('Network.requestWillBeSent',p=>{if(p.request.url.startsWith('https://audit.invalid/'))report.network.push({event:'requestWillBeSent',url:p.request.url,type:p.type,initiatorType:p.initiator.type});});
 c.on('Fetch.requestPaused',p=>{
  const promise=(async()=>{
   assert.ok(p.request.url.startsWith('https://audit.invalid/'));
   report.interceptions.push({url:p.request.url,resourceType:p.resourceType,response:'local PNG; Fetch request-stage fulfillment'});
   await c.send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'},{name:'Cache-Control',value:'no-store'}],body:onePixel});
  })();
  pendingIntercepts.add(promise);promise.then(()=>pendingIntercepts.delete(promise),e=>{report.interceptionError=String(e);pendingIntercepts.delete(promise);});
 });
 await c.send('Fetch.enable',{patterns:[{urlPattern:'https://audit.invalid/*',requestStage:'Request'}]});
 await v.evaluate(`(()=>{window.__auditSecurityViolations=[];window.__auditInlineHandlerRan=false;window.__auditInlineErrorRan=false;window.__auditSecurityListener=e=>window.__auditSecurityViolations.push({effectiveDirective:e.effectiveDirective,violatedDirective:e.violatedDirective,blockedURI:e.blockedURI,disposition:e.disposition});document.addEventListener('securitypolicyviolation',window.__auditSecurityListener);return true;})()`);
 await project(baselineContent);
 await waitFor(async()=>await v.evaluate(`!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Approve')`));
 const before=await v.evaluate(snapshotExpression);
 assert.equal(before.userStyleElementExists,false);
 assert.equal(before.userMarkupDisplayedAsText,true);
 assert.equal(before.richMarkdown.table,true);
 assert.equal(before.approve.insideRenderedMarkdown,false);
 assert.equal(before.composer.insideRenderedMarkdown,false);
 record('baseline',{view:before,shell:await shellSnapshot(),screenshot:await screenshot('formats-security-baseline.png')});
 await project(payload);
 await waitFor(async()=>await v.evaluate(`document.querySelector('#audit-https-image')?.naturalWidth===1 && (window.__auditSecurityViolations??[]).some(v=>v.effectiveDirective==='script-src-attr')`));
 await Promise.all([...pendingIntercepts]);
 const after=await v.evaluate(snapshotExpression);
 assert.equal(after.stylesInContent,true);
 assert.equal(after.composer.background,'rgb(255, 235, 160)');
 assert.match(after.approve.outline,/rgb\(235, 0, 200\)/);
 assert.match(after.reject.outline,/rgb\(235, 0, 200\)/);
 assert.equal(after.approve.insideRenderedMarkdown,false);
 assert.equal(after.inlineHandlerRan,false);
 assert.equal(after.inlineErrorRan,false);
 assert.equal(after.httpsImage.naturalWidth,1);
 assert.ok(report.interceptions.length>0);
 assert.equal(report.interceptionError,undefined);
 record('assistant-html',{view:after,shell:await shellSnapshot(),screenshot:await screenshot('formats-security-styled-controls.png')});
 await project(baselineContent);
 await waitFor(async()=>!(await v.evaluate('!!document.querySelector("#audit-style")')));
 const restored=await v.evaluate(snapshotExpression);
 assert.equal(restored.composer.background,before.composer.background);
 assert.equal(restored.approve.outline,before.approve.outline);
 assert.equal(restored.reject.outline,before.reject.outline);
 record('restored-content',{view:restored,shell:await shellSnapshot()});
 report.completed=true;
 report.limits=['Synthetic host-shaped MessageEvent fixture is not proof of host-message forgery or a native model turn.','Style effects proved within the AI webview, not across other webviews or the native workbench.','Remote image policy acceptance proved with local Fetch fulfillment, not DNS/TLS or a real remote transfer.','Inline event handlers were blocked; no script, privileged host API or OS-code execution demonstrated.','Approval component was synthetic and never clicked; backend authorization bypass was not tested or established.'];
}catch(e){report.error=String(e.stack??e);throw e;}
finally{
 try{await project(baselineContent);await v.evaluate(`document.removeEventListener('securitypolicyviolation',window.__auditSecurityListener);true`);await c.send('Fetch.disable');}catch(e){report.fixtureCleanupError=String(e);}
 writeEvidence(output,report);v.close();shell?.close();
}
console.log(JSON.stringify({completed:report.completed,steps:report.steps.map(s=>s.name),interceptedImages:report.interceptions.length,output}));
