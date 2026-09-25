#!/usr/bin/env python3
"""Sprint 125 Phase 0: compare renderer captures with PowerPoint's slides.
Adapted from Sprint 124's compare.py.

    python3 compare.py <ppt-png-dir> <out-dir> <label>=<capture-dir> [<label>=<capture-dir> ...] [--sheets] [--prefix p]

PowerPoint slides come from `pdftoppm -r 96` (<name>-<n>.png, n unpadded or padded);
captures from capture-pptx.mjs (<name>-<nn>.png). Both are 1 px = 1/96 in (1280 x 720).

Per fixture and renderer:
  - slides: PowerPoint's count and the renderer's;
  - diff: mean absolute grey-level difference in percent over the slides both have, after
    scaling each slide to 200 px wide (as in Sprint 124). Lower is closer; coarse;
  - diff640: the same at 640 px wide, which is more sensitive to text position;
  - with --sheets, a JPEG per fixture: PowerPoint left, then each renderer (first 6 slides,
    or slides named by --slides 1,5,9).
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat

argv = [a for a in sys.argv[1:]]
sheets = '--sheets' in argv
prefix = ''
if '--prefix' in argv:
    prefix = argv[argv.index('--prefix') + 1]
    del argv[argv.index('--prefix'):argv.index('--prefix') + 2]
pick = None
if '--slides' in argv:
    pick = [int(x) for x in argv[argv.index('--slides') + 1].split(',')]
    del argv[argv.index('--slides'):argv.index('--slides') + 2]
argv = [a for a in argv if a != '--sheets']
ppt_dir, out_dir = Path(argv[0]), Path(argv[1])
caps = [(a.split('=', 1)[0], Path(a.split('=', 1)[1])) for a in argv[2:]]
out_dir.mkdir(parents=True, exist_ok=True)


def pages(directory, name):
    found = []
    for p in directory.glob(f'{name}-*.png'):
        m = re.fullmatch(re.escape(name) + r'-(\d+)\.png', p.name)
        if m:
            found.append((int(m.group(1)), p))
    return [p for _, p in sorted(found)]


def fit_to(img, size):
    canvas = Image.new('RGB', size, 'white')
    canvas.paste(img.crop((0, 0, min(img.width, size[0]), min(img.height, size[1]))), (0, 0))
    return canvas


def diff_percent(a, b, w=200):
    ga = ImageOps.grayscale(a).resize((w, round(a.height * w / a.width)))
    gb = ImageOps.grayscale(fit_to(b, a.size)).resize(ga.size)
    return ImageStat.Stat(ImageChops.difference(ga, gb)).mean[0] / 255 * 100


def label(img, text):
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
    except Exception:
        font = ImageFont.load_default()
    d.rectangle((0, 0, 12 + 12 * len(text), 30), fill=(30, 30, 30))
    d.text((6, 3), text, fill=(255, 255, 255), font=font)
    return img


results = []
names = sorted({re.sub(r'-\d+\.png$', '', p.name) for p in ppt_dir.glob('*.png')})
for name in names:
    pp = pages(ppt_dir, name)
    row = {'name': name, 'ppt_slides': len(pp)}
    for lab, d in caps:
        cp = pages(d, name)
        both = min(len(pp), len(cp))
        diffs, diffs640 = [], []
        for i in range(both):
            a, b = Image.open(pp[i]).convert('RGB'), Image.open(cp[i]).convert('RGB')
            diffs.append(diff_percent(a, b))
            diffs640.append(diff_percent(a, b, 640))
        row[lab] = {
            'slides': len(cp),
            'mean_diff': round(sum(diffs) / len(diffs), 2) if diffs else None,
            'mean_diff640': round(sum(diffs640) / len(diffs640), 2) if diffs640 else None,
            'slide_diffs': [round(x, 2) for x in diffs],
        }
    results.append(row)

    if sheets:
        scale = 0.4
        idx = [i - 1 for i in pick] if pick else list(range(min(6, len(pp))))
        idx = [i for i in idx if i < len(pp)]
        rows = []
        for i in idx:
            cols = [label(Image.open(pp[i]).convert('RGB'), f'PowerPoint {i + 1}')]
            for lab, d in caps:
                cp = pages(d, name)
                img = Image.open(cp[i]).convert('RGB') if i < len(cp) else Image.new('RGB', (1280, 720), (235, 235, 235))
                cols.append(label(fit_to(img, cols[0].size), f'{lab} {i + 1}'))
            pair = Image.new('RGB', (sum(c.width for c in cols) + 24 * (len(cols) - 1), cols[0].height), (200, 200, 200))
            x = 0
            for c in cols:
                pair.paste(c, (x, 0))
                x += c.width + 24
            rows.append(pair.resize((round(pair.width * scale), round(pair.height * scale))))
        if rows:
            sheet = Image.new('RGB', (max(r.width for r in rows), sum(r.height + 10 for r in rows)), (150, 150, 150))
            y = 0
            for r in rows:
                sheet.paste(r, (0, y))
                y += r.height + 10
            sheet.save(out_dir / f'{prefix}{name}.jpg', quality=72)

(out_dir / f'{prefix}compare.json').write_text(json.dumps(results, indent=2))
hdr = f"{'fixture':28} {'PPT':>4}" + ''.join(f" {lab[:10] + ' n':>12} {'diff':>6} {'d640':>6}" for lab, _ in caps)
print(hdr)
for r in results:
    line = f"{r['name']:28} {r['ppt_slides']:>4}"
    for lab, _ in caps:
        c = r[lab]
        line += f" {c['slides']:>12} {str(c['mean_diff']):>6} {str(c['mean_diff640']):>6}"
    print(line)
