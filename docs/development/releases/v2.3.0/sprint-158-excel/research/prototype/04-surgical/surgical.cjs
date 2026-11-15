// Surgical xlsx save: change only the edited cells' XML; every other part keeps its bytes.
// edits: [{ sheet: 'Budget', ref: 'A3', value: 'text' | 123 | null }]
const { unzipSync, zipSync, strFromU8, strToU8 } = require('fflate');

const REL_NS_CALCCHAIN = 'relationships/calcChain';
const dec = (u8) => strFromU8(u8);
const enc = (s) => strToU8(s);

function colToNum(col) { let n = 0; for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function numToCol(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function splitRef(ref) { const m = /^([A-Z]{1,3})(\d+)$/.exec(ref); if (!m) throw new Error('bad ref ' + ref); return { c: colToNum(m[1]), r: Number(m[2]) }; }
function attr(tagText, name) { const m = new RegExp('(?:^|\\s)' + name + '="([^"]*)"').exec(tagText); return m ? m[1] : undefined; }
function setAttr(tagText, name, value) {
  const re = new RegExp('(\\s)' + name + '="[^"]*"');
  if (re.test(tagText)) return tagText.replace(re, `$1${name}="${value}"`);
  return tagText.replace(/(\/?>)$/, ` ${name}="${value}"$1`);
}
function escText(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/_x([0-9A-Fa-f]{4})_/g, '_x005F_x$1_')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function resolvePath(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/'); parts.pop();
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}

/** Map sheet name -> part path via workbook.xml + its rels. */
function sheetParts(files) {
  const rootRels = dec(files['_rels/.rels']);
  const wbTarget = /Type="[^"]*officeDocument"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*officeDocument"/.exec(rootRels);
  const wbPath = resolvePath('', (wbTarget[1] || wbTarget[2]));
  const wbXml = dec(files[wbPath]);
  const relsPath = wbPath.replace(/([^/]+)$/, '_rels/$1.rels');
  const rels = {}; const relsXml = dec(files[relsPath]);
  for (const m of relsXml.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)) rels[attr(m[1], 'Id')] = { target: attr(m[1], 'Target'), type: attr(m[1], 'Type') };
  const sheets = {};
  for (const m of wbXml.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)) {
    const name = attr(m[1], 'name').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    const rid = attr(m[1], 'r:id') || (/\s\w+:id="([^"]+)"/.exec(m[1]) || [])[1];
    sheets[name] = resolvePath(wbPath, rels[rid].target);
  }
  return { wbPath, relsPath, sheets, rels };
}

// ---- formula translation for shared formulas (relative A1 refs shift; $-anchored parts stay) ----
function shiftFormula(f, dr, dc) {
  let out = '', i = 0;
  const refRe = /^(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![\w(])/;
  const colRangeRe = /^(\$?)([A-Z]{1,3}):(\$?)([A-Z]{1,3})(?![\w(])/;
  const rowRangeRe = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})(?![\w(])/;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"') { const j = f.indexOf('"', i + 1); let k = j; while (f[k + 1] === '"') k = f.indexOf('"', k + 2); out += f.slice(i, k + 1); i = k + 1; continue; }
    if (ch === "'") { let k = i + 1; while (k < f.length && !(f[k] === "'" && f[k + 1] !== "'")) k += f[k] === "'" ? 2 : 1; out += f.slice(i, k + 1); i = k + 1; continue; }
    if (ch === '[') { const k = f.indexOf(']', i); out += f.slice(i, k + 1); i = k + 1; continue; } // structured refs / external book index
    const prev = i > 0 ? f[i - 1] : '';
    if (!/[\w.]/.test(prev)) {
      const rest = f.slice(i);
      let m;
      if ((m = colRangeRe.exec(rest))) { const a = m[1] ? m[2] : numToCol(colToNum(m[2]) + dc); const b = m[3] ? m[4] : numToCol(colToNum(m[4]) + dc); out += `${m[1]}${a}:${m[3]}${b}`; i += m[0].length; continue; }
      if ((m = rowRangeRe.exec(rest))) { const a = m[1] ? m[2] : Number(m[2]) + dr; const b = m[3] ? m[4] : Number(m[4]) + dr; out += `${m[1]}${a}:${m[3]}${b}`; i += m[0].length; continue; }
      if ((m = refRe.exec(rest))) {
        const c = m[1] ? m[2] : numToCol(colToNum(m[2]) + dc); const r = m[3] ? m[4] : Number(m[4]) + dr;
        if (colToNum(c) < 1 || Number(r) < 1) throw new Error('shift out of sheet');
        out += `${m[1]}${c}${m[3]}${r}`; i += m[0].length; continue;
      }
      const name = /^[A-Za-z_\\][\w.]*/.exec(rest); // a function or defined name: copy whole token
      if (name) { out += name[0]; i += name[0].length; continue; }
    }
    out += ch; i++;
  }
  return out;
}

