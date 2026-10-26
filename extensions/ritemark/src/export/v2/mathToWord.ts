/**
 * Sprint 138 (#481, R9): equations in Word.
 *
 * The webview typesets each equation with KaTeX and puts KaTeX's MathML, a
 * picture and its size on the export HTML's math element. Here the MathML
 * becomes a native Word equation (OMML) through `mathml2omml`, which ships
 * unmodified as its own module outside the bundle (LGPL-3.0-or-later; the
 * esbuild `external` list and the notices name it). Anything that cannot be
 * converted is the equation's picture; an equation KaTeX could not typeset is
 * its source in the code font. LaTeX never stands in for a typeset equation.
 *
 * `mathml2omml` writes stretchy brackets (`\left( … \right)`, matrices,
 * `cases`, `\binom`) as plain characters, which Word draws at text height
 * beside a tall fraction or matrix. KaTeX marks those brackets
 * `<mo fence="true">`, so this wrapper converts each fenced group on its own
 * and places it in a Word delimiter (`m:d`), which Word stretches. The
 * converter itself is never changed.
 */
import { ImageRun, ImportedXmlComponent, TextRun, type ParagraphChild } from 'docx';
import { parse, HTMLElement, type Node as HtmlNode } from 'node-html-parser';

/** `mathml2omml`'s `mml2omml`: MathML in, an `m:oMath` string out. */
export type MathmlConverter = (mathml: string) => string;

let converterPromise: Promise<MathmlConverter | null> | null = null;

/**
 * The converter, loaded once. `mathml2omml` is ESM only and stays out of the
 * bundle, so it is imported at run time the way the agent SDKs are; esbuild
 * cannot see through `new Function`. Resolves null when it cannot be loaded,
 * and every equation is then its picture.
 */
export function loadMathConverter(): Promise<MathmlConverter | null> {
  if (!converterPromise) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{ mml2omml?: MathmlConverter }>;
    converterPromise = dynamicImport('mathml2omml')
      .then(module => (typeof module.mml2omml === 'function' ? module.mml2omml : null))
      .catch(error => {
        console.warn('[export] mathml2omml is unavailable; equations go to Word as pictures', error);
        return null;
      });
  }
  return converterPromise;
}

const OMML_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

/** Private-use characters stand in for converted bracket groups while the rest converts. */
const PLACEHOLDER_BASE = 0xe000;
const PLACEHOLDER_LIMIT = 0xf7ff;
const PLACEHOLDER_PATTERN = /[\ue000-\uf7ff]/;

function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function elementChildren(node: HTMLElement): HTMLElement[] {
  return node.childNodes.filter((child): child is HTMLElement => child instanceof HTMLElement);
}

/** A bracket KaTeX made for `\left`, `\right`, a matrix or `\binom` (not a fixed-size `\big`). */
function isStretchyFence(node: HTMLElement | undefined): boolean {
  return !!node
    && node.rawTagName.toLowerCase() === 'mo'
    && node.getAttribute('fence') === 'true'
    && !node.hasAttribute('minsize');
}

interface FencedGroup {
  open: string;
  close: string;
  inner: HtmlNode[];
}

/** An `mrow` whose first and/or last child is a stretchy bracket, split into its parts. */
function fencedGroup(node: HTMLElement): FencedGroup | null {
  if (node.rawTagName.toLowerCase() !== 'mrow') return null;
  const children = elementChildren(node);
  if (children.length === 0) return null;
  const first = children[0];
  const last = children[children.length - 1];
  const opens = isStretchyFence(first);
  const closes = children.length > 1 && isStretchyFence(last);
  if (!opens && !closes) return null;
  const inner = node.childNodes.filter(child => (!opens || child !== first) && (!closes || child !== last));
  return {
    open: opens ? first.text : '',
    close: closes ? last.text : '',
    inner,
  };
}

/** The large operators `mathml2omml` turns into `m:nary` (its own test, copied). */
const NARY_OPERATOR = /^[∏-∑]|[∩-∳]|[⋀-⋃]$/;
const SCRIPTED = new Set(['munderover', 'munder', 'mover', 'msubsup', 'msub', 'msup']);
/** Elements whose children are a sequence (MathML's inferred mrow). */
const ROW_CONTAINERS = new Set(['math', 'mrow', 'mstyle', 'mtd', 'msqrt', 'mpadded', 'mphantom', 'menclose', 'merror', 'semantics']);
/** Where a sum's or an integral's operand ends: a relation at the same level. */
const RELATION = /^[=<>≤≥≈≠≡∼≃≅∝→←↔⇒⇐⇔∈∉⊂⊆⊃⊇,;:]$/;

