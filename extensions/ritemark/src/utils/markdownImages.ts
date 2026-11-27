// The deck importer's destination regex only handles one level of parentheses.
// Index bracket pairs and bare destination ends once so malformed candidates
// cannot repeatedly walk the same suffix.
const punctuation = /[!-/:-@\[-`{-~]/;
const angleDestination = /<((?:\\[!-/:-@\[-`{-~]|[^\\<>\r\n]|\\(?![!-/:-@\[-`{-~]))*)>/y;
const doubleTitle = /"(?:\\[!-/:-@\[-`{-~]|[^\\"]|\\(?![!-/:-@\[-`{-~]))*"/y;
const singleTitle = /'(?:\\[!-/:-@\[-`{-~]|[^\\']|\\(?![!-/:-@\[-`{-~]))*'/y;
const parenTitle = /\((?:\\[!-/:-@\[-`{-~]|[^\\()]|\\(?![!-/:-@\[-`{-~]))*\)/y;
const whitespace = /[ \t\r\n]*/y;
const definitionEnd = /[ \t]*(?:\r?\n|$)/y;
const definitionStart = /(?:^|\n) {0,3}(?=\[)/g;

function matchAt(rule: RegExp, source: string, start: number): RegExpExecArray | null {
  rule.lastIndex = start;
  return rule.exec(source);
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Local path candidates from inline pictures and the definitions referenced by pictures. */
export function markdownImageDestinations(source: string): Set<string> {
  const destinations = new Set<string>();
  if (!source.includes('![')) return destinations;

  const brackets = new Uint32Array(source.length);
  const escaped = new Uint8Array(source.length);
  const pendingBrackets: number[] = [];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\\' && punctuation.test(source[i + 1] ?? '')) {
      escaped[++i] = 1;
    } else if (source[i] === '[') {
      pendingBrackets.push(i);
    } else if (source[i] === ']' && pendingBrackets.length) {
      brackets[pendingBrackets.pop()!] = i;
    }
  }

  const bareEnd = new Uint32Array(source.length + 1);
  bareEnd[source.length] = source.length;
  for (let i = source.length - 1; i >= 0; i--) {
    const char = source[i];
    if (char === '(' && !escaped[i]) {
      const close = bareEnd[i + 1];
      bareEnd[i] = source[close] === ')' && !escaped[close] ? bareEnd[close + 1] : i;
    } else {
      bareEnd[i] = (char === ')' && !escaped[i]) || source.charCodeAt(i) <= 32 || source.charCodeAt(i) === 127
        ? i : bareEnd[i + 1];
    }
  }

  // Nested or malformed candidates can share a destination end or title.
  // Memoize the lookahead so the last part of the candidate is read once.
  const spaceEnds = new Map<number, number>();
  const titleEnds = new Map<number, number>();
  function skipSpace(start: number): number {
    if (!/[ \t\r\n]/.test(source[start] ?? '')) return start;
    const known = spaceEnds.get(start);
    if (known !== undefined) return known;
    matchAt(whitespace, source, start);
    const end = whitespace.lastIndex;
    spaceEnds.set(start, end);
    return end;
  }

  function readTitle(start: number): number {
    const known = titleEnds.get(start);
    if (known !== undefined) return known;
    const opener = source[start];
    const rule = opener === '"' ? doubleTitle : opener === "'" ? singleTitle : opener === '(' ? parenTitle : undefined;
    if (!rule) return start;
    const match = matchAt(rule, source, start);
    const end = match && !/\n[ \t\r]*\n/.test(match[0]) ? rule.lastIndex : start;
    titleEnds.set(start, end);
    return end;
  }

  function readTarget(start: number, definition: boolean): { target: string; tail: number } | undefined {
    let targetStart = start;
    let targetEnd = bareEnd[start];
    let end = targetEnd;
    if (source[start] === '<') {
      const angle = matchAt(angleDestination, source, start);
      if (!angle) return;
      targetStart++;
      targetEnd = targetStart + angle[1].length;
      end = targetEnd + 1;
    } else if (end === start) {
      return;
    }

    let tail = skipSpace(end);
    if (tail > end) {
      const titleEnd = readTitle(tail);
      if (titleEnd > tail) {
        end = titleEnd;
        tail = skipSpace(end);
      }
    }

    if (definition ? !matchAt(definitionEnd, source, end) : source[tail] !== ')') return;
    return { target: source.slice(targetStart, targetEnd), tail };
  }

  const references = new Set<string>();
  for (let i = source.indexOf('!['); i !== -1; i = source.indexOf('![', i + 1)) {
    if (escaped[i]) continue;
    const close = brackets[i + 1];
    if (!close) continue;
    const next = close + 1;
    if (source[next] === '(') {
      const inline = readTarget(skipSpace(next + 1), false);
      if (inline) {
        destinations.add(inline.target);
        i = inline.tail;
      }
    } else {
      const refClose = source[next] === '[' ? brackets[next] : 0;
      const start = refClose > next + 1 ? next + 1 : i + 2;
      const end = refClose > next + 1 ? refClose : close;
      if (end - start <= 999) {
        const label = normalizeLabel(source.slice(start, end));
        if (label) references.add(label);
      }
    }
  }

  if (references.size) {
    for (const match of source.matchAll(definitionStart)) {
      const start = match.index + match[0].length;
      const close = brackets[start];
      if (!close || close - start > 1000 || source[close + 1] !== ':') continue;
      const label = normalizeLabel(source.slice(start + 1, close));
      if (!references.has(label)) continue;
      const definition = readTarget(skipSpace(close + 2), true);
      if (definition) {
        destinations.add(definition.target);
        references.delete(label); // CommonMark uses the first definition.
      }
    }
  }
  return destinations;
}
