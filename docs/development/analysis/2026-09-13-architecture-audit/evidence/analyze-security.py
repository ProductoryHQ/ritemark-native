"""Check recorded A08 comparisons and capture source context; does not rerun GUI."""
from pathlib import Path
import ast
import hashlib
import json
import subprocess

evidence = Path(__file__).resolve().parent
root = evidence.parents[4]
result = json.loads((evidence / 'formats-security-probe.json').read_text())
cleanup = json.loads((evidence / 'formats-security-cleanup-probe.json').read_text())
assert result['completed'] and not result.get('error') and not result.get('fixtureCleanupError')
steps = {step['name']: step for step in result['steps']}
before, after, restored = [steps[key]['view'] for key in ['baseline', 'assistant-html', 'restored-content']]
assert before['userMarkupDisplayedAsText'] and not before['userStyleElementExists']
assert all(before['richMarkdown'].values()) and all(restored['richMarkdown'].values())
assert not before['stylesInContent'] and after['stylesInContent'] and not restored['stylesInContent']
for control in ['approve', 'reject', 'composer']:
    field = 'background' if control == 'composer' else 'outline'
    assert not after[control]['insideRenderedMarkdown']
    assert after[control][field] != before[control][field]
    assert restored[control][field] == before[control][field]
assert after['httpsImage']['naturalWidth'] == after['httpsImage']['naturalHeight'] == 1
assert len(result['interceptions']) == 1
assert result['interceptions'][0]['response'] == 'local PNG; Fetch request-stage fulfillment'
assert not after['inlineHandlerRan'] and not after['inlineErrorRan']
assert len(after['violations']) == 2
assert all(v['effectiveDirective'] == 'script-src-attr' and v['disposition'] == 'enforce' for v in after['violations'])
assert steps['baseline']['shell'] == steps['assistant-html']['shell'] == steps['restored-content']['shell']
assert cleanup['completed'] and cleanup['cdpPortClosed'] and not cleanup['remaining']
assert cleanup['pid'] == 4404 and len(cleanup['before']) == 12

sources = {}
for rel, ranges in {
    'extensions/ritemark/webview/src/components/ai-sidebar/RenderedMarkdown.tsx': [(13, 33), (68, 74)],
    'extensions/ritemark/webview/src/components/ai-sidebar/ChatBubbles.tsx': [(60, 84)],
    'extensions/ritemark/webview/src/components/ai-sidebar/CodexView.tsx': [(175, 204), (233, 239), (445, 457)],
    'extensions/ritemark/webview/src/components/ai-sidebar/AgentResponse.tsx': [(255, 270)],
    'extensions/ritemark/src/views/UnifiedViewProvider.ts': [(785, 797), (814, 823), (2218, 2228)],
}.items():
    lines = (root / rel).read_text().splitlines()
    sources[rel] = {
        'sha256': hashlib.sha256((root / rel).read_bytes()).hexdigest(),
        'excerpts': [{'start': start, 'end': end, 'lines': lines[start - 1:end]} for start, end in ranges],
        'recentPathHistory': subprocess.check_output(
            ['git', 'log', '-4', '--format=%H %aI %s', '--', rel], cwd=root, text=True).splitlines(),
    }
checks = []
for name in ['formats-security-probe.mjs', 'formats-security-cleanup-probe.mjs']:
    p = subprocess.run(['/Users/jarmotuisk/.nvm/versions/node/v22.22.1/bin/node', '--check', str(evidence / name)], capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    checks.append({'file': name, 'nodeCheckExitCode': p.returncode})
ast.parse(Path(__file__).read_text())
host_events = [json.loads(line) for line in (evidence / 'formats-security-driver-events-4637.jsonl').read_text().splitlines()]
assert all(event['hostPid'] == 4637 for event in host_events)
record = {
    'method': 'Verify recorded before/after/restoration and cleanup evidence; capture source/history and harness syntax. Does not replay GUI or claim native-agent delivery.',
    'baseline': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'comparisonsPassed': True,
    'sourceContext': sources,
    'historyLimit': 'Recent path history establishes provenance only, not the first vulnerable commit or regression cause.',
    'syntaxChecks': checks,
    'pythonAstCheck': 'passed',
    'currentSecurityHostEvents': len(host_events),
    'screenshots': {name: hashlib.sha256((evidence / name).read_bytes()).hexdigest() for name in ['formats-security-baseline.png', 'formats-security-styled-controls.png']},
    'stoppedProcesses': len(cleanup['before']),
}
(evidence / 'security-analysis.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps({'comparisonsPassed': True, 'sourceFiles': len(sources), 'syntaxChecks': len(checks), 'hostEvents': len(host_events), 'stoppedProcesses': len(cleanup['before'])}))
