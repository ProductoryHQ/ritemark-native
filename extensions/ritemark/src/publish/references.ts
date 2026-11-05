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
  /** What kind of thing the page expects there, when the tag says so. */
  as: 'style' | 'module' | 'script' | 'any';
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
    const rel = (attrs.rel ?? '').toLowerCase();
    for (const name of SINGLE_URL_ATTRIBUTES) {
      const value = attrs[name];
      if (value === undefined) continue;
      if (name === 'data' && !DATA_URL_TAGS.has(tag)) continue;
      if ((name === 'href' || name === 'xlink:href') && NON_LOADING_HREF_TAGS.has(tag)) continue;
      if (looksBuilt(value)) out.builtAttribute = true;
      let as: Reference['as'] = 'any';
      if (tag === 'link' && name === 'href') {
        if (/\bstylesheet\b/.test(rel)) as = 'style';
        else if (/\bmodulepreload\b/.test(rel)) as = 'module';
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

/** `url(…)` and `@import` in CSS text. Comments are dropped first, so a commented-out file doesn't go. */
export function cssReferences(css: string): Reference[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const refs: Reference[] = [];
  const importRe = /@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^\s;)]+))/gi;
  for (const m of text.matchAll(importRe)) {
    const value = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (value) refs.push({ value, as: 'style' });
  }
  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
  for (const m of text.matchAll(urlRe)) {
    // `@import url(x.css)` was taken above as a stylesheet; the same text here would be taken twice
    const before = text.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0);
    if (/@import\s+$/i.test(before)) continue;
    const value = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (value) refs.push({ value, as: 'any' });
  }
  return refs;
}

/**
 * A module's static imports and re-exports, and dynamic `import('…')` with a literal string. Only `./`, `../` and `/`
 * specifiers name a file; a bare one (`react`) can't load from a page without an import map and is not a file here.
 */
export function moduleReferences(js: string): Reference[] {
  const refs: Reference[] = [];
  const res = [
    /\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"'\n]+)["']/g,
    /\bexport\s+(?:\*|\{[^}]*\})(?:\s+as\s+[\w$]+)?\s+from\s+["']([^"'\n]+)["']/g,
    /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
  ];
  for (const re of res) {
    for (const m of js.matchAll(re)) {
      const value = m[1].trim();
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
