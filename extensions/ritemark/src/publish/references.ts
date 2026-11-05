/**
 * The references a page, a stylesheet or a module script makes (Sprint 149, R3).
 *
 * Pure text in, reference strings out; resolving them and deciding what may go is `gather.ts`'s work. The HTML is read
 * with `node-html-parser`, which the extension already bundles (no new dependency). Comments are dropped, as a browser
 * loads nothing from them; `<noscript>` and `<template>` are read, since what they hold can load.
 */

import { parse, HTMLElement } from 'node-html-parser';

export type RefOrigin = 'page' | 'style' | 'module';

export interface Reference {
  /** As written, entities decoded, whitespace trimmed. */
  value: string;
  /**
   * What kind of thing the page expects there, when the tag says so. `link`: a place the page links to (`<a href>`,
   * `<area href>`, a `<link>` that loads nothing for the page, such as `rel="alternate"`), not a file the page uses.
   * R3 sends only what the page uses, so a linked document stays behind and is named (`gather.ts`).
   */
  as: 'style' | 'module' | 'script' | 'link' | 'any';
}

export interface PageReferences {
  refs: Reference[];
  /** `<base href>`, when the page has one: every relative reference resolves against it. */
  base?: string;
  /** Inline `<style>` and `style=""` text, read for `url()` and `@import`. */
  inlineCss: string[];
  /** Inline `<script type="module">` text, read for static imports. */
  inlineModules: string[];
  /** Every inline script's text (any type), for the script-built check. */
  inlineScripts: string[];
  /** An attribute that names a file builds it from parts (`${…}`, `{{…}}`, `' + '`). */
  builtAttribute: boolean;
}

/** Attributes that name one file, on any element. `href` on `a`/`area`/`link`/`use`/`image` is handled the same way. */
const SINGLE_URL_ATTRIBUTES = ['src', 'href', 'xlink:href', 'poster', 'data', 'background'];
/** Tags whose `data` attribute is a URL (`<object data>`); anywhere else `data` is not one. */
const DATA_URL_TAGS = new Set(['object']);
/** Tags whose `href` the browser never loads for the page (navigation and forms are handled as links). */
const NON_LOADING_HREF_TAGS = new Set(['base']);
/** Tags whose `href` is a place to go, not a file the page uses (R3): a link to `notes.md` doesn't take `notes.md`. */
const LINK_TAGS = new Set(['a', 'area']);
/**
 * `<link rel>` words that make the page load the file (a stylesheet, an icon, a preload, a manifest). Any other
 * `<link>` (`alternate`, `next`, `canonical`, `author`, `license`…, or none at all) only points somewhere. `prefetch`
 * and `dns-prefetch` are hints for a later visit, not a file this page uses, so a document behind one stays behind
 * (round 3 of #669). `rel` is split into its words, as the HTML standard reads it, so `dns-prefetch` is one word and
 * never matches a shorter one inside it.
 */
const LOADING_LINK_RELS: ReadonlySet<string> = new Set([
  'stylesheet',
  'icon',
  'apple-touch-icon',
  'apple-touch-icon-precomposed',
  'mask-icon',
  'manifest',
  'preload',
  'modulepreload',
]);

/** A `rel` value's words, lower-cased (`"Shortcut Icon"` → `shortcut`, `icon`). */
export function relTokens(rel: string): Set<string> {
  return new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
}

function parsed(html: string): HTMLElement {
  return parse(html, {
    comment: false,
    lowerCaseTagName: true,
    blockTextElements: { script: true, style: true, pre: true, textarea: true },
  });
}

