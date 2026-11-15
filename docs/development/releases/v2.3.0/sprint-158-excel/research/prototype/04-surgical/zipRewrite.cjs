// Rewrite a zip, copying untouched entries' local header + compressed bytes verbatim;
// only replaced entries are deflated again (node:zlib). Removed entries are dropped.
const zlib = require('node:zlib');
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  if (!crc32.t) { crc32.t = new Uint32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc32.t[n] = c >>> 0; } }
  for (let i = 0; i < buf.length; i++) crc = crc32.t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function readDir(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1; for (let i = b.length - 22; i >= 0; i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  const count = v.getUint16(e + 10, true), off = v.getUint32(e + 16, true);
  const out = []; let at = off;
  for (let n = 0; n < count; n++) {
    const nl = v.getUint16(at + 28, true), xl = v.getUint16(at + 30, true), cl = v.getUint16(at + 32, true);
    out.push({ cd: b.subarray(at, at + 46 + nl + xl + cl), name: Buffer.from(b.subarray(at + 46, at + 46 + nl)).toString('utf8'),
      flags: v.getUint16(at + 8, true), csize: v.getUint32(at + 20, true), lho: v.getUint32(at + 42, true) });
    at += 46 + nl + xl + cl;
  }
  return out; // ZIP64 not handled in this prototype (the real one reuses officePackageCheck.readZipDirectory)
}
/** replace: Map name -> Uint8Array (new content) | null (remove) */
function rewrite(b, replace) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const chunks = [], cds = []; let offset = 0;
  for (const ent of readDir(b)) {
    if (replace.has(ent.name) && replace.get(ent.name) === null) continue;
    const lh = ent.lho; const nl = v.getUint16(lh + 26, true), xl = v.getUint16(lh + 28, true);
    const dataStart = lh + 30 + nl + xl;
    if (!replace.has(ent.name)) {
      let end = dataStart + ent.csize;
      if (ent.flags & 0x8) end += v.getUint32(end, true) === 0x08074b50 ? 16 : 12; // data descriptor
      const local = b.subarray(lh, end); chunks.push(local);
      const cd = Buffer.from(ent.cd); cd.writeUInt32LE(offset, 42); cds.push(cd); offset += local.length;
    } else {
      const raw = replace.get(ent.name); const comp = zlib.deflateRawSync(raw, { level: 6 }); const crc = crc32(raw);
      const name = Buffer.from(ent.name, 'utf8');
      const local = Buffer.alloc(30 + name.length);
      local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(ent.flags & 0x800, 6); local.writeUInt16LE(8, 8);
      local.writeUInt32LE(v.getUint32(lh + 10, true), 10); // keep the entry's date/time
      local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
      name.copy(local, 30);
      const cd = Buffer.alloc(46 + name.length);
      cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(ent.flags & 0x800, 8); cd.writeUInt16LE(8, 10);
      cd.writeUInt32LE(v.getUint32(lh + 10, true), 12); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(raw.length, 24);
      cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(offset, 42); name.copy(cd, 46);
      chunks.push(local, comp); cds.push(cd); offset += local.length + comp.length;
    }
  }
  const cdBuf = Buffer.concat(cds); const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(cds.length, 8); eocd.writeUInt16LE(cds.length, 10); eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}
module.exports = { rewrite, readDir };
