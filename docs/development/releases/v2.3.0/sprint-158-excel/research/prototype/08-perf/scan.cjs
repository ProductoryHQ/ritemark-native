// Custom sheet reader: one pass over sheet XML -> column-major-free flat arrays (row, col, style, type, raw value)
function parseSst(xml) {
  const out = []; const re = /<si>([\s\S]*?)<\/si>/g; let m;
  while ((m = re.exec(xml))) { let s = ''; const t = /<t(?:\s[^>]*)?>([^<]*)<\/t>/g; let n; while ((n = t.exec(m[1]))) s += n[1];
    out.push(s.indexOf('&') >= 0 ? s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') : s); }
  return out;
}
function colNum(ref) { let n = 0, i = 0; for (; i < ref.length; i++) { const c = ref.charCodeAt(i); if (c < 65) break; n = n * 26 + c - 64; } return [n - 1, Number(ref.slice(i)) - 1]; }
function scanSheet(xml, sst, onlyStyles) {
  const rows = [], cols = [], styles = [], values = [];
  const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let m;
  while ((m = re.exec(xml))) {
    const a = m[1]; const r = /\sr="([A-Z]+\d+)"/.exec(a); const s = /\ss="(\d+)"/.exec(a);
    const [c, rr] = colNum(r[1]); rows.push(rr); cols.push(c); styles.push(s ? Number(s[1]) : 0);
    if (onlyStyles) continue;
    const t = /\st="(\w+)"/.exec(a); const body = m[2] || '';
    const v = /<v>([^<]*)<\/v>/.exec(body);
    if (!t) values.push(v ? Number(v[1]) : null);
    else if (t[1] === 's') values.push(sst[Number(v[1])]);
    else if (t[1] === 'inlineStr') values.push((/<t[^>]*>([^<]*)<\/t>/.exec(body) || [])[1] || '');
    else if (t[1] === 'b') values.push(v && v[1] === '1');
    else values.push(v ? v[1] : null);
  }
  return { rows, cols, styles, values };
}
module.exports = { parseSst, scanSheet };
