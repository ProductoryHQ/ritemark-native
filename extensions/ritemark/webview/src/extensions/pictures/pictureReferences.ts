import { Lexer, type Marked, type MarkedExtension, type Token, type Tokens } from 'marked'
import { tightAttribute } from '../../utils/markdownAsWritten'

export const pictureDefinitionAttribute = 'data-md-image-definition'

// Lexer initializes marked's tokenizer with the same definition and reference rules used on load.
const definitionTokenizer = new Lexer({}).options.tokenizer!

/** Read a definition as marked does, without accepting any Markdown after it. */
export function pictureDefinition(raw: string): Tokens.Def | undefined {
  if (!/^ {0,3}\[/.test(raw)) return
  const definition = definitionTokenizer.def(raw)
  if (definition?.raw === raw) return definition
}

interface PictureDefinition extends Tokens.Generic {
  type: 'pictureDefinition'
  tag: string
  keep?: boolean
}

type ReferencePicture = Tokens.Image & { referenceLabel?: string }

function reference(token: Tokens.Image): { tag: string; label: string } | undefined {
  const { reflink, nolink } = definitionTokenizer.rules.inline
  const match = reflink.exec(token.raw) ?? nolink.exec(token.raw)
  if (match?.[0] !== token.raw) return
  return {
    tag: (match[2] || match[1]).toLowerCase().replace(/\s+/g, ' '),
    label: token.raw.slice(0, match[1].length + 3),
  }
}

/** The lexer normally discards definitions after registering them for inline parsing. */
export const pictureReferencesExtension: MarkedExtension = {
  extensions: [{
    name: 'pictureDefinition',
    level: 'block',
    tokenizer(src, tokens) {
      if (!/^ {0,3}\[/.test(src)) return
      const previous = tokens[tokens.length - 1]
      if (previous?.type === 'paragraph' || previous?.type === 'text') return
      const definition = definitionTokenizer.def(src)
      if (!definition) return
      this.lexer.tokens.links[definition.tag] ??= { href: definition.href, title: definition.title }
      return { type: 'pictureDefinition', tag: definition.tag, raw: definition.raw }
    },
    renderer(token) {
      if (!(token as PictureDefinition).keep) return ''
      const raw = token.raw.replace(/\n+$/, '')
      const escaped = raw.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const tight = tightAttribute(token) ? ' data-md-tight="true"' : ''
      return `<hr hidden ${pictureDefinitionAttribute}="${escaped}"${tight}>\n`
    },
  }],
}

export function annotatePictureReferences(instance: Marked, tokens: Token[]): void {
  const references = new Set<string>()
  const definitions: PictureDefinition[] = []
  instance.walkTokens(tokens, token => {
    if (token.type === 'image') {
      const image = token as ReferencePicture
      const found = reference(image)
      if (found) {
        image.referenceLabel = found.label
        references.add(found.tag)
      }
    } else if (token.type === 'pictureDefinition') {
      definitions.push(token as PictureDefinition)
    }
  })
  for (const definition of definitions) definition.keep = references.has(definition.tag)
}

