// Research-only VS Code host driver. Runs only in an isolated synthetic workspace.
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

exports.activate = function activate(context) {
  const runDir = process.env.RITEMARK_AUDIT_RUN_DIR;
  if (!runDir || !runDir.startsWith('/private/tmp/ritemark-audit-live-')) {
    throw new Error('Audit driver requires its synthetic run directory');
  }
  const workspace = path.join(runDir, 'workspace');
  const roots = vscode.workspace.workspaceFolders ?? [];
  if (roots.length !== 1 || fs.realpathSync(roots[0].uri.fsPath) !== fs.realpathSync(workspace)) {
    throw new Error('Audit driver refuses any other workspace');
  }
  const allowedFiles = new Set(['note.md', 'second.md', 'table.csv', 'book.xlsx', 'diagram.drawio.svg']);
  const token = crypto.randomBytes(24).toString('hex');
  const started = Date.now();
  const eventFile = path.join(runDir, 'driver-events.jsonl');
  function log(event, details = {}) {
    fs.appendFileSync(eventFile, JSON.stringify({ at:Date.now(), sinceDriverMs:Date.now()-started, event, ...details })+'\n');
  }
  function own(uri) { return uri.scheme === 'file' && uri.fsPath.startsWith(workspace + path.sep); }
  function docState(doc) {
    const text = doc.getText();
    return { file:path.basename(doc.uri.fsPath), version:doc.version, dirty:doc.isDirty, length:text.length, sha256:crypto.createHash('sha256').update(text).digest('hex'), text:text.slice(0,4000) };
  }
  function snapshot() {
    const ext = vscode.extensions.getExtension('ritemark.ritemark');
    return {
      at:Date.now(), hostPid:process.pid,
      ritemark:ext ? { active:ext.isActive, path:ext.extensionPath, version:ext.packageJSON.version, mode:ext.extensionMode } : null,
      documents:vscode.workspace.textDocuments.filter(d=>own(d.uri)).map(docState),
      tabs:vscode.window.tabGroups.all.map(g=>({active:g.isActive,viewColumn:g.viewColumn,tabs:g.tabs.map(t=>({label:t.label,active:t.isActive,dirty:t.isDirty,uri:t.input?.uri?.toString(),viewType:t.input?.viewType}))})),
      activeTerminal:vscode.window.activeTerminal?.name ?? null,
      terminals:vscode.window.terminals.map(t=>t.name),
    };
  }
  for (const [name, subscribe] of [
    ['document-open',vscode.workspace.onDidOpenTextDocument],
    ['document-save',vscode.workspace.onDidSaveTextDocument],
    ['document-close',vscode.workspace.onDidCloseTextDocument],
  ]) context.subscriptions.push(subscribe(doc=>{ if(own(doc.uri))log(name,docState(doc)); }));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e=>{ if(own(e.document.uri))log('document-change',docState(e.document)); }));
  context.subscriptions.push(vscode.window.onDidOpenTerminal(t=>log('terminal-open',{name:t.name})));
  context.subscriptions.push(vscode.window.onDidChangeActiveTerminal(t=>log('terminal-active',{name:t?.name??null})));
  context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(()=>log('tabs-change',{tabs:snapshot().tabs})));

  const server = http.createServer(async(req,res)=>{
    function reply(code,body) { res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(body)); }
    if(req.headers.authorization !== `Bearer ${token}`) return reply(403,{error:'Forbidden'});
    try {
      if(req.method === 'GET' && req.url === '/snapshot') return reply(200,snapshot());
      if(req.method !== 'POST') return reply(404,{error:'Unknown route'});
      let body='';
      for await (const chunk of req) { body += chunk; if(body.length>8192)throw new Error('Input too large'); }
      const input=body ? JSON.parse(body) : {};
      if(req.url === '/open') {
        if(!allowedFiles.has(input.file))throw new Error('Only synthetic fixture files allowed');
        const uri=vscode.Uri.file(path.join(workspace,input.file));
        const viewType=input.file.endsWith('.xlsx')?'ritemark.excelViewer':input.file.endsWith('.drawio.svg')?'ritemark.drawio':'ritemark.editor';
        await vscode.commands.executeCommand('vscode.openWith',uri,viewType,{preview:false});
      } else if(req.url === '/command') {
        const commands=new Set(['ritemark.unifiedView.focus','workbench.action.focusActiveEditorGroup','workbench.action.splitEditorRight','workbench.action.files.save','workbench.action.closeActiveEditor','workbench.action.closeAllEditors']);
        if(!commands.has(input.command))throw new Error('Command is outside audit scope');
        await vscode.commands.executeCommand(input.command);
      } else return reply(404,{error:'Unknown route'});
      log('driver-request',{route:req.url,input});
      reply(200,snapshot());
    } catch(error) { reply(500,{error:String(error?.stack??error)}); }
  });
  server.listen(0,'127.0.0.1',()=>{
    fs.writeFileSync(path.join(runDir,'driver-endpoint.json'),JSON.stringify({port:server.address().port,token,hostPid:process.pid}));
    log('driver-ready',snapshot());
  });
  context.subscriptions.push({dispose(){server.close();}});
};