function isLargeOperator(node: HTMLElement): boolean {
  const tag = node.rawTagName.toLowerCase();
  const base = tag === 'mo' ? node : SCRIPTED.has(tag) ? elementChildren(node)[0] : undefined;
  return !!base && base.rawTagName.toLowerCase() === 'mo' && NARY_OPERATOR.test(base.text.trim());
}

function isRelation(node: HtmlNode): boolean {
  return node instanceof HTMLElement && node.rawTagName.toLowerCase() === 'mo' && RELATION.test(node.text.trim());
}

/**
 * `mathml2omml` takes only a token or an `mrow` right after a sum or an
 * integral as its operand, so `\sum_{i} x_i` gives an empty `m:e`, which Word
 * shows as a dotted box, with `x_i` after it. Group what follows the operator,
 * up to the next relation sign, in one `mrow`, so it becomes the operand.
 */
function groupLargeOperatorOperands(node: HTMLElement): void {
  // Only rows hold a sequence; the children of a fraction, a root or a scripted
  // element are its positional arguments and are never regrouped.
  if (!ROW_CONTAINERS.has(node.rawTagName.toLowerCase())) {
    for (const child of elementChildren(node)) groupLargeOperatorOperands(child);
    return;
  }
  let children = elementChildren(node);
  for (let index = 0; index < children.length; index++) {
    const child = children[index];
    if (isLargeOperator(child)) {
      const operand: HTMLElement[] = [];
      for (let next = index + 1; next < children.length && !isRelation(children[next]); next++) {
        operand.push(children[next]);
      }
      const alreadyGrouped = operand.length === 1 && operand[0].rawTagName.toLowerCase() === 'mrow';
      if (operand.length > 0 && !alreadyGrouped) {
        const markup = operand.map(part => part.toString()).join('');
        operand.slice(1).forEach(part => part.remove());
        operand[0].replaceWith(`<mrow>${markup}</mrow>`);
        children = elementChildren(node);
      }
    }
  }
  for (const child of elementChildren(node)) groupLargeOperatorOperands(child);
}

/** Stands in for a space at the edge of `\text{…}`, which the converter's parser trims. */
const TEXT_SPACE = '\uf8f0';

/** Unicode's mathematical alphabets, for the MathML variants the converter does not know. */
const ALPHABETS: Record<string, { upper: number; lower: number; digit?: number; exceptions: Record<string, number> }> = {
  'double-struck': {
    upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8,
    exceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
  },
  fraktur: {
    upper: 0x1d504, lower: 0x1d51e,
    exceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
  },
  script: {
    upper: 0x1d49c, lower: 0x1d4b6,
    exceptions: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
  },
  'sans-serif': { upper: 0x1d5a0, lower: 0x1d5ba, digit: 0x1d7e2, exceptions: {} },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6, exceptions: {} },
};

function toAlphabet(text: string, variant: string): string | null {
  const alphabet = ALPHABETS[variant];
  if (!alphabet) return null;
  return [...text].map(char => {
    if (alphabet.exceptions[char]) return String.fromCodePoint(alphabet.exceptions[char]);
    if (char >= 'A' && char <= 'Z') return String.fromCodePoint(alphabet.upper + char.charCodeAt(0) - 65);
    if (char >= 'a' && char <= 'z') return String.fromCodePoint(alphabet.lower + char.charCodeAt(0) - 97);
    if (alphabet.digit && char >= '0' && char <= '9') return String.fromCodePoint(alphabet.digit + char.charCodeAt(0) - 48);
    return char;
  }).join('');
}

/**
 * Token fixes before conversion, each for something `mathml2omml` gets wrong:
 *  - a variant it does not know (`\mathbb`, upright `\Delta` and `\infty`) became
 *    `m:sty="undefined"`: the letters become Unicode's own alphabet, upright;
 *  - a name like `lim`, `max` or `cos` was set in italic: it is upright, as
 *    MathML says a multi-letter `mi` is;
 *  - `\lvert x \rvert` came out as U+2223, which Word spaces as "divides": a bar;
 *  - the spaces at the edge of `\text{if }` were trimmed away.
 */
function normalizeTokens(node: HTMLElement): void {
  for (const child of elementChildren(node)) {
    const tag = child.rawTagName.toLowerCase();
    if (tag === 'mi') {
      const variant = child.getAttribute('mathvariant');
      const text = child.text;
      const mapped = variant ? toAlphabet(text, variant) : null;
      if (mapped !== null) {
        child.set_content(mapped);
        child.removeAttribute('mathvariant');
        child.setAttribute('fontstyle', 'normal');
      } else if (variant === 'normal' || (!variant && [...text.replace(/\u2061/g, '')].length > 1)) {
        child.removeAttribute('mathvariant');
        child.setAttribute('fontstyle', 'normal');
      }
    } else if (tag === 'mo') {
      if (child.getAttribute('stretchy') === 'false' && child.text === '∣') child.set_content('|');
    } else if (tag === 'mtext') {
      const raw = child.innerHTML;
      const spaced = raw.replace(/^\s+|\s+$/g, run => TEXT_SPACE.repeat(run.length));
      if (spaced !== raw) child.set_content(spaced);
    } else {
      normalizeTokens(child);
    }
  }
}

