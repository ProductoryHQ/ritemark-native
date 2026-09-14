import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../../../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const final=read('normal-performance-final-load-probe.json');
const profile=read('normal-performance-profile-load-probe.json');
const cleanup=read('normal-performance-cleanup-probe.json');
const calibrationCleanup=read('normal-performance-calibration-cleanup-probe.json');
const session=read('normal-performance-session.json');
assert.equal(final.completed,true);assert.equal(profile.completed,true);
assert.notEqual(final.pid,profile.pid);assert.equal(cleanup.pid,final.pid);
assert.equal(calibrationCleanup.pid,profile.pid);
for(const c of [cleanup,calibrationCleanup]){assert.equal(c.completed,true);assert.equal(c.remaining.length,0);assert.equal(c.cdpPortClosed,true);}
assert.equal(final.trials.length,6);assert.equal(new Set(final.trials.map(t=>t.targetId)).size,6);
const stats=values=>{const v=values.toSorted((a,b)=>a-b);return {min:v[0],median:v[Math.floor(v.length/2)],max:v.at(-1)};};
const report={method:'Final timing sample is a fresh app process with no Profiler/precise coverage enabled. Profile/coverage captures are a separate previous process and are not timing controls. Rechecks visible actual inner frames, pre-fetch metrics, exact code/fixture hashes, CDP target lifecycle, raw profile/coverage and verified shutdown.',baseline:'30ea2ab32d15be161991d1bb8924a4c4ca331f8c',machine:final.machine,browser:final.browser,measurementPid:final.pid,profilePid:profile.pid,rates:{},profiles:[]};
for(const rate of [1,4]){
 const ts=final.trials.filter(t=>t.rate===rate);assert.equal(ts.length,3);
 for(const t of ts){assert.equal(t.completed,true);assert.equal(t.metricsBeforeBundleRequest,true);assert.equal(t.ready.visibility,'visible');assert.equal(t.ready.frameId,'active-frame');assert.ok(t.attached.some(a=>a.targetId===t.targetId&&a.detachedAt));assert.equal(t.rendered.resources.length,1);assert.equal(t.rendered.resources[0].decodedBodySize,8844955);assert.equal(t.ready.html,'<h1>Normal mode audit</h1><p>Unsaved recovery baseline. PERSISTENT HUMAN 1789295746665</p>');}
 report.rates[rate]={trials:ts.map(t=>t.index),openToReadyMs:stats(ts.map(t=>t.elapsedOpenToObservedMs)),scriptMs:stats(ts.map(t=>t.metricDelta.ScriptDuration*1000)),mainTaskMs:stats(ts.map(t=>t.metricDelta.TaskDuration*1000)),compileMetricMs:stats(ts.map(t=>t.metricDelta.V8CompileDuration*1000)),resourceMs:stats(ts.map(t=>t.rendered.resources[0].duration)),longestTaskMs:stats(ts.map(t=>Math.max(0,...t.rendered.observer.longTasks.map(l=>l.duration)))),scriptShareOfTask:stats(ts.map(t=>t.metricDelta.ScriptDuration/t.metricDelta.TaskDuration))};
}
report.medianRatios={ready4to1:report.rates[4].openToReadyMs.median/report.rates[1].openToReadyMs.median,script4to1:report.rates[4].scriptMs.median/report.rates[1].scriptMs.median};
const source=fs.readFileSync(path.join(root,'extensions/ritemark/media/webview.js'),'utf8');
report.bundle={bytes:Buffer.byteLength(source),utf16Units:source.length,sha256:crypto.createHash('sha256').update(source).digest('hex')};
assert.equal(report.bundle.sha256,session.files['media/webview.js'].sha256);
const lines=source.split('\n');
const dependencies=path.join(root,'extensions/ritemark/webview/node_modules');
const elkSource=fs.readFileSync(path.join(dependencies,'elkjs/lib/elk.bundled.js'),'utf8');
const highlightSource=fs.readFileSync(path.join(dependencies,'highlight.js/lib/core.js'),'utf8');
const parserSource=fs.readFileSync(path.join(dependencies,'@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-FOHPRMQF.mjs'),'utf8');
assert.ok(elkSource.includes('convertGwtStyleError'));
assert.ok(lines[2900].includes('convertGwtStyleError'));
assert.ok(parserSource.includes('Deleting Recording methods')&&parserSource.includes('TRACE_INIT'));
assert.ok(lines[4176].includes('Deleting Recording methods')&&lines[4181].includes('TRACE_INIT'));
assert.ok(highlightSource.includes('could not be registered')&&lines[157].includes('could not be registered'));
report.sourceAttribution={method:'Narrow source anchors around sampled generated-bundle frames, matched to installed locked dependency source. No sourcemap or package-wide CPU percentage is claimed.',
  elk:{packageVersion:JSON.parse(fs.readFileSync(path.join(dependencies,'elkjs/package.json'),'utf8')).version,bundleLine:2901,loaderColumn:2587,packageFile:'elkjs/lib/elk.bundled.js',anchor:'convertGwtStyleError'},
  highlight:{packageVersion:JSON.parse(fs.readFileSync(path.join(dependencies,'highlight.js/package.json'),'utf8')).version,bundleLine:158,column:3046,packageFile:'highlight.js/lib/core.js',anchor:'could not be registered'},
  parser:{packageVersion:JSON.parse(fs.readFileSync(path.join(dependencies,'@mermaid-js/parser/package.json'),'utf8')).version,bundleLines:[4177,4182],packageFile:'@mermaid-js/parser/dist/chunks/mermaid-parser.core/chunk-FOHPRMQF.mjs',anchors:['Deleting Recording methods','TRACE_INIT']}};
