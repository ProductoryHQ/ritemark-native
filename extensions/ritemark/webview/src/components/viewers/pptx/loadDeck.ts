/**
 * Sprint 125 (#285) — from a deck's bytes to what the PowerPoint preview draws.
 *
 * The renderer parses the package (its ZIP limits on; the host has already
 * inflated every part, capped, before sending it — R5), the chart XML gets the
 * spike's fixes (R2), and the speaker notes, which the renderer does not read,
 * come from the notes slides (R4). The fonts the deck names get a sans fallback
 * where they are installed nowhere; Office's own fonts keep their 88 % aliases.
 */
import JSZip from 'jszip'
import {
  RECOMMENDED_ZIP_LIMITS,
  buildPresentation,
  buildTextIndex,
  parseZip,
  type PresentationData,
} from '@aiden0z/pptx-renderer'
import { registerPreprocessor } from 'echarts/core'
import { installFontFallbacks, installOfficeFontAliases } from '../docx/officeFonts'
import { slideParagraphs, type DeckText } from './deckSearch'
import {
  deckFontFamilies,
  describeUnsupported,
  fixChartXml,
  notesPartFor,
  notesParagraphs,
  unsupportedIn,
  type UnsupportedKind,
} from './pptxXml'

export interface LoadedDeck {
  presentation: PresentationData
  /** Speaker notes per slide, one string per paragraph. */
  notes: string[][]
  text: DeckText
  /** One line for the notice, or null. */
  unsupported: string | null
}

// Spike defect 13: charts animated for a second every time a slide was drawn,
// again on every scroll back. Every chart option passes through here first.
let animationOff = false
function turnOffChartAnimation(): void {
  if (animationOff) return
  animationOff = true
  registerPreprocessor((option) => {
    ;(option as { animation?: boolean }).animation = false
  })
}

export async function loadDeck(bytes: Uint8Array): Promise<LoadedDeck> {
  turnOffChartAnimation()
  installOfficeFontAliases()
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

  const files = await parseZip(buffer, RECOMMENDED_ZIP_LIMITS)
  for (const [path, xml] of files.charts) files.charts.set(path, fixChartXml(xml))
  installFontFallbacks(
    deckFontFamilies([...files.themes.values(), ...files.slideMasters.values(), ...files.slideLayouts.values(), ...files.slides.values()]),
  )

  const presentation = buildPresentation(files)
  const zip = await JSZip.loadAsync(buffer)
  const notes = await Promise.all(
    presentation.slides.map(async (slide) => {
      const part = notesPartFor(slide.slidePath, slide.rels)
      const xml = part ? await zip.file(part)?.async('string') : undefined
      return xml ? notesParagraphs(xml) : []
    }),
  )

  const kinds = new Set<UnsupportedKind>()
  for (const slide of presentation.slides) for (const kind of unsupportedIn(slide.rels)) kinds.add(kind)

  const index = buildTextIndex(presentation, { includeShapes: true, includeTables: true, includeGroups: true })
  return {
    presentation,
    notes,
    text: { slides: slideParagraphs(index, presentation.slides.length), notes },
    unsupported: describeUnsupported(kinds),
  }
}
