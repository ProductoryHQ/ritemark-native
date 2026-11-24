/** Office Math is shared by the document reader and the Word preview export. */
const MATH = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const STRICT_MATH = 'http://purl.oclc.org/ooxml/officeDocument/math';
const WORD_NAMESPACES = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
]);

export function isOmml(node: Element): boolean {
  return node.namespaceURI === MATH || node.namespaceURI === STRICT_MATH;
}

export function isOmmlEquation(node: Element): boolean {
  return isOmml(node) && (node.localName === 'oMath' || node.localName === 'oMathPara');
}

function elements(node: Element): Element[] {
  const result: Element[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) result.push(child as Element);
  }
  return result;
}

function mathChild(node: Element | undefined, name: string): Element | undefined {
  return node && elements(node).find(child => isOmml(child) && child.localName === name);
}

const SYMBOLS = new Map(Object.entries({
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'varepsilon', ϵ: 'epsilon', ζ: 'zeta',
  η: 'eta', θ: 'theta', ϑ: 'vartheta', ι: 'iota', κ: 'kappa', ϰ: 'varkappa', λ: 'lambda',
  μ: 'mu', ν: 'nu', ξ: 'xi', π: 'pi', ϖ: 'varpi', ρ: 'rho', ϱ: 'varrho', σ: 'sigma',
  ς: 'varsigma', τ: 'tau', υ: 'upsilon', φ: 'varphi', ϕ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega',
  Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Ξ: 'Xi', Π: 'Pi', Σ: 'Sigma', Υ: 'Upsilon',
  Φ: 'Phi', Ψ: 'Psi', Ω: 'Omega',
  '±': 'pm', '∓': 'mp', '×': 'times', '÷': 'div', '⋅': 'cdot', '·': 'cdot', '∗': 'ast',
  '≤': 'le', '≥': 'ge', '≠': 'ne', '≈': 'approx', '≡': 'equiv', '∼': 'sim', '∝': 'propto',
  '→': 'to', '←': 'leftarrow', '↔': 'leftrightarrow', '⇒': 'Rightarrow', '⇔': 'Leftrightarrow',
  '∞': 'infty', '∂': 'partial', '∇': 'nabla', '∈': 'in', '∉': 'notin', '⊂': 'subset',
  '⊆': 'subseteq', '∀': 'forall', '∃': 'exists', '∅': 'emptyset', '∣': 'mid',
  '∩': 'cap', '∪': 'cup', '∧': 'land', '∨': 'lor', '…': 'ldots', '⋯': 'cdots',
  '∑': 'sum', '∏': 'prod', '∐': 'coprod', '∫': 'int', '∬': 'iint', '∭': 'iiint',
  '∮': 'oint', '∯': 'oiint', '∰': 'oiiint', '⋂': 'bigcap', '⋃': 'bigcup',
  '⋀': 'bigwedge', '⋁': 'bigvee', '⨀': 'bigodot', '⨁': 'bigoplus', '⨂': 'bigotimes', '⨄': 'biguplus',
}));

const ESCAPES = new Map(Object.entries({
  '\\': '\\backslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#',
  '%': '\\%', '_': '\\_', '^': '\\text{\\textasciicircum}', '~': '\\text{\\textasciitilde}', '|': '\\vert ',
}));
const DOUBLE_STRUCK = new Map(Object.entries({ ℂ: 'C', ℍ: 'H', ℕ: 'N', ℙ: 'P', ℚ: 'Q', ℝ: 'R', ℤ: 'Z' }));

function latexText(value: string, literal = false): string {
  return Array.from(value.replace(/[\r\n\t]/g, ' '), char => {
    if (literal) {
      if (char === '\\') return '\\textbackslash{}';
      if (char === '|') return '\\textbar{}';
      if (char === '^') return '\\textasciicircum{}';
      if (char === '~') return '\\textasciitilde{}';
      return ESCAPES.get(char) ?? char;
    }
    const symbol = SYMBOLS.get(char);
    if (symbol) return `\\${symbol} `;
    if (char === '−') return '-';
    if (char === '⁡' || char === '⁢' || char === '⁣') return '';
    const code = char.codePointAt(0)!;
    const letter = DOUBLE_STRUCK.get(char) ?? (code >= 0x1d538 && code <= 0x1d551
      ? String.fromCharCode(65 + code - 0x1d538) : undefined);
    return letter ? `\\mathbb{${letter}}` : ESCAPES.get(char) ?? char;
  }).join('');
}

