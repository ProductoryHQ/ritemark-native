#!/usr/bin/env python3
"""Remove the saving person's name from Office files before they are committed.

    python3 scrub-metadata.py <file.pptx|.docx|.xlsx>...

Word and PowerPoint write the user's name into docProps/core.xml (`dc:creator`,
`cp:lastModifiedBy`) when they save a file. The corpus is public, so the ground-truth
scripts run this on what Word or PowerPoint saved. Only core.xml changes; every other
part keeps its bytes (it is recompressed), so rendering is unaffected. Do not run it on
a failure fixture that lies about its sizes: rewriting the archive would repair the lie.
"""
import re
import sys
import zipfile
from pathlib import Path

NAME = 'Ritemark corpus'
FIELDS = re.compile(r'<(dc:creator|cp:lastModifiedBy)>[^<]*</\1>')


def scrub(path: Path) -> bool:
    with zipfile.ZipFile(path) as src:
        if 'docProps/core.xml' not in src.namelist():
            return False
        core = src.read('docProps/core.xml').decode('utf-8')
        cleaned = FIELDS.sub(lambda m: f'<{m.group(1)}>{NAME}</{m.group(1)}>', core)
        if cleaned == core:
            return False
        entries = [(info, src.read(info.filename)) for info in src.infolist()]
    tmp = path.with_suffix(path.suffix + '.tmp')
    with zipfile.ZipFile(tmp, 'w') as dst:
        for info, data in entries:
            if info.filename == 'docProps/core.xml':
                data = cleaned.encode('utf-8')
            out = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            out.compress_type = info.compress_type
            out.external_attr = info.external_attr
            dst.writestr(out, data)
    tmp.replace(path)
    return True


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        print(('scrubbed ' if scrub(Path(arg)) else 'unchanged ') + arg)
