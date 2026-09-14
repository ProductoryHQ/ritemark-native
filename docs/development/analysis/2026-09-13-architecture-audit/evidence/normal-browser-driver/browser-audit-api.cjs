const vscode=require('vscode');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
module.exports=(context,runDir,log)=>{
 if(path.dirname(context.globalStorageUri.fsPath)!==path.join(runDir,'browser-profile','User/globalStorage'))throw new Error('Disposable browser profile required');
 const urls=['a','b'].map(n=>pathToFileURL(path.join(runDir,'browser-fixtures','page-'+n+'.html')).toString());
 const jobs=new Map();let serial=0;
 const refs=()=>{
  const ext=vscode.extensions.getExtension('ritemark.ritemark');
  if(!ext?.isActive||ext.extensionPath!==path.join(runDir,'extensions/ritemark.ritemark-1.10.1'))throw new Error('Expected staged product');
  const provider=require.cache[path.join(ext.extensionPath,'out/extension.js')]?.exports.unifiedViewProvider;
  const runtime=provider?._runtimeRegistry?.get('opencode');
  if(!runtime||typeof runtime._handleBrowserIpcRequest!=='function')throw new Error('Actual cached browser dispatcher unavailable');
  return {provider,runtime};
 };
 const metadata=()=>vscode.commands.executeCommand('workbench.action.browser.getActiveContext');
 return async q=>{
  if(q.operation==='inspect'){
   const {provider,runtime}=refs();
   return {hostPid:process.pid,platform:process.platform,entry:path.join(context.extensionPath,'index.cjs'),runtimeClass:runtime.constructor.name,runtimeSessionCount:provider._runtimeSessions.size,acpManagerStarted:!!runtime._manager,urls,metadata:await metadata(),commands:(await vscode.commands.getCommands(true)).filter(n=>n.startsWith('workbench.action.browser.')),jobs:[...jobs.values()]};
  }
  if(q.operation==='open'){
   if(!['a','b'].includes(q.page))throw new Error('Only local fixture pages');
   await vscode.commands.executeCommand('workbench.action.browser.open',{url:urls[q.page==='a'?0:1],openToSide:false});
   return {metadata:await metadata()};
  }
  if(q.operation==='result'){
   if(!jobs.has(q.id))throw new Error('Unknown audit job');return jobs.get(q.id);
  }
  if(q.operation==='start'){
   if(!['A','B'].includes(q.actor))throw new Error('Synthetic actor label required');
   const params=q.params??{};
   if(q.tool==='browser_navigate'){
    if(params.type!=='url'||!urls.includes(params.url))throw new Error('Navigation outside fixture');
   }else if(q.tool==='browser_fill'){
    if(params.selector!=='#entry'||typeof params.value!=='string'||!params.value.startsWith('AUDIT ')||params.value.length>100)throw new Error('Fixture field/value required');
   }else if(q.tool==='browser_click'){
    if(!['#mark','#late'].includes(params.selector))throw new Error('Fixture button required');
   }else if(q.tool!=='browser_snapshot')throw new Error('Tool outside audit scope');
   const current=await metadata();
   if(current?.url&&!urls.includes(current.url))throw new Error('Current browser is outside audit fixture');
   const {runtime}=refs();const id='audit-browser-'+(++serial);
   const job={id,actor:q.actor,tool:q.tool,params,startedAt:Date.now(),status:'running'};jobs.set(id,job);
   log('browser-audit-job-start',{...job});
   Promise.resolve().then(()=>runtime._handleBrowserIpcRequest({id,tool:q.tool,params})).then(result=>{Object.assign(job,{status:'completed',finishedAt:Date.now(),result});log('browser-audit-job-end',{...job});},error=>{Object.assign(job,{status:'failed',finishedAt:Date.now(),error:String(error)});log('browser-audit-job-end',{...job});});
   return {id,status:job.status};
  }
  throw new Error('Unknown browser audit operation');
 };
};