const FUNCTIONS = new Set('sin cos tan cot sec csc arcsin arccos arctan sinh cosh tanh coth exp log ln lg lim limsup liminf min max sup inf det gcd dim ker hom arg deg Pr'.split(' '));
const DELIMITERS = new Map(Object.entries({
  '': '.', '{': '\\{', '}': '\\}', '|': '\\vert', '‖': '\\Vert', '∥': '\\Vert',
  '⟨': '\\langle', '⟩': '\\rangle', '⌊': '\\lfloor', '⌋': '\\rfloor',
  '⌈': '\\lceil', '⌉': '\\rceil', '<': '\\langle', '>': '\\rangle',
}));
const ACCENTS = new Map(Object.entries({
  '̂': 'hat', '^': 'hat', 'ˆ': 'hat', '̃': 'tilde', '~': 'tilde', '˜': 'tilde',
  '̄': 'bar', '¯': 'bar', 'ˉ': 'bar', '̅': 'overline', '̇': 'dot', '˙': 'dot', '̈': 'ddot',
  '⃛': 'dddot', '⃜': 'ddddot', '⃗': 'vec', '→': 'vec', '̌': 'check', '̆': 'breve', '́': 'acute', '̀': 'grave',
}));
const GROUPS = new Map(Object.entries({
  '⏞': 'overbrace', '⏟': 'underbrace', '⏜': 'overgroup', '⏝': 'undergroup',
  '⎴': 'overbracket', '⎵': 'underbracket', '→': 'overrightarrow', '←': 'overleftarrow',
}));
const CONTAINERS = new Set('oMath r e num den sub sup deg lim'.split(' '));
const PROPERTIES = new Set((
  'oMathParaPr argPr rPr fPr sSubPr sSupPr sSubSupPr sPrePr radPr naryPr dPr mPr mrPr funcPr accPr barPr ' +
  'limLowPr limUppPr boxPr borderBoxPr groupChrPr eqArrPr ctrlPr mcPr mcs mc jc type degHide chr limLoc grow ' +
  'subHide supHide begChr endChr sepChr shp baseJc plcHide count mcJc pos vertJc scr sty nor lit aln brk ' +
  'argSz scrLvl rSp rSpRule cGp cGpRule cSp maxDist objDist opEmu diff noBreak hideTop hideBot hideLeft ' +
  'hideRight strikeH strikeV strikeBLTR strikeTLBR'
).split(' '));

function isWordFormatting(node: Element): boolean {
  return WORD_NAMESPACES.has(node.namespaceURI ?? '') && node.localName === 'rPr';
}

function isProperty(node: Element): boolean {
  return isOmml(node) && PROPERTIES.has(node.localName);
}

function unsupported(): never {
  throw new Error('Unsupported Office Math');
}

/** Validate ignored formatting too, so unknown OMML does not silently disappear. */
function validateProperty(node: Element, depth: number): void {
  if (depth > 128) unsupported();
  for (const child of elements(node)) {
    if (isWordFormatting(child)) continue;
    if (!isProperty(child)) unsupported();
    validateProperty(child, depth + 1);
  }
}

function script(latex: string, marker: string): string {
  return latex ? `${marker}{${latex}}` : '';
}

function delimiter(value: string): string | undefined {
  return DELIMITERS.get(value) ?? (/^[()[\]/]$/.test(value) ? value : undefined);
}

function mathEnvironment(name: string, rows: string[]): string {
  return `\\begin{${name}}${rows.join(' \\\\ ')}\\end{${name}}`;
}

function mathFlag(node: Element | undefined): boolean {
  if (!node) return false;
  return !['0', 'off', 'false'].includes(node.getAttributeNS(node.namespaceURI, 'val') ?? '');
}

