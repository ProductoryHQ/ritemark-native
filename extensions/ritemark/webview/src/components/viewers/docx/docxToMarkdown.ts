import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { isOmmlEquation, ommlToLatex, type WordEquation } from '../../../../../src/documents/ommlToLatex'
import { mathElementSource } from '../../../extensions/math/mathTurndownRules'
import { createTurndownService } from '../../../utils/turndownService'
import { buildExtractedImageFilename, mimeToExt } from '../../../utils/imageNaming'

interface ExtractedImage {
  filename: string
  contentType: string
  base64: string
}

function htmlAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Mammoth discards OMML. Carry markers as ordinary Word runs, then turn
 * them into math spans before Turndown sees them and escapes the LaTeX. */
async function preserveEquations(bytes: Uint8Array) {
  const original = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer as ArrayBuffer : bytes.slice().buffer as ArrayBuffer
  const unchanged = { buffer: original, restore: (html: string) => html }
  const zip = await JSZip.loadAsync(bytes)
  const part = zip.file('word/document.xml')
  if (!part) return unchanged
  const xml = await part.async('string')
  if (!/<(?:[\w.-]+:)?oMath(?:Para)?[\s/>]/.test(xml) || /<!DOCTYPE/i.test(xml)) return unchanged

  let valid = true
  const invalid = () => { valid = false }
  const doc = new DOMParser({ errorHandler: { warning: invalid, error: invalid, fatalError: invalid } })
    .parseFromString(xml, 'application/xml')
  if (!valid) return unchanged

  const root = doc.documentElement
  if (!root?.namespaceURI) return unchanged
  const word = root.namespaceURI
  const prefix = root.prefix ? `${root.prefix}:` : ''
  // A fresh marker cannot collide with text or attributes in the source.
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)),
    byte => byte.toString(16).padStart(2, '0')).join('')
  const marker = `RITEMARKWORDEQUATION${nonce}X`

  const equations: WordEquation[] = []
  const nodes = doc.getElementsByTagName('*')
  // Snapshot the live list before replacing nodes. A display paragraph owns
  // its child equations, so only the outermost equation gets a marker.
  for (const node of Array.from(nodes)) {
    if (!isOmmlEquation(node)) continue
    let inTable = false
    let inParagraph = false
    let nested = false
    for (let parent = node.parentNode; parent?.nodeType === 1; parent = parent.parentNode) {
      const element = parent as Element
      if (isOmmlEquation(element)) {
        nested = true
        break
      }
      if (element.namespaceURI === word) {
        if (element.localName === 'tc') inTable = true
        if (element.localName === 'p') inParagraph = true
      }
    }
    if (nested || !node.parentNode) continue
    const equation = ommlToLatex(node)
    const run = doc.createElementNS(word, `${prefix}r`)
    const runText = doc.createElementNS(word, `${prefix}t`)
    runText.appendChild(doc.createTextNode(`${marker}${equations.length}END`))
    run.appendChild(runText)
    let replacement = run
    if (!inParagraph) {
      replacement = doc.createElementNS(word, `${prefix}p`)
      replacement.appendChild(run)
    }
    node.parentNode.replaceChild(replacement, node)
    equations.push({ ...equation, display: equation.display && !inTable })
  }

  if (!equations.length) return unchanged
  zip.file(part.name, new XMLSerializer().serializeToString(doc))
  const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
  const pattern = new RegExp(`${marker}(\\d+)END`, 'g')
  return {
    buffer,
    restore(html: string): string {
      let previousEnd = -1
      return html.replace(pattern, (match, index: string, at: number) => {
        const equation = equations[Number(index)]
        if (!equation) return match
        const { latex, display } = equation
        const displayMarks = display ? ' data-open="$$&#10;" data-close="&#10;$$"' : ''
        const space = at === previousEnd ? ' ' : ''
        previousEnd = at + match.length
        return `${space}<span data-math="${display ? 'block' : 'inline'}" data-latex="${htmlAttribute(latex)}"${displayMarks}>${match}</span>`
      })
    },
  }
}

export async function docxToMarkdown(bytes: Uint8Array, sourceBasename: string) {
  const images: ExtractedImage[] = []
  const unrecognizedMimes = new Set<string>()

  const { buffer, restore } = await preserveEquations(bytes)
  // Mammoth's Node entry point (used by tests) takes a Buffer, while
  // Vite's browser entry point takes an ArrayBuffer.
  const input = typeof Buffer === 'undefined' ? { arrayBuffer: buffer } : { arrayBuffer: buffer, buffer: Buffer.from(buffer) }
  const result = await mammoth.convertToHtml(
    input,
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const base64 = await image.readAsBase64String()
        const { ext, recognized } = mimeToExt(image.contentType)
        if (!recognized) unrecognizedMimes.add(image.contentType)
        const imgFilename = buildExtractedImageFilename(
          sourceBasename,
          images.length + 1,
          ext
        )
        images.push({ filename: imgFilename, contentType: image.contentType, base64 })
        const relPath = `./images/${imgFilename}`
        // src + title=relative path so the shared turndown image rule (in
        // utils/turndownService) emits ./images/... in the final markdown
        // rather than the DOM-resolved absolute URL.
        return { src: relPath, title: relPath }
      }),
    }
  )

  const html = result.value
  const warnings = result.messages
    .filter((m) => m.type === 'warning')
    .map((m) => m.message)

  if (unrecognizedMimes.size > 0) {
    warnings.push(
      `Saved ${unrecognizedMimes.size} image${unrecognizedMimes.size === 1 ? '' : 's'} with unrecognized content type${unrecognizedMimes.size === 1 ? '' : 's'} (${[...unrecognizedMimes].join(', ')}); files were written with .png extension and may not render correctly.`
    )
  }

  const turndownService = createTurndownService()
  turndownService.addRule('wordDisplayMath', {
    filter: node => node.nodeName === 'SPAN' && node.getAttribute('data-math') === 'block',
    replacement: (_content, node) => `\n\n${mathElementSource(node as HTMLElement)}\n\n`,
  })
  const markdown = turndownService.turndown(restore(html))

  return { markdown, images, warnings }
}
