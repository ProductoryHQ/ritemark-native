"""Reuse unchanged staged product with a new disposable no-folder profile."""
from pathlib import Path
import hashlib
import json

evidence = Path(__file__).resolve().parent
original = json.loads((evidence / 'normal-session.json').read_text())
run = Path(original['runDir'])
assert str(run) == '/private/tmp/ritemark-audit-normal-bg5jgmun'
profile = run / 'store-profile'
assert not profile.exists(), 'Never overwrite a prepared or running profile'
assert not (run / 'store-app.log').exists()
(profile / 'User').mkdir(parents=True)
(profile / 'User/settings.json').write_text(json.dumps(original['settings'], indent=2) + '\n')
session = {k: v for k, v in original.items() if k not in ['pid', 'launchedAt', 'launches', 'args']}
session.update(profile=str(profile), method='Unchanged existing staged audit extension with a new disposable no-folder profile. Observer accesses live cached host objects and can pause only fixture-record renames for at most 8 seconds. No native model/tool dispatch.', preparedOnly=True)
session['args'] = [arg.replace(original['profile'], str(profile)).replace('9238', '9240') for arg in original['args'][:-1]]
for rel, check in session['files'].items():
    assert hashlib.sha256((Path(session['extensionPath']) / rel).read_bytes()).hexdigest() == check['sha256']
(evidence / 'normal-store-session.json').write_text(json.dumps(session, indent=2) + '\n')
tools = (evidence / 'normal-tools.mjs').read_text().replace('normal-session.json', 'normal-store-session.json').replace('9238', '9240').replace("'app.log'", "'store-app.log'")
(evidence / 'normal-store-tools.mjs').write_text(tools)
client = (evidence / 'normal-client.mjs').read_text().replace("'./normal-tools.mjs'", "'./normal-store-tools.mjs'")
(evidence / 'normal-store-client.mjs').write_text(client)
driver = (evidence / 'normal-driver/index.cjs').read_text()
old_guard = "if(roots.length!==1||fs.realpathSync(roots[0].uri.fsPath)!==fs.realpathSync(workspace))throw new Error('Only the audit fixture workspace is allowed');"
assert old_guard in driver
driver = driver.replace(old_guard, "if(roots.length!==0||vscode.workspace.workspaceFile)throw new Error('Only no-folder store audit windows are allowed');")
anchor = " const server=http.createServer(async(req,res)=>{"
assert anchor in driver
driver = driver.replace(anchor, " const storeAudit=require('./store-audit-api.cjs')(context,runDir,log);\n" + anchor)
anchor = "   if(req.url==='/open'){"
assert anchor in driver
driver = driver.replace(anchor, "   if(req.url==='/store-audit')return reply(200,await storeAudit(q));\n" + anchor)
artifact_driver = evidence / 'normal-store-driver'
artifact_driver.mkdir(exist_ok=True)
(artifact_driver / 'index.cjs').write_text(driver)
(artifact_driver / 'store-audit-api.cjs').write_bytes((evidence / 'store-audit-api.cjs').read_bytes())
actual_driver = Path(session['driverPath'])
for name in ['index.cjs', 'store-audit-api.cjs']:
    (actual_driver / name).write_bytes((artifact_driver / name).read_bytes())
print(json.dumps({'profile': str(profile), 'extensionsDir': session['extensionsDir'], 'productArtifactsVerified': len(session['files']), 'preparedOnly': True}))
