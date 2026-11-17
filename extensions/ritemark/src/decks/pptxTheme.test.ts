/**
 * Sprint 162 PR 5: the `.pptx` theme reader (`read_pptx_theme`), on a synthetic presentation made here.
 *   - It answers the theme's name, its twelve colours (`srgbClr`, and a `sysClr`'s last colour) and its two Latin fonts.
 *   - Another theme part is taken when there is no `theme1.xml`; a package without one, a Word file, a damaged file and an
 *     older `.ppt` are refused with a reason.
 *
 * Run: npx tsx src/decks/pptxTheme.test.ts   (PRINT=1 prints the reader's JSON on the synthetic file)
 */
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { parsePptxThemeXml, readPptxTheme, themePartName } from './pptxTheme';

let passed = 0;
async function test(name: string, run: () => void | Promise<void>) {
  try {
    await run();
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

/** A ZIP of these parts, each deflated, as PowerPoint writes one. */
export function zipOf(parts: Record<string, string>): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(parts)) {
    const raw = Buffer.from(text, 'utf8');
    const data = deflateRawSync(raw);
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc32(raw), 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(parts).length, 8);
  end.writeUInt16LE(Object.keys(parts).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, directory, end]));
}

/** A made-up bank's theme part: Futura-like fonts PowerPoint names, a `sysClr` for dark 1 and light 1. */
export const SYNTHETIC_THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Fernhollow &amp; Co">
  <a:themeElements>
    <a:clrScheme name="Fernhollow">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="17324d"/></a:dk2>
      <a:lt2><a:srgbClr val="EEF3EE"/></a:lt2>
      <a:accent1><a:srgbClr val="2E7D4F"/></a:accent1>
      <a:accent2><a:srgbClr val="C8A951"/></a:accent2>
      <a:accent3><a:srgbClr val="5B8DB8"/></a:accent3>
      <a:accent4><a:srgbClr val="A04E3B"/></a:accent4>
      <a:accent5><a:srgbClr val="7A6FA8"/></a:accent5>
      <a:accent6><a:srgbClr val="3B8686"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Fernhollow">
      <a:majorFont><a:latin typeface="Futura PT" panose="020B0602020204020303"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Source Sans Pro"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`;

const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';

export function syntheticPptx(themePart = 'ppt/theme/theme1.xml', xml = SYNTHETIC_THEME_XML): Uint8Array {
  return zipOf({
    '[Content_Types].xml': CONTENT_TYPES,
    'ppt/presentation.xml': '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>',
    [themePart]: xml,
  });
}

async function main() {
  await test('reads the name, the twelve colours and the two fonts', async () => {
    const result = await readPptxTheme(syntheticPptx());
    assert.ok(result.ok);
    if (process.env.PRINT) console.log(JSON.stringify(result.theme, null, 2));
    assert.deepEqual(result.theme, {
      name: 'Fernhollow & Co',
      colours: {
        dk1: '#000000', lt1: '#FFFFFF', dk2: '#17324D', lt2: '#EEF3EE',
        accent1: '#2E7D4F', accent2: '#C8A951', accent3: '#5B8DB8', accent4: '#A04E3B', accent5: '#7A6FA8', accent6: '#3B8686',
        hlink: '#0563C1', folHlink: '#954F72',
      },
      fonts: { headings: 'Futura PT', text: 'Source Sans Pro' },
    });
  });

  await test('another theme part when there is no theme1.xml', async () => {
    assert.equal(themePartName(['ppt/theme/theme10.xml', 'ppt/theme/theme3.xml']), 'ppt/theme/theme3.xml');
    assert.equal(themePartName(['ppt/slides/slide1.xml']), null);
    const result = await readPptxTheme(syntheticPptx('ppt/theme/theme2.xml'));
    assert.ok(result.ok && result.theme.fonts.headings === 'Futura PT');
  });

  await test('a slot left out, a bad colour and an empty font are absent, not invented', () => {
    const theme = parsePptxThemeXml('<a:theme name=" "><a:clrScheme><a:dk1><a:srgbClr val="12345"/></a:dk1><a:accent1><a:srgbClr val="ff0000"/></a:accent1></a:clrScheme><a:majorFont><a:latin typeface=""/></a:majorFont></a:theme>');
    assert.deepEqual(theme, { name: null, colours: { accent1: '#FF0000' }, fonts: { headings: null, text: null } });
  });

  await test('refuses what is no presentation theme, with a reason', async () => {
    const noTheme = zipOf({ '[Content_Types].xml': CONTENT_TYPES, 'ppt/presentation.xml': '<p/>' });
    assert.deepEqual(await readPptxTheme(noTheme), { ok: false, problem: 'The presentation has no theme.' });
    const word = zipOf({ '[Content_Types].xml': CONTENT_TYPES, 'word/document.xml': '<w/>' });
    assert.deepEqual(await readPptxTheme(word), { ok: false, problem: 'The file is not a PowerPoint presentation.' });
    const damaged = syntheticPptx().slice(0, 200);
    assert.equal((await readPptxTheme(damaged)).ok, false);
    const legacy = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    assert.match((await readPptxTheme(legacy) as { problem: string }).problem, /older PowerPoint format/);
  });

  console.log(`pptxTheme: ${passed} passed`);
}

if (require.main === module || process.argv[1]?.endsWith('pptxTheme.test.ts')) void main().catch(error => { console.error(error); process.exit(1); });