function looksBuilt(value: string): boolean {
  return /\$\{|\{\{|['"`]\s*\+|\+\s*['"`]/.test(value);
}

/**
 * The URLs in a `srcset` value, as the HTML standard splits it: a URL is a run of non-space characters (a `data:` URL
 * keeps its commas), trailing commas end it, and its descriptors run to the next comma.
 */
export function srcsetUrls(srcset: string): string[] {
  const urls: string[] = [];
  let i = 0;
  const n = srcset.length;
  while (i < n) {
    while (i < n && (/\s/.test(srcset[i]) || srcset[i] === ',')) i++;
    if (i >= n) break;
    let j = i;
    while (j < n && !/\s/.test(srcset[j])) j++;
    let url = srcset.slice(i, j);
    i = j;
    if (/,+$/.test(url)) {
      url = url.replace(/,+$/, '');
    } else {
      let depth = 0;
      while (i < n && !(srcset[i] === ',' && depth === 0)) {
        if (srcset[i] === '(') depth++;
        else if (srcset[i] === ')') depth = Math.max(0, depth - 1);
        i++;
      }
    }
    if (url) urls.push(url);
  }
  return urls;
}

export function pageReferences(html: string): PageReferences {
  const root = parsed(html);
  const out: PageReferences = { refs: [], inlineCss: [], inlineModules: [], inlineScripts: [], builtAttribute: false };
  for (const el of root.querySelectorAll('*')) {
    const tag = (el.rawTagName ?? '').toLowerCase();
    const attrs = el.attributes;
    if (tag === 'base') {
      if (out.base === undefined && attrs.href !== undefined) out.base = attrs.href.trim();
      continue;
    }
    if (tag === 'style') {
      out.inlineCss.push(el.rawText);
      continue;
    }
    if (tag === 'script') {
      const type = (attrs.type ?? '').trim().toLowerCase();
      const isModule = type === 'module';
      if (attrs.src !== undefined) {
        out.refs.push({ value: attrs.src.trim(), as: isModule ? 'module' : 'script' });
        if (looksBuilt(attrs.src)) out.builtAttribute = true;
      } else {
        out.inlineScripts.push(el.rawText);
        if (isModule) out.inlineModules.push(el.rawText);
      }
      continue;
    }
    if (attrs.style !== undefined) out.inlineCss.push(attrs.style);
    const rel = relTokens(attrs.rel ?? '');
    for (const name of SINGLE_URL_ATTRIBUTES) {
      const value = attrs[name];
      if (value === undefined) continue;
      if (name === 'data' && !DATA_URL_TAGS.has(tag)) continue;
      if ((name === 'href' || name === 'xlink:href') && NON_LOADING_HREF_TAGS.has(tag)) continue;
      if (looksBuilt(value)) out.builtAttribute = true;
      let as: Reference['as'] = 'any';
      if (tag === 'link' && name === 'href') {
        if (rel.has('stylesheet')) as = 'style';
        else if (rel.has('modulepreload')) as = 'module';
        else if (![...rel].some((word) => LOADING_LINK_RELS.has(word))) as = 'link';
      } else if ((name === 'href' || name === 'xlink:href') && LINK_TAGS.has(tag)) {
        as = 'link';
      }
      out.refs.push({ value: value.trim(), as });
    }
    for (const name of ['srcset', 'imagesrcset']) {
      const value = attrs[name];
      if (value === undefined) continue;
      if (looksBuilt(value)) out.builtAttribute = true;
      for (const url of srcsetUrls(value)) out.refs.push({ value: url, as: 'any' });
    }
  }
  return out;
}

/**
 * CSS with its comments gone and its strings set aside (round 4 of #669): `code` holds each string as `"N"`, its
 * text in `strings[N]`, so `url(` or `@import` inside a comment or inside `content: "…"` names nothing, while
 * `url("a.png")` and `@import "b.css"` keep theirs. An unquoted `url(…)` is kept whole, as CSS reads it: a `/*` inside
 * it opens no comment. An unclosed comment runs to the end and an unclosed string to the end of its line, as in CSS.
 */
export function maskCss(css: string): { code: string; strings: string[] } {
  const strings: string[] = [];
  let code = '';
  let i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      i = close < 0 ? n : close + 2;
      code += ' ';
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1;
      strings.push(css.slice(i + 1, Math.min(j, n)));
      code += `"${strings.length - 1}"`;
      i = j < n && css[j] === c ? j + 1 : j;
      continue;
    }
    if ((c === 'u' || c === 'U') && !/[\w-]/.test(css[i - 1] ?? '')) {
      const unquotedUrl = /^url\(\s*(?=[^\s"')])/i.exec(css.slice(i, i + 64));
      if (unquotedUrl) {
        const close = css.indexOf(')', i + unquotedUrl[0].length);
        const stop = close < 0 ? n : close;
        code += css.slice(i, stop);
        i = stop;
        continue;
      }
    }
    code += c;
    i++;
  }
  return { code, strings };
}

/** `url(…)` and `@import` in CSS text. Comments and the text of other strings name nothing (`maskCss`). */
export function cssReferences(css: string): Reference[] {
  const { code, strings } = maskCss(css);
  const refs: Reference[] = [];
  const importRe = /@import\s*(?:url\(\s*)?(?:"(\d+)"|([^\s;)"]+))/gi;
  for (const m of code.matchAll(importRe)) {
    const value = (m[1] !== undefined ? strings[Number(m[1])] : m[2] ?? '').trim();
    if (value) refs.push({ value, as: 'style' });
  }
  const urlRe = /url\(\s*(?:"(\d+)"|([^)\s"]*))\s*\)/gi;
  for (const m of code.matchAll(urlRe)) {
    // `@import url(x.css)` was taken above as a stylesheet; the same text here would be taken twice
    const before = code.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
    if (/@import\s*$/i.test(before)) continue;
    const value = (m[1] !== undefined ? strings[Number(m[1])] : m[2] ?? '').trim();
    if (value) refs.push({ value, as: 'any' });
  }
  return refs;
}

/** Words after which a `/` starts a regular expression, not a division. */
const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
/** Templates nested deeper than this are not followed: the module names nothing (fail safe). */
const MAX_TEMPLATE_DEPTH = 32;

export interface MaskedJs {
  /** The script with comments gone, each top-level string as `"N"`, each template as two backticks. */
  code: string;
  /** The top-level strings' text, as written (escapes kept). */
  strings: string[];
  /** False when a string, template, comment or regular expression never closes: such a module never runs. */
  complete: boolean;
}

/**
 * A small JavaScript tokenizer, not a parser (round 4 of #669): enough to tell code from comments, strings, templates
 * and regular expressions, so `// import "./x.js"` or `'import "./x.js"'` names nothing. A `/` starts a regular
 * expression where an expression may start (after an operator, an opening bracket, a comma, or a word such as
 * `return`) and is a division after a name, a number or a closing bracket, as tokenizers guess without a parser.
 * Template text and everything inside `${…}` are masked whole: an import inside one is never followed (fail safe).
 */
export function maskJs(js: string): MaskedJs {
  const n = js.length;
  const strings: string[] = [];
  let code = '';
  let complete = true;

  /** Scans code from `start`. Nested (inside `${…}`): emits nothing and returns after the `}` that closes it. */
  const scanCode = (start: number, nested: boolean, depth: number): number => {
    let i = start;
    let braces = 0;
    let regexAllowed = true;
    const emit = (text: string) => {
      if (!nested) code += text;
    };
    while (i < n) {
      const c = js[i];
      if (c === '/' && js[i + 1] === '/') {
        while (i < n && js[i] !== '\n' && js[i] !== '\r' && js[i] !== '\u2028' && js[i] !== '\u2029') i++;
        continue;
      }
      if (c === '/' && js[i + 1] === '*') {
        const close = js.indexOf('*/', i + 2);
        if (close < 0) {
          complete = false;
          return n;
        }
        emit(/[\n\r\u2028\u2029]/.test(js.slice(i, close)) ? '\n' : ' ');
        i = close + 2;
        continue;
      }
      if (c === '/' && regexAllowed) {
        let j = i + 1;
        let inClass = false;
        for (; j < n; j++) {
          const ch = js[j];
          if (ch === '\\') {
            j++;
            continue;
          }
          if (ch === '\n' || ch === '\r') break;
          if (inClass) {
            if (ch === ']') inClass = false;
          } else if (ch === '[') {
            inClass = true;
          } else if (ch === '/') {
            break;
          }
        }
        if (j >= n || js[j] !== '/') {
          complete = false;
          return n;
        }
        j++;
        while (j < n && /[A-Za-z]/.test(js[j])) j++;
        emit(' /re/ ');
        i = j;
        regexAllowed = false;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && js[j] !== c) {
          if (js[j] === '\\') {
            j += 2;
            continue;
          }
          if (js[j] === '\n' || js[j] === '\r') break;
          j++;
        }
        if (j >= n || js[j] !== c) {
          complete = false;
          return n;
        }
        if (!nested) {
          strings.push(js.slice(i + 1, j));
          code += `"${strings.length - 1}"`;
        }
        i = j + 1;
        regexAllowed = false;
        continue;
      }
      if (c === '`') {
        i = scanTemplate(i + 1, depth + 1);
        if (!complete) return n;
        emit('``');
        regexAllowed = false;
        continue;
      }
      if (c === '{') {
        braces++;
        emit(c);
        i++;
        regexAllowed = true;
        continue;
      }
      if (c === '}') {
        if (nested && braces === 0) return i + 1;
        braces--;
        emit(c);
        i++;
        regexAllowed = false;
        continue;
      }
      if (/[A-Za-z_$0-9\u0080-\uffff]/.test(c)) {
        let j = i + 1;
        while (j < n && /[\w$\u0080-\uffff]/.test(js[j])) j++;
        const word = js.slice(i, j);
        emit(word);
        i = j;
        regexAllowed = REGEX_AFTER_WORDS.has(word);
        continue;
      }
      emit(c);
      i++;
      if (!/\s/.test(c)) regexAllowed = !/[)\].]/.test(c);
    }
    if (nested) complete = false;
    return n;
  };

  /** Scans a template's text from after its opening backtick; returns after the closing one. */
  const scanTemplate = (start: number, depth: number): number => {
    if (depth > MAX_TEMPLATE_DEPTH) {
      complete = false;
      return n;
    }
    let i = start;
    while (i < n) {
      const c = js[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '`') return i + 1;
      if (c === '$' && js[i + 1] === '{') {
        i = scanCode(i + 2, true, depth);
        if (!complete) return n;
        continue;
      }
      i++;
    }
    complete = false;
    return n;
  };

  // A hashbang line is a comment
  scanCode(js.startsWith('#!') ? js.indexOf('\n') + 1 || n : 0, false, 0);
  return { code, strings, complete };
}

/**
 * A module's static imports and re-exports, and dynamic `import('…')` with a literal string, read from its code only
 * (`maskJs`): an import in a comment, a string or a template names nothing, and a module that doesn't tokenize (it
 * would never run) names nothing at all. Only `./`, `../` and `/` specifiers name a file; a bare one (`react`) can't
 * load from a page without an import map and is not a file here.
 */
export function moduleReferences(js: string): Reference[] {
  const { code, strings, complete } = maskJs(js);
  if (!complete) return [];
  const refs: Reference[] = [];
  const res = [
    /(?<![\w$.])import\s*(?:[\w*{}\s,$]+?\s*\bfrom\s*)?"(\d+)"/g,
    /(?<![\w$.])export\s*(?:\*|\{[^}]*\})(?:\s*as\s+[\w$]+)?\s*from\s*"(\d+)"/g,
    /(?<![\w$.])import\s*\(\s*"(\d+)"\s*[,)]/g,
  ];
  for (const re of res) {
    for (const m of code.matchAll(re)) {
      const value = strings[Number(m[1])].trim();
      if (/^(\.{1,2}\/|\/)/.test(value)) refs.push({ value, as: 'module' });
    }
  }
  return refs;
}

/**
 * Whether a script builds the names of files it loads at run time (A3: P1, P2, P5, P9 and `hostile.html`). The gather
 * can't see those files, so the sheet says so in a line. A false line costs nothing; a missed one leaves the person
 * with broken pictures and no warning, so the test leans wide.
 */
export function scriptBuildsReferences(js: string): boolean {
  return [
    /\.(?:src|srcset|href|poster|data)\s*=(?!=)/,
    /setAttribute\(\s*["'`](?:src|srcset|href|poster|xlink:href|data)["'`]/,
    /\bfetch\s*\(/,
    /\bnew\s+(?:Image|Audio|Worker|SharedWorker)\s*\(/,
    /\bimport\s*\(\s*[^"'\s)]/,
    /\bimport\s*\(\s*["'][^"']*["']\s*\+/,
    /\bcreateElement\(\s*["'`](?:img|script|link|video|audio|source|iframe|object|embed|track)["'`]/,
    // bounded, so a large minified script with many innerHTML stays linear
    /(?:innerHTML|outerHTML|insertAdjacentHTML|document\.write)[\s\S]{0,400}?(?:<(?:img|script|link|video|audio|source|iframe|object|embed)\b|\b(?:src|href|srcset)\s*=)/,
    /\burl\(\s*["'`]?\s*\$\{/,
  ].some((re) => re.test(js));
}
