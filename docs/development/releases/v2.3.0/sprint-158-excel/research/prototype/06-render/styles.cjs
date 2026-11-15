// Small styles reader: styles.xml + theme1.xml -> one CSS rule per cellXfs entry.
const INDEXED = ['000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF','000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF',
 '800000','008000','000080','808000','800080','008080','C0C0C0','808080','9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF',
 '000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF','00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99',
 '3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696','003366','339966','003300','333300','993300','993366','333399','333333'];
const attr = (t, n) => { const m = new RegExp('(?:^|\\s)' + n + '="([^"]*)"').exec(t); return m ? m[1] : undefined; };
const each = (xml, tag, fn) => { const re = new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'g'); let m; const out = []; while ((m = re.exec(xml))) out.push(fn(m[1], m[2] || '')); return out; };
const section = (xml, tag) => { const m = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`).exec(xml); return m ? m[1] : ''; };

function parseTheme(xml) {
  const scheme = section(xml, 'clrScheme');
  const order = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const c = {};
  for (const name of order) {
    const body = section(scheme, 'a:' + name) || section(scheme, name);
    const srgb = /srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/.exec(body); const sys = /sysClr\b[^>]*lastClr="([0-9A-Fa-f]{6})"/.exec(body);
    c[name] = (srgb ? srgb[1] : sys ? sys[1] : '000000').toUpperCase();
  }
  // theme index order in SpreadsheetML: 0 lt1, 1 dk1, 2 lt2, 3 dk2, then accents and links
  const colors = [c.lt1, c.dk1, c.lt2, c.dk2, c.accent1, c.accent2, c.accent3, c.accent4, c.accent5, c.accent6, c.hlink, c.folHlink];
  const minor = /<a:minorFont>[\s\S]*?<a:latin typeface="([^"]*)"/.exec(xml); const major = /<a:majorFont>[\s\S]*?<a:latin typeface="([^"]*)"/.exec(xml);
  return { colors, minorFont: minor && minor[1], majorFont: major && major[1] };
}
// ECMA-376 18.8.19 tint, done in HLS with HLSMAX 255 as Excel does
function applyTint(hex, tint) {
  if (!tint) return hex;
  let r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; let l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  l = tint < 0 ? l * (1 + tint) : l * (1 - tint) + tint;
  const hue = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  if (s === 0) r = g = b = l; else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3); }
  return [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function colorOf(tag, ctx) {
  if (!tag) return null;
  if (attr(tag, 'auto') === '1') return null; // automatic: the reader's default (text) colour
  let hex = null;
  const rgb = attr(tag, 'rgb'); const theme = attr(tag, 'theme'); const idx = attr(tag, 'indexed');
  if (rgb) hex = rgb.slice(-6).toUpperCase(); // alpha is ignored, as Excel does
  else if (theme !== undefined) hex = ctx.theme.colors[Number(theme)] || null;
  else if (idx !== undefined) { const i = Number(idx); if (i === 64 || i === 65) return null; hex = (ctx.indexed[i] || null); }
  if (!hex) return null;
  return '#' + applyTint(hex, Number(attr(tag, 'tint') || 0));
}
const BORDER = { thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', dashDot: '1px dashed', dashDotDot: '1px dashed',
  medium: '2px solid', mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed', slantDashDot: '2px dashed', thick: '3px solid', double: '3px double' };

function parseStyles(xml, themeXml) {
  const theme = parseTheme(themeXml || '');
  const custom = each(section(xml, 'indexedColors'), 'rgbColor', a => attr(a, 'rgb').slice(-6).toUpperCase());
  const ctx = { theme, indexed: custom.length ? custom : INDEXED };
  const numFmts = {}; each(section(xml, 'numFmts'), 'numFmt', a => { numFmts[attr(a, 'numFmtId')] = attr(a, 'formatCode').replace(/&quot;/g, '"').replace(/&amp;/g, '&'); });
  const fonts = each(section(xml, 'fonts'), 'font', (a, body) => {
    const v = (t) => { const m = new RegExp(`<(?:\\w+:)?${t}\\b([^>]*)/?>`).exec(body); return m ? (attr(m[1], 'val') ?? 'true') : undefined; };
    const scheme = v('scheme');
    return { name: scheme === 'minor' && theme.minorFont ? theme.minorFont : scheme === 'major' && theme.majorFont ? theme.majorFont : v('name'),
      size: Number(v('sz') || 11), bold: v('b') !== undefined && v('b') !== '0' && v('b') !== 'false', italic: v('i') !== undefined && v('i') !== '0' && v('i') !== 'false',
      underline: v('u'), strike: v('strike') !== undefined && v('strike') !== '0', color: colorOf((/<(?:\w+:)?color\b[^>]*\/?>/.exec(body) || [])[0], ctx),
      vertAlign: v('vertAlign') };
  });
  const fills = each(section(xml, 'fills'), 'fill', (a, body) => {
    const p = /<(?:\w+:)?patternFill\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?patternFill>)/.exec(body);
    if (p) { const type = attr(p[1], 'patternType') || ((p[2] || '').includes('fgColor') ? 'solid' : 'none'); const inner = p[2] || '';
      const fg = colorOf((/<(?:\w+:)?fgColor\b[^>]*\/?>/.exec(inner) || [])[0], ctx); const bg = colorOf((/<(?:\w+:)?bgColor\b[^>]*\/?>/.exec(inner) || [])[0], ctx);
      if (type === 'none') return null; if (type === 'solid') return fg || bg;
      return fg || bg; // other patterns drawn as their foreground colour (approximation)
    }
    const g = /<(?:\w+:)?gradientFill\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?gradientFill>/.exec(body);
    if (g) { const stops = each(g[2], 'stop', (sa, sb) => `${colorOf((/<(?:\w+:)?color\b[^>]*\/?>/.exec(sb) || [])[0], ctx)} ${Number(attr(sa, 'position')) * 100}%`);
      return `linear-gradient(${90 + Number(attr(g[1], 'degree') || 0)}deg, ${stops.join(', ')})`; }
    return null;
  });
  const borders = each(section(xml, 'borders'), 'border', (a, body) => {
    const side = (s) => { const m = new RegExp(`<(?:\\w+:)?${s}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${s}>)`).exec(body); if (!m) return null; const st = attr(m[1], 'style'); if (!st || !BORDER[st]) return null;
      return `${BORDER[st]} ${colorOf((/<(?:\w+:)?color\b[^>]*\/?>/.exec(m[2] || '') || [])[0], ctx) || '#000000'}`; };
    return { left: side('left') || side('start'), right: side('right') || side('end'), top: side('top'), bottom: side('bottom') };
  });
  const xfs = each(section(xml, 'cellXfs'), 'xf', (a, body) => {
    const al = /<(?:\w+:)?alignment\b([^>]*)\/?>/.exec(body);
    return { numFmtId: attr(a, 'numFmtId') || '0', fontId: Number(attr(a, 'fontId') || 0), fillId: Number(attr(a, 'fillId') || 0), borderId: Number(attr(a, 'borderId') || 0),
      align: al ? { h: attr(al[1], 'horizontal'), v: attr(al[1], 'vertical'), wrap: attr(al[1], 'wrapText') === '1' || attr(al[1], 'wrapText') === 'true', indent: Number(attr(al[1], 'indent') || 0), rotation: Number(attr(al[1], 'textRotation') || 0), shrink: attr(al[1], 'shrinkToFit') === '1' } : null };
  });
  const baseFont = fonts[0] || { name: 'Calibri', size: 11 };
  const css = xfs.map((xf, i) => {
    const f = fonts[xf.fontId] || baseFont; const d = [];
    if (f.name && f.name !== baseFont.name) d.push(`font-family:"${f.name}"`);
    if (f.size !== baseFont.size) d.push(`font-size:${(f.size * 4 / 3).toFixed(2)}px`);
    if (f.bold) d.push('font-weight:700'); if (f.italic) d.push('font-style:italic');
    const deco = [f.underline && f.underline !== 'none' ? 'underline' : '', f.strike ? 'line-through' : ''].filter(Boolean); if (deco.length) d.push('text-decoration:' + deco.join(' '));
    if (f.underline === 'double' || f.underline === 'doubleAccounting') d.push('text-decoration-style:double');
    if (f.color) d.push('color:' + f.color);
    const fill = fills[xf.fillId]; if (fill) d.push((fill.startsWith('linear') ? 'background-image:' : 'background-color:') + fill);
    const b = borders[xf.borderId]; if (b) for (const s of ['left', 'right', 'top', 'bottom']) if (b[s]) d.push(`border-${s}:${b[s]}`);
    if (xf.align) { const h = { center: 'center', centerContinuous: 'center', right: 'right', left: 'left', justify: 'justify', distributed: 'justify', fill: 'left' }[xf.align.h];
      if (h) d.push('text-align:' + h); const v = { top: 'top', center: 'middle', bottom: 'bottom', justify: 'middle', distributed: 'middle' }[xf.align.v]; if (v) d.push('vertical-align:' + v);
      if (xf.align.wrap) d.push('white-space:pre-wrap;overflow-wrap:anywhere'); if (xf.align.indent) d.push(`padding-${h === 'right' ? 'right' : 'left'}:${xf.align.indent * 9 + 3}px`); }
    return `.x${i}{${d.join(';')}}`;
  });
  return { theme, fonts, fills, borders, xfs, numFmts, css, baseFont };
}
module.exports = { parseStyles, parseTheme, applyTint, colorOf };
