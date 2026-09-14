import fs from 'node:fs';
import path from 'node:path';
import {driver,findWebview,waitFor,session,writeEvidence,targets,connectCdp} from './live-tools.mjs';
const report={method:'Ordinary workbench Command Palette > Undo, distinct from the editor-focused Cmd-Z. Continues after the first recorded palette Undo restored the independent control insertion.',steps:[]};
const record=(stage,data)=>{report.steps.push({stage,at:Date.now(),...data});writeEvidence('live-host-history-probe.json',report);};
let c,v;
try{
 c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);
 v=await findWebview("document.querySelector('.ProseMirror')?.innerText.includes('UNDO CONTROL 1789294027889')");
 const evaluate=async expression=>(await c.send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
 const key=async(key,code,windowsVirtualKeyCode,modifiers=0)=>{for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode,modifiers});};
 record('before',{host:await driver()});
 for(let i=1;i<=3;i++){
   await key('P','KeyP',80,12);
   await waitFor(()=>evaluate("document.activeElement?.getAttribute('aria-label')==='Type the name of a command to run.'"));
   await evaluate('document.activeElement.select()');
   await c.send('Input.insertText',{text:'>Undo'});
   await waitFor(()=>evaluate("document.querySelector('.quick-input-widget')?.innerText.startsWith('1 Results\\nUndo')"));
   await key('Enter','Enter',13);
   await new Promise(r=>setTimeout(r,300));
   const host=await driver();
   record('host-undo-'+i,{host,visible:await v.evaluate("document.querySelector('.ProseMirror').innerText"),disk:fs.readFileSync(path.join(session.workspace,'second.md'),'utf8')});
   if(host.documents.find(d=>d.file==='second.md')?.text.includes('HUMAN UNSAVED')){report.priorLocalRecoveredThroughHostUndo=true;break;}
 }
 report.completed=true;writeEvidence('live-host-history-probe.json',report);console.log(JSON.stringify({completed:true,priorLocalRecoveredThroughHostUndo:report.priorLocalRecoveredThroughHostUndo??false}));
}catch(e){record('error',{error:String(e.stack??e)});throw e;}finally{v?.close();c?.close();}
