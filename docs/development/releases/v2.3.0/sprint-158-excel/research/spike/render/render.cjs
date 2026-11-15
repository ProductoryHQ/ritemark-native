// render.cjs — static HTML renderer for the Sprint 158 spike, plus today's look for comparison.
// node render.cjs <outDir> <file.xlsx>... [--dark] [--locale et] [--suffix name] [--scroll x,y] [--before]
const fs = require('fs'), path = require('path');
const { readWorkbook } = require('./reader.cjs');

const ASSETS = path.resolve(__dirname, 'assets');
const ICONS = {
  chart: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M224 200h-8V40a8 8 0 0 0-8-8h-56a8 8 0 0 0-8 8v40H96a8 8 0 0 0-8 8v40H48a8 8 0 0 0-8 8v64h-8a8 8 0 0 0 0 16h192a8 8 0 0 0 0-16ZM160 48h40v152h-40Zm-56 48h40v104h-40Zm-48 48h32v56H56Z"/></svg>',
  image: '<svg width="22" height="22" viewBox="0 0 256 256" fill="currentColor"><path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm0 16v102.75l-26.07-26.06a16 16 0 0 0-22.63 0l-20 20-44-44a16 16 0 0 0-22.62 0L40 149.37V56ZM40 172l52-52 80 80H40Zm176 28h-21.37l-36-36 20-20L216 181.38V200ZM144 100a12 12 0 1 1 12 12 12 12 0 0 1-12-12Z"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm16-40a8 8 0 0 1-8 8 16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16 16 16 0 0 1 16 16v40a8 8 0 0 1 8 8Zm-32-92a12 12 0 1 1 12 12 12 12 0 0 1-12-12Z"/></svg>',
  out: '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor"><path d="M224 104a8 8 0 0 1-16 0V59.32l-66.33 66.34a8 8 0 0 1-11.32-11.32L196.68 48H152a8 8 0 0 1 0-16h64a8 8 0 0 1 8 8Zm-40 24a8 8 0 0 0-8 8v72H48V80h72a8 8 0 0 0 0-16H48a16 16 0 0 0-16 16v128a16 16 0 0 0 16 16h128a16 16 0 0 0 16-16v-72a8 8 0 0 0-8-8Z"/></svg>',
  caret: '<svg width="12" height="12" viewBox="0 0 256 256" fill="currentColor"><path d="m213.66 101.66-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z"/></svg>',
  plus: '<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor"><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/></svg>',
};

const TOKENS = {
  light: { editor: '#ffffff', sheet: '#F8FAFC', side: '#F8FAFC', hair: '#e2e8f0', hair2: '#cbd5e1', ink: '#1e1b4b', muted: '#617187', accent: '#4338ca', shadow: 'rgb(30 27 75 / 0.07)' },
  dark: { editor: '#1E1B4B', sheet: '#1A1740', side: '#1A1740', hair: 'rgba(199,210,254,0.12)', hair2: 'rgba(199,210,254,0.22)', ink: '#f8fafc', muted: '#94a3b8', accent: '#818cf8', shadow: 'rgb(0 0 0 / 0.4)' },
};
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function chrome(t) {
  return `
@font-face { font-family: 'Sofia Sans'; font-weight: 100 900; src: url('${ASSETS}/SofiaSans-latin.woff2') format('woff2'); unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2212; }
@font-face { font-family: 'Sofia Sans'; font-weight: 100 900; src: url('${ASSETS}/SofiaSans-latin-ext.woff2') format('woff2'); unicode-range: U+0100-02BA, U+1E00-1E9F; }
:root { --editor:${t.editor}; --sheet:${t.sheet}; --side:${t.side}; --hair:${t.hair}; --hair2:${t.hair2}; --ink:${t.ink}; --muted:${t.muted}; --accent:${t.accent}; --shadow:${t.shadow}; }
* { box-sizing: border-box; cursor: inherit; }
button, .tab { cursor: pointer; }
html, body { margin: 0; height: 100%; background: var(--editor); font-family: 'Sofia Sans', -apple-system, sans-serif; color: var(--ink); }
.viewer { display: flex; flex-direction: column; height: 100vh; }
.toolbar { height: 40px; flex: none; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: var(--editor); }
.toolbar .fname { font-size: 13px; color: var(--muted); font-weight: 500; }
.toolbar .grow { flex: 1; }
.split { display: inline-flex; height: 28px; border: 1px solid var(--hair2); border-radius: 6px; overflow: hidden; font-size: 13px; color: var(--ink); }
.split span { display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; }
.split span + span { border-left: 1px solid var(--hair2); padding: 0 7px; }
.tabs { display: flex; background: var(--side); flex: none; overflow-x: auto; }
.tab { display: inline-flex; align-items: center; gap: 6px; padding: 4px 14px; font-size: 12px; border-top: 1px solid var(--hair); border-bottom: 2px solid transparent; border-left: 1px solid transparent; border-right: 1px solid transparent; color: var(--muted); white-space: nowrap; position: relative; }
.tab.active { background: var(--editor); color: var(--accent); font-weight: 600; border-top-color: transparent; border-left-color: var(--hair); border-right-color: var(--hair); border-bottom-color: var(--accent); }
.tab .tc { position: absolute; left: 6px; right: 6px; bottom: -2px; height: 3px; border-radius: 2px 2px 0 0; }
.tab.active .tc { bottom: 0; }
.tabs .rest { flex: 1; min-width: 16px; border-top: 1px solid var(--hair); }
`;
}

