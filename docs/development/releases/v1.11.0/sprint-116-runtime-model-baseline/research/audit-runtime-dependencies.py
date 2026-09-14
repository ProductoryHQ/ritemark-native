"""Static dependency inventory of the already verified candidate artifacts.

This does not prove runtime download behavior or clean-machine completeness.
Run from the dedicated sprint worktree; product inputs remain unchanged.
"""
import datetime
import json
import pathlib
import re
import subprocess
import tarfile

evidence = pathlib.Path(__file__).resolve().parent / 'evidence'
audit_root = pathlib.Path(json.loads((evidence / 'audit-environment.json').read_text())['auditRoot'])
manifest = json.loads((evidence / 'candidate-manifest.json').read_text())
rows = []
for component in manifest['runtimes']:
    target = f"{component['platform']}-{component['arch']}"
    row = {'component': f"{component['agent']}/{component['component']}/{target}", 'version': component['version']}
    with tarfile.open(audit_root / 'downloads' / component['archiveFilename']) as archive:
        row['archiveMembers'] = [{'path': member.name, 'type': 'file' if member.isfile() else 'link' if member.issym() or member.islnk() else 'other'} for member in archive.getmembers()]
        row['packageMetadata'] = []
        for member in archive.getmembers():
            if member.isfile() and member.name in ('package/package.json', './package/package.json'):
                package = json.load(archive.extractfile(member))
                row['packageMetadata'].append({key: package.get(key) for key in ('name', 'version', 'dependencies', 'optionalDependencies', 'peerDependencies', 'scripts')})
    binary = audit_root / 'binaries' / target / component['installName']
    if component['platform'] == 'darwin':
        output = subprocess.check_output(['otool', '-L', str(binary)], text=True, timeout=30)
        row['linkedLibraries'] = [line.strip().split(' (compatibility version')[0] for line in output.splitlines()[1:] if line.strip()]
        row['nonSystemInstallNames'] = [name for name in row['linkedLibraries'] if not name.startswith(('/usr/lib/', '/System/Library/'))]
    else:
        output = subprocess.check_output(['xcrun', 'llvm-objdump', '-p', str(binary)], text=True, timeout=30)
        row['importedDlls'] = re.findall(r'DLL Name:\s*(\S+)', output)
        row['delayImportDirectory'] = next((line.strip() for line in output.splitlines() if 'Delay Import Directory' in line), None)
    rows.append(row)

result = {
    'capturedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'status': 'STATIC_INVENTORY_ONLY',
    'components': rows,
    'remaining': ['Independent upstream component/dependency discovery beyond existing manifest', 'Lazy downloads and spawned tools in clean staged runtime', 'Native Windows and Intel behavior with default sandbox', 'No accidental dependency on developer PATH, node_modules, SDK caches or preinstalled tools'],
}
(evidence / 'runtime-dependency-inventory.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'components': len(rows), 'macNonSystemInstallNames': {row['component']: row['nonSystemInstallNames'] for row in rows if row.get('nonSystemInstallNames')}, 'windowsDlls': sorted(set(dll for row in rows for dll in row.get('importedDlls', [])))}))
