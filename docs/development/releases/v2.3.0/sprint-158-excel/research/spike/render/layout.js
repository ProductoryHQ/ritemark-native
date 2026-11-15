// Client side of the spike renderer: lays one sheet out as Excel would, from the reader's model.
// Runs in the page (as it would in the webview). Static: no virtualization, no editing.
(async function () {
  const T0 = performance.now();
  const M = JSON.parse(document.getElementById('model').textContent);
  const S = M.sheet, XF = M.xfs;
  const out = { overflowCells: 0, hashCells: 0, autofitRows: 0, slots: 0, textNodes: 0 };

  // ---- fonts: officeFonts.ts, ported (Calibri/Aptos/Cambria -> Arial/Georgia at 88 % where missing; other names -> Arial at 100 %)
  const ARIAL = { regular: 'Arial', bold: 'Arial Bold', italic: 'Arial Italic', boldItalic: 'Arial Bold Italic' };
  const GEORGIA = { regular: 'Georgia', bold: 'Georgia Bold', italic: 'Georgia Italic', boldItalic: 'Georgia Bold Italic' };
  const OFFICE = [['Calibri', ARIAL], ['Calibri Light', ARIAL], ['Aptos', ARIAL], ['Aptos Display', ARIAL], ['Aptos Narrow', ARIAL], ['Cambria', GEORGIA]].map(([family, f]) => ({ family, ...f }));
  const SYMBOL = new Set(['wingdings', 'wingdings 2', 'wingdings 3', 'webdings', 'symbol', 'marlett', 'mt extra']);
  const aliasCss = (list, adj) => list.flatMap(a => [['regular', 'normal', 'normal'], ['bold', 'bold', 'normal'], ['italic', 'normal', 'italic'], ['boldItalic', 'bold', 'italic']]
    .map(([face, w, st]) => `@font-face { font-family: '${a.family}'; font-weight: ${w}; font-style: ${st}; src: local('${a[face]}'); size-adjust: ${adj}%; }`)).join('\n');
  function isFontInstalled(family) {
    const ctx = document.createElement('canvas').getContext('2d'); const sample = 'mmmmmmmmmmlli WQ@#0123456789';
    return ['monospace', 'serif', 'sans-serif'].some(g => { ctx.font = `72px ${g}`; const base = ctx.measureText(sample).width; ctx.font = `72px '${family}', ${g}`; return ctx.measureText(sample).width !== base; });
  }
  const missingOffice = OFFICE.filter(a => !isFontInstalled(a.family));
  const officeNames = new Set(OFFICE.map(a => a.family.toLowerCase()));
  const otherMissing = M.families.filter(f => !officeNames.has(f.toLowerCase()) && !SYMBOL.has(f.toLowerCase()) && !isFontInstalled(f)).map(family => ({ family, ...ARIAL }));
  const fontStyle = document.createElement('style'); fontStyle.textContent = aliasCss(missingOffice, 88) + '\n' + aliasCss(otherMissing, 100); document.head.appendChild(fontStyle);
  out.fontAliases = missingOffice.map(a => a.family).concat(otherMissing.map(a => a.family + ' (100%)'));
  await Promise.all(M.families.flatMap(f => ['', 'bold ', 'italic '].map(w => document.fonts.load(`${w}16px "${f}"`).catch(() => null))));
  await document.fonts.ready;
  const tFonts = performance.now();

  // ---- extent and sizes
  const nR = Math.max(S.maxR + 1 + 3, S.frozen.rows + 1, 12), nC = Math.max(S.maxC + 1 + 2, S.frozen.cols + 1, 6);
  const colW = new Array(nC).fill(S.defaultColPx), colStyle = new Array(nC).fill(null);
  for (const d of S.colDefs) for (let c = d.min; c <= Math.min(d.max, nC - 1); c++) { colW[c] = d.hidden ? 0 : d.px; colStyle[c] = d.style; }
  const rowDef = new Map(S.rowDefs);
  const rowH = new Array(nR), rowStyle = new Array(nR).fill(null), rowAuto = new Array(nR).fill(false);
  for (let r = 0; r < nR; r++) { const d = rowDef.get(r); rowStyle[r] = d ? d.style : null;
    if (d && d.hidden) rowH[r] = 0; else if (d && d.px !== null) rowH[r] = d.px; else if (S.zeroHeight) rowH[r] = 0; else { rowH[r] = S.defaultRowPx; rowAuto[r] = true; } }
  const key = (r, c) => r * 16384 + c;
  const cells = new Map(); for (const c of S.cells) cells.set(key(c.r, c.c), c);
  const mergeAt = new Map(); // key -> merge index (all covered slots)
  S.merges.forEach((m, i) => { for (let r = m[0]; r <= m[2]; r++) for (let c = m[1]; c <= m[3]; c++) mergeAt.set(key(r, c), i); });
  const styleOf = (r, c) => { const cell = cells.get(key(r, c)); if (cell) return cell.s; if (rowStyle[r] !== null) return rowStyle[r]; if (colStyle[c] !== null) return colStyle[c]; return 0; };
  const xf = (s) => XF[s] || XF[0] || { align: {} };
  const hasText = (r, c) => { const cell = cells.get(key(r, c)); return !!(cell && cell.text !== ''); };

  // ---- measuring: one hidden box, batched reads
  const meas = document.createElement('div'); meas.className = 'measure'; meas.setAttribute('style', document.getElementById('canvas').getAttribute('style') || ''); document.body.appendChild(meas);
  const PADX = 6; // 3 px each side, about Excel's text inset at 100 %
  // auto-fit rows that carry no height (Excel computes them; files from other writers often leave ht out)
  const fitJobs = [];
  for (const cell of S.cells) {
    if (!rowAuto[cell.r] || mergeAt.has(key(cell.r, cell.c)) || cell.text === '') continue;
    const x = xf(cell.s); const el = document.createElement('div');
    el.style.cssText = x.font + (x.align.wrap ? `;width:${Math.max(1, colW[cell.c] - PADX)}px;white-space:pre-wrap;overflow-wrap:anywhere` : ';white-space:pre');
    el.className = 'mt'; el.textContent = cell.text; meas.appendChild(el); fitJobs.push([cell, el, x]);
  }
  for (const [cell, el, x] of fitJobs) {
    const need = x.align.wrap ? el.offsetHeight + 4 : Math.ceil((x.fontPx || 14.67) * 1.36);
    if (need > rowH[cell.r]) { rowH[cell.r] = need; }
  }
  out.autofitRows = rowH.filter((h, r) => rowAuto[r] && h !== S.defaultRowPx).length;
  meas.textContent = '';

  const X = [0], Y = [0];
  for (let c = 0; c < nC; c++) X.push(X[c] + colW[c]);
  for (let r = 0; r < nR; r++) Y.push(Y[r] + rowH[r]);
  const fr = S.frozen.rows, fc = S.frozen.cols;
  const HH = S.showHeaders ? 22 : 0, HW = S.showHeaders ? Math.max(32, String(nR).length * 7 + 16) : 0;
  const FW = X[fc], FH = Y[fr], TW = X[nC], TH = Y[nR];

  // ---- overflow of text into empty neighbours, and #### for numbers that do not fit
  const oJobs = [];
  for (const cell of S.cells) {
    if (cell.text === '' || mergeAt.has(key(cell.r, cell.c)) || rowH[cell.r] === 0 || colW[cell.c] === 0) continue;
    const x = xf(cell.s); const a = x.align;
    if (a.wrap || a.rot || a.shrink || (a.h && !['left', 'right', 'center', 'general'].includes(a.h))) continue;
    const el = document.createElement('span'); el.style.cssText = x.font + ';white-space:pre'; el.className = 'mt';
    el.textContent = cell.text; meas.appendChild(el); oJobs.push([cell, el, x]);
  }
  const span = new Map(); // key -> [c0, c1] columns the text box covers
  const hash = new Map();
  for (const [cell, el, x] of oJobs) {
    const w = el.offsetWidth + PADX + (x.align.indent || 0) * 9; const avail = colW[cell.c];
    if (w <= avail) continue;
    if (cell.kind !== 's') { // numbers, dates, booleans do not spill: Excel fills the cell with #
      const hw = (() => { el.textContent = '#'; return el.offsetWidth || 7; })();
      hash.set(key(cell.r, cell.c), '#'.repeat(Math.max(1, Math.floor((avail - PADX) / hw)))); out.hashCells++; continue;
    }
    const h = x.align.h || 'left'; const pane = [0, nC];
    let c0 = cell.c, c1 = cell.c, width = avail;
    const free = (c) => c >= pane[0] && c < pane[1] && !hasText(cell.r, c) && !mergeAt.has(key(cell.r, c));
    if (h === 'center') { while (width < w) { const L = free(c0 - 1), R = free(c1 + 1); if (!L && !R) break; if (L && R) { c0--; c1++; width += colW[c0] + colW[c1]; } else break; } }
    else if (h === 'right') { while (width < w && free(c0 - 1)) { c0--; width += colW[c0]; } }
    else { while (width < w && free(c1 + 1)) { c1++; width += colW[c1]; } }
    if (c0 !== cell.c || c1 !== cell.c) { span.set(key(cell.r, cell.c), [c0, c1]); out.overflowCells++; }
  }
  meas.remove();
  const noGridRight = new Set(); // slots whose right gridline overflowing text hides
  for (const [k, [c0, c1]] of span) { const r = Math.floor(k / 16384); for (let c = c0; c < c1; c++) noGridRight.add(key(r, c)); }

  // ---- regions (frozen panes as sticky regions of one grid)
  const canvas = document.getElementById('canvas');
  canvas.style.gridTemplateColumns = `${HW + FW}px ${TW - FW}px`; canvas.style.gridTemplateRows = `${HH + FH}px ${TH - FH}px`;
  if (S.zoom && S.zoom !== 100) canvas.style.zoom = S.zoom / 100;
  const mk = (cls, x0, y0) => { const d = document.createElement('div'); d.className = 'region ' + cls; canvas.appendChild(d); return { el: d, x0, y0, fill: [], border: [], text: [] }; };
  const R = { corner: mk('r-corner', 0, 0), top: mk('r-top', HW + FW, 0), left: mk('r-left', 0, HH + FH), body: mk('r-body', HW + FW, HH + FH) };
  const regionOf = (r, c) => r < fr ? (c < fc ? R.corner : R.top) : (c < fc ? R.left : R.body);
  const regionsOf = (r0, r1, c0, c1) => { const out = []; for (const [top, rows] of [[true, r0 < fr], [false, r1 >= fr]]) { if (!rows) continue; for (const [left, cols] of [[true, c0 < fc], [false, c1 >= fc]]) if (cols) out.push(top ? (left ? R.corner : R.top) : (left ? R.left : R.body)); } return out; };
  const box = (reg, X0, Y0, w, h) => `left:${X0 - reg.x0}px;top:${Y0 - reg.y0}px;width:${w}px;height:${h}px`;

  const gridOn = S.showGridLines;
  for (let r = 0; r < nR; r++) {
    if (!rowH[r]) continue;
    for (let c = 0; c < nC; c++) {
      if (!colW[c]) continue;
      const k = key(r, c); const mi = mergeAt.get(k); let r2 = r, c2 = c;
      if (mi !== undefined) { const m = S.merges[mi]; if (m[0] !== r || m[1] !== c) continue; r2 = m[2]; c2 = m[3]; }
      const regs = regionsOf(r, r2, c, c2); const s = styleOf(r, c); const x = xf(s);
      const X0 = HW + X[c], Y0 = HH + Y[r], w = X[Math.min(c2, nC - 1) + 1] - X[c], h = Y[Math.min(r2, nR - 1) + 1] - Y[r];
      // fill + gridlines (right and bottom edge of each slot)
      for (const reg of regs) { let st = box(reg, X0, Y0, w, h);
      if (x.fill) st += x.fill.startsWith('linear') ? `;background-image:${x.fill}` : `;background:${x.fill}`;
      else if (gridOn) st += `;border-right:1px solid ${noGridRight.has(k) ? 'transparent' : 'var(--grid)'};border-bottom:1px solid var(--grid)`;
      reg.fill.push(`<div class="s" style="${st}"></div>`); } out.slots++;
      // explicit borders, centred on the gridline like Excel's
      let b = x.border;
      if (mi !== undefined) { const m = S.merges[mi]; const bR = xf(styleOf(m[0], m[3])).border, bB = xf(styleOf(m[2], m[1])).border; b = b || bR || bB ? { l: b && b.l, t: b && b.t, r: (bR && bR.r) || (b && b.r), b: (bB && bB.b) || (b && b.b) } : null; }
      if (b && (b.l || b.r || b.t || b.b)) {
        const side = (n, v) => v ? `;border-${n}:${v[0]}px ${v[1]} ${v[2]}` : '';
        for (const reg of regs) reg.border.push(`<div class="b" style="${box(reg, X0 - 1, Y0 - 1, w + 1, h + 1)}${side('left', b.l)}${side('right', b.r)}${side('top', b.t)}${side('bottom', b.b)}"></div>`);
      }
      // text
      const cell = cells.get(k);
      if (cell && cell.text !== '') {
        const a = x.align; let tx0 = X0, tw = w; const sp = span.get(k);
        let tregs = regs; if (sp) { tx0 = HW + X[sp[0]]; tw = X[sp[1] + 1] - X[sp[0]]; tregs = regionsOf(r, r2, sp[0], sp[1]); }
        const isNum = cell.kind === 'n';
        const hAlign = a.h && a.h !== 'general' ? ({ centerContinuous: 'center', fill: 'left', distributed: 'justify' }[a.h] || a.h) : (isNum ? 'right' : cell.kind === 'b' || cell.kind === 'e' ? 'center' : 'left');
        const vAlign = { top: 'flex-start', center: 'center', justify: 'center', distributed: 'center' }[a.v] || 'flex-end';
        let tst = '' + `;justify-content:${vAlign};text-align:${hAlign};${x.font}`;
        if (cell.color) tst += `;color:${cell.color}`;
        if (a.indent) tst += hAlign === 'right' ? `;padding-right:${3 + a.indent * 9}px` : `;padding-left:${3 + a.indent * 9}px`;
        let cls = 't' + (a.wrap || hAlign === 'justify' ? ' wrap' : '');
        let inner;
        const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const hs = hash.get(k);
        if (hs) inner = `<span>${hs}</span>`;
        else if (cell.fill && !a.wrap) { inner = `<span class="fillrow"><span>${esc(cell.fill[0])}</span><span class="grow"></span><span>${esc(cell.fill[1])}</span></span>`; }
        else if (cell.runs) inner = '<span>' + cell.runs.map(([t, css]) => `<span style="${css}">${esc(t)}</span>`).join('') + '</span>';
        else inner = `<span>${esc(cell.text)}</span>`;
        if (a.rot) { cls += ' rot'; const deg = a.rot === 255 ? 0 : a.rot <= 90 ? -a.rot : a.rot - 90; inner = a.rot === 255 ? `<span class="stack">${inner}</span>` : `<span class="rotin" style="transform:rotate(${deg}deg)">${inner}</span>`; }
        for (const reg of tregs) reg.text.push(`<div class="${cls}" style="${box(reg, tx0, Y0, tw, h)};${tst}">${inner}</div>`); out.textNodes++;
      }
    }
  }
  // comments: Excel's red corner mark
  for (const [r, c] of S.comments) { if (r >= nR || c >= nC) continue; const reg = regionOf(r, c); reg.text.push(`<div class="cmt" style="left:${HW + X[c + 1] - 7 - reg.x0}px;top:${HH + Y[r] - reg.y0}px"></div>`); }
  // drawings: a placeholder where the chart or picture sits
  const objs = [];
  for (const d of S.drawings) {
    const a = d.anchor; let x0, y0, w, h;
    if (a.from) { x0 = X[Math.min(a.from.col, nC)] + a.from.colOff; y0 = Y[Math.min(a.from.row, nR)] + a.from.rowOff; }
    else if (a.pos) { x0 = a.pos.x; y0 = a.pos.y; } else continue;
    if (a.to) { w = X[Math.min(a.to.col, nC)] + a.to.colOff - x0; h = Y[Math.min(a.to.row, nR)] + a.to.rowOff - y0; } else if (a.ext) { w = a.ext.w; h = a.ext.h; } else continue;
    const colAt = (px) => { let c = 0; while (c < nC - 1 && X[c + 1] <= px) c++; return c; }, rowAt = (px) => { let r = 0; while (r < nR - 1 && Y[r + 1] <= px) r++; return r; };
    const regs = regionsOf(rowAt(y0), rowAt(y0 + h - 1), colAt(x0), colAt(x0 + w - 1));
    const label = d.what === 'chart' ? `${d.type && d.type !== 'chart' ? d.type[0].toUpperCase() + d.type.slice(1) + ' chart' : 'Chart'}${d.title ? ': ' + d.title : ''}` : d.what === 'image' ? 'Picture' : 'Shape';
    const small = w < 160 || h < 90; // too small for words: the icon alone
    for (const reg of regs) reg.text.push(`<div class="obj" style="${box(reg, HW + x0, HH + y0, w, h)}"><div class="objin"><div class="objicon">${d.what === 'chart' ? M.icons.chart : M.icons.image}</div>${small ? '' : `<div class="objlabel">${label.replace(/</g, '&lt;')}</div><div class="objsub">Not drawn in the preview</div>`}</div></div>`);
    objs.push(label);
  }
  // headers
  const letters = (c) => { let s = ''; c++; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
  if (S.showHeaders) {
    R.corner.text.push(`<div class="hd hc" style="left:0;top:0;width:${HW}px;height:${HH}px"></div>`);
    for (let c = 0; c < nC; c++) { if (!colW[c]) continue; const reg = c < fc ? R.corner : R.top; const hiddenNext = c + 1 < nC && colW[c + 1] === 0;
      reg.text.push(`<div class="hd hx${hiddenNext ? ' hid' : ''}" style="${box(reg, HW + X[c], 0, colW[c], HH)}">${letters(c)}</div>`); }
    for (let r = 0; r < nR; r++) { if (!rowH[r]) continue; const reg = r < fr ? R.corner : R.left; const hiddenNext = r + 1 < nR && rowH[r + 1] === 0;
      reg.text.push(`<div class="hd hy${hiddenNext ? ' hid' : ''}" style="${box(reg, 0, HH + Y[r], HW, rowH[r])}">${r + 1}</div>`); }
  }
  for (const reg of Object.values(R)) reg.el.innerHTML = reg.fill.join('') + reg.border.join('') + reg.text.join('');
  // the frozen-pane hairline
  if (fr) for (const reg of [R.corner, R.top]) reg.el.insertAdjacentHTML('beforeend', `<div class="freeze-h"></div>`);
  if (fc) for (const reg of [R.corner, R.left]) reg.el.insertAdjacentHTML('beforeend', `<div class="freeze-v"></div>`);
  canvas.style.width = (HW + TW) + 'px'; canvas.style.height = (HH + TH) + 'px';
  document.body.offsetHeight; // force layout
  const T1 = performance.now();
  window.__done = { ...out, fontMs: +(tFonts - T0).toFixed(1), layoutMs: +(T1 - tFonts).toFixed(1), totalMs: +(T1 - T0).toFixed(1), rows: nR, cols: nC, objects: objs, canvas: [HW + TW, HH + TH] };
})().catch(e => { window.__done = { error: String(e && e.stack || e) }; });
