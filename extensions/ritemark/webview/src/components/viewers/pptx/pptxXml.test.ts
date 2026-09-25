/**
 * Sprint 125 (#285) — the PowerPoint package fixes, against the corpus's own decks.
 * Run: npx tsx webview/src/components/viewers/pptx/pptxXml.test.ts
 */
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import {
  decodeXmlText,
  deckFontFamilies,
  describeUnsupported,
  fixChartXml,
  notesPartFor,
  notesParagraphs,
  resolvePartPath,
  unsupportedIn,
} from './pptxXml'

const here = path.dirname(fileURLToPath(import.meta.url))
const corpus = path.resolve(here, '../../../../../../../docs/development/releases/v1.12.0/sprint-125-powerpoint-preview/research/corpus')
const part = async (deck: string, name: string) =>
  (await JSZip.loadAsync(fs.readFileSync(path.join(corpus, deck)))).file(name)!.async('string')

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const rels = (...entries: [string, string][]) => new Map(entries.map(([type, target], i) => [`rId${i + 1}`, { type, target }]))

async function main() {
  // Defect 1: a multi-series bar chart PowerPoint saved is no longer coloured by category.
  const bar = await part('ppt/05-charts.pptx', 'ppt/charts/chart1.xml')
  assert.match(bar, /<c:varyColors val="1"\/>/)
  const fixedBar = fixChartXml(bar)
  assert.match(fixedBar, /<c:varyColors val="0"\/>/)
  assert.doesNotMatch(fixedBar, /<c:title>/, 'two series: no automatic title, as in PowerPoint')

  // …but a single-series bar keeps it: PowerPoint colours each bar (08, slide 6).
  const single = await part('ppt/08-long-40-slides.pptx', 'ppt/charts/chart1.xml')
  const fixedSingle = fixChartXml(single)
  assert.match(fixedSingle, /<c:varyColors val="1"\/>/)

  // Defect 2: an empty title shows the series name (05 pie: "Revenue mix"; 08: "Series 1").
  const pie = fixChartXml(await part('ppt/05-charts.pptx', 'ppt/charts/chart4.xml'))
  assert.match(pie, /<c:title><c:tx><c:rich><a:bodyPr\/><a:lstStyle\/><a:p><a:pPr><a:defRPr sz="1400" b="1"\/><\/a:pPr><a:r><a:t>Revenue mix<\/a:t>/)
  assert.match(fixedSingle, /<c:title><c:tx>[\s\S]*?<a:t>Series 1<\/a:t>/)

  // A generated chart has no title element at all; PowerPoint shows one anyway.
  const generated = await part('fixtures/08-long-40-slides.pptx', 'ppt/charts/chart1.xml')
  assert.doesNotMatch(generated, /<c:title>/)
  const fixedGenerated = fixChartXml(generated)
  assert.match(fixedGenerated, /<c:chart><c:title><c:tx>[\s\S]*?<a:t>Series 1<\/a:t>[\s\S]*?<\/c:title>/)

  // The pass is idempotent, and leaves a deleted title and a titled chart alone.
  for (const xml of [bar, single, generated]) assert.equal(fixChartXml(fixChartXml(xml)), fixChartXml(xml))
  const deleted = generated.replace('<c:autoTitleDeleted val="0"/>', '<c:autoTitleDeleted val="1"/>')
  assert.equal(fixChartXml(deleted), deleted)
  assert.equal(fixChartXml(pie), pie)

  // Speaker notes: the body placeholder only, per paragraph, entities decoded.
  const notes = notesParagraphs(await part('ppt/07-notes.pptx', 'ppt/notesSlides/notesSlide2.xml'))
  assert.deepEqual(notes, ['NOTES 2: remind the audience of the goal, then walk through the two points. Pause for questions at the end.'])
  const handmade = '<p:notes><p:cSld><p:spTree>'
    + '<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum" idx="5"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:fld><a:t>3</a:t></a:fld></a:p></p:txBody></p:sp>'
    + '<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p/>'
    + '<a:p><a:r><a:rPr b="1"/><a:t>Costs &amp; risks</a:t></a:r><a:r><a:t> first</a:t></a:r></a:p>'
    + '<a:p><a:r><a:t>line one</a:t></a:r><a:br/><a:r><a:t>line two</a:t></a:r></a:p><a:p/></p:txBody></p:sp>'
    + '</p:spTree></p:cSld></p:notes>'
  assert.deepEqual(notesParagraphs(handmade), ['Costs & risks first', 'line one\nline two'])
  assert.deepEqual(notesParagraphs('<p:notes/>'), [])
  assert.equal(decodeXmlText('&lt;a&gt; &quot;b&quot; &#233; &#x2014; &amp;amp;'), '<a> "b" é — &amp;')

  // The fonts a deck names: theme fonts and run fonts, not theme references.
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(corpus, 'ppt/06-fonts.pptx')))
  const xmls = await Promise.all(
    Object.keys(zip.files).filter((n) => /^ppt\/(slides|slideLayouts|slideMasters|theme)\/[^/]+\.xml$/.test(n)).map((n) => zip.file(n)!.async('string')),
  )
  const families = deckFontFamilies(xmls)
  for (const family of ['Aptos Display', 'Aptos', 'Calibri', 'Arial', 'Georgia', 'Courier New', 'Ritemark Nowhere Sans']) {
    assert.ok(families.includes(family), family)
  }
  assert.ok(families.every((family) => !family.startsWith('+')))
  assert.deepEqual(deckFontFamilies(['<a:latin typeface="+mj-lt"/><a:latin typeface="A &amp; B" panose="0"/>']), ['A & B'])

  // Finding a slide's notes part.
  assert.equal(resolvePartPath('ppt/slides/slide1.xml', '../notesSlides/notesSlide1.xml'), 'ppt/notesSlides/notesSlide1.xml')
  assert.equal(resolvePartPath('ppt/slides/slide1.xml', 'media/image1.png'), 'ppt/slides/media/image1.png')
  assert.equal(resolvePartPath('ppt/slides/slide1.xml', '/ppt/media/image1.png'), 'ppt/media/image1.png')
  assert.equal(
    notesPartFor('ppt/slides/slide2.xml', rels([`${REL}/slideLayout`, '../slideLayouts/slideLayout2.xml'], [`${REL}/notesSlide`, '../notesSlides/notesSlide2.xml'])),
    'ppt/notesSlides/notesSlide2.xml',
  )
  assert.equal(notesPartFor('ppt/slides/slide2.xml', rels([`${REL}/slideLayout`, '../slideLayouts/slideLayout2.xml'])), null)

  // What the preview does not play or open, and how the notice says it.
  assert.deepEqual([...unsupportedIn(rels([`${REL}/image`, '../media/image1.png']))], [])
  assert.deepEqual([...unsupportedIn(rels([`${REL}/video`, '../media/media1.mp4'], ['http://schemas.microsoft.com/office/2007/relationships/media', '../media/media1.mp4']))], ['video'])
  assert.deepEqual([...unsupportedIn(rels(['http://schemas.microsoft.com/office/2007/relationships/media', '../media/media2.m4a']))], ['audio'])
  assert.deepEqual([...unsupportedIn(rels([`${REL}/oleObject`, '../embeddings/oleObject1.bin']))], ['embedded-objects'])
  assert.equal(describeUnsupported(new Set()), null)
  assert.equal(describeUnsupported(new Set(['video'])), 'This presentation has video that the preview can’t play.')
  assert.equal(describeUnsupported(new Set(['embedded-objects'])), 'This presentation has embedded objects that the preview can’t open.')
  assert.equal(
    describeUnsupported(new Set(['audio', 'video', 'embedded-objects'])),
    'This presentation has video, audio and embedded objects that the preview can’t play or open.',
  )

  console.log('pptxXml.test.ts: all passed')
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
