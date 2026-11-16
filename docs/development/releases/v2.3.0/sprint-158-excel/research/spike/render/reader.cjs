// The spike's reader: .xlsx bytes -> a render model per sheet. What the sprint's webview reader would compute
// before layout: values formatted with numfmt, styles resolved, pixel sizes, merges, panes, drawings found.
const { unzipSync, strFromU8 } = require('fflate');
const numfmt = require('numfmt');
const { cssName, parseStyles, colorOf, fontOf, fontCss, attr, each, section, unesc } = require('./styles.cjs');

// numfmt has no Estonian locale: add one from Intl (an example of what the sprint would ship for `et`)
(function addEstonian() {
  const m = (opt) => Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('et', { month: opt, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, i, 1))).replace('.', ''));
  const d = (opt) => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat('et', { weekday: opt, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 1 + i))));
  numfmt.addLocale({ group: ' ', decimal: ',', mmmm: m('long'), mmm: m('short'), dddd: d('long'), ddd: d('short'), bool: ['TÕENE', 'VÄÄR'], ampm: ['AM', 'PM'] }, 'et');
})();

const fromX = (s) => unesc(s).replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const colNum = (letters) => { let n = 0; for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
const ref2rc = (ref) => { const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref); return m ? [Number(m[2]) - 1, colNum(m[1])] : null; };
const resolve = (base, target) => { if (target.startsWith('/')) return target.slice(1); const parts = base.split('/'); parts.pop(); for (const p of target.split('/')) { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); } return parts.join('/'); };
function rels(z, partPath) {
  const dir = partPath.split('/'); const file = dir.pop(); const relPath = [...dir, '_rels', file + '.rels'].join('/');
  const out = {}; if (!z[relPath]) return out;
  for (const m of strFromU8(z[relPath]).matchAll(/<Relationship\b([^>]*)\/?>/g)) out[attr(m[1], 'Id')] = { type: (attr(m[1], 'Type') || '').split('/').pop(), target: attr(m[1], 'TargetMode') === 'External' ? attr(m[1], 'Target') : resolve(partPath, attr(m[1], 'Target')) };
  return out;
}
function richRuns(body, ctx, baseFont) {
  const runs = [];
  for (const r of body.matchAll(/<(?:\w+:)?r>([\s\S]*?)<\/(?:\w+:)?r>/g)) {
    const t = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/.exec(r[1]); const pr = /<(?:\w+:)?rPr>([\s\S]*?)<\/(?:\w+:)?rPr>/.exec(r[1]);
    runs.push([t ? fromX(t[1]) : '', pr ? fontCss(fontOf(pr[1], ctx), null) : '']);
  }
  return runs;
}
function parseSst(xml, ctx, baseFont) {
  const out = [];
  for (const m of xml.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const body = m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
    if (/<(?:\w+:)?r>/.test(body)) { const runs = richRuns(body, ctx, baseFont); out.push({ text: runs.map(r => r[0]).join(''), runs }); }
    else { const t = /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/.exec(body); out.push({ text: t ? fromX(t[1]) : '' }); }
  }
  return out;
}
// Excel's column width -> pixels (ECMA-376 18.3.1.13), with MDW the default font's maximum digit width
const colPx = (w, mdw) => Math.trunc(((256 * w + Math.trunc(128 / mdw)) / 256) * mdw);
// Maximum digit width at 96 dpi of the Normal style's font. Known values for Office fonts; others scale from Calibri.
function maxDigitWidth(font) {
  const px = font.size * 4 / 3;
  const ratio = { 'calibri': 0.507, 'aptos narrow': 0.48, 'aptos': 0.55, 'arial': 0.556, 'cambria': 0.55, 'times new roman': 0.5 }[String(font.name || '').toLowerCase()] || 0.507;
  return Math.max(5, Math.round(px * ratio));
}

