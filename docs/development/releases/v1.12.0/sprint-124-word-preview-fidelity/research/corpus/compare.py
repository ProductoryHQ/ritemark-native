#!/usr/bin/env python3
"""Sprint 124 R1/R2: compare preview captures with Word's pages.

    python3 compare.py <word-png-dir> <capture-dir> <out-dir> [--sheets]

Word pages come from `pdftoppm -r 96` (<name>-<n>.png); captures from
capture-preview.mjs (<name>-<nn>.png). Both are 1 px = 1/96 in.

Per fixture it reports:
  - pages: Word's count and the preview's;
  - diff: mean absolute grey-level difference, in percent, over the pages both
    have, after scaling each page to 200 px wide (the preview page is cropped or
    padded to Word's page height first). Lower is closer. It is a coarse
    signal: text that moves by a line changes it far more than a font's
    anti-aliasing does, which is the point;
  - with --sheets, a side-by-side JPEG (Word left, preview right, first 6 pages).

Needs Pillow.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageOps, ImageStat

word_dir, cap_dir, out_dir = (Path(a) for a in sys.argv[1:4])
sheets = '--sheets' in sys.argv
out_dir.mkdir(parents=True, exist_ok=True)


def pages(directory, name):
    found = []
    for p in directory.glob(f'{name}-*.png'):
        m = re.fullmatch(re.escape(name) + r'-(\d+)\.png', p.name)
        if m:
            found.append((int(m.group(1)), p))
    return [p for _, p in sorted(found)]


def fit_to(img, size):
    """Crop or pad (white) an image to exactly `size`, anchored top-left."""
    canvas = Image.new('RGB', size, 'white')
    canvas.paste(img.crop((0, 0, min(img.width, size[0]), min(img.height, size[1]))), (0, 0))
    return canvas


def diff_percent(a, b):
    w = 200
    ga = ImageOps.grayscale(a).resize((w, round(a.height * w / a.width)))
    gb = ImageOps.grayscale(fit_to(b, a.size)).resize(ga.size)
    return ImageStat.Stat(ImageChops.difference(ga, gb)).mean[0] / 255 * 100


results = []
names = sorted({re.sub(r'-\d+\.png$', '', p.name) for p in word_dir.glob('*.png')})
for name in names:
    wp, cp = pages(word_dir, name), pages(cap_dir, name)
    if not cp:
        continue
    both = min(len(wp), len(cp))
    diffs = []
    pairs = []
    for i in range(both):
        a, b = Image.open(wp[i]).convert('RGB'), Image.open(cp[i]).convert('RGB')
        diffs.append(diff_percent(a, b))
        pairs.append((a, b))
    row = {
        'name': name,
        'word_pages': len(wp),
        'preview_pages': len(cp),
        'preview_first_page_height_px': Image.open(cp[0]).height,
        'mean_diff_percent': round(sum(diffs) / len(diffs), 2) if diffs else None,
        'page_diffs': [round(x, 2) for x in diffs],
    }
    results.append(row)

    if sheets:
        scale = 0.5
        shown = []
        for i in range(min(6, max(len(wp), len(cp)))):
            a = Image.open(wp[i]).convert('RGB') if i < len(wp) else None
            b = Image.open(cp[i]).convert('RGB') if i < len(cp) else None
            ref = a or b
            h = ref.height
            left = a if a else Image.new('RGB', ref.size, (235, 235, 235))
            right = fit_to(b, (b.width, h)) if b else Image.new('RGB', ref.size, (235, 235, 235))
            if b and b.height > h:
                d = ImageDraw.Draw(right)
                d.rectangle((0, h - 6, right.width, h), fill=(220, 40, 40))  # preview page continues past Word's page end
            pair = Image.new('RGB', (left.width + right.width + 24, h), (200, 200, 200))
            pair.paste(left, (0, 0))
            pair.paste(right, (left.width + 24, 0))
            shown.append(pair.resize((round(pair.width * scale), round(pair.height * scale))))
        sheet = Image.new('RGB', (max(p.width for p in shown), sum(p.height + 12 for p in shown)), (160, 160, 160))
        y = 0
        for p in shown:
            sheet.paste(p, (0, y))
            y += p.height + 12
        sheet.save(out_dir / f'{name}.jpg', quality=70)

(out_dir / 'compare.json').write_text(json.dumps(results, indent=2))
print(f"{'fixture':32} {'Word':>5} {'preview':>8} {'1st page px':>12} {'diff %':>7}")
for r in results:
    print(f"{r['name']:32} {r['word_pages']:>5} {r['preview_pages']:>8} {r['preview_first_page_height_px']:>12} {str(r['mean_diff_percent']):>7}")