const GRID_CSS = `
.frame { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--sheet); padding: 12px 20px 16px; gap: 8px; }
.notice { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); flex: none; }
.paperwrap { flex: 1; min-height: 0; display: flex; align-items: flex-start; }
.paper { max-width: 100%; max-height: 100%; overflow: auto; background: #fff; border: 1px solid var(--hair); border-radius: 2px; box-shadow: 0 1px 3px var(--shadow), 0 4px 16px var(--shadow); }
#canvas { display: grid; position: relative; background: #fff; color: #000; --grid: #dadce0; --hd: #f5f6f8; --hdline: #d5d9e0; --hdink: #5f6b7a; --freeze: #9aa3ae; }
.region { position: relative; overflow: hidden; background: #fff; }
.r-corner { position: sticky; top: 0; left: 0; z-index: 4; }
.r-top { position: sticky; top: 0; z-index: 3; }
.r-left { position: sticky; left: 0; z-index: 2; }
.region > div { position: absolute; }
.s { box-sizing: border-box; }
.b { box-sizing: border-box; pointer-events: none; }
.t { display: flex; flex-direction: column; padding: 0 3px 1px; overflow: hidden; line-height: 1.2; }
.t > span { display: block; width: 100%; white-space: pre; overflow: hidden; }
.t.wrap > span { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.25; }
.t .fillrow { display: flex; }
.t .fillrow .grow { flex: 1; }
.t.rot { align-items: center; justify-content: center !important; overflow: hidden; }
.t.rot > span.rotin { display: inline-block; width: auto; white-space: nowrap; }
.t.rot .stack { writing-mode: vertical-rl; text-orientation: upright; width: auto; }
.cmt { width: 0; height: 0; border-top: 6px solid #d93025; border-left: 6px solid transparent; z-index: 2; }
.obj { border: 1px dashed #9aa3ae; background: #f8fafc; border-radius: 4px; display: flex; align-items: center; justify-content: center; z-index: 3; overflow: hidden; font-family: 'Sofia Sans', sans-serif; }
.objin { text-align: center; color: #5f6b7a; padding: 8px; }
.objicon { opacity: 0.7; }
.objlabel { font-size: 13px; font-weight: 600; color: #3b4452; margin-top: 4px; }
.objsub { font-size: 11px; margin-top: 2px; }
.hd { display: flex; align-items: center; justify-content: center; font: 500 11px 'Sofia Sans', sans-serif; color: var(--hdink); background: var(--hd); border-right: 1px solid var(--hdline); border-bottom: 1px solid var(--hdline); }
.hy { justify-content: flex-end; padding-right: 6px; }
.hx.hid { border-right: 3px double var(--hdink); }
.hy.hid { border-bottom: 3px double var(--hdink); }
.freeze-h { position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--freeze); z-index: 5; }
.freeze-v { position: absolute; top: 0; bottom: 0; right: 0; width: 1px; background: var(--freeze); z-index: 5; }
.measure { position: absolute; left: -99999px; top: 0; visibility: hidden; }
.measure .mt { display: block; position: absolute; line-height: 1.25; }
.chartpage { flex: 1; display: flex; align-items: center; justify-content: center; }
.chartpage .card { width: 560px; height: 320px; background: #fff; border: 1px dashed #9aa3ae; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #5f6b7a; }
.chartpage .card b { color: #3b4452; font-size: 15px; }
.chartpage .card span { font-size: 12px; }
`;

