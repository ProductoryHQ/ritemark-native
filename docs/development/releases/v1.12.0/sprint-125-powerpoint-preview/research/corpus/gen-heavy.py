#!/usr/bin/env python3
"""Cost fixture: 40 slides, each with a distinct full-HD JPEG (deterministic, seeded shapes).
Written to fixtures-cost/10-media-heavy-40.pptx; no PowerPoint ground truth (cost only)."""
import importlib.util
import io
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('gen', HERE / 'gen-fixtures.py')
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)
gen.OUT = HERE / 'fixtures-cost'
gen.OUT.mkdir(exist_ok=True)


def photo(seed):
    rnd = random.Random(seed)
    img = Image.linear_gradient('L').resize((1920, 1080)).convert('RGB')
    d = ImageDraw.Draw(img)
    for _ in range(900):
        x, y = rnd.randrange(1920), rnd.randrange(1080)
        r = rnd.randrange(4, 90)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)))
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    b = io.BytesIO()
    img.save(b, 'JPEG', quality=88)
    b.seek(0)
    return b


prs = gen.new_deck('Media-heavy forty slides')
total = 0
for i in range(40):
    s = gen.title_only(prs, f'{i + 1}. Photo')
    p = photo(1000 + i)
    total += len(p.getbuffer())
    s.shapes.add_picture(p, gen.Inches(1.2), gen.Inches(1.4), width=gen.Inches(10.9))
gen.save(prs, '10-media-heavy-40.pptx')
print(f'images: {total / 1e6:.1f} MB')
