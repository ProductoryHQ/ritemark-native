"""Recheck captured graph models and record source history/resource counterevidence."""
import base64
import json
from pathlib import Path
import subprocess
import urllib.parse
import xml.etree.ElementTree as ET
import zlib

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
def save(name, value):
    (evidence / name).write_text(json.dumps(value, indent=2) + '\n')
def git(*args):
    return subprocess.check_output(['git', *args], cwd=root, text=True)

source = json.loads((evidence / 'formats-drawio-conflict-probe.json').read_text())
steps = []
for step in source['steps']:
    if 'disk' not in step:
        continue
    svg = ET.fromstring(step['disk']['text'])
    mxfile = ET.fromstring(svg.attrib['content'])
    diagram = mxfile.find('diagram')
    graph = list(diagram)[0] if len(diagram) else ET.fromstring(
        urllib.parse.unquote(zlib.decompress(base64.b64decode(diagram.text), -15).decode()))
    steps.append({'stage': step['stage'], 'svgSha256': step['disk']['sha256'],
                  'cells': [{'id': c.attrib['id'], 'value': c.attrib.get('value')} for c in graph.iter('mxCell')]})
external = next(s for s in steps if s['stage'] == 'external-disk-and-host-updated')
saved = next(s for s in steps if s['stage'] == 'production-autosave')
assert any(c['id'] == 'external-cell' for c in external['cells'])
assert not any(c['id'] == 'external-cell' for c in saved['cells'])
save('formats-drawio-model-check.json', {
    'method': 'Parse actual SVG content attribute and decode compressed mxfile payload; compare embedded graph cell IDs, not absent literal text in compressed bytes.',
    'steps': steps, 'externalGraphCellLost': True})

app = 'extensions/ritemark/webview/src/App.tsx'
parent = git('rev-parse', 'c0343a92^').strip()
old = git('show', parent + ':' + app).splitlines()
save('formats-history.json', {
    'baseline': git('rev-parse', 'HEAD').strip(),
    'fileChangedHistory': git('log', '-6', '--format=%H %ad %s', '--date=short', '-SfileChanged', '--', app).splitlines(),
    'drawioHistory': git('log', '-5', '--format=%H %ad %s', '--date=short', '--', 'extensions/ritemark/src/drawioEditorProvider.ts').splitlines(),
    'preSyncChangeCommit': parent,
    'preSyncViewerRoutes': [{'line': n + 1, 'source': old[n]} for n in range(561, 583)],
    'preSyncHeaderConsumer': [{'line': n + 1, 'source': old[n]} for n in range(610, 626)],
    'interpretation': 'The shared fileChanged case was removed in c0343a92. The earlier PDF/DOCX early-return branches already did not receive the header change flag. This history does not prove that the current preview defect began in that synchronization commit.'})

pages = json.loads((evidence / 'formats-pdf-pages-probe.json').read_text())
first = next(s for s in pages['samples'] if s['stage'] == 'first-page')
last = next(s for s in pages['samples'] if s['stage'] == 'returned-to-first')
before = {p['pid']: p for p in first['processes']}
delta = []
for process in last['processes']:
    prior = before.get(process['pid'])
    if prior and prior['command'] == process['command']:
        delta.append({'pid': process['pid'], 'deltaRssKiB': process['rssKiB'] - prior['rssKiB'],
                      'beforeRssKiB': prior['rssKiB'], 'afterRssKiB': process['rssKiB'],
                      'kind': 'GPU' if '--type=gpu-process' in process['command'] else 'renderer' if '--type=renderer' in process['command'] else 'other'})
save('formats-pdf-resource-analysis.json', {
    'method': 'Compare captured first-page and returned-to-first snapshots for the same PID and command. RSS is not unique physical memory; short observation is not a distribution or leak test.',
    'fixtureBytes': pages['fixtureBytes'], 'initialCanvasCount': first['dom']['canvasCount'],
    'retainedCanvasCount': last['dom']['canvasCount'], 'rgbaSurfaceBytesCalculated': last['dom']['rgbaSurfaceBytes'],
    'initialJsHeapUsed': first['heap']['usedSize'], 'returnedJsHeapUsed': last['heap']['usedSize'],
    'sameProcessRssDeltas': sorted(delta, key=lambda p: p['deltaRssKiB'], reverse=True),
    'interpretation': 'Twenty canvases remain after all pages are visited. The sample does not demonstrate a matching RSS or JS-heap increase; the calculated RGBA surface size must not be reported as measured memory allocation. Profile browser/GPU accounting and target hardware before selecting a cache budget.'})
print(json.dumps({'graphCellLossVerified': True, 'historyRecorded': True, 'retainedCanvases': last['dom']['canvasCount']}))
