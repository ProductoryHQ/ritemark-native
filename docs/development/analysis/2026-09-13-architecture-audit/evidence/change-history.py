#!/usr/bin/env python3
"""Inventory committed change concentration and co-change; no source edits."""
from collections import Counter, defaultdict
from itertools import combinations
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
raw = subprocess.check_output([
    'git', 'log', '--no-merges', '--since=2026-06-01',
    '--format=%x1e%H%x1f%ad%x1f%s', '--date=short', '--numstat', 'HEAD', '--',
    'extensions/ritemark/src', 'extensions/ritemark/webview/src', 'patches/vscode', 'scripts',
], cwd=ROOT).decode()
commits = []
touches, additions, deletions, pair_count = Counter(), Counter(), Counter(), Counter()
recent = defaultdict(list)
for chunk in raw.split('\x1e'):
    lines = chunk.strip().splitlines()
    if not lines:
        continue
    commit, date, subject = lines[0].split('\x1f', 2)
    changes = []
    for line in lines[1:]:
        if not line or '\t' not in line:
            continue
        added, removed, file = line.split('\t', 2)
        if not file.endswith(('.ts', '.tsx', '.patch', '.sh', '.mjs', '.ps1')) or '.test.' in file:
            continue
        changes.append(file)
        touches[file] += 1
        additions[file] += int(added) if added.isdigit() else 0
        deletions[file] += int(removed) if removed.isdigit() else 0
        if len(recent[file]) < 8:
            recent[file].append({'commit': commit, 'date': date, 'subject': subject})
    if 1 < len(changes) <= 20:
        pair_count.update(combinations(sorted(set(changes)), 2))
    commits.append({'commit': commit, 'date': date, 'subject': subject, 'files': changes})
result = {
    'baseline': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(),
    'since': '2026-06-01',
    'method': 'Non-merge commits reachable from pinned HEAD; source/script/patch files; .test files excluded. Co-change counts only commits with 2–20 selected files to reduce broad sweep distortion. Co-change is association, not proof of required coupling. Renames remain Git numstat labels.',
    'commitCount': len(commits),
    'hotspots': [{'path': file, 'commits': count, 'added': additions[file], 'deleted': deletions[file], 'recent': recent[file]} for file, count in touches.most_common(30)],
    'coChanges': [{'a': pair[0], 'b': pair[1], 'commits': count} for pair, count in pair_count.most_common(30)],
    'commits': commits,
}
Path(__file__).with_name('change-history.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'commitCount': result['commitCount'], 'hotspots': [{k:v for k,v in h.items() if k!='recent'} for h in result['hotspots'][:12]], 'coChanges': result['coChanges'][:8]}, indent=2))