function convert(node: Element, display: boolean, depth = 0, align = false): string {
  if (depth > 128) unsupported();
  if (isWordFormatting(node)) return '';
  if (WORD_NAMESPACES.has(node.namespaceURI ?? '') && node.localName === 't') {
    return `\\text{${latexText(node.textContent ?? '', true)}}`;
  }
  if (!isOmml(node)) unsupported();
  if (isProperty(node)) {
    validateProperty(node, depth);
    return '';
  }

  const tag = node.localName;
  const parts = elements(node);
  // Convert each child once. This also checks for unknown children of structured constructs.
  const rendered = parts.map(child => {
    const row = tag === 'eqArr' && isOmml(child) && child.localName === 'e';
    const latex = convert(child, display, depth + 1, row);
    return align && mathFlag(mathChild(mathChild(child, 'rPr'), 'aln')) ? ` & ${latex}` : latex;
  });
  const args = (name: string) => rendered.filter((_, index) => isOmml(parts[index]) && parts[index].localName === name);
  const arg = (name: string) => args(name)[0] ?? '';
  const prop = (name: string, fallback = '') => {
    const field = mathChild(mathChild(node, `${tag}Pr`), name);
    return field?.hasAttributeNS(field.namespaceURI, 'val') ? field.getAttributeNS(field.namespaceURI, 'val')! : fallback;
  };
  const on = (name: string) => mathFlag(mathChild(mathChild(node, `${tag}Pr`), name));
  const base = arg('e');
  const sub = script(arg('sub'), '_');
  const sup = script(arg('sup'), '^');
  // A multi-token base needs braces so the script applies to the whole argument.
  // A lone closing fence is how the Word exporter represents (x+y)^2.
  const scriptBase = () => /^(?:[\p{L}\d)\]]|\\[a-zA-Z]+(?:\{[^{}]*\})?)$/u.test(base.trim())
    ? base.trim() : `{${base}}`;

  if (CONTAINERS.has(tag)) {
    if (tag === 'r') {
      const value = parts.filter(child => child.localName === 't').map(child => child.textContent ?? '').join('');
      const properties = mathChild(node, 'rPr');
      const normal = mathChild(properties, 'nor');
      if (mathFlag(normal)) {
        const escaped = latexText(value, true);
        return value.trim() ? `\\text{${escaped}}` : value ? '\\,' : '';
      }
      const style = mathChild(properties, 'sty');
      if (style?.getAttributeNS(style.namespaceURI, 'val') === 'p' && FUNCTIONS.has(value)) return `\\${value} `;
    }
    return rendered.join('');
  }

  switch (tag) {
    case 't': return latexText(node.textContent ?? '');
    case 'oMathPara': return args('oMath').length > 1 ? mathEnvironment('gathered', args('oMath')) : arg('oMath');
    case 'f': {
      const num = arg('num');
      const den = arg('den');
      switch (prop('type', 'bar')) {
        case 'lin': return `{ ${num} }/{ ${den} }`;
        case 'skw': return `{}^{${num}}\\!\\!/\\!\\!{}_{${den}}`;
        case 'noBar': return `\\genfrac{}{}{0pt}{}{${num}}{${den}}`;
        case 'bar': return `\\frac{${num}}{${den}}`;
        default: return unsupported();
      }
    }
    case 'sSub': return scriptBase() + sub;
    case 'sSup': return scriptBase() + sup;
    case 'sSubSup': return scriptBase() + sub + sup;
    case 'sPre': return `{}${sub}${sup}${scriptBase()}`;
    case 'rad': return `\\sqrt${arg('deg') && !on('degHide') ? `[${arg('deg')}]` : ''}{${base}}`;
    case 'nary': {
      const symbol = prop('chr', '∫');
      const knownOperator = '∑∏∐∫∬∭∮∯∰⋂⋃⋀⋁⨀⨁⨂⨄'.includes(symbol) && symbol !== '';
      const glyph = latexText(symbol).trim();
      const operator = knownOperator ? glyph : `\\mathop{${glyph}}`;
      const location = prop('limLoc');
      const stackedByDefault = display && !'∫∬∭∮∯∰'.includes(symbol);
      const limits = location === 'undOvr' && !stackedByDefault ? '\\limits'
        : location === 'subSup' && stackedByDefault ? '\\nolimits' : '';
      return `${operator}${limits}${on('subHide') ? '' : sub}${on('supHide') ? '' : sup} ${base}`.trimEnd() + ' ';
    }
    case 'd': {
      const left = prop('begChr', '(');
      const right = prop('endChr', ')');
      const operands = args('e');
      const operand = mathChild(node, 'e');
      const matrix = operand && mathChild(operand, 'm');
      if (operands.length === 1 && matrix && elements(operand!).every(child => child === matrix || isProperty(child))) {
        const environment = new Map([['()', 'pmatrix'], ['[]', 'bmatrix'], ['{}', 'Bmatrix'],
          ['||', 'vmatrix'], ['‖‖', 'Vmatrix'], ['{', 'cases']]).get(left + right);
        if (environment) return operands[0].replace(/^\\begin\{matrix\}|\\end\{matrix\}$/g,
          match => match.replace('matrix', environment));
      }
      const middle = prop('sepChr', '|');
      const leftFence = delimiter(left);
      const rightFence = delimiter(right);
      const separator = delimiter(middle);
      const joiner = !middle ? '' : separator ? ` \\middle${separator} ` : latexText(middle);
      const opening = leftFence ?? '.';
      const closing = rightFence ?? '.';
      const before = leftFence ? '' : `\\mathopen{${latexText(left)}}`;
      const after = rightFence ? '' : `\\mathclose{${latexText(right)}}`;
      return `${before}\\left${opening} ${operands.join(joiner)} \\right${closing}${after} `;
    }
    case 'mr': return args('e').join(' & ');
    case 'm': return mathEnvironment('matrix', args('mr'));
    case 'func': return `${arg('fName')} ${base}`;
    case 'fName': {
      const name = node.textContent?.trim() ?? '';
      return FUNCTIONS.has(name) ? `\\${name}` : `\\operatorname{${latexText(name, true)}}`;
    }
    case 'acc': {
      const accent = ACCENTS.get(prop('chr', '̂')) ?? unsupported();
      return `\\${accent}{${base}}`;
    }
    case 'bar': return `\\${prop('pos', 'bot') === 'top' ? 'overline' : 'underline'}{${base}}`;
    case 'limLow': return base.trim() === '\\lim' ? `\\lim_{${arg('lim')}}` : `\\underset{${arg('lim')}}{${base}}`;
    case 'limUpp': return `\\overset{${arg('lim')}}{${base}}`;
    case 'box': return base;
    case 'borderBox': return `\\boxed{${base}}`;
    case 'groupChr': {
      const below = prop('pos', 'bot') === 'bot';
      const group = GROUPS.get(prop('chr', below ? '⏟' : '⏞')) ?? unsupported();
      return `\\${group}{${base}}`;
    }
    case 'eqArr': return mathEnvironment('aligned', args('e'));
    default: return unsupported();
  }
}

