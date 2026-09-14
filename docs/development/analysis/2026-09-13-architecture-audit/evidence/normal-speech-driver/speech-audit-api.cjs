// Disposable-profile observer. Product module/code bytes and constructors are unchanged.
const vscode=require('vscode');
const path=require('node:path');
const fs=require('node:fs');
const inspector=require('node:inspector');
module.exports=(context,runDir,log)=>{
 const profile=path.join(runDir,'speech-profile');
 if(path.dirname(context.globalStorageUri.fsPath)!==path.join(profile,'User/globalStorage'))throw Error('Disposable speech profile required');
 const fixtures=path.join(runDir,'workspace','speech-audit');
 const allowed=new Set(['control.wav','pending.wav','shared.wav']);
 const audio=name=>{if(!allowed.has(name))throw Error('Fixture audio required');return path.join(fixtures,name);};
 let refsPromise,engineOriginal,storeOriginal,subscription,storeGate=null;const held=new Map(),operations=new Map();let serial=0;
 async function findRefs(){
  const ext=vscode.extensions.getExtension('ritemark.ritemark');
  if(!ext?.isActive||ext.extensionPath!==path.join(runDir,'extensions/ritemark.ritemark-1.10.1'))throw Error('Actual staged product must be active');
  const exports=require.cache[path.join(ext.extensionPath,'out/extension.js')]?.exports;
  if(!exports?.activate||!exports.unifiedViewProvider)throw Error('Product module not cached');
  // Read the existing activation function's lexical settingsProvider reference.
  // No paused debugger, source re-evaluation, new product objects or secret reads.
  const debug=new inspector.Session();debug.connect();
  const post=(method,params={})=>new Promise((resolve,reject)=>debug.post(method,params,(e,r)=>e?reject(e):resolve(r)));
  let provider;
  globalThis.__ritemarkAuditActivate=exports.activate;
  try{
   const fn=await post('Runtime.evaluate',{expression:'globalThis.__ritemarkAuditActivate',objectGroup:'ritemark-speech-audit'});
   const info=await post('Runtime.getProperties',{objectId:fn.result.objectId,ownProperties:false});
   const scopes=info.internalProperties.find(p=>p.name==='[[Scopes]]')?.value?.objectId;
   if(!scopes)throw Error('Activation scopes unavailable');
   const list=await post('Runtime.getProperties',{objectId:scopes,ownProperties:true});
   for(const scope of list.result.filter(p=>/^\d+$/.test(p.name)&&p.value?.objectId)){
    const vars=await post('Runtime.getProperties',{objectId:scope.value.objectId,ownProperties:true});
    const setting=vars.result.find(p=>p.name==='settingsProvider')?.value;
    if(!setting?.objectId)continue;
    const out=await post('Runtime.callFunctionOn',{objectId:setting.objectId,functionDeclaration:"function(){const p=this.context?.subscriptions?.find(s=>s?.constructor?.name==='TranscriptWorkbenchProvider');if(p)globalThis.__ritemarkAuditSpeechProvider=p;return !!p;}",returnByValue:true});
    if(out.result.value){provider=globalThis.__ritemarkAuditSpeechProvider;break;}
   }
  }finally{delete globalThis.__ritemarkAuditActivate;delete globalThis.__ritemarkAuditSpeechProvider;await post('Runtime.releaseObjectGroup',{objectGroup:'ritemark-speech-audit'}).catch(()=>{});debug.disconnect();}
  if(!provider?._jobs||!provider._store)throw Error('Existing speech provider unavailable');
  if(provider._context.globalStorageUri.fsPath!==path.join(profile,'User/globalStorage/ritemark.ritemark'))throw Error('Wrong product storage');
  const refs={provider,jobs:provider._jobs,store:provider._store,registry:provider._registry,state:provider._context.globalState,unified:exports.unifiedViewProvider};
  subscription=refs.jobs.onEvent(e=>{if(path.dirname(e.job.audioPath)===fixtures)log('speech-audit-job-event',{job:e.job,type:e.type});});
  return refs;
 }
 const refs=()=>refsPromise??=(findRefs().catch(e=>{refsPromise=null;throw e;}));
 const sessionId=p=>{let hash=0;const normalized=path.resolve(p);for(let i=0;i<normalized.length;i++)hash=(hash<<5)-hash+normalized.charCodeAt(i)|0;return path.basename(normalized).replace(/[^a-zA-Z0-9-_]/g,'_').slice(0,40)+'-'+(hash>>>0).toString(36);};
 const describeGate=()=>storeGate?{state:storeGate.state,candidate:storeGate.candidate,heldAt:storeGate.heldAt}:null;
 return async q=>{
  const r=await refs();
  if(q.operation==='inspect')return {hostPid:process.pid,providerClass:r.provider.constructor.name,jobsClass:r.jobs.constructor.name,storeClass:r.store.constructor.name,baseDir:r.store.baseDir,globalStorage:r.provider._context.globalStorageUri.fsPath,workspaceFolders:(vscode.workspace.workspaceFolders??[]).map(f=>f.uri.toString()),workspaceFile:vscode.workspace.workspaceFile?.toString()??null,runtimeSessionCount:r.unified._runtimeSessions.size,jobs:r.jobs.list(),inflight:r.state.get('speech:inflightJobs',[]),heldEngines:[...held.values()].map(v=>({sourcePath:v.sourcePath,heldAt:v.heldAt})),engineBoundaryStubbed:!!engineOriginal,storeGate:describeGate(),operations:[...operations.values()],panels:[...r.provider._panels.keys()]};
  if(q.operation==='install-fixture-engine'){
   if(engineOriginal)return {installed:true,already:true};const e=r.registry.get('whisper-local');engineOriginal={engine:e,transcribe:e.transcribe};
   e.transcribe=async input=>{
    if(path.dirname(input.sourcePath)!==fixtures||!allowed.has(path.basename(input.sourcePath)))throw Error('Audit engine only accepts synthetic fixtures');
    if(held.has(input.sourcePath))throw Error('Fixture engine already held for this path');
    return new Promise((resolve,reject)=>{
     const finish=(kind)=>{if(!held.has(input.sourcePath))return;held.delete(input.sourcePath);clearTimeout(timer);input.signal.removeEventListener('abort',abort);log('speech-audit-engine-release',{sourcePath:input.sourcePath,kind});if(kind!=='success')reject(Error('Audit engine '+kind));else resolve({language:'en',speakerSeparation:'none',durationSec:1,segments:[{id:'audit-segment',start:0,end:1,text:'AUDIT SYNTHETIC TRANSCRIPT '+path.basename(input.sourcePath)}]});};
     const abort=()=>finish('cancelled');const timer=setTimeout(()=>finish('observer-timeout'),120000);
     held.set(input.sourcePath,{sourcePath:input.sourcePath,heldAt:Date.now(),finish});input.signal.addEventListener('abort',abort,{once:true});log('speech-audit-engine-held',{sourcePath:input.sourcePath});if(input.signal.aborted)abort();
    });
   };
   return {installed:true,engine:'whisper-local',method:'Actual engine transcribe boundary replaced only for synthetic audio; prepare/peaks/job/state/store stay production. No whisper/model or cloud request.'};
  }
  if(q.operation==='enqueue'){
   const sourcePath=audio(q.file);if(!engineOriginal)throw Error('Fixture engine must be installed');
   const job=r.jobs.enqueue({audioPath:sourcePath,engineId:'whisper-local',workspaceRoot:path.join(runDir,'workspace'),durationSec:1,language:'en'});log('speech-audit-enqueue',{job});return job;
  }
  if(q.operation==='release-engine'){const sourcePath=audio(q.file);const h=held.get(sourcePath);if(!h)throw Error('No held fixture engine');h.finish('success');return {released:true};}
  if(q.operation==='cancel-job'){const job=r.jobs.get(q.jobId);if(!job||path.dirname(job.audioPath)!==fixtures)throw Error('Fixture job required');r.jobs.cancel(job.id);return {cancelRequested:job.id};}
  if(q.operation==='seed'){
   const sourcePath=audio('shared.wav'),id=sessionId(sourcePath);if(await r.store.get(id))throw Error('Do not overwrite existing seed');const stat=fs.statSync(sourcePath),now=new Date().toISOString();
   const session={id,audioPath:sourcePath,audioFingerprint:stat.size+':'+Math.floor(stat.mtimeMs),durationSec:1,createdAt:now,updatedAt:now,workspaceRoot:path.join(runDir,'workspace'),engine:'elevenlabs',language:'en',speakerSeparation:'diarized',speakers:[{id:'speaker_0',label:'AUDIT SPEAKER ZERO',colorIndex:0},{id:'speaker_1',label:'AUDIT SPEAKER ONE',colorIndex:1}],segments:[{id:'audit-0',start:0,end:0.5,text:'AUDIT shared transcript first sentence.',speaker:'speaker_0'},{id:'audit-1',start:0.5,end:1,text:'AUDIT shared transcript second sentence.',speaker:'speaker_1'}],peaks:[0,0.2,0.4,0.2,0]};await r.store.save(session);return {session,syntheticSeed:true};
  }
  if(q.operation==='read')return r.store.get(sessionId(audio(q.file)));
  if(q.operation==='open'){await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(audio(q.file)),'ritemark.transcriptWorkbench',{preview:false});return {opened:q.file};}
  if(q.operation==='open-panel'){await vscode.commands.executeCommand('ritemark.transcribeView.focus');return {opened:true};}
  if(q.operation==='refresh'){for(const[p,panel]of r.provider._panels)if(path.dirname(p)===fixtures)await r.provider._push(p,panel);return {refreshed:true};}
  if(q.operation==='hold-next-save'){
   if(storeGate)throw Error('Existing store gate');if(!storeOriginal){storeOriginal=r.store.save;r.store.save=async function(session){
    const g=storeGate;if(!g||g.state!=='armed'||session.id!==sessionId(audio('shared.wav')))return storeOriginal.call(this,session);
    g.state='held';g.candidate=JSON.parse(JSON.stringify(session));g.heldAt=Date.now();log('speech-audit-save-held',{session:g.candidate});
    await new Promise((resolve,reject)=>{g.release=()=>{clearTimeout(g.timer);g.state='released';log('speech-audit-save-release',{id:session.id});resolve();};g.timer=setTimeout(()=>{g.state='timed-out';reject(Error('Audit save hold timed out'));},8000);});return storeOriginal.call(this,session);
   };}storeGate={state:'armed'};return {armed:true};
  }
  if(q.operation==='release-save'){if(storeGate?.state!=='held')throw Error('No held save');storeGate.release();return {released:true};}
  if(q.operation==='rename'){
   if(!['speaker_0','speaker_1'].includes(q.speakerId)||typeof q.label!=='string'||!q.label.startsWith('AUDIT ')||q.label.length>60)throw Error('Synthetic speaker label required');
   const id='audit-speech-rename-'+(++serial),op={id,status:'running',speakerId:q.speakerId,label:q.label,startedAt:Date.now()};operations.set(id,op);
   r.provider._renameSpeaker(audio('shared.wav'),q.speakerId,q.label).then(()=>{Object.assign(op,{status:'completed',finishedAt:Date.now()});log('speech-audit-rename-end',op);},e=>{Object.assign(op,{status:'failed',finishedAt:Date.now(),error:String(e)});log('speech-audit-rename-end',op);});return {id,status:op.status};
  }
  if(q.operation==='reset-observer'){
   if([...held.values()].length||[...operations.values()].some(o=>o.status==='running')||storeGate?.state==='held')throw Error('Finish/cancel owned work before restoring');
   if(engineOriginal){engineOriginal.engine.transcribe=engineOriginal.transcribe;engineOriginal=undefined;}if(storeOriginal){r.store.save=storeOriginal;storeOriginal=undefined;}storeGate=null;subscription?.();subscription=null;return {restored:true};
  }
  throw Error('Unknown speech audit operation');
 };
};
