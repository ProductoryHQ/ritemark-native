import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  isPortableExecutable,
  normalizePortableExecutableForAuthenticode,
  sha256Tree,
} from './tree-sha256.mjs';

const PE_OFFSET = 0x80;
const OPTIONAL_HEADER_OFFSET = PE_OFFSET + 24;
const CHECKSUM_OFFSET = OPTIONAL_HEADER_OFFSET + 64;
const CERTIFICATE_DIRECTORY_OFFSET = OPTIONAL_HEADER_OFFSET + 144;
const SECTION_OFFSET = 0x200;

function unsignedPe(marker = 'original-code') {
  const content = Buffer.alloc(0x400);
  content.write('MZ', 0, 'ascii');
  content.writeInt32LE(PE_OFFSET, 0x3c);
  content.write('PE\0\0', PE_OFFSET, 'binary');
  content.writeUInt16LE(0x8664, PE_OFFSET + 4); // AMD64
  content.writeUInt16LE(1, PE_OFFSET + 6); // NumberOfSections
  content.writeUInt16LE(240, PE_OFFSET + 20); // PE32+ optional header size
  content.writeUInt16LE(0x20b, OPTIONAL_HEADER_OFFSET); // PE32+
  content.writeUInt32LE(0x200, OPTIONAL_HEADER_OFFSET + 60); // SizeOfHeaders
  content.writeUInt32LE(16, OPTIONAL_HEADER_OFFSET + 108); // NumberOfRvaAndSizes

  const sectionTableOffset = OPTIONAL_HEADER_OFFSET + 240;
  content.write('.text\0\0\0', sectionTableOffset, 'binary');
  content.writeUInt32LE(0x200, sectionTableOffset + 16); // SizeOfRawData
  content.writeUInt32LE(SECTION_OFFSET, sectionTableOffset + 20); // PointerToRawData
  content.write(marker, SECTION_OFFSET, 'utf8');
  return content;
}

function authenticodeSigned(unsigned, certificateMarker = 'certificate') {
  const certificateSize = 24;
  const certificateOffset = Math.ceil(unsigned.length / 8) * 8;
  const signed = Buffer.alloc(certificateOffset + certificateSize);
  unsigned.copy(signed);
  signed.writeUInt32LE(0xdeadbeef, CHECKSUM_OFFSET);
  signed.writeUInt32LE(certificateOffset, CERTIFICATE_DIRECTORY_OFFSET);
  signed.writeUInt32LE(certificateSize, CERTIFICATE_DIRECTORY_OFFSET + 4);
  signed.writeUInt32LE(certificateSize, certificateOffset);
  signed.writeUInt16LE(0x0200, certificateOffset + 4);
  signed.writeUInt16LE(0x0002, certificateOffset + 6);
  signed.write(certificateMarker, certificateOffset + 8, 'utf8');
  return signed;
}

test('Authenticode-normalized digest tolerates signing but binds PE code and non-PE files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ritemark-tree-sha256-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const pePath = path.join(root, 'runtime.exe');
  const jsPath = path.join(root, 'extension.js');
  const unsigned = unsignedPe();
  fs.writeFileSync(pePath, unsigned);
  fs.writeFileSync(jsPath, 'export const state = "original";\n');

  assert.equal(isPortableExecutable(unsigned), true);
  const originalFull = sha256Tree(root);
  const originalIdentity = sha256Tree(root, { normalizeAuthenticode: true });

  fs.writeFileSync(pePath, authenticodeSigned(unsigned));
  assert.notEqual(sha256Tree(root), originalFull, 'full pre-sign digest must include signature bytes');
  assert.equal(
    sha256Tree(root, { normalizeAuthenticode: true }),
    originalIdentity,
    'Authenticode identity must remain stable across checksum, directory, and certificate changes',
  );

  fs.writeFileSync(pePath, authenticodeSigned(unsignedPe('replacement-code')));
  assert.notEqual(
    sha256Tree(root, { normalizeAuthenticode: true }),
    originalIdentity,
    'a different validly structured PE must not inherit the staged identity',
  );

  fs.writeFileSync(pePath, authenticodeSigned(unsigned));
  fs.appendFileSync(jsPath, '// unexpected mutation\n');
  assert.notEqual(
    sha256Tree(root, { normalizeAuthenticode: true }),
    originalIdentity,
    'post-sign digest must reject non-PE changes',
  );
});

test('PE normalization rejects a Certificate Table that overlaps executable content', () => {
  const malformed = unsignedPe();
  malformed.writeUInt32LE(SECTION_OFFSET, CERTIFICATE_DIRECTORY_OFFSET);
  malformed.writeUInt32LE(24, CERTIFICATE_DIRECTORY_OFFSET + 4);
  assert.throws(
    () => normalizePortableExecutableForAuthenticode(malformed),
    /overlaps signed content/,
  );
});

test('PE normalization preserves overlay payloads and removes only the Certificate Table', () => {
  const imageLength = unsignedPe().length;
  const unsignedWithOverlay = Buffer.concat([unsignedPe(), Buffer.from('packed-overlay')]);
  const signed = authenticodeSigned(unsignedWithOverlay);
  const expectedIdentity = normalizePortableExecutableForAuthenticode(unsignedWithOverlay);

  assert.deepEqual(
    normalizePortableExecutableForAuthenticode(signed),
    expectedIdentity,
    '8-byte signing alignment and certificate bytes must not change PE identity',
  );

  const changedOverlay = Buffer.from(signed);
  changedOverlay[imageLength] ^= 0xff;
  assert.notDeepEqual(
    normalizePortableExecutableForAuthenticode(changedOverlay),
    expectedIdentity,
    'pre-certificate overlay bytes must remain bound to the staged identity',
  );

  const changedCertificate = Buffer.from(signed);
  const certificateOffset = changedCertificate.readUInt32LE(CERTIFICATE_DIRECTORY_OFFSET);
  changedCertificate[certificateOffset + 8] ^= 0xff;
  assert.deepEqual(
    normalizePortableExecutableForAuthenticode(changedCertificate),
    expectedIdentity,
    'only the actual Certificate Table bytes may vary after signing',
  );
});
