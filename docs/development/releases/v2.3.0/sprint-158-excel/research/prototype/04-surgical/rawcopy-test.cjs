// Surgical edit, then write with raw copy; compare compressed entry bytes with the original
const fs = require('fs'); const { unzipSync } = require('fflate');
const { applyEdits } = require('./surgical.cjs'); const { rewrite, readDir } = require('./zipRewrite.cjs');
const orig = new Uint8Array(fs.readFileSync('../01-fixtures/rich-excelish.xlsx'));
const { bytes } = applyEdits(orig, [{ sheet: 'Budget', ref: 'A3', value: 'Rent (edited)' }, { sheet: 'Budget', ref: 'C5', value: 7 }]);
const a = unzipSync(orig), b = unzipSync(bytes); const repl = new Map();
for (const n of Object.keys(a)) { if (!(n in b)) repl.set(n, null); else if (Buffer.compare(Buffer.from(a[n]), Buffer.from(b[n]))) repl.set(n, b[n]); }
const out = rewrite(orig, repl); fs.writeFileSync('rich-rawcopy.xlsx', out);
const dirA = readDir(orig), dirB = readDir(new Uint8Array(out));
let identical = 0; const changed = [];
for (const e of dirB) { const o = dirA.find(x => x.name === e.name);
  const sliceOf = (buf, ent) => { const v = new DataView(buf.buffer, buf.byteOffset); const nl = v.getUint16(ent.lho + 26, true), xl = v.getUint16(ent.lho + 28, true); return Buffer.from(buf.subarray(ent.lho, ent.lho + 30 + nl + xl + ent.csize)); };
  if (Buffer.compare(sliceOf(orig, o), sliceOf(new Uint8Array(out), e)) === 0) identical++; else changed.push(e.name); }
console.log('entries', dirB.length, 'local header + compressed bytes identical:', identical, 'rewritten:', changed, 'removed:', [...repl].filter(([, v]) => v === null).map(([k]) => k));
const check = unzipSync(new Uint8Array(out)); console.log('unzips ok, parts:', Object.keys(check).length);
