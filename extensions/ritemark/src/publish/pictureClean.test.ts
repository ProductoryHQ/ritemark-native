import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { test } from 'node:test';
import { deflateSync, inflateSync } from 'node:zlib';
import { gatherPage } from './gather';
import { readVerifiedUpload } from './host';
import { cleanPicture } from './pictureClean';
import { changedSincePublish, recordFor, sheetNeeded } from './publishRecords';
import { GIF, JPEG, PNG, WEBP } from './testing/pictures';

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

function jpegWithExif(): Buffer {
  const tiff = Buffer.alloc(142);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(4, 8);
  function entry(offset: number, tag: number, type: number, count: number, value: number) {
    tiff.writeUInt16LE(tag, offset);
    tiff.writeUInt16LE(type, offset + 2);
    tiff.writeUInt32LE(count, offset + 4);
    tiff.writeUInt32LE(value, offset + 8);
  }
  entry(10, 0x112, 3, 1, 6); // Rotate 90 degrees clockwise.
  entry(22, 0x110, 2, 7, 62); // Model.
  entry(34, 0x13b, 2, 7, 69); // Artist.
  entry(46, 0x8825, 4, 1, 76); // GPS IFD.
  tiff.write('CAM-01\0AUTHOR\0', 62);
  tiff.writeUInt16LE(3, 76);
  entry(78, 0, 1, 4, 0x00000302); // GPS version.
  entry(90, 1, 2, 2, 0x4e); // Latitude reference.
  entry(102, 2, 5, 3, 118); // Latitude in degrees, minutes and seconds.
  for (const [i, value] of [59, 26, 0].entries()) {
    tiff.writeUInt32LE(value, 118 + 8 * i);
    tiff.writeUInt32LE(1, 122 + 8 * i);
  }
  return Buffer.concat([
    JPEG.subarray(0, 20),
    jpegSegment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff])),
    jpegSegment(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<xmp>LOCATION</xmp>')),
    jpegSegment(0xed, Buffer.concat([Buffer.from('Photoshop 3.0\0'), Buffer.from('3842494d04040000000000051c0250000000', 'hex')])),
    JPEG.subarray(20, -2),
    jpegSegment(0xfe, Buffer.from('COMMENT after scan')),
    JPEG.subarray(-2),
    Buffer.from('TRAILING METADATA'),
  ]);
}

function pngChunk(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length);
  header.write(type, 4);
  const crc = Buffer.alloc(4);
  let value = -1;
  for (const byte of Buffer.concat([header.subarray(4), payload])) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0);
  }
  crc.writeUInt32BE((value ^ -1) >>> 0);
  return Buffer.concat([header, payload, crc]);
}

const pngWithMetadata = Buffer.concat([
  PNG.subarray(0, 33),
  pngChunk('tEXt', Buffer.from('Author\0AUTHOR')),
  pngChunk('zTXt', Buffer.concat([Buffer.from('Comment\0\0'), deflateSync('COMMENT')])),
  pngChunk('iTXt', Buffer.from('Description\0\0\0\0\0LOCATION')),
  pngChunk('eXIf', Buffer.from('49492a0008000000000000000000', 'hex')),
  pngChunk('tIME', Buffer.from([7, 234, 11, 24, 12, 0, 0])),
  PNG.subarray(33),
]);

function webpChunk(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(type);
  header.writeUInt32LE(payload.length, 4);
  return Buffer.concat([header, payload, Buffer.alloc(payload.length & 1)]);
}
function webpWithChunks(...chunks: Buffer[]): Buffer {
  const bytes = Buffer.concat([WEBP.subarray(0, 12), ...chunks]);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  return bytes;
}
const webpImage = WEBP.subarray(12);
const webpHeader = (flags: number) => webpChunk('VP8X', Buffer.from([flags, 0, 0, 0, 1, 0, 0, 2, 0, 0]));

function clean(source: Buffer): Buffer {
  const result = cleanPicture(source);
  assert.equal(result.kind, 'clean');
  return result.bytes;
}

function checkPixels(format: string, source: Buffer, cleaned: Buffer): void {
  // The byte comparisons run in the normal test chain. For the image-decoder check, opt in on a machine with ImageMagick.
  if (process.env.RITEMARK_TEST_PICTURE_PIXELS !== '1') return;
  const pixels = (image: Buffer) => execFileSync('magick', [format + ':-', '-auto-orient', '-depth', '8', 'rgba:-'], { input: image });
  const expected = pixels(source);
  assert.ok(expected.length > 0);
  assert.deepEqual(pixels(cleaned), expected);
}

