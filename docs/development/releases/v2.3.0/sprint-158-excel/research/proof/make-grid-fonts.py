"""Sprint 158 PR 4: the sheet grid's fonts. Subset Carlito and Caladea (from google/fonts, fetch-grid-fonts.sh) to the
Latin a workbook here needs (Estonian letters included) as woff2, with no hinting and no layout features (Excel
neither kerns nor ligates in a cell), and rename them: a subset is a modified version under the OFL, and Carlito's
licence reserves its name. Writes RitemarkGrid{Sans,Serif}-<style>.woff2 for webview/src/assets/fonts/.
  bash fetch-grid-fonts.sh <download dir>
  python3 -P -E make-grid-fonts.py <download dir> <out dir>
fontTools does the work; its woff2 writer's Brotli comes from Node's zlib (make-grid-fonts-shim/brotli.py)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make-grid-fonts-shim'))
from fontTools import subset
from fontTools.ttLib import TTFont

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
# Basic Latin, Latin-1, Latin Extended-A (š ž õ ä ö ü and the rest of Europe), the punctuation and spaces number
# formats and text use: dashes, quotes, bullet, ellipsis, per mille, euro, figure/narrow/no-break spaces, minus
unicodes = '20-7E,A0-17F,2007,2009,200A,2010-2014,2018-201E,2022,2026,2030,2039,203A,202F,20AC,2122,2212'
for fam, Fam in (('carlito', 'Carlito'), ('caladea', 'Caladea')):
    for style in ('Regular', 'Bold', 'Italic', 'BoldItalic'):
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = []
        opts.hinting = False
        opts.desubroutinize = True
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        font = subset.load_font(os.path.join(src, fam, f'{Fam}-{style}.ttf'), opts)
        s = subset.Subsetter(opts)
        s.populate(unicodes=subset.parse_unicodes(unicodes))
        s.subset(font)
        # A subset is a Modified Version under the OFL, and Carlito's licence reserves its name: the subsets are
        # renamed (Caladea's too, for one rule). Copyright (0), licence (13, 14) stay as they are.
        new = {'carlito': 'Ritemark Grid Sans', 'caladea': 'Ritemark Grid Serif'}[fam]
        sub = {'Regular': 'Regular', 'Bold': 'Bold', 'Italic': 'Italic', 'BoldItalic': 'Bold Italic'}[style]
        ps = new.replace(' ', '') + '-' + style
        name = font['name']
        for rec in list(name.names):
            if rec.nameID in (1, 16):
                rec.string = new
            elif rec.nameID in (2, 17):
                rec.string = sub
            elif rec.nameID == 3:
                rec.string = f'{ps}; Ritemark subset'
            elif rec.nameID == 4:
                rec.string = f'{new} {sub}' if sub != 'Regular' else new
            elif rec.nameID == 6:
                rec.string = ps
            elif rec.nameID in (0, 5, 7, 8, 9, 11, 12, 13, 14, 19, 25):
                continue
            else:
                name.removeNames(nameID=rec.nameID)
        note = f'A subset of {Fam} (SIL OFL 1.1), renamed for Ritemark as the licence asks of a modified version.'
        name.setName(note, 10, 3, 1, 0x409)
        name.setName(note, 10, 1, 0, 0)
        left = ' '.join(str(r) for r in name.names if r.nameID not in (0, 3, 7, 10, 13, 14))
        assert Fam not in left, (Fam, left)
        path = os.path.join(out, f'RitemarkGrid{"Sans" if fam == "carlito" else "Serif"}-{style}.woff2')
        subset.save_font(font, path, opts)
        check = TTFont(path)
        cmap = check.getBestCmap()
        hmtx = check['hmtx']
        upm = check['head'].unitsPerEm
        digit = hmtx[cmap[ord('0')]][0]
        print(f'{os.path.basename(path)}: {os.path.getsize(path)} bytes, {len(cmap)} chars, upm {upm}, digit {digit} '
              f'({digit / upm:.4f} em), õ {"yes" if ord("õ") in cmap else "NO"}, € {"yes" if 0x20AC in cmap else "NO"}')