function chartInfo(z, chartPath) {
  if (!z[chartPath]) return { title: null, type: 'chart' };
  const x = strFromU8(z[chartPath]);
  const title = section(x, 'title'); const ts = [...title.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => fromX(m[1])).join('');
  const type = (/<c:(bar|line|pie|area|scatter|doughnut|radar|bubble|stock|surface|bar3D|line3D|pie3D|area3D)Chart\b/.exec(x) || [])[1] || 'chart';
  return { title: ts || null, type };
}
function drawings(z, drawingPath) {
  const out = []; if (!z[drawingPath]) return out;
  const x = strFromU8(z[drawingPath]); const rr = rels(z, drawingPath);
  const emu = (v) => Number(v || 0) / 9525;
  for (const m of x.matchAll(/<(?:\w+:)?(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/g)) {
    const body = m[2];
    const pt = (tag) => { const s = section(body, tag); if (!s) return null; const g = (t) => (new RegExp(`<(?:\\w+:)?${t}>([^<]*)<`).exec(s) || [])[1]; return { col: Number(g('col')), colOff: emu(g('colOff')), row: Number(g('row')), rowOff: emu(g('rowOff')) }; };
    const ext = /<(?:\w+:)?ext\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(body);
    const pos = /<(?:\w+:)?pos\b[^>]*x="(\d+)"[^>]*y="(\d+)"/.exec(body);
    const anchor = { kind: m[1], from: pt('from'), to: pt('to'), ext: ext ? { w: emu(ext[1]), h: emu(ext[2]) } : null, pos: pos ? { x: emu(pos[1]), y: emu(pos[2]) } : null };
    const chartRid = /<(?:\w+:)?chart\b[^>]*r:id="([^"]+)"/.exec(body); const blip = /<(?:\w+:)?blip\b[^>]*r:embed="([^"]+)"/.exec(body);
    const name = attr((/<(?:\w+:)?cNvPr\b([^>]*)/.exec(body) || [])[1], 'name');
    if (chartRid) out.push({ what: 'chart', name, ...chartInfo(z, (rr[chartRid[1]] || {}).target), anchor });
    else if (blip) out.push({ what: 'image', name, anchor });
    else if (/<(?:\w+:)?sp>/.test(body)) out.push({ what: 'shape', name, anchor });
  }
  return out;
}

function readWorkbook(bytes, opts = {}) {
  const t0 = performance.now();
  const z = unzipSync(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  const tUnzip = performance.now();
  const s = (p) => (z[p] ? strFromU8(z[p]) : '');
  const wbPath = 'xl/workbook.xml'; const wbx = s(wbPath); const wbRels = rels(z, wbPath);
  const date1904 = /date1904="(1|true)"/.test(wbx);
  const activeTab = Number(attr((/<(?:\w+:)?workbookView\b([^>]*)/.exec(wbx) || [])[1], 'activeTab') || 0);
  const relOfType = (t) => Object.values(wbRels).find(r => r.type === t);
  const stylesPart = relOfType('styles'), themePart = relOfType('theme'), sstPart = relOfType('sharedStrings');
  const st = parseStyles(stylesPart ? s(stylesPart.target) : '', themePart ? s(themePart.target) : '');
  const sst = sstPart ? parseSst(s(sstPart.target), st.ctx, st.baseFont) : [];
  const mdw = maxDigitWidth(st.baseFont);
  const fmtOpts = { locale: opts.locale || '', fillChar: '\u0001', throws: false, leap1900: true };
  const fmtCache = new Map();
  const fmtCode = (id) => st.numFmts[id] ?? numfmt.getFormatFromId(Number(id)) ?? 'General';
  const sheets = [];
  for (const m of wbx.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
    const name = unesc(attr(m[1], 'name')); const state = attr(m[1], 'state') || 'visible'; const rid = attr(m[1], 'id');
    const rel = wbRels[rid] || {}; const path = rel.target;
    if (rel.type === 'chartsheet') {
      const cs = s(path); const crel = rels(z, path); const did = attr((/<(?:\w+:)?drawing\b([^>]*)/.exec(cs) || [])[1], 'id');
      const dr = did && crel[did] ? drawings(z, crel[did].target) : [];
      sheets.push({ name, state, kind: 'chartsheet', tabColor: colorOf((/<(?:\w+:)?tabColor\b[^>]*\/?>/.exec(cs) || [])[0], st.ctx), drawings: dr });
      continue;
    }
    if (rel.type !== 'worksheet') { sheets.push({ name, state, kind: rel.type || 'unknown' }); continue; }
    const x = s(path); const srel = rels(z, path);
    const sheetPr = /<(?:\w+:)?sheetPr\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?sheetPr>)/.exec(x);
    const tabColor = colorOf((/<(?:\w+:)?tabColor\b[^>]*\/?>/.exec(sheetPr ? sheetPr[1] || '' : '') || [])[0], st.ctx);
    const sv = /<(?:\w+:)?sheetView\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?sheetView>)/.exec(x);
    const svA = sv ? sv[1] : ''; const pane = sv && sv[2] ? /<(?:\w+:)?pane\b([^>]*)\/?>/.exec(sv[2]) : null;
    const frozen = pane && /frozen/.test(attr(pane[1], 'state') || '') ? { cols: Number(attr(pane[1], 'xSplit') || 0), rows: Number(attr(pane[1], 'ySplit') || 0) } : { cols: 0, rows: 0 };
    const fpr = /<(?:\w+:)?sheetFormatPr\b([^>]*)\/?>/.exec(x); const fA = fpr ? fpr[1] : '';
    const defaultRowPt = Number(attr(fA, 'defaultRowHeight') || 15);
    const zeroHeight = attr(fA, 'zeroHeight') === '1';
    const defaultColPx = attr(fA, 'defaultColWidth') !== undefined ? colPx(Number(attr(fA, 'defaultColWidth')), mdw)
      : Math.ceil((Number(attr(fA, 'baseColWidth') || 8) * mdw + 5) / 8) * 8;
    const colDefs = [];
    for (const c of section(x, 'cols').matchAll(/<(?:\w+:)?col\b([^>]*)\/?>/g)) {
      const a = c[1]; colDefs.push({ min: Number(attr(a, 'min')) - 1, max: Number(attr(a, 'max')) - 1, px: attr(a, 'width') !== undefined ? colPx(Number(attr(a, 'width')), mdw) : defaultColPx,
        hidden: attr(a, 'hidden') === '1' || attr(a, 'hidden') === 'true', style: attr(a, 'style') !== undefined ? Number(attr(a, 'style')) : null });
    }
    const rowDefs = new Map(); const cells = []; let maxR = -1, maxC = -1;
    const rowRe = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g; let rm; let nextRow = 0;
    let wrapCells = 0, richCells = 0;
    while ((rm = rowRe.exec(x))) {
      const a = rm[1]; const r = attr(a, 'r') !== undefined ? Number(attr(a, 'r')) - 1 : nextRow; nextRow = r + 1;
      const ht = attr(a, 'ht');
      rowDefs.set(r, { px: ht !== undefined ? Math.round(Number(ht) * 4 / 3) : null, custom: attr(a, 'customHeight') === '1', hidden: attr(a, 'hidden') === '1' || attr(a, 'hidden') === 'true',
        style: attr(a, 'customFormat') === '1' ? Number(attr(a, 's') || 0) : null });
      if (!rm[2]) continue;
      let nextCol = 0;
      for (const cm of rm[2].matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const ca = cm[1]; const body = cm[2] || '';
        const rc = attr(ca, 'r') ? ref2rc(attr(ca, 'r')) : [r, nextCol]; const c = rc[1]; nextCol = c + 1;
        const si = Number(attr(ca, 's') || 0); const t = attr(ca, 't') || 'n';
        const v = (/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(body) || [])[1];
        let kind = 'n', text = '', runs = null, value = null, color = null, fill = null;
        if (t === 's') { const e = sst[Number(v)] || { text: '' }; kind = 's'; value = e.text; runs = e.runs || null; }
        else if (t === 'inlineStr') { const is = section(body, 'is'); if (/<(?:\w+:)?r>/.test(is)) { runs = richRuns(is, st.ctx); value = runs.map(q => q[0]).join(''); } else value = fromX((/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/.exec(is) || [])[1] || ''); kind = 's'; }
        else if (t === 'str') { kind = 's'; value = v !== undefined ? fromX(v) : ''; }
        else if (t === 'b') { kind = 'b'; value = v === '1'; }
        else if (t === 'e') { kind = 'e'; value = v !== undefined ? fromX(v) : '#N/A'; }
        else if (t === 'd') { kind = 'n'; value = v !== undefined ? numfmt.dateToSerial(new Date(v)) : null; }
        else { value = v !== undefined && v !== '' ? Number(v) : null; }
        const xf = st.xfs[si] || st.xfs[0] || { fmtId: '0', align: {} };
        if (value === null || value === '') { if (si) cells.push({ r, c, s: si, kind: 'blank', text: '' }); maxR = Math.max(maxR, r); maxC = Math.max(maxC, c); continue; }
        const code = fmtCode(xf.fmtId);
        if (kind === 'n') {
          const val = date1904 ? value + 1462 : value;
          const key = code; let f = fmtCache.get(key); if (!f) { f = { code, color: /\[(red|blue|green|black|white|yellow|magenta|cyan|color\s*\d+)\]/i.test(code) }; fmtCache.set(key, f); }
          text = numfmt.format(code, numfmt.isDateFormat(code) ? val : value, fmtOpts);
          if (f.color) color = numfmt.formatColor(code, value);
        } else if (kind === 's') {
          text = value; if (code !== 'General' && code !== '@' && /@/.test(code)) text = numfmt.format(code, value, fmtOpts);
        } else if (kind === 'b') text = value ? (opts.locale === 'et' ? 'TÕENE' : 'TRUE') : (opts.locale === 'et' ? 'VÄÄR' : 'FALSE');
        else text = String(value);
        if (text.includes('\u0001')) { const i = text.indexOf('\u0001'); fill = [text.slice(0, i), text.slice(i + 2)]; text = text.slice(0, i) + text.slice(i + 2); }
        if (xf.align && xf.align.wrap) wrapCells++; if (runs) richCells++;
        cells.push({ r, c, s: si, kind, text, runs, color, fill, isDate: kind === 'n' && numfmt.isDateFormat(code) });
        maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
      }
      maxR = Math.max(maxR, rowDefs.get(r).style !== null || rowDefs.get(r).px !== null ? r : -1, maxR);
    }
    const merges = [...section(x, 'mergeCells').matchAll(/<(?:\w+:)?mergeCell\b[^>]*ref="([^"]+)"/g)].map(m => { const [a, b] = m[1].split(':'); const p = ref2rc(a), q = ref2rc(b || a); maxR = Math.max(maxR, q[0]); maxC = Math.max(maxC, q[1]); return [p[0], p[1], q[0], q[1]]; });
    const cfRanges = [...x.matchAll(/<(?:\w+:)?conditionalFormatting\b[^>]*sqref="([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?conditionalFormatting>/g)].map(m => ({ sqref: m[1], types: [...m[2].matchAll(/type="(\w+)"/g)].map(q => q[1]) }));
    const cfCells = cfRanges.reduce((n, cf) => n + cf.sqref.split(/\s+/).reduce((k, rg) => { const [a, b] = rg.split(':'); const p = ref2rc(a), q = ref2rc(b || a); return p && q ? k + (q[0] - p[0] + 1) * (q[1] - p[1] + 1) : k; }, 0), 0);
    const dv = (x.match(/<(?:\w+:)?dataValidation\b/g) || []).length;
    let dr = []; const did = attr((/<(?:\w+:)?drawing\b([^>]*)/.exec(x) || [])[1], 'id');
    if (did && srel[did]) dr = drawings(z, srel[did].target);
    const comments = []; for (const r of Object.values(srel)) if (r.type === 'comments' && z[r.target]) for (const m of s(r.target).matchAll(/<(?:\w+:)?comment\b[^>]*ref="([^"]+)"/g)) comments.push(ref2rc(m[1]));
    const tables = Object.values(srel).filter(r => r.type === 'table').length;
    for (const d of dr) { const a = d.anchor; // a one-cell anchor gives a size, not an end cell: estimate the end from default sizes
      const end = a.to || (a.from && a.ext ? { row: a.from.row + Math.ceil(a.ext.h / Math.round(defaultRowPt * 4 / 3)), col: a.from.col + Math.ceil(a.ext.w / defaultColPx) } : a.from);
      if (end) { maxR = Math.max(maxR, end.row); maxC = Math.max(maxC, end.col); } }
    sheets.push({ name, state, kind: 'worksheet', tabColor, tabSelected: attr(svA, 'tabSelected') === '1',
      showGridLines: attr(svA, 'showGridLines') !== '0' && attr(svA, 'showGridLines') !== 'false', showHeaders: attr(svA, 'showRowColHeaders') !== '0',
      zoom: Number(attr(svA, 'zoomScale') || 100), rtl: attr(svA, 'rightToLeft') === '1',
      frozen, mdw, defaultColPx, defaultRowPx: Math.round(defaultRowPt * 4 / 3), zeroHeight, colDefs, rowDefs: [...rowDefs.entries()],
      cells, merges, maxR, maxC, cf: { ranges: cfRanges.length, cells: cfCells, types: [...new Set(cfRanges.flatMap(c => c.types))] }, dataValidations: dv,
      drawings: dr, comments, tables, stats: { wrapCells, richCells } });
  }
  const t1 = performance.now();
  // The style data the layout needs, per xf
  const xfs = st.xfs.map(xf => ({ font: xf.font, fill: xf.fill, border: xf.border, align: xf.align, fontName: xf.fontName, fontPx: xf.fontPx }));
  return { sheets, xfs, baseFont: st.baseFont, baseFontCss: `font-family:${cssName(st.baseFont.name || "Calibri")},sans-serif;font-size:${(st.baseFont.size * 4 / 3).toFixed(2)}px;color:${st.baseFont.color || '#000'}`,
    families: [...new Set(st.fonts.map(f => f.name).filter(Boolean))], activeTab, date1904, patternedFills: st.patterned, theme: st.theme,
    timing: { unzipMs: +(tUnzip - t0).toFixed(1), parseMs: +(t1 - tUnzip).toFixed(1), totalMs: +(t1 - t0).toFixed(1) } };
}
module.exports = { readWorkbook, colPx, maxDigitWidth };