test('JPEG strips EXIF GPS, camera and author, XMP, IPTC, scan comments and trailing data while keeping orientation', () => {
  const source = jpegWithExif();
  const cleaned = clean(source);
  const orientationOnly = Buffer.from('ffe100224578696600004d4d002a00000008000101120003000000010006000000000000', 'hex');
  assert.deepEqual(cleaned, Buffer.concat([JPEG.subarray(0, 20), orientationOnly, JPEG.subarray(20)]));
  assert.deepEqual(clean(cleaned), cleaned);
  checkPixels('jpeg', source, cleaned);
});

test('PNG strips all three text chunks, EXIF and time and keeps valid image data', () => {
  const cleaned = clean(pngWithMetadata);
  assert.deepEqual(cleaned, PNG);
  const idatLength = cleaned.readUInt32BE(33);
  assert.equal(inflateSync(cleaned.subarray(41, 41 + idatLength)).length, 3 * (1 + 2 * 3 * 2));
  checkPixels('png', pngWithMetadata, cleaned);
});

test('WebP removes metadata and repairs flags and RIFF size', () => {
  const source = webpWithChunks(webpHeader(0x0c), webpImage, webpChunk('EXIF', Buffer.from('CAM-01')), webpChunk('XMP ', Buffer.from('AUTHOR!')));
  const cleaned = clean(source);
  assert.deepEqual(cleaned, webpWithChunks(webpHeader(0), webpImage));
  checkPixels('webp', source, cleaned);
});

test('animated WebP keeps frame chunks and animation flags', () => {
  const animation = Buffer.from('UklGRsAAAABXRUJQVlA4WAoAAAACAAAAAQAAAgAAQU5JTQYAAAD/////AABBTk1GSAAAAAAAAAAAAAEAAAIAAFAAAAJWUDggMAAAANABAJ0BKgIAAwACADQloAJ0ugH4AAOwAP7wxAv/ILlhdcjX/yA/5Af8gP/48gAAAEFOTUZEAAAAAAAAAAAAAQAAAgAAUAAAAFZQOCAsAAAAlAEAnQEqAgADAAAANCWgAnS6AAOYAP75k2//kB//kB//kB//ID/iF3sgMAA=', 'base64');
  const source = webpWithChunks(webpHeader(0x06), animation.subarray(30), webpChunk('XMP ', Buffer.from('AUTHOR')));
  const cleaned = clean(source);
  assert.deepEqual(cleaned, animation);
  checkPixels('webp', source, cleaned);
});

test('GIF drops comments and metadata applications but keeps the loop and drawing', () => {
  const loop = Buffer.from('21ff0b4e45545343415045322e300301000000', 'hex');
  const comment = Buffer.from('!\xfe\x07COMMENT\0', 'latin1');
  const application = Buffer.from('!\xff\x0bXMP DataXMP\x03XMP\0', 'latin1');
  const source = Buffer.concat([GIF.subarray(0, 25), loop, comment, application, GIF.subarray(25)]);
  const cleaned = clean(source);
  assert.deepEqual(cleaned, Buffer.concat([GIF.subarray(0, 25), loop, GIF.subarray(25)]));
  checkPixels('gif', source, cleaned);
});

test('SVG drops nested and self-closing metadata without rewriting the drawing', () => {
  const start = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg" width="2" height="3">';
  const end = '<rect width="2" height="3" fill="red"/><style><![CDATA[/* <metadata> */]]></style></svg>';
  const source = Buffer.from(start + '<s:metadata note="a > b"><record><![CDATA[</s:metadata>]]>AUTHOR</record></s:metadata><metadata/>' + end);
  const cleaned = clean(source);
  assert.deepEqual(cleaned, Buffer.from(start + end));
  checkPixels('svg', source, cleaned);
});

test('SVG drops comments and Inkscape/Sodipodi data, which keep local paths', () => {
  const source = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<!-- Generator: Adobe Illustrator 28 -->\n'
    + '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" '
    + 'width="2" height="3" sodipodi:docname="logo.svg" inkscape:export-filename="/Users/someone/Documents/logo.png">'
    + '<sodipodi:namedview id="n" inkscape:zoom="2"><inkscape:grid/></sodipodi:namedview>'
    + '<rect width="2" height="3" fill="red" inkscape:label="box"/></svg>');
  const cleaned = clean(source).toString('utf8');
  assert.doesNotMatch(cleaned, /someone|Generator|sodipodi:docname|inkscape:export|namedview|inkscape:label|<!--/);
  assert.match(cleaned, /<rect width="2" height="3" fill="red"\/>/);
  checkPixels('svg', source, Buffer.from(cleaned));
});

