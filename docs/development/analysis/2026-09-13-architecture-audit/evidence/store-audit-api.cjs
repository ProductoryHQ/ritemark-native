// Bounded observer/control seam for actual, already-loaded host objects.
// Only synthetic conversation IDs and a disposable no-folder profile are allowed.
const fs=require('node:fs');
const path=require('node:path');
const vscode=require('vscode');
module.exports=function createStoreAuditApi(context,runDir,log){
 const expectedStorage=path.join(runDir,'store-profile','User','globalStorage');
 if(path.dirname(context.globalStorageUri.fsPath)!==expectedStorage)throw new Error('Store audit requires its disposable profile');
 if(vscode.workspace.workspaceFolders?.length||vscode.workspace.workspaceFile)throw new Error('Store audit requires a no-folder window');
 const allowedId=id=>/^00000000-0000-4000-8000-a0060000000[1-4]$/.test(id);
 const refs=()=>{
  const ext=vscode.extensions.getExtension('ritemark.ritemark');
  if(!ext?.isActive||ext.extensionPath!==path.join(runDir,'extensions','ritemark.ritemark-1.10.1'))throw new Error('Expected unchanged staged Ritemark extension');
  const entry=path.join(ext.extensionPath,'out','extension.js');
  const cached=require.cache[entry];
  // Never require/re-evaluate another extension just to obtain a test object.
  if(!cached)throw new Error('Product module is not present in host require cache');
  const provider=cached.exports.unifiedViewProvider;
  const controller=provider?._conversationController;
  const store=controller?.dependencies?.store;
  if(!provider||!controller||!store)throw new Error('Live provider/controller/store unavailable');
  if(store.baseDir!==path.join(expectedStorage,'ritemark.ritemark','conversations','v1'))throw new Error('Store is outside disposable profile');
  const scope=controller.dependencies.currentScope();
  if(scope.descriptor.kind!=='no-folder')throw new Error('Unexpected current scope');
  return {provider,controller,store,scope,entry};
 };
 let interception=null;
 let originalFs=null;
 let instrumentedStore=null;
 const restore=()=>{
  if(interception?.release)interception.release('observer-reset');
  if(instrumentedStore&&originalFs)instrumentedStore.fs=originalFs;
  instrumentedStore=null;originalFs=null;
 };
 context.subscriptions.push({dispose:restore});
 const inspect=()=>{
  const {provider,controller,store,scope,entry}=refs();
  return {hostPid:process.pid,productModuleCached:true,entry,providerClass:provider.constructor.name,controllerClass:controller.constructor.name,storeClass:store.constructor.name,baseDir:store.baseDir,scope,runtimeSessionCount:provider._runtimeSessions?.size??null,interception:interception?{stage:interception.stage,conversationId:interception.conversationId,heldAt:interception.heldAt,releasedAt:interception.releasedAt,releaseReason:interception.releaseReason,candidate:interception.candidate}:null};
 };
 return async q=>{
  if(q.operation==='inspect')return inspect();
  if(q.operation==='reset-observer'){restore();return inspect();}
  if(q.operation==='release'){
   if(interception?.stage!=='held')throw new Error('No held record rename');
   interception.release('explicit-release');return inspect();
  }
  if(!allowedId(q.conversationId))throw new Error('Only audit fixture IDs are allowed');
  const {provider,controller,store,scope}=refs();
  if(q.operation==='seed'){
   const events=[{kind:'user-message',eventId:'audit-user-'+q.conversationId,turnId:'audit-turn-'+q.conversationId,sequence:0,occurredAt:new Date().toISOString(),runtimeId:'codex',text:'Synthetic shared-store audit request; no native dispatch.',mode:'agent',attachments:[]}];
   const record=await store.create({conversationId:q.conversationId,scopeId:scope.scopeId,scope:scope.descriptor,title:'AUDIT shared-store fixture '+q.conversationId.slice(-1),events,lifecycle:{state:'working',activeTurnId:'audit-turn-'+q.conversationId}});
   log('store-audit-seed',{conversationId:q.conversationId,revision:record.revision});return {record,host:inspect()};
  }
  if(q.operation==='arm'){
   if(interception?.stage==='armed'||interception?.stage==='held')throw new Error('An interception is already active');
   restore();originalFs=store.fs;instrumentedStore=store;
   const target=path.join(store.baseDir,'records',q.conversationId+'.json');
   interception={stage:'armed',conversationId:q.conversationId};
   const selected=interception,delegate=originalFs;
   store.fs={...delegate,async rename(from,to){
    if(selected.stage==='armed'&&to===target){
     if(path.dirname(from)!==path.dirname(target)||!path.basename(from).startsWith(q.conversationId+'.json.'))throw new Error('Unexpected atomic temporary file');
     selected.candidate=JSON.parse(fs.readFileSync(from,'utf8'));
     if(selected.candidate.conversationId!==q.conversationId)throw new Error('Unexpected record payload');
     selected.stage='held';selected.heldAt=Date.now();
     log('store-audit-rename-held',{conversationId:q.conversationId,revision:selected.candidate.revision,eventKinds:selected.candidate.events.map(e=>e.kind)});
     await new Promise(resolve=>{
      const timer=setTimeout(()=>selected.release('timeout-8000ms'),8000);
      selected.release=reason=>{if(selected.stage!=='held')return;clearTimeout(timer);selected.stage='released';selected.releasedAt=Date.now();selected.releaseReason=reason;log('store-audit-rename-released',{conversationId:q.conversationId,reason});resolve();};
     });
    }
    return delegate.rename(from,to);
   }};
   return inspect();
  }
  if(q.operation==='complete'){
   const record=await controller.completeRuntimeTurn({conversationId:q.conversationId,bindingGeneration:0,runtimeId:'codex',turnId:'audit-turn-'+q.conversationId,text:'AUDIT SAVED ASSISTANT RESULT '+q.conversationId.slice(-1),status:'completed'});
   log('store-audit-completion-return',{conversationId:q.conversationId,revision:record.revision,eventKinds:record.events.map(e=>e.kind)});
   return {record};
  }
  if(q.operation==='preference'){
   if(!['codex','claude-code'].includes(q.agentId)||!['high','low'].includes(q.thinkingEffort))throw new Error('Fixture preference required');
   const response=await controller.handle({type:'conversation/set-composer-preference',requestId:'audit-pref-'+process.pid+'-'+Date.now(),conversationId:q.conversationId,bindingGeneration:0,agentId:q.agentId,thinkingEffort:q.thinkingEffort});
   log('store-audit-preference-return',{conversationId:q.conversationId,ok:response.ok,revision:response.data?.conversation?.revision});return {response};
  }
  if(q.operation==='get'||q.operation==='show'){
   const response=await controller.handle({type:'conversation/get',requestId:'audit-get-'+process.pid+'-'+Date.now(),conversationId:q.conversationId});
   if(q.operation==='show'){
    if(!provider._view)throw new Error('Open the real AI view first');
    await provider._view.webview.postMessage(response);
   }
   return {response};
  }
  throw new Error('Unknown bounded store audit operation');
 };
};
