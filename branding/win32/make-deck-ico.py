"""Build branding/win32/deck.ico, the .rtms file's icon on Windows (Sprint 172).

The source is the Experience lead's drawing, deck-file-{16,24,32,48,64,256}.png
in the decks experience's file-icon/ folder (product design repo); its SVGs are
the drawing's own sources. Each frame is her PNG, unscaled. The layout matches
branding/icons/icon.ico: 32-bit BMP (DIB) frames with an AND mask for 16-64 px,
a PNG frame for 256 px. Needs Pillow; it checks every frame against its PNG.

Usage: python3 branding/win32/make-deck-ico.py <file-icon dir> branding/win32/deck.ico
"""
import io, struct, sys
from PIL import Image

SIZES = (16, 24, 32, 48, 64, 256)


def dib(im):
    w, h = im.size
    px = im.load()
    rows = []
    for y in range(h - 1, -1, -1):
        rows.append(b''.join(bytes((px[x, y][2], px[x, y][1], px[x, y][0], px[x, y][3])) for x in range(w)))
    xor = b''.join(rows)
    stride = ((w + 31) // 32) * 4
    mask = bytearray()
    for y in range(h - 1, -1, -1):
        row = bytearray(stride)
        for x in range(w):
            if px[x, y][3] == 0:
                row[x // 8] |= 0x80 >> (x % 8)
        mask += row
    header = struct.pack('<IiiHHIIiiII', 40, w, h * 2, 1, 32, 0, len(xor) + len(mask), 0, 0, 0, 0)
    return header + xor + bytes(mask)


def main(src, out):
    frames = []
    for s in SIZES:
        im = Image.open(f'{src}/deck-file-{s}.png').convert('RGBA')
        assert im.size == (s, s), (s, im.size)
        if s == 256:
            buf = io.BytesIO()
            im.save(buf, 'png')
            data = buf.getvalue()
        else:
            data = dib(im)
        frames.append((s, data))
    offset = 6 + 16 * len(frames)
    head = struct.pack('<HHH', 0, 1, len(frames))
    entries = b''
    body = b''
    for s, data in frames:
        entries += struct.pack('<BBBBHHII', s % 256, s % 256, 0, 0, 1, 32, len(data), offset + len(body))
        body += data
    with open(out, 'wb') as f:
        f.write(head + entries + body)


def verify(src, out):
    from PIL import ImageChops
    ico = Image.open(out)
    print('sizes', sorted(ico.info['sizes']))
    for s in SIZES:
        im = ico.ico.getimage((s, s)).convert('RGBA')
        ref = Image.open(f'{src}/deck-file-{s}.png').convert('RGBA')
        same = ImageChops.difference(im, ref).getbbox() is None
        print(s, im.size, 'identical' if same else 'DIFF')
        assert same


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
    verify(sys.argv[1], sys.argv[2])
