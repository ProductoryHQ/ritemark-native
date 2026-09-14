"""Prepare one isolated performance profile using unchanged staged product bytes."""
from pathlib import Path
import hashlib
import json

evidence = Path(__file__).resolve().parent
original = json.loads((evidence / 'normal-session.json').read_text())
run = Path(original['runDir'])
assert str(run) == '/private/tmp/ritemark-audit-normal-bg5jgmun'
profile = run / 'performance-profile'
assert not profile.exists()
(profile / 'User').mkdir(parents=True)
(profile / 'User/settings.json').write_text(json.dumps(original['settings'], indent=2) + '\n')
session = {k: v for k, v in original.items() if k not in ['pid', 'launchedAt', 'launches', 'args']}
session.update(profile=str(profile), preparedOnly=True,
               method='Normal-mode actual Markdown webview loading. Instrumented renderer CPU/profile and coverage, fresh view per trial, warm app/OS cache. CPU throttling is a sensitivity experiment, not Windows emulation.')
session['args'] = [s.replace(original['profile'], str(profile)).replace('9238', '9243') for s in original['args']]
for rel, item in session['files'].items():
    assert hashlib.sha256((Path(session['extensionPath']) / rel).read_bytes()).hexdigest() == item['sha256']
assert (Path(session['driverPath']) / 'index.cjs').read_bytes() == (evidence / 'normal-driver/index.cjs').read_bytes()
session['fixture'] = {'name': 'note.md', 'bytes': (run / 'workspace/note.md').stat().st_size,
                      'sha256': hashlib.sha256((run / 'workspace/note.md').read_bytes()).hexdigest()}
(evidence / 'normal-performance-session.json').write_text(json.dumps(session, indent=2) + '\n')
(evidence / 'normal-performance-tools.mjs').write_text((evidence / 'normal-tools.mjs').read_text().replace('normal-session.json', 'normal-performance-session.json').replace('9238', '9243').replace("'app.log'", "'performance-app.log'"))
(evidence / 'normal-performance-client.mjs').write_text((evidence / 'normal-client.mjs').read_text().replace('./normal-tools.mjs', './normal-performance-tools.mjs'))
print(json.dumps({'profile': str(profile), 'productArtifactsVerified': len(session['files']), 'fixture': session['fixture']}))
