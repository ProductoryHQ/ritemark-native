"""Prepare a synthetic profile/workspace; does not launch or modify user data."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
run = Path(tempfile.mkdtemp(prefix='ritemark-audit-live-', dir='/private/tmp'))
profile = run / 'profile'
workspace = run / 'workspace'
(profile / 'User').mkdir(parents=True)
workspace.mkdir()
(run / 'extensions').mkdir()
settings = {
    'ritemark.analytics.enabled': False,
    'ritemark.features.analytics': False,
    'ritemark.updates.enabled': False,
    'ritemark.features.scheduled-flow-runs': False,
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none',
    'extensions.autoUpdate': False,
    'extensions.autoCheckUpdates': False,
    'workbench.startupEditor': 'none',
    'files.autoSave': 'off',
    'terminal.integrated.profiles.osx': {'Audit Bash': {'path':'/bin/bash','args':['--noprofile','--norc']}},
    'terminal.integrated.defaultProfile.osx': 'Audit Bash',
}
(profile / 'User/settings.json').write_text(json.dumps(settings,indent=2)+'\n')
(workspace / 'note.md').write_text('# Audit note\n\nBaseline paragraph.\n\nStable selection area.\n')
(workspace / 'second.md').write_text('# Second audit document\n\nIndependent document.\n')
(workspace / 'table.csv').write_text('item,value\nalpha,baseline\nbeta,2\n')
# Use the actual locked SheetJS dependency to create a real editable XLSX fixture.
subprocess.run([
    '/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node', '-e',
    "const x=require(process.argv[1]);const b=x.utils.book_new();x.utils.book_append_sheet(b,x.utils.aoa_to_sheet([['item','value'],['alpha','baseline']]),'Sheet1');x.writeFile(b,process.argv[2]);",
    str(root / 'extensions/ritemark/node_modules/xlsx'), str(workspace / 'book.xlsx'),
],check=True)
args = [
    '/Applications/Ritemark.app/Contents/MacOS/Ritemark',
    '--new-window', '--user-data-dir='+str(profile), '--extensions-dir='+str(run/'extensions'),
    '--extensionDevelopmentPath='+str(root/'extensions/ritemark'),
    '--extensionDevelopmentPath='+str(evidence/'live-driver'),
    '--remote-debugging-port=9237', '--disable-telemetry', '--disable-workspace-trust',
    '--skip-welcome', '--skip-release-notes', str(workspace),
]
record = {'runDir':str(run),'workspace':str(workspace),'profile':str(profile),'args':args,'preparedOnly':True,'settings':settings,'fixtureSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in workspace.iterdir()}}
(evidence/'live-session.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'runDir':str(run),'fixtureFiles':list(record['fixtureSha256'])},indent=2))
