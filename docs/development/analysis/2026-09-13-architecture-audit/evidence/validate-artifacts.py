"""Validate audit artifact syntax/links; does not certify audit conclusions."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

evidence = Path(__file__).resolve().parent
audit = evidence.parent
root = audit.parents[3]
errors = []
checked = []
for file in sorted(audit.rglob('*')):
    if not file.is_file() or file.suffix not in {'.md', '.json', '.py', '.cjs', '.mjs'}:
        continue
    if file.name == 'artifact-checks.json':
        continue
    checked.append(str(file.relative_to(audit)))
    content = file.read_text()
    if file.suffix == '.json':
        try:
            json.loads(content)
        except ValueError as error:
            errors.append(f'{file.name}: {error}')
    if file.suffix == '.md':
        for target in re.findall(r'\]\(([^)]+)\)', content):
            if '://' in target or target.startswith('#'):
                continue
            if not (file.parent / target.split('#')[0]).exists():
                errors.append(f'{file.name}: broken link {target}')
    result = subprocess.run(
        ['git', 'diff', '--no-index', '--check', '/dev/null', str(file)],
        capture_output=True, text=True, check=False,
    )
    if result.returncode > 1 or result.stdout or result.stderr:
        errors.append(f'{file.name}: {result.stdout}{result.stderr}')

tracked = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD'], cwd=root, text=True).splitlines()
if tracked:
    errors.append(f'Tracked product changes exist: {tracked}')
report = {
    'method': 'JSON parsing, relative Markdown file links, whitespace checks of untracked audit files, and tracked product diff; not semantic proof of findings or live behavior.',
    'baseline': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'checkedFiles': checked,
    'trackedProductChanges': tracked,
    'webviewSha256': hashlib.sha256((root / 'extensions/ritemark/media/webview.js').read_bytes()).hexdigest(),
    'errors': errors,
}
(evidence / 'artifact-checks.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'checkedFiles': len(checked), 'errors': errors}, indent=2))
raise SystemExit(bool(errors))