function decodeEntities(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }

/** Locate a cell in sheet XML. Returns positions for replace/insert. Handles rows/cells without r. */
function locate(xml, target, p) {
  const sdOpen = new RegExp(`<${p}sheetData\\b[^>]*?(/?)>`).exec(xml);
  if (!sdOpen) throw new Error('no sheetData');
  if (sdOpen[1] === '/') return { kind: 'emptySheetData', at: sdOpen.index, len: sdOpen[0].length };
  const sdEnd = xml.indexOf(`</${p}sheetData>`, sdOpen.index);
  const rowRe = new RegExp(`<${p}row\\b([^>]*?)(/?)>`, 'g');
  rowRe.lastIndex = sdOpen.index + sdOpen[0].length;
  let implicitRow = 0, m;
  while ((m = rowRe.exec(xml)) && m.index < sdEnd) {
    const r = attr(m[1], 'r') ? Number(attr(m[1], 'r')) : implicitRow + 1; implicitRow = r;
    const selfClose = m[2] === '/';
    const rowEnd = selfClose ? m.index + m[0].length : xml.indexOf(`</${p}row>`, m.index) + `</${p}row>`.length;
    if (r > target.r) return { kind: 'newRowBefore', at: m.index };
    if (r === target.r) {
      if (selfClose) return { kind: 'expandRow', rowStart: m.index, rowTag: m[0], rowEnd };
      const cellRe = new RegExp(`<${p}c\\b([^>]*?)(/?)>`, 'g'); cellRe.lastIndex = m.index + m[0].length;
      let implicitCol = 0, cm;
      const closeRow = rowEnd - `</${p}row>`.length;
      while ((cm = cellRe.exec(xml)) && cm.index < closeRow) {
        const ref = attr(cm[1], 'r'); const c = ref ? splitRef(ref).c : implicitCol + 1; implicitCol = c;
        const cEnd = cm[2] === '/' ? cm.index + cm[0].length : xml.indexOf(`</${p}c>`, cm.index) + `</${p}c>`.length;
        if (c > target.c) return { kind: 'newCellBefore', at: cm.index, rowTag: m[0] };
        if (c === target.c) return { kind: 'replace', start: cm.index, end: cEnd, open: cm[0], body: xml.slice(cm.index + cm[0].length, cEnd), rowTag: m[0] };
        cellRe.lastIndex = cEnd;
      }
      return { kind: 'newCellBefore', at: closeRow, rowTag: m[0] };
    }
    rowRe.lastIndex = rowEnd;
  }
  return { kind: 'newRowBefore', at: sdEnd };
}


/** Rows or cells without r get explicit positions first, so an inserted cell cannot shift its neighbours. */
function normalizeRefs(xml, p) {
  if (!new RegExp(`<${p}row\\b(?![^>]*\\sr=)|<${p}c\\b(?![^>]*\\sr=)`).test(xml)) return xml;
  let row = 0, col = 0;
  return xml.replace(new RegExp(`<${p}(row|c)\\b([^>]*?)(/?)>`, 'g'), (all, tag, attrs, sc) => {
    if (tag === 'row') { const r = attr(attrs, 'r'); row = r ? Number(r) : row + 1; col = 0; return r ? all : `<${p}row r="${row}"${attrs}${sc}>`; }
    const r = attr(attrs, 'r'); col = r ? splitRef(r).c : col + 1; return r ? all : `<${p}c r="${numToCol(col)}${row}"${attrs}${sc}>`;
  });
}

