import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {session,driver,findWebview,waitFor,processList,writeEvidence,evidence} from './formats-tools.mjs';
const require=createRequire(path.resolve(evidence,'../../../../../extensions/ritemark/package.json'));
const PDFDocument=require('pdfkit');
const report={method:'Twenty-page synthetic PDF, actual viewer and scroll input. Record rendered canvas dimensions/count, JS heap and owned process RSS snapshots. Pixel area times four is only an RGBA surface size calculation, not measured allocated/unique physical memory. No weak-Windows inference.',pageCount:20,samples:[],completed:false};
const file=path.join(session.workspace,'sample.pdf'),previous=fs.readFileSync(file);
const ownProcesses=()=>{const all=processList(),own=new Set([session.pid]);let changed=true;while(changed){changed=false;for(const p of all)if(own.has(p.ppid)&&!own.has(p.pid)){own.add(p.pid);changed=true;}}return all.filter(p=>own.has(p.pid));};
const save=()=>writeEvidence('formats-pdf-pages-probe.json',report);
let v;
async function sample(stage){
 const dom=v?await v.evaluate(`(()=>{const sizes=[...document.querySelectorAll('.react-pdf__Document canvas')].filter(e=>e.width&&e.height).map(e=>({width:e.width,height:e.height}));return {text:document.body.innerText,canvasCount:sizes.length,canvasDimensions:sizes,rgbaSurfaceBytes:sizes.reduce((n,s)=>n+s.width*s.height*4,0),resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('webview.js')||e.name.includes('pdf.worker')).map(e=>({name:e.name,decodedBodySize:e.decodedBodySize}))};})()`):null;
 const heap=v?await v.cdp.send('Runtime.getHeapUsage'):null;
 report.samples.push({stage,at:Date.now(),dom,heap,processes:ownProcesses()});save();
}
try{
 const pdf=new PDFDocument({autoFirstPage:false}),chunks=[];
 const done=new Promise((resolve,reject)=>{pdf.on('data',b=>chunks.push(b));pdf.on('end',resolve);pdf.on('error',reject);});
 for(let n=1;n<=20;n++){pdf.addPage({size:'A4',margin:48});pdf.fontSize(22).text('AUDIT PAGE '+n);pdf.fontSize(12).text('Twenty-page local fixture. Scroll retention observation.');pdf.rect(48,150,420,500).fillAndStroke('#dae8fc','#6c8ebf');}
 pdf.end();await done;fs.writeFileSync(file,Buffer.concat(chunks));report.fixtureBytes=fs.statSync(file).size;
 await sample('before-open');await driver('/open',{file:'sample.pdf'});
 v=await findWebview('document.body.innerText.includes("AUDIT PAGE 1")');
 await waitFor(()=>v.evaluate("document.querySelectorAll('.react-pdf__Document > div').length===20"));
 await new Promise(r=>setTimeout(r,1000));await sample('first-page');
 for(let i=0;i<20;i++){
  await v.evaluate(`document.querySelectorAll('.react-pdf__Document > div')[${i}].scrollIntoView({block:'center'})`);
  await waitFor(()=>v.evaluate(`(()=>{const c=document.querySelectorAll('.react-pdf__Document > div')[${i}]?.querySelector('canvas');return !!c&&c.width>0&&c.height>0;})()`));
 }
 await sample('all-pages-visited');
 await v.evaluate("document.querySelector('.react-pdf__Document > div').scrollIntoView({block:'start'})");
 await new Promise(r=>setTimeout(r,1000));await sample('returned-to-first');
 const last=report.samples.at(-1);report.allTwentyCanvasesRetained=last.dom.canvasCount===20;
 assert.equal(report.allTwentyCanvasesRetained,true);
 await driver('/command',{command:'workbench.action.closeActiveEditor'});v.close();v=undefined;
 await new Promise(r=>setTimeout(r,1000));await sample('closed');
 report.completed=true;save();console.log(JSON.stringify({completed:true,fixtureBytes:report.fixtureBytes,samples:report.samples.map(s=>({stage:s.stage,canvases:s.dom?.canvasCount,rgbaSurfaceBytes:s.dom?.rgbaSurfaceBytes,jsHeapUsed:s.heap?.usedSize}))}));
}catch(e){report.error=String(e.stack??e);save();throw e;}finally{v?.close();fs.writeFileSync(file,previous);}
