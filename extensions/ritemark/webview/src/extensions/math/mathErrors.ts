/**
 * Sprint 138 (#481, R6): why an equation cannot be typeset, in one plain
 * sentence, worded as experience 38 draws it. KaTeX's own messages ("KaTeX
 * parse error: Expected '}', got 'EOF' at end of input") are not for people.
 *
 * The sentence is built from the source where it can be (an unclosed brace or
 * environment), and from KaTeX's raw message for an unknown command. The
 * words "KaTeX", "render" and "math mode" never appear.
 */

/** A sentence as text and code pieces, so the tooltip can set commands in the code face. */
export type SentencePart = { text: string } | { code: string }

const PREFIX = "Ritemark can't typeset this"

function unescapedCount(latex: string, char: '{' | '}'): number {
  let count = 0
  for (let index = 0; index < latex.length; index++) {
    if (latex[index] !== char) continue
    let backslashes = 0
    while (index - backslashes > 0 && latex[index - backslashes - 1] === '\\') backslashes++
    if (backslashes % 2 === 0) count++
  }
  return count
}

/** The first `\begin{name}` without its `\end{name}`, or null. */
function unclosedEnvironment(latex: string): string | null {
  const open = new Map<string, number>()
  for (const match of latex.matchAll(/\\(begin|end)\{([^}]*)\}/g)) {
    const name = match[2]
    open.set(name, (open.get(name) ?? 0) + (match[1] === 'begin' ? 1 : -1))
  }
  for (const [name, balance] of open) if (balance > 0) return name
  return null
}

/** The command KaTeX did not know, from its raw message. */
function unknownCommand(rawMessage: string): string | null {
  const match = /Undefined control sequence:\s*(\\[A-Za-z@]+|\\.)/.exec(rawMessage)
  return match ? match[1] : null
}

/** One plain sentence for a typesetting error, in parts. */
export function mathErrorSentence(latex: string, error: unknown): SentencePart[] {
  const raw = typeof error === 'object' && error !== null
    ? String((error as { rawMessage?: unknown }).rawMessage ?? (error as { message?: unknown }).message ?? '')
    : String(error ?? '')

  const command = unknownCommand(raw)
  if (command) return [{ text: `${PREFIX}: ` }, { code: command }, { text: " isn't a command it knows." }]

  const environment = unclosedEnvironment(latex)
  if (environment) {
    return [{ text: `${PREFIX}: ` }, { code: `\\begin{${environment}}` }, { text: ' has no ' }, { code: `\\end{${environment}}` }, { text: '.' }]
  }

  if (unescapedCount(latex, '{') > unescapedCount(latex, '}')) {
    return [{ text: `${PREFIX}: a ` }, { code: '{' }, { text: ' has no matching ' }, { code: '}' }, { text: '.' }]
  }

  return [{ text: `${PREFIX}. The source is kept as it is.` }]
}

/** The sentence as plain text, for an accessible label. */
export function sentenceText(parts: SentencePart[]): string {
  return parts.map(part => ('code' in part ? part.code : part.text)).join('')
}