test('an editor attribute inside another attribute\'s value never becomes markup (security review)', () => {
  const source = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" a='v inkscape:n="' b="x' onload='alert(1)' c='"><rect width="1" height="1"/></svg>`);
  const cleaned = clean(source).toString('utf8');
  assert.equal(cleaned, source.toString('utf8'), 'no editor attribute: the tag is copied unchanged');
  assert.doesNotMatch(cleaned.replace(/'[^']*'|"[^"]*"/g, ''), /onload/);
});

test('BMP and ICO carry no metadata and go as they are', () => {
  const bmp = Buffer.alloc(58); bmp.write('BM', 0, 'latin1'); bmp.writeUInt32LE(58, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
  const ico = Buffer.alloc(22 + PNG.length); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); PNG.copy(ico, 22);
  for (const source of [bmp, ico]) assert.deepEqual(clean(source), source);
});

test('truncated raster containers, SVG with a DTD, and unknown formats are uncleanable', () => {
  for (const source of [JPEG, PNG, WEBP, GIF]) {
    assert.equal(cleanPicture(source.subarray(0, source.length - 1)).kind, 'uncleanable');
  }
  assert.equal(cleanPicture(Buffer.from('<!DOCTYPE svg SYSTEM "example.dtd"><svg/>')).kind, 'uncleanable');
  assert.equal(cleanPicture(Buffer.from('unknown')).kind, 'uncleanable');
});

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('manual upload and its record use cleaned bytes and disclose a picture left out', async () => {
  const project = path.resolve('picture-clean-test-project');
  const page = path.join(project, 'page.html');
  const jpeg = jpegWithExif();
  const local = new Map([
    [page, Buffer.from('<img src="photo.jpg"><img src="photo.png"><img src="unknown.heic"><img src="../outside.jpg">')],
    [path.join(project, 'photo.jpg'), jpeg],
    [path.join(project, 'photo.png'), pngWithMetadata],
    [path.join(project, 'unknown.heic'), Buffer.from('unsupported')],
  ]);
  const readFile = async (file: string) => {
    const bytes = local.get(file);
    assert.ok(bytes, 'never read the picture outside the project');
    return bytes;
  };
  const stat = async (file: string) => ({ isFile: () => true, size: (await readFile(file)).length });
  const gather = () => gatherPage(page, project, {
    readFile, stat, realpath: async (file) => file,
    gitIgnored: async () => ({ ignored: new Set(), unchecked: new Set() }),
  });
  await assert.rejects(gatherPage(path.resolve('outside.html'), project, { readFile }), /outside this project/);
  const plan = await gather();
  const upload = await readVerifiedUpload(plan, { readFile, stat });
  assert.notDeepEqual(upload.files[1].bytes, jpeg, 'the raw JPEG must never go up');
  assert.deepEqual(upload.files[2].bytes, PNG, 'the PNG goes up without text or EXIF');
  assert.deepEqual(upload.files.map((file) => file.urlPath), ['/index.html', '/photo.jpg', '/photo.png']);
  assert.deepEqual(local.get(path.join(project, 'photo.jpg')), jpegWithExif(), 'local bytes untouched');
  assert.deepEqual(plan.leftOut, [
    { display: '../outside.jpg', reason: 'outside' },
    { display: 'unknown.heic', reason: 'uncleanable' },
  ]);
  const record = recordFor(plan, { accountId: 'account', siteName: 'page', address: 'https://example.test' });
  assert.deepEqual(record.files.map((file) => file.sha256), upload.files.map((file) => sha256(file.bytes)));
  assert.equal(record.contentHash, upload.contentHash);
  assert.equal(sheetNeeded(record, plan), true, 'each manual update discloses a picture left out');
  local.set(path.join(project, 'photo.png'), PNG);
  assert.equal(changedSincePublish(record, await gather()), false, 'a metadata-only edit does not change the published picture');
  await assert.rejects(readVerifiedUpload(plan, { readFile, stat }), { code: 'changed' }, 'the original read still has to match');
});