/** Read runs in an unknown equation without recursing through its XML. */
function fallbackText(root: Element): string {
  const text: string[] = [];
  const pending: Node[] = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.nodeType === 1) {
      const element = node as Element;
      if (isProperty(element) || isWordFormatting(element)) continue;
      if (element.localName === 't') {
        text.push(element.textContent ?? '');
        continue;
      }
    }
    if ((node.nodeType === 3 || node.nodeType === 4) && node.nodeValue?.trim()) text.push(node.nodeValue);
    for (let child = node.lastChild; child; child = child.previousSibling) pending.push(child);
  }
  return text.join('').trim().replace(/[\r\n\t]+/g, ' ');
}

export interface WordEquation {
  latex: string;
  display: boolean;
  approximate: boolean;
}

export function ommlToLatex(node: Element): WordEquation {
  const display = node.localName === 'oMathPara';
  try {
    const latex = convert(node, display).trim();
    if (latex) return { latex, display, approximate: false };
  } catch {
    // An unsupported construct falls back as a whole, keeping its text.
  }
  const plain = fallbackText(node);
  const latex = Array.from(plain, char => ESCAPES.get(char) ?? char).join('');
  return { latex: latex || '\\text{}', display, approximate: true };
}

export function equationMarkdown(equation: WordEquation, inline = false): string {
  return equation.display && !inline ? `$$\n${equation.latex}\n$$` : `$${equation.latex}$`;
}
