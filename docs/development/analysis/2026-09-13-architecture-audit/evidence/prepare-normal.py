"""Stage byte-identical extension content for a normal-mode audit launch. No app starts."""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile

evidence=Path(__file__).resolve().parent
root=evidence.parents[4]
run=Path(tempfile.mkdtemp(prefix='ritemark-audit-normal-',dir='/private/tmp'))
for rel in ['profile/User','workspace','extensions','endpoints','events']:(run/rel).mkdir(parents=True,exist_ok=True)
source=root/'extensions/ritemark'
extension=run/'extensions/ritemark.ritemark-1.10.1'
driver=run/'extensions/ritemark-audit.ritemark-architecture-normal-driver-0.0.1'
subprocess.run(['/bin/cp','-cR',str(source),str(extension)],check=True)
subprocess.run(['/bin/cp','-cR',str(evidence/'normal-driver'),str(driver)],check=True)
files={}
for rel in ['package.json','out/extension.js','media/webview.js','media/webview.css','binaries/agents/manifest.json']:
 a=source/rel;b=extension/rel
 if not a.exists():continue
 digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 assert digest(a)==digest(b),rel
 assert a.stat().st_ino!=b.stat().st_ino,rel
 files[rel]={'bytes':a.stat().st_size,'sha256':digest(a)}
settings=json.loads((evidence/'live-session-first-launch.json').read_text())['settings']
(run/'profile/User/settings.json').write_text(json.dumps(settings,indent=2)+'\n')
(run/'workspace/note.md').write_text('# Normal mode audit\n\nUnsaved recovery baseline.\n')
(run/'workspace/shared.md').write_text('# Shared audit document\n\nTwo-window baseline.\n')
(run/'workspace/table.csv').write_text('item,value\nalpha,baseline\n')
subprocess.run(['/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node','-e',"const x=require(process.argv[1]);const b=x.utils.book_new();x.utils.book_append_sheet(b,x.utils.aoa_to_sheet([['item','value'],['alpha','baseline']]),'Sheet1');x.writeFile(b,process.argv[2]);",str(source/'node_modules/xlsx'),str(run/'workspace/book.xlsx')],check=True)
(run/'second.code-workspace').write_text(json.dumps({'folders':[{'path':str(run/'workspace')}],'settings':{}},indent=2)+'\n')
record={'method':'Independent APFS directory clone of the audit extension, loaded through an isolated --extensions-dir with no extensionDevelopmentPath. Package version and executable code bytes unchanged; not a new release build.','runDir':str(run),'profile':str(run/'profile'),'workspace':str(run/'workspace'),'extensionsDir':str(run/'extensions'),'extensionPath':str(extension),'driverPath':str(driver),'files':files,'settings':settings,'preparedOnly':True,'args':['/Applications/Ritemark.app/Contents/MacOS/Ritemark','--new-window','--user-data-dir='+str(run/'profile'),'--extensions-dir='+str(run/'extensions'),'--remote-debugging-port=9238','--disable-telemetry','--disable-workspace-trust','--skip-welcome','--skip-release-notes',str(run/'workspace')]}
(evidence/'normal-session.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'runDir':str(run),'checkedBytes':files,'preparedOnly':True},indent=2))