for(const t of profile.trials){
 const coverage=read(t.coverageFile).result.filter(s=>s.url.includes('/media/webview.js?'));
 assert.equal(coverage.length,1);
 const bundle=coverage[0],ranges=bundle.functions.flatMap(f=>f.ranges).toSorted((a,b)=>(b.endOffset-b.startOffset)-(a.endOffset-a.startOffset));
 const mask=new Uint8Array(source.length);
 for(const r of ranges){assert.ok(r.startOffset>=0&&r.endOffset<=source.length);mask.fill(r.count>0?1:0,r.startOffset,r.endOffset);}
 const rootRange=ranges.find(r=>r.startOffset===0&&r.endOffset===source.length);
 assert.ok(rootRange?.count>0,'Coverage must include executing the bundle top level');
 const cpu=read(t.profileFile),nodes=new Map(cpu.nodes.map(n=>[n.id,n])),weights=new Map();
 assert.equal(cpu.samples.length,cpu.timeDeltas.length);
 cpu.samples.forEach((id,i)=>weights.set(id,(weights.get(id)??0)+cpu.timeDeltas[i]));
 const categories={bundle:0,idle:0,program:0,gc:0,other:0};
 for(const [id,us] of weights){const frame=nodes.get(id).callFrame;const cat=frame.url.includes('/media/webview.js?')?'bundle':frame.functionName==='(idle)'?'idle':frame.functionName==='(program)'?'program':frame.functionName==='(garbage collector)'?'gc':'other';categories[cat]+=us/1000;}
 report.profiles.push({rate:t.rate,metricsBeforeBundleRequest:t.metricsBeforeBundleRequest,profilerBeforeBundleRequest:t.profilerBeforeBundleRequest,profileFile:t.profileFile,coverageFile:t.coverageFile,sampleCount:cpu.samples.length,rootExecutionCount:rootRange.count,functionCount:bundle.functions.length,calledFunctionCount:bundle.functions.filter(f=>f.ranges[0]?.count>0).length,executedUtf16Units:mask.reduce((sum,v)=>sum+v,0),executedFraction:mask.reduce((sum,v)=>sum+v,0)/source.length,leafSampleMs:categories,topBundleFrames:[...weights].filter(([id])=>nodes.get(id).callFrame.url.includes('/media/webview.js?')).toSorted((a,b)=>b[1]-a[1]).slice(0,12).map(([id,us])=>{const f=nodes.get(id).callFrame;return {functionName:f.functionName,line:f.lineNumber+1,column:f.columnNumber+1,selfSampleMs:us/1000,sourceSnippet:lines[f.lineNumber]?.slice(f.columnNumber,f.columnNumber+240)};})});
}
report.limits=['Warm app, local filesystem and initialized webview service worker; not cold launch or Windows hardware.', 'Focus emulation prevents macOS occlusion throttling. Only webview renderer CPU is throttled; shell, disk, GPU and native agents are not emulated.', 'Three samples per rate are sensitivity evidence, not population percentiles or a promised speedup.', 'Performance main-thread metrics are not whole-process CPU or background compiler totals; low V8CompileDuration on warm load does not prove cold parse is free.', 'Precise coverage/profile changes compilation/optimization and is used only for executed-code attribution; second profile capture starts after bundle request.', 'Executed UTF-16 range fraction describes this opening only; unexecuted code is not all removable, and byte contribution is not CPU contribution.', 'No keystroke responsiveness, Windows cost split, heap leak, native agent or cloud filesystem claim.'];
report.shutdown={calibrationProcesses:calibrationCleanup.before.length,measurementProcesses:cleanup.before.length,portsClosed:true,productHashes:cleanup.productHashes,fixtureHash:cleanup.fixtureHash};
const events=cleanup.eventFiles.flatMap(name=>fs.readFileSync(path.join(dir,name),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)));
report.hostEvents={count:events.length,fixtureOpenRequests:events.filter(e=>e.event==='driver-request'&&e.route==='/open'&&e.input.file==='note.md').length};assert.equal(report.hostEvents.fixtureOpenRequests,6);
fs.writeFileSync(path.join(dir,'performance-analysis.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rates:report.rates,medianRatios:report.medianRatios,profiles:report.profiles.map(p=>({rate:p.rate,functions:p.functionCount,called:p.calledFunctionCount,executedFraction:p.executedFraction,samples:p.sampleCount})),shutdown:report.shutdown,hostEvents:report.hostEvents},null,2));