function toolbar(filename) {
  return `<header class="toolbar"><div class="fname">${esc(filename)}</div><div class="grow"></div><div class="split"><span>${ICONS.out}Open in Excel</span><span>${ICONS.caret}</span></div></header>`;
}
function tabsHtml(tabs, activeIndex) {
  if (tabs.length < 2) return '';
  return `<div class="tabs">${tabs.map((t, i) => `<div class="tab${i === activeIndex ? ' active' : ''}">${t.kind === 'chartsheet' ? '<svg width="11" height="11" viewBox="0 0 256 256" fill="currentColor"><path d="M224 200h-8V40a8 8 0 0 0-8-8h-56a8 8 0 0 0-8 8v40H96a8 8 0 0 0-8 8v40H48a8 8 0 0 0-8 8v64h-8a8 8 0 0 0 0 16h192a8 8 0 0 0 0-16Z"/></svg>' : ''}${esc(t.name)}${t.tabColor ? `<i class="tc" style="background:${t.tabColor}"></i>` : ''}</div>`).join('')}<div class="rest"></div></div>`;
}
function notice(s) {
  const bits = [];
  const charts = (s.drawings || []).filter(d => d.what === 'chart').length, pics = (s.drawings || []).filter(d => d.what !== 'chart').length;
  if (charts) bits.push(charts === 1 ? 'a chart' : `${charts} charts`);
  if (pics) bits.push(pics === 1 ? 'a picture' : `${pics} pictures`);
  if (s.cf && s.cf.ranges) bits.push('colour rules (conditional formatting)');
  if (!bits.length) return '';
  const list = bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits[0];
  return `<div class="notice">${ICONS.info}<span>This sheet has ${list}. The preview doesn't draw ${bits.length > 1 || charts > 1 ? 'them' : 'it'} yet — open the file in Excel to see ${bits.length > 1 || charts > 1 ? 'them' : 'it'}.</span></div>`;
}