/**
 * Fixes after conversion: an `m:e` holds at most one `m:argPr` (the converter
 * writes two in a styled table cell); a math run's `m:rPr` comes before its
 * `w:rPr`; an empty `w:rPr` and an `m:sty` of "undefined" go; edge spaces come back.
 */
function tidyOmml(omml: string): string {
  return omml
    .replace(/(<m:argPr>(?:(?!<\/m:argPr>)[\s\S])*<\/m:argPr>)(?:<m:argPr>(?:(?!<\/m:argPr>)[\s\S])*<\/m:argPr>)+/g, '$1')
    .replace(/<m:sty m:val="undefined"\/>/g, '')
    .replace(/<m:rPr><\/m:rPr>|<m:rPr\/>/g, '')
    .replace(/<w:rPr\/>|<w:rPr><\/w:rPr>/g, '')
    .replace(/(<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>)(<m:rPr>(?:(?!<\/m:rPr>)[\s\S])*<\/m:rPr>)/g, '$2$1')
    .replace(new RegExp(TEXT_SPACE, 'g'), ' ');
}

interface ConversionState {
  convert: MathmlConverter;
  fragments: string[];
}

/** Replace each fenced group under `node` with a placeholder, converting its content first. */
function replaceFencedGroups(node: HTMLElement, state: ConversionState): void {
  for (const child of elementChildren(node)) {
    const group = fencedGroup(child);
    if (!group) {
      replaceFencedGroups(child, state);
      continue;
    }
    const innerMarkup = group.inner.map(part => part.toString()).join('');
    const innerOmml = convertFragment(innerMarkup, state);
    const codePoint = PLACEHOLDER_BASE + state.fragments.length;
    if (codePoint > PLACEHOLDER_LIMIT) throw new Error('Too many bracket groups in one equation.');
    state.fragments.push(
      `<m:d><m:dPr><m:begChr m:val="${escapeXmlAttr(group.open)}"/><m:endChr m:val="${escapeXmlAttr(group.close)}"/></m:dPr>`
      + `<m:e>${innerOmml}</m:e></m:d>`,
    );
    child.replaceWith(`<mi>${String.fromCharCode(codePoint)}</mi>`);
  }
}

/** The children of the converter's `m:oMath`, without the element itself. */
function oMathContent(omml: string): string {
  const match = /^\s*<m:oMath\b[^>]*?(?:\/>|>([\s\S]*)<\/m:oMath>)\s*$/.exec(omml);
  if (!match) throw new Error('The converter did not return an m:oMath element.');
  return match[1] ?? '';
}

const RUN_PATTERN = /<m:r>((?:(?!<\/m:r>)[\s\S])*?)<\/m:r>/g;
const RUN_TEXT_PATTERN = /<m:t(\s[^>]*)?>([^<]*)<\/m:t>/;

/** Put each converted bracket group back where its placeholder character landed. */
function restorePlaceholders(omml: string, fragments: string[]): string {
  return omml.replace(RUN_PATTERN, (run: string, body: string) => {
    const textMatch = RUN_TEXT_PATTERN.exec(body);
    if (!textMatch || !PLACEHOLDER_PATTERN.test(textMatch[2])) return run;
    const before = body.slice(0, textMatch.index);
    const after = body.slice(textMatch.index + textMatch[0].length);
    const textRun = (text: string) => (text ? `<m:r>${before}<m:t xml:space="preserve">${text}</m:t>${after}</m:r>` : '');
    let output = '';
    let pending = '';
    for (const char of textMatch[2]) {
      const index = char.charCodeAt(0) - PLACEHOLDER_BASE;
      if (index >= 0 && index < fragments.length) {
        output += textRun(pending) + fragments[index];
        pending = '';
      } else {
        pending += char;
      }
    }
    return output + textRun(pending);
  });
}

function convertFragment(innerMarkup: string, state: ConversionState): string {
  const root = parse(`<math xmlns="http://www.w3.org/1998/Math/MathML">${innerMarkup}</math>`, {
    lowerCaseTagName: false,
    comment: false,
  });
  const math = root.querySelector('math');
  if (!math) throw new Error('No MathML to convert.');
  replaceFencedGroups(math, state);
  groupLargeOperatorOperands(math);
  const content = oMathContent(state.convert(math.toString()));
  return restorePlaceholders(content, state.fragments);
}

