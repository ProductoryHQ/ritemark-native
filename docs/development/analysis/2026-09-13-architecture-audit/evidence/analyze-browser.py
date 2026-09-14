"""Correlate browser dispatcher results, DOM, real consent and cleanup."""
from pathlib import Path
import ast
import hashlib
import json
import subprocess

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
read = lambda name: json.loads((evidence / name).read_text())
probe = read('normal-browser-ownership-finish-probe.json')
initial = read('normal-browser-ownership-probe.json')
cleanup = read('normal-browser-cleanup-probe.json')
session = read('normal-browser-session.json')
assert probe['completed'] and not probe.get('error')
assert 'Condition not reached within 8000' in initial['error']
stages = {s['name']: s for s in probe['stages']}
value = lambda key: stages[key]['value']
first = value('initial')['inspection']
last = value('final-inspection')
assert first['runtimeSessionCount'] == last['runtimeSessionCount'] == 0
assert not first['acpManagerStarted'] and not last['acpManagerStarted']
url_a, url_b = first['urls']
for key in ['read-denied', 'read-denied-after-revoke']:
    text = value(key)['result']
    assert text.startswith('Error:') and 'URL:' not in text and 'Title:' not in text
assert not value('fresh-revoke')['after']['sharedWithAgent']
assert 'Allow AI to control this browser tab?' in value('control-deny-dialog')['text']
deny = value('control-denied')
assert deny['beforeDeny']['entry'] == deny['afterDeny']['entry']
assert deny['denied']['result'].startswith('Error:')
assert value('control-allowed')['dom']['entry'] == 'AUDIT CONTROL ALLOWED'
assert value('control-allowed')['inspection']['metadata']['sharedWithAgent']
assert 'Share this browser page with the agent?' in value('after-control-allow')['dialogs'][0]['text']
seen = value('caller-a-observed-a')
assert url_a in seen['result']['result'] and 'AUDIT PAGE A' in seen['result']['result']
wrong = value('caller-a-filled-b')
assert wrong['dom']['url'] == wrong['metadata']['url'] == url_b
assert wrong['dom']['title'] == wrong['metadata']['title'] == 'AUDIT PAGE B'
assert wrong['metadata']['pageId'] == seen['metadata']['pageId']
assert wrong['dom']['entry'] == 'AUDIT A INTENDED FOR A'
assert 'AUDIT A INTENDED FOR A' in wrong['result']['result'] and 'AUDIT PAGE B' in wrong['result']['result']
queue = value('queue-both-pending')
assert queue['click']['status'] == queue['navigate']['status'] == 'running'
assert not queue['dom']['lateExists'] and queue['dom']['url'] == url_a
serial = value('queue-serializes-actions')
assert serial['clicked']['finishedAt'] < serial['navigated']['finishedAt']
assert 'Delayed clicks: 1' in serial['clicked']['result'] and url_a in serial['clicked']['result']
assert serial['dom']['url'] == url_b
pending = value('pending-before-revoke')
assert pending['pendingJob']['status'] == 'running' and not pending['pendingDom']['lateExists']
revoked = value('revoke-during-pending')
assert revoked['before']['sharedWithAgent'] and not revoked['after']['sharedWithAgent']
assert not revoked['control']['visible']
end = value('pending-after-revoke')
assert 'not found' in end['pendingEnd']['result']
assert end['dom']['lateExists'] and end['dom']['lateClicks'] == 0
assert not end['metadata']['sharedWithAgent']
final_deny = value('control-denied-after-revoke')
assert final_deny['beforeFinal']['entry'] == final_deny['afterFinal']['entry']
assert url_a in final_deny['finalDenied']['result'] and 'Title: AUDIT PAGE A' in final_deny['finalDenied']['result']
assert cleanup['completed'] and cleanup['cdpPortClosed'] and not cleanup['remaining']
assert cleanup['observerRestored']['temporaryHelperRemoved']
assert len(cleanup['productHashes']) == 4
assert all(cleanup['productHashes'][rel] == expected['sha256'] for rel, expected in session['files'].items())
events = [json.loads(line) for name in cleanup['eventFiles'] for line in (evidence / name).read_text().splitlines()]
starts = {e['id']: e for e in events if e['event'] == 'browser-audit-job-start'}
ends = {e['id']: e for e in events if e['event'] == 'browser-audit-job-end'}
assert len(starts) == len(ends) == len(last['jobs']) == 15
for job in last['jobs']:
    assert job['status'] == 'completed'
    assert starts[job['id']]['startedAt'] == job['startedAt']
    assert ends[job['id']]['result'] == job['result'] and ends[job['id']]['finishedAt'] == job['finishedAt']

