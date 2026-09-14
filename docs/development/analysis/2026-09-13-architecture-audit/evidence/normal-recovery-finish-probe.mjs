import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {session,driver,targets,connectCdp,findWebview,writeEvidence,evidence} from './normal-tools.mjs';
const previous=JSON.parse(fs.readFileSync(path.join(evidence,'normal-recovery-probe.json'),'utf8'));
assert.ok(previous.steps.some(s=>s.stage==='markdown-restored'));
const expected=previous.steps.find(s=>s.stage==='markdown-unsaved').host.documents.find(d=>d.file==='note.md').text;
const xlsx=createRequire(import.meta.url)('../../../../../extensions/ritemark/node_modules/xlsx');
const readCell=()=>xlsx.readFile(path.join(session.workspace,'book.xlsx')).Sheets.Sheet1.B2.v;
const report={method:'Resume the same running recovery session after correcting a malformed dynamic DOM selector in the harness. No second edit, restart or external disk write. Original error preserved in normal-recovery-probe.json.',steps:[]};
const record=(stage,data)=>{report.steps.push({stage,at:Date.now(),...data});writeEvidence('normal-recovery-finish-probe.json',report);};
let v,c;
try{
 v=await findWebview("[...document.querySelectorAll('td[title]')].some(e=>e.title==="+JSON.stringify(previous.excelMarker)+")");
 const host=await driver();assert.equal(host.driverMode,1);assert.equal(host.ritemark.path,session.extensionPath);assert.ok(host.tabs.some(g=>g.tabs.some(t=>t.label==='book.xlsx'&&t.dirty)));assert.equal(readCell(),'baseline');
 record('xlsx-restored',{host,visible:await v.evaluate('document.body.innerText'),diskCell:readCell()});
 await driver('/command',{command:'workbench.action.files.save'});assert.equal(readCell(),previous.excelMarker);
 await driver('/open',{file:'note.md'});const md=await driver();assert.equal(md.documents.find(d=>d.file==='note.md').text,expected);assert.equal(md.documents.find(d=>d.file==='note.md').dirty,true);
 await driver('/command',{command:'workbench.action.files.save'});assert.equal(fs.readFileSync(path.join(session.workspace,'note.md'),'utf8'),expected);
 record('both-recovered-and-saved',{host:await driver(),diskMarkdown:fs.readFileSync(path.join(session.workspace,'note.md'),'utf8'),diskCell:readCell()});
 c=await connectCdp((await targets()).find(t=>t.type==='page'&&t.url.includes('workbench')).webSocketDebuggerUrl);const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'normal-recovered-documents.png'),Buffer.from(shot.data,'base64'));
 report.completed=true;report.markdownRecovered=true;report.xlsxRecovered=true;report.recoveredWorkSaved=true;writeEvidence('normal-recovery-finish-probe.json',report);console.log(JSON.stringify({completed:true,markdownRecovered:true,xlsxRecovered:true,recoveredWorkSaved:true}));
}catch(e){record('error',{error:String(e.stack??e)});throw e;}finally{v?.close();c?.close();}