/** KaTeX's MathML without its TeX annotation, ready for the converter. */
export function cleanKatexMathml(mathml: string): string {
  return mathml
    .replace(/<annotation\b[^>]*>[\s\S]*?<\/annotation>/g, '')
    .replace(/<annotation-xml\b[^>]*>[\s\S]*?<\/annotation-xml>/g, '');
}

/**
 * One equation's OMML: `m:oMath` inline, or `m:oMathPara` centred for display.
 * Throws when the converter fails or its result is not well-formed OMML; the
 * caller then uses the picture.
 */
export function mathmlToOmml(mathml: string, display: boolean, convert: MathmlConverter): string {
  const root = parse(cleanKatexMathml(mathml), { lowerCaseTagName: false, comment: false });
  const math = root.querySelector('math');
  if (!math) throw new Error('No MathML element.');
  normalizeTokens(math);
  const state: ConversionState = { convert, fragments: [] };
  const content = tidyOmml(convertFragment(math.innerHTML, state));
  const oMath = `<m:oMath xmlns:m="${OMML_NAMESPACE}">${content}</m:oMath>`;
  return display
    ? `<m:oMathPara xmlns:m="${OMML_NAMESPACE}"><m:oMathParaPr><m:jc m:val="center"/></m:oMathParaPr>${content ? `<m:oMath>${content}</m:oMath>` : '<m:oMath/>'}</m:oMathPara>`
    : oMath;
}

/**
 * The OMML as a docx paragraph child. docx 8.5.0's `ImportedXmlComponent`
 * parses it with a strict XML parser, so a malformed result throws here.
 */
export function ommlToParagraphChild(omml: string): ParagraphChild {
  const imported = ImportedXmlComponent.fromXmlString(omml) as unknown as { root: unknown[] };
  const element = imported.root.find(
    (child): child is { rootKey: string } => typeof child === 'object' && child !== null && 'rootKey' in child,
  );
  if (!element || (element.rootKey !== 'm:oMath' && element.rootKey !== 'm:oMathPara')) {
    throw new Error('The equation is not an m:oMath or m:oMathPara element.');
  }
  return element as unknown as ParagraphChild;
}

/** What the webview put on an export's math element (see `webview/src/lib/mathExport.ts`). */
export interface ExportMath {
  display: boolean;
  latex: string;
  /** The equation exactly as the file has it, delimiters included. */
  source: string;
  status: 'ok' | 'error';
  mathml: string;
  /** The picture's PNG, when the webview drew one. */
  image: Buffer | null;
  /** Size in CSS px at the export's text size. */
  width: number;
  height: number;
  depth: number;
}

function numberAttr(element: HTMLElement, name: string): number {
  const value = Number.parseFloat(element.getAttribute(name) ?? '');
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Read an export math element (`span[data-math]` or `div[data-math]`). */
export function readExportMath(element: HTMLElement): ExportMath | null {
  const kind = element.getAttribute('data-math');
  if (kind !== 'inline' && kind !== 'block') return null;
  const latex = element.getAttribute('data-latex') ?? '';
  const source = element.getAttribute('data-source') ?? latex;
  const img = element.querySelector('img[data-math-image]');
  const src = img?.getAttribute('src') ?? '';
  const png = /^data:image\/png;base64,(.+)$/i.exec(src);
  return {
    display: kind === 'block' || element.getAttribute('data-display') === 'true',
    latex,
    source,
    status: element.getAttribute('data-status') === 'ok' ? 'ok' : 'error',
    mathml: element.getAttribute('data-mathml') ?? '',
    image: png ? Buffer.from(png[1], 'base64') : null,
    width: numberAttr(element, 'data-width'),
    height: numberAttr(element, 'data-height'),
    depth: numberAttr(element, 'data-depth'),
  };
}

export interface WordMathStyle {
  codeFont: string;
}

export type WordMathOutcome = 'equation' | 'picture' | 'source';

/**
 * The equation as a Word paragraph child: a native equation, else its picture,
 * else (KaTeX could not typeset it) its source in the code font.
 */
export function mathToWordChild(
  math: ExportMath,
  style: WordMathStyle,
  convert: MathmlConverter | null,
): { child: ParagraphChild; outcome: WordMathOutcome } {
  if (math.status === 'ok' && math.mathml && convert) {
    try {
      return { child: ommlToParagraphChild(mathmlToOmml(math.mathml, math.display, convert)), outcome: 'equation' };
    } catch (error) {
      console.warn('[export] equation converted to a picture for Word:', math.latex, error);
    }
  }
  if (math.status === 'ok' && math.image && math.width > 0 && math.height > 0) {
    return {
      child: new ImageRun({
        data: math.image,
        transformation: { width: Math.round(math.width), height: Math.round(math.height) },
      }),
      outcome: 'picture',
    };
  }
  return { child: new TextRun({ text: math.source, font: style.codeFont }), outcome: 'source' };
}