sources = {}
for rel, ranges in {
    'extensions/ritemark/src/browser/BrowserActionTools.ts': [(33, 62), (69, 96), (146, 164)],
    'extensions/ritemark/src/browser/BrowserContextStore.ts': [(108, 130), (164, 180)],
    'extensions/ritemark/src/acp/AcpRuntime.ts': [(524, 545)],
    'extensions/ritemark/webview/src/components/ai-sidebar/ChatInput.tsx': [(1099, 1112)],
    'patches/vscode/010-ritemark-browser-action-bridge.patch': [(239, 254), (278, 290), (337, 347), (429, 449), (670, 681)],
}.items():
    content = (root / rel).read_bytes()
    lines = content.decode().splitlines()
    sources[rel] = {'sha256': hashlib.sha256(content).hexdigest(), 'excerpts': [{'start': a, 'end': b, 'lines': lines[a-1:b]} for a, b in ranges]}
base = '10c8e557c8b9f9ed0a87f61f1c9a44bde731c409'
upstream = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserEditorChatFeatures.ts'
vscode = '/Users/jarmotuisk/Projects/ritemark-dev/ritemark-native/vscode'
content = subprocess.check_output(['git', 'show', f'{base}:{upstream}'], cwd=vscode, text=True)
upstream_context = {'gitlink': base, 'path': upstream, 'excerpts': [{'start': a, 'end': b, 'lines': content.splitlines()[a-1:b]} for a, b in [(162,166),(218,225),(254,259)]]}
checks = []
files = sorted(evidence.glob('normal-browser-*.mjs')) + [evidence/'browser-audit-api.cjs', evidence/'normal-browser-driver/index.cjs', evidence/'normal-browser-driver/browser-audit-api.cjs']
for file in files:
    r = subprocess.run(['/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node', '--check', str(file)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    checks.append({'file': str(file.relative_to(evidence)), 'nodeCheckExitCode': r.returncode})
for file in [evidence/'prepare-browser-probe.py', Path(__file__)]:
    ast.parse(file.read_text())
report = {
    'method': 'Correlate actual cached dispatcher jobs with host log, browser DOM, shell metadata, observed dialogs and verified cleanup. No new application test is run by this script.',
    'baseline': subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True).strip(),
    'syntheticCallerLimit': 'A/B labels are observer-only. Runtime session count zero; ACP manager never started. Not a native model turn or natural frequency measurement.',
    'initialProbePartialFailure': initial['error'],
    'initialConsentLimit': 'Job 1 and 3 consent grants were not observed; their DENIED payload names do not describe UI choices. Their actual successful outcomes are preserved.',
    'completedProbe': True,
    'readSnapshotDeniedWithoutMetadata': True,
    'observedControlDenyPreservedField': True,
    'observedControlAndReadGrantWorked': True,
    'sameTabTargetPreconditionMissing': True,
    'actionQueueControlPassed': True,
    'revocationCancelledPendingLocator': True,
    'deniedFillReturnedUrlAndTitleWhileReadShareFalse': True,
    'revocationUiLimit': 'Existing hidden toggle handler was invoked through CDP; ordinary visible user revocation was not demonstrated.',
    'visualChecks': {'normal-browser-deny-visible.png':'inspected, actual Control/Deny dialog', 'normal-browser-read-consent.png':'inspected, actual Share/Allow dialog', 'normal-browser-wrong-target.png':'inspected and excluded as page-state proof: workbench URL B but BrowserView surface still previous A; direct page DOM and ARIA are authoritative here'},
    'jobsCorrelated': len(starts),
    'eventRecords': len(events),
    'capturedOwnedProcessesStopped': len(cleanup['before']),
    'portClosed': cleanup['cdpPortClosed'],
    'originalObserverRestored': cleanup['observerRestored'],
    'productArtifactsUnchanged': len(cleanup['productHashes']),
    'sourceContext': sources,
    'upstreamUiContext': upstream_context,
    'queueHistory': subprocess.check_output(['git','log','-3','--format=%H %aI %s','--','extensions/ritemark/src/browser/BrowserActionTools.ts'],cwd=root,text=True).splitlines(),
    'syntaxChecks': checks,
    'pythonAstChecks': 2,
}
(evidence/'browser-analysis.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['completedProbe','jobsCorrelated','eventRecords','sameTabTargetPreconditionMissing','actionQueueControlPassed','revocationCancelledPendingLocator','deniedFillReturnedUrlAndTitleWhileReadShareFalse','capturedOwnedProcessesStopped','productArtifactsUnchanged']}))
