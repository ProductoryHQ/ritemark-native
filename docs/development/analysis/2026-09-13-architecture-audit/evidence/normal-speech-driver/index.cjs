// Audit-only observer and ordinary VS Code command driver. Never loads in user workspaces.
const vscode=require('vscode');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
exports.activate=context=>{
 const runDir=process.env.RITEMARK_AUDIT_NORMAL_RUN_DIR;
 if(!runDir?.startsWith('/private/tmp/ritemark-audit-normal-'))throw new Error('Synthetic normal-mode run required');
 const workspace=path.join(runDir,'workspace');
 const roots=vscode.workspace.workspaceFolders??[];
 if(roots.length!==1||fs.realpathSync(roots[0].uri.fsPath)!==fs.realpathSync(workspace))throw new Error('Only the audit fixture workspace is allowed');
 const allowedFiles=new Set(['note.md','shared.md','table.csv','book.xlsx']);
 const own=uri=>uri.scheme==='file'&&path.dirname(uri.fsPath)===workspace&&allowedFiles.has(path.basename(uri.fsPath));
 const token=crypto.randomBytes(24).toString('hex');
 const endpoint=path.join(runDir,'endpoints',process.pid+'.json');
 const events=path.join(runDir,'events',process.pid+'.jsonl');
 const docState=doc=>{const text=doc.getText();return {file:path.basename(doc.uri.fsPath),version:doc.version,dirty:doc.isDirty,text,length:text.length,sha256:crypto.createHash('sha256').update(text).digest('hex')};};
 const snapshot=()=>{
  const ext=vscode.extensions.getExtension('ritemark.ritemark');
  return {at:Date.now(),hostPid:process.pid,driverMode:context.extensionMode,driverPath:context.extensionPath,globalStorageRoot:path.dirname(context.globalStorageUri.fsPath),workspaceFile:vscode.workspace.workspaceFile?.toString()??null,workspaceFolders:roots.map(r=>r.uri.toString()),hotExit:vscode.workspace.getConfiguration('files').get('hotExit'),autoSave:vscode.workspace.getConfiguration('files').get('autoSave'),ritemark:ext?{active:ext.isActive,path:ext.extensionPath,version:ext.packageJSON.version}:null,documents:vscode.workspace.textDocuments.filter(d=>own(d.uri)).map(docState),tabs:vscode.window.tabGroups.all.map(g=>({active:g.isActive,viewColumn:g.viewColumn,tabs:g.tabs.map(t=>({label:t.label,active:t.isActive,dirty:t.isDirty,uri:t.input?.uri?.toString(),viewType:t.input?.viewType}))})),terminals:vscode.window.terminals.map(t=>t.name)};
 };
 const log=(event,detail={})=>fs.appendFileSync(events,JSON.stringify({at:Date.now(),hostPid:process.pid,event,...detail})+'\n');
 for(const[name,subscribe]of[['document-open',vscode.workspace.onDidOpenTextDocument],['document-save',vscode.workspace.onDidSaveTextDocument],['document-close',vscode.workspace.onDidCloseTextDocument]])context.subscriptions.push(subscribe(doc=>{if(own(doc.uri))log(name,docState(doc));}));
 context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e=>{if(own(e.document.uri))log('document-change',docState(e.document));}));
 context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(()=>log('tabs-change',{tabs:snapshot().tabs})));
 const speechAudit=require('./speech-audit-api.cjs')(context,runDir,log);
 const server=http.createServer(async(req,res)=>{
  const reply=(code,body)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body));};
  if(req.headers.authorization!==`Bearer ${token}`)return reply(403,{error:'Forbidden'});
  try{
   if(req.method==='GET'&&req.url==='/snapshot')return reply(200,snapshot());
   if(req.method!=='POST')return reply(404,{error:'Unknown route'});
   let raw='';for await(const b of req){raw+=b;if(raw.length>8192)throw new Error('Input too large');}
   const q=raw?JSON.parse(raw):{};
   if(req.url==='/speech-audit')return reply(200,await speechAudit(q));
   if(req.url==='/open'){
    if(!allowedFiles.has(q.file))throw new Error('Fixture file required');
    await vscode.commands.executeCommand('vscode.openWith',vscode.Uri.file(path.join(workspace,q.file)),q.file.endsWith('.xlsx')?'ritemark.excelViewer':'ritemark.editor',{preview:false});
   }else if(req.url==='/command'){
    const allowed=new Set(['workbench.action.files.save','workbench.action.closeActiveEditor','workbench.action.closeAllEditors','workbench.action.splitEditorRight','workbench.action.focusActiveEditorGroup','ritemark.unifiedView.focus','undo','redo']);
    if(!allowed.has(q.command))throw new Error('Command outside audit scope');
    await vscode.commands.executeCommand(q.command);
   }else return reply(404,{error:'Unknown route'});
   log('driver-request',{route:req.url,input:q});reply(200,snapshot());
  }catch(e){reply(500,{error:String(e.stack??e)});}
 });
 server.listen(0,'127.0.0.1',()=>{fs.writeFileSync(endpoint,JSON.stringify({hostPid:process.pid,port:server.address().port,token}));log('driver-ready',snapshot());});
 context.subscriptions.push({dispose(){server.close();try{fs.unlinkSync(endpoint);}catch{}}});
};
