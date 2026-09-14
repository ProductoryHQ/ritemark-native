"""Correlate actual host storage interleavings, controls, view finish and restart."""
from pathlib import Path
import ast
import hashlib
import json
import subprocess

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
read = lambda name: json.loads((evidence / name).read_text())
main = read('normal-store-probe.json')
finish = read('normal-store-view-finish-probe.json')
restart = read('normal-store-restart-probe.json')
stop_before = read('normal-store-stop-before-restart.json')
stop_final = read('normal-store-final-cleanup.json')
restoration = read('normal-store-observer-restoration.json')
steps = {step['name']: step for step in main['steps']}
assert len(steps) == 12
assert main['error'].startswith('Error: Matching normal-mode webview not found:')
assert finish['completed'] and restart['completed']
authorities = steps['two-hosts-same-authority']['inspectors']
assert authorities[0]['scope'] == authorities[1]['scope']
assert authorities[0]['scope']['descriptor']['kind'] == 'no-folder'
assert authorities[0]['baseDir'] == authorities[1]['baseDir']
assert authorities[0]['hostPid'] != authorities[1]['hostPid']
assert all(h['runtimeSessionCount'] == 0 and h['productModuleCached'] for h in authorities)
for stage in ['sequential-two-host-control', 'one-host-concurrent-control']:
    record = steps[stage]['disk']
    assert record['revision'] == 3
    assert record['composerPreferences']['thinkingEffortByRuntime'] == {'codex': 'high', 'claude-code': 'low'}
assert not steps['one-host-first-write-held']['secondRequestSettled']
assert steps['one-host-first-write-held']['disk']['revision'] == 1
for inspector in steps['two-host-preferences-both-prepared']['inspectors']:
    assert inspector['interception']['candidate']['revision'] == 2
lost_preference = steps['two-host-preference-update-lost']
assert all(response['response']['ok'] and response['response']['data']['conversation']['revision'] == 2 for response in lost_preference['responses'])
assert lost_preference['disk']['composerPreferences']['thinkingEffortByRuntime'] == {'claude-code': 'low'}
saved = steps['assistant-result-acknowledged-and-on-disk']
lost = steps['acknowledged-result-lost']
assert saved['response']['record'] == saved['disk']
assert saved['disk']['revision'] == lost['disk']['revision'] == 2
assert len(saved['disk']['events']) == 2 and len(lost['disk']['events']) == 1
assert saved['disk']['lifecycle']['state'] == 'idle' and lost['disk']['lifecycle']['state'] == 'working'
assert lost['response']['response']['ok']
assert not any(e['kind'] == 'assistant-message' for e in lost['disk']['events'])
for r in steps['both-real-controllers-read-lost-result']['readbacks']:
    assert r['response']['ok'] and len(r['response']['data']['conversation']['events']) == 1
assert len(finish['views']) == 2
assert len({view['receivedRequestId'] for view in finish['views']}) == 2
assert all(view['userPromptVisible'] and not view['assistantResultVisible'] for view in finish['views'])
assert all(h['runtimeSessionCount'] == 0 for h in finish['endInspectors'])
assert restart['pid'] != restart['previousPid']
assert restart['view']['userPromptVisible'] and not restart['view']['assistantResultVisible']
for host in restart['readbacks']:
    assert host['inspector']['runtimeSessionCount'] == 0 and host['inspector']['interception'] is None
    assert len(host['records'][3]['events']) == 1
for stop in [stop_before, stop_final]:
    assert stop['completed'] and stop['cdpPortClosed'] and not stop['remaining']
    assert len(stop['recordAfterStop']['events']) == 1
assert restoration['originalDriverRestored'] and restoration['helperRemoved']

release_observations = []
event_records = 0
for name in stop_before['eventFiles'] + stop_final['eventFiles']:
    events = [json.loads(line) for line in (evidence / name).read_text().splitlines()]
    event_records += len(events)
    held = {}
    for event in events:
        if event['event'] == 'store-audit-rename-held':
            held[event['conversationId']] = event
        if event['event'] == 'store-audit-rename-released':
            start = held.pop(event['conversationId'])
            assert event['reason'] == 'explicit-release'
            release_observations.append({'hostPid': event['hostPid'], 'conversationId': event['conversationId'], 'heldMs': event['at'] - start['at'], 'reason': event['reason']})
    assert not held
assert len(release_observations) == 5

sources = {}
for rel, ranges in {
    'extensions/ritemark/src/conversations/ConversationStore.ts': [(235, 272), (277, 328), (330, 378), (521, 526), (709, 713)],
    'extensions/ritemark/src/conversations/ConversationController.ts': [(143, 166), (453, 490), (768, 816)],
    'extensions/ritemark/src/conversations/projectScope.ts': [(40, 77)],
    'extensions/ritemark/src/views/UnifiedViewProvider.ts': [(203, 217), (824, 839), (2431, 2454)],
    'extensions/ritemark/webview/src/components/ai-sidebar/store.ts': [(1119, 1137)],
    'extensions/ritemark/webview/src/components/ai-sidebar/ThinkingEffortControl.tsx': [(90, 107), (154, 174), (189, 199)],
}.items():
    content = (root / rel).read_text().splitlines()
    sources[rel] = {'sha256': hashlib.sha256((root / rel).read_bytes()).hexdigest(), 'excerpts': [{'start': start, 'end': end, 'lines': content[start - 1:end]} for start, end in ranges], 'recentPathHistory': subprocess.check_output(['git', 'log', '-4', '--format=%H %aI %s', '--', rel], cwd=root, text=True).splitlines()}
checks = []
js_files = sorted(evidence.glob('normal-store-*.mjs')) + [evidence / 'store-audit-api.cjs', evidence / 'normal-store-driver/index.cjs', evidence / 'normal-store-driver/store-audit-api.cjs']
for file in js_files:
    result = subprocess.run(['/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node', '--check', str(file)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    checks.append({'file': str(file.relative_to(evidence)), 'nodeCheckExitCode': result.returncode})
for file in [evidence / 'prepare-store-probe.py', Path(__file__)]:
    ast.parse(file.read_text())
report = {
    'method': 'Correlate preserved host responses, real disk snapshots, controlled rename candidates, actual webview receipt IDs, new-process readbacks and cleanup. Source/history and syntax checks supplement, not replace, the application observations.',
    'baseline': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'storageComparisonsPassed': True,
    'mainProbePartialFailure': main['error'],
    'viewFollowupPassed': finish['completed'],
    'viewTimingLimit': 'The first projection was not observed during initial view opening. Its precise cause was not isolated; the follow-up method string mentioning hydration is descriptive timing context, not a proven product cause.',
    'restartPassed': restart['completed'],
    'nativeDispatchLimit': 'Actual cached host controller/store objects, but synthetic controller ingress and controlled rename timing. No live native model turn, natural race-frequency or ordinary UI gesture claim.',
    'releaseObservations': release_observations,
    'sourceContext': sources,
    'historyLimit': 'Recent path history records provenance; it does not establish the first vulnerable commit.',
    'syntaxChecks': checks,
    'pythonAstChecks': 2,
    'eventRecords': event_records,
    'stoppedProcessesPerLaunch': [len(stop_before['before']), len(stop_final['before'])],
    'screenshotSha256': hashlib.sha256((evidence / 'normal-store-lost-result.png').read_bytes()).hexdigest(),
}
(evidence / 'shared-store-analysis.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'storageComparisonsPassed': True, 'viewFollowupPassed': True, 'restartPassed': True, 'explicitlyReleasedBarriers': len(release_observations), 'jsChecks': len(checks), 'eventRecords': event_records}))