function applyEdits(bytes, edits, opts = {}) {
  const files = unzipSync(bytes);
  const order = Object.keys(files);
  const touched = new Set(); const report = { formulasRemoved: 0, calcChainDropped: false, refused: [] };
  const { wbPath, relsPath, sheets, rels } = sheetParts(files);
  // shared strings part (optional)
  const sstRel = Object.values(rels).find(r => /\/sharedStrings$/.test(r.type));
  const sstPath = sstRel && resolvePath(wbPath, sstRel.target);
  let sst = sstPath && files[sstPath] ? dec(files[sstPath]) : null;
  let sstCount = sst ? (sst.match(/<(?:\w+:)?si[\s>]/g) || []).length : 0;
  const sheetXml = {};
  for (const e of edits) {
    const path = sheets[e.sheet]; if (!path) throw new Error('no sheet ' + e.sheet);
    let xml = sheetXml[path] ?? dec(files[path]);
    const p = (/^<(?:\?[^>]*\?>\s*)?<(\w+:)?worksheet\b/.exec(xml.replace(/^\uFEFF/, '').trimStart()) || /<(\w+:)?worksheet\b/.exec(xml))[1] || '';
    xml = normalizeRefs(xml, p);
    const target = splitRef(e.ref);
    // refuse edits inside a multi-cell array formula or data table
    for (const am of xml.matchAll(new RegExp(`<${p}f\\b([^>]*t="(?:array|dataTable)"[^>]*)>`, 'g'))) {
      const ref = attr(am[1], 'ref'); if (!ref || !ref.includes(':')) continue;
      const [a, b] = ref.split(':').map(splitRef);
      if (target.r >= a.r && target.r <= b.r && target.c >= a.c && target.c <= b.c) { report.refused.push({ ...e, reason: 'array formula or data table ' + ref }); xml = null; break; }
    }
    if (xml === null) continue;
    const loc = locate(xml, target, p);
    let style;
    if (loc.kind === 'replace') {
      style = attr(loc.open, 's');
      const fOpen = new RegExp(`<${p}f\\b([^>]*?)(/?)>`).exec(loc.body);
      if (fOpen) {
        report.formulasRemoved++;
        const fa = fOpen[1];
        if (attr(fa, 't') === 'shared' && attr(fa, 'ref')) {
          // master of a shared formula: give each dependent its own translated formula
          const si = attr(fa, 'si');
          const fText = decodeEntities(loc.body.slice(fOpen.index + fOpen[0].length, loc.body.indexOf(`</${p}f>`)));
          const depRe = new RegExp(`<${p}c\\b([^>]*?)>((?:(?!</${p}c>).)*?)<${p}f\\b([^>]*\\bsi="${si}"[^>]*?)/>`, 'gs');
          xml = xml.replace(depRe, (all, cAttrs, pre, fAttrs) => {
            if (!/t="shared"/.test(fAttrs) || attr(fAttrs, 'ref')) return all;
            const at = splitRef(attr(cAttrs, 'r'));
            const translated = shiftFormula(fText, at.r - target.r, at.c - target.c);
            return `<${p}c${cAttrs}>${pre}<${p}f>${escText(translated)}</${p}f>`;
          });
          // positions moved: locate again
          const again = locate(xml, target, p); Object.assign(loc, again);
        }
      }
    } else {
      // new cell: inherit the row's style (customFormat) or the column's style, as Excel does
      const rowTag = loc.rowTag || '';
      if (rowTag && attr(rowTag, 'customFormat') === '1') style = attr(rowTag, 's');
      if (style === undefined) {
        for (const cm of xml.matchAll(new RegExp(`<${p}col\\b([^>]*)/?>`, 'g'))) {
          if (target.c >= Number(attr(cm[1], 'min')) && target.c <= Number(attr(cm[1], 'max'))) { style = attr(cm[1], 'style'); break; }
        }
      }
    }
    let cellXml = '';
    if (e.value !== null && e.value !== '') {
      const sAttr = style !== undefined && style !== '0' ? ` s="${style}"` : '';
      if (typeof e.value === 'number' && Number.isFinite(e.value)) cellXml = `<${p}c r="${e.ref}"${sAttr}><${p}v>${e.value}</${p}v></${p}c>`;
      else if (sst !== null && !opts.inlineStrings) {
        const text = String(e.value);
        const pre = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : '';
        const sp = (/<(\w+:)?sst\b/.exec(sst) || [])[1] || '';
        sst = sst.replace(new RegExp(`</${sp}sst>\\s*$`), `<${sp}si><${sp}t${pre}>${escText(text)}</${sp}t></${sp}si></${sp}sst>`);
        cellXml = `<${p}c r="${e.ref}"${sAttr} t="s"><${p}v>${sstCount}</${p}v></${p}c>`; sstCount++;
        touched.add(sstPath);
      } else {
        const text = String(e.value); const pre = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : '';
        cellXml = `<${p}c r="${e.ref}"${sAttr} t="inlineStr"><${p}is><${p}t${pre}>${escText(text)}</${p}t></${p}is></${p}c>`;
      }
    } else if (style !== undefined && loc.kind === 'replace' && style !== '0') {
      cellXml = `<${p}c r="${e.ref}" s="${style}"/>`; // cleared value keeps the cell's formatting
    }
    if (loc.kind === 'replace') xml = xml.slice(0, loc.start) + cellXml + xml.slice(loc.end);
    else if (cellXml) {
      if (loc.kind === 'newCellBefore') xml = xml.slice(0, loc.at) + cellXml + xml.slice(loc.at);
      else if (loc.kind === 'newRowBefore') xml = xml.slice(0, loc.at) + `<${p}row r="${target.r}">${cellXml}</${p}row>` + xml.slice(loc.at);
      else if (loc.kind === 'expandRow') xml = xml.slice(0, loc.rowStart) + loc.rowTag.replace(/\/>$/, '>') + cellXml + `</${p}row>` + xml.slice(loc.rowEnd);
      else if (loc.kind === 'emptySheetData') xml = xml.slice(0, loc.at) + `<${p}sheetData><${p}row r="${target.r}">${cellXml}</${p}row></${p}sheetData>` + xml.slice(loc.at + loc.len);
      // grow <dimension> when the edit lands outside it
      const dm = new RegExp(`<${p}dimension\\b[^>]*ref="([A-Z]+\\d+)(?::([A-Z]+\\d+))?"`).exec(xml);
      if (dm) {
        const a = splitRef(dm[1]), b = splitRef(dm[2] || dm[1]);
        const n = { r1: Math.min(a.r, target.r), c1: Math.min(a.c, target.c), r2: Math.max(b.r, target.r), c2: Math.max(b.c, target.c) };
        const nref = `${numToCol(n.c1)}${n.r1}:${numToCol(n.c2)}${n.r2}`;
        if (nref !== `${dm[1]}:${dm[2] || dm[1]}`) xml = xml.replace(dm[0], dm[0].replace(/ref="[^"]*"/, `ref="${nref}"`));
      }
    }
    sheetXml[path] = xml; touched.add(path);
  }
  for (const [path, xml] of Object.entries(sheetXml)) files[path] = enc(xml);
  if (sst !== null && touched.has(sstPath)) {
    sst = sst.replace(/(<(?:\w+:)?sst\b[^>]*?)\suniqueCount="\d+"/, `$1 uniqueCount="${sstCount}"`);
    sst = sst.replace(/(<(?:\w+:)?sst\b[^>]*?)\scount="(\d+)"/, (all, a, n) => `${a} count="${Number(n) + edits.length}"`);
    files[sstPath] = enc(sst);
  }
  if (touched.size) {
    // formulas: ask Excel to recalculate on open (cached values of dependents are stale)
    let wb = dec(files[wbPath]);
    const wp = (/<(\w+:)?workbook\b/.exec(wb) || [])[1] || '';
    const calc = new RegExp(`<${wp}calcPr\\b[^>]*?/?>`).exec(wb);
    if (calc) { if (attr(calc[0], 'fullCalcOnLoad') !== '1') wb = wb.replace(calc[0], setAttr(calc[0], 'fullCalcOnLoad', '1')); }
    else {
      const after = new RegExp(`</${wp}definedNames>|<${wp}definedNames\\b[^>]*/>|</${wp}externalReferences>|</${wp}functionGroups>|</${wp}sheets>`);
      const anchors = [...wb.matchAll(new RegExp(after.source, 'g'))]; const last = anchors.sort((x, y) => y.index - x.index)[0];
      const at = last.index + last[0].length; wb = wb.slice(0, at) + `<${wp}calcPr fullCalcOnLoad="1"/>` + wb.slice(at);
    }
    if (wb !== dec(files[wbPath])) { files[wbPath] = enc(wb); touched.add(wbPath); }
    // calcChain lists formula cells; once a formula is removed, drop it so Excel rebuilds it
    const cc = Object.entries(rels).find(([, r]) => r.type.endsWith(REL_NS_CALCCHAIN));
    if (cc && report.formulasRemoved > 0) {
      const ccPath = resolvePath(wbPath, cc[1].target);
      delete files[ccPath];
      files[relsPath] = enc(dec(files[relsPath]).replace(new RegExp(`<(?:\\w+:)?Relationship\\b[^>]*Id="${cc[0]}"[^>]*/>`), ''));
      files['[Content_Types].xml'] = enc(dec(files['[Content_Types].xml']).replace(new RegExp(`<Override\\b[^>]*PartName="/${ccPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`), ''));
      touched.add(relsPath); touched.add('[Content_Types].xml'); report.calcChainDropped = true;
    }
  }
  const out = {};
  for (const n of order) if (files[n]) out[n] = files[n];
  report.touched = [...touched];
  return { bytes: zipSync(out, { level: 6 }), report };
}
module.exports = { applyEdits, shiftFormula, locate };