function afterPage(model, sheetIndex, filename, opts) {
  const s = model.sheets[sheetIndex];
  const vis = model.sheets.map((x, i) => ({ ...x, i })).filter(x => x.state === 'visible');
  const active = vis.findIndex(x => x.i === sheetIndex);
  const t = TOKENS[opts.dark ? 'dark' : 'light'];
  let body;
  if (s.kind === 'chartsheet') {
    const d = (s.drawings || [])[0] || {};
    body = `<div class="frame"><div class="chartpage"><div class="card">${ICONS.chart.replace('22', '34').replace('22', '34')}<b>Chart sheet${d.title ? ': ' + esc(d.title) : ''}</b><span>Charts aren't drawn in the preview yet. Open the file in Excel to see it.</span></div></div></div>`;
  } else {
    body = `<div class="frame">${notice(s)}<div class="paperwrap"><div class="paper" id="paper"><div id="canvas" style="${model.baseFontCss}"></div></div></div></div>`;
  }
  const pageModel = { sheet: s, xfs: model.xfs, families: model.families, icons: ICONS };
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(filename)} — ${esc(s.name)}</title><style>${chrome(t)}${GRID_CSS}</style></head><body>
<div class="viewer">${toolbar(filename)}${body}${tabsHtml(vis, active)}</div>
${s.kind === 'chartsheet' ? '<script>window.__done={chartsheet:true,totalMs:0}</script>' : `<script type="application/json" id="model">${JSON.stringify(pageModel).replace(/</g, '\\u003c')}</script><script>${fs.readFileSync(path.join(__dirname, 'layout.js'), 'utf8')}</script>`}
</body></html>`;
}

// ---- today's look: SheetJS sheet_to_json(raw:false) into DataTable's uniform grid
function beforePages(buf, filename) {
  const XLSX = require(process.env.SHEETJS_PATH || 'xlsx');
  const t0 = performance.now();
  const wb = XLSX.read(buf, { type: 'buffer', cellStyles: true });
  const t1 = performance.now();
  const t = TOKENS.light; const pages = [];
  wb.SheetNames.forEach((name, i) => {
    const ws = wb.Sheets[name]; let html;
    const ref = ws && ws['!ref'];
    if (!ref) html = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted)">${esc(name)} is empty</div>`;
    else {
      let aoa;
      const range = XLSX.utils.decode_range(ref); const cols = []; for (let c = 0; c <= range.e.c; c++) cols.push(XLSX.utils.encode_col(c));
      try { aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: true, raw: false, range: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: range.e }) }); }
      catch (e) { aoa = [[`(SheetJS threw: ${e.message})`]]; }
      const th = `<th style="width:36px;min-width:36px" class="h"></th>` + cols.map(c => `<th class="h hc">${c}</th>`).join('') + `<th class="h" style="width:36px;min-width:36px;text-align:center"><span style="opacity:.4;color:var(--muted)">${ICONS.plus}</span></th>`;
      const rows = aoa.slice(0, 10000).map((r, ri) => `<tr><td class="rn">${ri + 1}</td>${cols.map((c, ci) => `<td class="c"><span>${esc(r[ci] ?? '') || '&nbsp;'}</span></td>`).join('')}<td class="c"></td></tr>`).join('');
      html = `<div style="flex:1;overflow:auto"><table class="dt"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>
<table style="width:100%;border-collapse:separate;border-spacing:0;font-size:13px"><tbody><tr><td style="width:36px;height:32px;text-align:right;padding:0 10px 0 4px;color:var(--muted)">${ICONS.plus}</td><td style="padding:0 10px;color:var(--muted)">Add row</td></tr></tbody></table></div>`;
    }
    const tabs = wb.SheetNames.length > 1 ? `<div class="tabs">${wb.SheetNames.map((n, j) => `<div class="tab${j === i ? ' active' : ''}">${esc(n)}</div>`).join('')}<div class="rest"></div></div>` : '';
    pages.push({ name, html: `<!doctype html><html><head><meta charset="utf-8"><style>${chrome(t)}
.dt { border-collapse: separate; border-spacing: 0; font-size: 13px; table-layout: fixed; width: 100%; min-width: max-content; }
.dt th.h { height: 32px; padding: 0 10px; text-align: left; font-size: 12px; font-weight: 600; border-bottom: 1px solid var(--hair); background: var(--sheet); color: var(--muted); position: sticky; top: 0; }
.dt th.hc { min-width: 120px; max-width: 400px; }
.dt td.rn { width: 36px; min-width: 36px; height: 32px; padding: 0 10px 0 4px; text-align: right; font-size: 12px; line-height: 31px; border-bottom: 1px solid var(--hair); color: var(--muted); white-space: nowrap; vertical-align: top; }
.dt td.c { height: 32px; padding: 0 10px; line-height: 20px; border-bottom: 1px solid var(--hair); color: var(--ink); min-width: 120px; max-width: 400px; overflow: hidden; vertical-align: middle; }
.dt td.c span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style></head><body><div class="viewer">${toolbar(filename)}${html}${tabs}</div><script>window.__done={totalMs:0}</script></body></html>` });
  });
  return { pages, readMs: +(t1 - t0).toFixed(1) };
}

module.exports = { afterPage, beforePages, readWorkbook };

if (require.main === module) {
  const args = process.argv.slice(2); const outDir = args.shift(); fs.mkdirSync(outDir, { recursive: true });
  const flag = (n) => args.includes(n); const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const files = args.filter((a, i) => a.endsWith('.xlsx') && args[i - 1] !== '--locale');
  for (const f of files) {
    const buf = fs.readFileSync(f); const base = path.basename(f, '.xlsx');
    const model = readWorkbook(buf, { locale: val('--locale') });
    model.sheets.forEach((s, i) => { if (s.state !== 'visible') return; fs.writeFileSync(path.join(outDir, `${base}--${i}${val('--suffix') ? '--' + val('--suffix') : ''}.html`), afterPage(model, i, path.basename(f), { dark: flag('--dark') })); });
    console.log(base, JSON.stringify(model.timing));
  }
}
