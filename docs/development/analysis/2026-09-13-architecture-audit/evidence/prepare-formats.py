"""Prepare an isolated normal-mode application and synthetic format fixtures."""
from pathlib import Path
import hashlib
import html
import json
import subprocess
import sys
import tempfile

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
run = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.mkdtemp(prefix='ritemark-audit-formats-', dir='/private/tmp'))
assert str(run).startswith('/private/tmp/ritemark-audit-formats-')
assert not (run / 'app.log').exists(), 'Never prepare over a launched profile'
for rel in ['profile/User', 'workspace', 'variants', 'extensions', 'endpoints', 'events']:
    (run / rel).mkdir(parents=True, exist_ok=True)
source = root / 'extensions/ritemark'
extension = run / 'extensions/ritemark.ritemark-1.10.1'
driver = run / 'extensions/ritemark-audit.ritemark-architecture-formats-driver-0.0.1'
if not extension.exists():
    subprocess.run(['/bin/cp', '-cR', str(source), str(extension)], check=True)
driver.mkdir(exist_ok=True)
manifest = json.loads((evidence / 'normal-driver/package.json').read_text())
manifest['name'] = manifest['name'].replace('normal', 'formats')
manifest['displayName'] = 'Ritemark architecture format audit observer'
(driver / 'package.json').write_text(json.dumps(manifest, indent=2) + '\n')
script = (evidence / 'normal-driver/index.cjs').read_text().replace('RITEMARK_AUDIT_NORMAL_RUN_DIR', 'RITEMARK_AUDIT_FORMATS_RUN_DIR').replace('ritemark-audit-normal-', 'ritemark-audit-formats-')
script = script.replace("['note.md','shared.md','table.csv','book.xlsx']", "['note.md','diagram.drawio.svg','sample.pdf','sample.docx']")
script = script.replace("q.file.endsWith('.xlsx')?'ritemark.excelViewer':'ritemark.editor'", "q.file.endsWith('.drawio.svg')?'ritemark.drawioEditor':q.file.endsWith('.pdf')?'ritemark.pdfViewer':q.file.endsWith('.docx')?'ritemark.docxViewer':'ritemark.editor'")
(driver / 'index.cjs').write_text(script)
(evidence / 'formats-driver').mkdir(exist_ok=True)
for name in ['index.cjs', 'package.json']:
    (evidence / 'formats-driver' / name).write_bytes((driver / name).read_bytes())
for name in ['tools.mjs', 'client.mjs']:
    script = (evidence / ('normal-' + name)).read_text().replace('normal-', 'formats-').replace('NORMAL_', 'FORMATS_').replace('9238', '9239')
    (evidence / ('formats-' + name)).write_text(script)

digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = {}
for rel in ['package.json', 'out/extension.js', 'media/webview.js', 'media/pdf.worker.min.mjs', 'media/drawio/index.html', 'binaries/agents/manifest.json']:
    a, b = source / rel, extension / rel
    assert digest(a) == digest(b), rel
    assert a.stat().st_ino != b.stat().st_ino, rel
    files[rel] = {'bytes': a.stat().st_size, 'sha256': digest(a)}
settings = json.loads((evidence / 'live-session-first-launch.json').read_text())['settings']
(run / 'profile/User/settings.json').write_text(json.dumps(settings, indent=2) + '\n')
(run / 'workspace/note.md').write_text('# Format audit\n\nSynthetic workspace only.\n')

for variant in ['BASE', 'EXTERNAL']:
    marker = 'AUDIT ' + variant
    mx = '<mxfile><diagram name="Page-1"><mxGraphModel dx="900" dy="700" grid="1" gridSize="10" page="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="audit-cell" value="' + marker + '" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="100" y="100" width="180" height="70" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>'
    svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="90" content="' + html.escape(mx, quote=True) + '"><rect x="1" y="1" width="180" height="70" fill="#dae8fc"/><text x="12" y="40">' + marker + '</text></svg>\n'
    (run / 'variants' / (variant.lower() + '.drawio.svg')).write_text(svg)
(run / 'workspace/diagram.drawio.svg').write_bytes((run / 'variants/base.drawio.svg').read_bytes())
subprocess.run(['/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node', str(evidence / 'make-format-fixtures.cjs'), str(run)], check=True)

record = {'method': 'Independent APFS clone of unchanged audit extension, synthetic normal-mode profile, format-specific observer and deterministic local fixtures. No release rebuild.', 'runDir': str(run), 'profile': str(run / 'profile'), 'workspace': str(run / 'workspace'), 'extensionsDir': str(run / 'extensions'), 'extensionPath': str(extension), 'driverPath': str(driver), 'files': files, 'settings': settings, 'fixtureFiles': {str(p.relative_to(run)): {'bytes': p.stat().st_size, 'sha256': digest(p)} for folder in ['workspace', 'variants'] for p in (run / folder).iterdir() if p.is_file()}, 'preparedOnly': True, 'args': ['/Applications/Ritemark.app/Contents/MacOS/Ritemark', '--new-window', '--user-data-dir=' + str(run / 'profile'), '--extensions-dir=' + str(run / 'extensions'), '--remote-debugging-port=9239', '--disable-telemetry', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', str(run / 'workspace')]}
(evidence / 'formats-session.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'runDir': str(run), 'checkedFiles': len(files), 'fixtureFiles': record['fixtureFiles'], 'preparedOnly': True}, indent=2))
