// Part-level and element-level diff of two xlsx files.
// usage: node xmldiff.cjs before.xlsx after.xlsx [--show part]
const fs = require('fs');
const { unzipSync, strFromU8 } = require('fflate');
const WATCH = ['font','fill','border','xf','numFmt','dxf','mergeCell','col','row','c','f','v','pane','conditionalFormatting','cfRule','dataValidation',
  'hyperlink','definedName','drawing','legacyDrawing','tablePart','extLst','ext','x14:cfRule','x14:dataBar','tabColor','pageSetup','oddHeader','printOptions',
  'sheetProtection','autoFilter','sheet','comment','si','r','rPr','clrScheme','calcPr','ignoredError','sheetFormatPr','selection','sheetView'];
function load(p) { return unzipSync(new Uint8Array(fs.readFileSync(p))); }
function counts(xml) {
  const out = {};
  for (const tag of WATCH) {
    const re = new RegExp('<' + tag.replace(':', '\\:') + '[\\s/>]', 'g');
    const n = (xml.match(re) || []).length;
    if (n) out[tag] = n;
  }
  return out;
}
const [a, b] = [load(process.argv[2]), load(process.argv[3])];
const showIdx = process.argv.indexOf('--show');
const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
const rows = [];
for (const n of names) {
  if (!(n in b)) { rows.push(['REMOVED', n, a[n].length, '']); continue; }
  if (!(n in a)) { rows.push(['ADDED', n, '', b[n].length]); continue; }
  const same = a[n].length === b[n].length && a[n].every((x, i) => x === b[n][i]);
  if (same) { rows.push(['same', n, a[n].length, b[n].length]); continue; }
  let note = '';
  if (/\.(xml|rels|vml)$/.test(n)) {
    const ca = counts(strFromU8(a[n])), cb = counts(strFromU8(b[n]));
    const keys = [...new Set([...Object.keys(ca), ...Object.keys(cb)])];
    note = keys.filter(k => ca[k] !== cb[k]).map(k => `${k}:${ca[k]||0}->${cb[k]||0}`).join(' ');
  }
  rows.push(['changed', n, a[n].length, b[n].length, note]);
}
for (const r of rows) console.log(r.map(String).join('\t'));
const tally = rows.reduce((t, r) => (t[r[0]] = (t[r[0]]||0) + 1, t), {});
console.log('TALLY', JSON.stringify(tally));
if (showIdx > 0) { const p = process.argv[showIdx+1]; console.log('--- before', p, '\n', a[p] && strFromU8(a[p])); console.log('--- after', p, '\n', b[p] && strFromU8(b[p])); }
